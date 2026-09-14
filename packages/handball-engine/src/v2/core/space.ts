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
    // Backs work at nine to ten metres, which is where a backcourt shot is
  // actually taken. They used to stand at eleven and a half, a metre and a half
  // further out than any real attack sets up, and against a defence that
  // genuinely holds its line that difference is the whole backcourt threat.
  const anchors: Record<Exclude<CorePlayer['role'],'LW'|'RW'>,Point>={LB:{x:5.1,y:9.6},CB:{x:10,y:10.2},RB:{x:14.9,y:9.6},P:{x:10.6,y:6.65},P2:{x:8,y:6.8},GK:{x:10,y:38.5}};
  const a=anchors[role];return world({x:a.x+shift,y:a.y},direction);
}

/**
 * How good is this shot, from zero to one.
 *
 * Shot selection was the weakest link once the defence started working: the old
 * gate asked only for a depth under 13.5 m and an angle over 0.13, so a poor
 * shooter fired from thirteen metres into a set goalkeeper and the match filled
 * with saves. Quality is the honest question, and it is made of four things a
 * player can actually perceive: how far out he is, how much of the goal he can
 * see, how much of it a body is covering, and what he himself can do with a
 * ball. A shooting back and a wing arrive at very different answers from the
 * same spot, which is the point.
 */
export function shotQuality(s: CoreState, p: CorePlayer, pressure: number): number {
  const direction=s.directions[p.team];
  const q=local(p.position,direction),angle=shootingAngle(p.position,direction);
  const wide=Math.abs(q.x-10)>6.5;
  // Nine metres is the free-throw line: a shot from there is ordinary, one from
  // six is good, one from thirteen needs a reason.
  // Distance to the goal itself, not depth: a wing standing three metres from
  // the end line is still eight and a half metres from the goal, and treating
  // him as a six-metre shooter is what filled the match with wing shots.
  const range=clamp((14-distance(p.position,goal(direction)))/7,0,1);
  const sight=clamp((angle-.10)/.35,0,1);
  const ability=wide?p.profile.wingFinishing*.65+p.profile.shotPlacement*.35
    :p.profile.shotPower*.45+p.profile.shotPlacement*.35+p.profile.finishing*.2;
  const contested=clamp(1-pressure*.32,0,1);
  // POSSESSION ECOLOGY: exploiting an advantage is most of what a shot IS.
  //
  // A back who has beaten his man, screened him out or drawn him away has
  // created the shot, and the engine had no way to say so: quality was read off
  // geometry and ability alone, so the backcourt never took the chance it had
  // just manufactured. Over ten matches the line player and the two wings
  // scored 552 goals and the entire backcourt scored 82.
  const opponent=courtPlayers(s,p.team==='HOME'?'AWAY':'HOME');
  const owner=opponent.find(d=>s.defence.marks[d.id]===p.id)??opponent.find(d=>d.id===s.defence.pressureId);
  const committed=owner!==undefined&&(owner.beatenUntilTick>s.tick||owner.screenedUntilTick>s.tick||owner.wrongFootedUntilTick>s.tick);
  const separated=owner===undefined?1:clamp((distance(owner.position,p.position)-.9)/2.4,0,1);
  const advantage=committed?1:separated;
  const base=range*.28+sight*.22+ability*.26+contested*.10+advantage*.14;
  // Seeing the goal is not one ingredient among four; it gates the whole shot.
  // A ball struck from an angle nobody can score from is not a poor shot, it is
  // not a shot, and that is the difference between a wing who finishes and a
  // wing who shoots from everywhere.
  return base*(.55+.45*sight);
}

/**
 * Where a goalkeeper stands to cover the goal from a ball at `from`.
 *
 * The principled answer, and the one that removes a tuning knob: he stands on
 * the bisector of the angle the two posts subtend from the ball, at his own
 * working depth. That single rule covers a centre back at ten metres and a wing
 * in the corner without a separate case for either, because narrowing the angle
 * IS the job. A linear fraction of the ball's lateral offset was standing in for
 * it, and no single fraction can be right for both.
 */
export function keeperPost(from: Point, direction: Direction, depth: number): Point {
  const line = goal(direction).y;
  const near = { x: 8.5, y: line }, far = { x: 11.5, y: line };
  const unit = (to: Point) => {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  };
  const a = unit(near), b = unit(far);
  const bx = a.x + b.x, by = a.y + b.y;
  const length = Math.hypot(bx, by);
  // Degenerate only when the ball is on the goal line between the posts.
  if (length < 1e-6) return { x: clamp(from.x, 8.5, 11.5), y: line + (direction === 'TOP' ? depth : -depth) };
  const target = line + (direction === 'TOP' ? depth : -depth);
  const t = (target - from.y) / (by / length);
  const x = from.x + (bx / length) * t;
  return { x: clamp(x, 5.5, 14.5), y: target };
}
