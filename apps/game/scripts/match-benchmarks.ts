/** Canonical, reproducible developer batch. No imports from this module enter player matches. */
import {existsSync,mkdirSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {createNewCareerState} from '../lib/career/newCareer';
import {buildMatchdayReadyEvent} from '../lib/career/careerEvents';
import {startProductionMatch,advanceProductionMatch,resultFromSession,commandProductionMatch,finalizeProductionMatch} from '../lib/career/productionMatch';
import {snapshotWorldSquads,snapshotGameplayRatings} from '../lib/gameWorld/serverSnapshot';
import {getClubsByCompetition} from '../lib/game-data';
import type {PlayerMock} from '../lib/game-data';
import type {GameplayPlayerRating} from '../lib/gameWorld/gameplayRatingSnapshot';
import {CalibrationDiagnostics} from './lib/calibrationDiagnostics';
import {ReconciliationDiagnostics} from './lib/reconciliationDiagnostics';
import {AttackCycleDiagnostics} from './lib/attackCycleDiagnostics';
import {MotionQualityDiagnostics} from './lib/motionQualityDiagnostics';
import {encodeFrames} from '../lib/career/matchFrames';
import {extract} from '../lib/matchBenchmarks/extract';
import {matchReport,aggregate,markdown} from '../lib/matchBenchmarks/report';
import {ingestReference,SCHEMA_VERSION,type Identity} from '../lib/matchBenchmarks/reference';
import {EHF_ELITE} from '@handball-manager/handball-engine/src/v2/core/realism';
import {enableDecisionTrace,intelligenceMetrics} from '@handball-manager/handball-engine/src/v2/core/intelligence';

const args=process.argv.slice(2),option=(k:string,d?:string)=>{const i=args.indexOf(k);return i<0?d:args[i+1];};
const mode=option('--mode','fast')!,defaults:Record<string,number>={fast:20,calibration:100,deep:500};
if(!defaults[mode])throw new Error('mode must be fast, calibration or deep');
const count=Number(option('--count',String(defaults[mode]))),offset=Number(option('--offset','0'));
const indices=option('--indices')?.split(',').map(Number)??Array.from({length:count},(_,i)=>i+offset);
if(!Number.isSafeInteger(count)||count<1||!indices.length||indices.some(i=>!Number.isSafeInteger(i)||i<0)||new Set(indices).size!==indices.length)throw new Error('Invalid count/indices');
const out=resolve(option('--out','../../docs/match-benchmarks/current-engine')!);
if(existsSync(join(out,'summary.json')))throw new Error('Completed output exists; choose a new output directory');
mkdirSync(out,{recursive:true});
const write=(name:string,x:unknown)=>writeFileSync(join(out,name),JSON.stringify(x,null,2)+'\n');
const hash=(x:unknown)=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
type Inputs={competitionId:string;clubs:string[];worldSquads:Record<string,PlayerMock[]>;gameplayRatings:Record<string,GameplayPlayerRating[]>};
const inputPath=option('--inputs'),requested=option('--competition');
const competitionId=requested??'swe-2';
const inputs:Inputs=inputPath?JSON.parse(readFileSync(resolve(inputPath),'utf8')):{competitionId,clubs:getClubsByCompetition(competitionId).filter(c=>c.dataSource==='REAL_WORLD').map(c=>c.id).sort(),worldSquads:snapshotWorldSquads(competitionId),gameplayRatings:snapshotGameplayRatings(competitionId)};
if(!inputs.clubs.length||requested&&requested!==inputs.competitionId)throw new Error('Competition/input mismatch or empty fixture pool');
const fixtures=option('--fixtures')?.split(',');
const seeds=option('--seeds')?.split(',');if(seeds&&seeds.length!==indices.length)throw new Error('Provide one save seed per index');
const prefix=option('--seed-prefix','match-realism-v2-canonical-2026')!;
const referencePath=option('--reference'),profiles=referencePath?JSON.parse(readFileSync(resolve(referencePath),'utf8')).map(ingestReference):[];
const season=option('--season','2026-27')!,knownSwedishMen=['swe-1','swe-2'].includes(inputs.competitionId),identity:Identity={competition:inputs.competitionId,season,country:option('--country',knownSwedishMen?'SE':undefined),level:option('--level'),category:option('--category',knownSwedishMen?'men-senior':undefined)};
const tacticsPath=option('--tactics'),tactics=tacticsPath?JSON.parse(readFileSync(resolve(tacticsPath),'utf8')):null;
const root=resolve('../..'),sourceDir=join(root,'packages/handball-engine/src/v2/core');
const paths=[...readdirSync(sourceDir).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>join(sourceDir,f)),resolve('lib/career/productionMatch.ts'),resolve('scripts/lib/calibrationDiagnostics.ts'),...readdirSync(resolve('lib/matchBenchmarks')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>resolve('lib/matchBenchmarks',f)),resolve('scripts/match-benchmarks.ts')];
if(args.includes('--reconciliation'))paths.push(resolve('scripts/lib/reconciliationDiagnostics.ts'));
if(args.includes('--v11'))paths.push(resolve('scripts/lib/attackCycleDiagnostics.ts'));
if(args.includes('--motion-quality'))paths.push(resolve('scripts/lib/motionQualityDiagnostics.ts'));
const fingerprints=()=>paths.map(path=>({path:path.replace(root,'').replaceAll('\\','/'),sha256:hash(readFileSync(path,'utf8'))}));
const sources=fingerprints();let head='UNKNOWN';try{head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
const recipes=indices.map((index,i)=>({index,saveSeed:seeds?.[i]??`${prefix}:${index}`,managerClubId:inputs.clubs[index%inputs.clubs.length],fixtureId:fixtures?.[i%fixtures.length]}));
write('inputs.json',inputs);write('recipes.json',recipes);write('references.json',profiles);
const reports:ReturnType<typeof matchReport>[]=[],proofs:unknown[]=[],timings:{simulationMs:number;analysisMs:number;observerMs:number}[]=[];
const start=performance.now();
for(const recipe of recipes){
  let career=createNewCareerState(recipe.saveSeed,recipe.managerClubId,structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));
  const fixture=career.fixtures.find(f=>recipe.fixtureId?f.id===recipe.fixtureId:f.type==='LEAGUE'&&(f.homeClubId===recipe.managerClubId||f.awayClubId===recipe.managerClubId));
  if(!fixture)throw new Error(`Fixture unavailable ${recipe.fixtureId??recipe.managerClubId}`);
  if(fixture.competitionId!==identity.competition)throw new Error(`Fixture competition ${fixture.competitionId} does not match selected reference competition ${identity.competition}`);
  career={...career,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};career=startProductionMatch(career,fixture.id);
  if(!career.productionMatch)throw new Error('Canonical start refused');
  if(tactics)career=commandProductionMatch(career,{kind:'TACTICS',team:fixture.homeClubId===career.playerClubId?'HOME':'AWAY',patch:tactics});
  const initial=structuredClone(career),initialProfiles=career.productionMatch!.core.players.map(p=>({id:p.id,team:p.team,role:p.role,profile:p.profile,energy:p.condition.energy})),initialTactics=structuredClone(career.productionMatch!.core.coaching);
  const motion=args.includes('--motion-quality')&&reports.length<2?new MotionQualityDiagnostics():null;
  const intelligence=args.includes('--intelligence')?enableDecisionTrace(career.productionMatch!.core,reports.length<2?256:0):null;
  const reconciliation=args.includes('--reconciliation')?new ReconciliationDiagnostics():null;
  const cycles=args.includes('--v11')?new AttackCycleDiagnostics():null;
  const observer=new CalibrationDiagnostics();let observerMs=0,calls=0,simulationStart=performance.now(),savedMidMatch:typeof career|null=null;
  while(career.productionMatch!.core.status==='RUNNING'&&calls++<40){career=advanceProductionMatch(career,10000,false,(core,events)=>{const t=performance.now();observer.observe(core,events);motion?.observe(core);reconciliation?.observe(core,events);cycles?.observe(core,events);observerMs+=performance.now()-t;});if(args.includes('--prove')&&reports.length===0&&calls===2)savedMidMatch=JSON.parse(JSON.stringify(career));}
  const simulationMs=performance.now()-simulationStart,session=career.productionMatch!;
  if(session.core.match?.phase!=='FULLTIME')throw new Error(`Incomplete ${recipe.index}: ${session.core.reason}`);
  const before=hash(session),analysisStart=performance.now(),diagnostics=observer.report(session.core),result=resultFromSession(session),actual=extract(session,diagnostics,result),report=matchReport(actual,profiles,identity),analysisMs=performance.now()-analysisStart;
  if(before!==hash(session))throw new Error('Post-match analysis mutated canonical session');
  // Full-match pair for exact events, RNG, frames, result and all core statistics.
  if(args.includes('--prove')&&reports.length===0){let without=initial;const t=performance.now();let n=0;while(without.productionMatch!.core.status==='RUNNING'&&n++<40)without=advanceProductionMatch(without,10000,false);const plainMs=performance.now()-t;const equal=hash(without.productionMatch)===before&&hash(resultFromSession(without.productionMatch!))===hash(result);if(!equal)throw new Error('Non-mutation proof failed');const archive=finalizeProductionMatch(career).matchArchives![fixture.id],plainArchive=finalizeProductionMatch(without).matchArchives![fixture.id];if(hash(archive)!==hash(plainArchive))throw new Error('Observed archive differs');proofs.push({archiveExact:true,archiveHash:hash(archive),index:recipe.index,fullMatch:true,exactSessionEqual:equal,sessionHash:before,resultHash:hash(result),observedMs:simulationMs,unobservedMs:plainMs,observerMs,analysisMs,includes:['result','events','rng','archive frames','core statistics'],postAnalysisSessionUnchanged:true});}
  if(savedMidMatch){let resumed=savedMidMatch,n=0;while(resumed.productionMatch!.core.status==='RUNNING'&&n++<40)resumed=advanceProductionMatch(resumed,10000,false);const equal=hash(resumed.productionMatch)===before&&hash(resultFromSession(resumed.productionMatch!))===hash(result);if(!equal)throw new Error('Mid-match save/reload changed final truth');const archive=finalizeProductionMatch(career).matchArchives![fixture.id],resumedArchive=finalizeProductionMatch(resumed).matchArchives![fixture.id];if(hash(archive)!==hash(resumedArchive))throw new Error('Resumed archive differs');proofs.push({archiveExact:true,archiveHash:hash(archive),index:recipe.index,saveReloadFullMatch:true,exactSessionEqual:equal,checkpoint:'JSON persisted career after two 10000-tick chunks',includes:['result','events','rng','trajectories','archive frames','statistics']});}
  const compact={...report,actual:{...report.actual,keepers:report.actual.keepers.map(k=>({...k,shots:undefined}))}};
  if(args.includes('--prove')&&reports.length===0)write(`proofs-${String(recipe.index).padStart(3,'0')}.json`,proofs);
  if(motion)write(`motion-${String(recipe.index).padStart(3,'0')}.json`,motion.report());
  if(reconciliation)write(`reconciliation-${String(recipe.index).padStart(3,'0')}.json`,reconciliation.report());
  if(cycles)write(`cycles-${String(recipe.index).padStart(3,'0')}.json`,cycles.report(session.core));
  if(intelligence)write(`intelligence-${String(recipe.index).padStart(3,'0')}.json`,{metrics:intelligenceMetrics(intelligence),traces:intelligence.traces,defensiveTraces:intelligence.defensiveTraces});
  if(args.includes('--causal'))write(`causal-${String(recipe.index).padStart(3,'0')}.json`,{shots:diagnostics.shots,halves:diagnostics.halves,ruleFacts:session.core.events.filter(e=>['CONTACT_EXECUTED','FOUL_ASSESSED','WHISTLE_RESTART','TWO_MINUTE_SUSPENSION','WARNING','DISQUALIFICATION','ADVANTAGE_PENDING','ADVANTAGE_REALIZED','ADVANTAGE_RECALLED'].includes(e.type))});
  write(`match-${String(recipe.index).padStart(3,'0')}.json`,{metadata:{recipe,fixture,head,engineVersion:session.core.version,behaviorRevision:session.behaviorRevision,initialSessionHash:hash(initial.productionMatch),truthHash:before,resultHash:hash(result),initialProfiles,initialTactics,...(motion?{archiveFrameCount:session.frames.length,archiveEncodedBytes:encodeFrames(session.frames).length*3/4}: {})},...compact});
  reports.push(report);timings.push({simulationMs,analysisMs,observerMs});console.log(JSON.stringify({index:recipe.index,score:session.core.score,shots:actual.totals.shots,saves:actual.totals.saves,simulationMs:Math.round(simulationMs),analysisMs:Math.round(analysisMs)}));
}
const summary=aggregate(reports);
const sanityMap={goals:'goals',shots:'shots',possessions:'possessions',suspensions:'suspensions',sevenMetres:'sevenMetres'}as const;
const sanity=reports.flatMap((report,match)=>Object.entries(sanityMap).map(([metric,key])=>{const value=report.actual.totals[metric as keyof typeof sanityMap],band=EHF_ELITE[key];return {match,metric,value,band,status:value<band.min||value>band.max?'OUTSIDE_SANITY_RANGE':'WITHIN_SANITY_RANGE',kind:'ENGINEERING_SANITY_RANGE',source:'packages/handball-engine/src/v2/core/realism.ts:EHF_ELITE'};}));
const metadata={head,schemaVersion:SCHEMA_VERSION,identity,profileVersions:profiles.map((p:{id:string;version:string})=>({id:p.id,version:p.version})),inputHash:hash(inputs),referenceHash:hash(profiles),recipes,tactics,sourceFingerprints:sources,sourceStable:hash(sources)===hash(fingerprints()),timings,proofs,totalRuntimeMs:performance.now()-start,normalMatchOverhead:'Zero: benchmark modules are developer-only and never imported by production simulation.'};
if(!metadata.sourceStable)throw new Error('Source changed during batch');
write('summary.json',args.includes('--compact')?{metadata,matches:summary.matches,distributions:summary.distributions,shotGroups:summary.shotGroups,teamDistributions:summary.teamDistributions,keeperDistributions:summary.keeperDistributions,referenceCoverage:summary.referenceCoverage,sanity,compact:true}:{metadata,...summary,sanity});writeFileSync(join(out,'REPORT.md'),markdown(summary,metadata));
console.log(JSON.stringify({complete:true,n:reports.length,out,totalRuntimeMs:metadata.totalRuntimeMs}));
