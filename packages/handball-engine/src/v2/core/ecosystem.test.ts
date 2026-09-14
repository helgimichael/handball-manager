import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch,matchBefore } from './match';
import { createCoreScenario } from './scenarios';
import { advanceCoreMutable,assertCore } from './engine';
import { getPlayer,record } from './state';
import { requestTeamTimeout } from './referee';
import { conditionAfter,requestTreatment } from './condition';
import { requestExchange,populationBefore,populationAfter } from './population';
import { setTactics } from './coaching';
import { awardRestart,foul } from './transitions';
import { showPassiveWarning,passiveAfter } from './passive';
import { saveCore,loadCore,coreHash } from './replay';

function liveMatch(){const s=createMatch(7,'TOP',60000,1000);while((!s.ball.live||!s.ball.controllerId)&&s.status==='RUNNING')advanceCoreMutable(s);return s;}
test('team timeout requires possession and a half allowance; official time freezes for a minute and resumes by whistle',()=>{
  const s=liveMatch();assert.equal(requestTeamTimeout(s,'AWAY'),false);
  assert.ok(showPassiveWarning(s,'Fixture circulation'));s.referee.passive.passes=2;
  assert.equal(requestTeamTimeout(s,'HOME'),true);const time=s.officialClock.timeMs,tick=s.tick;
  const copy=structuredClone(loadCore(saveCore(s)));
  for(let i=0;i<1200;i++){advanceCoreMutable(s);advanceCoreMutable(copy);assert.equal(s.officialClock.timeMs,time);}
  assert.equal(coreHash(copy),coreHash(s));assert.ok(s.events.some(e=>e.type==='TEAM_TIMEOUT_TEN_SECONDS'&&e.tick===tick+1000));
  assert.equal(s.referee.passive.passes,2);assert.equal(requestTeamTimeout(s,'HOME'),false);
  while(!s.officialClock.running&&s.status==='RUNNING')advanceCoreMutable(s);
  assert.equal(s.status,'RUNNING',s.reason??'');assert.equal(s.officialClock.running,true);assertCore(s);
});
test('timeout preserves the awarded throw and excludes the pause from preparation budget',()=>{
  const s=liveMatch();awardRestart(s,'THROW_IN','HOME',{x:0,y:20},'Fixture',null,false);
  const id=s.restart!.id;assert.ok(requestTeamTimeout(s,'HOME'));
  while(!s.events.some(e=>e.type==='RESTART_COMPLETED'&&e.tick>1000)&&s.status==='RUNNING')advanceCoreMutable(s);
  assert.equal(s.status,'RUNNING',s.reason??'');assert.equal(s.restart!.id,id);assert.ok(s.restart!.pausedTicks>=1199);
});
test('fatigue follows activity and recovers at rest without mutating attributes',()=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03'),attributes={...p.attributes};p.velocity={x:4,y:0};
  for(let i=0;i<10000;i++)conditionAfter(s);
  const tired=p.condition.energy;assert.ok(tired<.9);assert.ok(p.condition.distanceMetres>1900);
  s.officialClock.running=false;for(let i=0;i<1000;i++)conditionAfter(s);
  assert.ok(p.condition.energy>tired);assert.deepEqual(p.attributes,attributes);
});
test('medical exit, three attacking possessions and permanent injury constrain re-entry',()=>{
  const s=liveMatch(),p=getPlayer(s,'H02');assert.ok(requestTreatment(s,p,'Observed injury'));
  populationBefore(s);assert.ok(s.exchanges.some(e=>e.outId===p.id));
  p.population='BENCH';p.condition.exitRequired=false;s.exchanges=[];
  assert.equal(requestExchange(s,'HOME','H01',p.id),false);
  for(let i=0;i<3;i++) {
    s.possession={...s.possession,id:`away-${i}`,team:'AWAY'};conditionAfter(s);
    s.possession={...s.possession,id:`home-${i}`,team:'HOME'};conditionAfter(s);
  }
  assert.equal(p.condition.attacksRemaining,0);assert.ok(requestExchange(s,'HOME','H01',p.id));
  s.exchanges=[];p.condition.unavailable=true;assert.equal(requestExchange(s,'HOME','H01',p.id),false);
});
test('sanction during a queued exchange cancels it; expired disqualification permits replacement only',()=>{
  const s=liveMatch();assert.ok(requestExchange(s,'AWAY','A03','A09'));
  const d=getPlayer(s,'A03');d.sanctions=2;foul(s,getPlayer(s,'H03'),d,true,false,'fixture');populationBefore(s);
  assert.equal(s.exchanges[0].phase,'CANCELLED');assert.equal(d.population,'DISQUALIFIED');
  s.officialClock.timeMs=d.suspensionUntilMs!;populationBefore(s);
  assert.ok(s.exchanges.some(e=>e.outId===null&&getPlayer(s,e.inId).team==='AWAY'));assert.equal(d.population,'DISQUALIFIED');
});
test('tactics persist across possessions and terminal mutable ticks are no-ops',()=>{
  const s=liveMatch();setTactics(s,'HOME',{defence:'5:1',tempo:'QUICK'});
  awardRestart(s,'FREE_THROW','AWAY',{x:10,y:20},'Turnover',null,false);
  assert.equal(s.coaching.HOME.defence,'5:1');
  while(s.status==='RUNNING')advanceCoreMutable(s);
  const hash=coreHash(s);advanceCoreMutable(s);assert.equal(coreHash(s),hash);
});
test('blocked shots retain warning, count before four, and permit one continuation after four',()=>{
  const s=createCoreScenario();s.checkpoint.stopOnOutcome=false;showPassiveWarning(s,'Fixture');s.referee.passive.passes=2;
  record(s,'SHOT_BLOCKED',getPlayer(s,'A03'));record(s,'REBOUND_CONTROLLED',getPlayer(s,'H03'));passiveAfter(s);
  assert.equal(s.referee.passive.passes,3);s.referee.passive.passes=4;
  record(s,'SHOT_BLOCKED',getPlayer(s,'A03'));record(s,'REBOUND_CONTROLLED',getPlayer(s,'H03'));passiveAfter(s);
  record(s,'PASS_RECEIVED',getPlayer(s,'H04'));passiveAfter(s);assert.equal(s.restart,null);
  record(s,'PASS_RECEIVED',getPlayer(s,'H03'));passiveAfter(s);assert.equal(structuredClone(s).restart?.owner,'AWAY');
});
test('vacancy filling never adds a second keeper, and a reused extra player adopts P2 on goalkeeper exit',()=>{
  const s=liveMatch();getPlayer(s,'A06').population='DISQUALIFIED';getPlayer(s,'A06').suspensionUntilMs=0;
  populationBefore(s);
  const vacancy=s.exchanges.find(e=>e.team==='AWAY')!;
  assert.equal(getPlayer(s,vacancy.inId).kind,'FIELD_PLAYER');assert.equal(getPlayer(s,vacancy.inId).role,'P');
  const extra=getPlayer(s,'H08');extra.role='LW';assert.ok(requestExchange(s,'HOME','H07',extra.id));
  const e=s.exchanges.find(e=>e.team==='HOME')!;getPlayer(s,'H07').population='BENCH';e.phase='ENTERING';extra.population='COURT';extra.position={x:.65,y:e.gate.y};
  populationAfter(s);assert.equal(extra.role,'P2');assert.equal(s.flow.sevenVTeam,'HOME');
  s.possession.team='AWAY';populationBefore(s);assert.ok(s.exchanges.some(e=>e.outId===extra.id&&e.inId==='H07'&&e.phase==='WAIT_EXIT'));
});
test('a warned live continuation remains exact through a medical interruption and both halves',()=>{
  const s=liveMatch();assert.ok(showPassiveWarning(s,'Observed unproductive play'));
  assert.ok(requestTreatment(s,getPlayer(s,'H02'),'Physical injury input'));
  const resumed=structuredClone(loadCore(saveCore(s)));
  while(s.status==='RUNNING')advanceCoreMutable(s);
  while(resumed.status==='RUNNING')advanceCoreMutable(resumed);
  assert.equal(s.match?.phase,'FULLTIME',s.reason??'');assert.equal(coreHash(resumed),coreHash(s));
  assert.ok(s.events.some(e=>e.type==='SHOT_RELEASED'));assert.ok(s.events.some(e=>e.type==='PASSIVE_WARNING_CANCELLED'));assertCore(s);
});
test('the next half clears the medical attack restriction but not permanent unavailability',()=>{
  const s=liveMatch(),p=getPlayer(s,'H02');p.condition.attacksRemaining=2;p.condition.unavailable=true;
  s.match!.phase='HALFTIME';s.match!.resumeTick=s.tick;matchBefore(s);
  assert.equal(p.condition.attacksRemaining,0);assert.equal(p.condition.unavailable,true);
  assert.throws(()=>createMatch(1,'TOP',60000,Infinity),/timing/);
});
