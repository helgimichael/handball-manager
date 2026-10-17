import test from 'node:test';
import assert from 'node:assert/strict';
import {createContinuous} from '@handball-manager/handball-engine/src/v2/core/continuous';
import {advanceCoreMutable} from '@handball-manager/handball-engine/src/v2/core/engine';
import {createContactScenario} from '@handball-manager/handball-engine/src/v2/core/contactScenarios';
import {getPlayer,record} from '@handball-manager/handball-engine/src/v2/core/state';
import {judgeFoul} from '@handball-manager/handball-engine/src/v2/core/referee';
import {resolveContacts} from '@handball-manager/handball-engine/src/v2/core/contact';
import {MatchStructureObserver,manpowerSnapshot,foulStructure,recordedStructure} from './matchStructureDiagnostics';
import {possessionEconomy} from './possessionEconomy';
import {createMatch} from '@handball-manager/handball-engine/src/v2/core/match';

test('the opt-in observer and all report readers preserve every canonical byte and RNG draw',()=>{
  const a=createContinuous(),b=structuredClone(a),observer=new MatchStructureObserver(b);
  for(let i=0;i<400;i++){
    advanceCoreMutable(a);const n=b.events.length;advanceCoreMutable(b);observer.observe(b,b.events.slice(n));
  }
  const before=JSON.stringify(b),first=observer.report(b),second=observer.report(b);
  assert.equal(JSON.stringify(a),before);assert.equal(JSON.stringify(b),before);assert.deepEqual(first,second);
  assert.equal(Object.values(first.byState).reduce((n,r)=>n+r.officialMs,0),b.officialClock.timeMs);
  assert.equal(Object.values(first.time).reduce((n,r)=>n+r.simulationMs,0),b.timeMs);
});
test('manpower snapshots expose actual IDs and separate keepers from field players',()=>{
  const s=createContinuous();judgeFoul(s,getPlayer(s,'H03'),getPlayer(s,'A02'),'SERIOUS','Fixture sanction',false,'fixture');
  const v=manpowerSnapshot(s);assert.equal(v.state,'6v5');assert.equal(v.sides.AWAY.courtIds.length,6);assert.deepEqual(v.sides.AWAY.keeperIds,['A07']);
  assert.equal(v.sides.AWAY.suspended[0].remainingMs,120000);assert.ok(!v.sides.AWAY.fieldIds.includes('A02'));
});
test('a stopped sanction timeout spends simulation time and zero official suspension time',()=>{
  const s=createContinuous();judgeFoul(s,getPlayer(s,'H03'),getPlayer(s,'A02'),'SERIOUS','Fixture sanction',false,'fixture');
  const observer=new MatchStructureObserver(s);
  for(let i=0;i<20;i++){const n=s.events.length;advanceCoreMutable(s);observer.observe(s,s.events.slice(n));}
  const report=observer.report(s);assert.equal(report.time.STOPPED_PERSONAL_SANCTION.officialMs,0);assert.equal(report.time.STOPPED_PERSONAL_SANCTION.simulationMs,1000);
});
test('contact evidence joins exactly one sanction to its original foul and physical context',()=>{
  const s=createContactScenario('LATE_HOLD');getPlayer(s,'A03').warnings=1;resolveContacts(s);
  const report=foulStructure(s);assert.equal(report.contacts,1);assert.equal(report.assessedFouls,1);assert.equal(report.sevenAndSuspension,1);
  assert.equal(report.rows[0].contact?.contactClass,'HOLDING');assert.equal(report.rows[0].penaltyIds.length,1);
  assert.deepEqual(report.integrity.multiplePenaltiesForFoul,[]);assert.deepEqual(report.integrity.unlinkedPenalties,[]);
});
test('ordinary foul diagnostics do not add a possession or mistake an assessment for a sanction',()=>{
  const s=createContinuous();record(s,'BALL_CONTROLLED',getPlayer(s,'H03'));const before=possessionEconomy(s).records.length;
  judgeFoul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'ORDINARY','Ordinary hold',false,'ordinary');
  const f=foulStructure(s);assert.equal(f.ordinaryFouls,1);assert.equal(f.freeThrows,1);assert.equal(f.personalReductions,0);
  assert.equal(possessionEconomy(s).records.length,before);assert.equal(s.possession.id,'possession-0');
});

test('recorded population transitions agree with actual live boundaries and full official/simulation duration',()=>{
  const s=createMatch(451,'TOP',5000,0),observer=new MatchStructureObserver(s);
  while(s.match?.phase==='PREMATCH'&&s.tick<10000){const n=s.events.length;advanceCoreMutable(s);observer.observe(s,s.events.slice(n));}
  assert.equal(s.match?.phase,'FIRST_HALF');
  const n=s.events.length;judgeFoul(s,getPlayer(s,'H03'),getPlayer(s,'A02'),'SERIOUS','Staged short-handed opening',false,'opening');observer.observe(s,s.events.slice(n));
  for(let i=0;i<10000&&s.status==='RUNNING';i++){const n=s.events.length;advanceCoreMutable(s);observer.observe(s,s.events.slice(n));}
  assert.equal(s.match?.phase,'FULLTIME');const live=observer.report(s),read=recordedStructure(s);assert.ok(read.finalPopulationExact);
  assert.equal(read.totals.officialMs,s.officialClock.timeMs);assert.equal(read.totals.simulationMs,s.timeMs);
  for(const[k,v]of Object.entries(live.byState)){assert.equal(v.officialMs,read.byState[k]?.officialMs??0);assert.equal(v.simulationMs,read.byState[k]?.simulationMs??0);}
  for(const b of live.boundaries){const historical=read.boundaries.findLast(h=>h.tick<=b.tick)!;for(const team of ['HOME','AWAY']as const)assert.deepEqual(historical.court[team].slice().sort(),b.sides[team].courtIds.slice().sort());}
});
