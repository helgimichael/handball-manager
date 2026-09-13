import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario, CORE_SCENARIOS, type CoreScenario } from './scenarios';
import { assertCore, tickCore } from './engine';
import { coreHash, coreEventHash, coreSnapshot, loadCore, saveCore, replayCore, seekCore, playCore } from './replay';
import { getPlayer, type CoreState } from './state';
import { legalAction, startAction } from './actions';
import { distance, fieldLegal } from './space';
import { advanceBall } from './interactions';
import { createContinuous } from './continuous';
import { createContactScenario } from './contactScenarios';

function run(initial=createCoreScenario()) {
  const frames=[initial];assertCore(initial);
  while(frames.at(-1)!.status==='RUNNING') {
    const s=tickCore(frames.at(-1)!);assertCore(s);frames.push(s);
  }
  return frames;
}
test('level 1: geometry, chronology, population and event invariants in both directions',()=>{
  for(const scenario of CORE_SCENARIOS)for(const direction of ['TOP','BOTTOM'] as const) {
    let s=createCoreScenario(scenario,2025,direction);
    assertCore(s);
    while(s.status==='RUNNING') {
      const prev=s;s=tickCore(s);assertCore(s);
      for(const p of s.players)assert.ok(distance(p.position,getPlayer(prev,p.id).position)<=p.attributes.speed*.05+1e-8,`${scenario}: bounded movement`);
    }
    assert.equal(s.status,'CHECKPOINT',`${scenario}/${direction}: ${s.reason}`);
  }
});
test('level 2: committed actions persist, handling rules constrain execution',()=>{
  let s=createCoreScenario();const p=getPlayer(s,'H03');
  assert.equal(startAction(s,p,'HOLD','Test persistent action'),true);
  const id=p.action!.id;s=tickCore(tickCore(s));
  assert.equal(getPlayer(s,'H03').action!.phase,'COMMITTED');
  assert.equal(startAction(s,getPlayer(s,'H03'),'PASS','Must not abandon commitment',null,'H02'),false);
  assert.equal(getPlayer(s,'H03').action!.id,id);
  const invalid=createCoreScenario();invalid.tick=60;invalid.timeMs=3000;invalid.officialClock.timeMs=3000;
  const stopped=tickCore(invalid);assert.equal(stopped.restart?.kind,'FREE_THROW');assert.equal(stopped.restart?.owner,'AWAY');assert.equal(stopped.ball.live,false);
  const dribble=createCoreScenario('TRANSITION_3V2');getPlayer(dribble,'H03').handling.dribbleUsed=true;
  assert.equal(legalAction(dribble,getPlayer(dribble,'H03'),'DRIBBLE'),false);
});
test('level 2: pass decision and release never assign receiver ownership',()=>{
  const frames=run();const decision=frames.find(s=>s.players.some(p=>p.action?.kind==='PASS'&&p.action.phase==='PREPARING'))!;
  assert.equal(decision.ball.controllerId,'H03');
  const released=frames.find(s=>s.ball.mode==='RELEASE'&&s.ball.flight?.kind==='PASS')!;
  assert.equal(released.ball.controllerId,null);assert.equal(released.events.some(e=>e.type==='PASS_RECEIVED'),false);
  const reception=frames.find(s=>s.events.some(e=>e.type==='PASS_RECEIVED'))!;
  assert.ok(reception.tick>released.tick);assert.ok(distance(reception.ball.position,getPlayer(reception,reception.ball.controllerId!).position)<=.65);
});
test('level 3: beaten defender debt persists and one helper is allocated',()=>{
  const frames=run(createContactScenario('SHOULDER_BREAKTHROUGH'));
  const beaten=frames.find(s=>s.events.some(e=>e.type==='DEFENDER_BEATEN'))!;assert.ok(beaten,'An actual duel resolved');
  const event=beaten.events.find(e=>e.type==='DEFENDER_BEATEN')!,id=event.relatedIds[0];
  const after=tickCore(beaten);assert.equal(getPlayer(after,id).beatenUntilTick,getPlayer(beaten,id).beatenUntilTick);
  assert.equal(getPlayer(after,id).duty.kind,'RECOVER');
  for(const s of frames)assert.ok(s.players.filter(p=>p.duty.kind==='HELP').length<=1);
  assert.ok(frames.some(s=>s.defence.helperId!==null));
  assert.ok(frames.some(s=>s.players.some(p=>p.duty.kind==='COVER')));
});
test('local contest outcomes respond to participants, not the scenario name',()=>{
  const strong=createCoreScenario('PIVOT_2V2'),weak=createCoreScenario('PIVOT_2V2');
  getPlayer(strong,'A03').attributes.defence=.99;getPlayer(weak,'A03').attributes.defence=.1;
  const a=run(strong).at(-1)!,b=run(weak).at(-1)!;
  assert.notEqual(a.contests.find(c=>c.kind==='DUEL')?.outcome,b.contests.find(c=>c.kind==='DUEL')?.outcome);
  assert.notEqual(coreHash(a),coreHash(b));
});
test('level 3: goalkeeper parry is a flight and rebound, not fabricated possession',()=>{
  // Isolate an actual reachable shot outside the catch window. A changed attack
  // selector may legitimately make the wing scenario choose a different finish.
  const parry=createCoreScenario('WING_FINISH'),keeper=getPlayer(parry,'A07');
  parry.tick=1;parry.timeMs=50;parry.officialClock.timeMs=50;
  keeper.position={x:10,y:1.5};
  parry.ball.controllerId=null;parry.ball.position={x:9.25,y:2};parry.ball.height=1.2;
  parry.ball.flight={kind:'SHOT',origin:{x:9.25,y:9},velocity:{x:0,y:-23},fromId:'H01',receiverId:null,actionId:'fixture-shot',possessionId:parry.possession.id,releasedTick:0,height:1.2,goalSide:'TOP',touchedIds:['H01'],purpose:'PLAY'};
  startAction(parry,keeper,'SAVE','React to physically reachable released shot',keeper.position);keeper.action!.phase='EXECUTING';
  advanceBall(parry);assert.ok(parry.events.some(e=>e.type==='SAVE_PARRY'));
  assert.equal(parry.ball.controllerId,null);assert.equal(parry.ball.mode,'DEFLECTION');
  const frames=run(parry);
  assert.ok(frames.at(-1)!.events.some(e=>e.type==='BALL_LOOSE'));
  assert.equal(frames.at(-1)!.restart?.kind,'GOALKEEPER_THROW');
});
test('levels 4–5: established circulation, defence, shot contest and correct outcome',()=>{
  const frames=run(createContinuous('CONTINUOUS_PLAY',2025,'TOP',3)),end=frames.at(-1)!;
  assert.equal(end.status,'CHECKPOINT');
  assert.ok(end.events.filter(e=>e.type==='PASS_RECEIVED').length>=2);
  assert.ok(end.events.some(e=>e.type==='SHOT_RELEASED'));
  assert.ok(end.contests.some(c=>['KEEPER','BLOCK','DUEL','SCREEN'].includes(c.kind)));
  for(const c of end.contests.filter(c=>c.kind==='KEEPER'||c.kind==='BLOCK'))assert.ok(end.events.some(e=>e.type==='SHOT_RELEASED'&&e.actionId===c.actionId),'Contest retains the initiating shot action');
  assert.ok(frames.some(s=>s.players.some(p=>p.action?.kind==='PRESS')));
  assert.ok(end.restart||end.events.some(e=>e.type==='POSSESSION_CHANGED'));
});
test('levels 4–5: transition uses dribble, shared pass/shot and retreat',()=>{
  const frames=run(createCoreScenario('TRANSITION_3V2')),end=frames.at(-1)!;
  assert.equal(end.status,'CHECKPOINT');
  for(const type of ['DRIBBLE_STARTED','DRIBBLE_BOUNCE','DRIBBLE_GATHERED','PASS_RELEASED','PASS_RECEIVED','SHOT_RELEASED'])assert.ok(end.events.some(e=>e.type===type),type);
  assert.ok(frames.some(s=>s.players.some(p=>p.duty.kind==='RETREAT')));
  for(const s of frames)for(const p of s.players)if(p.airborne)assert.ok(fieldLegal(p.airborne.takeoff));
});
test('free throw authorisation gates ordinary execution and expires unsuccessfully',()=>{
  const frames=run(createCoreScenario('FREE_THROW'));const released=frames.find(s=>s.events.some(e=>e.type==='RESTART_COMPLETED'))!;
  for(const s of frames.filter(s=>s.tick<released.tick))assert.equal(s.ball.live,false);
  assert.ok(released.events.find(e=>e.type==='RESTART_AUTHORISED')!.tick<released.tick);
  assert.equal(released.ball.controllerId,null);
  const overdue=createCoreScenario('FREE_THROW');overdue.restart!.phase='AUTHORISED';overdue.restart!.authorisedTick=0;overdue.tick=60;overdue.timeMs=3000;
  assert.equal(tickCore(overdue).status,'FAILED');
  const corrupted=JSON.parse(JSON.stringify(frames.find(s=>s.players.some(p=>p.action?.kind==='PASS'&&p.action.phase==='EXECUTING'))!)) as CoreState;
  getPlayer(corrupted,'A03').position={x:10,y:10.5};
  const failed=run(corrupted).at(-1)!;assert.equal(failed.status,'FAILED');assert.equal(failed.ball.live,false);
});
test('budget and moved receiver cannot manufacture a successful reception',()=>{
  const limited=createCoreScenario();limited.checkpoint.maxTicks=2;const end=run(limited).at(-1)!;
  assert.equal(end.status,'INCOMPLETE');assert.equal(end.checkpoint.outcome,null);
  const frames=run();const released=JSON.parse(JSON.stringify(frames.find(s=>s.ball.flight?.kind==='PASS')!)) as CoreState;
  const intended=getPlayer(released,released.ball.flight!.receiverId!);intended.population='BENCH';
  const after=run(released).at(-1)!;
  assert.equal(after.events.some(e=>e.type==='PASS_RECEIVED'&&e.actorId===intended.id),false);
});
test('save/resume, logging, playback speed and historical roles preserve exact hashes',()=>{
  for(const name of ['ESTABLISHED_6V6','TRANSITION_3V2'] as CoreScenario[]) {
    const frames=run(createCoreScenario(name)),end=frames.at(-1)!;
    const saved=frames.find(s=>s.ball.flight!==null)!;
    const resumed=run(loadCore(saveCore(saved))).at(-1)!;
    assert.equal(coreHash(resumed),coreHash(end));assert.equal(coreEventHash(resumed),coreEventHash(end));
    for(const speed of [.25,1,4]) {
      let r=replayCore(frames[0]);
      while(r.frames[r.cursor].status==='RUNNING') {JSON.stringify(r.frames[r.cursor].events);r=playCore(r,31,speed);}
      assert.equal(coreHash(r.frames[r.cursor]),coreHash(end));
      const old=seekCore(r,0);assert.strictEqual(old.frames[old.cursor],r.frames[0]);assert.equal(old.frames[0].events.length,0);
    }
    const frozen=coreSnapshot(frames[0]);assert.equal(coreHash(tickCore(frozen)),coreHash(frames[1]));
    const corrupt=JSON.parse(saveCore(end));corrupt.state.score.HOME++;assert.throws(()=>loadCore(JSON.stringify(corrupt)),/fingerprint/);
  }
});
