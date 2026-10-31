import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {courtPlayers,getPlayer} from './state';
import {goal,world} from './space';
import {assignZones,lineFormed,readDefence,zonePost} from './defence';
import {defendWing} from './wing';
import {coordinate,transitionReadyToSettle} from './structure';
import {laneMargin} from './timing';
import {startAction} from './actions';

function recovered(direction:'TOP'|'BOTTOM'='TOP') {
  const s=createCoreScenario('ESTABLISHED_6V6',2025,direction),carrier=getPlayer(s,'H03');
  carrier.position=world({x:10,y:12},direction);s.ball.position={...carrier.position};s.possession.phase='TRANSITION';
  const defenders=courtPlayers(s,'AWAY').filter(p=>p.kind==='FIELD_PLAYER');assignZones(s,defenders,direction);
  const read=readDefence(s,defenders,carrier,direction);
  for(const d of defenders)d.position=zonePost(s,d.zone!,read,direction,d.radius);
  for(const [defenderId,wingId] of [['A05','H01'],['A01','H05']]) {
    const d=getPlayer(s,defenderId),wing=getPlayer(s,wingId);d.position=defendWing(s,d,wing)!;
    wing.duty={kind:'FIRST_WAVE',targetId:null,sinceTick:0,reason:'Actual first-wave runner'};
  }
  getPlayer(s,'A06').duty={kind:'PIVOT',targetId:'H06',sinceTick:0,reason:'Physically account for the line player'};
  return {s,carrier,defenders};
}

test('a recovered unit settles a controlled buildup, preserving the existing line geometry',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const {s,defenders}=recovered(direction);assert.equal(lineFormed(s,defenders,direction),true);
    assert.equal(transitionReadyToSettle(s),true);coordinate(s);assert.equal(s.possession.phase,'ESTABLISHED');
    assert.equal(s.events.filter(e=>e.type==='ATTACK_SETTLED').length,1);
  }
});

test('a named receiving player cannot settle the attack while the actual ball is still flying',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const {s,carrier}=recovered(direction);s.ball.controllerId=null;s.ball.mode='PASS_FLIGHT';
    s.ball.flight={kind:'PASS',origin:{...carrier.position},velocity:{x:2,y:direction==='TOP'?-12:12},fromId:carrier.id,
      receiverId:'H05',actionId:'actual-pass',possessionId:s.possession.id,releasedTick:0,height:1.5,goalSide:direction,touchedIds:[carrier.id],purpose:'PLAY'};
    const positions=s.players.map(p=>({...p.position}));coordinate(s);
    assert.equal(s.possession.phase,'TRANSITION');assert.ok(!s.events.some(e=>e.type==='ATTACK_SETTLED'));assert.deepEqual(s.players.map(p=>p.position),positions);
  }
});

test('a recovered central line does not erase the actual free finisher behind its outside defender',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const {s,defenders}=recovered(direction),wing=getPlayer(s,'H05'),outer=getPlayer(s,'A01');
    wing.position=world({x:17.8,y:3.2},direction);s.ball.controllerId=wing.id;s.ball.position={...wing.position};
    outer.position=zonePost(s,outer.zone!,readDefence(s,defenders,wing,direction),direction,outer.radius);
    assert.equal(lineFormed(s,defenders,direction),true);assert.equal(transitionReadyToSettle(s),false);
    outer.position=defendWing(s,outer,wing)!;assert.equal(transitionReadyToSettle(s),true,'actual goalward containment makes the handoff meaningful');
  }
});

test('a playable uncontained first-wave finish prevents handoff; an actually blocked feed does not',()=>{
  const {s,carrier,defenders}=recovered(),wing=getPlayer(s,'H05'),outer=getPlayer(s,'A01');
  carrier.position={x:15,y:12};s.ball.position={...carrier.position};wing.position={x:17.8,y:3.2};outer.position={x:2,y:10};
  assert.equal(lineFormed(s,defenders,'TOP'),true);
  assert.ok(laneMargin(s,carrier.position,wing.position,'HOME',10.5+3*carrier.profile.passing).seconds>.05);
  assert.equal(transitionReadyToSettle(s),false);
  outer.position={x:16.4,y:7.6};assert.ok(laneMargin(s,carrier.position,wing.position,'HOME',10.5+3*carrier.profile.passing).seconds<.05);
  assert.equal(transitionReadyToSettle(s),true,'the model does not invent an accessible finishing outlet');
});

test('an actual transition finish owns its committed takeoff and release rather than changing subphase mid-action',()=>{
  const {s,carrier}=recovered();assert.ok(startAction(s,carrier,'JUMP','Actual selected transition opportunity'));
  assert.equal(transitionReadyToSettle(s),false);coordinate(s);assert.equal(s.possession.phase,'TRANSITION');
  assert.equal(s.ball.controllerId,carrier.id);assert.equal(s.ball.flight,null);assert.notDeepEqual(carrier.position,goal('TOP'),'selection never supplies a goal');
});
