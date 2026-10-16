import { actionAvailable, getPlayer, random, record, uid, type ActionKind, type CoreAction, type CorePlayer, type CoreState, type Point, type TeamId } from './state';
import { distance, fieldLegal, goal, local } from './space';
import { awardRestart } from './transitions';
import { authorisedRestartMovementLegal } from './rules';
import { movementCapacity,accelerationCapacity } from './condition';
import { carryControl, planShotTarget } from './execution';
import { steerVelocity } from './locomotion';
import {bodyRoute,defensiveFootwork,engagementMovement,movementPace} from './movement';
import {physicalImpulse,turningDemand} from './physicalLoad';

const durations: Record<ActionKind,number>={RUN:12,REPOSITION:12,RECEIVE:36,HOLD:6,DRIBBLE:16,PASS:4,FEINT:7,DRIVE:14,JUMP:3,SHOOT:4,LAND:4,SCREEN:20,PRESS:10,CONTAIN:10,HELP:12,HANDOVER:4,RECOVER:12,BLOCK:12,CONTACT:8,SAVE:18,EXCHANGE:20};
export const movementActions: ActionKind[]=['RUN','REPOSITION','RECEIVE','DRIBBLE','DRIVE','PRESS','CONTAIN','HELP','RECOVER','SAVE','EXCHANGE'];
export function legalAction(s: CoreState,p: CorePlayer,kind: ActionKind): boolean {
  if(s.status!=='RUNNING'||p.population!=='COURT'||!actionAvailable(p))return false;
  const controls=s.ball.controllerId===p.id;
  if(kind==='EXCHANGE')return !controls&&s.exchanges.some(e=>e.phase!=='COMPLETED'&&e.phase!=='CANCELLED'&&(e.outId===p.id||e.inId===p.id));
  if(p.airborne&&(!controls||!s.ball.live))return kind==='LAND';
  // A goalkeeper taking his stance for a seven-metre is doing it while the ball
  // is still dead -- that is what being SET means -- so it has to be legal here,
  // before the dead-ball allowance turns everything else away.
  if(!s.ball.live&&kind==='SAVE'&&p.kind==='GOALKEEPER'&&
    s.restart?.kind==='SEVEN_METRE'&&s.restart.owner!==p.team)return true;
  if(!s.ball.live) return kind==='REPOSITION'||kind==='RUN'||kind==='RECEIVE'||
    (kind==='PASS'&&controls&&s.restart?.collectorId===p.id&&s.restart.takerId!==p.id&&s.restart.phase==='PREPARING')||
    (s.restart?.phase==='AUTHORISED'&&s.restart.takerId===p.id&&(kind==='PASS'||kind==='SHOOT'));
  if(p.airborne)return kind==='SHOOT'&&controls||kind==='LAND'&&!controls;
  if(['HOLD','DRIBBLE','PASS','FEINT','DRIVE','JUMP','SHOOT'].includes(kind)&&!controls)return false;
  if(kind==='DRIBBLE'&&p.handling.dribbleUsed)return false;
  if(['RUN','REPOSITION','SCREEN','RECEIVE'].includes(kind)&&controls)return false;
  // A GOALKEEPER SETS HIMSELF FOR A SEVEN-METRE BEFORE IT IS THROWN. Allowing a
  // save only once the ball is airborne meant he could never contest a penalty
  // at all: the flight from seven metres lasts about six ticks and the save
  // action needs four of them before it is executing, so he was still in a
  // REPOSITION at every single one and they converted at ninety-four per cent.
  // Standing set on his line waiting for the throw is the one situation in
  // handball where the keeper is ready before the ball moves.
  if(kind==='SAVE')return p.kind==='GOALKEEPER'&&(s.ball.flight?.kind==='SHOT'||visibleShotPreparation(s,p.team)!==null||
    (s.restart?.kind==='SEVEN_METRE'&&s.restart.owner!==p.team&&s.restart.phase!=='COMPLETED'));
  if(kind==='JUMP'||kind==='SHOOT')return p.kind==='FIELD_PLAYER'&&fieldLegal(p.position,p.radius);
  return true;
}
/**
 * MATCH RHYTHM: keep an intention that is still the right intention.
 *
 * The audit measured 48,185 action starts in one match across fourteen players,
 * roughly ten times what a real match contains. Nothing was choosing badly; the
 * selector simply re-issued the same correct decision every few ticks, and a
 * body that restarts its acceleration curve twenty times a second reads on
 * screen as twitching rather than running.
 *
 * The fix is not a global cooldown, which would make players slow to react to
 * things that genuinely changed. It is to let a live action absorb a small
 * correction to its own target instead of being replaced. A defender tracking a
 * moving man, a wing holding width, a player running an entry: each of these is
 * ONE action whose destination drifts, not a new decision every tick.
 *
 * Returns true when the existing action was kept, in which case the caller must
 * not start a new one. A drift larger than `tolerance` means the situation
 * really did change and a fresh decision is correct.
 */
