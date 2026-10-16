/** Sequential descriptive tick timing, including changed workloads/decisions. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import type * as Match from '@handball-manager/handball-engine/src/v2/core/match';
import type * as Engine from '@handball-manager/handball-engine/src/v2/core/engine';
async function main(){
 const root=resolve('../..'),rows=[];for(const variant of ['before','after']){
  const dir=join(root,variant==='before'?'.tmp/player-attributes-before/packages/handball-engine/src/v2/core':'packages/handball-engine/src/v2/core');
  const load=async<T>(name:string)=>{const m=await import(pathToFileURL(join(dir,name+'.ts')).href);return(m.default??m)as T;};const {createMatch}=await load<typeof Match>('match'),{advanceCoreMutable}=await load<typeof Engine>('engine');
  const times:number[]=[],hashes:string[]=[];for(let i=0;i<4;i++){const core=createMatch(8123,'TOP',1800000,0),start=performance.now();for(let t=0;t<3000;t++)advanceCoreMutable(core);times.push(performance.now()-start);hashes.push(createHash('sha256').update(JSON.stringify(core)).digest('hex'));}assert.equal(new Set(hashes).size,1);const measured=times.slice(1).sort((a,b)=>a-b);rows.push({variant,ticks:3000,warmupMs:times[0],measuredMs:times.slice(1),medianMs:measured[1],sameSeedDeterministic:true,finalHash:hashes[0]});
 }
 const result={complete:true,rows,afterOverBefore:rows[1].medianMs/rows[0].medianMs,scope:'Three measured repeats after one warmup per source, strictly sequential. Workloads and canonical decisions differ after integration; this is descriptive wall time, not isolated instruction overhead or a universal UI performance claim. Profile normalization stays at population boundaries; mutable fatigue is never cached.'};writeFileSync(join(root,'docs/player-attribute-integration-v1/PERFORMANCE.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
