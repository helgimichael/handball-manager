import { actionAvailable, courtPlayers, getPlayer, otherTeam, random, record, type CorePlayer, type CoreState, type Duty } from './state';
import { clamp, clearGoalArea, distance, goal, goalSide, keeperPost, laneClearance, local, segmentPoint, shootingAngle, shotOpportunity, structurePoint, world } from './space';
import { driveTarget, resolveAction, startAction, visibleShotPreparation } from './actions';
import { exchangeActive } from './population';
import { planContact } from './contact';
import { interrupt } from './transitions';
import { isWing,wingRelationship,wingTakeoffWindow,defendWing } from './wing';
import { isBack,planBackcourtSupport } from './backcourt';
import { chooseOffensiveAction,offensiveTarget,offensiveScreen,anticipatedDefenceTarget } from './offence';
import { PIVOT_FINISH_METERS,isPivot,pivotCatchApproach,pivotFinish,pivotOffer,pivotPost,pivotRollTarget,pivotShotQuality,pivotShouldScreen,screenPost } from './pivot';
import { breakDefence,driveEngagement,readContinuation,rebuildValue,type Continuation } from './engage';
import { ZONE_COUNT,allocate,assignZones,dutyFeasible,dutyTarget,lineFormed,readDefence,zoneOf,type DefenceRead,type ZoneDuty } from './defence';
import { sustain } from './actions';
import { laneMargin } from './timing';
import { prepareKeeperAnticipation } from './execution';
const PIVOT_ROLL_REASON='Roll into the line space created by the backcourt threat';
const PIVOT_CATCH_REASON='Turn the secured pivot catch toward the actual close-range window';

