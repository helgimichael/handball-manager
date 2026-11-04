import type {CorePlayer,Point} from './state';

/** Optional canonical match memory. Old sessions start from their current velocity.
 * Totals are read-only diagnostics; only velocity and acute exertion affect continuation.
 * Units: locomotor = integral(speed² dt), explosive = velocity change, contact =
 * equivalent engagement seconds, jump = takeoffs, all durations in seconds.
 */
export type PhysicalLoadState={locomotor:number;acceleration:number;deceleration:number;turning:number;contact:number;jump:number;highIntensitySeconds:number;repeatSeconds:number;transitionMetres:number;energyDemand:number;energySpent:number;energyRecovered:number;vx:number;vy:number};
export const unit=(v:number)=>Math.max(0,Math.min(1,v));
const memory=(p:CorePlayer):PhysicalLoadState=>p.condition.physicalLoad??=( {locomotor:0,acceleration:0,deceleration:0,turning:0,contact:0,jump:0,highIntensitySeconds:0,repeatSeconds:0,transitionMetres:0,energyDemand:0,energySpent:0,energyRecovered:0,vx:p.velocity.x,vy:p.velocity.y} );
const repeat=(p:CorePlayer)=>p.profile.physical?.repeatSprint??p.profile.endurance;
const acceleration=(p:CorePlayer)=>p.profile.physical?.acceleration??unit((p.profile.acceleration-3.6)/4);
const agility=(p:CorePlayer)=>p.profile.physical?.agility??.5;
const mobility=(p:CorePlayer)=>p.profile.physical?.mobility??.5;
export const reserveStrain=(p:CorePlayer)=>(1-unit(p.condition.energy))**2;
export function turningDemand(p:CorePlayer,target:Point|null):number {
  const speed=Math.hypot(p.velocity.x,p.velocity.y),dx=target?target.x-p.position.x:0,dy=target?target.y-p.position.y:0,d=Math.hypot(dx,dy);
  return speed>.3&&d>.01?unit(1-(p.velocity.x*dx+p.velocity.y*dy)/(speed*d)):0;
}
export function physicalSpeedCapacity(p:CorePlayer):number {
  if(p.kind==='GOALKEEPER')return .76+.24*p.condition.energy;
  return (1-.18*(1-unit(p.condition.energy)))*(1-.25*reserveStrain(p)*(.35+.65*unit(p.condition.acuteExertion??0))*(1-.5*p.profile.endurance));
}
export function physicalAccelerationCapacity(p:CorePlayer,turn=0):number {
  if(p.kind==='GOALKEEPER')return physicalSpeedCapacity(p);
  const acute=unit(p.condition.acuteExertion??0),strain=reserveStrain(p);
  const repeatLoss=strain*(.28+.85*acute)*(1.2-.65*repeat(p))*(1.1-.3*acceleration(p));
  const feet=agility(p)*.55+(p.profile.physical?.lateralQuickness??.5)*.30+mobility(p)*.15;
  return physicalSpeedCapacity(p)*(1-repeatLoss)*(1-unit(turn)*strain*(.18+.42*acute)*(1.15-.55*feet));
}
export function physicalExecutionCapacity(p:CorePlayer,difficulty:number,technique=.5,bodyDemand=0):number {
  const baseline=.8+.2*unit((p.condition.energy-.3)/.7);
  if(p.kind==='GOALKEEPER')return baseline;
  const loss=.68*reserveStrain(p)*unit(difficulty)*(.2+.8*unit(p.condition.acuteExertion??0))*(1.2-.55*repeat(p))*(1.25-.65*unit(technique))*(1-.2*p.profile.balance*unit(bodyDemand));
  return baseline*(1-loss);
}
function spend(p:CorePlayer,cost:number){const c=p.condition,l=memory(p),before=c.energy;l.energyDemand=(l.energyDemand??0)+Math.max(0,cost);c.energy=Math.max(.15,c.energy-Math.max(0,cost));l.energySpent+=before-c.energy;}
/** Only a real contact/takeoff calls this. No role, tactic, clock or score inputs. */
export function physicalImpulse(p:CorePlayer,channel:'contact'|'jump',amount=1){
  if(p.kind==='GOALKEEPER'||amount<=0)return;
  const l=memory(p),c=p.condition;
  l[channel]+=amount;
  const resistance=channel==='contact'?1.4-.65*p.profile.strength-.25*p.profile.balance:1.3-.5*(p.profile.physical?.jumping??.5)-.25*(p.profile.physical?.explosiveness??acceleration(p));
  spend(p,amount*(channel==='contact'?.0007:.0008)*resistance*(1+.25*unit(c.acuteExertion??0)*(1-repeat(p))));
  c.acuteExertion=unit((c.acuteExertion??0)+amount*(channel==='contact'?.018:.025)*(1.25-.5*repeat(p)));
}
/** No independent recovery attribute exists: endurance and repeat-sprint support
 * restoring readiness; mobility is used for braking/turn cost, never recovery. */
