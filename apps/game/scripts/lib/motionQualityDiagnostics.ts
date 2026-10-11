/** Developer observation only: canonical paths, never gameplay targets. */
import type {CoreState,CorePlayer,Point} from '@handball-manager/handball-engine/src/v2/core/state';
import {movementCapacity} from '@handball-manager/handball-engine/src/v2/core/condition';
import {distribution} from '../../lib/matchBenchmarks/statistics';
const speed=(v:Point)=>Math.hypot(v.x,v.y),dist=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
type Sample={tick:number;position:Point;velocity:Point;target:Point|null;action:string|null;duty:string;possession:string};
export class MotionQualityDiagnostics {
 private previous=new Map<string,Sample>();private liveTicks=0;private turns:number[]=[];private accelerations:number[]=[];
 private reversals=0;private spikes=0;private churn=0;private overlaps=0;private near=0;private sync={retarget:0,accelerate:0,reverse:0,stop:0};
 private spacing:number[]=[];private widths:number[]=[];private depths:number[]=[];private lineGaps:number[]=[];private pivotGaps:number[]=[];
 private ring:any[]=[];private windows:Record<string,{trigger:number;reason:string;frames:any[]}>={};private paths=new Map<string,{distance:number;start:Point;end:Point}>();
 observe=(s:CoreState)=>{
  if(!s.ball.live||s.match?.phase==='HALFTIME'||s.match?.phase==='FULLTIME'){this.previous.clear();return;}
  this.liveTicks++;const players=s.players.filter(p=>p.population==='COURT'),counts:Record<string,Record<string,number>>={HOME:{retarget:0,accelerate:0,reverse:0,stop:0},AWAY:{retarget:0,accelerate:0,reverse:0,stop:0}};
  for(const p of players){
   const sample:Sample={tick:s.tick,position:{...p.position},velocity:{...p.velocity},target:p.action?.target?{...p.action.target}:null,action:p.action?.kind??null,duty:p.duty.kind,possession:s.possession.id},old=this.previous.get(p.id);
   if(old&&old.tick===s.tick-1&&old.possession===s.possession.id&&!p.airborne){
    const v=speed(p.velocity),u=speed(old.velocity),acc=dist(p.velocity,old.velocity)/.05;this.accelerations.push(acc);
    const limit=2*p.profile.acceleration*movementCapacity(p);if(acc>limit+1e-6)this.spikes++;
    if(v>.5&&u>.5){const angle=Math.acos(Math.max(-1,Math.min(1,(p.velocity.x*old.velocity.x+p.velocity.y*old.velocity.y)/(v*u))));this.turns.push(angle);if(angle>Math.PI*2/3){this.reversals++;counts[p.team].reverse++;}}
    if(v-u>.12)counts[p.team].accelerate++;if(u>.5&&v<.1)counts[p.team].stop++;
    if(sample.target&&old.target&&dist(sample.target,old.target)>.25){this.churn++;counts[p.team].retarget++;}
    const key=p.id+':'+s.possession.id,track=this.paths.get(key)??{distance:0,start:old.position,end:old.position};track.distance+=dist(p.position,old.position);track.end={...p.position};this.paths.set(key,track);
   }
   this.previous.set(p.id,sample);
  }
  for(const team of ['HOME','AWAY'])for(const key of ['retarget','accelerate','reverse','stop'] as const)if(counts[team][key]>=4)this.sync[key]++;
  if(s.tick%10===0){
   for(const p of players.filter(p=>p.kind==='FIELD_PLAYER')){const teammates=players.filter(q=>q.id!==p.id&&q.team===p.team&&q.kind==='FIELD_PLAYER');if(teammates.length)this.spacing.push(Math.min(...teammates.map(q=>dist(p.position,q.position))));}
   for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){const d=dist(players[i].position,players[j].position),body=players[i].radius+players[j].radius;if(d<body-.01)this.overlaps++;if(d<body+.12)this.near++;}
   const attackers=players.filter(p=>p.team===s.possession.team&&p.kind==='FIELD_PLAYER');if(attackers.length){this.widths.push(Math.max(...attackers.map(p=>p.position.x))-Math.min(...attackers.map(p=>p.position.x)));const backs=attackers.filter(p=>['LB','CB','RB'].includes(p.role));this.depths.push(...backs.map(p=>s.directions[p.team]==='TOP'?p.position.y:40-p.position.y));}
   const defenders=players.filter(p=>p.team!==s.possession.team&&p.kind==='FIELD_PLAYER').sort((a,b)=>(a.zone??0)-(b.zone??0));for(let i=1;i<defenders.length;i++)this.lineGaps.push(dist(defenders[i].position,defenders[i-1].position));
   for(const p of attackers.filter(p=>p.role==='P'||p.role==='P2'))if(defenders.length)this.pivotGaps.push(Math.min(...defenders.map(d=>dist(p.position,d.position))));
  }
  if(s.tick%2===0){
   const frame={tick:s.tick,officialMs:s.officialClock.timeMs,phase:s.possession.phase,ball:{...s.ball.position},players:players.map(p=>({id:p.id,team:p.team,role:p.role,x:p.position.x,y:p.position.y,vx:p.velocity.x,vy:p.velocity.y,action:p.action?.kind,phase:p.action?.phase,duty:p.duty.kind,target:p.action?.target,energy:p.condition.energy,motion:(p as CorePlayer & {motion?:unknown}).motion??null}))};
   this.ring.push(frame);if(this.ring.length>40)this.ring.shift();
   for(const window of Object.values(this.windows))if(s.tick>window.trigger&&s.tick<=window.trigger+160)window.frames.push(frame);
   const moving=(p:CorePlayer)=>speed(p.velocity)>.5;
   const cases:Record<string,boolean>={settled:s.possession.phase==='ESTABLISHED',circulation:s.ball.flight?.kind==='PASS',breakthrough:players.some(p=>p.action?.kind==='DRIVE'&&moving(p)),pivot:players.some(p=>(p.role==='P'||p.role==='P2')&&['SCREEN','RUN'].includes(p.action?.kind??'')),wing:players.some(p=>p.id===s.ball.controllerId&&['LW','RW'].includes(p.role)),helpRecovery:players.some(p=>['HELP','RECOVER'].includes(p.duty.kind)&&moving(p)),transition:s.possession.phase==='TRANSITION',retreat:players.some(p=>p.duty.kind==='RETREAT'&&moving(p)),passer:players.some(p=>p.action?.kind==='PASS'&&p.action.resolved&&moving(p)),support:players.some(p=>p.team===s.possession.team&&p.id!==s.ball.controllerId&&p.action?.kind==='RUN'&&moving(p))};
   for(const[key,yes]of Object.entries(cases))if(yes&&!this.windows[key]&&this.ring.length===40)this.windows[key]={trigger:s.tick,reason:key,frames:[...this.ring]};
  }
 };
 report(){return{definitions:{canonical:true,liveOnly:true,dt:.05,spike:'vector delta > 2 × profile acceleration × movementCapacity; includes real contact/collision constraints',reversal:'>120 degrees with both speeds >0.5 m/s',synchronization:'at least four teammates on the same live tick',spacingSamplingSeconds:.5,windowSamplingSeconds:.1,targetChurnMetres:.25,noEmpiricalMotionTargets:true},liveTicks:this.liveTicks,headingRadians:distribution(this.turns),acceleration:distribution(this.accelerations),abruptReversals:this.reversals,accelerationSpikes:this.spikes,targetChurn:this.churn,nearCollisionSamples:this.near,overlapSamples:this.overlaps,synchronized:this.sync,spacing:distribution(this.spacing),attackWidth:distribution(this.widths),backcourtDepth:distribution(this.depths),defensiveNeighbourGap:distribution(this.lineGaps),pivotDefenderGap:distribution(this.pivotGaps),pathEfficiency:distribution([...this.paths.values()].filter(p=>p.distance>2).map(p=>dist(p.start,p.end)/p.distance)),windows:this.windows,missingWindows:['settled','circulation','breakthrough','pivot','wing','helpRecovery','transition','retreat','passer','support'].filter(k=>!this.windows[k])};}
}