function assign(s:CoreState,p:CorePlayer,kind:Duty,targetId:string|null,reason:string) {
  if(s.ball.mode==='LOOSE'&&p.duty.kind==='COLLECT')return;
  if(p.duty.kind!==kind||p.duty.targetId!==targetId||p.duty.reason!==reason) {
    p.duty={kind,targetId,sinceTick:s.tick,reason};record(s,'RESPONSIBILITY_ASSIGNED',p,{kind,reason},targetId?[targetId]:[]);
  }
}
function finishingThreat(s:CoreState,p:CorePlayer,direction:CoreState['directions']['HOME']):boolean {
  const q=local(p.position,direction);
  if(isWing(p))return q.y<8&&(shotOpportunity(s,p)!==null||wingTakeoffWindow(s,p)!==null);
  if(isPivot(p))return q.y<10&&distance(p.position,goal(direction))<=PIVOT_FINISH_METERS+1.3;
  return q.y<9.5&&shotOpportunity(s,p)!==null;
}
function threatContained(s:CoreState,p:CorePlayer,defenders:CorePlayer[],direction:CoreState['directions']['HOME']):boolean {
  return defenders.some(d=>{
    if(d.beatenUntilTick>s.tick||d.screenedUntilTick>s.tick||d.wrongFootedUntilTick>s.tick||distance(d.position,p.position)>2.6)return false;
    // A line defender can deny the turn while staying physically on M6. A
    // remote PIVOT label cannot replace that actual contact relationship.
    if(isPivot(p)&&d.duty.kind==='PIVOT'&&d.duty.targetId===p.id&&distance(d.position,p.position)<1.35)return true;
    // Goal-side is a goalward path, not only end-line depth. The defender of a
    // wing closes inward toward the near post, often at nearly equal depth.
    const path=segmentPoint(p.position,goal(direction),d.position);
    return path.t>0&&path.t<1&&distance(d.position,path.point)<1.1;
  });
}
/** A recovered central line must also account for the actual finishing threats. */
export function transitionReadyToSettle(s:CoreState):boolean {
  if(s.possession.phase!=='TRANSITION'||!s.ball.controllerId||s.ball.flight)return false;
  const carrier=getPlayer(s,s.ball.controllerId),direction=s.directions[s.possession.team];
  if(carrier.team!==s.possession.team||carrier.kind!=='FIELD_PLAYER'||local(carrier.position,direction).y>=15)return false;
  // The finish already selected from this transition owns its physical
  // takeoff/release. A recovering line does not turn that action into buildup.
  if(carrier.airborne||carrier.action&&['JUMP','SHOOT'].includes(carrier.action.kind)&&!actionAvailable(carrier))return false;
  const defenders=courtPlayers(s,otherTeam(carrier.team)).filter(d=>d.kind==='FIELD_PLAYER');
  if(!lineFormed(s,defenders,direction))return false;
  if(finishingThreat(s,carrier,direction)&&!threatContained(s,carrier,defenders,direction))return false;
  const outlets=courtPlayers(s,carrier.team).filter(a=>a.id!==carrier.id&&a.kind==='FIELD_PLAYER'&&a.duty.kind==='FIRST_WAVE'&&
    !a.airborne&&!a.condition.unavailable&&!a.condition.exitRequired&&!exchangeActive(s,a.id)&&finishingThreat(s,a,direction));
  return outlets.every(a=>{
    if(laneMargin(s,carrier.position,a.position,carrier.team,10.5+3*carrier.profile.passing).seconds<=.05)return true;
    return threatContained(s,a,defenders,direction);
  });
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
      const lane=(p:CorePlayer)=>zoneOf(p.position.x);
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
      if(!a.support||a.support.possessionId!==s.possession.id||s.tick>=a.support.reviewAfterTick)a.support=planBackcourtSupport(s,a);
      if(a.support)assign(s,a,a.support.mode,a.support.partnerId,a.support.reason);
    }
    else assign(s,a,a.role==='P'||a.role==='P2'?'PIVOT':'CONNECT',null,'Maintain role relationships and move with the ball-side structure');
  }
  for(const p of courtPlayers(s).filter(p=>p.kind==='GOALKEEPER'))assign(s,p,'GOALKEEPER',null,'Protect own goal; commit only after reading a released shot');
  if(transitionReadyToSettle(s)) {
    const controlled=getPlayer(s,s.ball.controllerId!);
    s.possession.phase='ESTABLISHED';record(s,'ATTACK_SETTLED',controlled,{reason:'Recovered line contains the actual ball and playable finishing threats',carrierDepth:Number(local(controlled.position,direction).y.toFixed(2))});
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
/** Secure/court-read time comes from the player and tempo, never padding a possession. */
export function controlReadTicks(s:CoreState,p:CorePlayer):number {
  return Math.round((s.coaching[p.team].tempo==='QUICK'?5:8)+(1-p.profile.decision)*4+(1-p.condition.energy)*3);
}
function secureRead(s:CoreState,p:CorePlayer,reason:string):boolean {
  if(!startAction(s,p,'HOLD',reason))return false;
  const remaining=controlReadTicks(s,p)-(s.tick-p.handling.heldSinceTick);
  // Preparation and recovery already cost six ticks. Do not add that reading
  // budget again on top of a fixed HOLD lifecycle.
  p.action!.executeTicks=Math.max(1,remaining-6);return true;
}
/** A counter reads actual ahead runners before any settled rebuilding policy. */
function transitionProgress(s:CoreState,p:CorePlayer):boolean {
  const direction=s.directions[p.team],q=local(p.position,direction);
  if(s.possession.phase!=='TRANSITION'||q.y<=14)return false;
  const defenders=courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind==='FIELD_PLAYER');
  const runners=courtPlayers(s,p.team).filter(a=>a.id!==p.id&&a.kind==='FIELD_PLAYER'&&a.duty.kind==='FIRST_WAVE'&&
    !a.airborne&&!a.condition.unavailable&&!a.condition.exitRequired&&!exchangeActive(s,a.id));
  const candidates=runners.map(a=>{
    const progress=q.y-local(a.position,direction).y;
    const lane=laneMargin(s,p.position,a.position,p.team,10.5+3*p.profile.passing).seconds;
    const separation=Math.min(8,...defenders.filter(d=>d.beatenUntilTick<=s.tick&&d.screenedUntilTick<=s.tick).map(d=>distance(d.position,a.position)));
    return {a,progress,lane,separation,score:Math.min(progress,12)/12+Math.min(lane,1)*.3+Math.min(separation,5)*.08};
  }).filter(c=>c.progress>=2&&c.lane>.1&&c.separation>2.3&&distance(p.position,c.a.position)<=28)
    .sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id));
  if(candidates[0])return startAction(s,p,'PASS','TRANSITION: release the actual ahead first-wave receiver',null,candidates[0].a.id);
  if(!p.handling.dribbleUsed&&laneClearance(s,p.position,world({x:q.x,y:q.y-4},direction),p.team)>.65) {
    if(startAction(s,p,'DRIBBLE','TRANSITION: carry through the actual open forward lane',world({x:q.x,y:Math.max(9,q.y-7)},direction))){p.action!.executeTicks=40;return true;}
  }
  return false;
}
function chooseCarrier(s:CoreState,p:CorePlayer) {
  const direction=s.directions[p.team],q=local(p.position,direction),held=s.tick-p.handling.heldSinceTick;
  const chance=shotOpportunity(s,p),forced=shotOpportunity(s,p,true);
  if(p.nextAction==='SHOOT') {
    p.nextAction=null;
    const kind=isPivot(p)&&distance(p.position,goal(direction))<=PIVOT_FINISH_METERS?'PIVOT'
      :q.y<8?(q.x<4||q.x>16?'WING':'BREAKTHROUGH'):'BACKCOURT_JUMP';
    // The takeoff is already committed. Reassessing its result here would make
    // a new decision replace a real airborne action and break landing rules.
    startAction(s,p,'SHOOT','Release from actual committed takeoff',null,null,kind);return;
  }
  if(p.nextAction==='DRIVE') {
    p.nextAction=null;
    if(held<=s.ruleProfile.maxHoldMs/50-20) {
      startAction(s,p,'DRIVE','Continue the feint into the actual shoulder',driveTarget(s,p),s.defence.pressureId);return;
    }
  }
  if(isWing(p)&&q.y<8&&!p.airborne) {
    const window=wingTakeoffWindow(s,p);
    if(window&&shootingAngle(p.position,direction)<=.14&&p.handling.steps===0&&held<24) {
      startAction(s,p,'DRIVE','Approach the legal wing takeoff to improve the angle',window,s.defence.pressureId);return;
    }
  }
  if(held<controlReadTicks(s,p)) {
    secureRead(s,p,'Secure the catch and read the current defensive response');return;
  }
  if(chance?.emptyGoal&&q.y<28) {
    startAction(s,p,'SHOOT','Actual defending goalkeeper is off court',null,null,'EMPTY_GOAL');return;
  }
  if(isPivot(p)&&chance&&!p.airborne&&pivotShotQuality(s,p)>.34) {
    const worth=pivotShotQuality(s,p),finish=pivotFinish(s,p);
    if(finish==='FALL'&&startAction(s,p,'JUMP',`Pivot catch: turn and finish through the line (${worth.toFixed(2)})`))return;
    if(finish==='TURN'&&startAction(s,p,'SHOOT',`Pivot catch: finish from the actual line position (${worth.toFixed(2)})`,null,null,'PIVOT'))return;
  }
  if(isPivot(p)) {
    const approach=pivotCatchApproach(s,p);
    if(approach&&startAction(s,p,'DRIVE',PIVOT_CATCH_REASON,approach))return;
  }
  if(p.handling.steps>=s.ruleProfile.maxSteps-1&&!p.handling.dribbleUsed&&!p.airborne&&s.ruleProfile.maxHoldMs/50-held>=8) {
    const finish=readContinuation(s,p);
    if(finish?.kind==='SHOOT'&&chance&&chance.distance<=8&&applyContinuation(s,p,finish))return;
    const target=isWing(p)||isPivot(p)?{...p.position}
      :clearGoalArea(world({x:clamp(q.x,2,18),y:q.y-1.3},direction),direction,p.radius+.1);
    if(startAction(s,p,'DRIBBLE','Use the bounce to retain a legal continuation after the approach',target))return;
  }
  // Passive play is a real constraint, but it does not grant a half-court shot.
  if(s.referee.passive.warnedTick!==null&&s.referee.passive.passes>=4&&forced&&!p.airborne) {
    applyContinuation(s,p,{kind:'SHOOT',quality:forced.quality,reason:'Passive allowance exhausted: finish the actual available chance'});return;
  }
  if(transitionProgress(s,p))return;
  const next=readContinuation(s,p);
  if(next&&applyContinuation(s,p,next))return;
  // Relationships can continue when there is no local answer. Their shot
  // choices use the same geometry contract; they cannot invent a long shot.
  if(chooseOffensiveAction(s,p))return;
  const receivers=courtPlayers(s,p.team).filter(a=>a.id!==p.id&&a.kind==='FIELD_PLAYER'&&!a.airborne&&
    !a.condition.unavailable&&!a.condition.exitRequired&&!exchangeActive(s,a.id));
  const ranked=receivers.map(a=>{
    const margin=laneMargin(s,p.position,a.position,p.team,10.5+3*p.profile.passing).seconds;
    const depth=local(a.position,direction).y;
    const offer=isPivot(a)?pivotOffer(s,p,a):null;
    // Upcourt progression and an emergency return are different intentions.
    const progress=q.y>15?clamp((q.y-depth)/8,-1,1):rebuildValue(s,a,direction);
    const score=progress+Math.min(margin,1)*.4-(a.id===s.possession.lastPasserId?.2:0);
    return {a,margin,score,offer};
  }).filter(x=>x.margin>.05&&(!x.offer||x.offer.available))
    .sort((a,b)=>b.score-a.score||a.a.id.localeCompare(b.a.id));
  if(ranked[0]) {
    startAction(s,p,'PASS',held>36?'Release to a reachable return before the handling limit':'Progress to a reachable receiver with an open timed lane',null,ranked[0].a.id);return;
  }
  if(!p.handling.dribbleUsed&&!p.airborne&&held<38) {
    const escape=world({x:clamp(q.x+(q.x<10?1:-1)*.8,2,18),y:Math.min(35,q.y+1.2)},direction);
    if(startAction(s,p,'DRIBBLE','Step out of pressure to reconnect, retaining the same attack',escape))return;
  }
  if(forced&&held>s.ruleProfile.maxHoldMs/50-16) {
    applyContinuation(s,p,{kind:'SHOOT',quality:forced.quality,reason:'No reachable pass or bounce remains: constrained release'});return;
  }
  startAction(s,p,'HOLD','No legal executable outlet; the referee remains authoritative');
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
    const grounded=isPivot(p)&&shotOpportunity(s,p)!==null&&distance(p.position,goal(s.directions[p.team]))<=PIVOT_FINISH_METERS?'PIVOT':'STANDING';
    return startAction(s,p,'SHOOT',next.reason,null,null,grounded);
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
  if(next.kind==='RECYCLE') {
    const held=s.tick-p.handling.heldSinceTick,q=local(p.position,s.directions[p.team]);
    const close=courtPlayers(s,otherTeam(p.team)).some(d=>d.kind==='FIELD_PLAYER'&&distance(d.position,p.position)<1.35);
    // A stopped carrier comes back out before giving the ball. The retreat is
    // an ordinary physical bounce, preserves possession and frees the receiver
    // to launch the next attack from the state the defence actually left.
    if(close&&q.y<10.5&&!isPivot(p)&&!p.handling.dribbleUsed&&held<28) {
      const receiver=getPlayer(s,next.receiverId);
      const target=world({x:clamp(q.x+(receiver.position.x-q.x)*.18,2,18),y:q.y+1.5},s.directions[p.team]);
      if(startAction(s,p,'DRIBBLE','RECYCLE: withdraw from the stopped interval and reconnect',target))return true;
    }
    // A chosen return owns the decision while he secures it. It must not fall
    // through to another selector's opportunistic shot on the same read.
    if(held<controlReadTicks(s,p))return secureRead(s,p,'RECYCLE: secure the receiving picture before the return');
    return startAction(s,p,'PASS',next.reason,null,next.receiverId);
  }
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
  if(isPivot(carrier)&&a.reason===PIVOT_CATCH_REASON&&a.target&&distance(carrier.position,a.target)>.35&&
    s.tick-carrier.handling.heldSinceTick<s.ruleProfile.maxHoldMs/50-12)return false;
  const engagement=driveEngagement(s,carrier);
  const releaseBudget=s.tick-carrier.handling.heldSinceTick>=s.ruleProfile.maxHoldMs/50-12;
  if(!engagement.engaged&&!releaseBudget)return false;
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
  const reason=engagement.engaged?engagement.reason:'The legal approach must release while a pass or shot still fits';
  resolveAction(s,carrier,`Drive release: ${reason}`);
  if(!applyContinuation(s,carrier,next)){record(s,'DRIVE_RELEASE_FAILED',carrier,{into:next.kind});return false;}
  record(s,'DRIVE_RELEASED',carrier,{reason,into:next.kind},
    'receiverId' in next?[next.receiverId]:[]);
  return true;
}