export function sustain(s:CoreState,p:CorePlayer,kind:ActionKind,target:Point|null=null,targetId:string|null=null,tolerance=1.1):boolean {
  const a=p.action;
  if(!a||a.kind!==kind||['COMPLETED','INTERRUPTED','FAILED'].includes(a.phase))return false;
  if(a.possessionId!==s.possession.id)return false;
  if(targetId!==null&&a.targetId!==targetId)return false;
  if(target&&a.target) {
    if(distance(a.target,target)>tolerance)return false;
    // Steer toward the corrected point without restarting the lifecycle. The
    // phase, and therefore the momentum he has already built, are preserved.
    a.target={...target};
  } else if(!!target!==!!a.target)return false;
  return true;
}
export function startAction(s: CoreState,p: CorePlayer,kind: ActionKind,reason: string,target: Point|null=null,targetId:string|null=null,shotKind:CoreAction['shotKind']=null,purpose:CoreAction['purpose']='PLAY'): boolean {
  if(!legalAction(s,p,kind))return false;
  const id=uid(s,'action');
  p.intent={id:`${id}-intent`,effect:kind,reason,targetId};
  p.action={id,possessionId:s.possession.id,kind,phase:'PREPARING',startedTick:s.tick,phaseTick:s.tick,executeTicks:durations[kind],recoveryTicks:['SHOOT','DRIVE','FEINT','CONTACT','SAVE'].includes(kind)?6:2,target:target&&{...target},targetId,reason,resolved:false,contestIds:[],shotKind,purpose,contact:null,driveStart:null};
  if(kind==='PASS'&&s.ball.live&&s.ball.controllerId===p.id&&!target){
    const speed=Math.hypot(p.velocity.x,p.velocity.y),budget=(s.ruleProfile.maxSteps-p.handling.steps)*.8-p.handling.stepDistance-.05;
    if(speed>.4&&budget>.05){const extent=Math.min(.45,budget);p.action.target={x:p.position.x+p.velocity.x/speed*extent,y:p.position.y+p.velocity.y/speed*extent};}
  }
  if(kind==='DRIVE')p.action.driveStart=Object.fromEntries([s.defence.pressureId,s.defence.helperId].filter((id):id is string=>id!==null).map(id=>[id,local(p.position,s.directions[p.team]).y-local(getPlayer(s,id).position,s.directions[p.team]).y]));
  if(kind==='DRIVE') {
    p.action.recoveryTicks=2;
    // Leave preparation, recovery and a subsequent release inside the held-ball budget.
    p.action.executeTicks=Math.min(p.action.executeTicks,Math.max(1,s.ruleProfile.maxHoldMs/50-(s.tick-p.handling.heldSinceTick)-15));
    // POSSESSION ECOLOGY: a drive is three steps, because that is the rule.
    //
    // The drive used to run for its own duration and the referee then whistled
    // him: sixty-four three-step violations a match, every one of them ending an
    // attack that was going somewhere. A carrier attacks the interval with the
    // steps he actually has, and if he wants more he puts the ball down.
    if(p.action.target) {
      const left=Math.max(0,(s.ruleProfile.maxSteps-p.handling.steps)*.8-p.handling.stepDistance-.15);
      const d=distance(p.position,p.action.target);
      if(d>left&&d>1e-6) {
        p.action.target={x:p.position.x+(p.action.target.x-p.position.x)*left/d,y:p.position.y+(p.action.target.y-p.position.y)*left/d};
      }
    }
  }
  if(kind==='PASS'&&targetId){const receiver=getPlayer(s,targetId);receiver.reception={passActionId:id,readyTick:s.tick+4};record(s,'RECEPTION_OFFERED',receiver,{passActionId:id,readyTick:s.tick+4},[p.id]);}
  record(s,'ACTION_STARTED',p,{kind,reason,duty:p.duty.kind});return true;
}
function phase(s:CoreState,p:CorePlayer,next:CoreAction['phase']) {p.action!.phase=next;p.action!.phaseTick=s.tick;record(s,'ACTION_PHASE',p,{kind:p.action!.kind,phase:next});}
/** Proposed physical movement is rejected before integration if illegal; no release-point repairs. */
export function move(s:CoreState,p:CorePlayer,target:Point|null,committedSave=false,carryOnly=false) {
  const d=target?distance(p.position,target):0;
  if(committedSave&&d<.03){p.velocity={x:0,y:0};return;}
  const dx=target&&d>1e-8?(target.x-p.position.x)/d:0,dy=target&&d>1e-8?(target.y-p.position.y)/d:0;
  const impaired=s.tick < p.beatenUntilTick ? 0.4 : s.tick < p.screenedUntilTick ? 0.15 : s.tick<p.wrongFootedUntilTick?.65:1;
  const capacity=movementCapacity(p);
  const acceleration=p.profile.acceleration*accelerationCapacity(p,turningDemand(p,target))*defensiveFootwork(s,p);
  // Arrival is a braking problem, not a velocity reset. Close to a relational
  // target, proportional approach removes the alternating overshoot/stop cycle.
  // A committed keeper reach retains v2.1's released-shot timing model. Its
  // short reaction/reach is not an ordinary outfield support run.
  const saveSpeed=Math.min(p.profile.topSpeed*impaired*capacity,Math.max(0,p.velocity.x*dx+p.velocity.y*dy)+acceleration*.05,Math.sqrt(2*acceleration*d));
  const maximum=p.profile.topSpeed*impaired*capacity*movementPace(s,p,target);
  const limit=carryOnly?Math.min(maximum,Math.hypot(p.velocity.x,p.velocity.y)):maximum;
  const route=target?bodyRoute(s,p,target):null;
  const velocity=committedSave?{x:dx*saveSpeed,y:dy*saveSpeed}:steerVelocity(p.position,p.velocity,route,limit,acceleration);
  const speed=Math.hypot(velocity.x,velocity.y);
  if(speed<1e-8){p.velocity={x:0,y:0};return;}
  // A support post is a soft relation, not a wall. If momentum requires a
  // little more braking distance, travel that actual bounded step and steer
  // back. Held-ball budgets, goalkeeper reach and dead-ball placement stay hard.
  const engagement=engagementMovement(s,p);
  const soft=s.ball.live&&p.kind==='FIELD_PLAYER'&&!engagement&&s.ball.controllerId!==p.id&&p.action?.kind!=='EXCHANGE';
  const travel=target&&!soft?Math.min(d,speed*.05):speed*.05,heading={x:velocity.x/speed,y:velocity.y/speed};
  // Local steering around occupied bodies is execution of the existing duty,
  // not a new tactical assignment. Every candidate is checked before movement.
  let chosen: {x:number;y:number;dx:number;dy:number}|null=null;
  // During dead-ball preparation a body trapped between the taker and sideline
  // may need to step backwards before returning to its restart position.
  const taker=s.restart?.takerId?getPlayer(s,s.restart.takerId):null;
  const pinned=!s.ball.live&&taker&&p.team!==taker.team&&(p.position.x<1||p.position.x>19)&&distance(p.position,taker.position)<1;
  // A loose-ball claimant boxed between actual bodies may need to move away
  // before going around them. Every detour still obeys acceleration, collision
  // and legal-court checks; no hand contact or ownership is granted here.
  const collectionDetour=s.ball.mode==='LOOSE'&&p.duty.kind==='COLLECT';
  const angles=s.ball.live&&!engagement&&p.kind!=='GOALKEEPER'?(collectionDetour?[0,.12,-.12,.25,-.25,.45,-.45,.7,-.7,1.3,-1.3,Math.PI/2,-Math.PI/2,1.9,-1.9,2.5,-2.5,Math.PI]:[0,.12,-.12,.25,-.25,.45,-.45,.7,-.7]):!pinned?[0,.7,-.7,1.3,-1.3,Math.PI/2,-Math.PI/2,1.9,-1.9]:[0,.7,-.7,1.3,-1.3,Math.PI/2,-Math.PI/2,1.9,-1.9,2.5,-2.5,Math.PI];
  for(const angle of angles) {
    const ux=heading.x*Math.cos(angle)-heading.y*Math.sin(angle),uy=heading.x*Math.sin(angle)+heading.y*Math.cos(angle);
    const next={x:p.position.x+ux*travel,y:p.position.y+uy*travel};
    if(s.ball.live&&!committedSave&&!engagement&&p.kind!=='GOALKEEPER'&&Math.hypot(ux*travel/.05-p.velocity.x,uy*travel/.05-p.velocity.y)>2*acceleration*.05+1e-8)continue;
    const exchange=p.action?.kind==='EXCHANGE';
    const ordinary=p.kind==='GOALKEEPER'?next.x>=.3&&next.x<=19.7&&next.y>=.3&&next.y<=39.7:fieldLegal(next,p.radius);
    const legal=ordinary||(exchange&&next.x>=-.4&&next.x<.35&&next.y>=15&&next.y<=25);
    const blocked=s.players.some(q=>q.id!==p.id&&q.population==='COURT'&&distance(next,q.position)<p.radius+q.radius);
    if(legal&&!blocked&&authorisedRestartMovementLegal(s,p,next)){chosen={...next,dx:ux,dy:uy};break;}
  }
  if(!chosen){p.velocity={x:0,y:0};return;}
  p.position={x:chosen.x,y:chosen.y};p.velocity={x:chosen.dx*travel/.05,y:chosen.dy*travel/.05};
  if(s.ball.live&&s.ball.controllerId===p.id&&s.ball.mode!=='DRIBBLE') {
    p.handling.stepDistance+=travel;
    while(p.handling.stepDistance>=.8){p.handling.stepDistance-=.8;p.handling.steps++;record(s,'HANDLING_STEP',p,{steps:p.handling.steps});}
  }
}
/**
 * END AN ACTION BECAUSE IT SUCCEEDED.
 *
 * `interrupt` exists for an action that should never have finished -- a
 * goalkeeper's walk abandoned because a shot is on its way. It zeroes the
 * player's momentum and his queued follow-up, because the intention is being
 * thrown away.
 *
 * A drive that ends in a pass is the opposite case. The drive DID happen: it
 * engaged a defender, it may have beaten him, it drew the cover, it spent
 * steps, and the pass is what those things were for. Marking it INTERRUPTED
 * says the attack never occurred, and zeroing his momentum stops a man running
 * into a release. So an action that has done its job completes.
 */
