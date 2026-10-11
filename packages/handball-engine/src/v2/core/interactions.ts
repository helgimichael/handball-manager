import { courtPlayers, getPlayer, otherTeam, random, record, uid, type CoreContest, type CoreFlight, type CorePlayer, type CoreState, type Point } from './state';
import { clamp, distance, fieldLegal, goal, local, segmentPoint, shotContext } from './space';
import { reachOf } from './timing';
import { projectMotion } from './locomotion';
import {movementPace} from './movement';
import { acquire, awardRestart, interrupt } from './transitions';
import type { ExecutionEffect } from './actions';
import { restartReady } from './rules';
import { completeRestart } from './restarts';
import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { breakDefence } from './engage';
import { executionCapacity } from './condition';
import { executePass, planShotTarget, receptionRisk, releasePressure, shotHeight, type PassExecution } from './execution';

export function contest(s:CoreState,kind:CoreContest['kind'],a:CorePlayer,d:CorePlayer,outcome:string,margin:number,duration:number,sourceActionId=a.action?.id??s.ball.flight?.actionId??'contact') {
  const id=uid(s,'contest');
  s.contests.push({id,kind,tick:s.tick,attackerId:a.id,defenderId:d.id,actionId:sourceActionId,outcome,margin,consequenceUntilTick:s.tick+duration});
  if(a.action?.id===sourceActionId)a.action.contestIds.push(id);
  record(s,'CONTEST_RESOLVED',a,{kind,outcome,margin,consequenceUntilTick:s.tick+duration,defenderDuty:d.duty.kind,defenderActionId:d.action?.id??'none'},[d.id],id,sourceActionId);return id;
}
function duel(s:CoreState,a:CorePlayer) {
  const action=a.action!;
  const defenders=courtPlayers(s,otherTeam(a.team)).filter(d=>d.kind!=='GOALKEEPER'&&d.beatenUntilTick<=s.tick&&
    (d.id===s.defence.pressureId||d.id===s.defence.helperId||d.id===action.targetId));
  if(action.kind==='DRIVE') {
    // A breakthrough is a physical change of relative position, not a won skill roll.
    // BEING BEATEN is a meaningful loss of defensive control, not a threshold
    // his position happened to cross. Fifteen centimetres of gain used to count,
    // so a defender was "beaten" a hundred and thirty times a match. He is
    // beaten when the attacker is genuinely past his shoulder, close enough that
    // it matters, and he is not still in contact with him.
    const BEATEN_MARGIN=0.65;
    const d=defenders.find(d=>(action.driveStart?.[d.id]??-1)>=0&&
      distance(a.position,d.position)<2.2&&
      local(a.position,s.directions[a.team]).y+BEATEN_MARGIN<local(d.position,s.directions[a.team]).y&&
      // A contact intention/recovery is not an actual containing body. Only a
      // physically reachable executing contact can still hold this shoulder.
      !(d.action?.kind==='CONTACT'&&d.action.phase==='EXECUTING'&&distance(a.position,d.position)<=.95));
    if(!d)return;
    action.resolved=true;
    const margin=local(d.position,s.directions[a.team]).y-local(a.position,s.directions[a.team]).y;
    // BEATEN EPISODES. One carrier cannot beat the same defender twice without
    // the two of them separating first: going past a man is one event, not a
    // threshold his position keeps re-crossing.
    if(d.beatenBy===a.id)return;
    const id=contest(s,'DUEL',a,d,'BEATEN',margin,32);d.beatenUntilTick=s.tick+32;d.beatenBy=a.id;
    breakDefence(s,d,'beaten',a.id);
    interrupt(s,d,'Attacker physically crossed the defended shoulder');
    record(s,'DEFENDER_BEATEN',a,{untilTick:d.beatenUntilTick,attackerY:a.position.y,defenderY:d.position.y},[d.id],id);return;
  }
  const d=defenders.find(d=>distance(a.position,d.position)<1.6&&d.action?.phase==='EXECUTING'&&['PRESS','HELP','CONTAIN','CONTACT'].includes(d.action.kind));
  if(!d)return;
  action.resolved=true;
    // PLAYER IDENTITY: a feint is his one-against-one ability against the
  // defender's footwork and timing, not two interchangeable 0.65s.
  const margin=a.profile.breakthrough-(d.profile.lateral*.6+d.profile.defTiming*.4)+(d.screenedUntilTick>s.tick?.3:0)+.1+(random(s)-.5)*.7;
  const wrongFooted=margin>0,id=contest(s,'DUEL',a,d,wrongFooted?'WRONG_FOOTED':'COMPOSED',margin,wrongFooted?16:0);
  if(wrongFooted){d.wrongFootedUntilTick=s.tick+16;interrupt(s,d,'Committed weight to the feint');}
  record(s,'FEINT_READ',a,{wrongFooted,untilTick:d.wrongFootedUntilTick},[d.id],id);
}
function release(s:CoreState,p:CorePlayer,kind:'PASS'|'SHOOT') {
  if(s.ball.controllerId!==p.id||!p.action){if(p.action)p.action.phase='FAILED';return;}
  const delivery=p.action.purpose==='DEAD_BALL_RETURN';
  // A restart that has become illegal by the moment of release is RETAKEN,
  // which is what a referee does with one. Killing the simulation instead was
  // turning an ordinary refereeing event into a dead match, and it is the only
  // reason a full ninety-minute run ever ended early.
  if(!s.ball.live&&!delivery&&s.restart?.phase==='AUTHORISED'&&!restartReady(s)) {
    p.action.phase='FAILED';
    const r=s.restart;r.retakes=(r.retakes??0)+1;
    if(r.retakes>3) {
      record(s,'RESTART_FORFEITED',p,{kind:r.kind,retakes:r.retakes});
      awardRestart(s,'FREE_THROW',otherTeam(r.owner),p.position,'Repeatedly delayed restart',p,false);return;
    }
    r.phase='PREPARING';r.authorisedTick=null;
    record(s,'RESTART_RETAKEN',p,{kind:r.kind,retakes:r.retakes,reason:'Preparation no longer legal at release'});return;
  }
  if(kind==='SHOOT'&&!p.airborne&&!fieldLegal(p.position,p.radius)) {awardRestart(s,'GOALKEEPER_THROW',otherTeam(p.team),p.position,'Illegal grounded shot in goal area',p);return;}
  if(p.airborne&&!fieldLegal(p.airborne.takeoff,p.radius)){awardRestart(s,'GOALKEEPER_THROW',otherTeam(p.team),p.position,'Illegal takeoff',p);return;}
  const receiver=kind==='PASS'&&p.action.targetId?getPlayer(s,p.action.targetId):null;
  if(kind==='PASS'&&(!receiver||receiver.team!==p.team||receiver.population!=='COURT')){p.action.phase='FAILED';record(s,'ACTION_FAILED',p,{reason:'Receiver unavailable'});return;}
  const direction=s.directions[p.team];
  let target:Point;
  let passExecution:PassExecution|null=null;
  let releaseContext:ReturnType<typeof shotContext>|null=null;
  let goalHeight=1.1;
  let shotPlacement=0,shotSpread=0,intendedAimX=0;
  if(receiver) {
    target={...receiver.position};
    // Lead a currently moving receiver using observable velocity and committed
    // movement extent. This predicts an intercept point, never future ownership.
    // POSSESSION ECOLOGY: lead him by what he can cover, not by how fast he
    // happens to be moving. A man who has just set off is still accelerating,
    // and a lead taken off his current velocity lands behind him. Project the
    // same bounded steering/arrival used by canonical locomotion; the old
    // straight-line accelerate-and-stop prediction overshoots a settling runner.
    if(Math.hypot(receiver.velocity.x,receiver.velocity.y)>.01||receiver.action?.target&&(receiver.action.kind==='RUN'||receiver.action.kind==='REPOSITION')) {
      const reach=reachOf(s,receiver),to=receiver.action?.target&&['RUN','REPOSITION','RECEIVE'].includes(receiver.action.kind)?receiver.action.target:null;
      for(let i=0;i<4;i++) {
        const time=distance(s.ball.position,target)/(10.5+3*p.profile.passing);
        target=projectMotion(receiver.position,receiver.velocity,to,reach.topSpeed*movementPace(s,receiver,to),reach.acceleration,time);
      }
    }
    // And nobody throws the ball out of play at a teammate.
    target={x:clamp(target.x,.45,20-.45),y:clamp(target.y,.45,40-.45)};
    passExecution=executePass(s,p,receiver,target,delivery);
    target=passExecution.target;
  }
  else {
    releaseContext=shotContext(s,p);
    const pressure=releaseContext.pressure;
    const plan=planShotTarget(s,p);
    shotPlacement=plan.placement;shotSpread=plan.spread;
    // A throw already committed to a window cannot magically pick the other
    // post from the keeper's latest position at the release tick. Old active
    // actions without a committed point retain the compatible visible-world read.
    intendedAimX=p.action.target?.y===goal(direction).y?p.action.target.x:plan.aimX;
    target={x:intendedAimX+(random(s)-.5)*plan.spread,y:goal(direction).y};
    goalHeight=shotHeight(s,p,plan.placement,pressure);
  }
  const origin={...s.ball.position},d=distance(origin,target);if(d<.1){p.action.phase='FAILED';return;}
    // PLAYER IDENTITY: a hard shooter releases faster, which is what shortens the
  // keeper's reading time; a good passer puts more on a pass.
  // A STANDING SHOT IS NOT A JUMP SHOT. It is taken flat-footed, usually
  // because he has run out of steps or time, and it does not carry a jump
  // shot's pace -- which, with the goalkeeper's reach now bounded by the time
  // the ball gives him, is exactly what made it the second most efficient shot
  // in the match at seventy-two per cent. Less on it, so he gets there.
  const flat=kind==='SHOOT'&&p.action?.shotKind==='STANDING'&&!p.airborne;
  const speed=kind==='PASS'?passExecution!.speed:(17+11*p.profile.shotPower)*(flat?.82:1)*(.88+.12*executionCapacity(p));
  p.action.resolved=true;
  s.ball={...s.ball,mode:'RELEASE',height:p.airborne?2.3:1.5,controllerId:null,lastTouchId:p.id,
    flight:{kind:kind==='PASS'?'PASS':'SHOT',origin,velocity:{x:(target.x-origin.x)/d*speed,y:(target.y-origin.y)/d*speed},fromId:p.id,receiverId:receiver?.id??null,actionId:p.action.id,possessionId:s.possession.id,releasedTick:s.tick,height:p.airborne?2.3:1.5,goalSide:direction,touchedIds:[p.id],purpose:p.action.purpose}};
  if(kind==='SHOOT')s.ball.flight!.goalHeight=goalHeight;
  if(kind==='SHOOT')p.nextAction='LAND';
  record(s,delivery?'BALL_RETURN_RELEASED':kind==='PASS'?'PASS_RELEASED':'SHOT_RELEASED',p,{x:origin.x,y:origin.y,height:s.ball.height,reason:p.action.reason,shotKind:p.action.shotKind??'NONE',phase:s.possession.phase,subphase:s.offence.phase,
    ...(passExecution?{difficulty:passExecution.difficulty,executionError:passExecution.error,pressure:passExecution.pressure,passingCapability:passExecution.capability,aimX:target.x,aimY:target.y}:{}),
    ...(releaseContext?{decisionQuality:releaseContext.quality,opportunityQuality:releaseContext.opportunityQuality,pressure:releaseContext.pressure,blockThreat:releaseContext.blockThreat,goalHeight,executionEnergy:p.condition.energy,executionCapacity:executionCapacity(p),executionPlacement:shotPlacement,executionPowerAttribute:p.profile.shotPower,executionSpread:shotSpread,intendedAimX,aimErrorMetres:Math.abs(target.x-intendedAimX),releasePace:speed,aimX:target.x}:{}),
  },receiver?[receiver.id]:[]);
  if(!delivery&&s.restart?.phase==='AUTHORISED') {
    s.restart.phase='RELEASED';
    if(s.restart.kind!=='CENTRE_THROW_OFF'&&s.restart.kind!=='GOALKEEPER_THROW')completeRestart(s,'BALL_RELEASE');
  }
}
export function resolveEffects(s:CoreState,effects:ExecutionEffect[]) {
  for(const effect of effects) {
    if(s.status!=='RUNNING')break;
    const p=getPlayer(s,effect.playerId);
    if(!p.action||['FAILED','INTERRUPTED'].includes(p.action.phase))continue;
    if(effect.kind==='PASS'||effect.kind==='SHOOT')release(s,p,effect.kind);
    else duel(s,p);
  }
}
/**
 * SCREEN EPISODES.
 *
 * A screen is one interaction between one attacker and one defender: it begins
 * when the body gets in the way and it ends when the two of them separate. It
 * is not re-established every time its consequence expires, which is what the
 * old rule did -- the same pivot standing in the same defender's path produced
 * a fresh screen every eighteen ticks, and the match reported a hundred and
 * fifty-nine of them.
 */
