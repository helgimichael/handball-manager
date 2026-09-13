import test from 'node:test';
import assert from 'node:assert/strict';
import { createWingScenario,WING_SCENARIOS } from './wingScenarios';
import { wingRelationship,defendWing } from './wing';
import { coordinate,selectActions } from './structure';
import { getPlayer } from './state';
import { fieldLegal,local,distance,world } from './space';
import { tickCore,assertCore } from './engine';
import { startAction,execute } from './actions';
import { createCoreScenario } from './scenarios';
import { freeThrowPositionLegal } from './rules';
import { createContinuous } from './continuous';
import { requestExchange } from './population';
import { awardRestart } from './transitions';
import { restartTarget } from './restarts';
import { coreHash,coreEventHash,loadCore,saveCore,playCore,replayCore,seekCore } from './replay';

test('wings connect to the adjacent back while the far wing preserves corner width in both directions',()=>{
  for(const direction of ['TOP','BOTTOM'] as const)for(const side of ['LEFT_WING_LINK','RIGHT_WING_LINK'] as const) {
    const s=createWingScenario(side,2025,direction);coordinate(s);
    const left=side==='LEFT_WING_LINK',near=getPlayer(s,left?'H01':'H05'),far=getPlayer(s,left?'H05':'H01');
    const offer=wingRelationship(s,near),pin=wingRelationship(s,far);
    assert.equal(offer.mode,'OFFER_OUTSIDE');assert.equal(offer.back?.id,left?'H02':'H04');
    assert.equal(near.duty.kind,'WING_OFFER');assert.equal(near.duty.targetId,offer.back!.id);
    assert.equal(pin.mode,'PIN_CORNER');assert.equal(far.duty.kind,'WING_PIN');
    assert.ok(local(offer.target,direction).y>local(pin.target,direction).y);
    for(const p of [near,far]) {
      const target=wingRelationship(s,p).target,guard=defendWing(s,getPlayer(s,p.id.replace('H','A')),p)!;
      assert.ok(fieldLegal(target));assert.ok(fieldLegal(guard));
      assert.ok(Math.min(target.x,20-target.x)<1.5);assert.ok(local(target,direction).y<4);
      assert.ok(local(guard,direction).y<local(p.position,direction).y,'Outside defender protects the actual corner goal line');
    }
    // Cover in the outside passing lane closes the offer, without dragging the far wing inside.
    const back=offer.back!;getPlayer(s,'A02').position={x:(back.position.x+offer.target.x)/2,y:(back.position.y+offer.target.y)/2};
    assert.equal(wingRelationship(s,near).mode,'PIN_CORNER');
    assert.deepEqual(wingRelationship(s,far).target,pin.target);
  }
});

test('wing finishing and closed-window continuation are selected from physical state, not fixture names',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const closed=createWingScenario('CLOSED_WING_RETURN',2025,direction);closed.scenario='ESTABLISHED_6V6';coordinate(closed);selectActions(closed);
    assert.equal(getPlayer(closed,'H01').action?.kind,'PASS');assert.equal(getPlayer(closed,'H01').action?.targetId,'H02');
    const open=createWingScenario('OPEN_WING_FINISH',2025,direction);open.scenario='ESTABLISHED_6V6';coordinate(open);selectActions(open);
    assert.equal(getPlayer(open,'H01').action?.kind,'JUMP');assert.equal(open.ball.controllerId,'H01');
    let s=open;while(s.status==='RUNNING')s=tickCore(s);
    const shot=s.events.find(e=>e.type==='SHOT_RELEASED'&&e.actorId==='H01');assert.ok(shot,'Actual wing takeoff produces a released shot');
  }
});

test('shot context follows actual takeoff space rather than the player role',()=>{
  for(const direction of ['TOP','BOTTOM'] as const)for(const role of ['LW','CB'] as const)for(const depth of [4,10]) {
    const s=createWingScenario('OPEN_WING_FINISH',2025,direction),p=getPlayer(s,'H01');
    p.role=role;p.position=world({x:2.1,y:depth},direction);s.ball.position={...p.position};
    p.airborne={takeoff:{...p.position},untilTick:24};p.nextAction='SHOOT';
    coordinate(s);selectActions(s);
    assert.equal(p.action?.shotKind,depth===4?'WING':'BACKCOURT_JUMP');
  }
});

test('wing scenarios execute bounded physical movement and preserve exact replay, saves and playback results',()=>{
  for(const name of WING_SCENARIOS)for(const direction of ['TOP','BOTTOM'] as const) {
    let s=createWingScenario(name,2025,direction);const frames=[s];
    while(s.status==='RUNNING') {
      const before=s;s=tickCore(s);assertCore(s);frames.push(s);
      for(const p of s.players)assert.ok(distance(p.position,getPlayer(before,p.id).position)<=p.attributes.speed*.05+1e-8);
    }
    assert.equal(s.status,'CHECKPOINT',`${name}/${direction}: ${s.reason}`);
    const middle=frames[Math.floor(frames.length/2)];let resumed=loadCore(saveCore(middle));
    while(resumed.status==='RUNNING')resumed=tickCore(resumed);
    assert.equal(coreHash(resumed),coreHash(s));assert.equal(coreEventHash(resumed),coreEventHash(s));
    for(const speed of [.25,4]) {
      let r=replayCore(frames[0]);while(r.frames[r.cursor].status==='RUNNING')r=playCore(r,50,speed);
      assert.equal(coreHash(r.frames[r.cursor]),coreHash(s));assert.equal(coreEventHash(r.frames[r.cursor]),coreEventHash(s));
      r=seekCore(r,middle.tick);assert.equal(coreHash(r.frames[r.cursor]),coreHash(middle));
      assert.ok(r.frames[r.cursor].events.every(e=>e.tick<=middle.tick));
    }
  }
});

