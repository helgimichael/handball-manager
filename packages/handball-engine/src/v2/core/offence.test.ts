import test from 'node:test';
import assert from 'node:assert/strict';
import { setProfile } from './testProfile';
import { createCoreScenario } from './scenarios';
import { createMatch } from './match';
import { offenceBefore,entryCandidates,chooseOffensiveAction,offensiveTarget,offenceAfter,anticipatedDefenceTarget } from './offence';
import { getPlayer } from './state';
import { setTactics } from './coaching';
import { awardRestart } from './transitions';
import { advanceCoreMutable,assertCore,tickCore } from './engine';
import { coreHash,saveCore,loadCore } from './replay';
import { restartTarget,restartStep } from './restarts';
import { startAction,execute } from './actions';
import { distance } from './space';

test('offensive subphases sit beneath game phase and follow space and recovery, not a four-stage script',()=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03');s.possession.phase='TRANSITION';
  p.position={x:10,y:27};s.ball.position={...p.position};offenceBefore(s);assert.equal(s.offence.phase,'UPPSPEL');assert.equal(s.possession.phase,'TRANSITION');
  p.position={x:10,y:17};for(const d of s.players.filter(p=>p.team==='AWAY'))d.position.y=20;
  offenceBefore(s);assert.equal(s.offence.phase,'UPPFOLJNING');
  for(const d of s.players.filter(p=>p.team==='AWAY'))d.position.y=7;
  offenceBefore(s);assert.equal(s.offence.phase,'UPPBYGGNAD');
  p.position={x:10,y:8};offenceBefore(s);assert.equal(s.offence.phase,'AVSLUTNING');
});
test('identity, actual defender depth, attributes and exposure change deterministic entry utilities without RNG',()=>{
  const s=createCoreScenario(),draws=s.rng.draws;setTactics(s,'HOME',{attackIdentity:'WIDTH'});
  assert.equal(entryCandidates(s)[0].family,'STRETCH_SHIFT');setTactics(s,'HOME',{attackIdentity:'DIRECT'});
  assert.equal(entryCandidates(s)[0].family,'FREE');setTactics(s,'HOME',{attackIdentity:'COMBINATION'});
  for(const d of s.players.filter(p=>p.team==='AWAY'&&p.kind==='FIELD_PLAYER'))d.position.y=10;
  const first=entryCandidates(s)[0];assert.equal(first.family,'CROSS');
  s.offence.memory.HOME.recent=Array(10).fill(`${first.family}/${first.side}`);assert.notEqual(entryCandidates(s)[0].family,first.family);
  const before=entryCandidates(s).find(c=>c.partner.id==='H02')!.score;setProfile(getPlayer(s,'H02'),{decision:.1});
  assert.ok(entryCandidates(s).find(c=>c.partner.id==='H02')!.score<before);assert.equal(s.rng.draws,draws);
});
test('an entry creates intentions without assigning positions, possession, crossings or completed screens',()=>{
  const s=createCoreScenario(),positions=s.players.map(p=>({...p.position})),ball=structuredClone(s.ball);offenceBefore(s);
  assert.ok(s.offence.entry);assert.deepEqual(s.players.map(p=>p.position),positions);assert.deepEqual(s.ball,ball);
  assert.ok(!s.events.some(e=>e.type==='ATTACK_RELATIONSHIP_ESTABLISHED'));assert.ok(s.offence.entry!.targets);
});
test('defensive collapse branches the outlet while an immediate finishing chance can break any entry',()=>{
  const s=createCoreScenario();offenceBefore(s);const e=s.offence.entry!,partner=getPlayer(s,e.partnerId),p=getPlayer(s,'H03');
  e.family='CROSS';e.response='COLLAPSE';const target=offensiveTarget(s,partner)!;assert.ok((target.x-10)*e.side<0);
  p.position={x:10,y:8};p.action=null;s.tick=12;p.handling.heldSinceTick=0;
  for(const d of s.players.filter(p=>p.team==='AWAY'))d.position={x:18,y:16};
  assert.ok(chooseOffensiveAction(s,p));assert.equal(structuredClone(p).action?.kind,'JUMP');assert.equal(s.offence.phase,'AVSLUTNING');
});
test('restarts and participant loss retire relationships and do not manufacture tactical success',()=>{
  const s=createCoreScenario();offenceBefore(s);getPlayer(s,s.offence.entry!.partnerId).population='BENCH';offenceBefore(s);assert.equal(s.offence.entry,null);
  const other=createCoreScenario();offenceBefore(other);awardRestart(other,'FREE_THROW','HOME',{x:10,y:10},'Foul');offenceAfter(other);
  assert.equal(other.offence.entry,null);assert.ok(!other.events.some(e=>e.type==='ATTACK_RELATIONSHIP_ESTABLISHED'));
});
test('committed actions survive new team intentions; relationship state and learned memory resume exactly',()=>{
  let s=createCoreScenario();s=tickCore(s);const before=s.players.find(p=>p.action?.kind==='RUN')!;const id=before.action!.id;
  setTactics(s,'HOME',{attackIdentity:'WIDTH'});s=tickCore(s);assert.equal(getPlayer(s,before.id).action!.id,id);
  let a=structuredClone(s),b=structuredClone(loadCore(saveCore(s)));
  for(let i=0;i<200&&a.status==='RUNNING';i++){a=tickCore(a);b=tickCore(b);}assert.equal(coreHash(a),coreHash(b));
});
test('both directions execute adaptive attacks through two halves with physical movement evidence',()=>{
  for(const direction of ['TOP','BOTTOM'] as const){const s=createMatch(2025,direction,120000,1000);
    while(s.status==='RUNNING'){advanceCoreMutable(s);if(s.tick%200===0)assertCore(s);}
    assert.equal(s.match?.phase,'FULLTIME',s.reason??'');assert.ok(new Set(s.events.filter(e=>e.type==='ATTACK_ENTRY_SELECTED').map(e=>e.details.family)).size>=3);
    assert.ok(s.events.some(e=>e.type==='ATTACK_ENTRY_MOVEMENT'));assert.ok(s.events.some(e=>e.type==='ATTACK_RESPONSE'));assertCore(s);
  }
});
test('sideline restart spacing is measured from the actual taker centre',()=>{
  for(const x of [0,20])for(const y of [30.023534,30.939469]){
    const s=createCoreScenario('ESTABLISHED_6V6',1,'BOTTOM');awardRestart(s,'THROW_IN','HOME',{x,y},'Regression',null,false);s.restart!.takerId='H03';
    const taker=restartTarget(s,getPlayer(s,'H03')),d=getPlayer(s,x===0?'A01':'A05');const target=restartTarget(s,d);
    assert.ok(distance(taker,target)>=3+d.radius+.1);
  }
});