const SCREEN_RELEASE_METERS=1.6;
/** Beyond this the two men are no longer doing the same thing they started. */
const SCREEN_MAX_TICKS=70;
/**
 * After an engagement ends the same defender is not screened again for two
 * seconds. Leaning back on a man the attack has just worked against is the same
 * screen continuing, and counting each re-contact put a hundred and sixty
 * screens in a match.
 */
const SCREEN_COOLDOWN_TICKS=40;
export function resolveScreens(s:CoreState) {
  // ONE SCREEN IS ONE SCREEN, for as long as the two men stay engaged.
  //
  // The episode used to end the moment the screener's action was re-issued, so
  // a single engagement closed and reopened every few ticks and was counted
  // again each time: a hundred and twenty-five screens a match, nearly all of
  // them the same pivot standing against the same defender. The engagement is
  // a fact about two bodies, so it ends when they come apart, when the screener
  // leaves the court, or when it has simply gone on longer than a screen lasts.
  for(const d of courtPlayers(s)) {
    if(!d.screenedBy)continue;
    const by=s.players.find(p=>p.id===d.screenedBy);
    const apart=!by||by.population!=='COURT'||distance(by.position,d.position)>SCREEN_RELEASE_METERS;
    if(apart||s.tick-d.screenedSinceTick>SCREEN_MAX_TICKS||s.possession.team!==by.team){
      d.screenedBy=null;d.screenCooldownTick=s.tick+SCREEN_COOLDOWN_TICKS;
      // AND THE SCREENER ROLLS OFF. Only the defender used to be held back, so
      // when one engagement timed out the line player simply leaned on the next
      // man along and opened another: he was screening somebody continuously
      // and produced two hundred and seventy engagements a match. Setting a
      // screen, holding it and coming off it is one action with a beginning and
      // an end, and he does not immediately start another.
      if(by)by.screenCooldownTick=s.tick+SCREEN_COOLDOWN_TICKS;
      continue;}
    // Blocked while the block is actually there, rather than for a fixed
    // window measured from the frame the contact was first noticed.
    d.screenedUntilTick=s.tick+4;
  }
  for(const a of courtPlayers(s,s.possession.team).filter(p=>p.action?.kind==='SCREEN'&&p.action.phase==='EXECUTING'&&p.screenCooldownTick<=s.tick)) {
    for(const d of courtPlayers(s,otherTeam(a.team)).filter(d=>d.kind!=='GOALKEEPER'&&distance(d.position,a.position)<.85&&d.screenedBy===null&&d.screenCooldownTick<=s.tick&&Math.hypot(d.velocity.x,d.velocity.y)>.1)) {
      const id=contest(s,'SCREEN',a,d,'SCREENED',distance(a.position,d.position),18);
      d.screenedUntilTick=s.tick+18;d.screenedBy=a.id;d.screenedSinceTick=s.tick;breakDefence(s,d,'screened out',a.id);
      record(s,'SCREEN_CONTACT',a,{untilTick:d.screenedUntilTick},[d.id],id);
    }
  }
}
/**
 * A ball knocked off its line.
 *
 * It used to be sent toward the deflecting player's own attacking goal, which
 * handed every deflection to the defence as a matter of geometry rather than of
 * physics. A deflected ball carries on roughly the way it was going, slower and
 * off line, and either team can win it -- which is what makes a deflection a
 * contest rather than a turnover.
 */
