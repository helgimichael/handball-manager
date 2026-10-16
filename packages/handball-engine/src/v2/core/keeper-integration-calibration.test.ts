import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {getPlayer} from './state';
import {distance,local,world} from './space';
import {startAction,execute} from './actions';
import {awardRestart} from './transitions';
import {restartStep,restartTarget} from './restarts';
import {selectActions} from './structure';
import {setProfile} from './testProfile';
import {coreHash,loadCore,saveCore} from './replay';
import {tickCore,assertCore} from './engine';

function penalty(direction:'TOP'|'BOTTOM'='TOP') {
  const s=createCoreScenario('BACKCOURT_SHOT',29,direction),thrower=getPlayer(s,'H03'),keeper=getPlayer(s,'A07');
  thrower.position=world({x:10,y:7},direction);s.ball.position={...thrower.position};
  awardRestart(s,'SEVEN_METRE','HOME',thrower.position,'Actual clear-chance denial',thrower,false);
  const r=s.restart!;r.takerId=thrower.id;r.collectorId=thrower.id;r.phase='AUTHORISED';r.authorisedTick=0;r.plantedFoot={...thrower.position};
  for(const p of s.players.filter(p=>p.population==='COURT'))p.position=restartTarget(s,p);
  keeper.position=world({x:10,y:.8},direction);s.ball.position={...thrower.position};
  assert.ok(startAction(s,thrower,'SHOOT','Committed penalty',null,null,'SEVEN_METRE'));thrower.action!.phase='COMMITTED';thrower.action!.target=world({x:11,y:0},direction);
  assert.ok(startAction(s,keeper,'SAVE','Actual prepared penalty stance',keeper.position));keeper.action!.phase='EXECUTING';
  setProfile(keeper,{reaction:.2,keeper:{...keeper.profile.keeper!,timing:.75}});s.tick=4;s.timeMs=200;
  return {s,thrower,keeper};
}

test('the restart keeper loads once from the actual committed pose and cannot inspect the unreleased target',()=>{
  const a=penalty(),b=penalty();a.thrower.action!.target={x:8.6,y:0};b.thrower.action!.target={x:11.4,y:0};
  restartStep(a.s);restartStep(b.s);
  assert.equal(a.keeper.action!.anticipationForId,a.thrower.action!.id);assert.deepEqual(a.keeper.action!.target,b.keeper.action!.target);
  assert.equal(a.keeper.action!.phase,'EXECUTING');assert.equal(a.keeper.action!.targetId,null);
  assert.ok(distance(a.keeper.action!.target!,a.keeper.position)<=.5+1e-9);
  const draws=a.s.rng.draws,target={...a.keeper.action!.target!};restartStep(a.s);assert.equal(a.s.rng.draws,draws);assert.deepEqual(a.keeper.action!.target,target);
});

test('a loaded penalty stance moves physically and is not reset to the centre while awaiting the throw',()=>{
  const {s,keeper}=penalty();restartStep(s);const id=keeper.action!.id,initial={...keeper.position};
  for(let i=0;i<3;i++){s.tick++;s.timeMs=s.tick*50;execute(s);restartStep(s);assertCore(s);}
  assert.equal(keeper.action!.id,id);assert.equal(keeper.action!.phase,'EXECUTING');assert.ok(distance(keeper.position,initial)>0);
  assert.ok(distance(keeper.position,initial)<.5);assert.equal(local(keeper.position,'TOP').y,.8);
});

