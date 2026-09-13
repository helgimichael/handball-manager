import { courtPlayers, getPlayer, otherTeam, random, record, uid, type CoreContest, type CorePlayer, type CoreState, type Point } from './state';
import { distance, fieldLegal, goal, local, segmentPoint, shootingAngle } from './space';
import { acquire, awardRestart, checkpoint, foul, interrupt } from './transitions';
import type { ExecutionEffect } from './actions';
import { restartReady } from './rules';
import { completeRestart } from './restarts';
import { goalAreaClearance } from '../../domain/geometry/goalArea';

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
    const d=defenders.find(d=>(action.driveStart?.[d.id]??-1)>=0&&distance(a.position,d.position)<2.5&&local(a.position,s.directions[a.team]).y+.15<local(d.position,s.directions[a.team]).y);
    if(!d)return;
    action.resolved=true;
    const margin=local(d.position,s.directions[a.team]).y-local(a.position,s.directions[a.team]).y;
    const id=contest(s,'DUEL',a,d,'BEATEN',margin,32);d.beatenUntilTick=s.tick+32;interrupt(s,d,'Attacker physically crossed the defended shoulder');
    record(s,'DEFENDER_BEATEN',a,{untilTick:d.beatenUntilTick,attackerY:a.position.y,defenderY:d.position.y},[d.id],id);return;
  }
  const d=defenders.find(d=>distance(a.position,d.position)<1.6&&d.action?.phase==='EXECUTING'&&['PRESS','HELP','CONTAIN','CONTACT'].includes(d.action.kind));
  if(!d)return;
  action.resolved=true;
  const margin=a.attributes.skill-d.attributes.defence+(d.screenedUntilTick>s.tick?.3:0)+.15+(random(s)-.5)*.9;
  const wrongFooted=margin>0,id=contest(s,'DUEL',a,d,wrongFooted?'WRONG_FOOTED':'COMPOSED',margin,wrongFooted?16:0);
  if(wrongFooted){d.wrongFootedUntilTick=s.tick+16;interrupt(s,d,'Committed weight to the feint');}
  record(s,'FEINT_READ',a,{wrongFooted,untilTick:d.wrongFootedUntilTick},[d.id],id);
}
function release(s:CoreState,p:CorePlayer,kind:'PASS'|'SHOOT') {
  if(s.ball.controllerId!==p.id||!p.action){if(p.action)p.action.phase='FAILED';return;}
  const delivery=p.action.purpose==='DEAD_BALL_RETURN';
  if(!s.ball.live&&!delivery&&s.restart?.phase==='AUTHORISED'&&!restartReady(s)){p.action.phase='FAILED';s.status='FAILED';s.reason='Restart preparation invalid at release';record(s,'RESTART_FAILED',p,{reason:s.reason});return;}
  if(kind==='SHOOT'&&!p.airborne&&!fieldLegal(p.position,p.radius)) {awardRestart(s,'GOALKEEPER_THROW',otherTeam(p.team),p.position,'Illegal grounded shot in goal area',p);return;}
  if(p.airborne&&!fieldLegal(p.airborne.takeoff,p.radius)){awardRestart(s,'GOALKEEPER_THROW',otherTeam(p.team),p.position,'Illegal takeoff',p);return;}
  const receiver=kind==='PASS'&&p.action.targetId?getPlayer(s,p.action.targetId):null;
  if(kind==='PASS'&&(!receiver||receiver.team!==p.team||receiver.population!=='COURT')){p.action.phase='FAILED';record(s,'ACTION_FAILED',p,{reason:'Receiver unavailable'});return;}
  const direction=s.directions[p.team];
  let target:Point;
  if(receiver) {
    target={...receiver.position};
    // Lead a currently moving receiver using observable velocity and committed
    // movement extent. This predicts an intercept point, never future ownership.
    if(receiver.action?.phase==='EXECUTING'&&(receiver.action.kind==='RUN'||receiver.action.kind==='REPOSITION'))for(let i=0;i<3;i++) {
      const time=distance(s.ball.position,target)/12,v=receiver.velocity,speed=Math.hypot(v.x,v.y);
      const extent=receiver.action.target?distance(receiver.position,receiver.action.target):Infinity;
      const scale=speed>0?Math.min(time,extent/speed):0;
      target={x:receiver.position.x+v.x*scale,y:receiver.position.y+v.y*scale};
    }
  }
  else {
    const keeper=courtPlayers(s,otherTeam(p.team)).find(d=>d.kind==='GOALKEEPER');
    const pressure=courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind!=='GOALKEEPER'&&distance(d.position,p.position)<2&&d.beatenUntilTick<=s.tick).length;
    const preferred=keeper&&keeper.position.x>=10?9:11;
    const error=(random(s)-.5)*(1.1-p.attributes.skill+pressure*.3+Math.max(0,.3-shootingAngle(p.position,direction))*4);
    target={x:preferred+error,y:goal(direction).y};
  }
  const origin={...s.ball.position},d=distance(origin,target);if(d<.1){p.action.phase='FAILED';return;}
  const speed=kind==='PASS'?12:23;
  p.action.resolved=true;
  s.ball={...s.ball,mode:'RELEASE',height:p.airborne?2.3:1.5,controllerId:null,lastTouchId:p.id,
    flight:{kind:kind==='PASS'?'PASS':'SHOT',origin,velocity:{x:(target.x-origin.x)/d*speed,y:(target.y-origin.y)/d*speed},fromId:p.id,receiverId:receiver?.id??null,actionId:p.action.id,possessionId:s.possession.id,releasedTick:s.tick,height:p.airborne?2.3:1.5,goalSide:direction,touchedIds:[p.id],purpose:p.action.purpose}};
  if(kind==='SHOOT')p.nextAction='LAND';
  record(s,delivery?'BALL_RETURN_RELEASED':kind==='PASS'?'PASS_RELEASED':'SHOT_RELEASED',p,{x:origin.x,y:origin.y,height:s.ball.height,shotKind:p.action.shotKind??'NONE'},receiver?[receiver.id]:[]);
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
export function resolveScreens(s:CoreState) {
  for(const a of courtPlayers(s,s.possession.team).filter(p=>p.action?.kind==='SCREEN'&&p.action.phase==='EXECUTING')) {
    for(const d of courtPlayers(s,otherTeam(a.team)).filter(d=>d.kind!=='GOALKEEPER'&&distance(d.position,a.position)<.85&&d.screenedUntilTick<=s.tick&&Math.hypot(d.velocity.x,d.velocity.y)>.1)) {
      const id=contest(s,'SCREEN',a,d,'SCREENED',distance(a.position,d.position),18);d.screenedUntilTick=s.tick+18;record(s,'SCREEN_CONTACT',a,{untilTick:d.screenedUntilTick},[d.id],id);
    }
  }
}
function deflect(s:CoreState,p:CorePlayer,point:Point,type:string) {
  const f=s.ball.flight!;
  s.ball.position=point;s.ball.mode='DEFLECTION';s.ball.lastTouchId=p.id;
  f.kind='DEFLECTION';f.velocity={x:(random(s)-.5)*5,y:s.directions[p.team]==='TOP'?-4:4};f.touchedIds.push(p.id);f.releasedTick=s.tick;
  record(s,type,p,{},[f.fromId],null,f.actionId);
}
export function advanceBall(s:CoreState) {
  const f=s.ball.flight;if(!f||f.releasedTick===s.tick)return;
  const from={...s.ball.position},to={x:from.x+f.velocity.x*.05,y:from.y+f.velocity.y*.05};
  if(f.kind==='SHOT') {
    const total=distance(f.origin,{x:f.origin.x,y:goal(f.goalSide).y});
    const fraction=Math.min(1,distance(f.origin,to)/Math.max(.1,total));s.ball.height=f.height+(1.1-f.height)*fraction;
  }
  const candidates=courtPlayers(s).filter(p=>!f.touchedIds.includes(p.id)&&
    (f.purpose!=='DEAD_BALL_RETURN'||p.id===f.receiverId)&&
    (s.ball.live||p.team===getPlayer(s,f.fromId).team)).map(p=>{
    const hit=segmentPoint(from,to,p.position);
    const isKeeper=p.kind==='GOALKEEPER';
    const ready=p.action?.phase==='EXECUTING';
    const runningReceive=p.reception?.passActionId===f.actionId&&p.reception.readyTick<=s.tick&&['RUN','REPOSITION'].includes(p.action?.kind??'');
    const reach=f.kind==='SHOT'?(isKeeper?(ready&&p.action?.kind==='SAVE'?.9:.28):ready&&p.action?.kind==='BLOCK'?.8:0):ready&&(['RECEIVE','PRESS','HELP','CONTAIN'].includes(p.action?.kind??'')||runningReceive)?.65:0;
    return {p,...hit,hit:reach>0&&distance(hit.point,p.position)<=reach&&(isKeeper||s.ball.height<2.5)};
  }).filter(c=>c.hit).sort((a,b)=>a.t-b.t||a.p.id.localeCompare(b.p.id));
  for(const hit of candidates) {
    const p=hit.p,shooter=getPlayer(s,f.fromId);
    if(f.kind==='SHOT') {
      if(p.team===shooter.team)continue;
      if(p.kind==='GOALKEEPER') {
        const catchable=p.action?.kind==='SAVE'&&p.action.phase==='EXECUTING'&&distance(hit.point,p.position)<.5;
        contest(s,'KEEPER',shooter,p,catchable?'CAUGHT':'PARRIED',distance(hit.point,p.position),12,f.actionId);
        if(catchable){acquire(s,p,hit.point,'Goalkeeper catch',f.actionId);s.ball.live=false;awardRestart(s,'GOALKEEPER_THROW',p.team,p.position,'Keeper controls ball inside goal area',p);return;}
        deflect(s,p,hit.point,'SAVE_PARRY');return;
      }
      contest(s,'BLOCK',shooter,p,'DEFLECTED',distance(hit.point,p.position),12,f.actionId);deflect(s,p,hit.point,'SHOT_BLOCKED');return;
    }
    if(p.team===shooter.team&&p.action?.kind!=='RECEIVE'&&!(p.reception?.passActionId===f.actionId&&p.reception.readyTick<=s.tick&&['RUN','REPOSITION'].includes(p.action?.kind??'')))continue;
    if(p.kind==='GOALKEEPER'&&f.purpose!=='DEAD_BALL_RETURN')continue;
    if(p.team!==shooter.team)contest(s,'INTERCEPTION',shooter,p,'CONTROLLED',distance(hit.point,p.position),12,f.actionId);
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
  if(f.kind==='SHOT'&&((f.goalSide==='TOP'&&to.y<0)||(f.goalSide==='BOTTOM'&&to.y>40))) {
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