function attackingMovementTarget(s:CoreState,p:CorePlayer,direction:CoreState['directions']['HOME']) {
  if(isPivot(p)&&p.action?.kind==='RUN'&&p.action.reason===PIVOT_ROLL_REASON&&!actionAvailable(p)&&p.action.target)
    return {target:{...p.action.target},screenTarget:null};
  const engaged=isPivot(p)?courtPlayers(s,otherTeam(p.team)).find(d=>d.screenedBy===p.id)??null:null;
  const screenTarget=isPivot(p)&&s.possession.phase==='ESTABLISHED'?(engaged??pivotShouldScreen(s,p)):null;
  let target=s.possession.phase==='ESTABLISHED'
    ?isWing(p)?wingRelationship(s,p).target:isPivot(p)?screenTarget?screenPost(s,p,screenTarget):pivotPost(s,p)
      :p.support?.target??structurePoint(p.role,direction,s.ball.position.x)
    :structurePoint(p.role,direction,s.ball.position.x);
  if(s.possession.phase==='TRANSITION') {
    const q=local(p.position,direction),ballDepth=local(s.ball.position,direction).y;
    const trailing=p.duty.kind==='SECOND_WAVE'?Math.min(q.y,ballDepth+(s.offence.phase==='UPPSPEL'?2:1)):0;
    target=world({x:p.role==='LB'?5:p.role==='RB'?15:target.x,y:Math.max(local(target,direction).y,q.y-7,trailing)},direction);
  }
  return {target:offensiveTarget(s,p)??target,screenTarget};
}

