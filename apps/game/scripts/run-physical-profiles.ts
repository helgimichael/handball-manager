/** Cheap matched absolute-work trials; a causal experiment, not full matches. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {createCoreScenario} from '@handball-manager/handball-engine/src/v2/core/scenarios';
import {buildProfile,OUTCOURT_KEYS} from '@handball-manager/handball-engine/src/v2/core/profile';
import {conditionAfter,recoverAtRest,accelerationCapacity,difficultExecutionCapacity} from '@handball-manager/handball-engine/src/v2/core/condition';
import {physicalImpulse} from '@handball-manager/handball-engine/src/v2/core/physicalLoad';
const args=process.argv.slice(2),value=(k:string,d:string)=>args.includes(k)?args[args.indexOf(k)+1]:d,out=resolve(value('--out','../../docs/physical-load-fatigue-v11/final/profiles')),count=Number(value('--count','30'));
const keys=['ACCELERATION','TOP_SPEED','LATERAL_QUICKNESS','AGILITY','EXPLOSIVENESS','STRENGTH','CONTACT_BALANCE','JUMP_ABILITY','ENDURANCE','REPEAT_SPRINT_ABILITY','MOBILITY'] as const;
const root=resolve('../..'),core=join(root,'packages/handball-engine/src/v2/core'),paths=[...readdirSync(core).filter(f=>f.endsWith('.ts')&&!f.endsWith('.test.ts')).map(f=>join(core,f)),resolve('scripts/run-physical-profiles.ts')];
const hash=(v:string)=>createHash('sha256').update(v).digest('hex'),fingerprints=()=>Object.fromEntries(paths.map(p=>[p.slice(root.length+1).replaceAll('\\','/'),hash(readFileSync(p,'utf8'))]));
mkdirSync(out,{recursive:true});const sources=fingerprints();if(existsSync(join(out,'summary.json')))throw Error('Completed profiles exist; choose a new output');
function run(index:number,attribute:number){const s=createCoreScenario(),p=s.players.find(p=>p.id==='H03')!;s.players=[p];s.officialClock.running=true;
 p.profile=buildProfile({...Object.fromEntries(OUTCOURT_KEYS.map(k=>[k,13])),...Object.fromEntries(keys.map(k=>[k,attribute]))},'LB');p.condition.energy=.8;
 const seconds=180+index*3;for(let tick=0;tick<seconds*20;tick++){const sec=tick/20,phase=(sec+index)%30;
  const speed=phase<8?4.8:phase<12?3:phase<18?0:phase<23?2.3:phase<27?3.5:0,angle=Math.sin(sec*.7+index)*.7+(phase<12?0:Math.PI);
  p.velocity={x:Math.cos(angle)*speed,y:Math.sin(angle)*speed};if(tick%240===0)physicalImpulse(p,'contact');if(tick%600===0)physicalImpulse(p,'jump');conditionAfter(s);
 }
 const after=structuredClone(p.condition),sameReserve=.45;p.condition.energy=sameReserve;const sameEnergy={energy:sameReserve,acute:p.condition.acuteExertion,acceleration:accelerationCapacity(p),simpleExecution:difficultExecutionCapacity(p,0,.8),difficultExecution:difficultExecutionCapacity(p,1,.8)};
 p.condition=structuredClone(after);const recovery=[10,120,300].map(seconds=>{p.condition=structuredClone(after);recoverAtRest(p,seconds*1000);return{seconds,energy:p.condition.energy,acute:p.condition.acuteExertion,acceleration:accelerationCapacity(p)};});
 return{attribute,seconds,profile:p.profile,after,sameEnergy,recovery};
}
const pairs=[];for(let index=0;index<count;index++){const weak=run(index,11),strong=run(index,16);for(const k of ['locomotor','acceleration','deceleration','turning','contact','jump'] as const)assert.equal(weak.after.physicalLoad![k],strong.after.physicalLoad![k]);assert.ok(strong.after.energy>weak.after.energy);assert.ok(strong.sameEnergy.acceleration>weak.sameEnergy.acceleration);pairs.push({index,weak,strong});}
assert.deepEqual(fingerprints(),sources);writeFileSync(join(out,'summary.json'),JSON.stringify({complete:true,count,sources,design:{technicalAttributes:13,weakPhysical:11,strongPhysical:16,sourceRange:'Retained Allsvenskan physical distribution: approximately p10=11, p90=15-16. No CA/PA.',work:'Identical absolute movement, direction changes, contact and takeoffs, 180-267 seconds; on-court reserve starts .8; no tactic/position cost.'},pairs},null,2));console.log(JSON.stringify({complete:true,count,meanReserveBenefit:pairs.reduce((n,p)=>n+p.strong.after.energy-p.weak.after.energy,0)/count}));
