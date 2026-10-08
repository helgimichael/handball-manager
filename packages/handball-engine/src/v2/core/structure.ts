import { actionAvailable, courtPlayers, getPlayer, otherTeam, random, record, type CorePlayer, type CoreState, type Duty } from './state';
import { clamp, distance, goal, goalSide, keeperPost, laneClearance, local, numericalAdvantage, shootingAngle, shotQuality as quality, structurePoint, world } from './space';
import { driveTarget, resolveAction, startAction } from './actions';
import { exchangeActive } from './population';
import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { planContact } from './contact';
import { interrupt } from './transitions';
import { isWing,wingRelationship,wingTakeoffWindow,defendWing } from './wing';
import { isBack,planBackcourtSupport } from './backcourt';
import { chooseOffensiveAction,offensiveTarget,offensiveScreen,anticipatedDefenceTarget } from './offence';
import { PIVOT_FINISH_METERS,isPivot,pivotFinish,pivotOffer,pivotPost,pivotShotQuality,pivotShouldScreen,screenPost } from './pivot';
import { breakDefence,driveEngagement,readContinuation,rebuildValue,type Continuation } from './engage';
import { ZONE_COUNT,allocate,assignZones,dutyFeasible,dutyTarget,lineFormed,readDefence,zoneOf,zonePost,type DefenceRead,type ZoneDuty } from './defence';
import { sustain } from './actions';