function preparePivotRoll(s:CoreState) {
  for(const p of courtPlayers(s,s.possession.team).filter(isPivot)) {
    if(p.airborne||exchangeActive(s,p.id)||p.action?.kind!=='SCREEN'||actionAvailable(p))continue;
    const defender=courtPlayers(s,otherTeam(p.team)).find(d=>d.screenedBy===p.id);
    const target=defender?pivotRollTarget(s,p,defender):null;
    if(!target)continue;
    resolveAction(s,p,'The screen bound its defender and the backcourt now threatens beside it');
    startAction(s,p,'RUN',PIVOT_ROLL_REASON,target,defender!.id);
  }
}
function defensiveMovement(s:CoreState,p:CorePlayer,read:DefenceRead|null,direction:CoreState['directions']['HOME']) {
  const marked=p.duty.targetId?getPlayer(s,p.duty.targetId):null;
  const duty={kind:p.duty.kind as ZoneDuty['kind'],targetId:p.duty.targetId,reason:p.duty.reason} as ZoneDuty;
  const line=read?dutyTarget(s,p,duty,read,direction):p.position;
  const spot=marked&&isWing(marked)&&local(marked.position,direction).y<8&&['MARK','PRESSURE','COVER'].includes(p.duty.kind)?defendWing(s,p,marked)??line:line;
  const kind=p.duty.kind==='HELP'?'HELP':p.duty.kind==='RECOVER'||p.duty.kind==='RETREAT'?'RECOVER':p.duty.kind==='PRESSURE'?'PRESS':'CONTAIN';
  return {target:anticipatedDefenceTarget(s,p,spot),kind} as const;
}
/** A current relationship steers an executing movement, without restarting its acceleration. */
function refreshActiveMovement(s:CoreState,p:CorePlayer,read:DefenceRead|null,direction:CoreState['directions']['HOME'],receiverId:string|null|undefined) {
  const a=p.action;
  if(!a||actionAvailable(p)||p.airborne||exchangeActive(s,p.id)||s.ball.controllerId===p.id||
    !['RUN','REPOSITION','PRESS','CONTAIN','HELP','RECOVER'].includes(a.kind))return;
  if(p.id===receiverId) {
    if(isPivot(p))interrupt(s,p,'Named pivot feed: check and present rather than run off the pass');
    return;
  }
  if(s.ball.mode==='LOOSE')return;
  if(p.kind==='GOALKEEPER') {
    // A save reads the release exactly once; only ordinary stance movement is
    // steered before the availability gate.
    if(s.ball.flight?.kind==='SHOT'||a.kind!=='REPOSITION')return;
    const ownGoal=s.directions[otherTeam(p.team)],k=p.profile.keeper,depth=1.05+.6*(k?.setPosition??.5);
    const ideal=keeperPost(s.ball.position,ownGoal,depth),lazy=world({x:10,y:depth},ownGoal);
    a.target={x:lazy.x+(ideal.x-lazy.x)*(.45+.55*(k?.positioning??.5)),y:ideal.y};return;
  }
  if(p.team!==s.possession.team) {
    const current=defensiveMovement(s,p,read,direction);
    if(a.kind!==current.kind||a.targetId!==p.duty.targetId) {
      record(s,'MOVEMENT_REAIMED',p,{from:a.kind,to:current.kind,reason:p.duty.reason});
      a.kind=current.kind;a.targetId=p.duty.targetId;
      a.reason=p.duty.reason;p.intent={...p.intent,effect:current.kind,targetId:p.duty.targetId,reason:p.duty.reason};
    }
    a.target={...current.target};
  }else if(a.kind==='RUN'||a.kind==='REPOSITION')a.target={...attackingMovementTarget(s,p,direction).target};
}

