/** Read-only developer observation. No production imports, state writes or RNG. */
import type {CoreState,CorePlayer,CoreEvent} from '@handball-manager/handball-engine/src/v2/core/state';
import {RotationFatigueDiagnostics} from './rotationFatigueDiagnostics';
import {accelerationCapacity} from '@handball-manager/handball-engine/src/v2/core/condition';
const channels=['locomotor','acceleration','deceleration','turning','contact','jump','highIntensitySeconds','repeatSeconds','transitionMetres','energyDemand','energySpent','energyRecovered'] as const;
const empty=()=>Object.fromEntries(channels.map(k=>[k,0])) as Record<typeof channels[number],number>;
type Band='READY'|'MODERATE'|'SEVERE';
const band=(p:CorePlayer):Band=>p.condition.energy>=.7&&(p.condition.acuteExertion??0)<.35?'READY':p.condition.energy<.3||p.condition.energy<.4&&(p.condition.acuteExertion??0)>.35?'SEVERE':'MODERATE';
type Shot={actionId:string;playerId:string;team:string;role:string;segment:number;band:Band;energy:number;acute:number;pressure:number;distance:number;difficulty:number;kind:string;transition:boolean;placement:number;spread:number;shooting:number;repeatSprint:number;goal:boolean};
export class PhysicalLoadDiagnostics extends RotationFatigueDiagnostics {
 physicalPlayers:Record<string,{id:string;team:string;role:string;profile:CorePlayer['profile'];segments:ReturnType<typeof empty>[];sprintBouts:number}>={};
 shots:Shot[]=[];shotIndex=new Map<string,Shot>();lastLoads=new Map<string,ReturnType<typeof empty>>();lastSecond=-1;sprinting=new Map<string,boolean>();
 execution:Record<string,{passes:number;difficultPasses:number;passErrorSum:number;receptions:number;failedReceptions:number;riskSum:number;pressureSum:number}>={};
 override observe(s:Readonly<CoreState>,events:readonly CoreEvent[]){
  super.observe(s,events);const segment=Math.min(3,Math.floor(Math.max(0,s.officialClock.timeMs-1)/900000));
  if(Math.floor(s.officialClock.timeMs/1000)!==this.lastSecond){this.lastSecond=Math.floor(s.officialClock.timeMs/1000);
   for(const p of s.players){if(p.kind!=='FIELD_PLAYER')continue;const r=this.physicalPlayers[p.id]??=({id:p.id,team:p.team,role:p.role,profile:p.profile,segments:Array.from({length:4},empty),sprintBouts:0});
    const now=empty(),before=this.lastLoads.get(p.id)??empty();for(const k of channels){now[k]=p.condition.physicalLoad?.[k]??0;r.segments[segment][k]+=Math.max(0,now[k]-before[k]);}this.lastLoads.set(p.id,now);
    const sprint=p.population==='COURT'&&s.officialClock.running&&Math.hypot(p.velocity.x,p.velocity.y)>.7*p.profile.topSpeed;if(sprint&&!this.sprinting.get(p.id))r.sprintBouts++;this.sprinting.set(p.id,sprint);
   }
  }
  for(const e of events){const p=s.players.find(p=>p.id===e.actorId);if(!p||p.kind!=='FIELD_PLAYER')continue;
   const key=[p.team,segment,band(p)].join(':'),x=this.execution[key]??=({passes:0,difficultPasses:0,passErrorSum:0,receptions:0,failedReceptions:0,riskSum:0,pressureSum:0});
   if(e.type==='PASS_RELEASED'){x.passes++;x.difficultPasses+=Number(Number(e.details.difficulty)>.35);x.passErrorSum+=Number(e.details.executionError??0);}
   if(e.type==='PASS_RECEIVED'||e.type==='RECEPTION_FAILED'){x.receptions++;x.failedReceptions+=Number(e.type==='RECEPTION_FAILED');x.riskSum+=Number(e.details.risk??0);x.pressureSum+=Number(e.details.pressure??0);}
   if(e.type==='SHOT_RELEASED'){const distance=Math.hypot(Number(e.details.x)-10,Number(e.details.y)-(s.directions[p.team]==='TOP'?0:40)),pressure=Number(e.details.pressure??0),moving=Math.hypot(p.velocity.x,p.velocity.y)/Math.max(1,p.profile.topSpeed);
    const shot:Shot={actionId:e.actionId??e.id,playerId:p.id,team:p.team,role:p.role,segment,band:band(p),energy:p.condition.energy,acute:p.condition.acuteExertion??0,pressure,distance,difficulty:Math.min(1,pressure/2)*.7+Math.min(1,Math.max(0,(distance-7)/5))*.15+Math.min(1,moving)*.15,kind:String(e.details.shotKind),transition:e.details.phase==='TRANSITION',placement:Number(e.details.executionPlacement??0),spread:Number(e.details.executionSpread??0),shooting:p.profile.shotPlacement,repeatSprint:p.profile.physical?.repeatSprint??p.profile.endurance,goal:false};this.shots.push(shot);this.shotIndex.set(shot.actionId,shot);
   }
   if(e.type==='GOAL'){const shot=this.shotIndex.get(e.actionId??'');if(shot)shot.goal=true;}
  }
 }
 override report(s:Readonly<CoreState>){return {...super.report(s),physicalSchema:'physical-load-diagnostics/1',physicalPlayers:Object.values(this.physicalPlayers).map(p=>({...p,finalLoad:s.players.find(q=>q.id===p.id)?.condition.physicalLoad,finalAcceleration:accelerationCapacity(s.players.find(q=>q.id===p.id)!)})),shots:this.shots,execution:this.execution,
  physicalNotes:'Causal diagnostics, not empirical validation. Canonical load integrates actual work. Sprint bouts are one-second sampled threshold crossings. Fatigue bands label observations only, never gameplay branches. Reception failures are named control errors, not all technical turnovers. Goals use shot action attribution.'};}
}