export function recoverySeconds(p:CorePlayer){return 14+18*(1-p.profile.endurance)+10*(1-repeat(p));}
/** HM-PLAYTEST-03: Accumulated match fatigue ceiling. Bench rest restores acute exertion,
 * but cannot erase accumulated match load. A player who has played heavy minutes cannot return to 100%. */
export function matchFatigueCeiling(p:CorePlayer):number {
  if(p.kind==='GOALKEEPER')return 1;
  const c=p.condition,endurance=p.profile.endurance??.5;
  const minutes=(c.courtMs??0)/60000;
  const timeFatigue=(minutes/60)*(0.30-0.12*endurance);
  const distanceFatigue=Math.min(0.12,((c.distanceMetres??0)/5000)*0.10*(1.2-0.4*endurance));
  return Math.max(0.60,unit(1.0-timeFatigue-distanceFatigue));
}
export function recoverPhysical(p:CorePlayer,seconds:number,rate=.0002,timeout=false){
  if(p.kind==='GOALKEEPER')return;
  const c=p.condition,l=memory(p),before=c.energy;
  const ceiling=matchFatigueCeiling(p);
  if(c.energy<ceiling){
    const recovered=Math.max(0,seconds)*rate*(.7+.3*p.profile.endurance);
    c.energy=Math.min(ceiling,c.energy+recovered);
    l.energyRecovered+=c.energy-before;
  }
  c.acuteExertion=unit((c.acuteExertion??0)*Math.exp(-Math.max(0,seconds)/(timeout?90+recoverySeconds(p):recoverySeconds(p))));
  l.vx=0;l.vy=0;
}
export function updatePhysicalCondition(p:CorePlayer,active:boolean,resting:boolean,timeout:boolean,transition:boolean){
  const c=p.condition,l=memory(p),dt=.05;
  // Retain v1's distinct bench, timeout and ordinary stopped-clock windows.
  if(!active){recoverPhysical(p,dt,resting?.0002:timeout?.00008:.0005,timeout);return;}
  const vx=p.velocity.x,vy=p.velocity.y,speed=Math.hypot(vx,vy),oldSpeed=Math.hypot(l.vx,l.vy);
  const gain=Math.max(0,speed-oldSpeed),brake=Math.max(0,oldSpeed-speed),turn=Math.max(0,Math.hypot(vx-l.vx,vy-l.vy)-gain-brake);
  l.vx=vx;l.vy=vy;l.locomotor+=speed*speed*dt;l.acceleration+=gain;l.deceleration+=brake;l.turning+=turn;
  if(transition)l.transitionMetres+=speed*dt;
  const relative=speed/Math.max(1,p.profile.topSpeed),burst=unit((gain+brake+turn)/Math.max(.01,p.profile.acceleration*dt));
  const work=unit(relative*relative*.8+burst*.55);
  const acute=unit(c.acuteExertion??0),tau=work>acute?12+18*repeat(p):recoverySeconds(p);
  c.acuteExertion=unit(acute+(work-acute)*(1-Math.exp(-dt/tau)));
  if(relative>.7||burst>.55){l.highIntensitySeconds+=dt;if(acute>.35)l.repeatSeconds+=dt;}
  const locomotor=dt*(.000065+speed*speed*.000015)*(1.45-.85*p.profile.endurance);
  // Velocity changes accumulate thousands of small corrections in a match;
  // their reserve cost is additional to, not a second copy of, running cost.
  const explosive=gain*.000009*(1.3-.6*acceleration(p))+brake*.000006*(1.25-.5*mobility(p))+turn*.000015*(1.3-.6*agility(p));
  spend(p,(locomotor+explosive)*(1+.25*acute*(1-repeat(p))));
}