function assign(s:CoreState,p:CorePlayer,kind:Duty,targetId:string|null,reason:string) {
  if(s.ball.mode==='LOOSE'&&p.duty.kind==='COLLECT')return;
  if(p.duty.kind!==kind||p.duty.targetId!==targetId||p.duty.reason!==reason) {
    p.duty={kind,targetId,sinceTick:s.tick,reason};record(s,'RESPONSIBILITY_ASSIGNED',p,{kind,reason},targetId?[targetId]:[]);
  }
}
/** One coordinator allocates pressure/help/cover; reachability never creates a second primary. */
export function coordinate(s: CoreState) {
  const attacking=s.possession.team,defending=otherTeam(attacking);
  // A DEFENCE SHIFTS WITH THE PASS, not after the catch.
  //
  // Nobody controls the ball while it is in the air, so the defensive read got
  // no carrier, `engaged` was null, and NOBODY was assigned to pressure for the
  // whole flight. The line then had to start travelling only once the receiver
  // had the ball, and a backcourt player needs about half a second to be met
  // from six-seventy-five -- almost exactly the time he takes to decide. So the
  // man receiving a swing pass was routinely unmarked at nine metres, which made
  // his shot look excellent and turned sixty per cent of every shot in the match
  // into a backcourt jump. A defence reads the pass and moves with it.
  const carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId)
    :s.ball.flight?.kind==='PASS'&&s.ball.flight.receiverId
      ?s.players.find(p=>p.id===s.ball.flight!.receiverId&&p.population==='COURT')??null
      :null;
  s.defence.system=s.coaching[defending].defence;
  const attackers=courtPlayers(s,attacking).filter(p=>p.kind==='FIELD_PLAYER'),defenders=courtPlayers(s,defending).filter(p=>p.kind==='FIELD_PLAYER');
  const direction=s.directions[attacking];
  for(const p of s.players)if(p.population!=='COURT'||p.team!==attacking||p.id===carrier?.id||s.possession.phase!=='ESTABLISHED'||!isBack(p))p.support=null;
  // COLLECTIVE DEFENCE: spaces are owned by role and are stable for the
  // possession. `marks` is no longer an allocation; it is a record of who is
  // currently standing in whose space, rebuilt from the zonal duties below.
  // Re-assign whenever the line is not a complete set of distinct spaces. A
  // substitute arriving with a stale zone, or a suspension leaving a hole, both
  // reach here, and a duplicated space is a broken line rather than a tolerable
  // one -- the core invariant refuses it outright.
  const owned=defenders.map(d=>d.zone).filter((z):z is number=>z!==null);
  const complete=owned.length===Math.min(defenders.length,ZONE_COUNT);
  if(!complete||new Set(owned).size!==owned.length)assignZones(s,defenders,direction);
  const read=readDefence(s,defenders,carrier?.team===attacking?carrier:null,direction);
  const zoneDuties=allocate(s,defenders,attackers,carrier?.team===attacking?carrier:null,read,direction,s.possession.phase==='TRANSITION');
  s.defence.read={engaged:read.engaged,shift:Number(read.shift.toFixed(3)),compact:read.compact};
  // COLLECTIVE DEFENCE: handover is what a zone defence does by construction.
  //
  // The old pairwise lock swapped two men between two defenders, which is a
  // man-marking device and had to go with man-marking. In a line, an attacker
  // who crosses simply leaves one space and enters the next: the defender he
  // leaves stays home and takes whoever arrives, and his neighbour takes the
  // man who has just come in. Nothing is negotiated, which is exactly why a
  // real 6:0 does not tear open on a crossing.
  //
  // What IS worth recording is the moment it happens, because a human watching
  // needs to see the two defenders pass the men on rather than follow them.
  const previousMarks={...s.defence.marks};
  const pressureEntry=[...zoneDuties].find(([,duty])=>duty.kind==='PRESSURE');
  const helperEntry=[...zoneDuties].find(([,duty])=>duty.kind==='HELP');
  s.defence.pressureId=pressureEntry?.[0]??null;s.defence.helperId=helperEntry?.[0]??null;
  // A HELP duty deliberately does NOT open a break. It is an allocation, not an
  // event: it flickers from tick to tick, and reading it as a defensive
  // reaction reported four hundred and forty breaks a match and left the
  // defence permanently "broken". Only the two things that actually happen to a
  // defender -- being beaten and being screened out -- open one, in duel() and
  // resolveScreens(), where each already has an episode lifecycle.
  s.defence.marks={};
  for(const d of defenders) {
    const duty=zoneDuties.get(d.id)!;
    if(duty.targetId)s.defence.marks[d.id]=duty.targetId;
    const before=previousMarks[d.id];
    // A takeover, and only a takeover: the man this space held has moved into
    // the neighbouring space and the man from it has come here. Both halves are
    // required, because a defender whose space merely emptied and refilled has
    // not handed anybody over -- asking only that his responsibility changed
    // reported eight hundred a match, and asking for a simultaneous mutual swap
    // reported one.
    if(before&&duty.targetId&&before!==duty.targetId&&d.zone!==null&&s.tick-s.defence.lastHandoverTick>50) {
      const released=s.players.find(p=>p.id===before),taken=s.players.find(p=>p.id===duty.targetId);
      const lane=(p:CorePlayer)=>zoneOf(direction==='BOTTOM'?20-p.position.x:p.position.x);
      const neighbour=defenders.find(o=>o.id!==d.id&&o.zone!==null&&Math.abs((o.zone??0)-(d.zone??0))===1);
      // Crossing attackers pass close to each other and are both moving. Two
      // men drifting across the court on opposite flanks are not a crossing.
      const crossing=!!released&&!!taken&&distance(released.position,taken.position)<4.5&&
        Math.hypot(released.velocity.x,released.velocity.y)+Math.hypot(taken.velocity.x,taken.velocity.y)>1.6;
      if(released&&taken&&neighbour&&crossing&&lane(released)===neighbour.zone&&lane(taken)===d.zone) {
        s.defence.lastHandoverTick=s.tick;
        record(s,'HANDOVER_COMPLETED',d,{zone:d.zone,released:before,taken:duty.targetId,reason:'Two attackers crossed between adjacent spaces and were exchanged'},[neighbour.id,before,duty.targetId]);
      }
    }
    const late=!dutyFeasible(s,d,duty,dutyTarget(s,d,duty,read,direction));
    const kind:Duty=duty.kind;
    assign(s,d,kind,duty.targetId,late?`${duty.reason} (arriving late)`:duty.reason);
  }
  for(const a of attackers) {
    if(a.id===carrier?.id)assign(s,a,'CARRIER',null,'Create advantage while respecting handling budget');
    else if(s.possession.phase==='TRANSITION')assign(s,a,['LW','RW'].includes(a.role)?'FIRST_WAVE':'SECOND_WAVE',null,s.offence.phase==='UPPSPEL'?'Separate wide first-wave outlets from trailing support':'Follow the first wave and attack before the defensive line settles');
    else if(isWing(a)){const relation=wingRelationship(s,a);assign(s,a,relation.mode==='PIN_CORNER'?'WING_PIN':'WING_OFFER',relation.back?.id??null,relation.reason);}
    else if(isBack(a)) {
      if(actionAvailable(a)&&(!a.support||a.support.possessionId!==s.possession.id||s.tick>=a.support.reviewAfterTick))a.support=planBackcourtSupport(s,a);
      if(a.support)assign(s,a,a.support.mode,a.support.partnerId,a.support.reason);
    }
    else assign(s,a,a.role==='P'||a.role==='P2'?'PIVOT':'CONNECT',null,'Maintain role relationships and move with the ball-side structure');
  }
  for(const p of courtPlayers(s).filter(p=>p.kind==='GOALKEEPER'))assign(s,p,'GOALKEEPER',null,'Protect own goal; commit only after reading a released shot');
  if(s.possession.phase==='TRANSITION'&&carrier&&local(carrier.position,direction).y<15&&defenders.filter(d=>local(d.position,direction).y<11).length>=5) {
    s.possession.phase='ESTABLISHED';record(s,'ATTACK_SETTLED',carrier,{reason:'Defence recovered its line'});
  }
}
/**
 * Retained as the engine's single entry point for handover bookkeeping.
 *
 * The zonal line performs the handover itself, so there is no pending exchange
 * to resolve. The stale lock is cleared here rather than left to rot, and the
 * function stays so the tick order does not have to change.
 */
