import test from 'node:test';
import assert from 'node:assert/strict';
import { createCentreThrowOff } from './scenario';
import { scenarioTick, stepV2 } from './executor';
import { ordinaryPlayAllowed, preparationIssues } from './rules';
import { advancePlayback, createReplay, currentSnapshot, eventHash, exactSnapshot, loadScenario, saveScenario, seekReplay, stateHash, stepReplay } from './replay';
import { playerById, type ScenarioState } from './model';
import { v2RenderSnapshot } from '../../../match-integration/src/v2Snapshot';

function run(initial = createCentreThrowOff()) {
  const states = [initial];
  while (states.at(-1)!.status === 'RUNNING') states.push(scenarioTick(states.at(-1)!));
  return states;
}
test('baseline exposes every stage and physical, causally ordered reception', () => {
  const states = run(); const end = states.at(-1)!;
  assert.equal(end.status, 'SUCCESS');
  assert.deepEqual([...new Set(states.map(s => s.stage))], ['DEAD_BALL','RESTART_PREPARATION','TAKER_READY','AUTHORISED','THROW_RELEASE','BALL_IN_FLIGHT','RECEIVER_ENCOUNTER','CONTROL_COMPLETION','LIVE_PLAY']);
  for (let i=1;i<states.length;i++) {
    const s=states[i], prev=states[i-1];
    assert.equal(s.timeMs,s.tick*50);
    if (s.restart.phase !== 'COMPLETED') assert.equal(ordinaryPlayAllowed(s),false);
    for (const p of s.players) {
      const old=playerById(prev,p.identity.id);
      assert.ok(Math.hypot(p.position.x-old.position.x,p.position.y-old.position.y)<=.100001);
    }
    if (prev.ball.flight) assert.ok(Math.hypot(s.ball.position.x-prev.ball.position.x,s.ball.position.y-prev.ball.position.y)<=.300001);
    assert.equal(stateHash(loadScenario(saveScenario(s))),stateHash(s));
  }
  const release=end.events.find(e=>e.type==='THROW_RELEASED')!;
  const catchEvent=end.events.find(e=>e.type==='PASS_RECEIVED')!;
  assert.ok(catchEvent.tick>release.tick);
  assert.equal(catchEvent.details.throwActionId,release.actionId);
  assert.equal(end.events.find(e=>e.type==='RESTART_COMPLETED')!.tick,catchEvent.tick);
  for (const s of states.filter(s=>s.ball.flight)) assert.equal(s.ball.controllerId,null);
});
test('same seed, save continuation, and playback speeds produce identical hashes', () => {
  const states=run(createCentreThrowOff({seed:456})), end=states.at(-1)!;
  assert.equal(stateHash(run(createCentreThrowOff({seed:456})).at(-1)!),stateHash(end));
  for (const stage of ['RESTART_PREPARATION','AUTHORISED','THROW_RELEASE','BALL_IN_FLIGHT','CONTROL_COMPLETION']) {
    const saved=states.find(s=>s.stage===stage)!;
    const resumed=run(loadScenario(saveScenario(saved))).at(-1)!;
    assert.equal(stateHash(resumed),stateHash(end)); assert.equal(eventHash(resumed),eventHash(end));
  }
  for(const speed of [.25,.5,1,2,4]) {
    let replay=createReplay(states[0]);
    while(currentSnapshot(replay).status==='RUNNING') replay=advancePlayback(replay,37,speed);
    assert.equal(stateHash(currentSnapshot(replay)),stateHash(end));
  }
  const frozen=exactSnapshot(states[0]); run(frozen); assert.equal(stateHash(frozen),stateHash(states[0]));
});
test('both directions and opening/post-goal contexts enforce distinct placement and clocks', () => {
  for (const direction of ['TOP','BOTTOM'] as const) for(const context of ['OPENING_HALF','POST_GOAL'] as const) {
    const states=run(createCentreThrowOff({direction,context})); assert.equal(states.at(-1)!.status,'SUCCESS');
    const ready=states.find(s=>s.stage==='TAKER_READY')!;
    assert.deepEqual(preparationIssues(ready),[]);
    assert.equal(ready.officialClock.timeMs,context==='OPENING_HALF'?0:300000+ready.timeMs);
    if(context==='POST_GOAL') { const edited=JSON.parse(JSON.stringify(ready)) as ScenarioState; edited.restart.context='OPENING_HALF'; assert.ok(preparationIssues(edited).length>0); }
  }
});
test('missing authorisation, execution timeout, interruption and budget cannot fabricate completion', () => {
  for(const options of [{autoAuthorise:false},{autoExecute:false},{maxTicks:4}]) {
    const end=run(createCentreThrowOff(options)).at(-1)!;
    assert.notEqual(end.status,'SUCCESS'); assert.equal(end.ball.inPlay,false);
    assert.equal(end.events.some(e=>e.type==='RESTART_COMPLETED'),false);
  }
  const state=run().find(s=>s.stage==='AUTHORISED')!;
  const end=stepV2(state,{interruptPlayerId:state.restart.takerId});
  assert.equal(end.status,'FAILED'); assert.equal(end.ball.inPlay,false);
  assert.throws(()=>stepV2(state,{shoot:true} as never),/Unsupported/);
});
test('a receiver that moves away after release does not gain possession at the old target', () => {
  const state=JSON.parse(JSON.stringify(run().find(s=>s.stage==='THROW_RELEASE')!)) as ScenarioState;
  playerById(state,state.restart.receiverId).position={x:15,y:20};
  const end=run(state).at(-1)!;
  assert.equal(end.status,'FAILED'); assert.equal(end.ball.controllerId,null);
  assert.equal(end.events.some(e=>e.type==='PASS_RECEIVED'),false);
});
test('corrupt saves and incompatible versions are rejected', () => {
  const saved=JSON.parse(saveScenario(createCentreThrowOff())); saved.state.rng.state++;
  assert.throws(()=>loadScenario(JSON.stringify(saved)),/fingerprint/);
  saved.state.engineVersion='future'; assert.throws(()=>loadScenario(JSON.stringify(saved)),/version/);
});
test('invalid preparation cannot authorise and observations cannot alter simulation', () => {
  const ready=JSON.parse(JSON.stringify(run().find(s=>s.stage==='TAKER_READY')!)) as ScenarioState;
  playerById(ready,'AWAY-M9').position={x:10,y:20};
  const rejected=stepV2(ready,{authorise:true});
  assert.equal(rejected.status,'FAILED'); assert.equal(rejected.ball.inPlay,false);
  let observed=createCentreThrowOff();
  while(observed.status==='RUNNING') {
    const before=stateHash(observed);
    JSON.stringify(observed.events); saveScenario(observed); exactSnapshot(observed);
    const render=v2RenderSnapshot(observed);
    assert.equal(render.simulationTime,observed.timeMs/1000);
    assert.equal(render.ball.possessorPlayerId,observed.ball.controllerId);
    for(const p of observed.players){const visual=render.players.find(v=>v.id===p.identity.id)!;assert.equal(visual.x,p.position.x);assert.equal(visual.y,p.position.y);assert.equal(visual.roleLabel,p.assignment.role);}
    assert.equal(stateHash(observed),before);
    observed=scenarioTick(observed);
  }
  assert.equal(stateHash(observed),stateHash(run().at(-1)!));
});
test('seeking displays exact historical state without future roles, actions or events', () => {
  let replay=createReplay(createCentreThrowOff({seed:2025}));
  const initialHash=stateHash(currentSnapshot(replay));
  while(currentSnapshot(replay).status==='RUNNING') replay=stepReplay(replay);
  const completedHash=stateHash(currentSnapshot(replay));
  for(let index=0;index<replay.snapshots.length;index++) {
    const sought=seekReplay(replay,index);
    assert.strictEqual(currentSnapshot(sought),replay.snapshots[index]);
    assert.equal(currentSnapshot(sought).tick,index);
    assert.ok(currentSnapshot(sought).events.every(e=>e.tick<=index));
    if(index+1<replay.snapshots.length) assert.strictEqual(currentSnapshot(stepReplay(sought)),replay.snapshots[index+1]);
  }
  const future=JSON.parse(JSON.stringify(currentSnapshot(replay))) as ScenarioState;
  playerById(future,future.restart.takerId).assignment.role='TEMPORARY_FUTURE_ROLE';
  const alternate={...replay,snapshots:[...replay.snapshots,exactSnapshot(future)]};
  const historical=currentSnapshot(seekReplay(alternate,0));
  assert.equal(v2RenderSnapshot(historical).players.find(p=>p.id===historical.restart.takerId)!.roleLabel,'M9');
  assert.equal(playerById(historical,historical.restart.takerId).action,null);
  assert.equal(historical.events.length,0);
  assert.equal(stateHash(historical),initialHash);
  assert.equal(stateHash(currentSnapshot(replay)),completedHash);
});
test('physical proximity alone cannot give an incompatible receiver control', () => {
  const flight=JSON.parse(JSON.stringify(run().find(s=>s.stage==='THROW_RELEASE')!)) as ScenarioState;
  playerById(flight,flight.restart.receiverId).action!.phase='FAILED';
  const end=run(flight).at(-1)!;
  assert.equal(end.status,'FAILED');
  assert.equal(end.ball.controllerId,null);
  assert.equal(end.ball.inPlay,false);
  assert.equal(end.events.some(e=>e.type==='PASS_RECEIVED'||e.type==='RESTART_COMPLETED'),false);
});
