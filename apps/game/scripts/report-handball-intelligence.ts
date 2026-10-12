/** Offline proof/report only; production never imports this module. */
import {mkdirSync,readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createIntelligenceScenario,INTELLIGENCE_SCENARIOS} from '@handball-manager/handball-engine/src/v2/core/intelligenceScenarios';
import {advanceCoreMutable,assertCore} from '@handball-manager/handball-engine/src/v2/core/engine';
import {decideHandball,enableDecisionTrace,intelligenceMetrics} from '@handball-manager/handball-engine/src/v2/core/intelligence';
import {readContinuation} from '@handball-manager/handball-engine/src/v2/core/engage';
import {distribution} from '../lib/matchBenchmarks/statistics';
const root=resolve('../..'),out=join(root,'docs/match-intelligence-v1');mkdirSync(out,{recursive:true});
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8').replace(/^\uFEFF/,'')),write=(n:string,x:unknown)=>writeFileSync(join(out,n),JSON.stringify(x,null,2)+'\n');
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const scenarios=INTELLIGENCE_SCENARIOS.map(name=>{
 const{s,p,h}=createIntelligenceScenario(name);const legacy=readContinuation(s,p),initial=decideHandball(s,p),diag=enableDecisionTrace(s,256);
 for(let i=0;i<150&&s.status==='RUNNING';i++)advanceCoreMutable(s);
 return{name,legacy,initial,actualActions:s.events.filter(e=>e.actorId===p.id&&e.type==='ACTION_STARTED').map(e=>({tick:e.tick,motor:e.details.kind,reason:e.details.reason})),status:s.status,score:s.score,metrics:intelligenceMetrics(diag),whyPass:diag.traces.find(t=>t.actualMotor==='PASS')??null,defence:diag.defensiveTraces.slice(0,12)};
});
const acceptance=[];
for(const direction of ['TOP','BOTTOM'] as const)for(let seed=1;seed<=20;seed++){
 const{s,p}=createIntelligenceScenario('A_FREE_TO_GOAL',seed,direction);for(let i=0;i<150&&s.status==='RUNNING';i++)advanceCoreMutable(s);
 const actions=s.events.filter(e=>e.actorId===p.id&&e.type==='ACTION_STARTED').map(e=>e.details.kind);
 acceptance.push({seed,direction,continues:actions[0]==='DRIVE',sidewaysPass:actions.includes('PASS'),finishes:actions.includes('SHOOT'),status:s.status});
}
if(acceptance.some(a=>!a.continues||a.sidewaysPass||!a.finishes))throw Error('Free carrier acceptance failed');
// Same evolving synthetic relationship, with an explicit physical help arrival.
const dynamic=createIntelligenceScenario('B_HELP_M6');dynamic.h.position={x:14,y:9};dynamic.h.velocity={x:0,y:0};const dynamicDiag=enableDecisionTrace(dynamic.s,256);
for(let i=0;i<8;i++)advanceCoreMutable(dynamic.s);
dynamic.h.position={x:dynamic.p.position.x-1,y:dynamic.p.position.y-.7};dynamic.h.velocity={x:1,y:.7};
for(let i=0;i<15&&dynamic.s.status==='RUNNING';i++)advanceCoreMutable(dynamic.s);
const dynamicActions=dynamic.s.events.filter(e=>e.actorId===dynamic.p.id&&e.type==='ACTION_STARTED').map(e=>({tick:e.tick,motor:e.details.kind,reason:e.details.reason}));
write('controlled-scenarios.json',{scenarios,acceptance,dynamicHelp:{method:'Deterministic synthetic physical helper arrival after eight canonical ticks; no future targets/outcomes used',actions:dynamicActions,traces:dynamicDiag.traces}});
console.log(JSON.stringify({controlled:scenarios.map(s=>[s.name,s.actualActions.map(a=>a.motor)]),freeCarrier:{n:acceptance.length,continued:acceptance.filter(a=>a.continues).length,sidewaysPasses:acceptance.filter(a=>a.sidewaysPass).length,finished:acceptance.filter(a=>a.finishes).length},dynamicHelp:dynamicActions}));
if(process.argv.includes('--scenarios-only'))process.exit(0);
const comparisons=[];
for(const[competition,key,oldKey]of [['HBL','hbl-final','hbl-release'],['Allsvenskan','allsv-final','allsv-release']]){
 const dir=join(out,key),fresh=read(join(dir,'summary.json')),oldDir=join(root,'docs/match-motion-quality-v2',oldKey),old=read(join(oldDir,'summary.json'));
 if(fresh.metadata.inputHash!==old.metadata.inputHash||!fresh.metadata.sourceStable)throw Error('Input/source mismatch');
 const matches=fresh.metadata.recipes.map((r:any)=>read(join(dir,`match-${String(r.index).padStart(3,'0')}.json`)));
 const pairs=matches.filter((m:any)=>m.metadata.recipe.index<old.matches).map((m:any)=>{const before=read(join(oldDir,`match-${String(m.metadata.recipe.index).padStart(3,'0')}.json`));if(before.metadata.recipe.saveSeed!==m.metadata.recipe.saveSeed||before.metadata.fixture.id!==m.metadata.fixture.id)throw Error('Invalid pair');return{before:before.actual,after:m.actual};});
 const rows=['goals','outfieldShots','outfieldConversion','sevenMetres','suspensions'].map(metric=>({metric,before:old.distributions[metric],pairedAfter:distribution(pairs.map((p:any)=>p.after.totals[metric])),after:fresh.distributions[metric],pairedDelta:distribution(pairs.map((p:any)=>p.after.totals[metric]-p.before.totals[metric]))}));
 for(const metric of ['savePct','scorerConcentration','shotConcentration'])rows.push({metric,before:metric==='savePct'?old.keeperDistributions[metric]:old.teamDistributions[metric],pairedAfter:distribution(pairs.flatMap((p:any)=>(metric==='savePct'?p.after.keepers:p.after.teams).map((v:any)=>v[metric]))),after:metric==='savePct'?fresh.keeperDistributions[metric]:fresh.teamDistributions[metric],pairedDelta:null as any});
 const m9=(batch:any[])=>{const goals=batch.reduce((n,m)=>n+m.actual.totals.goals,0),shots=batch.reduce((n,m)=>n+m.actual.totals.outfieldShots,0);return{goalShare:batch.reduce((n,m)=>n+(m.actual.shotGroups['POSITION:M9']?.goals??0),0)/goals,shotShare:batch.reduce((n,m)=>n+(m.actual.shotGroups['POSITION:M9']?.attempts??0),0)/shots};};
 const intelligence=matches.map((m:any)=>read(join(dir,`intelligence-${String(m.metadata.recipe.index).padStart(3,'0')}.json`)).metrics);
 const metricKeys=Object.keys(intelligence[0]);
 const motion=[0,1].map(i=>{const name=`motion-${String(i).padStart(3,'0')}.json`,b=read(join(oldDir,name)),a=read(join(dir,name));return{index:i,counts:Object.fromEntries(['liveTicks','abruptReversals','accelerationSpikes','targetChurn','overlapSamples','nearCollisionSamples'].map(k=>[k,{before:b[k],after:a[k]}])),beforeSynchronized:b.synchronized,afterSynchronized:a.synchronized};});
 comparisons.push({competition,n:fresh.matches,pairedN:pairs.length,rows,m9:{before:{goalShare:old.shotGroups['POSITION:M9'].goals/old.distributions.goals.mean/old.matches,shotShare:old.shotGroups['POSITION:M9'].attempts/old.distributions.outfieldShots.mean/old.matches},after:m9(matches)},intelligence:Object.fromEntries(metricKeys.map(k=>[k,distribution(intelligence.map((m:any)=>m[k]))])),motion,tails:{goals:distribution(matches.map((m:any)=>m.actual.totals.goals)),conversion:distribution(matches.map((m:any)=>m.actual.totals.outfieldConversion)),keeperSave:distribution(matches.flatMap((m:any)=>m.actual.keepers.map((k:any)=>k.savePct))),over80Conversion:matches.filter((m:any)=>m.actual.totals.outfieldConversion>.8).map((m:any)=>({index:m.metadata.recipe.index,goals:m.actual.totals.goals,shots:m.actual.totals.outfieldShots,conversion:m.actual.totals.outfieldConversion}))},proofs:fresh.metadata.proofs,timings:fresh.metadata.timings,runtimeMs:fresh.metadata.totalRuntimeMs,inputHash:fresh.metadata.inputHash,sourceStable:fresh.metadata.sourceStable});
}
write('comparison.json',{startingCheckpoint:'939efd3',comparisons,notes:['Paired first 20 against Motion Quality v2, fresh indices 20-39 use same retained inputs','No empirical feedback or statistical coefficient adjustment','Keeper-match rate and Allsvenskan HBL keeper proxy retain prior definitions','Intelligence fractions are possession episode diagnostics, not empirical hard targets; pass advantage estimates compare different tactical contexts','Intent duration measures closed sampled carrier intent episodes; off-ball interval is excluded','Oscillation requires a rapid <=500ms sampled drive/pass/drive reversal','Motion exposure differs because intelligence changes the executed match']});
console.log(JSON.stringify(comparisons.map(c=>({competition:c.competition,n:c.n,pairedN:c.pairedN,metrics:c.rows.map(r=>[r.metric,r.before.mean,r.after.mean])}))));
