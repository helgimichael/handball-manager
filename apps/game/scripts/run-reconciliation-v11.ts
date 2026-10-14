/** Sequential, resumable source-identical cohorts. Never launches two jobs. */
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import {spawn} from 'node:child_process';
import {aggregate} from '../lib/matchBenchmarks/report';import type {matchReport} from '../lib/matchBenchmarks/report';
const args=process.argv.slice(2),value=(key:string,fallback:string)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const key=value('--league','hbl'),count=Number(value('--count','80')),root=resolve('../..'),out=resolve(value('--out',`../../docs/reconciliation-v11/final/${key}`));
if(!['hbl','allsv'].includes(key)||!Number.isInteger(count)||count<1||count>80)throw Error('league hbl/allsv, count 1..80');
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(v:string)=>createHash('sha256').update(v).digest('hex');
const prior=join(root,'docs/post-intelligence-reconciliation/final',key),inputs=read(join(prior,'inputs.json')),references=read(join(prior,'references.json'));
const recipes=read(join(prior,'recipes.json')).slice(0,count) as {index:number;saveSeed:string;managerClubId:string;fixtureId?:string}[];
const core=join(root,'packages/handball-engine/src/v2/core'),paths=[...readdirSync(core).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>join(core,f)),resolve('lib/career/productionMatch.ts'),...['match-benchmarks.ts','lib/calibrationDiagnostics.ts','lib/reconciliationDiagnostics.ts','lib/attackCycleDiagnostics.ts'].map(f=>resolve('scripts',f)),...readdirSync(resolve('lib/matchBenchmarks')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>resolve('lib/matchBenchmarks',f))];
const fingerprints=()=>Object.fromEntries(paths.map(p=>[p.slice(root.length+1).replaceAll('\\','/'),hash(readFileSync(p,'utf8'))]));
const sources=fingerprints(),manifest={sources,inputHash:hash(JSON.stringify(inputs)),referenceHash:hash(JSON.stringify(references)),baseline:prior};
mkdirSync(out,{recursive:true});const manifestPath=join(out,'manifest.json');
if(existsSync(manifestPath)&&JSON.stringify(read(manifestPath))!==JSON.stringify(manifest))throw Error('Source/input drift: keep old evidence, use a new directory');
for(const[name,data]of Object.entries({'manifest.json':manifest,'inputs.json':inputs,'references.json':references,'recipes.json':recipes}))writeFileSync(join(out,name),JSON.stringify(data,null,2));
async function run(){
 const reports:ReturnType<typeof matchReport>[]=[],proofs:unknown[]=[],timings:unknown[]=[];
 for(let start=0;start<count;){
  const dir=join(out,`chunk-${String(start).padStart(3,'0')}`),summaryPath=join(dir,'summary.json');
  // A completed smaller pilot chunk can be retained when extending to N=80.
  const size=existsSync(summaryPath)?read(summaryPath).matches:8;
  if(!Number.isInteger(size)||size<1||size>8)throw Error('Invalid retained chunk size');
  const chunk=recipes.slice(start,start+size);
  if(!existsSync(summaryPath)){
   if(existsSync(dir)&&readdirSync(dir).some(f=>/^match-/.test(f)))throw Error('Partial match-bearing chunk retained: inspect '+dir);
   const cli=['--import','tsx','scripts/match-benchmarks.ts','--mode','calibration','--count',String(chunk.length),'--indices',chunk.map(r=>r.index).join(','),'--seeds',chunk.map(r=>r.saveSeed).join(','),'--inputs',join(out,'inputs.json'),'--reference',join(out,'references.json'),'--competition',inputs.competitionId,'--out',dir,'--causal','--intelligence','--reconciliation','--v11','--compact'];
   if(start===0&&args.includes('--prove'))cli.push('--prove');if(chunk.every(r=>r.fixtureId))cli.push('--fixtures',chunk.map(r=>r.fixtureId).join(','));
   console.log(`${key}: starting ${start}..${start+chunk.length-1}`);
   await new Promise<void>((done,fail)=>{const child=spawn(process.execPath,cli,{cwd:process.cwd(),stdio:'inherit'});child.once('error',fail);child.once('exit',code=>code===0?done():fail(Error('Chunk exit '+code)));});
  }else console.log(`${key}: reusing ${start}..${start+chunk.length-1}`);
  const summary=read(summaryPath);if(!summary.metadata.sourceStable||summary.matches!==chunk.length||summary.metadata.inputHash!==manifest.inputHash)throw Error('Invalid receipt '+dir);
  for(const recipe of chunk){const id=String(recipe.index).padStart(3,'0');for(const prefix of ['match','causal','intelligence','reconciliation','cycles'])if(!existsSync(join(dir,`${prefix}-${id}.json`)))throw Error('Missing '+prefix+' '+id);const r=read(join(dir,`match-${id}.json`));if(r.metadata.recipe.saveSeed!==recipe.saveSeed||r.metadata.recipe.managerClubId!==recipe.managerClubId||recipe.fixtureId&&r.metadata.fixture.id!==recipe.fixtureId)throw Error('Recipe drift');reports.push(r);}
  proofs.push(...summary.metadata.proofs);timings.push(...summary.metadata.timings);if(JSON.stringify(fingerprints())!==JSON.stringify(sources))throw Error('Source changed during cohort');
  start+=chunk.length;
 }
 writeFileSync(join(out,'summary.json'),JSON.stringify({metadata:{...manifest,sourceStable:true,count,proofs,timings,execution:'SEQUENTIAL: one child at a time'},...aggregate(reports)},null,2));console.log(`${key}: COMPLETE ${count}`);
}
run().catch(e=>{console.error(e);process.exitCode=1;});
