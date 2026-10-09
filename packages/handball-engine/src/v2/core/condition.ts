import { record,type CoreState,type CorePlayer } from './state';
import { awardRestart,interrupt } from './transitions';

export type PlayerCondition={energy:number;distanceMetres:number;courtMs:number;unavailable:boolean;attacksRemaining:number;treatmentPossession:string|null;exitRequired:boolean};
export const initialCondition=():PlayerCondition=>({energy:1,distanceMetres:0,courtMs:0,unavailable:false,attacksRemaining:0,treatmentPossession:null,exitRequired:false});
export const movementCapacity=(p:CorePlayer)=>.76+.24*p.condition.energy;
/** Fatigue changes execution, never the player's permanent attributes. */
export const executionCapacity=(p:CorePlayer)=>.8+.2*Math.max(0,Math.min(1,(p.condition.energy-.3)/.7));
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
    const effort=active?(.000003+speed*speed*.0000007)*(1.35-.7*endurance):-.000025;
    c.energy=Math.max(.3,Math.min(1,c.energy-effort));
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