export function resolveHandovers(s:CoreState) {
  if(s.defence.handover)s.defence.handover=null;
}
function chooseCarrier(s:CoreState,p:CorePlayer) {
  const direction=s.directions[p.team],q=local(p.position,direction);
  const pressure=courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind!=='GOALKEEPER'&&distance(d.position,p.position)<2).length;
  const keeper=courtPlayers(s,otherTeam(p.team)).find(d=>d.kind==='GOALKEEPER'&&goalAreaClearance(d.position,s.directions[p.team])<0);
  if(isWing(p)&&q.y<8&&!p.airborne&&!p.nextAction) {
    const relation=wingRelationship(s,p),angle=shootingAngle(p.position,direction);
    // FIRST, GET AN ANGLE. From out here he has none worth shooting from, and
    // improving it is a physical problem before it is a decision.
    const window=wingTakeoffWindow(s,p);
    if(window&&angle<=.14&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<24) {startAction(s,p,'DRIVE','Improve the wing angle through a legal grounded approach',window,s.defence.pressureId);return;}
    // THEN RANK IT like anybody else's. The wing used to shoot on a bar of his
    // own, well below the floor every other player had to clear, because his
    // alternative was a pass back out and an attack that worked the ball wide
    // and then declined had achieved nothing. That is no longer true: the ball
    // goes back through the middle and the attack rebuilds, so declining costs
    // nothing and a wide shot has to be worth taking on its merits.
    if(s.tick-p.handling.heldSinceTick<38&&pressure<=1) {
      const shot=readContinuation(s,p);
      if(shot?.kind==='SHOOT'&&startAction(s,p,'JUMP',shot.reason))return;
    }
    if(relation.back&&laneClearance(s,p.position,relation.back.position,p.team)>.45){startAction(s,p,'PASS','Wing window closed; reconnect with the adjacent back',null,relation.back.id);return;}
  }
  // Running out of steps is not a reason to shoot. A handball player who has
  // used his three steps and still has time bounces the ball, and the engine had
  // him fire from wherever he stood instead: a hundred and nine standing shots a
  // match, and twenty-nine handling violations for the ones who did not.
  if(p.handling.steps>=s.ruleProfile.maxSteps-1&&!p.handling.dribbleUsed&&!p.airborne&&s.tick-p.handling.heldSinceTick<30&&q.y<19) {
    if(startAction(s,p,'DRIBBLE','Out of steps with time left; put the ball down',world({x:clamp(q.x,2,18),y:Math.max(7,q.y-1.5)},direction)))return;
  }
  if(p.nextAction==='SHOOT') {
    p.nextAction=null;
    // A line player releasing from close range is a PIVOT finish, which is its
    // own shot and was never produced by any code path before.
    const kind=isPivot(p)&&distance(p.position,goal(direction))<=PIVOT_FINISH_METERS?'PIVOT'
      :q.y<8?(q.x<4||q.x>16?'WING':'BREAKTHROUGH'):'BACKCOURT_JUMP';
    startAction(s,p,'SHOOT','Release from actual takeoff position',null,null,kind);return;
  }
  // THE LINE PLAYER FINISHES. He has caught with his back to goal a metre or
  // two out; he turns, or he goes down and through the line. Either way it is
  // the most efficient shot in handball and it now exists.
  if(isPivot(p)&&distance(p.position,goal(direction))<=PIVOT_FINISH_METERS&&!p.airborne&&!p.nextAction) {
    const worth=pivotShotQuality(s,p);
    if(worth>.34) {
      const finish=pivotFinish(s,p);
      if(finish==='FALL'&&startAction(s,p,'JUMP',`Fall shot through the line: quality ${worth.toFixed(2)}`))return;
      if(finish==='TURN'&&startAction(s,p,'SHOOT',`Turn and finish on the line: quality ${worth.toFixed(2)}`,null,null,'PIVOT'))return;
    }
  }
  if(p.nextAction==='DRIVE') {p.nextAction=null;startAction(s,p,'DRIVE','Exploit committed feint and test inside lane',driveTarget(s,p),s.defence.pressureId);return;}
  if(s.referee.passive.warnedTick!==null&&s.referee.passive.passes>=4&&q.y<18&&!p.airborne){startAction(s,p,'SHOOT','Finish before the passive-play pass allowance is exhausted',null,null,'STANDING');return;}
  if(s.tick-p.handling.heldSinceTick<(s.coaching[p.team].tempo==='QUICK'?6:10)){startAction(s,p,'HOLD','Secure control and read coordinated defence');return;}
  if(!keeper&&q.y<28){startAction(s,p,'SHOOT','Goalkeeper absent; executable empty-goal opportunity',null,null,'EMPTY_GOAL');return;}
  // POSSESSION ECOLOGY: solve the problem in front of him.
  //
  // Read in the order handball reads it -- a freed man, the line player, an
  // interval, a feint to make somebody commit, and recycling when none of that
  // is there. This sits ahead of the entry relationship because a local
  // advantage that exists NOW outranks a plan, and ahead of the generic
  // circulation ranking because circulation is what you do when there is no
  // problem to solve, not instead of solving one.
  const angle=shootingAngle(p.position,direction),advantage=numericalAdvantage(s,p);
  // PLAYER IDENTITY: what counts as a shot worth taking is his judgement about
  // his own finishing, not a shared depth threshold. A shooting back backs
  // himself from ten metres; a wing needs the angle; a poor finisher works for
  // something better and that is why his team circulates instead of firing.
  const shotWorth=quality(s,p,pressure);
  const threshold=.42/Math.max(.5,p.profile.tendency.shoot)-(advantage>0?.05:0)-(s.possession.phase==='TRANSITION'?.07:0);
  const hasOpportunity=shotWorth>=threshold&&angle>.13&&
    (s.possession.completedPasses>=2||s.possession.phase==='TRANSITION'||p.role==='P'||(q.y<9&&s.defence.helperId!==null));
  // THE SAME READ ON A BREAK AS IN A SET ATTACK. What changes on a fast break is
  // what is AVAILABLE -- readContinuation already knows a transition shot needs
  // no build-up behind it -- not whether the carrier is allowed to look. Gating
  // the whole ranked read on an established possession meant that during a break
  // he could not reach the shot at all: a three-against-two ran for thirty
  // seconds and twelve passes and ended in a foul without one.
  if(s.tick-p.handling.heldSinceTick>=5) {
    const next=readContinuation(s,p);
    if(next&&applyContinuation(s,p,next))return;
  }
  // THE EMERGENCY, AND ONLY WHEN IT IS ONE.
  //
  // This used to sit ahead of the continuation read, so a carrier who had a
  // perfectly good answer never got to give it: the read was never consulted and
  // he threw the ball to whoever had the cleanest lane. Half of every completed
  // pass in the match arrived from here. It belongs after the read -- he has
  // looked at the shot, the line player, the interval, the feint and the
  // recycle, and none of them was there -- which is what makes it an exception.
  if(s.tick-p.handling.heldSinceTick>36&&q.y<14&&!p.airborne) {
    // Never out of the line player. A three-second problem is solved by passing
    // BACK, not by throwing the ball into the middle of the defence at the man
    // with a defender on his back: thirty-five of his receptions a match came
    // from here, and none of them were a decision to feed him.
    const outlet=courtPlayers(s,p.team).filter(a=>a.id!==p.id&&a.kind!=='GOALKEEPER'&&!a.airborne&&!exchangeActive(s,a.id)&&!isPivot(a))
      .map(a=>({a,lane:laneClearance(s,p.position,a.position,p.team)}))
      // Any pass he can actually complete beats a shot from wherever he is
      // standing. Requiring half a metre of clearance within fifteen metres
      // left him with nothing to do surprisingly often, and firing was the
      // fallback: a quarter of every shot in the match came from this branch.
      .filter(x=>x.lane>.28)
      // The cleanest lane on the court always belongs to the man nobody is
      // marking, which is a wing standing in the corner. Sorting on it alone
      // sent sixty balls a match out there, and a wing who receives shoots:
      // the two of them scored nearly half the goals in the match. Ball-in-
      // trouble goes to somebody who can rebuild with it, as long as the pass
      // can actually be completed.
      .sort((x,y)=>(rebuildValue(s,y.a,direction)+Math.min(y.lane,1.5)*.3)
                  -(rebuildValue(s,x.a,direction)+Math.min(x.lane,1.5)*.3))[0];
    if(outlet){startAction(s,p,'PASS','Time is short; move the ball rather than force a shot',null,outlet.a.id);return;}
    p.nextAction=null;startAction(s,p,'SHOOT','Nobody to pass to before the three seconds expire',null,null,'STANDING');return;
  }
  if(chooseOffensiveAction(s,p))return;
  if(!keeper&&q.y<28){startAction(s,p,'SHOOT','Goalkeeper absent; executable empty-goal opportunity',null,null,'EMPTY_GOAL');return;}
  if(pressure===0&&q.y>=9&&q.y<14&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<26&&s.possession.completedPasses>0) {
    startAction(s,p,'DRIVE','Attack the available shoulder to engage cover before continuation',driveTarget(s,p),s.defence.pressureId);return;
  }
  if(pressure===1&&q.y>=8&&q.y<13.5&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<30&&!p.handling.dribbleUsed) {
    startAction(s,p,'FEINT','Engage the pressure defender before committing to a shoulder',null,s.defence.pressureId);return;
  }
  if(hasOpportunity) {
    startAction(s,p,'JUMP',`Shot worth taking: quality ${shotWorth.toFixed(2)} over ${threshold.toFixed(2)}, angle ${angle.toFixed(2)}, pressure ${pressure}`);return;
  }
  if(s.possession.phase==='TRANSITION'&&!p.handling.dribbleUsed&&q.y>14&&laneClearance(s,p.position,world({x:q.x,y:q.y-4},direction),p.team)>.7) {
    if(startAction(s,p,'DRIBBLE','Advance through open transition lane with legal continuous bounce',world({x:q.x,y:Math.max(9,q.y-9)},direction)))p.action!.executeTicks=40;
    return;
  }
  if(pressure===1&&!p.handling.dribbleUsed&&q.y<10&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<30) {
    startAction(s,p,'FEINT','Engage the primary defender before attacking a shoulder',null,s.defence.pressureId);return;
  }
  const receivers=courtPlayers(s,p.team).filter(a=>a.id!==p.id&&a.kind!=='GOALKEEPER'&&!a.airborne&&!exchangeActive(s,a.id));
  const ranked=receivers.map(a=>{
    const clearance=laneClearance(s,p.position,a.position,p.team),depth=local(a.position,direction).y;
    return {a,clearance,score:Math.min(clearance,3)*1.5+(q.y-depth)*.22-(a.id===s.possession.lastPasserId?2:0)-(distance(p.position,a.position)>17?3:0)};
  }).filter(x=>x.clearance>.45).sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id));
  if(ranked.length&&s.tick-p.handling.heldSinceTick<48){const choice=ranked[0];startAction(s,p,'PASS',`Continue to ${choice.a.role}: passing-lane clearance ${choice.clearance.toFixed(2)} m`,null,choice.a.id);return;}
  if(q.y<14)startAction(s,p,'JUMP','No safe continuation; shoot before the handling limit');
  else if(!p.handling.dribbleUsed)startAction(s,p,'DRIBBLE','Retain control while finding an outlet',world({x:clamp(q.x+2,2,18),y:q.y-2},direction));
  else if(ranked.length)startAction(s,p,'PASS','Release before handling violation',null,ranked[0].a.id);
  else startAction(s,p,'HOLD','No legal available outlet; referee handling limit remains authoritative');
}
/**
 * CARRY OUT A CONTINUATION. One dispatch, used by a carrier who is deciding
 * freshly and by one releasing out of a drive, so that the two cannot drift
 * apart into different ideas of what "play the freed man" means.
 */