test('ready saves observe released direction only after reaction without premature RNG, then preserve phase and read once',()=>{
  for(const direction of ['TOP','BOTTOM'] as const)for(const [timing,readAt]of [[.25,5],[.75,4]]as const) {
    const {s,thrower,keeper}=penalty(direction);restartStep(s);const id=keeper.action!.id,started=keeper.action!.startedTick,loaded={...keeper.action!.target!},draws=s.rng.draws;
    keeper.profile={...keeper.profile,keeper:{...keeper.profile.keeper!,timing}};
    s.ball.live=true;s.restart!.phase='COMPLETED';s.ball.controllerId=null;s.ball.mode='SHOT_FLIGHT';
    const released=s.tick;s.ball.flight={kind:'SHOT',origin:{...thrower.position},velocity:{x:1,y:direction==='TOP'?-22:22},fromId:thrower.id,receiverId:null,
      actionId:thrower.action!.id,possessionId:s.possession.id,releasedTick:released,height:1.5,goalSide:direction,touchedIds:[thrower.id],purpose:'PLAY'};
    for(let age=0;age<readAt;age++){
      s.tick=released+age;s.timeMs=s.tick*50;selectActions(s);
      assert.equal(keeper.action!.targetId,null);assert.deepEqual(keeper.action!.target,loaded);assert.equal(s.rng.draws,draws);
      assert.ok(!s.events.some(e=>e.type==='KEEPER_FLIGHT_READ'));
    }
    s.tick=released+readAt;s.timeMs=s.tick*50;selectActions(s);
    assert.ok(readAt*.05>=keeper.profile.reaction,'decision timing never bypasses motor reaction');
    assert.equal(keeper.action!.id,id);assert.equal(keeper.action!.startedTick,started);assert.equal(keeper.action!.phase,'EXECUTING');assert.equal(keeper.action!.targetId,thrower.action!.id);
    assert.equal(s.rng.draws,draws+1);assert.ok(Math.abs(local(keeper.action!.target!,direction).y-.8)<1e-12,'reaction stays on the actual prepared depth');
    const target={...keeper.action!.target!};selectActions(s);assert.equal(s.rng.draws,draws+1);assert.deepEqual(keeper.action!.target,target);
    assert.equal(s.events.filter(e=>e.type==='KEEPER_FLIGHT_READ').length,1);
  }
});

test('ordinary visible committed preparation reaches the same bounded anticipation helper',()=>{
  const s=createCoreScenario('BACKCOURT_SHOT',29),thrower=getPlayer(s,'H03'),keeper=getPlayer(s,'A07');
  thrower.position={x:10,y:7.5};s.ball.position={...thrower.position};let y=15;
  for(const d of s.players.filter(p=>p.team==='AWAY'&&p.kind==='FIELD_PLAYER'))d.position={x:18,y:y++};
  assert.ok(startAction(s,thrower,'SHOOT','Actual short committed wind-up',null,null,'BREAKTHROUGH'));thrower.action!.phase='COMMITTED';thrower.action!.target={x:9,y:0};
  assert.ok(startAction(s,keeper,'SAVE','Existing visible prepared stance',keeper.position));keeper.action!.phase='EXECUTING';
  selectActions(s);assert.equal(keeper.action!.anticipationForId,thrower.action!.id);
  const draws=s.rng.draws;selectActions(s);assert.equal(s.rng.draws,draws,'the same actual pose is not rerolled');
});

test('ordinary released shots also wait for perception while retaining their existing working plane',()=>{
  const {s,thrower,keeper}=penalty();thrower.action!.shotKind='BACKCOURT_JUMP';s.ball.live=true;s.restart!.phase='COMPLETED';
  s.ball.controllerId=null;s.ball.mode='SHOT_FLIGHT';const released=s.tick;
  s.ball.flight={kind:'SHOT',origin:{...thrower.position},velocity:{x:1,y:-22},fromId:thrower.id,receiverId:null,
    actionId:thrower.action!.id,possessionId:s.possession.id,releasedTick:released,height:1.5,goalSide:'TOP',touchedIds:[thrower.id],purpose:'PLAY'};
  const draws=s.rng.draws;selectActions(s);assert.equal(keeper.action!.targetId,null);assert.equal(s.rng.draws,draws);
  s.tick=released+4;s.timeMs=s.tick*50;selectActions(s);assert.equal(keeper.action!.targetId,thrower.action!.id);assert.equal(keeper.action!.target!.y,1.4);
  assert.equal(s.rng.draws,draws+1);
});

test('a loaded visible prediction and later reaction resume exactly through the normal persisted core snapshot',()=>{
  const {s}=penalty();restartStep(s);assertCore(s);
  let uninterrupted=s,resumed=structuredClone(loadCore(saveCore(s)));
  for(let i=0;i<24&&uninterrupted.status==='RUNNING';i++){uninterrupted=tickCore(uninterrupted);resumed=tickCore(resumed);}
  assert.equal(coreHash(uninterrupted),coreHash(resumed));
  assert.equal(uninterrupted.events.filter(e=>e.type==='KEEPER_ANTICIPATED').length,1);
});
