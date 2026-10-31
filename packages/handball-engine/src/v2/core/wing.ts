import { courtPlayers,otherTeam,type CorePlayer,type CoreState,type Point } from './state';
import { clamp,distance,fieldLegal,laneClearance,local,world,shootingAngle,goal,wingCorner } from './space';

export const isWing=(p:CorePlayer)=>p.role==='LW'||p.role==='RW';
export function wingRelationship(s:CoreState,p:CorePlayer) {
  const left=p.role==='LW',direction=s.directions[p.team];
  const back=courtPlayers(s,p.team).find(q=>q.role===(left?'LB':'RB'))??null;
  const outer=courtPlayers(s,otherTeam(p.team)).find(q=>s.defence.marks[q.id]===p.id)??null;
  const carrier=s.ball.controllerId?s.players.find(q=>q.id===s.ball.controllerId):null;
  const ballSide=left?local(s.ball.position,direction).x<9:local(s.ball.position,direction).x>11;
  const connected=!!back&&ballSide&&(carrier?.id===back.id||distance(s.ball.position,back.position)<3);
  const pulledInside=!!outer&&(left?local(outer.position,direction).x>3.5:local(outer.position,direction).x<16.5);
  // The far wing pins width. The near wing offers outside the back's lane; it
  // does not follow the back inwards and consume the same attacking space.
  const corner=wingCorner(left?'LW':'RW',direction,p.radius);
  let target=corner,mode:'PIN_CORNER'|'OFFER_OUTSIDE'='PIN_CORNER';
  if(connected) {
    const backDepth=local(back!.position,direction).y;
    const depth=clamp(backDepth-6.5,2.2,3.4);
    const inset=p.radius+(pulledInside?1.15:.65);
    const offer=world({x:left?inset:20-inset,y:depth},direction);
    if(fieldLegal(offer,p.radius)&&laneClearance(s,back!.position,offer,p.team)>.45){target=offer;mode='OFFER_OUTSIDE';}
  }
  return {mode,target,back,outer,reason:mode==='PIN_CORNER'?'Pin the outside defender from the corner; preserve the adjacent back lane':'Offer the adjacent back an outside receiving lane while retaining width'};
}
/** A legal grounded approach window. No shot is resolved at this predicted point. */
export function wingTakeoffWindow(s:CoreState,p:CorePlayer):Point|null {
  const left=p.role==='LW',direction=s.directions[p.team],q=local(p.position,direction);
  const candidates=[2.2,2.6,3].flatMap(inset=>[2.8,3.2,3.6].map(depth=>world({x:left?inset:20-inset,y:depth},direction)))
    .filter(point=>fieldLegal(point,p.radius)&&distance(p.position,point)<=2.1&&laneClearance(s,p.position,point,p.team)>.4);
  candidates.sort((a,b)=>(shootingAngle(b,direction)-shootingAngle(a,direction))*10+distance(p.position,a)-distance(p.position,b));
  return q.y<8?candidates[0]??null:null;
}
export function defendWing(s:CoreState,d:CorePlayer,wing:CorePlayer):Point|null {
  if(local(wing.position,s.directions[wing.team]).y>8||!fieldLegal(wing.position,d.radius))return null;
  const g=goal(s.directions[wing.team]),length=distance(wing.position,g);
  let low=0,high=length;
  const along=(travel:number)=>({x:wing.position.x+(g.x-wing.position.x)*travel/length,y:wing.position.y+(g.y-wing.position.y)*travel/length});
  for(let i=0;i<20;i++){const mid=(low+high)/2;if(fieldLegal(along(mid),d.radius+.12))low=mid;else high=mid;}
  return along(d.duty.kind==='PRESSURE'?Math.min(low,.7):low);
}
