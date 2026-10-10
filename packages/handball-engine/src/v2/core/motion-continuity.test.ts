import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { move, execute, startAction, sustain } from './actions';
import { changePossession } from './transitions';
import { advanceCoreMutable } from './engine';
import { movementCapacity } from './condition';
import { projectMotion } from './locomotion';

function clear(){const s=createCoreScenario('ESTABLISHED_6V6',83731708);const p=s.players.find(p=>p.role==='LW'&&p.team==='HOME')!;s.players=[p];p.position={x:3,y:18};p.velocity={x:2,y:0};p.action=null;return {s,p};}
test('compatible target and curved steering preserve momentum with bounded acceleration',()=>{
  const {s,p}=clear();const old={...p.velocity};move(s,p,{x:8,y:19});assert.ok(Math.hypot(p.velocity.x,p.velocity.y)>1.9);assert.ok(p.velocity.y>0);assert.ok(Math.hypot(p.velocity.x-old.x,p.velocity.y-old.y)<=2*p.profile.acceleration*movementCapacity(p)*.05+1e-9);
  for(let i=0;i<10;i++){const old={...p.velocity};move(s,p,{x:8,y:20});assert.ok(Math.hypot(p.velocity.x-old.x,p.velocity.y-old.y)<=2*p.profile.acceleration*movementCapacity(p)*.05+1e-9);assert.ok(Math.hypot(p.velocity.x,p.velocity.y)<=Math.hypot(old.x,old.y)+p.profile.acceleration*movementCapacity(p)*.05+1e-9);}
});
test('preparation, recovery and passer release do not freeze a moving body',()=>{
  const {s,p}=clear();assert.ok(startAction(s,p,'RUN','Support run',{x:9,y:18}));
  for(const phase of ['PREPARING','COMMITTED','RECOVERING'] as const){p.action!.phase=phase;p.action!.phaseTick=s.tick;const before={...p.position};execute(s);assert.ok(p.position.x>before.x,phase);assert.ok(p.velocity.x>0,phase);}
  p.velocity={x:2,y:0};p.action!.kind='PASS';p.action!.target=null;p.action!.phase='RECOVERING';const before=p.position.x;execute(s);assert.ok(p.position.x>before);assert.ok(p.velocity.x>0);
});
test('arrival brakes naturally and a drifting relationship does not repeatedly stop',()=>{
  const {s,p}=clear();p.velocity={x:0,y:0};let stopped=0;
  for(let i=0;i<200;i++){move(s,p,{x:3+i*.02,y:18});if(i>20&&Math.hypot(p.velocity.x,p.velocity.y)<.1)stopped++;}
  assert.equal(stopped,0);
  for(let i=0;i<100;i++)move(s,p,null);assert.ok(Math.hypot(p.velocity.x,p.velocity.y)<1e-8);
});
test('compatible support correction retains action phase and carried velocity',()=>{
  const {s,p}=clear();startAction(s,p,'RUN','Support',{x:8,y:18});const id=p.action!.id;
  assert.ok(sustain(s,p,'RUN',{x:8.2,y:18.1}));assert.equal(p.action!.id,id);assert.deepEqual(p.velocity,{x:2,y:0});execute(s);assert.ok(p.position.x>3);
});
test('possession change retains momentum and save/load reproduces canonical trajectory',()=>{
  const s=createCoreScenario('ESTABLISHED_6V6',42);const p=s.players.find(p=>p.team!==s.possession.team&&p.role==='LW')!;p.velocity={x:1,y:2};changePossession(s,p,'Interception');assert.deepEqual(p.velocity,{x:1,y:2});
  const reloaded=JSON.parse(JSON.stringify(s));for(let i=0;i<300;i++){advanceCoreMutable(s);advanceCoreMutable(reloaded);assert.deepEqual(s.players.map(p=>[p.position,p.velocity]),reloaded.players.map((p:typeof s.players[number])=>[p.position,p.velocity]));}assert.deepEqual(s,reloaded);
});
test('pace and fatigue retain distinct movement capacities',()=>{
  const a=clear(),b=clear();a.p.velocity={x:0,y:0};b.p.velocity={x:0,y:0};a.p.profile={...a.p.profile,topSpeed:7,acceleration:7};b.p.profile={...b.p.profile,topSpeed:4,acceleration:4};b.p.condition.energy=.3;
  for(let i=0;i<15;i++){move(a.s,a.p,{x:15,y:18});move(b.s,b.p,{x:15,y:18});}assert.ok(a.p.position.x>b.p.position.x);assert.ok(Math.hypot(a.p.velocity.x,a.p.velocity.y)>Math.hypot(b.p.velocity.x,b.p.velocity.y));
});
test('receiver projection follows the actual unblocked braking and arrival path',()=>{
  for(const target of [null,{x:3.4,y:18.2}]){
    const {s,p}=clear(),capacity=movementCapacity(p);
    const projected=projectMotion(p.position,p.velocity,target,p.profile.topSpeed*capacity,p.profile.acceleration*capacity,.5);
    for(let i=0;i<10;i++)move(s,p,target);
    assert.ok(Math.hypot(projected.x-p.position.x,projected.y-p.position.y)<1e-8);
  }
});
