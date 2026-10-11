import type { Point } from './state';
/** Shared physical steering for integration and observable receiver projection. */
export function steerVelocity(position:Point,velocity:Point,target:Point|null,topSpeed:number,acceleration:number,dt=.05):Point {
  const d=target?Math.hypot(target.x-position.x,target.y-position.y):0;
  const ux=target&&d>1e-8?(target.x-position.x)/d:0,uy=target&&d>1e-8?(target.y-position.y)/d:0;
  // Retain V2's longitudinal pace recipe. Steering changes the velocity
  // continuously instead of replacing its heading or resetting it at arrival.
  const carried=Math.max(0,velocity.x*ux+velocity.y*uy);
  const pace=target?Math.min(topSpeed,carried+acceleration*dt,Math.sqrt(2*acceleration*d),d/dt):0;
  const desired=d>1e-8&&target?{x:(target.x-position.x)/d*pace,y:(target.y-position.y)/d*pace}:{x:0,y:0};
  const delta={x:desired.x-velocity.x,y:desired.y-velocity.y},change=Math.hypot(delta.x,delta.y);
  const oldSpeed=Math.hypot(velocity.x,velocity.y);
  // Sprint acceleration and braking/lateral redirection are different tasks.
  // A bounded stronger brake prevents a following defender sailing past his
  // moving reference, while forward acceleration retains the attribute model.
  const braking=pace<oldSpeed||oldSpeed>1e-8&&d>1e-8&&(velocity.x*desired.x+velocity.y*desired.y)<oldSpeed*pace*.98;
  const fraction=change>0?Math.min(1,acceleration*(braking?2:1)*dt/change):0;
  const next={x:velocity.x+delta.x*fraction,y:velocity.y+delta.y*fraction};
  // A changing tactical pace is a desired ceiling, not permission to discard
  // existing momentum. Brake down to it within the same physical budget.
  const speed=Math.hypot(next.x,next.y),limit=Math.min(Math.max(topSpeed,oldSpeed-2*acceleration*dt),oldSpeed+acceleration*dt);
  return speed>limit&&speed>0?{x:next.x*limit/speed,y:next.y*limit/speed}:next;
}
export function projectMotion(position:Point,velocity:Point,target:Point|null,topSpeed:number,acceleration:number,seconds:number):Point {
  let at={...position},pace={...velocity},left=seconds;
  while(left>1e-8){
    const dt=Math.min(.05,left);pace=steerVelocity(at,pace,target,topSpeed,acceleration,dt);
    // Receiver/support destinations are soft. Integrate retained momentum
    // through bounded braking rather than clipping travel to the reference.
    at={x:at.x+pace.x*dt,y:at.y+pace.y*dt};left-=dt;
  }
  return at;
}
