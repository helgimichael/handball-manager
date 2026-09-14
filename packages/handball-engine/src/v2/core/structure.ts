import { actionAvailable, courtPlayers, getPlayer, otherTeam, random, record, type CorePlayer, type CoreState, type Duty } from './state';
import { clamp, distance, goalSide, keeperPost, laneClearance, local, numericalAdvantage, shootingAngle, shotQuality, structurePoint, world } from './space';
import { driveTarget, startAction } from './actions';
import { exchangeActive } from './population';
import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { planContact } from './contact';
import { interrupt } from './transitions';
import { isWing,wingRelationship,wingTakeoffWindow,defendWing } from './wing';
import { isBack,planBackcourtSupport } from './backcourt';
import { chooseOffensiveAction,offensiveTarget,offensiveScreen,anticipatedDefenceTarget } from './offence';
import { allocate,assignZones,dutyFeasible,dutyTarget,lineFormed,readDefence,zoneOf,type DefenceRead,type ZoneDuty } from './defence';
import { sustain } from './actions';

function assign(s:CoreState,p:CorePlayer,kind:Duty,targetId:string|null,reason:string) {
  if(s.ball.mode==='LOOSE'&&p.duty.kind==='COLLECT')return;
  if(p.duty.kind!==kind||p.duty.targetId!==targetId||p.duty.reason!==reason) {
    p.duty={kind,targetId,sinceTick:s.tick,reason};record(s,'RESPONSIBILITY_ASSIGNED',p,{kind,reason},targetId?[targetId]:[]);
  }
}
/** One coordinator allocates pressure/help/cover; reachability never creates a second primary. */
export function coordinate(s: CoreState) {
  const attacking=s.possession.team,defending=otherTeam(attacking),carrier=s.ball.controllerId?getPlayer(s,s.ball.controllerId):null;
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
  const owned=defenders.map(d=>d.zone);
  if(owned.some(z=>z===null)||new Set(owned).size!==owned.length)assignZones(s,defenders,direction);
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
    // A wing shot is judged like any other, on a lower bar: his realistic
    // alternative is a pass back out, and an attack that has worked the ball to
    // the wing and then declines has achieved nothing. The bar is his own
    // finishing, so an elite finisher takes the corner an ordinary wing leaves.
    const outside=shotQuality(s,p,pressure);
    if(angle>.14&&pressure<=1&&outside>.30-.12*p.profile.wingFinishing&&s.tick-p.handling.heldSinceTick<38){
      startAction(s,p,'JUMP',`Outside window worth taking: quality ${outside.toFixed(2)}`);return;}
    const window=wingTakeoffWindow(s,p);
    if(window&&angle<=.14&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<24) {startAction(s,p,'DRIVE','Improve the wing angle through a legal grounded approach',window,s.defence.pressureId);return;}
    if(relation.back&&laneClearance(s,p.position,relation.back.position,p.team)>.45){startAction(s,p,'PASS','Wing window closed; reconnect with the adjacent back',null,relation.back.id);return;}
  }
  if(s.tick-p.handling.heldSinceTick>36&&q.y<14&&!p.airborne){p.nextAction=null;startAction(s,p,'SHOOT','Handling budget requires a standing release before three seconds',null,null,'STANDING');return;}
  if(p.nextAction==='SHOOT') {p.nextAction=null;startAction(s,p,'SHOOT','Release from actual takeoff position',null,null,q.y<8?(q.x<4||q.x>16?'WING':'BREAKTHROUGH'):'BACKCOURT_JUMP');return;}
  if(p.nextAction==='DRIVE') {p.nextAction=null;startAction(s,p,'DRIVE','Exploit committed feint and test inside lane',driveTarget(s,p),s.defence.pressureId);return;}
  if(s.referee.passive.warnedTick!==null&&s.referee.passive.passes>=4&&q.y<18&&!p.airborne){startAction(s,p,'SHOOT','Finish before the passive-play pass allowance is exhausted',null,null,'STANDING');return;}
  if(s.tick-p.handling.heldSinceTick<(s.coaching[p.team].tempo==='QUICK'?6:10)){startAction(s,p,'HOLD','Secure control and read coordinated defence');return;}
  if(!keeper&&q.y<28){startAction(s,p,'SHOOT','Goalkeeper absent; executable empty-goal opportunity',null,null,'EMPTY_GOAL');return;}
  if(chooseOffensiveAction(s,p))return;
  const angle=shootingAngle(p.position,direction),advantage=numericalAdvantage(s,p);
  // PLAYER IDENTITY: what counts as a shot worth taking is his judgement about
  // his own finishing, not a shared depth threshold. A shooting back backs
  // himself from ten metres; a wing needs the angle; a poor finisher works for
  // something better and that is why his team circulates instead of firing.
  const quality=shotQuality(s,p,pressure);
  const threshold=.42/Math.max(.5,p.profile.tendency.shoot)-(advantage>0?.05:0)-(s.possession.phase==='TRANSITION'?.07:0);
  const hasOpportunity=quality>=threshold&&angle>.13&&
    (s.possession.completedPasses>=2||s.possession.phase==='TRANSITION'||p.role==='P'||(q.y<9&&s.defence.helperId!==null));
  if(!keeper&&q.y<28){startAction(s,p,'SHOOT','Goalkeeper absent; executable empty-goal opportunity',null,null,'EMPTY_GOAL');return;}
  if(pressure===0&&q.y>=9&&q.y<14&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<26&&s.possession.completedPasses>0) {
    startAction(s,p,'DRIVE','Attack the available shoulder to engage cover before continuation',driveTarget(s,p),s.defence.pressureId);return;
  }
  if(pressure===1&&q.y>=8&&q.y<13.5&&p.handling.steps===0&&s.tick-p.handling.heldSinceTick<30&&!p.handling.dribbleUsed) {
    startAction(s,p,'FEINT','Engage the pressure defender before committing to a shoulder',null,s.defence.pressureId);return;
  }
  if(hasOpportunity) {
    startAction(s,p,'JUMP',`Shot worth taking: quality ${quality.toFixed(2)} over ${threshold.toFixed(2)}, angle ${angle.toFixed(2)}, pressure ${pressure}`);return;
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
          if(startAction(s,p,'SAVE','Read the ball out of the hand, commit and go',world({x:clamp(guess,5.5,14.5),y:1.4},ownGoal),f.actionId))
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
      let target=s.possession.phase==='ESTABLISHED'?(isWing(p)?wingRelationship(s,p).target:p.support?.target??structurePoint(p.role,direction,s.ball.position.x)):structurePoint(p.role,direction,s.ball.position.x);
      if(s.possession.phase==='TRANSITION') {
        const q=local(p.position,direction),ballDepth=local(s.ball.position,direction).y;
        const trailing=p.duty.kind==='SECOND_WAVE'?Math.min(q.y,ballDepth+(s.offence.phase==='UPPSPEL'?2:1)):0;
        target=world({x:p.role==='LB'?5:p.role==='RB'?15:target.x,y:Math.max(local(target,direction).y,q.y-7,trailing)},direction);
      }
      const entryTarget=offensiveTarget(s,p);if(entryTarget)target=entryTarget;
      if((offensiveScreen(s,p)||p.role==='P')&&distance(p.position,target)<.8)startAction(s,p,'SCREEN','Establish stationary screen at the intended defensive interval',null,s.defence.pressureId);
      else if(distance(p.position,target)>.55){if(!sustain(s,p,'RUN',target,null))startAction(s,p,'RUN',p.duty.reason,target);}
      else if(!sustain(s,p,'RECEIVE',null,null))startAction(s,p,'RECEIVE','Offer an available passing connection from assigned role');
    }
  }
}
