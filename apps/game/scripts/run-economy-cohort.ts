/** Sequential guarded replays of the retained production fixtures. No calibration. */
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import {spawn,execFileSync} from 'node:child_process';import {runInNewContext} from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
import {createNewCareerState} from '../lib/career/newCareer';import {buildMatchdayReadyEvent} from '../lib/career/careerEvents';
import {startProductionMatch,advanceProductionMatch,resultFromSession} from '../lib/career/productionMatch';
import {readOrdinaryFreeThrows} from '../lib/matchCenter/freeThrows';
import {possessionEconomy,EconomyObserver} from './lib/possessionEconomy';import {AttackCycleDiagnostics} from './lib/attackCycleDiagnostics';
import {ledger} from '@handball-manager/handball-engine/src/v2/core/ledger';
import {gzipSync} from 'node:zlib';
const args=process.argv.slice(2),arg=(k:string,d:string)=>args.includes(k)?args[args.indexOf(k)+1]:d,league=arg('--league','hbl'),count=Number(arg('--count','40')),root=resolve('../..'),out=resolve(arg('--out',`../../docs/player-attributes-possession-economy-v1/final/${league}`));
if(!['hbl','allsv'].includes(league)||!Number.isInteger(count)||count<1||count>40)throw Error('league hbl/allsv, count1..40');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(x:unknown)=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
// A trusted, exact local historical pure reader measures classification changes on identical events.
const baselineSource=execFileSync('git',['show','2017385:packages/handball-engine/src/v2/core/ledger.ts'],{encoding:'utf8'}),baselineModule={exports:{} as {ledger:typeof ledger}};
runInNewContext(ts.transpileModule(baselineSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{module:baselineModule,exports:baselineModule.exports});
const baselineLedger=baselineModule.exports.ledger;
const prior=join(root,'docs/physical-load-fatigue-v11/final',league),inputs=read(join(prior,'inputs.json')),recipes=read(join(prior,'recipes.json')).slice(0,count);
const core=join(root,'packages/handball-engine/src/v2/core'),paths=[...readdirSync(core).filter(p=>p.endsWith('.ts')&&!p.endsWith('.test.ts')).map(p=>join(core,p)),resolve('lib/career/productionMatch.ts'),resolve('scripts/lib/possessionEconomy.ts'),resolve('scripts/lib/attackCycleDiagnostics.ts'),resolve('scripts/run-economy-cohort.ts'),resolve('lib/matchCenter/freeThrows.ts')];
const fingerprint=()=>Object.fromEntries(paths.map(p=>[p.slice(root.length+1).replaceAll('\\','/'),hash(readFileSync(p,'utf8'))]));
mkdirSync(out,{recursive:true});const sources=fingerprint(),manifest={sources,inputHash:hash(inputs),recipes,league,design:'Exact retained physical-v1.1 recipes/inputs; observer snapshots technical actions, economy postprocessed after match; canonical session/result hashes must equal prior source-identical replay.'};
if(existsSync(join(out,'manifest.json')))assert.deepEqual(read(join(out,'manifest.json')),manifest,'Source/input drift; preserve outputs and choose a new directory');
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2));
async function run(){
 if(!args.includes('--worker')){
  writeFileSync(join(out,'inputs.json'),JSON.stringify(inputs));writeFileSync(join(out,'recipes.json'),JSON.stringify(recipes,null,2));
  for(let offset=0;offset<count;offset+=8){const size=Math.min(8,count-offset);await new Promise<void>((done,fail)=>{const child=spawn(process.execPath,['--import','tsx','scripts/run-economy-cohort.ts','--worker','--league',league,'--count',String(count),'--offset',String(offset),'--size',String(size),'--out',out],{cwd:process.cwd(),stdio:'inherit'});child.on('error',fail);child.on('exit',code=>code===0?done():fail(Error('Worker exit '+code)));});assert.deepEqual(fingerprint(),sources);}
  const reports=recipes.map((_:unknown,i:number)=>read(join(out,`match-${String(i).padStart(3,'0')}.json`)));assert.ok(reports.every((r:{complete:boolean})=>r.complete));writeFileSync(join(out,'summary.json'),JSON.stringify({complete:true,n:count,league,manifest,runtimeMs:reports.reduce((n:number,r:{runtimeMs:number})=>n+r.runtimeMs,0),matches:reports.map((r:{index:number;sessionHash:string;teams:unknown;integrity:unknown})=>({index:r.index,sessionHash:r.sessionHash,teams:r.teams,integrity:r.integrity}))},null,2));console.log(`${league}: COMPLETE ${count}`);return;
 }
 const offset=Number(arg('--offset','0')),size=Number(arg('--size','8'));
 for(let index=offset;index<Math.min(count,offset+size);index++){
  const file=join(out,`match-${String(index).padStart(3,'0')}.json`);if(existsSync(file)){assert.ok(read(file).complete);console.log(league+': reuse '+index);continue;}
  const started=performance.now(),recipe=recipes[index];let career=createNewCareerState(recipe.saveSeed,recipe.managerClubId,structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));const fixture=career.fixtures.find(f=>f.id===recipe.fixtureId)!;assert.ok(fixture);career={...career,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};career=startProductionMatch(career,fixture.id);
  const initialHash=hash(career.productionMatch),observer=new EconomyObserver(),cycles=new AttackCycleDiagnostics();let calls=0;
  while(career.productionMatch!.core.status==='RUNNING'&&calls++<40)career=advanceProductionMatch(career,10000,false,(s,e)=>{observer.observe(s,e);cycles.observe(s,e);});
  const session=career.productionMatch!;assert.equal(session.core.match?.phase,'FULLTIME');const sessionHash=hash(session),result=resultFromSession(session),analysisStart=performance.now(),economy=possessionEconomy(session.core,observer.technical),cycleReport=cycles.report(session.core),freeThrows=readOrdinaryFreeThrows(session.core.events,{source:'LIVE',behaviorRevision:session.behaviorRevision,complete:true});
  assert.equal(hash(session),sessionHash,'Observer/report changed canonical state');const old=read(join(prior,`chunk-${String(Math.floor(index/8)*8).padStart(3,'0')}`,`match-${String(index).padStart(3,'0')}.json`));assert.equal(initialHash,old.metadata.initialSessionHash,'Initial recipe changed');assert.equal(sessionHash,old.metadata.truthHash,'Gameplay trajectory changed');// Pure ledger truth fixes may change turnover aggregation; canonical state must remain exact.
  const currentLedger=ledger(session.core),baseline=baselineLedger(session.core);assert.equal(hash(session),sessionHash,'Historical pure reader mutated state');
  const coreHash=hash(session.core);writeFileSync(join(out,`core-${String(index).padStart(3,'0')}.json.gz`),gzipSync(JSON.stringify(session.core),{level:3}));
  for(const team of ['HOME','AWAY']as const){assert.equal(economy.teams[team].canonicalUiBallLosses,(team==='HOME'?result.homeStats:result.awayStats).turnovers);assert.equal(freeThrows.counts?.[team],economy.teams[team].freeThrows,'Frikast source mismatch');}
  writeFileSync(file,JSON.stringify({...economy,complete:true,index,recipe,fixture,initialHash,sessionHash,coreHash,resultHash:hash(result),priorSessionExact:true,priorResultExact:hash(result)===old.metadata.resultHash,canonicalLedger:{records:currentLedger.records,endings:currentLedger.endings,nonShotLoss:currentLedger.nonShotLoss},baseline2017385:{sourceSha256:hash(baselineSource),reportedTotals:old.actual.totals,endings:baseline.endings,losses:baseline.losses,records:baseline.records.map(r=>({possessionId:r.possessionId,team:r.team,ending:r.ending,shots:r.shots,evidence:r.evidence}))},score:session.core.score,freeThrowPresentation:freeThrows,threatCycles:cycleReport.cycles,technical:observer.technical,analysisMs:performance.now()-analysisStart,runtimeMs:performance.now()-started},null,2));assert.deepEqual(fingerprint(),sources);console.log(JSON.stringify({league,index,complete:true,score:session.core.score,possessions:Object.values(economy.teams).map(t=>t.possessions),losses:Object.values(economy.teams).map(t=>t.broadBallLosses),frikast:freeThrows.counts,runtimeMs:Math.round(performance.now()-started)}));
 }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