export function applyContinuation(s:CoreState,p:CorePlayer,next:NonNullable<Continuation>):boolean {
  if(next.kind==='SHOOT') {
    // A BACKCOURT SHOT IS A JUMP SHOT. He takes off, sees over the block and
    // releases at height, and the standing shot is what is left when he has no
    // steps to take off with or no time to use them. Grounding him whenever two
    // defenders were near did the opposite: the centre back, who is marked by
    // two men by definition, jumped less than once a match and shot standing
    // instead, and standing shots were a fifth of the match.
    // THE JUMP IS THE LAST STEP. A back who has driven and spent his steps takes
    // off from the final one -- that is what a backcourt jump shot IS, and it is
    // the natural end of a drive. Requiring a SPARE step meant that every shot
    // taken after driving was flat-footed, and once the drive could release
    // properly that was forty-eight per cent of every shot in the match.
    // RUSHED MEANS THERE IS NO TIME TO TAKE OFF, not that some of the three
    // seconds has gone. A takeoff and release costs about fourteen ticks, so
    // that is the real deadline; a fixed thirty-four was little over half the
    // allowance and made every shot after a drive flat-footed.
    const rushed=s.tick-p.handling.heldSinceTick>s.ruleProfile.maxHoldMs/50-14;
    const canTakeOff=p.handling.steps<s.ruleProfile.maxSteps&&!rushed;
    if(canTakeOff&&startAction(s,p,'JUMP',next.reason))return true;
    return startAction(s,p,'SHOOT',next.reason,null,null,'STANDING');
  }
  // ONE ATTACK ON AN INTERVAL IS ONE ACTION. The drive is bounded by the three
  // steps he has; re-issuing it each time those steps ran out split a single
  // attacking move into a string of them and credited him with beating the same
  // defender over and over.
  if(next.kind==='ATTACK_INTERVAL') {
    if(sustain(s,p,'DRIVE',next.point,next.defenderId,1.3))return true;
    return startAction(s,p,'DRIVE',next.reason,next.point,next.defenderId);
  }
  if(next.kind==='FEINT')return startAction(s,p,'FEINT',next.reason,null,next.defenderId);
  if(next.kind==='PLAY_FREED')return startAction(s,p,'PASS',next.reason,null,next.receiverId);
  if(next.kind==='RECYCLE'&&s.tick-p.handling.heldSinceTick>16)
    return startAction(s,p,'PASS',next.reason,null,next.receiverId);
  return false;
}