/** React to a visible wind-up, never to a shot target that has not been released. */
function prepareVisibleShot(s:CoreState,shooter:CorePlayer|null) {
  if(!shooter)return;
  for(const p of courtPlayers(s,otherTeam(shooter.team))) {
    if(p.airborne||exchangeActive(s,p.id))continue;
    const a=p.action;
    if(p.kind==='GOALKEEPER') {
      if(a?.kind==='SAVE'&&!actionAvailable(p)) {
        prepareKeeperAnticipation(s,p,shooter);
        continue;
      }
      if(a&&!actionAvailable(p)&&a.kind!=='REPOSITION')continue;
      if(a?.kind==='REPOSITION'&&!actionAvailable(p))resolveAction(s,p,'Visible shooting preparation: settle the current goal position');
      startAction(s,p,'SAVE','Set at the current post for the visible shooting preparation',{...p.position});
      continue;
    }
    const assigned=(p.duty.kind==='PRESSURE'||p.duty.kind==='HELP')&&p.duty.targetId===shooter.id;
    const impaired=p.beatenUntilTick>s.tick||p.screenedUntilTick>s.tick||p.wrongFootedUntilTick>s.tick;
    if(!assigned||impaired||distance(p.position,shooter.position)>2.6||!goalSide(s,p,shooter)||a?.kind==='CONTACT')continue;
    if(a?.kind==='BLOCK'&&a.targetId===shooter.id&&!actionAvailable(p))continue;
    if(a&&!actionAvailable(p)&&!['PRESS','CONTAIN','HELP'].includes(a.kind))continue;
    if(a&&!actionAvailable(p))resolveAction(s,p,'Visible shooting preparation: set hands from the assigned pressure position');
    startAction(s,p,'BLOCK','Contest the actual wind-up from the assigned goal-side position',null,shooter.id);
  }
}

