import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {createContinuous} from './continuous';
import {advanceCoreMutable} from './engine';
import {courtPlayers,getPlayer} from './state';
import {world,local} from './space';
import {assignZones,readDefence,zonePost} from './defence';
import {coordinate,transitionOrganization,transitionReadyToSettle} from './structure';
import {startAction} from './actions';
import {defendWing} from './wing';

function organized(direction:'TOP'|'BOTTOM',system:'6:0'|'5:1'='6:0') {
 const s=createCoreScenario('ESTABLISHED_6V6',42,direction),carrier=getPlayer(s,'H03');
 s.defence.system=system;carrier.position=world({x:10,y:12},direction);s.ball.position={...carrier.position};
 const defenders=courtPlayers(s,'AWAY').filter(p=>p.kind==='FIELD_PLAYER');assignZones(s,defenders,direction);
 const read=readDefence(s,defenders,carrier,direction);for(const d of defenders)d.position=zonePost(s,d.zone!,read,direction,d.radius);
 for(const [defenderId,wingId]of [['A05','H01'],['A01','H05']])getPlayer(s,defenderId).position=defendWing(s,getPlayer(s,defenderId),getPlayer(s,wingId))!;
 s.possession.phase='TRANSITION';return s;
}

test('recovered defence alone cannot turn arriving attackers into a settled unit',()=>{
 for(const direction of ['TOP','BOTTOM'] as const)for(const system of ['6:0','5:1'] as const){
  const s=organized(direction,system);
  for(const [id,x,depth]of [['H02',5,18],['H04',15,18],['H05',19,20],['H06',10,22]] as const)getPlayer(s,id).position=world({x,y:depth},direction);
  assert.equal(transitionOrganization(s),'REORGANIZING');assert.equal(transitionReadyToSettle(s),false);
  const positions=s.players.map(p=>({...p.position}));coordinate(s);assert.equal(s.possession.phase,'TRANSITION');assert.deepEqual(s.players.map(p=>p.position),positions);
 }
});

test('varied role relationships settle without exact anchors or phase oscillation',()=>{
 for(const direction of ['TOP','BOTTOM'] as const)for(const system of ['6:0','5:1'] as const){
  const s=organized(direction,system);
  getPlayer(s,'H02').position=world({x:6.2,y:10.8},direction);getPlayer(s,'H04').position=world({x:14,y:11.4},direction);getPlayer(s,'H06').position=world({x:8,y:8.2},direction);
  assert.equal(transitionOrganization(s),'ESTABLISHED');coordinate(s);coordinate(s);
  assert.equal(s.possession.phase,'ESTABLISHED');assert.equal(s.events.filter(e=>e.type==='ATTACK_SETTLED').length,1);
 }
});

test('a lone late pivot does not veto an otherwise organized supported attack',()=>{
 for(const direction of ['TOP','BOTTOM'] as const){const s=organized(direction);getPlayer(s,'H06').position=world({x:10,y:22},direction);assert.equal(transitionReadyToSettle(s),true);}
});

test('real unsupported rapid attacks and committed releases retain their live actions',()=>{
 for(const direction of ['TOP','BOTTOM'] as const){
  const s=createCoreScenario('TRANSITION_3V2',7,direction),carrier=getPlayer(s,'H03');
  assert.equal(transitionOrganization(s),'TRANSITION');assert.ok(startAction(s,carrier,'JUMP','Actual immediate transition finish'));carrier.nextAction='SHOOT';
  coordinate(s);assert.equal(s.possession.phase,'TRANSITION');assert.equal(carrier.action?.kind,'JUMP');assert.equal(carrier.nextAction,'SHOOT');
 }
});

test('canonical recorded failure at tick 488 stays live while the supporting wave is still arriving',()=>{
 // Seed 4 replaces 7: with defenders starting in their own zones (03B), seed 7
 // no longer reaches this late-pivot moment at tick 488; seed 4 does.
 for(const direction of ['TOP','BOTTOM'] as const)for(const seed of [4,42]){
  const s=createContinuous('CONTINUOUS_PLAY',seed,direction,null);
  for(let i=0;i<488;i++)advanceCoreMutable(s);
  assert.equal(s.possession.team,'AWAY');assert.ok(local(getPlayer(s,'A06').position,s.directions.AWAY).y>20);
  assert.notEqual(s.possession.phase,'ESTABLISHED');assert.ok(!s.events.some(e=>e.type==='ATTACK_SETTLED'&&e.tick===488));
  const before=s.tick;for(let i=0;i<160;i++)advanceCoreMutable(s);assert.ok(s.tick>before);assert.ok(s.events.some(e=>['PASS_RELEASED','SHOT_RELEASED','DRIBBLE_BOUNCE'].includes(e.type)&&e.tick>before),'No artificial waiting pause');
 }
});
