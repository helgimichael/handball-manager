/** Matched actual contact/shoulder continuations; passive, sequential and bounded. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import type * as States from '@handball-manager/handball-engine/src/v2/core/state';
import type * as Profiles from '@handball-manager/handball-engine/src/v2/core/profile';
import type * as Actions from '@handball-manager/handball-engine/src/v2/core/actions';
import type * as Contacts from '@handball-manager/handball-engine/src/v2/core/contact';
import type * as Scenarios from '@handball-manager/handball-engine/src/v2/core/contactScenarios';
import type * as Engine from '@handball-manager/handball-engine/src/v2/core/engine';
async function main(){
 const root=resolve('../..'),out=join(root,'docs/player-attribute-integration-v1/DEFENSIVE-CONSEQUENCES.json');assert.ok(!existsSync(out),'Keep completed consequence evidence');
 const reference=JSON.parse(readFileSync(join(root,'docs/player-attribute-integration-v1/controlled/after/handling.json'),'utf8')),ranges=reference.ranges as Record<string,{p10:number;median:number;p90:number}>,base=Object.fromEntries(Object.entries(ranges).map(([k,r])=>[k,r.median]));
 const rows=[],sourceFingerprints:Record<string,Record<string,string>>={},keys=['LATERAL_DEFENCE','DEFENSIVE_TIMING','DEFENSIVE_POSITIONING','COVERING','SWITCHING_HANDOVER'];
 for(const variant of ['before','after']as const){
  const dir=join(root,variant==='before'?'.tmp/player-attributes-before/packages/handball-engine/src/v2/core':'packages/handball-engine/src/v2/core');
  const fingerprint=()=>Object.fromEntries(readdirSync(dir).filter(n=>n.endsWith('.ts')&&!n.endsWith('.test.ts')).map(n=>[n,createHash('sha256').update(readFileSync(join(dir,n))).digest('hex')]));sourceFingerprints[variant]=fingerprint();
  const load=async<T>(name:string)=>{const m=await import(pathToFileURL(join(dir,name+'.ts')).href);return(m.default??m)as T;};
  const {createContactScenario}=await load<typeof Scenarios>('contactScenarios'),{getPlayer}=await load<typeof States>('state'),{buildProfile}=await load<typeof Profiles>('profile'),{startAction}=await load<typeof Actions>('actions'),{planContact}=await load<typeof Contacts>('contact'),{advanceCoreMutable}=await load<typeof Engine>('engine');
  for(const context of ['FRONTAL_CONTACT','SHOULDER_BREAKTHROUGH']as const)for(const tier of ['low','mid','high']as const){
   const raw={...base,...Object.fromEntries(keys.map(k=>[k,ranges[k][tier==='low'?'p10':tier==='mid'?'median':'p90']]))},trials=[];
   for(let i=0;i<384;i++){
    const seed=72683+i*104729,s=createContactScenario(context,seed),a=getPlayer(s,'H03'),d=getPlayer(s,'A03'),target={...a.action!.target!};
    for(const p of s.players){p.profile=buildProfile(p.id===d.id?raw:base,p.role);p.action=null;}
    // Restage commitments after profile normalization, preserving fixture bodies.
    s.rng={algorithm:'mulberry32',state:seed>>>0,draws:0};s.events=[];s.contests=[];s.nextId=1;
    assert.ok(startAction(s,a,'DRIVE','Same actual attacked shoulder',target,d.id));
    if(context==='FRONTAL_CONTACT')assert.ok(planContact(s,d,a));else assert.ok(startAction(s,d,'CONTAIN','Same initially defended shoulder',{...d.position},a.id));
    let helpRequired=false,helpTicks=0,ticks=0;
    for(;ticks<160&&s.status==='RUNNING';ticks++){
     advanceCoreMutable(s);const helping=s.players.some(p=>p.team===d.team&&p.id!==d.id&&p.duty.kind==='HELP');helpRequired||=helping;helpTicks+=Number(helping);
    }
    const related=(e:States.CoreEvent)=>e.actorId===d.id||e.relatedIds.includes(d.id);
    const beaten=s.events.some(e=>e.type==='DEFENDER_BEATEN'&&related(e)),recovered=s.events.some(e=>e.type==='DEFENDER_RECOVERED'&&e.actorId===d.id);
    trials.push({beaten,recovered,helpRequired,helpTicks,ticks,legalContact:s.events.some(e=>e.type==='LEGAL_CONTACT'&&e.actorId===d.id),foul:s.events.some(e=>e.type==='FOUL'&&related(e)),goal:s.events.some(e=>e.type==='GOAL'&&e.actorId&&s.players.find(p=>p.id===e.actorId)?.team===a.team),outcome:s.checkpoint.outcome,status:s.status,rng:s.rng});
   }
   rows.push({variant,context,tier,n:384,raw:Object.fromEntries(keys.map(k=>[k,raw[k]])),beaten:trials.filter(t=>t.beaten).length,recovered:trials.filter(t=>t.recovered).length,recoveredAfterBeaten:trials.filter(t=>t.beaten&&t.recovered).length,helpRequired:trials.filter(t=>t.helpRequired).length,meanHelpTicks:trials.reduce((n,t)=>n+t.helpTicks,0)/384,legalContact:trials.filter(t=>t.legalContact).length,foul:trials.filter(t=>t.foul).length,attackingGoal:trials.filter(t=>t.goal).length,censoredAt160:trials.filter(t=>t.status==='RUNNING').length,digest:createHash('sha256').update(JSON.stringify(trials)).digest('hex')});
  }
  assert.deepEqual(fingerprint(),sourceFingerprints[variant],'Consequence source is frozen');
 }
 const result={complete:true,nPerCell:384,rows,keys,physicalKeysHeldAtMedian:true,seedPolicy:'Same seed family, actual median other profiles, identical contact/shoulder fixture geometry; restaged commitments after profile normalization, action RNG reset after construction.',scope:'Real canonical continuations up to160 ticks (8 seconds) or the first canonical checkpoint outcome. DEFENDER_BEATEN is physical shoulder crossing, not FEINT_READ. Help means an actual other defender assigned HELP during the window; legal contact/foul are actual events. Recovery is an actual DEFENDER_RECOVERED event; stopped/unfinished opportunities are censored, not inferred successes/failures. Whole defensive profiles vary together; these are not isolated per-key effects or league expectations. Flat or non-monotonic rates are retained.',source:'Before7aa6acd snapshot and frozen final canonical source; exact gameplay identities accompany the main controlled receipts. No production source, input rating, outcome quota or diagnostic feedback is added.'};
 writeFileSync(out,JSON.stringify({...result,sourceFingerprints},null,2)+'\n');console.log(JSON.stringify({complete:true,cells:rows.length,nPerCell:384,rows}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
