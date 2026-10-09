import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { allocate, assignZones, dutyTarget, lineFormed, readDefence, zonePost } from './defence';
import { courtPlayers, getPlayer, type CorePlayer, type CoreState, type Direction } from './state';
import { local, world } from './space';
import { changePossession, acquire } from './transitions';
import { conditionAfter, executionCapacity, movementCapacity } from './condition';
import { startAction } from './actions';
import { setTactics } from './coaching';
import { coordinate } from './structure';
import { setProfile } from './testProfile';

const fieldDefenders=(s:CoreState)=>courtPlayers(s,s.defence.team).filter(p=>p.kind==='FIELD_PLAYER');
const fieldAttackers=(s:CoreState)=>courtPlayers(s,s.possession.team).filter(p=>p.kind==='FIELD_PLAYER');
function responsibilities(s:CoreState,direction:Direction){
  const defenders=fieldDefenders(s),carrier=getPlayer(s,s.ball.controllerId!);
  assignZones(s,defenders,direction);
  const read=readDefence(s,defenders,carrier,direction);
  return {defenders,carrier,read,duties:allocate(s,defenders,fieldAttackers(s),carrier,read,direction,s.possession.phase==='TRANSITION')};
}

test('6:0 pressure and adjacent help use the same lateral spaces at either goal',()=>{
  const duties=(direction:Direction)=>{
    const s=createCoreScenario('ESTABLISHED_6V6',7,direction);
    const carrier=getPlayer(s,'H03');carrier.position=world({x:6.1,y:10.5},direction);s.ball.position={...carrier.position};
    const result=responsibilities(s,direction);
    return [...result.duties].filter(([,d])=>d.kind==='PRESSURE'||d.kind==='HELP').map(([id,d])=>[id,d.kind]);
  };
  assert.deepEqual(duties('TOP'),duties('BOTTOM'));
  assert.equal(duties('TOP').length,2,'one presser and his adjacent helper');
});

test('a live 5:1 change creates one high point above a connected five-player line',()=>{
  const s=createCoreScenario(),ids=s.players.map(p=>p.id);
  coordinate(s);
  const defenders=fieldDefenders(s),carrier=getPlayer(s,'H03');
  const read=readDefence(s,defenders,carrier,'TOP');
  const previous=local(zonePost(s,2,read,'TOP'),'TOP').y;
  assert.ok(setTactics(s,'AWAY',{defence:'5:1'}));coordinate(s);
  const posts=defenders.map(d=>local(zonePost(s,d.zone!,read,'TOP'),'TOP'));
  assert.equal(posts.filter(p=>p.y>previous+2).length,1,'only the point leaves the lower line');
  assert.equal(posts.filter(p=>p.y<previous+1).length,5,'five lower spaces remain');
  assert.equal(new Set(defenders.map(d=>d.zone)).size,6,'owners are not duplicated by the tactical change');
  assert.deepEqual(s.players.map(p=>p.id),ids,'the same real players execute it');
});

test('transition allocates one useful goal-side delayer while everyone else retreats',()=>{
  const s=createCoreScenario('TRANSITION_3V2');
  getPlayer(s,'A02').position={x:9,y:18};getPlayer(s,'A04').position={x:13,y:15};
  const {duties,read}=responsibilities(s,'TOP');
  const delay=[...duties].find(([,d])=>d.kind==='PRESSURE');
  assert.equal(delay?.[0],'A02');
  assert.equal([...duties.values()].filter(d=>d.kind==='RETREAT').length,5);
  assert.equal([...duties.values()].filter(d=>d.kind==='HELP').length,0,'no second ball chaser during retreat');
  const target=local(dutyTarget(s,getPlayer(s,'A02'),delay![1],read,'TOP'),'TOP');
  assert.ok(target.y<22&&target.y>18,'the delay meets the actual advancing ball rather than jumping to the settled line');
  s.defence.pressureId='A02';getPlayer(s,'A04').position={x:10,y:20};
  assert.equal([...responsibilities(s,'TOP').duties].find(([,d])=>d.kind==='PRESSURE')?.[0],'A02','useful delay ownership remains stable');
});

test('help leaves its post in response to penetration while retaining the line player',()=>{
  const s=createCoreScenario();
  const {duties,read}=responsibilities(s,'TOP');
  const entry=[...duties].find(([,d])=>d.kind==='HELP')!;
  const helper=getPlayer(s,entry[0]),carrier=getPlayer(s,'H03');
  const waiting=dutyTarget(s,helper,entry[1],read,'TOP');
  assert.ok(startAction(s,carrier,'DRIVE','Threaten the interval',{x:9,y:8},s.defence.pressureId));
  const responding=dutyTarget(s,helper,entry[1],read,'TOP');
  assert.ok(Math.abs(responding.x-carrier.position.x)<Math.abs(waiting.x-carrier.position.x),'the threat actually draws adjacent help');
  const owners=[...duties.values()].filter(d=>d.kind==='PIVOT').map(d=>d.targetId);
  assert.ok(owners.includes('H06'),'the line player is still accounted for');
});

