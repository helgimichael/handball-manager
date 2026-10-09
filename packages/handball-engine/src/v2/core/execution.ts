// Execution uncertainty follows the actual throw/catch problem. These are
// engineering coefficients, not event-rate targets or a turnover lottery.
import { courtPlayers, otherTeam, random, type CorePlayer, type CoreState, type Point } from './state';
import { clamp, distance, laneClearance } from './space';
import { executionCapacity } from './condition';

export function releasePressure(s:CoreState,p:CorePlayer):number {
  return clamp(courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind==='FIELD_PLAYER'&&d.beatenUntilTick<=s.tick&&d.screenedUntilTick<=s.tick)
    .reduce((n,d)=>n+Math.max(0,1-distance(p.position,d.position)/2)*(d.action?.kind==='CONTACT'?1.2:.7),0),0,2);
}

export type PassExecution = { target:Point; speed:number; difficulty:number; spread:number; pressure:number; error:number; capability:number };
export function executePass(s:CoreState,p:CorePlayer,receiver:CorePlayer,intended:Point,protectedReturn=false):PassExecution {
  const origin=s.ball.position,range=distance(origin,intended);
  const capacity=executionCapacity(p),capability=p.profile.passing*capacity;
  const speed=(10.5+3*p.profile.passing)*(.9+.1*capacity);
  const pressure=releasePressure(s,p);
  const movement=clamp(Math.hypot(receiver.velocity.x,receiver.velocity.y)/Math.max(1,receiver.profile.topSpeed),0,1);
  const separation=Math.min(6,...courtPlayers(s,otherTeam(p.team)).filter(d=>d.kind==='FIELD_PLAYER').map(d=>distance(d.position,intended)));
  const contested=clamp((1.4-separation)/1.4,0,1);
  const lane=laneClearance(s,origin,intended,p.team);
  const urgency=clamp((s.tick-p.handling.heldSinceTick)*50/s.ruleProfile.maxHoldMs-.6,0,.4);
  const difficulty=clamp(clamp((range-6)/18,0,1)*.35+pressure*.2+movement*.15+contested*.2+clamp((.8-lane)/.8,0,1)*.25+urgency*.25,0,1);
  const spread=protectedReturn?0:.025+(1-capability)*(.18+1.65*difficulty);
  if(!spread||range<.1)return {target:{...intended},speed,difficulty,spread,pressure,error:0,capability};
  const ux=(intended.x-origin.x)/range,uy=(intended.y-origin.y)/range;
  const cross=(random(s)*2-1)*spread,along=(random(s)*2-1)*spread*.35;
  // Do not clamp the executed throw back into a successful lane. A bad throw
  // can be recovered, intercepted or go out through the ordinary ball physics.
  return {target:{x:intended.x-uy*cross+ux*along,y:intended.y+ux*cross+uy*along},speed,difficulty,spread,pressure,error:Math.hypot(cross,along),capability};
}

export function receptionRisk(s:CoreState,p:CorePlayer,point:Point,pace:number):number {
  const pressure=releasePressure(s,p)/2;
  const alignment=clamp(distance(p.position,point)/.65,0,1);
  const moving=clamp(Math.hypot(p.velocity.x,p.velocity.y)/Math.max(1,p.profile.topSpeed),0,1);
  const difficulty=pressure*.45+clamp((pace-9)/9,0,1)*.16+alignment*.25+moving*.1;
  const control=(p.profile.handling*.8+p.profile.composure*.2)*executionCapacity(p);
  return clamp(Math.max(0,difficulty-.18)*(1-control)*.55,0,.4);
}

/** The shooter chooses a reachable corner; execution can still miss it. */
export function shotHeight(s:CoreState,p:CorePlayer,placement:number,pressure:number):number {
  const keeper=courtPlayers(s,otherTeam(p.team)).find(d=>d.kind==='GOALKEEPER')?.profile.keeper;
  const read=p.profile.decision*p.profile.composure;
  const lowPreference=clamp(.5+((keeper?.high??.5)-(keeper?.low??.5))*read*.6,.2,.8);
  const low=random(s)<lowPreference;
  const intended=low?.3+.45*(1-placement):1.7-.45*(1-placement);
  // This scoped trajectory has no vertical bounce integrator. Low executions
  // stay above the floor; inaccurate high executions can cross the crossbar.
  return Math.max(.12,intended+(random(s)-.5)*(1.1-placement)*(1+pressure*.3));
}