test('authorised free-throw movement preserves spacing even when a legal destination lies across the taker',()=>{
  const s=createCoreScenario('FREE_THROW'),d=getPlayer(s,'A05'),taker=getPlayer(s,'H03');
  d.position={x:taker.position.x+3.4,y:taker.position.y};
  s.restart!.phase='AUTHORISED';s.restart!.authorisedTick=0;
  startAction(s,d,'REPOSITION','Clear to the other side of the taker',{x:taker.position.x-3.8,y:taker.position.y});
  d.action!.phase='EXECUTING';d.action!.phaseTick=0;d.action!.executeTicks=100;
  for(let i=1;i<=60;i++){s.tick=i;s.timeMs=i*50;execute(s);assert.ok(freeThrowPositionLegal(s,d));}
  assert.ok(distance(d.position,taker.position)>=3+d.radius);
});

test('free-throw wing preparation respects the curved line without taking over the backcourt lane',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const s=createCoreScenario('FREE_THROW',2025,direction);
    for(const id of ['H01','H05']) {
      const p=getPlayer(s,id),target=restartTarget(s,p);
      assert.ok(freeThrowPositionLegal(s,p,target));assert.ok(fieldLegal(target,p.radius));
      assert.ok(local(target,direction).y<7,'The corner has a curved free-throw boundary');
      assert.ok(Math.min(target.x,20-target.x)<1);
    }
    assert.ok(local(restartTarget(s,getPlayer(s,'H04')),direction).y>9);
  }
});

test('physical loose-ball recovery reallocates wing responsibilities before selecting new actions',()=>{
  const s=createCoreScenario();s.checkpoint.stopOnOutcome=false;
  const receiver=getPlayer(s,'A05');s.ball.mode='LOOSE';s.ball.controllerId=null;s.ball.position={...receiver.position};
  receiver.duty={kind:'COLLECT',targetId:null,sinceTick:0,reason:'Assigned rebound claimant'};
  startAction(s,receiver,'RECEIVE','Gather the physically reachable rebound');receiver.action!.phase='EXECUTING';
  const after=tickCore(s);assert.equal(after.ball.controllerId,'A05');assert.equal(after.possession.team,'AWAY');
  assert.equal(getPlayer(after,'A05').duty.kind,'CARRIER');
  assert.equal(getPlayer(after,'A01').duty.kind,'FIRST_WAVE');
  assert.ok(!['WING_PIN','WING_OFFER'].includes(getPlayer(after,'H01').duty.kind));
  assertCore(after);
});

test('a queued substitution completes its airborne prerequisite during live play and restart preparation',()=>{
  for(const dead of [false,true]) {
    let s=createContinuous('CONTINUOUS_PLAY',2025,'TOP',null);const out=getPlayer(s,'H03');
    s.ball.controllerId='H04';s.ball.position={...getPlayer(s,'H04').position};
    if(dead)awardRestart(s,'FREE_THROW','HOME',s.ball.position,'Fixture stoppage');
    out.airborne={takeoff:{...out.position},untilTick:24};out.action=null;
    assert.ok(requestExchange(s,'HOME','H03','H09'));
    s=tickCore(s);assert.equal(getPlayer(s,'H03').action?.kind,'LAND');
    for(let i=0;i<12;i++)s=tickCore(s);
    assert.equal(getPlayer(s,'H03').airborne,null);assert.equal(getPlayer(s,'H03').action?.kind,'EXCHANGE');
    assert.equal(getPlayer(s,'H09').population,'BENCH','Landing cannot admit the replacement');
  }
});

test('a fouled airborne holder lands with the dead ball before preparing and executing a free throw',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    let s=createWingScenario('OPEN_WING_FINISH',2025,direction);s.checkpoint.stopOnOutcome=false;
    const p=getPlayer(s,'H01');p.airborne={takeoff:{...p.position},untilTick:24};
    awardRestart(s,'FREE_THROW','HOME',p.position,'Fouled during takeoff',null,false);
    const before={...p.position};s=tickCore(s);
    assert.equal(getPlayer(s,'H01').action?.kind,'LAND');assert.deepEqual(getPlayer(s,'H01').position,before);
    assert.equal(s.ball.controllerId,'H01');assert.equal(s.ball.live,false);
    while(s.status==='RUNNING'&&!s.ball.live&&s.tick<800)s=tickCore(s);
    assert.equal(s.ball.live,true,s.reason??'Restart did not complete');
    const landed=s.events.find(e=>e.type==='LANDED'&&e.actorId==='H01')!,authorised=s.events.find(e=>e.type==='RESTART_AUTHORISED')!;
    assert.ok(landed&&authorised&&landed.tick<authorised.tick);assertCore(s);
  }
});