test('a short-handed line can settle, but scattered players near the goal are not a formed line',()=>{
  const s=createCoreScenario();getPlayer(s,'A01').population='SUSPENDED';getPlayer(s,'A05').population='SUSPENDED';
  const {defenders,read}=responsibilities(s,'TOP');
  for(const d of defenders)d.position=zonePost(s,d.zone!,read,'TOP',d.radius);
  assert.equal(lineFormed(s,defenders,'TOP'),true,'all four available defenders can establish their line');
  for(const d of defenders)d.position={x:1,y:9};
  assert.equal(lineFormed(s,defenders,'TOP'),false,'depth alone does not count a collapsed lateral shape as organised');
});

test('possession change cancels stale intentions while preserving bodies, momentum, landing and exchange',()=>{
  const s=createCoreScenario();
  const runner=getPlayer(s,'H02'),lander=getPlayer(s,'H04'),exchanging=getPlayer(s,'H05');
  assert.ok(startAction(s,runner,'RUN','Prior attack',{x:8,y:12}));
  runner.velocity={x:2,y:-3};runner.reception={passActionId:'old-pass',readyTick:0};runner.nextAction='DRIVE';
  lander.airborne={takeoff:{...lander.position},untilTick:30};
  assert.ok(startAction(s,lander,'LAND','Complete the jump'));
  assert.ok(startAction(s,exchanging,'RUN','Reach exchange gate',{x:1,y:20}));exchanging.action!.kind='EXCHANGE';
  const positions=s.players.map(p=>({...p.position})),velocity={...runner.velocity},airborne=structuredClone(lander.airborne);
  changePossession(s,getPlayer(s,'A02'),'Physical interception');
  assert.equal(s.possession.phase,'TRANSITION');assert.equal(s.possession.team,'AWAY');
  assert.equal(runner.action?.phase,'INTERRUPTED');assert.equal(runner.reception,null);assert.equal(runner.nextAction,null);
  assert.deepEqual(s.players.map(p=>p.position),positions);assert.deepEqual(runner.velocity,velocity);assert.deepEqual(lander.airborne,airborne);
  assert.equal(lander.action?.phase,'PREPARING');assert.equal(exchanging.action?.phase,'PREPARING');
});

test('physical acquisition preserves receiver momentum and transfers possession only once',()=>{
  const s=createCoreScenario(),receiver=getPlayer(s,'A02');receiver.velocity={x:1,y:2};
  acquire(s,receiver,receiver.position,'Physical interception');
  assert.deepEqual(receiver.velocity,{x:1,y:2});assert.equal(s.possession.team,'AWAY');
  const id=s.possession.id;
  acquire(s,receiver,receiver.position,'Control retained');
  assert.equal(s.possession.id,id);assert.equal(s.events.filter(e=>e.type==='POSSESSION_CHANGED').length,1);
});

test('endurance changes the cost of equal work, while fatigue remains bounded and recoverable',()=>{
  const s=createCoreScenario(),durable=getPlayer(s,'H02'),fragile=getPlayer(s,'H04');
  setProfile(durable,{endurance:1});setProfile(fragile,{endurance:0});
  durable.velocity={x:4,y:0};fragile.velocity={x:4,y:0};
  const originalProfile={...durable.profile};
  for(let i=0;i<10000;i++)conditionAfter(s);
  assert.equal(durable.condition.distanceMetres,fragile.condition.distanceMetres);
  assert.ok(durable.condition.energy>fragile.condition.energy+.05,'the same workload has different physical cost');
  const tired=fragile.condition.energy;
  s.officialClock.running=false;for(let i=0;i<1000;i++)conditionAfter(s);
  assert.ok(fragile.condition.energy>tired);assert.deepEqual(durable.profile,originalProfile);
  const fresh={...durable,condition:{...durable.condition,energy:1}} as CorePlayer;
  const exhausted={...durable,condition:{...durable.condition,energy:.3}} as CorePlayer;
  assert.ok(executionCapacity(exhausted)>=.8&&executionCapacity(exhausted)<executionCapacity(fresh));
  assert.ok(movementCapacity(exhausted)>=.8&&movementCapacity(exhausted)<movementCapacity(fresh));
});
