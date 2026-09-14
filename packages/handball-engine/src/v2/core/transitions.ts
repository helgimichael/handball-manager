import { getPlayer,otherTeam, record, uid, type CorePlayer, type CoreState, type Restart, type Point } from './state';
import { distance, local, world } from './space';
import { judgeFoul } from './referee';
import type { Severity } from './sanction';

export function interrupt(s: CoreState,p: CorePlayer,reason: string) {
  if(p.action&&!['COMPLETED','FAILED','INTERRUPTED'].includes(p.action.phase)) {
    p.action.phase='INTERRUPTED';p.action.phaseTick=s.tick;record(s,'ACTION_INTERRUPTED',p,{reason});
  }
  p.velocity={x:0,y:0};p.nextAction=null;
}
export function checkpoint(s: CoreState,outcome: string) {
  s.checkpoint.outcome=outcome;
  if(s.flow.lastOutcomeTick!==s.tick){s.flow.lastOutcomeTick=s.tick;s.flow.outcomes++;}
  if(s.checkpoint.stopOnOutcome||(s.flow.stopAfter!==null&&s.flow.outcomes>=s.flow.stopAfter)){s.status='CHECKPOINT';s.reason=outcome;}
}
export function awardRestart(s: CoreState,kind: Restart['kind'],owner: CorePlayer['team'],where: Point,reason: string,actor: CorePlayer|null=null,countOutcome=true) {
  for(const p of s.players){interrupt(s,p,reason);p.support=null;p.zone=null;}
  const holder=s.ball.controllerId&&getPlayer(s,s.ball.controllerId).team===owner?s.ball.controllerId:null;
  s.ball={...s.ball,mode:'DEAD',controllerId:holder,flight:null,live:false,height:holder?1.2:0};
  let location={...where};
  if(kind==='FREE_THROW') {const q=local(location,s.directions[owner]);location=world({x:Math.max(.3,Math.min(19.7,q.x)),y:Math.max(9.5,q.y)},s.directions[owner]);}
  if(kind==='SEVEN_METRE')location=world({x:10,y:7},s.directions[owner]);
  if(kind==='GOALKEEPER_THROW')location=world({x:10,y:2},s.directions[otherTeam(owner)]);
  if(kind==='CENTRE_THROW_OFF')location={x:10,y:20};
  s.restart={id:uid(s,'restart'),kind,owner,location,awardedTick:s.tick,pausedTicks:0,phase:'AWARDED',takerId:null,authorisedTick:null,collectorId:null,receiverId:null,context:kind==='CENTRE_THROW_OFF'?'POST_GOAL':null,plantedFoot:null};
  if(s.possession.team!==owner){const previous=s.possession.id;s.possession={id:uid(s,'possession'),team:owner,sinceTick:s.tick,phase:'RESTART',completedPasses:0,lastPasserId:null};s.defence={...s.defence,team:otherTeam(owner),marks:{},pressureId:null,helperId:null,read:{engaged:null,shift:0,compact:1}};record(s,'POSSESSION_AWARDED',null,{owner,previous});}
  s.possession.phase='RESTART';
  record(s,'RESTART_AWARDED',actor,{kind,owner,reason,x:location.x,y:location.y});
  if(countOutcome)checkpoint(s,kind);
}
export function changePossession(s: CoreState,player: CorePlayer,reason: string) {
  if(s.possession.team===player.team)return;
  for(const p of s.players){p.support=null;p.zone=null;}
  const previous=s.possession.id;
  s.possession={id:uid(s,'possession'),team:player.team,sinceTick:s.tick,phase:'TRANSITION',completedPasses:0,lastPasserId:null};
  s.defence={team:otherTeam(player.team),system:s.coaching[otherTeam(player.team)].defence,marks:{},pressureId:null,helperId:null,lastHandoverTick:s.tick,handover:null,read:{engaged:null,shift:0,compact:1}};
  record(s,'POSSESSION_CHANGED',player,{previous,reason});
}
/** Called only by swept physical interaction resolution, never by the selector. */
export function acquire(s: CoreState,p: CorePlayer,point: Point,reason: string,sourceActionId: string|null=null) {
  if(distance(point,p.position)>.85)throw new Error('Nonphysical acquisition');
  const turnover=s.ball.live&&s.possession.team!==p.team;
  if(s.ball.live)changePossession(s,p,reason);
  s.ball={...s.ball,position:{...point},mode:p.kind==='GOALKEEPER'?'GOALKEEPER_CONTROL':'RECEPTION',height:1.2,controllerId:p.id,flight:null,lastTouchId:p.id};
  p.handling={heldSinceTick:s.tick,steps:0,stepDistance:0,dribbleUsed:false,bounceTick:s.tick};
  p.reception=null;p.support=null;
  interrupt(s,p,'Ball controlled through contact');
  record(s,'BALL_CONTROLLED',p,{reason},[],null,sourceActionId);
  if(turnover)checkpoint(s,'TURNOVER');
}
export function foul(s: CoreState,attacker: CorePlayer,defender: CorePlayer,severity: Severity,reason: string,clearChance: boolean,contestId: string) {
  judgeFoul(s,attacker,defender,severity,reason,clearChance,contestId);
}
