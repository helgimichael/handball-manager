import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {getPlayer} from './state';
import {setProfile} from './testProfile';
import {applyContinuation,releaseFromDrive,selectActions} from './structure';
import {startAction} from './actions';
import {resolveEffects} from './interactions';
import {readContinuation} from './engage';

function lineCatch() {
  const s=createCoreScenario('ESTABLISHED_6V6',19),p=getPlayer(s,'H06'),helper=getPlayer(s,'A03');
  p.position={x:10.4,y:6.5};s.ball.position={...p.position};s.ball.controllerId=p.id;s.tick=48;s.timeMs=2400;p.handling.steps=3;
  setProfile(p,{pivotPlay:1,finishing:1,strength:1,shotPower:.8,shotPlacement:.8});
  let y=15;for(const d of s.players.filter(a=>a.team==='AWAY'&&a.kind==='FIELD_PLAYER'))d.position={x:18,y:y++};
  helper.position={x:10.4,y:7.7};s.defence.helperId=helper.id;s.defence.marks[helper.id]=p.id;
  return {s,p};
}
test('the secured line turn and the same constrained drive continuation share actual PIVOT category and pace',()=>{
  const direct=lineCatch(),continued=lineCatch();selectActions(direct.s);
  assert.equal(direct.p.action?.shotKind,'PIVOT');
  assert.ok(startAction(continued.s,continued.p,'DRIVE','Actual completed line approach',continued.p.position,'A02'));continued.p.action!.phase='EXECUTING';
  assert.equal(releaseFromDrive(continued.s,continued.p),true);assert.equal(continued.p.action?.shotKind,'PIVOT');
  for(const v of [direct,continued]){v.p.action!.phase='EXECUTING';resolveEffects(v.s,[{playerId:v.p.id,kind:'SHOOT'}]);assert.equal(v.s.ball.flight?.kind,'SHOT');}
  assert.equal(Math.hypot(direct.s.ball.flight!.velocity.x,direct.s.ball.flight!.velocity.y),Math.hypot(continued.s.ball.flight!.velocity.x,continued.s.ball.flight!.velocity.y));
});
test('an actual constrained backcourt release remains STANDING',()=>{
  const s=createCoreScenario('BACKCOURT_SHOT'),p=getPlayer(s,'H03');s.tick=48;s.timeMs=2400;p.handling.steps=3;
  assert.ok(applyContinuation(s,p,{kind:'SHOOT',quality:.6,reason:'Real constrained backcourt chance'}));assert.equal(p.action?.shotKind,'STANDING');
});
test('a weak long chance yields to a reachable continuation rather than becoming an automatic shot',()=>{
  const s=createCoreScenario('BACKCOURT_SHOT'),p=getPlayer(s,'H03');p.position={x:10,y:12.5};s.ball.position={...p.position};
  setProfile(p,{shotPower:.1,shotPlacement:.1,finishing:.1});let y=15;
  for(const d of s.players.filter(a=>a.team==='AWAY'&&a.kind==='FIELD_PLAYER'))d.position={x:18,y:y++};
  const next=readContinuation(s,p);assert.ok(next&&'receiverId' in next);assert.notEqual(next.kind,'SHOOT');
});
