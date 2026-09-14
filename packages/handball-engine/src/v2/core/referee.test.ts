import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { getPlayer } from './state';
import { startAction } from './actions';
import { foul,awardRestart } from './transitions';
import { refereeAfter } from './referee';
import { tickCore } from './engine';
import { saveCore,loadCore,coreHash,coreEventHash } from './replay';

function opportunity(){const s=createCoreScenario();s.checkpoint.stopOnOutcome=false;const a=getPlayer(s,'H03');startAction(s,a,'SHOOT','Controlled standing opportunity',null,null,'STANDING');a.action!.phase='EXECUTING';return s;}
test('advantage preserves a controlled shot and delays discipline until the next stoppage',()=>{
  let s=opportunity();foul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'CLEAR_CHANCE','Fixture destroyed clear chance',true,'physical-hold');
  assert.ok(s.referee.advantage);assert.equal(s.ball.live,true);assert.equal(getPlayer(s,'A03').warnings,0);
  while(!s.events.some(e=>e.type==='SHOT_RELEASED')&&s.tick<20)s=tickCore(s);
  assert.ok(s.events.some(e=>e.type==='ADVANTAGE_REALIZED'));assert.equal(s.referee.advantage,null);
  assert.equal(s.referee.sanctions.length,1);assert.equal(s.restart,null);
  awardRestart(s,'GOALKEEPER_THROW','AWAY',{x:10,y:2},'Shot missed',null,false);refereeAfter(s);
  assert.equal(getPlayer(s,'A03').warnings,1);assert.equal(structuredClone(s).restart?.kind,'GOALKEEPER_THROW','A missed controlled chance is not a retrospective 7m');
});
test('loss before restored control recalls the original clear chance, with one causal sanction',()=>{
  const s=opportunity();foul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'CLEAR_CHANCE','Fixture destroyed clear chance',true,'physical-hold');
  s.ball.controllerId=null;s.ball.mode='LOOSE';refereeAfter(s);
  assert.equal(s.restart?.kind,'SEVEN_METRE');assert.equal(s.restart?.owner,'HOME');assert.equal(getPlayer(s,'A03').warnings,1);
  assert.equal(s.events.filter(e=>e.type==='FOUL').length,1);assert.ok(s.events.some(e=>e.type==='ADVANTAGE_RECALLED'));
});
test('a sanction timeout freezes official time until a lawful restart whistle',()=>{
  let s=createCoreScenario();s.checkpoint.stopOnOutcome=false;
  foul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'SERIOUS','Fixture dangerous contact',false,'dangerous-contact');
  const deadline=getPlayer(s,'A03').suspensionUntilMs;assert.equal(s.officialClock.running,false);
  for(let i=0;i<45;i++)s=tickCore(s);
  assert.equal(s.officialClock.timeMs,0);assert.equal(getPlayer(s,'A03').suspensionUntilMs,deadline);
  while(!s.events.some(e=>e.type==='OFFICIAL_CLOCK_RESTARTED')&&s.tick<800)s=tickCore(s);
  assert.ok(s.events.some(e=>e.type==='OFFICIAL_CLOCK_RESTARTED'));assert.equal(s.officialClock.running,true);
});
test('pending advantage and clock stoppages save and resume exactly',()=>{
  for(const severity of ['CLEAR_CHANCE','SERIOUS'] as const) {
    const s=opportunity();foul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),severity,'Fixture contact',severity==='CLEAR_CHANCE','contact');
    let a=s,b=loadCore(saveCore(s));for(let i=0;i<300&&a.status==='RUNNING';i++){a=tickCore(a);b=tickCore(b);}
    assert.equal(coreHash(a),coreHash(b));assert.equal(coreEventHash(a),coreEventHash(b));
  }
});
test('a second infringement cannot downgrade the recalled clear chance to an ordinary free throw',()=>{
  const s=opportunity();foul(s,getPlayer(s,'H03'),getPlayer(s,'A03'),'CLEAR_CHANCE','Fixture destroyed clear chance',true,'first');
  foul(s,getPlayer(s,'H03'),getPlayer(s,'A04'),'PUNISHABLE','Fixture body-directed foul',false,'second');
  assert.equal(s.restart?.kind,'SEVEN_METRE');assert.equal(getPlayer(s,'A03').warnings,1);assert.equal(getPlayer(s,'A04').warnings,1);
});