function deflect(s:CoreState,p:CorePlayer,point:Point,type:string,detail:CoreState['events'][number]['details']={}) {
  const f=s.ball.flight!;
  const speed=Math.hypot(f.velocity.x,f.velocity.y)||1;
  const ux=f.velocity.x/speed,uy=f.velocity.y/speed;
  // Scatter the direction and shed most of the pace, the way a hand does.
  // A hand takes most of the pace off. Left too fast, a deflected ball simply
  // carried on out of the court and a parry became a throw-in rather than a
  // contested rebound.
  const angle=(random(s)-.5)*1.5;
  const loss=.14+.14*random(s);
  let outX=ux,outY=uy,kept=Math.min(6.5,speed*loss);
  if(type==='SAVE_PARRY'||type==='OFF_TARGET_KEEPER_TOUCH'){
    const reach=keeperReachForShot(s,p,f,point),coverage=clamp(1-distance(point,p.position)/Math.max(.001,reach),0,1);
    const skill=Number(detail.stoppingCapability??.5),torso=distance(point,p.position)<p.radius&&s.ball.height>.7&&s.ball.height<1.75;
    const intervention=Math.max(torso?.9:0,clamp((coverage*(.75+.25*skill)+.3*skill)*executionCapacity(p),0,1));
    const side=Math.sign(point.x-p.position.x)||Math.sign(f.velocity.x)||1,away=f.goalSide==='TOP'?1:-1;
    outX=ux*(1-intervention)+side*.9*intervention;outY=uy*(1-intervention)+away*.35*intervention;
    const length=Math.hypot(outX,outY)||1;outX/=length;outY/=length;
    kept=speed*(loss*intervention+.75*(1-intervention));
    detail={...detail,intervention,coverage};
  }
  s.ball.position=point;s.ball.mode='DEFLECTION';s.ball.lastTouchId=p.id;
  f.sourceKind??=f.kind==='SHOT'?'SHOT':'PASS';f.kind='DEFLECTION';
  f.velocity={x:(outX*Math.cos(angle)-outY*Math.sin(angle))*kept,y:(outX*Math.sin(angle)+outY*Math.cos(angle))*kept};
  f.touchedIds.push(p.id);f.releasedTick=s.tick;
  record(s,type,p,{...detail,speed:Number(kept.toFixed(2))},[f.fromId],null,f.actionId);
}
/** Actual hand travel budget, including a prepared penalty stance but never a full dive before flight time. */
export function keeperReachForShot(s:CoreState,p:CorePlayer,f:CoreFlight,point:Point):number {
  const capacity=executionCapacity(p),span=(.36+.44*(p.profile.keeper?.explosiveness??.5))*capacity;
  const pace=Math.hypot(f.velocity.x,f.velocity.y)||1,flightSeconds=distance(f.origin,point)/pace;
  const loaded=getPlayer(s,f.fromId).action?.shotKind==='SEVEN_METRE';
  const spare=Math.max(0,flightSeconds-(loaded?0:p.profile.reaction));
  const hands=Math.min(span,.19+2.4*capacity*spare);
  // The same hand cannot simultaneously cover its full lateral and vertical
  // extent. A low/high ball spends part of the finite save envelope. Body
  // travel is already integrated and is not added again here.
  const depth=goal(f.goalSide).y-f.origin.y;
  const fraction=clamp((point.y-f.origin.y)/(Math.abs(depth)>.001?depth:.001),0,1);
  const height=f.height+((f.goalHeight??1.1)-f.height)*fraction;
  const family=height<1?p.profile.keeper?.low??.5:p.profile.keeper?.high??.5;
  const vertical=Math.abs(height-1.05)/(1.05+.3*family);
  return hands*Math.sqrt(Math.max(0,1-vertical*vertical));
}
/** Conventional save attribution requires a goal-bound released trajectory. */
export function goalBoundShot(f:CoreFlight):boolean {
  if(f.kind!=='SHOT'||Math.abs(f.velocity.y)<1e-9)return false;
  const t=(goal(f.goalSide).y-f.origin.y)/f.velocity.y,x=f.origin.x+f.velocity.x*t,height=f.goalHeight??1.1;
  return t>0&&x>=8.5&&x<=11.5&&height>=0&&height<=2;
}
export function advanceBall(s:CoreState) {
  const f=s.ball.flight;if(!f||f.releasedTick===s.tick)return;
  const from={...s.ball.position},to={x:from.x+f.velocity.x*.05,y:from.y+f.velocity.y*.05};
  if(f.kind==='SHOT') {
    const depth=goal(f.goalSide).y-f.origin.y;
    const fraction=clamp((to.y-f.origin.y)/(Math.abs(depth)>.1?depth:depth<0?-.1:.1),0,1);
    s.ball.height=f.height+((f.goalHeight??1.1)-f.height)*fraction;
  }
  const candidates=courtPlayers(s).filter(p=>!f.touchedIds.includes(p.id)&&
    (f.purpose!=='DEAD_BALL_RETURN'||p.id===f.receiverId)&&
    (s.ball.live||p.team===getPlayer(s,f.fromId).team||
      s.restart?.phase==='RELEASED'&&s.restart.kind==='GOALKEEPER_THROW'&&f.purpose==='PLAY')).map(p=>{
    const hit=segmentPoint(from,to,p.position);
    const isKeeper=p.kind==='GOALKEEPER';
    const ready=p.action?.phase==='EXECUTING';
    // The named offer has its own persisted hands-ready tick. A locomotion
    // phase boundary must not make prepared hands disappear as the ball arrives.
    const runningReceive=p.reception?.passActionId===f.actionId&&p.reception.readyTick<=s.tick&&['RUN','REPOSITION','RECEIVE'].includes(p.action?.kind??'');
    // SPATIAL TIMING: a defender does not intercept because the ball passed
    // near him. He intercepts because he could get a hand to it in the time it
    // gave him. Sixty-odd interceptions a match came from a flat 0.65 m radius
    // granted to every defender executing any defensive action, including one
    // holding his post with his weight going the other way.
    const own=p.team===getPlayer(s,f.fromId).team;
    const reacted=(s.tick-f.releasedTick)*.05>=p.profile.reaction;
    const grasp=.22+.33*p.profile.ballWinning;
    const beaten=p.beatenUntilTick>s.tick||p.screenedUntilTick>s.tick||p.wrongFootedUntilTick>s.tick;
    // WHAT THE SHOT GAVE HIM.
    //
    // A goalkeeper's reach was a fixed radius: the same span whether the ball
    // came from eleven metres and took half a second or from two and took a
    // tenth. So he saved 43 per cent of everything, close-range shots converted
    // WORSE than long ones, and the best chance in handball -- a line player
    // two metres out -- went in four times in ten. What he can actually cover
    // is his standing body plus as much of his span as the flight time lets him
    // move into, after his own reaction is spent. This is the whole shooter-
    // goalkeeper duel: range, pace and explosiveness against reaction.
    const keeperReach=isKeeper&&f.kind==='SHOT'?keeperReachForShot(s,p,f,hit.point):0;
    const reach=f.kind==='SHOT'
      ?(isKeeper?(ready&&p.action?.kind==='SAVE'?keeperReach:.2)
        :ready&&p.action?.kind==='BLOCK'&&!beaten?.16+.34*p.profile.blocking:0)
      :own?((ready&&p.action?.kind==='RECEIVE'||runningReceive)?.65:0)
      // A defending interceptor needs a defensive action, his reaction spent,
      // and a hand within his own reach. Every one of the three is a real
      // requirement and together they are what the old radius was missing.
      // A defender who is HOLDING HIS SPACE is not going for the ball. He
      // occupies a lane and a pass that hits him is knocked down, not plucked
      // out of the air: forty interceptions a match, twenty-five of them by a
      // man in CONTAIN standing in his own zone. Only a defender actively
      // attacking the ball takes it cleanly; everybody else deflects it and the
      // loose ball is then contested, which is what a real deflection looks
      // like and which keeps the attack alive instead of ending it.
      :ready&&!beaten&&reacted&&['RECEIVE','PRESS','HELP'].includes(p.action?.kind??'')?grasp
      :ready&&!beaten&&['CONTAIN','RECOVER','BLOCK'].includes(p.action?.kind??'')?grasp*.8:0;
    return {p,...hit,hit:reach>0&&distance(hit.point,p.position)<=reach&&(isKeeper||s.ball.height<2.5)};
  }).filter(c=>c.hit).sort((a,b)=>a.t-b.t||a.p.id.localeCompare(b.p.id));
  for(const hit of candidates) {
    const p=hit.p,shooter=getPlayer(s,f.fromId);
    if(f.kind==='SHOT') {
      if(p.team===shooter.team)continue;
      if(p.kind==='GOALKEEPER') {
        // PLAYER IDENTITY: a keeper holds what he reaches according to his own
        // save attributes for that height and range, never a shared constant.
        // And a hard ball is not held. Shot power had no effect on the
        // goalkeeper at all, which is why a keeper caught between a fifth and
        // two fifths of everything: the shooter could not hurt him.
        const k=p.profile.keeper;
        const local=distance(hit.point,p.position);
        const range=distance(f.origin,{x:10,y:goal(f.goalSide).y});
        const pace=Math.hypot(f.velocity.x,f.velocity.y);
        const family=k?(s.ball.height<.9?k.low:s.ball.height>1.5?k.high:(k.low+k.high)/2)*.5
          +(range<9?k.close:range>10.5?k.long:(k.close+k.long)/2)*.3
          +(Math.abs(f.origin.x-10)>6.5?k.wing:k.reaction)*.2:.5;
        // Holding it needs the ball inside his hands AND slow enough to hold.
        const holdable=pace<=15+13*family;
        const catchable=p.action?.kind==='SAVE'&&p.action.phase==='EXECUTING'&&local<.22+.34*family&&holdable;
        const goalBound=goalBoundShot(f),saveDetail={ballHeight:s.ball.height,keeperX:p.position.x,keeperY:p.position.y,horizontalReach:keeperReachForShot(s,p,f,hit.point),bodySeparation:local,flightSeconds:(s.tick-f.releasedTick)*.05,reactionSeconds:p.profile.reaction,goalBound,stoppingCapability:family};
        contest(s,'KEEPER',shooter,p,catchable?'CAUGHT':'PARRIED',distance(hit.point,p.position),12,f.actionId);
        if(catchable){
          // A HELD SAVE IS AN EVENT. It had none -- only a contest -- so the
          // commonest outcome in goalkeeping was invisible to every reading of
          // the match, and shots the keeper caught appeared in no column at all:
          // not goals, not saves, not blocks. Nineteen of twenty-three wing
          // shots in a match were being caught and nothing said so.
          record(s,goalBound?'SAVE_CAUGHT':'KEEPER_COLLECTED_OFF_TARGET',p,{x:hit.point.x,y:hit.point.y,pace:Number(pace.toFixed(2)),...saveDetail},[shooter.id],null,f.actionId);
          acquire(s,p,hit.point,'Goalkeeper catch',f.actionId);s.ball.live=false;
          awardRestart(s,'GOALKEEPER_THROW',p.team,p.position,'Keeper controls ball inside goal area',p);return;}
        deflect(s,p,hit.point,goalBound?'SAVE_PARRY':'OFF_TARGET_KEEPER_TOUCH',saveDetail);return;
      }
      contest(s,'BLOCK',shooter,p,'DEFLECTED',distance(hit.point,p.position),12,f.actionId);deflect(s,p,hit.point,'SHOT_BLOCKED');return;
    }
    if(p.team===shooter.team&&p.action?.kind!=='RECEIVE'&&!(p.reception?.passActionId===f.actionId&&p.reception.readyTick<=s.tick&&['RUN','REPOSITION'].includes(p.action?.kind??'')))continue;
    if(p.kind==='GOALKEEPER'&&f.purpose!=='DEAD_BALL_RETURN')continue;
    // A catch can happen in the same physical segment as the area exit. The
    // lawful exit owns the chronology before contact can acquire the ball.
    // Otherwise an early return left a valid outlet controlled but dead forever.
    if(s.restart?.phase==='RELEASED'&&s.restart.kind==='GOALKEEPER_THROW'&&f.purpose==='PLAY') {
      if(goalAreaClearance(hit.point,s.directions[otherTeam(s.restart.owner)])<=.1)continue;
      s.ball.position={...hit.point};completeRestart(s,'GOAL_AREA_EXIT');
    }
    if(p.team===shooter.team&&f.kind==='PASS'&&f.purpose!=='DEAD_BALL_RETURN') {
      const pace=Math.hypot(f.velocity.x,f.velocity.y),risk=receptionRisk(s,p,hit.point,pace);
      // Roll once, only after a real reachable catch. A fumble creates a
      // physical contested rebound; it does not hand possession to anyone.
      if(risk>0&&random(s)<risk){deflect(s,p,hit.point,'RECEPTION_FAILED',{risk,pace,handling:p.profile.handling,pressure:releasePressure(s,p)});return;}
    }
    if(p.team!==shooter.team) {
      // Holding a lane deflects; attacking the ball takes it.
      const attacking=['RECEIVE','PRESS','HELP'].includes(p.action?.kind??'');
      if(!attacking) {
        contest(s,'INTERCEPTION',shooter,p,'DEFLECTED',distance(hit.point,p.position),12,f.actionId);
        deflect(s,p,hit.point,'PASS_DEFLECTED');return;
      }
      contest(s,'INTERCEPTION',shooter,p,'CONTROLLED',distance(hit.point,p.position),12,f.actionId);
    }
    if(s.restart?.phase==='RELEASED'&&s.restart.kind==='CENTRE_THROW_OFF')completeRestart(s,'TEAMMATE_TOUCH');
    acquire(s,p,hit.point,f.purpose==='DEAD_BALL_RETURN'?'Dead-ball return received':p.team===shooter.team?'Pass received':'Intercepted',f.actionId);
    if(f.purpose==='DEAD_BALL_RETURN')record(s,'BALL_RETURN_RECEIVED',p,{},[shooter.id],null,f.actionId);
    else if(f.kind==='DEFLECTION')record(s,'REBOUND_CONTROLLED',p,{},[shooter.id],null,f.actionId);
    else if(p.team===shooter.team){s.possession.completedPasses++;s.possession.lastPasserId=shooter.id;record(s,'PASS_RECEIVED',p,{passerId:shooter.id},[shooter.id],null,f.actionId);}
    else record(s,'INTERCEPTION',p,{},[shooter.id],null,f.actionId);
    return;
  }
  s.ball.position=to;s.ball.mode=f.kind==='SHOT'?'SHOT_FLIGHT':f.kind==='PASS'?'PASS_FLIGHT':'DEFLECTION';
  if(s.restart?.phase==='RELEASED'&&f.purpose==='PLAY') {
    if(s.restart.kind==='CENTRE_THROW_OFF'&&distance(to,{x:10,y:20})-.1>2)completeRestart(s,'THROW_OFF_AREA_EXIT');
    if(s.restart.kind==='GOALKEEPER_THROW'&&goalAreaClearance(to,s.directions[otherTeam(s.restart.owner)])>.1)completeRestart(s,'GOAL_AREA_EXIT');
  }
  if((f.kind==='SHOT'||f.kind==='DEFLECTION'&&(f.sourceKind==='SHOT'||f.sourceKind===undefined&&f.goalHeight!==undefined))&&((f.goalSide==='TOP'&&to.y<0)||(f.goalSide==='BOTTOM'&&to.y>40))) {
    const y=goal(f.goalSide).y,t=(y-from.y)/(to.y-from.y),x=from.x+t*(to.x-from.x);
    s.ball.position={x,y};
    if(x>8.5&&x<11.5&&s.ball.height<2) {
      const scorer=getPlayer(s,f.fromId),keeper=courtPlayers(s,otherTeam(scorer.team)).find(p=>p.kind==='GOALKEEPER');
      if(keeper)contest(s,'KEEPER',scorer,keeper,'OUTSIDE_SAVE_WINDOW',distance(keeper.position,s.ball.position),12,f.actionId);
      s.score[scorer.team]++;record(s,'GOAL',scorer,{x,height:s.ball.height},[],null,f.actionId);
      awardRestart(s,'CENTRE_THROW_OFF',otherTeam(scorer.team),{x:10,y:20},'Goal crossed line',scorer);return;
    }
  }
  if(to.x<0||to.x>20||to.y<0||to.y>40) {
    if(f.purpose==='DEAD_BALL_RETURN'){s.status='FAILED';s.reason='Physical dead-ball return missed its recipient';record(s,'BALL_RETURN_FAILED',null);return;}
    const last=getPlayer(s,s.ball.lastTouchId!);
    const crossings:number[]=[];
    if(to.x<0)crossings.push((0-from.x)/(to.x-from.x));if(to.x>20)crossings.push((20-from.x)/(to.x-from.x));
    if(to.y<0)crossings.push((0-from.y)/(to.y-from.y));if(to.y>40)crossings.push((40-from.y)/(to.y-from.y));
    const t=Math.min(...crossings),boundary={x:from.x+(to.x-from.x)*t,y:from.y+(to.y-from.y)*t};
    s.ball.position=boundary;s.ball.mode='OUT';record(s,'BALL_OUT',last,{x:boundary.x,y:boundary.y},[],null,f.actionId);
    const sideline=boundary.x<1e-8||boundary.x>20-1e-8;
    const endSide=boundary.y<20?'TOP':'BOTTOM';
    const defending=s.directions.HOME===endSide?'AWAY':'HOME';
    const corner=!sideline&&last.team===defending&&last.kind!=='GOALKEEPER';
    const location=corner?{x:boundary.x<10?0:20,y:boundary.y}:boundary;
    awardRestart(s,sideline||corner?'THROW_IN':'GOALKEEPER_THROW',sideline||corner?otherTeam(last.team):defending,location,'Ball crossed court boundary',last);return;
  }
  if(f.kind==='DEFLECTION'&&s.tick-f.releasedTick>=12) {s.ball.mode='LOOSE';s.ball.height=0;s.ball.flight=null;record(s,'BALL_LOOSE',null);}
  else if(s.tick-f.releasedTick>160){s.status='INCOMPLETE';s.reason='Unresolved ball flight budget';record(s,'INCOMPLETE',null,{reason:s.reason});}
}
