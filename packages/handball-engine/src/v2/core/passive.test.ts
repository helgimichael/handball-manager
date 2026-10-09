import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { getPlayer,record } from './state';
import { passiveAfter,showPassiveWarning } from './passive';
import { awardRestart,foul } from './transitions';
import { saveCore,loadCore,coreHash } from './replay';

function warned(){const s=createCoreScenario();s.checkpoint.stopOnOutcome=false;showPassiveWarning(s,'Observed unproductive circulation');return s;}
function pass(s:ReturnType<typeof warned>){record(s,'PASS_RECEIVED',getPlayer(s,'H04'),{passerId:'H03'});passiveAfter(s);}
test('passive warning counts completed passes and whistles at the fifth reception',()=>{
  const s=warned();for(let i=0;i<4;i++){pass(s);assert.equal(s.restart,null);}
  const saved=structuredClone(loadCore(saveCore(s)));pass(s);pass(saved);
  assert.equal(s.restart?.owner,'AWAY');assert.equal(s.restart?.kind,'FREE_THROW');assert.equal(coreHash(s),coreHash(saved));
});
test('a restart after the fourth pass grants one additional pass, not a fresh allowance',()=>{
  const s=warned();for(let i=0;i<4;i++)pass(s);
  awardRestart(s,'THROW_IN','HOME',{x:0,y:12},'Deflected out');passiveAfter(s);
  pass(s);assert.equal(s.restart?.owner,'HOME');assert.equal(s.referee.passive.passes,5);
  pass(s);assert.equal(s.restart?.owner,'AWAY');
});
test('defensive personal punishment cancels the warning and starts a new build-up allowance',()=>{
  const s=warned();pass(s);foul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'PUNISHABLE','Fixture body-directed foul',false,'contact');passiveAfter(s);
  assert.equal(s.referee.passive.warnedTick,null);assert.equal(s.referee.passive.passes,0);
  assert.ok(s.events.some(e=>e.type==='PASSIVE_WARNING_CANCELLED'));
});
// RE-PINNED. This used to assert that a carrier running forward in a DRIVE
// suppressed the warning, which is the model the engine no longer holds: with
// four hundred drives a match the clock was reset perpetually, the idle timer
// never reached eighteen seconds in a whole match, and attacks ran for seventy
// seconds and twenty-three passes without a shot or a whistle. A recognisable
// attempt to attack is now something that happened to the DEFENCE, so the same
// distinction is asserted against that instead.
test('warning judgment distinguishes a real attempt on the defence from stagnant circulation',()=>{
  const s=createCoreScenario();passiveAfter(s);s.possession.completedPasses=4;
  s.referee.passive.idleMs=17950;
  record(s,'DEFENDER_BEATEN',getPlayer(s,'H03'),{},['A03']);passiveAfter(s);
  assert.equal(s.referee.passive.warnedTick,null,'beating a man is an attempt to attack');
  assert.ok(s.referee.passive.idleMs<1000,'and it restarts the referee clock');
  s.referee.passive.idleMs=17950;passiveAfter(s);
  assert.notEqual(s.referee.passive.warnedTick,null,'circulating without one does not');
});

test('a composed defender reading another feint does not disguise stagnant circulation',()=>{
  for(const wrongFooted of [false,true]) {
    const s=createCoreScenario();passiveAfter(s);s.possession.completedPasses=4;s.referee.passive.idleMs=17950;
    record(s,'FEINT_READ',getPlayer(s,'H03'),{wrongFooted},['A03']);passiveAfter(s);
    assert.equal(s.referee.passive.warnedTick===null,wrongFooted,'only an actual defensive impairment is a new attacking problem');
  }
});