/**
 * RELEASE OUT OF THE DRIVE.
 *
 * The missing half of the attack. A running action blocks every other one and a
 * player who has one is never asked to decide again, so a carrier who had set
 * off at an interval could neither shoot nor pass out of it: he ran the approach
 * to its end, ran out of his three seconds, and threw the ball away. Measured at
 * the tick the three-second branch fired he was inside a DRIVE ninety-one per
 * cent of the time while his own read said RECYCLE or SHOOT in nine cases out of
 * ten, and half of every completed pass in the match arrived as that panic.
 *
 * Two things make this different from cancelling the drive. It waits until the
 * drive has actually ENGAGED somebody -- cutting it on the tick a better option
 * appeared meant no drive ever finished and beaten defenders fell from eighty a
 * match to three. And it RESOLVES the drive rather than interrupting it: the
 * engagement, the beaten state, the break, the steps and the ball all stand,
 * because the pass is what the drive was for.
 *
 * A read that says keep working -- attack the interval, feint -- is not a
 * release, and he carries on.
 */
export function releaseFromDrive(s:CoreState,carrier:CorePlayer|null):boolean {
  if(!carrier||carrier.kind!=='FIELD_PLAYER'||carrier.team!==s.possession.team)return false;
  if(s.ball.controllerId!==carrier.id||carrier.airborne)return false;
  const a=carrier.action;
  if(!a||a.kind!=='DRIVE'||actionAvailable(carrier))return false;
  const engagement=driveEngagement(s,carrier);
  if(!engagement.engaged)return false;
  // THE COVER COMING ACROSS IS THE POINT OF THE DRIVE. A second defender who
  // has physically arrived at the carrier has left somebody, and that man is
  // the ball. This is the two-against-two in one line -- a back attacks his
  // man, the next defender helps, and the line player is free behind him -- and
  // without it the carrier had nobody to play and simply shot instead.
  //
  // Unlike the HELP duty, which flickers from tick to tick and reported four
  // hundred breaks a match, this is an event: he is here, now, on the ball.
  if(engagement.defenderId&&engagement.reason==='the cover has come across') {
    const helper=s.players.find(d=>d.id===engagement.defenderId);
    if(helper)breakDefence(s,helper,'came across to help');
  }
  const next=readContinuation(s,carrier);
  if(!next||next.kind==='ATTACK_INTERVAL'||next.kind==='FEINT')return false;
  resolveAction(s,carrier,`Drive engaged: ${engagement.reason}`);
  if(!applyContinuation(s,carrier,next)){record(s,'DRIVE_RELEASE_FAILED',carrier,{into:next.kind});return false;}
  record(s,'DRIVE_RELEASED',carrier,{reason:engagement.reason,into:next.kind},
    'receiverId' in next?[next.receiverId]:[]);
  return true;
}

