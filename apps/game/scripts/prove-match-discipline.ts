/** Before/after causal probes for two demonstrated discipline branch defects. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import type * as State from '@handball-manager/handball-engine/src/v2/core/state';
import type * as Referee from '@handball-manager/handball-engine/src/v2/core/referee';
import type * as Engine from '@handball-manager/handball-engine/src/v2/core/engine';
import type * as Fixture from '@handball-manager/handball-engine/src/v2/core/contactScenarios';
import type * as Continuous from '@handball-manager/handball-engine/src/v2/core/continuous';
import type * as Actions from '@handball-manager/handball-engine/src/v2/core/actions';
import type * as Transition from '@handball-manager/handball-engine/src/v2/core/transitions';

async function main(){
  const before=process.argv.includes('--before'),variant=before?'before':'after',root=resolve('../..'),out=join(root,`docs/match-structure-manpower-v1/DISCIPLINE-${variant.toUpperCase()}.json`);assert.ok(!existsSync(out));
  const dir=join(root,before?'.tmp/match-structure-before/packages/handball-engine/src/v2/core':'packages/handball-engine/src/v2/core');
  const load=async<T>(n:string)=>{const m=await import(pathToFileURL(join(dir,n+'.ts')).href);return(m.default??m)as T;};
  const {getPlayer}=await load<typeof State>('state'),{judgeFoul,refereeAfter}=await load<typeof Referee>('referee'),{advanceCoreMutable}=await load<typeof Engine>('engine'),{createContactScenario}=await load<typeof Fixture>('contactScenarios'),{createContinuous}=await load<typeof Continuous>('continuous'),{startAction}=await load<typeof Actions>('actions'),{interrupt}=await load<typeof Transition>('transitions');
  const airborne=[];
  for(const direction of ['TOP','BOTTOM']as const)for(const moving of [false,true])for(const warned of [false,true]){
    const s=createContactScenario('FRONTAL_CONTACT',2025,direction),a=getPlayer(s,'H03'),d=getPlayer(s,'A03');s.checkpoint.stopOnOutcome=false;d.warnings=warned?1:0;
    interrupt(s,a,'Controlled jump into the existing contact environment');assert.ok(startAction(s,a,'JUMP','Same actual takeoff'));
    if(moving)d.velocity={x:0,y:direction==='TOP'?.4:-.4};
    for(let i=0;i<4;i++)advanceCoreMutable(s);
    airborne.push({direction,moving,warned,tick:s.tick,contact:s.events.filter(e=>e.type==='CONTACT_EXECUTED').map(e=>e.details),takeoff:s.events.find(e=>e.type==='TAKEOFF'),fouls:s.events.filter(e=>e.type==='FOUL_ASSESSED'),sanctions:s.events.filter(e=>['WARNING','TWO_MINUTE_SUSPENSION','DISQUALIFICATION'].includes(e.type)),restart:s.restart?.kind??null});
  }
  const deferred=[];
  for(const warned of [false,true])for(const sameDefender of [false,true])for(const seriousSecond of [false,true]){
    const s=createContinuous(),a=getPlayer(s,'H03'),first=getPlayer(s,'A03'),second=getPlayer(s,sameDefender?'A03':'A04');first.warnings=warned?1:0;second.warnings=warned?1:0;
    assert.ok(startAction(s,a,'SHOOT','Controlled pending opportunity',null,null,'STANDING'));a.action!.phase='EXECUTING';
    judgeFoul(s,a,first,'CLEAR_CHANCE','First protected infringement',true,'first-contact');
    judgeFoul(s,a,second,seriousSecond?'SERIOUS':'PUNISHABLE','Further direct infringement',false,'second-contact');refereeAfter(s);
    deferred.push({warned,sameDefender,seriousSecond,restart:s.restart?.kind,sanctions:s.events.filter(e=>['WARNING','TWO_MINUTE_SUSPENSION','DISQUALIFICATION','DISCIPLINE_CASES_GROUPED'].includes(e.type)),fouls:s.events.filter(e=>e.type==='FOUL_ASSESSED'),players:[first,second].filter((p,i,a)=>a.indexOf(p)===i).map(p=>({id:p.id,warnings:p.warnings,sanctions:p.sanctions,population:p.population,untilMs:p.suspensionUntilMs}))});
  }
  const sourceFingerprints=Object.fromEntries(['sanction.ts','referee.ts','contact.ts','population.ts','actions.ts','engine.ts'].map(n=>[n,createHash('sha256').update(readFileSync(join(dir,n))).digest('hex')]));
  writeFileSync(out,JSON.stringify({complete:true,variant,sourceFingerprints,airborne,deferred,scope:'Actual takeoff/contact ticks for frontal cases; canonical referee assessment/recall for direct-sequence deferred cases. No probability or score coefficients altered.'},null,2)+'\n');
  console.log(JSON.stringify({complete:true,variant,airborne:airborne.map(r=>({direction:r.direction,moving:r.moving,warned:r.warned,contacts:r.contact.map(c=>c.severity),sanctions:r.sanctions.map(e=>e.type)})),deferred:deferred.map(r=>({warned:r.warned,same:r.sameDefender,serious:r.seriousSecond,sanctions:r.sanctions.map(e=>e.type)}))}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
