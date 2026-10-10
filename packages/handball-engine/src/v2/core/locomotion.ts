import type { Point } from './state';
/** Shared physical steering for integration and observable receiver projection. */
export function steerVelocity(position:Point,velocity:Point,target:Point|null,topSpeed:number,acceleration:number,dt=.05):Point {
  const d=target?Math.hypot(target.x-position.x,target.y-position.y):0;
  const pace=target?Math.min(topSpeed,Math.sqrt(2*acceleration*d),d*4):0;
  const desired=d>1e-8&&target?{x:(target.x-position.x)/d*pace,y:(target.y-position.y)/d*pace}:{x:0,y:0};
  const delta={x:desired.x-velocity.x,y:desired.y-velocity.y},change=Math.hypot(delta.x,delta.y);
  const fraction=change>0?Math.min(1,acceleration*dt/change):0;
  return {x:velocity.x+delta.x*fraction,y:velocity.y+delta.y*fraction};
}
export function projectMotion(position:Point,velocity:Point,target:Point|null,topSpeed:number,acceleration:number,seconds:number):Point {
  let at={...position},pace={...velocity},left=seconds;
  while(left>1e-8){const dt=Math.min(.05,left);pace=steerVelocity(at,pace,target,topSpeed,acceleration,dt);at={x:at.x+pace.x*dt,y:at.y+pace.y*dt};left-=dt;}
  return at;
}
