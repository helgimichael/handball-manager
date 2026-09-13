import { goalAreaClearance } from '../../domain/geometry/goalArea';
import { distanceBetween } from '../../domain/geometry/coordinates';
import { courtPlayers, type CoreState, type CorePlayer, type Direction, type Point, type TeamId } from './state';
export const distance = distanceBetween;
export const clamp = (n: number, min: number, max: number) => Math.max(min,Math.min(max,n));
export const local = (p: Point, direction: Direction): Point => ({x:p.x,y:direction==='TOP'?p.y:40-p.y});
export const world = local;
export const goal = (direction: Direction): Point => ({x:10,y:direction==='TOP'?0:40});
export function fieldLegal(p: Point, radius=.28): boolean {
  return p.x>=radius && p.x<=20-radius && p.y>=radius && p.y<=40-radius && goalAreaClearance(p,'TOP')>radius && goalAreaClearance(p,'BOTTOM')>radius;
}
/** Move a target away from the curved area while retaining its lateral lane. */
export function clearGoalArea(point:Point,direction:Direction,clearance:number):Point {
  if(goalAreaClearance(point,direction)>clearance)return {...point};
  const q=local(point,direction);let low=q.y,high=20;
  for(let i=0;i<24;i++){const mid=(low+high)/2;if(goalAreaClearance(world({x:q.x,y:mid},direction),direction)>clearance)high=mid;else low=mid;}
  return world({x:q.x,y:high},direction);
}
export function segmentPoint(a: Point,b: Point,p: Point) {
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den===0?0:clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/den,0,1);
  return {point:{x:a.x+t*dx,y:a.y+t*dy},t};
}
export function laneClearance(s: CoreState, from: Point,to: Point, team: TeamId): number {
  let clearance=10;
  for(const p of courtPlayers(s)) if(p.team!==team && p.kind!=='GOALKEEPER') {
    const segment=segmentPoint(from,to,p.position);
    if(segment.t>.05&&segment.t<.98) clearance=Math.min(clearance,distance(p.position,segment.point)-p.radius);
  }
  return clearance;
}
export function shootingAngle(p: Point,direction: Direction) {
  const q=local(p,direction);
  const left=Math.atan2(8.5-q.x,q.y),right=Math.atan2(11.5-q.x,q.y);
  return Math.abs(right-left);
}
export function goalSide(s: CoreState,defender: CorePlayer,attacker: CorePlayer) {
  const direction=s.directions[attacker.team];
  return local(defender.position,direction).y<local(attacker.position,direction).y;
}
export function numericalAdvantage(s: CoreState,p: CorePlayer,radius=5) {
  return courtPlayers(s).filter(q=>q.kind!=='GOALKEEPER'&&distance(q.position,p.position)<radius).reduce((n,q)=>n+(q.team===p.team?1:-1),0);
}
export function corridor(p: Point): string {return p.x<3||p.x>17?'WING':p.x<8||p.x>12?'HALF_SPACE':'CENTRE';}
/** Width belongs to the corner outside the goal-area/end-line junction, not the central 6 m depth. */
export function wingCorner(role:'LW'|'RW',direction:Direction,radius=.28):Point {
  const sidelineInset=radius+.4;
  return world({x:role==='LW'?sidelineInset:20-sidelineInset,y:radius+1.15},direction);
}
export function structurePoint(role: CorePlayer['role'],direction: Direction,ballX=10): Point {
  if(role==='LW'||role==='RW')return wingCorner(role,direction);
  const shift=clamp((ballX-10)*.15,-.9,.9);
  const anchors: Record<Exclude<CorePlayer['role'],'LW'|'RW'>,Point>={LB:{x:5.1,y:10.8},CB:{x:10,y:11.5},RB:{x:14.9,y:10.8},P:{x:10.6,y:6.65},P2:{x:8,y:6.8},GK:{x:10,y:38.5}};
  const a=anchors[role];return world({x:a.x+shift,y:a.y},direction);
}
