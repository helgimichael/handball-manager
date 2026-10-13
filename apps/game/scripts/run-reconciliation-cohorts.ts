/** Resumable developer-only cohorts. Completed, source-identical chunks are reused. */
import {readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {aggregate} from '../lib/matchBenchmarks/report';
import type {matchReport} from '../lib/matchBenchmarks/report';
type MatchReport=ReturnType<typeof matchReport>;

const args=process.argv.slice(2),value=(key:string,fallback:string)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const count=Number(value('--count','80')),root=resolve('../..');
if(!Number.isInteger(count)||count<1||count>100)throw Error('count must be 1..100');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const hash=(data:string)=>createHash('sha256').update(data).digest('hex');
const core=join(root,'packages/handball-engine/src/v2/core');
const sourcePaths=[...readdirSync(core).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>join(core,f)),resolve('lib/career/productionMatch.ts'),resolve('scripts/match-benchmarks.ts'),resolve('scripts/lib/calibrationDiagnostics.ts'),resolve('scripts/lib/reconciliationDiagnostics.ts'),...readdirSync(resolve('lib/matchBenchmarks')).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>resolve('lib/matchBenchmarks',f))];
const fingerprints=()=>Object.fromEntries(sourcePaths.map(p=>[p.slice(root.length+1).replaceAll('\\','/'),hash(readFileSync(p,'utf8'))]));
const sources=fingerprints();
async function cohort(key:'hbl'|'allsv'){
 const baseline=join(root,'docs/match-intelligence-v1/delivery',key),out=join(root,'docs/post-intelligence-reconciliation/final',key);
 mkdirSync(out,{recursive:true});
 const inputs=read(join(root,'docs/post-intelligence-reconciliation/development/final-mechanisms-'+key,'inputs.json'));
 const inputPath=join(out,'inputs.json'),referencePath=join(out,'references.json');
 const references=read(join(baseline,'references.json'));
 const recipePath=join(baseline,'recipes.json');
 const oldRecipes=read(recipePath) as {index:number;saveSeed:string;managerClubId:string;fixtureId?:string}[];
 const recipes=Array.from({length:count},(_,index)=>{
   const old=oldRecipes.find(r=>r.index===index);
   const managerClubId=inputs.clubs[index%inputs.clubs.length];
   if(old&&old.managerClubId!==managerClubId)throw Error('Changed club pool');
   const original=old?read(join(baseline,`match-${String(index).padStart(3,'0')}.json`)):null;
   return{index,saveSeed:old?.saveSeed??`match-realism-v2-canonical-2026:${index}`,managerClubId,fixtureId:original?.metadata.fixture.id};
 });
 const manifest={sources,inputHash:hash(JSON.stringify(inputs)),referenceHash:hash(JSON.stringify(references)),baseline:recipePath};
 const manifestPath=join(out,'manifest.json');
 if(existsSync(manifestPath)&&JSON.stringify(read(manifestPath))!==JSON.stringify(manifest))throw Error('Cohort source/input changed; retain old evidence and choose a new cohort directory');
 writeFileSync(manifestPath,JSON.stringify(manifest,null,2));
 writeFileSync(inputPath,JSON.stringify(inputs));writeFileSync(referencePath,JSON.stringify(references));writeFileSync(join(out,'recipes.json'),JSON.stringify(recipes,null,2));
 const reports:MatchReport[]=[],proofs:unknown[]=[],timings:unknown[]=[];
 for(let start=0;start<count;start+=8){
   const chunk=recipes.slice(start,start+8),dir=join(out,`chunk-${String(start).padStart(3,'0')}`),summaryPath=join(dir,'summary.json');
   if(!existsSync(summaryPath)){
     if(existsSync(dir)&&readdirSync(dir).some(f=>f.startsWith('match-')))throw Error(`Partial chunk retained at ${dir}; inspect before rerun`);
     const cli=['--import','tsx','scripts/match-benchmarks.ts','--mode','calibration','--count',String(chunk.length),'--indices',chunk.map(r=>r.index).join(','),'--seeds',chunk.map(r=>r.saveSeed).join(','),'--inputs',inputPath,'--reference',referencePath,'--competition',inputs.competitionId,'--out',dir,'--causal','--intelligence','--reconciliation','--compact'];
     if(start===0)cli.push('--prove');
     if(chunk.every(r=>r.fixtureId))cli.push('--fixtures',chunk.map(r=>r.fixtureId).join(','));
     console.log(`${key}: starting ${start}..${start+chunk.length-1}`);
     await new Promise<void>((done,fail)=>{const child=spawn(process.execPath,cli,{cwd:process.cwd(),stdio:'inherit'});child.once('error',fail);child.once('exit',code=>code===0?done():fail(Error(`Chunk exited ${code}`)));});
   }else console.log(`${key}: reusing completed ${start}..${start+chunk.length-1}`);
   const summary=read(summaryPath);
   if(!summary.metadata.sourceStable||summary.matches!==chunk.length||summary.metadata.inputHash!==manifest.inputHash)throw Error(`Invalid receipt ${summaryPath}`);
   for(const recipe of chunk){
     const id=String(recipe.index).padStart(3,'0');
     for(const prefix of ['match','causal','intelligence','reconciliation'])if(!existsSync(join(dir,`${prefix}-${id}.json`)))throw Error(`Missing ${prefix} ${id}`);
     const report=read(join(dir,`match-${id}.json`));
     if(report.metadata.recipe.saveSeed!==recipe.saveSeed||report.metadata.recipe.managerClubId!==recipe.managerClubId||recipe.fixtureId&&report.metadata.fixture.id!==recipe.fixtureId)throw Error('Recipe drift');
     reports.push(report);
   }
   proofs.push(...summary.metadata.proofs);timings.push(...summary.metadata.timings);
   if(JSON.stringify(fingerprints())!==JSON.stringify(sources))throw Error('Source changed during cohort');
 }
 const summary=aggregate(reports);
 writeFileSync(join(out,'summary.json'),JSON.stringify({metadata:{...manifest,sourceStable:true,count,proofs,timings,pairedIntelligence:Math.min(count,40),pairedEmpiricalCalibration:Math.min(count,20)},...summary},null,2));
 console.log(`${key}: COMPLETE ${count} matches`);
}
Promise.all([cohort('hbl'),cohort('allsv')]).catch(error=>{console.error(error);process.exitCode=1;});
