import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { getPlayer } from './state';
import { setProfile } from './testProfile';
import { executePass, receptionRisk, shotHeight } from './execution';
import { buildProfile } from './profile';
import { execute, startAction } from './actions';
import { advanceBall } from './interactions';
import { awardRestart } from './transitions';
import { assertCore } from './engine';

test('pass execution is seeded and save/reload preserves the exact throw and RNG',()=>{
  const a=createCoreScenario('ESTABLISHED_6V6',701),b=JSON.parse(JSON.stringify(a));
  const target={...getPlayer(a,'H04').position};
  const first=executePass(a,getPlayer(a,'H03'),getPlayer(a,'H04'),target);
  const second=executePass(b,getPlayer(b,'H03'),getPlayer(b,'H04'),target);
  assert.deepEqual(first,second);assert.deepEqual(a.rng,b.rng);
  assert.equal(a.rng.draws,2);
});
test('the same difficult throws scatter less with actual passing capability',()=>{
  let strong=0,weak=0;
  for(let seed=1;seed<=80;seed++) {
    const a=createCoreScenario('ESTABLISHED_6V6',seed),b=structuredClone(a);
    const strongPasser=getPlayer(a,'H03'),weakPasser=getPlayer(b,'H03');
    setProfile(strongPasser,{passing:.95});setProfile(weakPasser,{passing:.1});
    strong+=executePass(a,strongPasser,getPlayer(a,'H04'),{x:18,y:8}).error;
    weak+=executePass(b,weakPasser,getPlayer(b,'H04'),{x:18,y:8}).error;
  }
  assert.ok(weak>strong*3,'ability changes executed spatial error, not a fabricated turnover counter');
});
test('a legal dead-ball return remains exact and spends no execution RNG',()=>{
  const s=createCoreScenario('FREE_THROW',42),before=s.rng.draws,target={...getPlayer(s,'H04').position};
  const pass=executePass(s,getPlayer(s,'H03'),getPlayer(s,'H04'),target,true);
  assert.deepEqual(pass.target,target);assert.equal(pass.error,0);assert.equal(s.rng.draws,before);
});
test('reception uncertainty needs a difficult physical catch and responds to handling/energy',()=>{
  const s=createCoreScenario('ESTABLISHED_6V6',9),receiver=getPlayer(s,'H04');
  receiver.position={x:16,y:15};receiver.velocity={x:0,y:0};
  for(const d of s.players.filter(p=>p.team==='AWAY'))d.position={x:2,y:4};
  assert.equal(receptionRisk(s,receiver,receiver.position,9),0,'no naked background failure rate for easy control');
  getPlayer(s,'A04').position={x:16.5,y:15};
  setProfile(receiver,{handling:.95,composure:.95});
  const strong=receptionRisk(s,receiver,{x:16.6,y:15},17);
  setProfile(receiver,{handling:.1,composure:.1});receiver.condition.energy=.3;
  const tiredWeak=receptionRisk(s,receiver,{x:16.6,y:15},17);
  assert.ok(tiredWeak>strong&&tiredWeak>0);
});
test('actual keeper reaction and outlet attributes affect separate capacities',()=>{
  const slow=buildProfile({REACTION:1,SHOOTER_READING:10,OUTLET_PASSING:1},'GK');
  const quick=buildProfile({REACTION:20,SHOOTER_READING:10,OUTLET_PASSING:20},'GK');
  assert.ok(quick.reaction<slow.reaction);assert.ok(quick.passing>slow.passing);
});
test('shot placement samples real low/high trajectories without negative floor positions',()=>{
  const heights=[];
  for(let seed=1;seed<=80;seed++) {const s=createCoreScenario('ESTABLISHED_6V6',seed);heights.push(shotHeight(s,getPlayer(s,'H03'),.7,.2));}
  assert.ok(heights.some(h=>h<.9)&&heights.some(h=>h>1.5));assert.ok(heights.every(h=>h>=.12));
});
test('reversing a movement intention cannot carry full forward pace into the reversal',()=>{
  function displacement(toward:boolean){const s=createCoreScenario('ESTABLISHED_6V6',11),p=getPlayer(s,'H02');p.position={x:5,y:15};p.velocity={x:0,y:toward?-5:5};startAction(s,p,'RUN','Reach the current support lane',{x:5,y:13});p.action!.phase='EXECUTING';p.action!.phaseTick=s.tick;execute(s);return 15-p.position.y;}
  assert.ok(displacement(true)>displacement(false)*3);
});

test('wide and central shots reach the chosen height at the same goal plane in both directions',()=>{
  for (const goalSide of ['TOP','BOTTOM'] as const) for (const wide of [false,true]) {
    const s=createCoreScenario('WING_FINISH',12,goalSide),origin={x:wide?2:10,y:goalSide==='TOP'?3:37};
    for(const p of s.players)p.population='BENCH';
    s.ball.position={...origin};s.ball.controllerId=null;s.ball.mode='SHOT_FLIGHT';s.ball.live=true;
    s.ball.flight={kind:'SHOT',origin,velocity:{x:wide?6.8:0,y:goalSide==='TOP'?-3:3},fromId:'H01',receiverId:null,actionId:'height-test',possessionId:s.possession.id,releasedTick:0,height:2.3,goalHeight:.3,goalSide,touchedIds:[],purpose:'PLAY'};
    for(let i=0;i<10;i++){s.tick++;advanceBall(s);}
    assert.ok(Math.abs(s.ball.height-1.3)<1e-9,'half the goal depth is half the height path, even from a wide angle');
  }
});

test('a keeper outlet caught during its goal-area exit becomes live before physical acquisition',()=>{
  for(const inside of [false,true]) {
    const s=createCoreScenario('ESTABLISHED_6V6',71),keeper=getPlayer(s,'H07'),receiver=getPlayer(s,'H03');
    for(const p of s.players)p.population=p.id===keeper.id||p.id===receiver.id?'COURT':'BENCH';
    keeper.position={x:10,y:38.4};receiver.position={x:10,y:33.65};
    setProfile(receiver,{handling:1,composure:1});
    awardRestart(s,'GOALKEEPER_THROW','HOME',keeper.position,'Held save',keeper,false);
    s.restart!.phase='RELEASED';s.restart!.takerId=keeper.id;s.restart!.receiverId=receiver.id;
    startAction(s,receiver,'RECEIVE','Present at the actual lawful outlet');receiver.action!.phase='EXECUTING';
    s.ball.controllerId=null;s.ball.position={x:10,y:inside?34.35:34.15};s.ball.mode='PASS_FLIGHT';
    s.ball.flight={kind:'PASS',origin:{...keeper.position},velocity:{x:0,y:inside?-2:-13},fromId:keeper.id,receiverId:receiver.id,actionId:'outlet-test',possessionId:s.possession.id,releasedTick:0,height:1.2,goalSide:'TOP',touchedIds:[],purpose:'PLAY'};
    s.tick=1;s.timeMs=50;advanceBall(s);assertCore(s);
    if(inside){assert.equal(s.ball.controllerId,null);assert.equal(s.ball.live,false);assert.equal(s.restart!.phase,'RELEASED');}
    else{assert.equal(s.ball.controllerId,receiver.id);assert.equal(s.ball.live,true);assert.equal(s.restart!.phase,'COMPLETED');assert.equal(s.events.findLast(e=>e.type==='RESTART_COMPLETED')!.details.evidence,'GOAL_AREA_EXIT');}
  }
});