/** A set keeper reads the released flight once without throwing away his stance. */
function commitReleasedKeeper(s:CoreState,p:CorePlayer) {
  const f=s.ball.flight;
  if(!f||f.kind!=='SHOT'||p.kind!=='GOALKEEPER'||getPlayer(s,f.fromId).team===p.team||p.airborne||exchangeActive(s,p.id))return;
  const a=p.action;
  const committed=a?.kind==='SAVE'&&a.targetId===f.actionId&&!actionAvailable(p);
  if(committed)return;
  const set=a?.kind==='SAVE'&&a.targetId===null&&!actionAvailable(p);
  if(a&&!actionAvailable(p)&&!set)resolveAction(s,p,'New released shot: finish the previous keeper intention');
  const flown=(s.tick-f.releasedTick)*.05;
  // The stance may load from a visible committed wind-up. Reading the ball's
  // released direction is a different observation and costs actual reaction.
  if(flown+1e-9<p.profile.reaction) {
    if(actionAvailable(p))startAction(s,p,'SAVE','Hold the current stance until the released direction can be perceived',{...p.position});
    return;
  }
  const ownGoal=s.directions[otherTeam(p.team)],k=p.profile.keeper;
  const penalty=getPlayer(s,f.fromId).action?.shotKind==='SEVEN_METRE';
  const depth=penalty?local(p.position,ownGoal).y:1.4;
  const t=Math.max(0,(world({x:10,y:depth},ownGoal).y-s.ball.position.y)/f.velocity.y);
  const read=penalty
    ?(k?.reading??.5)*.35+(k?.reaction??.5)*.20+(k?.positioning??.5)*.15+(k?.sevenMetre??.5)*.30
    :(k?.reading??.5)*.45+(k?.reaction??.5)*.35+(k?.positioning??.5)*.2;
  const pace=Math.hypot(f.velocity.x,f.velocity.y);
  const blind=(1.5-read)*Math.max(.4,1-flown*1.6)*(.82+pace/56);
  const guess=s.ball.position.x+f.velocity.x*t+(random(s)-.5)*2*blind;
  const commitTo=world({x:clamp(guess,5.5,14.5),y:depth},ownGoal);
  if(set) {
    // There is now a real flight to react to. Re-aim the existing stance even
    // across a large angle change; position and movement still obey execution.
    a!.target={...commitTo};a!.targetId=f.actionId;a!.executeTicks=40;
    record(s,'KEEPER_FLIGHT_READ',p,{shotActionId:f.actionId,releasedTick:f.releasedTick,reactionSeconds:p.profile.reaction,observedSeconds:flown,penalty},[f.fromId]);
    return;
  }
  if(startAction(s,p,'SAVE','Read the actual ball out of the hand, commit once and go',commitTo,f.actionId)) {
    p.action!.executeTicks=40;
    record(s,'KEEPER_FLIGHT_READ',p,{shotActionId:f.actionId,releasedTick:f.releasedTick,reactionSeconds:p.profile.reaction,observedSeconds:flown,penalty},[f.fromId]);
  }
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
      if(k.action&&k.action.kind!=='SAVE'&&!k.airborne&&!exchangeActive(s,k.id)&&!['COMPLETED','INTERRUPTED','FAILED'].includes(k.action.phase))interrupt(s,k,'Shot released; abandon repositioning');
    }
  }
  // The carrier releases out of his drive before anybody else is asked to do
  // anything, because what he does decides what the rest of them are reacting to.
  if(carrierNow?.airborne&&carrierNow.nextAction==='SHOOT'&&carrierNow.action?.kind==='JUMP'&&
    ['EXECUTING','RECOVERING'].includes(carrierNow.action.phase)) {
    // The jump's job is the actual takeoff. Its airborne state and eventual
    // landing continue independently; do not wait through a second recovery
    // before starting the already committed throwing preparation.
    resolveAction(s,carrierNow,'Actual takeoff completed; carry the finish into normal throwing preparation');
  }
  releaseFromDrive(s,carrierNow);
  preparePivotRoll(s);
  prepareVisibleShot(s,visibleShotPreparation(s,otherTeam(s.possession.team)));
  for(const p of courtPlayers(s)) {
    if(p.kind==='GOALKEEPER'&&s.ball.flight?.kind==='SHOT'&&getPlayer(s,s.ball.flight.fromId).team!==p.team&&!p.airborne&&!exchangeActive(s,p.id)) {
      commitReleasedKeeper(s,p);continue;
    }
    if(p.id===receiverId&&p.kind==='FIELD_PLAYER'&&!p.airborne&&!exchangeActive(s,p.id)&&
      p.action&&!actionAvailable(p)&&(p.action.kind==='SCREEN'||isPivot(p)&&['RUN','REPOSITION'].includes(p.action.kind))) {
      interrupt(s,p,'Named feed: leave the screen or line run and prepare the actual catch');
    }
    refreshActiveMovement(s,p,defenceRead,direction,receiverId);
    if(!actionAvailable(p))continue;
    if(exchangeActive(s,p.id)&&s.ball.controllerId!==p.id)continue;
    if(p.airborne&&s.ball.controllerId!==p.id){startAction(s,p,'LAND','Complete airborne action before new movement');continue;}
    if(s.ball.controllerId===p.id){chooseCarrier(s,p);continue;}
    if(p.kind==='GOALKEEPER') {
      const ownGoal=s.directions[otherTeam(p.team)];
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
      continue;
    }
    if(p.id===receiverId){startAction(s,p,'RECEIVE','Prepare hands for named pass; ownership requires contact',null,prospective?.id??s.ball.flight?.fromId??null);continue;}
    if(s.ball.mode==='LOOSE') {if(p.duty.kind==='COLLECT')startAction(s,p,'RECEIVE','Contest the loose ball',s.ball.position);continue;}
    if(p.team!==s.possession.team) {
      const current=defensiveMovement(s,p,defenceRead,direction);
      const target=current.target,kind=current.kind;
      const carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;
      if(carrier&&carrier.team!==p.team&&planContact(s,p,carrier))continue;
      {
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
      const {target,screenTarget}=attackingMovementTarget(s,p,direction);
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
