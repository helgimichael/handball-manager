import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { courtPlayers, getPlayer, type CoreState, type CorePlayer, type Point } from './state';
import { distance } from './space';
import { fieldLegal,local } from './space';

/** The same spatial constraint governs preparation, authorised movement and release. */
export function freeThrowPositionLegal(s:CoreState,p:CorePlayer,position:Point=p.position):boolean {
  const r=s.restart!;const taker=getPlayer(s,r.takerId!);
  return p.team===r.owner?
    (p.kind==='GOALKEEPER'||goalAreaClearance(position,s.directions[r.owner])>s.ruleProfile.restartDistance+p.radius)&&
    (s.match?.phase!=='FINAL_THROW'||p.id===taker.id||distance(position,taker.position)>=3+p.radius):
    distance(position,taker.position)>=s.ruleProfile.restartDistance+p.radius;
}
export function throwInPositionLegal(s:CoreState,p:CorePlayer,position:Point=p.position):boolean {
  const r=s.restart!;const taker=getPlayer(s,r.takerId!);
  return p.team===r.owner||distance(position,taker.position)>=3+p.radius||goalAreaClearance(position,s.directions[r.owner])<.5;
}
export function authorisedRestartMovementLegal(s:CoreState,p:CorePlayer,position:Point):boolean {
  const r=s.restart;if(!r?.takerId||r.phase!=='AUTHORISED')return true;
  if(r.kind==='FREE_THROW')return freeThrowPositionLegal(s,p,position);
  if(r.kind==='THROW_IN')return throwInPositionLegal(s,p,position);
  return true;
}

/** Executable subset of IHF 2025 rules 7, 13 and 15. Checked again at release. */
export function freeThrowReady(s:CoreState):boolean {
  const r=s.restart;if(!r||r.kind!=='FREE_THROW'||!r.takerId)return false;
  const taker=getPlayer(s,r.takerId);
  return s.ball.controllerId===taker.id&&distance(taker.position,r.location)<.15&&
    courtPlayers(s).every(p=>freeThrowPositionLegal(s,p));
}
export function restartReady(s:CoreState):boolean {
  const r=s.restart;if(!r?.takerId)return false;
  const p=getPlayer(s,r.takerId);
  if(p.population!=='COURT'||p.airborne||s.ball.controllerId!==p.id||distance(p.position,s.ball.position)>.85)return false;
  const players=courtPlayers(s);
  if(r.kind==='FREE_THROW')return freeThrowReady(s);
  if(r.kind==='CENTRE_THROW_OFF') {
    if(distance(p.position,{x:10,y:20})+p.radius>2||distance(s.ball.position,{x:10,y:20})+.1>2)return false;
    return players.every(q=>q.team===r.owner?local(q.position,s.directions[r.owner]).y-q.radius>=20||distance(q.position,{x:10,y:20})+q.radius<=2:
      distance(q.position,{x:10,y:20})-q.radius>=2&&(r.context!=='OPENING_HALF'||local(q.position,s.directions[r.owner]).y+q.radius<=20));
  }
  if(r.kind==='GOALKEEPER_THROW')return p.kind==='GOALKEEPER'&&goalAreaClearance(p.position,s.directions[p.team==='HOME'?'AWAY':'HOME'])<-p.radius&&players.every(q=>q.kind==='GOALKEEPER'||fieldLegal(q.position,q.radius)||
    (q.position.x>=-.4&&q.position.x<.35&&s.exchanges.some(e=>e.phase!=='COMPLETED'&&(e.outId===q.id||e.inId===q.id)&&Math.abs(q.position.y-e.gate.y)<.5)));
  if(!r.plantedFoot||distance(p.position,r.location)>.65)return false;
  if(r.kind==='THROW_IN')return players.every(q=>throwInPositionLegal(s,q));
  return players.every(q=>{
    if(q.id===p.id)return true;
    if(q.kind==='GOALKEEPER')return q.team===r.owner||local(q.position,s.directions[r.owner]).y<4;
    return goalAreaClearance(q.position,s.directions[r.owner])>3+q.radius&&(q.team===r.owner||distance(q.position,p.position)>=3+q.radius);
  });
}