export function selectActions(s:CoreState) {
  const direction=s.directions[s.possession.team];
  const defenders=courtPlayers(s,otherTeam(s.possession.team)).filter(p=>p.kind==='FIELD_PLAYER');
  const carrierNow=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;
  const defenceRead=defenders.length?readDefence(s,defenders,carrierNow?.team===s.possession.team?carrierNow:null,direction):null;
  const prospective=s.players.find(p=>p.action?.kind==='PASS'&&!['COMPLETED','FAILED','INTERRUPTED'].includes(p.action.phase));
  const receiverId=s.ball.flight?.receiverId??prospective?.action?.targetId;
  // A shot in flight interrupts a goalkeeper's repositioning. Letting movement
  // actions persist until they arrive was right for outfield play and wrong
  // here: the keeper stayed committed to walking along his line and never
  // started a save at all, which quietly removed goalkeeping from the match.
  if(s.ball.flight?.kind==='SHOT') {
    const shooter=getPlayer(s,s.ball.flight.fromId);
    for(const k of courtPlayers(s).filter(k=>k.kind==='GOALKEEPER'&&k.team!==shooter.team)) {
      if(k.action&&k.action.kind!=='SAVE'&&!['COMPLETED','INTERRUPTED','FAILED'].includes(k.action.phase))interrupt(s,k,'Shot released; abandon repositioning');
    }
  }
  // The carrier releases out of his drive before anybody else is asked to do
  // anything, because what he does decides what the rest of them are reacting to.
  releaseFromDrive(s,carrierNow);
  for(const p of courtPlayers(s)) {
    if(!actionAvailable(p))continue;
    if(exchangeActive(s,p.id)&&s.ball.controllerId!==p.id)continue;
    if(p.airborne&&s.ball.controllerId!==p.id){startAction(s,p,'LAND','Complete airborne action before new movement');continue;}
    if(s.ball.controllerId===p.id){chooseCarrier(s,p);continue;}
    if(p.kind==='GOALKEEPER') {
      const ownGoal=s.directions[otherTeam(p.team)],ball=local(s.ball.position,ownGoal);
      // Position from shooter/ball geometry, never read a future target before release.
      if(s.ball.flight?.kind==='SHOT'&&getPlayer(s,s.ball.flight.fromId).team!==p.team) {
        const f=s.ball.flight,k=p.profile.keeper;
        // A goalkeeper COMMITS ONCE. He reads the ball out of the hand, decides
        // where he is going and goes; he does not re-solve the trajectory every
        // twentieth of a second. Re-aiming each tick made his error shrink to
        // nothing by the moment of arrival, which is why he caught eighty-three
        // per cent of wing shots: he was not saving them, he was already there.
        // Committed already for THIS shot: he stays committed.
        const committed=p.action?.kind==='SAVE'&&p.action.targetId===f.actionId&&!['COMPLETED','INTERRUPTED','FAILED'].includes(p.action.phase);
        // A keeper already SET -- which is how he waits for a seven-metre -- is
        // steered onto the ball rather than started again. Starting a fresh save
        // costs four ticks before it is executing and a seven-metre flight lasts
        // about six, so he was never ready in time and penalties went in at
        // ninety-four per cent. This is the difference between reacting from a
        // stance and setting off from scratch.
        const set=p.action?.kind==='SAVE'&&p.action.targetId===null&&
          !['COMPLETED','INTERRUPTED','FAILED'].includes(p.action.phase);
        if(!committed) {
          const t=Math.max(0,(world({x:10,y:1.4},ownGoal).y-s.ball.position.y)/f.velocity.y);
          const read=(k?.reading??.5)*.45+(k?.reaction??.5)*.35+(k?.positioning??.5)*.2;
          // He has had exactly as long as the ball has been in the air. A hard
          // shot from nine metres gives him a third of a second and no more.
          const flown=(s.tick-f.releasedTick)*.05;
          // A harder ball is a harder read. Twenty-three metres a second from
          // nine metres is four tenths of a second, and that is what shooting
          // power buys: not a faster ball for its own sake, but less time.
          const pace=Math.hypot(f.velocity.x,f.velocity.y);
          const blind=(1.5-read)*Math.max(.4,1-flown*1.6)*(.82+pace/56);
          const guess=s.ball.position.x+f.velocity.x*t+(random(s)-.5)*2*blind;
          // He may step outside the posts. Against a wing the ball crosses his
          // own depth line several metres wide of the goal, and a keeper pinned
          // between the posts is standing where the ball has already been.
          const commitTo=world({x:clamp(guess,5.5,14.5),y:1.4},ownGoal);
          if(set&&sustain(s,p,'SAVE',commitTo,null,6)){p.action!.targetId=f.actionId;continue;}
          if(startAction(s,p,'SAVE','Read the ball out of the hand, commit and go',commitTo,f.actionId))
            p.action!.executeTicks=40;
        }
      } else {
        // PLAYER IDENTITY: how far off his line he sets      } else {
        // PLAYER IDENTITY: how far off his line he sets, and how tightly he
        // tracks the ball across the goal, is his own positioning attribute.
        const k=p.profile.keeper;
        // Narrowing the angle is most of goalkeeping, and the bisector is what
        // narrowing it means. How close to ideal he actually gets is his own
        // positioning; a poor keeper drifts back toward the centre of his goal.
        const depth=1.05+.6*(k?.setPosition??.5);
        const ideal=keeperPost(s.ball.position,ownGoal,depth);
        const lazy=world({x:10,y:depth},ownGoal);
        const quality=k?.positioning??.5;
        const spot={x:lazy.x+(ideal.x-lazy.x)*(.45+.55*quality),y:ideal.y};
        // A keeper who is already set stands set. Re-issuing the same spot to a
        // man standing on it is the churn this whole pass exists to remove.
        if(!sustain(s,p,'REPOSITION',spot,null,.6)&&distance(p.position,spot)>.22&&startAction(s,p,'REPOSITION','Position between ball and defended goal',spot))p.action!.executeTicks=4;
      }
      continue;
    }
    if(p.id===receiverId){startAction(s,p,'RECEIVE','Prepare hands for named pass; ownership requires contact',null,prospective?.id??s.ball.flight?.fromId??null);continue;}
    if(s.ball.mode==='LOOSE') {if(p.duty.kind==='COLLECT')startAction(s,p,'RECEIVE','Contest the loose ball',s.ball.position);continue;}
    if(p.team!==s.possession.team) {
      const marked=p.duty.targetId?getPlayer(s,p.duty.targetId):null;
      // COLLECTIVE DEFENCE: the position comes from the line, never from
      // following a man around the court. A wing in the corner is the one
      // exception, because the corner is outside every zone.
      const duty:ZoneDuty={kind:p.duty.kind==='RETREAT'?'RECOVER':p.duty.kind as ZoneDuty['kind'],targetId:p.duty.targetId,reason:p.duty.reason} as ZoneDuty;
      const line=defenceRead?dutyTarget(s,p,duty,defenceRead,direction):p.position;
      const target=marked&&isWing(marked)&&local(marked.position,direction).y<8&&['MARK','PRESSURE','COVER'].includes(p.duty.kind)?defendWing(s,p,marked)??line:line;
      const kind=p.duty.kind==='HELP'?'HELP':p.duty.kind==='RECOVER'||p.duty.kind==='RETREAT'?'RECOVER':p.duty.kind==='PRESSURE'?'PRESS':'CONTAIN';
      const carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;
      if(carrier&&carrier.team!==p.team&&planContact(s,p,carrier))continue;
      if(carrier?.team!==p.team&&carrier?.airborne&&distance(p.position,carrier.position)<2)startAction(s,p,'BLOCK','Contest visible shooting action',null,carrier.id);
      else {
        const aimed=anticipatedDefenceTarget(s,p,target);
        // MATCH RHYTHM: a defender tracking his space is one action whose
        // destination drifts, not a new decision every tick, and a defender
        // standing on his post is holding it rather than running to it.
        if(!sustain(s,p,kind,aimed,p.duty.targetId,1.4)&&distance(p.position,aimed)>.3)startAction(s,p,kind,p.duty.reason,aimed,p.duty.targetId);
      }
    } else {
      // A line player who has been named for a feed CHECKS AND HOLDS. He is
      // taking the ball with his back to goal a metre off the line, and a pivot
      // who keeps working the line while the feed is in the air runs off the
      // end of it: nineteen of the twenty-two balls that left the court in a
      // match were feeds to a moving line player.
      if(isPivot(p)&&p.reception!==null) {
        if(!sustain(s,p,'RECEIVE',null,null))startAction(s,p,'RECEIVE','Check and present for the feed');
        continue;
      }
      // THE LINE PLAYER works the line: he moves to the interval worth
      // occupying and screens the man who is about to have to stop the ball,
      // instead of standing on a fixed anchor and drifting a few tenths.
      // HE HOLDS THE SCREEN HE HAS STARTED. Re-reading who is worth screening
      // every tick meant that as the ball circulated the pivot abandoned one man
      // for the next and set two hundred and forty screens a match. A live
      // engagement is its own memory: the man he is already screening stays his
      // man until the engagement ends on its own terms.
      const engaged=isPivot(p)?courtPlayers(s,otherTeam(p.team)).find(d=>d.screenedBy===p.id)??null:null;
      const screenTarget=isPivot(p)&&s.possession.phase==='ESTABLISHED'?(engaged??pivotShouldScreen(s,p)):null;
      let target=s.possession.phase==='ESTABLISHED'
        ?(isWing(p)?wingRelationship(s,p).target
          :isPivot(p)?(screenTarget?screenPost(s,p,screenTarget):pivotPost(s,p))
          :p.support?.target??structurePoint(p.role,direction,s.ball.position.x))
        :structurePoint(p.role,direction,s.ball.position.x);
      if(s.possession.phase==='TRANSITION') {
        const q=local(p.position,direction),ballDepth=local(s.ball.position,direction).y;
        const trailing=p.duty.kind==='SECOND_WAVE'?Math.min(q.y,ballDepth+(s.offence.phase==='UPPSPEL'?2:1)):0;
        target=world({x:p.role==='LB'?5:p.role==='RB'?15:target.x,y:Math.max(local(target,direction).y,q.y-7,trailing)},direction);
      }
      const entryTarget=offensiveTarget(s,p);if(entryTarget)target=entryTarget;
      // ONE SCREEN IS ONE ACTION. Re-issuing it every time the last one
      // completed made the same body in the same defender's path count as a
      // fresh screen again and again.
      if((offensiveScreen(s,p)||screenTarget)&&distance(p.position,target)<.85) {
        const mark=screenTarget?.id??s.defence.pressureId;
        if(!sustain(s,p,'SCREEN',null,mark))startAction(s,p,'SCREEN',screenTarget?'Screen the defender who has to stop the ball':'Establish stationary screen at the intended defensive interval',null,mark);
      }
      else if(distance(p.position,target)>.55){if(!sustain(s,p,'RUN',target,null))startAction(s,p,'RUN',p.duty.reason,target);}
      else if(!sustain(s,p,'RECEIVE',null,null))startAction(s,p,'RECEIVE','Offer an available passing connection from assigned role');
    }
  }
}