test('defensive recognition requires observed repetitions and visible committed movement',()=>{
  const s=createCoreScenario();setTactics(s,'HOME',{attackIdentity:'COMBINATION'});
  for(const d of s.players.filter(p=>p.team==='AWAY'&&p.kind==='FIELD_PLAYER'))d.position.y=10;
  offenceBefore(s);const e=s.offence.entry!;assert.equal(e.family,'CROSS');e.actions=1;
  const partner=getPlayer(s,e.partnerId),d=getPlayer(s,'A02'),target={x:5,y:9};s.defence.marks[d.id]=partner.id;
  partner.action={...getPlayer(tickCore(s),partner.id).action!};partner.action.phase='EXECUTING';partner.velocity={x:2,y:0};
  const key=`${e.family}/${e.side}`;s.offence.memory.HOME.trials[key]=10;
  assert.deepEqual(anticipatedDefenceTarget(s,d,target),target,'Calls alone are not exposure');
  s.offence.memory.HOME.observed[key]=3;
  assert.notDeepEqual(anticipatedDefenceTarget(s,d,target),target);
  partner.velocity={x:0,y:0};assert.deepEqual(anticipatedDefenceTarget(s,d,target),target);
  assert.equal(s.events.filter(e=>e.type==='DEFENSIVE_ENTRY_RECOGNIZED').length,1);
});

test('restart participant changes cannot leave a self-pass or a benched receiver',()=>{
  const s=createMatch();restartStep(s);const r=s.restart!;
  r.receiverId=r.takerId;restartStep(s);assert.ok(r.receiverId);assert.notEqual(r.receiverId,r.takerId);
  const oldReceiver=r.receiverId!;getPlayer(s,oldReceiver).population='BENCH';restartStep(s);assert.notEqual(r.receiverId,oldReceiver);
  getPlayer(s,r.takerId!).population='BENCH';restartStep(s);assert.equal(r.takerId,null);assert.equal(r.receiverId,null);
});

test('dead-ball defender pinned beside the taker can step back within physical bounds',()=>{
  const s=createCoreScenario(),d=getPlayer(s,'A05'),taker=getPlayer(s,'H05');
  taker.position={x:19.18680524670946,y:20.93544351347035};d.position={x:19.714676083527987,y:21.137598581652483};
  awardRestart(s,'FREE_THROW','HOME',taker.position,'Pinned defender regression',null,false);s.restart!.takerId=taker.id;
  assert.ok(startAction(s,d,'REPOSITION','Leave restart taker space',{x:17.5,y:7.5}));d.action!.phase='EXECUTING';
  const before={...d.position};execute(s);
  assert.ok(distance(before,d.position)>0);assert.ok(distance(before,d.position)<=d.profile.topSpeed*.05);
  assert.ok(distance(d.position,taker.position)>=d.radius+taker.radius);
});
