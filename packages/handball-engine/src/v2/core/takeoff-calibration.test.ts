import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {getPlayer,type CoreState} from './state';
import {startAction} from './actions';
import {advanceCoreMutable,assertCore,tickCore} from './engine';
import {coreHash,loadCore,saveCore} from './replay';

function opportunity(direction:'TOP'|'BOTTOM'='TOP') {
  const s=createCoreScenario('BACKCOURT_SHOT',29,direction),p=getPlayer(s,'H03');
  for(const body of s.players)if(body.id!==p.id&&body.kind==='FIELD_PLAYER'){
    body.population='BENCH';body.zone=null;body.position={x:-.35,y:24};
  }
  return {s,p};
}
function untilRelease(s:CoreState) {
  while(s.status==='RUNNING'&&!s.events.some(e=>e.type==='SHOT_RELEASED')){advanceCoreMutable(s);assertCore(s);}
}
test('actual takeoff completes the jump while normal throw preparation, aim commitment and execution remain ordered',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const {s,p}=opportunity(direction),position={...p.position};startAction(s,p,'JUMP','Actual created backcourt opportunity');const jumpId=p.action!.id;
    untilRelease(s);
    const takeoff=s.events.find(e=>e.type==='TAKEOFF')!,shotStart=s.events.find(e=>e.type==='ACTION_STARTED'&&e.details.kind==='SHOOT')!;
    const aim=s.events.find(e=>e.type==='SHOT_AIM_COMMITTED')!,release=s.events.find(e=>e.type==='SHOT_RELEASED')!;
    assert.equal(takeoff.tick,4);assert.equal(shotStart.tick,takeoff.tick+1);assert.equal(aim.tick,shotStart.tick+2);assert.equal(release.tick,shotStart.tick+8);
    assert.equal(release.timeMs,650,'the second jump recovery is removed, not the throwing lifecycle');
    assert.ok(s.events.some(e=>e.type==='ACTION_RESOLVED'&&e.actionId===jumpId));
    assert.ok(!s.events.some(e=>e.type==='ACTION_INTERRUPTED'&&e.actionId===jumpId));
    assert.deepEqual(p.position,position);assert.deepEqual(p.airborne!.takeoff,position);assert.equal(p.airborne!.untilTick,takeoff.tick+24);
    assert.equal(s.ball.controllerId,null);assert.equal(s.ball.flight?.kind,'SHOT');assert.equal(s.ball.flight?.actionId,release.actionId);
    assert.equal(release.details.shotKind,'BACKCOURT_JUMP');assert.equal(s.events.filter(e=>e.type==='SHOT_RELEASED').length,1);
  }
});
test('a grounded constrained release keeps its original throwing timing and category',()=>{
  const {s,p}=opportunity();startAction(s,p,'SHOOT','Actual grounded constrained release',null,null,'STANDING');untilRelease(s);
  const release=s.events.find(e=>e.type==='SHOT_RELEASED')!;assert.equal(release.tick,8);assert.equal(release.details.shotKind,'STANDING');assert.equal(p.airborne,null);
});
test('physical takeoff, the retained airborne clock and committed throwing preparation resume exactly',()=>{
  const {s,p}=opportunity();startAction(s,p,'JUMP','Actual created backcourt opportunity');
  let uninterrupted=s;for(let i=0;i<5;i++)uninterrupted=tickCore(uninterrupted);
  assert.equal(getPlayer(uninterrupted,p.id).action?.kind,'SHOOT');assert.ok(getPlayer(uninterrupted,p.id).airborne);
  let resumed=structuredClone(loadCore(saveCore(uninterrupted)));
  for(let i=0;i<25&&uninterrupted.status==='RUNNING';i++){uninterrupted=tickCore(uninterrupted);resumed=tickCore(resumed);}
  assert.equal(coreHash(uninterrupted),coreHash(resumed));assert.equal(uninterrupted.events.filter(e=>e.type==='SHOT_RELEASED').length,1);
});