export function resolveAction(s:CoreState,p:CorePlayer,reason:string) {
  const a=p.action;if(!a||['COMPLETED','FAILED','INTERRUPTED'].includes(a.phase))return false;
  a.resolved=true;phase(s,p,'COMPLETED');
  record(s,'ACTION_RESOLVED',p,{kind:a.kind,reason});
  return true;
}
/**
 * Is a seven-metre throw being taken against this goalkeeper, right now?
 *
 * True from the award until the throw has finished travelling. The keeper's
 * stance has to survive BOTH halves of that: he was holding it through the
 * preparation and then dropping into recovery on the tick after the release,
 * so on the two or three ticks when the ball was actually near him he no longer
 * counted as ready and reached a fifth of a metre. He is set until it is over.
 */
export function penaltyAgainst(s:CoreState,p:CorePlayer):boolean {
  if(!s.ball.live&&s.restart?.kind==='SEVEN_METRE'&&s.restart.owner!==p.team)return true;
  const f=s.ball.flight;
  if(!f||f.kind!=='SHOT')return false;
  const shooter=s.players.find(q=>q.id===f.fromId);
  return !!shooter&&shooter.team!==p.team&&shooter.action?.shotKind==='SEVEN_METRE';
}
/** A visible throwing action, never the future aim or a queued tactical plan. */
export function visibleShotPreparation(s:CoreState,defendingTeam:TeamId):CorePlayer|null {
  if(!s.ball.live||!s.ball.controllerId)return null;
  const carrier=getPlayer(s,s.ball.controllerId);
  if(carrier.team===defendingTeam||carrier.population!=='COURT')return null;
  const a=carrier.action;
  const active=a&&!['COMPLETED','FAILED','INTERRUPTED'].includes(a.phase);
  return active&&(a.kind==='JUMP'||a.kind==='SHOOT')||carrier.airborne&&carrier.nextAction==='SHOOT'?carrier:null;
}
export type ExecutionEffect = {playerId:string;kind:'PASS'|'SHOOT'|'FEINT'|'DRIVE'};
export function execute(s: CoreState): ExecutionEffect[] {
  const effects: ExecutionEffect[]=[];
  for(const p of s.players) {
    if(p.population!=='COURT')continue;
    const a=p.action;
    // Locomotion runs every live tick, independently of the hands/action clock.
    // A standing player still prepares before starting; a moving player steers
    // through a compatible new intention and brakes through a stationary one.
    // Airborne poses and dead-ball placement keep their existing authority.
    if(s.ball.live&&!p.airborne&&a?.kind!=='SAVE'){
      const active=a&&!['COMPLETED','FAILED','INTERRUPTED'].includes(a.phase);
      const releasedSupport=active&&a.kind==='PASS'&&a.resolved;
      const threat=p.handballIntent&&['EXPLOIT_ADVANTAGE','ATTACK_GAP','ATTACK_NEXT_DEFENDER','BIND_HELP'].includes(p.handballIntent.kind);
      const readingThreat=!!(active&&a.kind==='HOLD'&&threat&&a.target);
      const moving=active&&(movementActions.includes(a.kind)||a.kind==='PASS'||readingThreat)&&a.target!==null;
      // Preparation/recovery retains decision timing. Compatible off-ball
      // phases carry existing pace; they cannot create new forward acceleration.
      const ready=a?.phase==='EXECUTING'&&!readingThreat||releasedSupport;
      const compatibleThreat=!!(threat&&a&&['DRIVE','DRIBBLE','HOLD'].includes(a.kind)&&a.target&&
        (a.target.x-p.position.x)*p.velocity.x+(a.target.y-p.position.y)*p.velocity.y>0);
      // A continuing tactical threat can carry existing momentum through hand
      // preparation. It cannot accelerate before readiness or evade step/bounce legality.
      const carrying=!ready&&(s.ball.controllerId!==p.id||a?.kind==='PASS'||compatibleThreat)&&Math.hypot(p.velocity.x,p.velocity.y)>.01;
      const target=moving&&(ready||carrying)?a.target:null;
      // A held ball still has a finite step budget; braking cannot spend a
      // fourth step. Dribble movement begins only after its actual bounce.
      const controls=s.ball.controllerId===p.id&&s.ball.mode!=='DRIBBLE';
      const budget=controls?(s.ruleProfile.maxSteps-p.handling.steps)*.8-p.handling.stepDistance-.01:Infinity;
      if(controls&&budget<=Math.hypot(p.velocity.x,p.velocity.y)*.05){p.velocity={x:0,y:0};}
      else move(s,p,target,false,carrying);
    }
    if(s.ball.live&&a?.kind==='SAVE'){
      if(a.phase==='EXECUTING'&&a.target)move(s,p,a.target,true);
      else p.velocity={x:0,y:0};
    }
    if(!a)continue;
    const elapsed=s.tick-a.phaseTick;
    if(a.phase==='PREPARING'&&elapsed>=2){
      // A stationary screen first plants its feet instead of relabelling a
      // running body as a legal stationary obstacle on a hands-clock boundary.
      if(a.kind==='SCREEN'&&Math.hypot(p.velocity.x,p.velocity.y)>.15)continue;
      if(a.kind==='SHOOT'&&!a.target){
        const plan=planShotTarget(s,p,random(s)<.5?-1:1);a.target={x:plan.aimX,y:goal(plan.direction).y};
        record(s,'SHOT_AIM_COMMITTED',p,{aimX:plan.aimX,pressure:plan.context.pressure,opportunityQuality:plan.context.opportunityQuality,decisionQuality:plan.context.quality});
      }
      phase(s,p,'COMMITTED');continue;
    }
    if(a.phase==='COMMITTED'&&elapsed>=2){
      phase(s,p,'EXECUTING');
      if(a.kind==='DRIBBLE') {s.ball.mode='DRIBBLE';p.handling.dribbleUsed=true;p.handling.bounceTick=s.tick;record(s,'DRIBBLE_STARTED',p);}
      if(a.kind==='HOLD')s.ball.mode='HOLD';
      if(a.kind==='JUMP') {
        if(!fieldLegal(p.position,p.radius)){a.phase='FAILED';continue;}
        p.airborne={takeoff:{...p.position},untilTick:s.tick+24};p.velocity={x:0,y:0};p.nextAction='SHOOT';record(s,'TAKEOFF',p,{x:p.position.x,y:p.position.y});
        physicalImpulse(p,'jump');
      }
      continue;
    }
    if(a.phase==='RECOVERING'&&elapsed>=a.recoveryTicks){phase(s,p,'COMPLETED');continue;}
    if(a.phase!=='EXECUTING')continue;
    if(!s.ball.live){if(movementActions.includes(a.kind)&&a.target)move(s,p,a.target,true);else p.velocity={x:0,y:0};}
    if(a.kind==='DRIBBLE'&&s.ball.controllerId===p.id){
      const bounceAge=(s.tick-p.handling.bounceTick)%8;s.ball.height=Math.abs(4-bounceAge)/4;
      if(bounceAge===4){
        const touch=carryControl(s,p);
        record(s,'DRIBBLE_BOUNCE',p,{...touch});
        if(touch.risk>0&&random(s)<touch.risk){
          // The missed floor touch releases a reachable physical ball. Neither
          // possession nor its loss counter changes until someone controls it.
          const speed=Math.max(.1,Math.hypot(p.velocity.x,p.velocity.y));
          const ux=p.velocity.x/speed,uy=p.velocity.y/speed,side=random(s)<.5?-1:1;
          s.ball={...s.ball,mode:'LOOSE',controllerId:null,flight:null,height:0,lastTouchId:p.id,
            position:{x:Math.max(.3,Math.min(19.7,p.position.x+ux*.55-uy*.35*side)),y:Math.max(.3,Math.min(39.7,p.position.y+uy*.55+ux*.35*side))}};
          record(s,'CONTROL_MISTOUCH',p,{...touch,cause:'BALL_CONTROL',x:s.ball.position.x,y:s.ball.position.y});
          a.phase='FAILED';p.nextAction=null;record(s,'ACTION_FAILED',p,{reason:'Challenged dribble touch escaped control'});continue;
        }
      }
    }
    if(a.kind==='DRIVE'&&!a.resolved)effects.push({playerId:p.id,kind:'DRIVE'});
    if(a.kind==='EXCHANGE'&&a.target&&distance(p.position,a.target)>.03)continue;
    if(['RUN','REPOSITION'].includes(a.kind)&&p.reception&&
      (s.ball.flight?.actionId===p.reception.passActionId||s.players.some(q=>q.action?.id===p.reception!.passActionId&&q.action.kind==='PASS'&&!['COMPLETED','FAILED','INTERRUPTED'].includes(q.action.phase))))continue;
    if(a.kind==='RECEIVE'&&(s.ball.flight?.receiverId===p.id||s.players.some(q=>q.action?.kind==='PASS'&&q.action.targetId===p.id&&!['COMPLETED','FAILED','INTERRUPTED'].includes(q.action.phase))))continue;
    // MATCH RHYTHM: a man running somewhere is doing ONE thing until he gets
    // there. Completing a movement action on a timer and immediately reissuing
    // it was the single largest source of action churn: nineteen thousand
    // goalkeeper repositions and twelve thousand containments in one match,
    // each restarting an acceleration curve that had not finished. A tracking
    // action now ends when the job ends, with a bound so nothing runs forever.
    // Live play only. During a dead ball the restart owns every position, and
    // a movement action that refused to finish would stop it re-aiming anybody:
    // a blocked player then held a stale target until the preparation budget
    // ran out and the match stopped. Restart preparation keeps its authority.
    // A KEEPER SET FOR A PENALTY IS NOT COMPLETING ANYTHING. He is waiting, and
    // the wait lasts as long as the referee takes. Letting the save run its
    // eighteen ticks and finish meant he cycled in and out of readiness, so
    // whether he was actually set when the throw came was a lottery -- and a
    // save restarted from scratch cannot reach a seven-metre at all.
    if(a.kind==='SAVE'&&a.targetId===null&&p.kind==='GOALKEEPER'&&
      (penaltyAgainst(s,p)||visibleShotPreparation(s,p.team)||
        s.ball.flight?.kind==='SHOT'&&getPlayer(s,s.ball.flight.fromId).team!==p.team))continue;
    // Hands stay up while this assigned throw is being made and travelling.
    // Nothing here predicts where it will be aimed or manufactures a contest.
    if(a.kind==='BLOCK'&&a.targetId&&
      (visibleShotPreparation(s,p.team)?.id===a.targetId||s.ball.flight?.kind==='SHOT'&&s.ball.flight.fromId===a.targetId))continue;
    // A held-ball drive is bounded by its handling budget even when blocked.
    // Tracking a moving opponent must never extend the carrier past three seconds.
    const tracking=s.ball.live&&a.kind!=='DRIVE'&&movementActions.includes(a.kind)&&a.target!==null&&distance(p.position,a.target)>.35;
    if(tracking&&s.tick-a.startedTick<400&&Math.hypot(p.velocity.x,p.velocity.y)>.05)continue;
    if(elapsed<a.executeTicks)continue;
    if(['PASS','SHOOT','FEINT'].includes(a.kind)&&!a.resolved)effects.push({playerId:p.id,kind:a.kind as ExecutionEffect['kind']});
    if(a.kind==='DRIBBLE'&&s.ball.controllerId===p.id){s.ball.mode='CONTROLLED';s.ball.height=1.2;p.handling.steps=0;p.handling.stepDistance=0;p.handling.heldSinceTick=s.tick;record(s,'DRIBBLE_GATHERED',p);}
    if(a.kind==='LAND'){p.airborne=null;record(s,'LANDED',p);}
    if(a.kind==='FEINT')p.nextAction='DRIVE';
    phase(s,p,'RECOVERING');
  }
  return effects;
}
export function handlingRules(s:CoreState) {
  if(!s.ball.live||!s.ball.controllerId)return;
  const p=getPlayer(s,s.ball.controllerId);
  if(s.ball.mode!=='DRIBBLE'&&((s.tick-p.handling.heldSinceTick)*50>s.ruleProfile.maxHoldMs||p.handling.steps>s.ruleProfile.maxSteps)) {
    awardRestart(s,'FREE_THROW',p.team==='HOME'?'AWAY':'HOME',p.position,p.handling.steps>s.ruleProfile.maxSteps?'More than three steps':'Held longer than three seconds',p);return;
  }
  if(p.airborne&&s.tick>=p.airborne.untilTick){
    if(s.ball.controllerId===p.id)awardRestart(s,'FREE_THROW',p.team==='HOME'?'AWAY':'HOME',p.position,'Landed holding the ball after jump',p);
    else p.airborne=null;
  }
}
export function driveTarget(s:CoreState,p:CorePlayer): Point {
  const direction=s.directions[p.team],q=local(p.position,direction);
  const primary=s.defence.pressureId?s.players.find(d=>d.id===s.defence.pressureId):null;
  if(primary) {
    const shoulder={x:p.position.x+(p.position.x<=primary.position.x?-1:1)*1.3,y:p.position.y+(direction==='TOP'?-1:1)*1.3};
    if(fieldLegal(shoulder,p.radius))return shoulder;
  }
  const forward=goal(direction),d=distance(p.position,forward);
  return {x:p.position.x+(forward.x-p.position.x)/d*1.8,y:p.position.y+(forward.y-p.position.y)/d*Math.min(1.8,Math.max(.1,q.y-6.5))};
}
