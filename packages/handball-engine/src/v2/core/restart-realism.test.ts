import test from 'node:test';
import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';
import {getPlayer} from './state';
import {world,distance} from './space';
import {awardRestart} from './transitions';
import {restartStep,restartTarget} from './restarts';
import {restartReady} from './rules';
import {advanceCoreMutable,assertCore} from './engine';
import {setProfile} from './testProfile';

function heldSave(direction:'TOP'|'BOTTOM'='TOP') {
  const s=createCoreScenario('ESTABLISHED_6V6',19,direction),k=getPlayer(s,'H07'),receiver=getPlayer(s,'H03');
  const spots:Record<string,{x:number;y:number}>={H01:{x:2,y:24},H02:{x:5,y:32},H03:{x:10,y:19},H04:{x:15,y:30},H05:{x:17,y:24},H06:{x:11,y:33},H07:{x:10.7,y:38.4}};
  for(const [id,spot] of Object.entries(spots))getPlayer(s,id).position=world(spot,direction);
  let y=25;
  for(const p of s.players.filter(p=>p.team==='AWAY'&&p.kind==='FIELD_PLAYER')){p.position=world({x:18,y:y++},direction);}
  setProfile(receiver,{handling:1});for(const p of s.players.filter(p=>p.team==='HOME'&&p.kind==='FIELD_PLAYER'&&p.id!==receiver.id))setProfile(p,{handling:.1});
  s.ball.controllerId=k.id;s.ball.position={...k.position};s.ball.lastTouchId=k.id;
  s.checkpoint.stopOnOutcome=false;s.checkpoint.maxTicks=1000;
  awardRestart(s,'GOALKEEPER_THROW','HOME',k.position,'Actual held save',k,false);
  return {s,k,receiver};
}

test('a keeper restart chooses an actual open outlet and preserves its current receiving position',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const {s,k,receiver}=heldSave(direction),position={...receiver.position},keeperPosition={...k.position};
    restartStep(s);assert.equal(s.restart!.receiverId,receiver.id);
    assert.deepEqual(restartTarget(s,receiver),position);assert.deepEqual(restartTarget(s,k),keeperPosition);
    assert.equal(receiver.action?.kind,'RECEIVE');assert.ok(restartReady(s));
    assert.equal(s.ball.controllerId,k.id);assert.equal(s.ball.flight,null,'selection never delivers the ball');
  }
});

test('a physically legal keeper outlet releases before the forced deep formation and becomes live only at area exit',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const {s,k,receiver}=heldSave(direction),position={...receiver.position},keeperPosition={...k.position};
    let releaseTick:number|null=null,areaTick:number|null=null;
    for(let tick=0;tick<80&&areaTick===null;tick++) {
      advanceCoreMutable(s);assertCore(s);
      const released=s.events.find(e=>e.type==='PASS_RELEASED'&&e.actorId===k.id);
      if(released&&releaseTick===null){
        releaseTick=released.tick;assert.deepEqual(receiver.position,position,'the outlet never returned to a prescribed 26m depth');
        assert.ok(distance(k.position,keeperPosition)<.02);assert.equal(s.ball.live,false);assert.equal(s.ball.controllerId,null);assert.equal(s.ball.flight?.fromId,k.id);
      }
      const completed=s.events.find(e=>e.type==='RESTART_COMPLETED');
      if(completed){areaTick=completed.tick;assert.equal(completed.details.evidence,'GOAL_AREA_EXIT');}
    }
    assert.ok(releaseTick!==null&&releaseTick<25,'current legal bodies and prepared hands are sufficient');
    assert.ok(areaTick!==null&&areaTick>releaseTick!);assert.equal(s.possession.phase,'TRANSITION');assert.equal(s.ball.live,true);
    assert.equal(s.events.filter(e=>e.type==='PASS_RELEASED'&&e.actorId===k.id).length,1,'one actual ball and one actual release');
  }
});

test('a keeper outlet refuses an actual defender-reachable lane rather than guaranteeing the first wave',()=>{
  const {s,receiver}=heldSave();getPlayer(s,'A03').position={x:10,y:27};setProfile(getPlayer(s,'A03'),{reaction:.1});
  restartStep(s);assert.notEqual(s.restart!.receiverId,receiver.id);assert.equal(s.ball.controllerId,'H07');assert.equal(s.ball.flight,null);
});
