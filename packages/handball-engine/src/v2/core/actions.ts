import { actionAvailable, getPlayer, record, uid, type ActionKind, type CoreAction, type CorePlayer, type CoreState, type Point } from './state';
import { distance, fieldLegal, goal, local } from './space';
import { awardRestart } from './transitions';

const durations: Record<ActionKind,number>={RUN:12,REPOSITION:12,RECEIVE:36,HOLD:6,DRIBBLE:16,PASS:4,FEINT:7,DRIVE:8,JUMP:3,SHOOT:4,LAND:4,SCREEN:20,PRESS:10,CONTAIN:10,HELP:12,HANDOVER:4,RECOVER:12,BLOCK:12,CONTACT:8,SAVE:18,EXCHANGE:20};
export const movementActions: ActionKind[]=['RUN','REPOSITION','DRIBBLE','DRIVE','PRESS','CONTAIN','HELP','RECOVER','SAVE','EXCHANGE'];
export function legalAction(s: CoreState,p: CorePlayer,kind: ActionKind): boolean {
  if(s.status!=='RUNNING'||p.population!=='COURT'||!actionAvailable(p))return false;
  const controls=s.ball.controllerId===p.id;
  if(kind==='EXCHANGE')return !controls&&s.exchanges.some(e=>e.phase!=='COMPLETED'&&(e.outId===p.id||e.inId===p.id));
  if(p.airborne&&!controls)return kind==='LAND';
  if(!s.ball.live) return kind==='REPOSITION'||kind==='RUN'||kind==='RECEIVE'||
    (kind==='PASS'&&controls&&s.restart?.collectorId===p.id&&s.restart.takerId!==p.id&&s.restart.phase==='PREPARING')||
    (s.restart?.phase==='AUTHORISED'&&s.restart.takerId===p.id&&(kind==='PASS'||kind==='SHOOT'));
  if(p.airborne)return kind==='SHOOT'&&controls||kind==='LAND'&&!controls;
  if(['HOLD','DRIBBLE','PASS','FEINT','DRIVE','JUMP','SHOOT'].includes(kind)&&!controls)return false;
  if(kind==='DRIBBLE'&&p.handling.dribbleUsed)return false;
  if(['RUN','REPOSITION','SCREEN','RECEIVE'].includes(kind)&&controls)return false;
  if(kind==='SAVE')return p.kind==='GOALKEEPER'&&s.ball.flight?.kind==='SHOT';
  if(kind==='JUMP'||kind==='SHOOT')return p.kind==='FIELD_PLAYER'&&fieldLegal(p.position,p.radius);
  return true;
}
export function startAction(s: CoreState,p: CorePlayer,kind: ActionKind,reason: string,target: Point|null=null,targetId:string|null=null,shotKind:CoreAction['shotKind']=null,purpose:CoreAction['purpose']='PLAY'): boolean {
  if(!legalAction(s,p,kind))return false;
  const id=uid(s,'action');
  p.intent={id:`${id}-intent`,effect:kind,reason,targetId};
  p.action={id,possessionId:s.possession.id,kind,phase:'PREPARING',startedTick:s.tick,phaseTick:s.tick,executeTicks:durations[kind],recoveryTicks:['SHOOT','DRIVE','FEINT','CONTACT','SAVE'].includes(kind)?6:2,target:target&&{...target},targetId,reason,resolved:false,contestIds:[],shotKind,purpose};
  if(kind==='PASS'&&targetId){const receiver=getPlayer(s,targetId);receiver.reception={passActionId:id,readyTick:s.tick+4};record(s,'RECEPTION_OFFERED',receiver,{passActionId:id,readyTick:s.tick+4},[p.id]);}
  record(s,'ACTION_STARTED',p,{kind,reason,duty:p.duty.kind});return true;
}
function phase(s:CoreState,p:CorePlayer,next:CoreAction['phase']) {p.action!.phase=next;p.action!.phaseTick=s.tick;record(s,'ACTION_PHASE',p,{kind:p.action!.kind,phase:next});}
/** Proposed physical movement is rejected before integration if illegal; no release-point repairs. */
function move(s:CoreState,p:CorePlayer,target:Point) {
  const d=distance(p.position,target);if(d<.03){p.velocity={x:0,y:0};return;}
  const oldSpeed=Math.hypot(p.velocity.x,p.velocity.y);
  const impaired=s.tick < p.beatenUntilTick ? 0.4 : s.tick < p.screenedUntilTick ? 0.15 : 1;
  const speed=Math.min(p.attributes.speed*impaired,oldSpeed+p.attributes.acceleration*.05,Math.sqrt(2*p.attributes.acceleration*d));
  const travel=Math.min(d,speed*.05),dx=(target.x-p.position.x)/d,dy=(target.y-p.position.y)/d;
  // Local steering around occupied bodies is execution of the existing duty,
  // not a new tactical assignment. Every candidate is checked before movement.
  let chosen: {x:number;y:number;dx:number;dy:number}|null=null;
  for(const angle of [0,.7,-.7,1.3,-1.3,Math.PI/2,-Math.PI/2,1.9,-1.9]) {
    const ux=dx*Math.cos(angle)-dy*Math.sin(angle),uy=dx*Math.sin(angle)+dy*Math.cos(angle);
    const next={x:p.position.x+ux*travel,y:p.position.y+uy*travel};
    const exchange=p.action?.kind==='EXCHANGE';
    const ordinary=p.kind==='GOALKEEPER'?next.x>=.3&&next.x<=19.7&&next.y>=.3&&next.y<=39.7:fieldLegal(next,p.radius);
    const legal=ordinary||(exchange&&next.x>=-.4&&next.x<.35&&next.y>=15&&next.y<=25);
    const blocked=s.players.some(q=>q.id!==p.id&&q.population==='COURT'&&distance(next,q.position)<p.radius+q.radius);
    if(legal&&!blocked){chosen={...next,dx:ux,dy:uy};break;}
  }
  if(!chosen){p.velocity={x:0,y:0};return;}
  p.position={x:chosen.x,y:chosen.y};p.velocity={x:chosen.dx*speed,y:chosen.dy*speed};
  if(s.ball.live&&s.ball.controllerId===p.id&&s.ball.mode!=='DRIBBLE') {
    p.handling.stepDistance+=travel;
    while(p.handling.stepDistance>=.8){p.handling.stepDistance-=.8;p.handling.steps++;record(s,'HANDLING_STEP',p,{steps:p.handling.steps});}
  }
}
export type ExecutionEffect = {playerId:string;kind:'PASS'|'SHOOT'|'FEINT'|'DRIVE'};
export function execute(s: CoreState): ExecutionEffect[] {
  const effects: ExecutionEffect[]=[];
  for(const p of s.players) {
    if(p.population!=='COURT')continue;
    const a=p.action;if(!a)continue;
    const elapsed=s.tick-a.phaseTick;
    if(a.phase==='PREPARING'&&elapsed>=2){phase(s,p,'COMMITTED');continue;}
    if(a.phase==='COMMITTED'&&elapsed>=2){
      phase(s,p,'EXECUTING');
      if(a.kind==='DRIBBLE') {s.ball.mode='DRIBBLE';p.handling.dribbleUsed=true;p.handling.bounceTick=s.tick;record(s,'DRIBBLE_STARTED',p);}
      if(a.kind==='HOLD')s.ball.mode='HOLD';
      if(a.kind==='JUMP') {
        if(!fieldLegal(p.position,p.radius)){a.phase='FAILED';continue;}
        p.airborne={takeoff:{...p.position},untilTick:s.tick+24};p.velocity={x:0,y:0};p.nextAction='SHOOT';record(s,'TAKEOFF',p,{x:p.position.x,y:p.position.y});
      }
      continue;
    }
    if(a.phase==='RECOVERING'&&elapsed>=a.recoveryTicks){phase(s,p,'COMPLETED');continue;}
    if(a.phase!=='EXECUTING')continue;
    if(movementActions.includes(a.kind)&&a.target)move(s,p,a.target);else p.velocity={x:0,y:0};
    if(a.kind==='DRIBBLE'&&s.ball.controllerId===p.id){
      const bounceAge=(s.tick-p.handling.bounceTick)%8;s.ball.height=Math.abs(4-bounceAge)/4;
      if(bounceAge===4)record(s,'DRIBBLE_BOUNCE',p);
    }
    if(a.kind==='DRIVE'&&!a.resolved)effects.push({playerId:p.id,kind:'DRIVE'});
    if(a.kind==='EXCHANGE'&&a.target&&distance(p.position,a.target)>.03)continue;
    if(a.kind==='RECEIVE'&&(s.ball.flight?.receiverId===p.id||s.players.some(q=>q.action?.kind==='PASS'&&q.action.targetId===p.id&&!['COMPLETED','FAILED','INTERRUPTED'].includes(q.action.phase))))continue;
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
  const forward=goal(direction),d=distance(p.position,forward);
  return {x:p.position.x+(forward.x-p.position.x)/d*1.8,y:p.position.y+(forward.y-p.position.y)/d*Math.min(1.8,Math.max(.1,q.y-6.5))};
}
