/** Offline causal comparison of retained calibration/intelligence output. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { distribution } from '../lib/matchBenchmarks/statistics';
type Shot={kind:string;phase:string;goal:boolean;pressure:number;opportunityQuality:number;quality:number;distance:number;aim:{x:number}|null;keeper:{position:{x:number};velocity:{x:number;y:number};action:{kind:string;phase:string}|null}|null;[key:string]:unknown};
const root=resolve('../..'),read=(p:string)=>JSON.parse(readFileSync(resolve(root,p),'utf8').replace(/^\uFEFF/,''));
const rows=[];
for(const [stage,key,count] of [['EMPIRICAL_CAL','docs/match-empirical-calibration/hbl-final',60],['INTELLIGENCE','docs/match-intelligence-v1/delivery/hbl',40]] as const){
    const matches=[],shots:Shot[]=[];
    for(let i=0;i<count;i++){
        const id=String(i).padStart(3,'0');matches.push(read(`${key}/match-${id}.json`));
        const causal=read(`${key}/causal-${id}.json`);shots.push(...causal.shots);
    }
    const field=(key:string)=>distribution(shots.map(s=>typeof s[key]==='number'?s[key] as number:null));
    const group=(predicate:(s:Shot)=>boolean)=>{const x=shots.filter(predicate);return{attempts:x.length,share:x.length/shots.length,conversion:x.filter(s=>s.goal).length/Math.max(1,x.length),pressure:distribution(x.map(s=>s.pressure)),quality:distribution(x.map(s=>s.opportunityQuality)),distance:distribution(x.map(s=>s.distance))};};
    rows.push({stage,n:matches.length,goals:distribution(matches.map(m=>m.actual.totals.goals)),attempts:distribution(matches.map(m=>m.actual.totals.outfieldShots)),possessions:distribution(matches.map(m=>m.actual.totals.attacks??m.actual.totals.possessions??null)),durationMedian:distribution(matches.map(m=>m.actual.possessionDistribution.median)),quality:field('opportunityQuality'),decisionQuality:field('quality'),pressure:field('pressure'),distance:field('distance'),groups:Object.fromEntries([...new Set(shots.map(s=>s.kind))].map(kind=>[kind,group(s=>s.kind===kind)])),transition:group(s=>s.phase==='TRANSITION'),settled:group(s=>s.phase!=='TRANSITION'),unpressured:group(s=>s.pressure<.05),pressured:group(s=>s.pressure>=.5),qualityBins:Object.fromEntries([['LOW',0,.45],['MEDIUM',.45,.65],['HIGH',.65,.8],['TOP',.8,2]].map(([name,lo,hi])=>[name,group(s=>s.opportunityQuality>=Number(lo)&&s.opportunityQuality<Number(hi))])),keeperStance:{meanDistanceToAim:distribution(shots.filter(s=>s.keeper&&s.aim).map(s=>Math.abs(s.keeper.position.x-s.aim.x))),movingAtRelease:group(s=>s.keeper&&Math.hypot(s.keeper.velocity.x,s.keeper.velocity.y)>.5),unprepared:group(s=>s.keeper?.action?.kind!=='SAVE'||s.keeper?.action?.phase!=='EXECUTING')},note:'Chance bins are diagnostic reference-capability scores, not empirical xG categories; duration has NO_REFERENCE.'});
}
writeFileSync(resolve(root,'docs/post-intelligence-reconciliation/DRIFT-DIAGNOSIS.json'),JSON.stringify({source:'Completed retained full-match cohorts; no resimulation',rows},null,2));
console.log(JSON.stringify(rows.map(r=>({stage:r.stage,n:r.n,goals:r.goals.mean,attempts:r.attempts.mean,duration:r.durationMedian.mean,quality:r.quality.mean,pressure:r.pressure.mean,distance:r.distance.mean,groups:Object.fromEntries(Object.entries(r.groups).map(([k,v])=>[k,{share:v.share,conversion:v.conversion}])),transition:r.transition,unpressured:r.unpressured,unprepared:r.keeperStance.unprepared})),null,2));
