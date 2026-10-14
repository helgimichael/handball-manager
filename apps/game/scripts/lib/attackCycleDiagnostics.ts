/** Developer-only observation of real attack cycles. No RNG or state writes. */
import type {CoreState,CoreEvent} from '@handball-manager/handball-engine/src/v2/core/state';
import {ledger,lossClassOf} from '@handball-manager/handball-engine/src/v2/core/ledger';
import {distribution} from '../../lib/matchBenchmarks/statistics';
type Episode={firstMs:number;lastMs:number;threats:number;advantages:number;recoveries:number;recycles:number;secondAttacks:number;shots:number;shotsAfterRecycle:number;shotsAfterSecondAttack:number;awaitingReentry:boolean;lastThreatTick:number;firstThreatStopped:boolean};
export class AttackCycleDiagnostics {
 private episodes=new Map<string,Episode>();
 private counts:Record<string,number>={};
 private foulFacts:CoreEvent[]=[];
 private punishments:CoreEvent[]=[];
 observe=(s:Readonly<CoreState>,events:readonly CoreEvent[])=>{
  for(const e of events){
   this.counts[e.type]=(this.counts[e.type]??0)+1;
   if(e.type==='RESTART_AWARDED'&&e.details.kind==='FREE_THROW')this.counts.FREE_THROW_AWARDED=(this.counts.FREE_THROW_AWARDED??0)+1;
   const p=this.episodes.get(e.possessionId)??{firstMs:e.officialMs,lastMs:e.officialMs,threats:0,advantages:0,recoveries:0,recycles:0,secondAttacks:0,shots:0,shotsAfterRecycle:0,shotsAfterSecondAttack:0,awaitingReentry:false,lastThreatTick:-100,firstThreatStopped:false};
   p.lastMs=e.officialMs;
   this.episodes.set(e.possessionId,p);
   if(e.type==='DEFENDER_BEATEN'||e.type==='ADVANTAGE_OPENED')p.advantages++;
   if(e.type==='DEFENDER_RECOVERED'||e.type==='LEGAL_CONTACT'&&e.details.approach==='FRONT'&&
     ['DRIVE','DRIBBLE'].includes(s.players.find(a=>a.id===e.relatedIds[0])?.action?.kind??'')){p.recoveries++;if(p.threats)p.firstThreatStopped=true;}
   if(e.type==='ACTION_STARTED'){
    const reason=String(e.details.reason),kind=String(e.details.kind),actor=s.players.find(a=>a.id===e.actorId);
    if(kind==='PASS'&&(reason.includes('RECYCLE')||/keep the ball and rebuild/.test(reason)||actor?.handballIntent?.kind==='RECYCLE_ATTACK')){p.recycles++;p.awaitingReentry=true;}
    // A new motor after an actual pass/return may create a second threat. JUMP
    // and its SHOOT are one threat, and adjacent drive refreshes are not cycles.
    if(['DRIVE','FEINT','JUMP'].includes(kind)&&e.tick-p.lastThreatTick>12){
     p.threats++;if(p.awaitingReentry&&p.firstThreatStopped){p.secondAttacks++;p.awaitingReentry=false;p.firstThreatStopped=false;}
     p.lastThreatTick=e.tick;
    }
   }
   if(e.type==='SHOT_RELEASED'){p.shots++;if(p.recycles)p.shotsAfterRecycle++;if(p.secondAttacks)p.shotsAfterSecondAttack++;}
   if(e.type==='CONTACT_EXECUTED'||e.type==='FOUL_ASSESSED')this.foulFacts.push(e);
   if(['WARNING','TWO_MINUTE_SUSPENSION','DISQUALIFICATION'].includes(e.type))this.punishments.push(e);
  }
 };
 report(s:CoreState){
  const book=ledger(s),rows=book.records.filter(a=>a.ending!=='STILL_IN_PROGRESS'),cycles=rows.map(a=>this.episodes.get(a.possessionId)).filter((p):p is Episode=>!!p);
  const endings:Record<string,number>={SHOT:0,TURNOVER:0,OFFENSIVE_FOUL:0,OTHER:0};
  const detail:Record<string,number>={};for(const a of rows){detail[a.ending]=(detail[a.ending]??0)+1;const key=a.shots>0?'SHOT':a.ending==='OFFENSIVE_FOUL'?'OFFENSIVE_FOUL':lossClassOf(a.ending)?'TURNOVER':'OTHER';endings[key]++;}
  const by=(facts:CoreEvent[],key:string)=>facts.reduce<Record<string,number>>((n,e)=>{const k=String(e.details[key]??'UNKNOWN');n[k]=(n[k]??0)+1;return n;},{});
  return{definitions:{endings:'Exclusive ended canonical attacks; any released shot makes SHOT. Exact last-ending detail also retained.',continuations:'Free throws and recycles are non-exclusive events within attacks, not lost possessions.',threat:'DRIVE/FEINT/JUMP action starts separated by >600ms; JUMP+SHOOT is one motor threat. Observational proxy, no empirical time target.',secondAttack:'New threat after observed defensive recovery/legal frontal stop and recycle; no guaranteed outcome.'},endings,endingDetail:detail,losses:book.losses,continuations:{freeThrows:this.counts.FREE_THROW_AWARDED??0,deadBallRestarts:this.counts.RESTART_COMPLETED??0,recycles:cycles.reduce((n,p)=>n+p.recycles,0)},cycles:{threats:distribution(cycles.map(p=>p.threats)),advantages:distribution(cycles.map(p=>p.advantages)),recoveries:distribution(cycles.map(p=>p.recoveries)),secondAttacks:cycles.reduce((n,p)=>n+p.secondAttacks,0),shotsAfterRecycle:cycles.reduce((n,p)=>n+p.shotsAfterRecycle,0),shotsAfterSecondAttack:cycles.reduce((n,p)=>n+p.shotsAfterSecondAttack,0),oneThreat:cycles.filter(p=>p.threats===1).length,multipleThreats:cycles.filter(p=>p.threats>1).length},duration:distribution(cycles.map(a=>(a.lastMs-a.firstMs)/1000)),events:this.counts,discipline:{contacts:by(this.foulFacts.filter(e=>e.type==='CONTACT_EXECUTED'),'severity'),fouls:by(this.foulFacts.filter(e=>e.type==='FOUL_ASSESSED'),'severity'),punishments:by(this.punishments,'severity'),reasons:by(this.punishments,'reason'),sanctions:this.punishments.map(e=>({type:e.type,foulId:e.details.foulId,severity:e.details.severity,reason:e.details.reason,tick:e.tick})),pendingAtEnd:s.referee.sanctions.length}};
 }
}
