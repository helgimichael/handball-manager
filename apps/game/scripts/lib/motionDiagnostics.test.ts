import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from '@handball-manager/handball-engine/src/v2/core/scenarios';
import { MotionDiagnostics } from './motionDiagnostics';

test('a stop survives gradual acceleration; a slow bridge remains in the continuous segment',()=>{
  const s=createCoreScenario(),p=s.players.find(p=>p.id==='H02')!,d=new MotionDiagnostics();s.players=[p];d.observe(s);
  const step=(metres:number)=>{s.tick++;s.timeMs=s.tick*50;p.position.x+=metres;p.velocity={x:metres/.05,y:0};d.observe(s);};
  step(.03);step(.01);step(.03);step(0);step(0);step(0);step(.01);step(.03);
  const report=d.report().players[p.id];assert.equal(report.fullStops,1);assert.ok(Math.abs(report.stopDurationSeconds.mean!-.15)<1e-9);assert.ok(Math.abs(report.continuousMovementSeconds.mean!-.15)<1e-9);
});
test('dead balls cannot manufacture a live stop episode and frozen nominal velocity is measured',()=>{
  const s=createCoreScenario(),p=s.players.find(p=>p.id==='H02')!,d=new MotionDiagnostics();s.players=[p];d.observe(s);
  s.tick++;p.position.x+=.03;p.velocity={x:.6,y:0};d.observe(s);
  s.tick++;d.observe(s);assert.equal(d.report().players[p.id].frozenDespiteVelocityTicks,1);
  s.ball.live=false;for(let i=0;i<4;i++){s.tick++;d.observe(s);}s.ball.live=true;s.tick++;p.position.x+=.03;d.observe(s);
  assert.equal(d.report().players[p.id].fullStops,0);
});
test('keeper stance does not contaminate field-player support, retreat or defensive shift groups',()=>{
  const s=createCoreScenario(),p=s.players.find(p=>p.kind==='GOALKEEPER')!,d=new MotionDiagnostics();s.players=[p];d.observe(s);s.tick++;p.position.x+=.03;d.observe(s);
  assert.deepEqual(Object.keys(d.report().groups),['keeper']);
});
test('group segments split at phase changes without manufacturing a physical stop',()=>{
  const s=createCoreScenario(),p=s.players.find(p=>p.id==='H02')!,d=new MotionDiagnostics();s.players=[p];d.observe(s);
  s.tick++;p.position.x+=.03;d.observe(s);s.possession.phase='TRANSITION';s.tick++;p.position.x+=.03;d.observe(s);s.ball.live=false;s.tick++;d.observe(s);
  const report=d.report();assert.equal(report.players[p.id].movementSegments,1);assert.equal(report.players[p.id].fullStops,0);assert.ok(Math.abs(report.players[p.id].continuousMovementSeconds.mean!-.1)<1e-9);assert.equal(report.groups.support.movementSegments,1);assert.equal(report.groups.transitionRun.movementSegments,1);
});
