import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { advanceCoreMutable, assertCore } from './engine';
import { getPlayer, type CoreState } from './state';
import { distance,world } from './space';
import { startAction } from './actions';

function loose(x:number,y:number):CoreState{
  const s=createCoreScenario();s.checkpoint.stopOnOutcome=false;
  s.ball={...s.ball,mode:'LOOSE',position:{x,y},controllerId:null,flight:null,height:0};
  return s;
}
function recover(s:CoreState,maxTicks=150){
  let ticks=0;
  while(!s.events.some(e=>e.type==='BALL_CONTROLLED')&&s.status==='RUNNING'&&ticks++<maxTicks){
    const before=new Map(s.players.map(p=>[p.id,{...p.position}]));
    advanceCoreMutable(s);
    for(const p of s.players)assert.ok(distance(before.get(p.id)!,p.position)<=p.profile.topSpeed*.05+.001,'collection uses ordinary bounded physical movement');
    assertCore(s);
  }
  assert.ok(s.events.some(e=>e.type==='BALL_CONTROLLED'),'the reachable rebound is physically controlled within the bounded scenario');
}

test('a reachable field player replaces a distant stale pivot collector and physically recovers the ball',()=>{
  const s=loose(10,16),runner=getPlayer(s,'H02'),stale=getPlayer(s,'H06');
  runner.position={x:8,y:17};stale.position={x:18,y:28};
  stale.duty={kind:'COLLECT',targetId:null,sinceTick:0,reason:'Old pivot responsibility'};
  const ball={...s.ball.position};advanceCoreMutable(s);
  assert.equal(runner.duty.kind,'COLLECT');assert.notEqual(stale.duty.kind,'COLLECT');
  assert.equal(s.players.filter(p=>p.team==='HOME'&&p.duty.kind==='COLLECT').length,1);
  assert.equal(s.ball.controllerId,null,'designation does not award possession');
  assert.deepEqual(s.ball.position,ball,'no ball snap during approach');
  recover(s);
  const controlled=s.events.find(e=>e.type==='BALL_CONTROLLED')!;
  assert.equal(controlled.actorId,runner.id);
  assert.ok(distance(s.ball.position,runner.position)<=.65,'only the existing hand-contact distance grants control');
});

test('a completed ordinary approach releases its stale action so a nearby player can prepare RECEIVE',()=>{
  const s=loose(5.9,10),p=getPlayer(s,'H02');p.position={x:5.5,y:10};
  assert.ok(startAction(s,p,'RUN','Prior approach',{...p.position}));
  p.action!.phase='EXECUTING';p.action!.executeTicks=100;p.velocity={x:.2,y:0};
  advanceCoreMutable(s);
  assert.equal(p.action?.kind,'RECEIVE');assert.equal(s.ball.controllerId,null,'hands must still become ready');
  recover(s,30);
  assert.equal(s.events.find(e=>e.type==='BALL_CONTROLLED')?.actorId,p.id);
});

test('an own-area rebound is exclusively collected by its goalkeeper through real movement and hands',()=>{
  const s=loose(10,3.1),keeper=getPlayer(s,'A07'),stale=getPlayer(s,'A06');
  stale.duty={kind:'COLLECT',targetId:null,sinceTick:0,reason:'Stale field assignment inside area'};
  assert.ok(startAction(s,keeper,'REPOSITION','Prior stance',{...keeper.position}));keeper.action!.phase='EXECUTING';keeper.action!.executeTicks=100;
  advanceCoreMutable(s);
  assert.equal(keeper.duty.kind,'COLLECT');
  assert.equal(s.players.filter(p=>p.kind==='FIELD_PLAYER'&&p.duty.kind==='COLLECT').length,0);
  assert.equal(s.ball.controllerId,null,'being the legal collector is not a catch');
  recover(s);
  assert.equal(s.events.find(e=>e.type==='BALL_CONTROLLED')?.actorId,keeper.id);
  assert.equal(s.restart?.kind,'GOALKEEPER_THROW');assert.equal(s.restart?.owner,'AWAY');
});

test('unavailable players cannot claim a rebound and no field claimant is assigned inside an empty goal area',()=>{
  const s=loose(10,16),unavailable=getPlayer(s,'H03');
  unavailable.position={x:10,y:16};unavailable.condition.unavailable=true;
  advanceCoreMutable(s);assert.notEqual(unavailable.duty.kind,'COLLECT');
  const area=loose(10,3);getPlayer(area,'A07').population='BENCH';
  advanceCoreMutable(area);
  assert.equal(area.ball.controllerId,null);
  assert.equal(area.players.filter(p=>p.kind==='FIELD_PLAYER'&&p.duty.kind==='COLLECT').length,0);
});

test('a near-end-line ball outside the curved area has a reachable lateral collection approach at either goal',()=>{
  for(const direction of ['TOP','BOTTOM'] as const){
    const ball=world({x:17.547497783312416,y:.12959887858902863},direction),s=loose(ball.x,ball.y),runner=getPlayer(s,'H06');
    for(const p of s.players)if(p!==runner&&p.kind==='FIELD_PLAYER'){p.population='BENCH';p.zone=null;}
    runner.position=world({x:17.83,y:2.77},direction);
    const before={...s.ball.position};advanceCoreMutable(s);
    assert.equal(runner.duty.kind,'COLLECT');assert.ok(runner.action?.target);
    assert.ok(distance(runner.action!.target!,before)<=.65,'a legal body centre remains within physical grasp');
    assert.equal(s.ball.controllerId,null);assert.deepEqual(s.ball.position,before,'designation never snaps the ball or awards a catch');
    recover(s,120);assert.equal(s.events.find(e=>e.type==='BALL_CONTROLLED')?.actorId,runner.id);
  }
});
