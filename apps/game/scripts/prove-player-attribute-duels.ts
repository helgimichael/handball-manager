/** Paired canonical feints: retained breakthrough logic, now beside control/footwork. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import type * as States from '@handball-manager/handball-engine/src/v2/core/state';
import type * as Profiles from '@handball-manager/handball-engine/src/v2/core/profile';
import type * as Actions from '@handball-manager/handball-engine/src/v2/core/actions';
import type * as Interactions from '@handball-manager/handball-engine/src/v2/core/interactions';
import type * as Scenarios from '@handball-manager/handball-engine/src/v2/core/scenarios';
async function main(){
 const root=resolve('../..'),out=join(root,'docs/player-attribute-integration-v1'),reference=JSON.parse(readFileSync(join(out,'controlled/after/handling.json'),'utf8')),ranges=reference.ranges,base=Object.fromEntries(Object.entries(ranges).map(([k,r])=>[k,(r as {median:number}).median])),rows=[];
 for(const variant of ['before','after']){
  const dir=join(root,variant==='before'?'.tmp/player-attributes-before/packages/handball-engine/src/v2/core':'packages/handball-engine/src/v2/core');
  const load=async<T>(name:string)=>{const m=await import(pathToFileURL(join(dir,name+'.ts')).href);return(m.default??m)as T;};
  const {createCoreScenario}=await load<typeof Scenarios>('scenarios'),{getPlayer}=await load<typeof States>('state'),{buildProfile}=await load<typeof Profiles>('profile'),{startAction}=await load<typeof Actions>('actions'),{resolveEffects}=await load<typeof Interactions>('interactions');
  for(const actor of ['attacker','defender'])for(const tier of ['low','mid','high']){
   const keys=actor==='attacker'?['BREAKTHROUGH']:['LATERAL_DEFENCE','DEFENSIVE_TIMING'],raw={...base,...Object.fromEntries(keys.map(k=>[k,ranges[k][tier==='low'?'p10':tier==='mid'?'median':'p90']]))},trials=[];
   for(let i=0;i<384;i++){
    const seed=72683+i*104729,s=createCoreScenario('ESTABLISHED_6V6',seed),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');for(const p of s.players)if(p.id!==a.id&&p.id!==d.id)p.population='BENCH';s.rng={algorithm:'mulberry32',state:seed>>>0,draws:0};a.profile=buildProfile(actor==='attacker'?raw:base,'CB');d.profile=buildProfile(actor==='defender'?raw:base,'CB');a.position={x:10,y:10};d.position={x:10,y:9.1};s.ball.controllerId=a.id;s.ball.position={...a.position};s.ball.live=true;s.defence.pressureId=d.id;
    assert.ok(startAction(s,d,'CONTAIN','Same reached defensive body',{...d.position},a.id));d.action!.phase='EXECUTING';assert.ok(startAction(s,a,'FEINT','Same actual feint',null,d.id));a.action!.phase='EXECUTING';resolveEffects(s,[{playerId:a.id,kind:'FEINT'}]);const duel=s.contests.find(c=>c.kind==='DUEL');assert.ok(duel);trials.push({wrongFooted:duel.outcome==='WRONG_FOOTED',margin:duel.margin,rng:s.rng});
   }
   rows.push({variant,actor,tier,keys,raw:Object.fromEntries(keys.map(k=>[k,raw[k]])),n:384,wrongFooted:trials.filter(t=>t.wrongFooted).length,meanMargin:trials.reduce((n,t)=>n+t.margin,0)/384,digest:createHash('sha256').update(JSON.stringify(trials)).digest('hex')});
  }
 }
 const result={complete:true,source:'Canonical resolveEffects/FEINT duel, matched reached geometry and normalized action RNG; no generic attacker-minus-defender replacement added.',rows};writeFileSync(join(out,'DUEL-EFFECTS.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
