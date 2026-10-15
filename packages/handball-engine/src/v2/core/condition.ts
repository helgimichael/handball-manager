import { record,type CoreState,type CorePlayer } from './state';
import { awardRestart,interrupt } from './transitions';
import {physicalSpeedCapacity,physicalAccelerationCapacity,physicalExecutionCapacity,recoverPhysical,updatePhysicalCondition,type PhysicalLoadState} from './physicalLoad';

export type PlayerCondition={energy:number;acuteExertion?:number;physicalLoad?:PhysicalLoadState;distanceMetres:number;courtMs:number;unavailable:boolean;attacksRemaining:number;treatmentPossession:string|null;exitRequired:boolean};
export const initialCondition=():PlayerCondition=>({energy:1,distanceMetres:0,courtMs:0,unavailable:false,attacksRemaining:0,treatmentPossession:null,exitRequired:false});
export const movementCapacity=physicalSpeedCapacity;
const unit=(v:number)=>Math.max(0,Math.min(1,v));
/** Recent work is a physical memory, not another rating or a substitution bonus. */
export const fatigueLoad=(p:CorePlayer)=>p.kind==='GOALKEEPER'?0:(1-unit(p.condition.energy))**2;
/** First step, turning and repeated recovery lose more than cruising speed. */
export const accelerationCapacity=physicalAccelerationCapacity;
/** Execution cost is confined to the actual difficulty, pressure and moving body. */
export const difficultExecutionCapacity=physicalExecutionCapacity;
/** Fatigue changes execution, never the player's permanent attributes. */
export const executionCapacity=(p:CorePlayer)=>.8+.2*Math.max(0,Math.min(1,(p.condition.energy-.3)/.7));
/** A compressed career break represents rest without replaying empty ticks. */
export function recoverAtRest(p:CorePlayer,durationMs:number){
  if(p.kind==='GOALKEEPER')return; // Preserve the existing keeper calibration branch.
  recoverPhysical(p,Math.max(0,durationMs)/1000);
}
/** Workload/recovery coefficients are explicit simulation choices, not medical predictions. */
export function conditionAfter(s:CoreState) {
  for(const p of s.players) {
    const c=p.condition;
    if(c.attacksRemaining&&c.treatmentPossession!==s.possession.id) {
      if(c.treatmentPossession!==null){c.attacksRemaining--;if(!c.attacksRemaining)record(s,'TREATMENT_ELIGIBILITY_RESTORED',p);}
      c.treatmentPossession=c.attacksRemaining&&s.possession.team===p.team?s.possession.id:null;
    }
    const active=p.population==='COURT'&&s.officialClock.running&&!s.referee.timeout;
    const speed=active?Math.hypot(p.velocity.x,p.velocity.y):0;
    if(active){c.courtMs+=50;c.distanceMetres+=speed*.05;}
    // The same physical work costs a less enduring player more energy. This
    // is an explicit workload mapping, not an injury or turnover lottery.
    const endurance=Math.max(0,Math.min(1,p.profile.endurance));
    const resting=p.population!=='COURT'||s.match?.phase==='HALFTIME';
    if(p.kind==='FIELD_PLAYER'){updatePhysicalCondition(p,active,resting,!!s.referee.timeout,s.possession.phase==='TRANSITION'||p.duty.kind==='RETREAT');continue;}
    const recovery=p.kind==='GOALKEEPER'?.000025:resting?.00001*(.7+.3*endurance):s.referee.timeout?.000004:.000025;
    const effort=active?(.000003+speed*speed*.0000007)*(1.35-.7*endurance):-recovery;
    c.energy=Math.max(p.kind==='GOALKEEPER'?.3:.15,Math.min(1,c.energy-effort));
  }
}
/** External physical injury evidence enters here; no arbitrary per-tick injury lottery. */
export function requestTreatment(s:CoreState,p:CorePlayer,reason:string,options:{unableToContinue?:boolean;punishedOpponent?:boolean;keeperHeadHit?:boolean}={}) {
  if(s.status!=='RUNNING'||p.population!=='COURT'||s.referee.timeout||!s.match||!['FIRST_HALF','SECOND_HALF'].includes(s.match.phase))return false;
  const wasRunning=s.officialClock.running;
  if(s.ball.live)awardRestart(s,'FREE_THROW',s.possession.team,s.ball.position,'Medical interruption',null,false);
  interrupt(s,p,'Medical attention');
  p.condition.unavailable=options.unableToContinue??false;p.condition.exitRequired=true;
  p.condition.attacksRemaining=options.punishedOpponent||options.keeperHeadHit&&p.kind==='GOALKEEPER'?0:3;
  p.condition.treatmentPossession=s.possession.team===p.team?s.possession.id:null;
  s.referee.timeout={untilTick:s.tick+600,wasRunning,reason:'TREATMENT'};s.officialClock.running=false;
  record(s,'TREATMENT_STARTED',p,{reason,attacksRemaining:p.condition.attacksRemaining,unableToContinue:p.condition.unavailable});return true;
}
