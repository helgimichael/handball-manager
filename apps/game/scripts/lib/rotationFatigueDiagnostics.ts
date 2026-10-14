/** Read-only developer observation; no production imports or RNG calls. */
import type {CoreState,CoreEvent,CorePlayer} from '@handball-manager/handball-engine/src/v2/core/state';
import {accelerationCapacity} from '@handball-manager/handball-engine/src/v2/core/condition';
type Segment={samples:number;energySum:number;acuteSum:number;minEnergy:number;severeSamples:number;accelerationSum:number;recoverySamples:number;recoverySpeedSum:number;recoveryAccelerationSum:number;actions:number;highIntensityActions:number;shots:number;penalties:number;goals:number;errors:number;fouls:number;suspensions:number;transitionShots:number;pressureSum:number;qualitySum:number;recoveryCompletions:number;recoveryTicks:number};
const empty=():Segment=>({samples:0,energySum:0,acuteSum:0,minEnergy:1,severeSamples:0,accelerationSum:0,recoverySamples:0,recoverySpeedSum:0,recoveryAccelerationSum:0,actions:0,highIntensityActions:0,shots:0,penalties:0,goals:0,errors:0,fouls:0,suspensions:0,transitionShots:0,pressureSum:0,qualitySum:0,recoveryCompletions:0,recoveryTicks:0});
export class RotationFatigueDiagnostics {
 players:Record<string,{id:string;team:string;role:string;segments:Segment[]}>= {};starts=new Map<string,number>();lastSample=-1;
 observe(s:Readonly<CoreState>,events:readonly CoreEvent[]){
  const segment=Math.min(3,Math.floor(Math.max(0,s.officialClock.timeMs-1)/900000));
  const row=(p:CorePlayer)=>this.players[p.id]??=( {id:p.id,team:p.team,role:p.role,segments:Array.from({length:4},empty)});
  if(s.officialClock.running&&!s.referee.timeout&&Math.floor(s.officialClock.timeMs/1000)!==this.lastSample){
   this.lastSample=Math.floor(s.officialClock.timeMs/1000);
   for(const p of s.players.filter(p=>p.population==='COURT'&&p.kind==='FIELD_PLAYER')){const r=row(p).segments[segment];r.samples++;r.energySum+=p.condition.energy;r.acuteSum+=p.condition.acuteExertion??0;r.minEnergy=Math.min(r.minEnergy,p.condition.energy);r.severeSamples+=Number(p.condition.energy<.3);r.accelerationSum+=accelerationCapacity(p);
    if(['HELP','RECOVER','RETREAT'].includes(p.duty.kind)){r.recoverySamples++;r.recoverySpeedSum+=Math.hypot(p.velocity.x,p.velocity.y);r.recoveryAccelerationSum+=p.profile.acceleration*accelerationCapacity(p);}
   }
  }
  for(const e of events){const p=s.players.find(p=>p.id===e.actorId);if(!p||p.kind!=='FIELD_PLAYER')continue;const r=row(p).segments[segment],kind=String(e.details.kind??'');
   if(e.type==='ACTION_STARTED'){r.actions++;if(['DRIVE','DRIBBLE','JUMP','SHOOT','SCREEN','CONTACT','BLOCK'].includes(kind))r.highIntensityActions++;if(['RECOVER','HELP'].includes(kind))this.starts.set(e.actionId??'',s.tick);}
   if(e.type==='ACTION_PHASE'&&e.details.phase==='COMPLETED'&&this.starts.has(e.actionId??'')){r.recoveryCompletions++;r.recoveryTicks+=s.tick-this.starts.get(e.actionId??'')!;this.starts.delete(e.actionId??'');}
   if(e.type==='SHOT_RELEASED'){r.shots++;r.penalties+=Number(e.details.shotKind==='SEVEN_METRE');r.transitionShots+=Number(e.details.phase==='TRANSITION');r.pressureSum+=Number(e.details.pressure??0);r.qualitySum+=Number(e.details.opportunityQuality??0);}
   if(e.type==='GOAL')r.goals++;
   if(e.type==='RECEPTION_FAILED')r.errors++;
   if(e.type==='FOUL_ASSESSED')r.fouls++;
   if(e.type==='TWO_MINUTE_SUSPENSION')r.suspensions++;
  }
 }
 report(s:Readonly<CoreState>){return {schema:'rotation-fatigue-diagnostics/1',sampling:'one official second while on court; no timeout samples; severe diagnostic <30% is not gameplay logic',segments:['0-15','15-30','30-45','45-60'],players:Object.values(this.players).map(p=>({...p,final:s.players.find(q=>q.id===p.id)?.condition,segments:p.segments.map(r=>({...r,meanEnergy:r.samples?r.energySum/r.samples:null,meanAcute:r.samples?r.acuteSum/r.samples:null,meanAccelerationCapacity:r.samples?r.accelerationSum/r.samples:null,meanRecoverySpeed:r.recoverySamples?r.recoverySpeedSum/r.recoverySamples:null,meanRecoveryAcceleration:r.recoverySamples?r.recoveryAccelerationSum/r.recoverySamples:null,meanRecoverySeconds:r.recoveryCompletions?r.recoveryTicks*.05/r.recoveryCompletions:null,fieldAttempts:r.shots-r.penalties,meanPressure:r.shots?r.pressureSum/r.shots:null,meanOpportunityQuality:r.shots?r.qualitySum/r.shots:null}))})),exchanges:s.exchanges.filter(e=>e.phase==='COMPLETED'),notes:'Recovery speed is observed movement, acceleration is functional capability, and action completion times are not a geometry-normalized trial. Errors are supported named event counts, not all turnover causes.'};}
}
