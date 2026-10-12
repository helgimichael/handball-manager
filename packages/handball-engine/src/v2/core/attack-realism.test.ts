import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoreScenario } from './scenarios';
import { getPlayer } from './state';
import { distance, laneClearance, local, shotContext, shotOpportunity } from './space';
import { breakDefence, readContinuation } from './engage';
import { applyContinuation, controlReadTicks, coordinate, releaseFromDrive, selectActions } from './structure';
import { execute, startAction } from './actions';
import { setTactics } from './coaching';
import { setProfile } from './testProfile';
import { laneMargin } from './timing';
import { resolveEffects, advanceBall } from './interactions';
import { chooseOffensiveAction, offenceBefore } from './offence';
import { pivotOffer } from './pivot';
import { advanceCoreMutable, assertCore } from './engine';

test('normal and constrained releases cannot turn half-court into a backcourt chance',()=>{
  for(const direction of ['TOP','BOTTOM'] as const) {
    const s=createCoreScenario('TRANSITION_3V2',7,direction),p=getPlayer(s,'H03'),keeper=getPlayer(s,'A07');
    keeper.position={x:10,y:20};
    assert.equal(shotContext(s,p).keeperPresent,true,'a displaced keeper still exists on court');
    assert.equal(shotOpportunity(s,p),null);assert.equal(shotOpportunity(s,p,true),null);
    keeper.population='BENCH';assert.equal(shotOpportunity(s,p)?.emptyGoal,true,'a real empty goal remains supported');
  }
});

test('directional pressure, blocking and tired execution change the same chance',()=>{
  const s=createCoreScenario('BACKCOURT_SHOT'),p=getPlayer(s,'H03');
  for(const d of s.players.filter(a=>a.team==='AWAY'&&a.kind==='FIELD_PLAYER'))d.position={x:19,y:18};
  const clean=shotContext(s,p),d=getPlayer(s,'A03');d.position={x:p.position.x,y:p.position.y-1};
  const closed=shotContext(s,p);assert.ok(closed.pressure>clean.pressure);assert.ok(closed.blockThreat>clean.blockThreat);assert.ok(closed.quality<clean.quality);
  p.condition.energy=.3;assert.ok(shotContext(s,p).quality<closed.quality);
  d.beatenUntilTick=s.tick+40;assert.ok(shotContext(s,p).quality>closed.quality*.8,'beaten bodies cannot supply full pressure');
});

test('a wing earns a useful chance by approaching its real angle while the closed corner stays poor',()=>{
  const s=createCoreScenario('WING_FINISH'),wing=getPlayer(s,'H01');
  for(const d of s.players.filter(a=>a.team==='AWAY'&&a.kind==='FIELD_PLAYER'))d.position={x:18,y:15};
  setProfile(wing,{wingFinishing:.7,shotPlacement:.65});
  const corner=shotContext(s,wing);wing.position={x:2.6,y:3.6};s.ball.position={...wing.position};
  const opened=shotContext(s,wing);assert.ok(opened.angle>corner.angle);assert.ok(opened.quality>corner.quality+.1);
  assert.equal(shotOpportunity(s,{...wing,position:{x:.7,y:1.4}}),null,'width alone does not grant a shot');
  assert.equal(readContinuation(s,wing)?.kind,'SHOOT','the improved separated angle can outweigh returning the ball');
});

test('return selection excludes the goalkeeper and unavailable field players',()=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03');p.position={x:10,y:14.6};s.ball.position={...p.position};
  for(const d of s.players.filter(a=>a.team==='AWAY'&&a.kind==='FIELD_PLAYER'))d.position={x:19,y:7};
  const next=readContinuation(s,p);assert.ok(next&&'receiverId' in next);assert.equal(getPlayer(s,next.receiverId).kind,'FIELD_PLAYER');
  getPlayer(s,next.receiverId).condition.exitRequired=true;
  const revised=readContinuation(s,p);assert.ok(revised&&'receiverId' in revised);assert.notEqual(revised.receiverId,next.receiverId);
});

test('a selected recycle owns the receiving read instead of falling through into another shot selector',()=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03');s.tick=2;
  assert.equal(applyContinuation(s,p,{kind:'RECYCLE',receiverId:'H02',reason:'Return through the adjacent back'}),true);
  assert.equal(p.action?.kind,'HOLD');assert.equal(s.ball.controllerId,p.id);assert.equal(s.possession.id,'possession-0');
});

test('a stopped carrier physically withdraws before rebuilding the same attack',()=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03'),d=getPlayer(s,'A03');
  p.position={x:10,y:9};d.position={x:10,y:8};s.ball.position={...p.position};s.tick=12;
  assert.equal(applyContinuation(s,p,{kind:'RECYCLE',receiverId:'H02',reason:'The next defender closed'}),true);
  assert.equal(p.action?.kind,'DRIBBLE');assert.ok(local(p.action!.target!,s.directions.HOME).y>9);
  assert.deepEqual(p.position,{x:10,y:9},'selection is an intention, never a teleport');assert.equal(s.possession.id,'possession-0');
});

test('active defensive movement accepts live duty targets before the availability gate',()=>{
  const s=createCoreScenario(),d=getPlayer(s,'A02');coordinate(s);
  assert.ok(startAction(s,d,'CONTAIN','Track assigned space',{x:2,y:20}));d.action!.phase='EXECUTING';d.velocity={x:1,y:0};
  const id=d.action!.id,started=d.action!.startedTick,position={...d.position};selectActions(s);
  assert.equal(d.action!.id,id);assert.equal(d.action!.startedTick,started);assert.notDeepEqual(d.action!.target,{x:2,y:20});
  assert.deepEqual(d.position,position);assert.deepEqual(d.velocity,{x:1,y:0},'re-aiming preserves momentum');
});

test('active attacking support steers from actual relationships without restarting the run',()=>{
  const s=createCoreScenario(),wing=getPlayer(s,'H01');coordinate(s);
  assert.ok(startAction(s,wing,'RUN','Offer width',{x:4,y:20}));wing.action!.phase='EXECUTING';
  const id=wing.action!.id;selectActions(s);assert.equal(wing.action!.id,id);assert.notDeepEqual(wing.action!.target,{x:4,y:20});
});

test('a named line feed ends the screen early enough to prepare the real catch',()=>{
  const s=createCoreScenario(),pivot=getPlayer(s,'H06'),carrier=getPlayer(s,'H03');coordinate(s);
  assert.ok(startAction(s,pivot,'SCREEN','Bind the central defender',null,'A06'));pivot.action!.phase='EXECUTING';
  assert.ok(startAction(s,carrier,'PASS','Play the pivot freed by help',null,pivot.id));selectActions(s);
  assert.equal(pivot.action?.kind,'RECEIVE');assert.equal(pivot.reception?.passActionId,carrier.action!.id);
  assert.equal(s.ball.controllerId,carrier.id,'catch still requires the actual ball');
});

test('tempo changes a real receiving read; poorer decision and tired legs require more reading',()=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03');const normal=controlReadTicks(s,p);
  const normalState=structuredClone(s);selectActions(normalState);
  setTactics(s,'HOME',{tempo:'QUICK'});assert.ok(controlReadTicks(s,p)<normal);
  const quickState=structuredClone(s);selectActions(quickState);
  assert.ok(getPlayer(quickState,p.id).action!.executeTicks<getPlayer(normalState,p.id).action!.executeTicks,'the actual HOLD lifecycle changes');
  setProfile(p,{decision:.1});p.condition.energy=.3;assert.ok(controlReadTicks(s,p)>5);
});

test('a legal drive releases before the handling deadline without inventing defensive engagement',()=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03');coordinate(s);s.tick=48;
  assert.ok(startAction(s,p,'DRIVE','Still approaching the interval',{x:9,y:9},'A03'));p.action!.phase='EXECUTING';
  assert.equal(releaseFromDrive(s,p),true);assert.ok(['PASS','SHOOT','JUMP'].includes(p.action!.kind));
  assert.equal(s.defence.broken,null);assert.ok(!s.events.some(e=>e.type==='ADVANTAGE_OPENED'));
  assert.equal(s.ball.controllerId,p.id,'an intention to release is not an automatic completion');
});

test('direct and combination priorities can solve the same live court differently without RNG',()=>{
  let different=0;
  for(const x of [5,8,10,12,15])for(const y of [8.5,9.5,10.5,11.5]) {
    const s=createCoreScenario('BACKCOURT_SHOT'),p=getPlayer(s,'H03');p.position={x,y};s.ball.position={...p.position};coordinate(s);
    setTactics(s,'HOME',{attackIdentity:'DIRECT'});const direct=readContinuation(s,p);
    setTactics(s,'HOME',{attackIdentity:'COMBINATION'});const combination=readContinuation(s,p);
    different+=Number(JSON.stringify(direct)!==JSON.stringify(combination));assert.equal(s.rng.draws,0);
  }
  assert.ok(different>0,'orientation changes actual option priorities where alternatives compete');
});

test('a defender hand reduces lane safety; a delayed defender still leaves a usable pass',()=>{
  const s=createCoreScenario(),carrier=getPlayer(s,'H03'),receiver=getPlayer(s,'H04'),d=getPlayer(s,'A03');
  carrier.position={x:5,y:10};receiver.position={x:9,y:10};d.position={x:7,y:10};
  for(const other of s.players.filter(a=>a.team==='AWAY'&&a.id!==d.id&&a.kind==='FIELD_PLAYER'))other.population='BENCH';
  setProfile(d,{reaction:.1});
  const centre=laneMargin(s,carrier.position,receiver.position,carrier.team,12,0);
  const hand=laneMargin(s,carrier.position,receiver.position,carrier.team,12,.55);
  assert.equal(hand.defenderId,d.id);assert.ok(hand.seconds<centre.seconds);assert.ok(hand.seconds<0);
  d.position={x:7,y:14};setProfile(d,{reaction:.5});
  assert.ok(laneMargin(s,carrier.position,receiver.position,carrier.team,12,.55).seconds>.1);
});

test('timed lane safety distinguishes an actual reachable interception from a delayed defender flight',()=>{
  for(const delayed of [false,true]) {
    const s=createCoreScenario('ESTABLISHED_6V6',77),carrier=getPlayer(s,'H03'),receiver=getPlayer(s,'H04'),d=getPlayer(s,'A03');
    carrier.position={x:5,y:10};receiver.position={x:9,y:10};d.position={x:7,y:delayed?14:10};s.ball.position={...carrier.position};
    for(const other of s.players.filter(a=>a.team==='AWAY'&&a.id!==d.id&&a.kind==='FIELD_PLAYER'))other.population='BENCH';
    setProfile(d,{reaction:delayed?.5:.1,ballWinning:1});setProfile(receiver,{handling:1,composure:1});
    assert.ok(startAction(s,carrier,'PASS','Geometry test',null,receiver.id));carrier.action!.phase='EXECUTING';
    assert.ok(startAction(s,d,'PRESS','Read an actual lane',d.position,carrier.id));d.action!.phase='EXECUTING';
    assert.ok(startAction(s,receiver,'RECEIVE','Prepare for the throw'));receiver.action!.phase='EXECUTING';
    const safety=laneMargin(s,carrier.position,receiver.position,carrier.team,12,.55).seconds;
    resolveEffects(s,[{playerId:carrier.id,kind:'PASS'}]);
    for(let i=0;i<12&&s.ball.flight;i++){s.tick++;s.timeMs=s.tick*50;advanceBall(s);}
    assert.equal(s.ball.controllerId,delayed?receiver.id:d.id);
    assert.equal(safety>0,delayed,'the safety sign agrees with physically reachable flight');
  }
});

test('a relationship does not select a geometrically clear pass the moving defender can reach',()=>{
  const s=createCoreScenario(),p=getPlayer(s,'H03'),receiver=getPlayer(s,'H04'),d=getPlayer(s,'A03');
  p.position={x:10,y:14.6};receiver.position={x:15,y:10.2};s.ball.position={...p.position};s.tick=20;
  offenceBefore(s);s.offence.entry!.family='FREE';
  for(const other of s.players.filter(a=>a.kind==='FIELD_PLAYER'&&![p.id,receiver.id,d.id].includes(a.id)))other.population='BENCH';
  d.position={x:12.5,y:13.5};d.velocity={x:0,y:-4};setProfile(d,{reaction:.1});
  assert.ok(laneClearance(s,p.position,receiver.position,p.team)>.5);
  assert.ok(laneMargin(s,p.position,receiver.position,p.team,10.5+3*p.profile.passing).seconds<.1);
  assert.equal(chooseOffensiveAction(s,p),false);assert.equal(p.action,null);
});

function visiblePreparation() {
  const s=createCoreScenario('BACKCOURT_SHOT'),p=getPlayer(s,'H03'),d=getPlayer(s,'A03'),k=getPlayer(s,'A07');
  p.position={x:8.9,y:8.8};d.position={x:8.9,y:7.5};s.ball.position={...p.position};coordinate(s);
  d.duty={kind:'PRESSURE',targetId:p.id,sinceTick:s.tick,reason:'Own the actual shooting threat'};
  assert.ok(startAction(s,d,'PRESS','Approach actual threat',p.position,p.id));d.action!.phase='EXECUTING';
  assert.ok(startAction(s,k,'REPOSITION','Ordinary stance',{x:9.8,y:1.5}));k.action!.phase='EXECUTING';
  assert.ok(startAction(s,p,'JUMP','Actual wind-up'));
  return {s,p,d,k};
}

test('visible shot preparation sets the actual keeper and assigned blocker without reading an unreleased aim',()=>{
  const {s,p,k,d}=visiblePreparation(),other=structuredClone(s),position={...k.position};
  p.action!.target={x:8.6,y:0};getPlayer(other,p.id).action!.target={x:11.4,y:0};
  selectActions(s);selectActions(other);
  assert.equal(k.action?.kind,'SAVE');assert.equal(k.action?.targetId,null);assert.deepEqual(k.action?.target,position);
  assert.deepEqual(getPlayer(other,k.id).action,k.action,'changing a hidden/unreleased aim cannot change the stance');
  assert.equal(d.action?.kind,'BLOCK');assert.equal(d.action?.targetId,p.id);assert.equal(s.rng.draws,0);
});

test('a set save reacts to the actual flight once while retaining its identity and execution phase',()=>{
  const {s,p,k}=visiblePreparation();selectActions(s);k.action!.phase='EXECUTING';s.tick=10;s.timeMs=500;
  const id=k.action!.id,started=k.action!.startedTick;
  s.ball.controllerId=null;s.ball.mode='SHOT_FLIGHT';s.ball.flight={kind:'SHOT',origin:{...p.position},velocity:{x:0,y:-24},fromId:p.id,receiverId:null,
    actionId:'real-released-shot',possessionId:s.possession.id,releasedTick:s.tick,height:2.3,goalSide:'TOP',touchedIds:[p.id],purpose:'PLAY'};
  const releasedTick=s.tick,drawsBefore=s.rng.draws;selectActions(s);assert.equal(k.action!.targetId,null);assert.equal(s.rng.draws,drawsBefore);
  s.tick=releasedTick+Math.ceil(k.profile.reaction/.05);s.timeMs=s.tick*50;
  selectActions(s);
  assert.equal(k.action!.id,id);assert.equal(k.action!.startedTick,started);assert.equal(k.action!.phase,'EXECUTING');assert.equal(k.action!.targetId,'real-released-shot');
  const target={...k.action!.target!},draws=s.rng.draws;selectActions(s);assert.deepEqual(k.action!.target,target);assert.equal(s.rng.draws,draws,'the same flight is not guessed repeatedly');
});

test('visible preparation sustains readiness and respects contact, impairment and unassigned defenders',()=>{
  const {s,p,d,k}=visiblePreparation();selectActions(s);
  p.airborne={takeoff:{...p.position},untilTick:80};p.nextAction='SHOOT';p.action!.phase='COMPLETED';
  k.action!.phase='EXECUTING';k.action!.phaseTick=0;d.action!.phase='EXECUTING';d.action!.phaseTick=0;s.tick=35;s.timeMs=1750;execute(s);
  assert.equal(k.action!.phase,'EXECUTING');assert.equal(d.action!.phase,'EXECUTING','the real visible threat owns the set block');
  for(const protectedKind of ['CONTACT','BEATEN','UNASSIGNED'] as const) {
    const v=visiblePreparation();
    if(protectedKind==='CONTACT'){v.d.action!.kind='CONTACT';v.d.action!.phase='EXECUTING';}
    if(protectedKind==='BEATEN')v.d.beatenUntilTick=40;
    if(protectedKind==='UNASSIGNED')v.d.duty={kind:'MARK',targetId:'H02',sinceTick:0,reason:'Own another threat'};
    selectActions(v.s);assert.notEqual(v.d.action?.kind,'BLOCK',protectedKind);
  }
});

test('specialized seven-metre reading improves the same seeded penalty read without changing open-play span or reading',()=>{
  for(const penalty of [false,true]) {
    const {s,p,k}=visiblePreparation();selectActions(s);k.action!.phase='EXECUTING';
    p.action!.shotKind=penalty?'SEVEN_METRE':'BACKCOURT_JUMP';s.ball.controllerId=null;s.ball.mode='SHOT_FLIGHT';
    s.ball.flight={kind:'SHOT',origin:{...p.position},velocity:{x:0,y:-24},fromId:p.id,receiverId:null,
      actionId:'specialized-read-shot',possessionId:s.possession.id,releasedTick:s.tick,height:1.5,goalSide:'TOP',touchedIds:[p.id],purpose:'PLAY'};
    s.tick+=Math.ceil(k.profile.reaction/.05);s.timeMs=s.tick*50;
    const strong=structuredClone(s),weak=structuredClone(s);
    getPlayer(strong,k.id).profile={...k.profile,keeper:{...k.profile.keeper!,sevenMetre:1}};
    getPlayer(weak,k.id).profile={...k.profile,keeper:{...k.profile.keeper!,sevenMetre:0}};
    selectActions(strong);selectActions(weak);
    const sharp=getPlayer(strong,k.id),blunt=getPlayer(weak,k.id);
    if(penalty)assert.ok(Math.abs(sharp.action!.target!.x-s.ball.position.x)<Math.abs(blunt.action!.target!.x-s.ball.position.x));
    else assert.deepEqual(sharp.action!.target,blunt.action!.target,'seven-metre skill cannot change an open-play read');
    assert.equal(strong.rng.draws,weak.rng.draws);assert.equal(sharp.profile.topSpeed,blunt.profile.topSpeed);assert.equal(sharp.profile.keeper!.explosiveness,blunt.profile.keeper!.explosiveness);
  }
});

test('actual helper arrival identifies the off-ball man in the vacated space, never the carrier it now marks',()=>{
  for(const covered of [false,true]) {
    const s=createCoreScenario(),helper=getPlayer(s,'A06'),pivot=getPlayer(s,'H06');
    helper.zone=3;s.defence.marks[helper.id]='H03';helper.position={x:10,y:9};pivot.position={x:11.1,y:6.6};
    if(covered)getPlayer(s,'A04').position={x:11.4,y:7};
    breakDefence(s,helper,'came across to help');
    if(covered)assert.equal(s.defence.broken,null,'actual covering body closes the opening');
    else assert.equal(s.defence.broken?.freedId,pivot.id,'the vacated line threat can be continued');
  }
});

test('a remote relay label does not magically cover a genuinely reachable line feed',()=>{
  const s=createCoreScenario(),carrier=getPlayer(s,'H03'),pivot=getPlayer(s,'H06'),owner=getPlayer(s,'A06');
  carrier.position={x:10,y:9};pivot.position={x:11.4,y:6.6};owner.position={x:18,y:7};owner.zone=3;
  for(const other of s.players.filter(p=>p.team==='AWAY'&&p.kind==='FIELD_PLAYER'&&p.id!==owner.id))other.population='BENCH';
  s.defence.marks[owner.id]=pivot.id;assert.equal(pivotOffer(s,carrier,pivot).available,true);
});

test('a completed screen responds to the actual back threat by physically rolling and presenting',()=>{
  const s=createCoreScenario(),carrier=getPlayer(s,'H03'),pivot=getPlayer(s,'H06'),d=getPlayer(s,'A06');
  carrier.position={x:8.9,y:9.2};pivot.position={x:11.1,y:7.1};d.position={x:11.8,y:7.1};s.ball.position={...carrier.position};
  s.checkpoint.stopOnOutcome=false;coordinate(s);
  assert.ok(startAction(s,carrier,'DRIVE','Actual adjacent backcourt threat',{x:8.9,y:7.5},'A03'));carrier.action!.phase='EXECUTING';
  assert.ok(startAction(s,pivot,'SCREEN','Bind the defender for the back',null,d.id));pivot.action!.phase='EXECUTING';d.screenedBy=pivot.id;d.screenedUntilTick=40;
  const initial={...pivot.position};selectActions(s);assert.equal(pivot.action?.kind,'RUN');assert.deepEqual(pivot.position,initial);
  for(let i=0;i<20&&s.status==='RUNNING';i++){const before={...pivot.position};advanceCoreMutable(s);assertCore(s);assert.ok(distance(pivot.position,before)<=pivot.profile.topSpeed*.05+1e-8);}
  assert.ok(distance(pivot.position,initial)>.3,'the actual body rolled instead of receiving an abstract bonus');
});

test('a secured deep pivot catch approaches real legal space and finishes from the closer recorded position',()=>{
  const s=createCoreScenario(),pivot=getPlayer(s,'H06');pivot.position={x:10.4,y:7.76};s.ball.controllerId=pivot.id;s.ball.position={...pivot.position};s.tick=12;s.timeMs=600;
  let y=15;for(const d of s.players.filter(p=>p.team==='AWAY'&&p.kind==='FIELD_PLAYER'))d.position={x:17,y:y++};
  setProfile(pivot,{pivotPlay:.6,finishing:.6,strength:.6});s.checkpoint.stopOnOutcome=false;
  const initial={...pivot.position};selectActions(s);assert.equal(pivot.action?.kind,'DRIVE');assert.deepEqual(pivot.position,initial);
  for(let i=0;i<70&&s.status==='RUNNING'&&!s.events.some(e=>e.type==='SHOT_RELEASED'&&e.actorId===pivot.id);i++){advanceCoreMutable(s);assertCore(s);}
  const shot=s.events.find(e=>e.type==='SHOT_RELEASED'&&e.actorId===pivot.id);assert.ok(shot);assert.equal(shot.details.shotKind,'PIVOT');
  assert.ok(Number(shot.details.y)<initial.y-.4,'shot truth records the closer body position');
  assert.ok(!s.events.some(e=>e.type==='RESTART_AWARDED'&&e.details.reason==='More than three steps'));
});

test('a normal completed approach can still bounce legally when its real preparation fits the holding budget',()=>{
  const s=createCoreScenario('BACKCOURT_SHOT'),p=getPlayer(s,'H03');p.position={x:10,y:8.8};s.ball.position={...p.position};
  s.tick=31;s.timeMs=1550;p.handling.steps=2;selectActions(s);
  assert.equal(p.action?.kind,'DRIBBLE');assert.equal(p.handling.dribbleUsed,false,'the bounce must still execute physically');
  for(let i=0;i<5;i++){advanceCoreMutable(s);assertCore(s);}
  assert.equal(p.handling.dribbleUsed,true);assert.equal(s.ball.mode,'DRIBBLE');assert.equal(s.ball.controllerId,p.id);
});

test('transition retains an open personal lane but releases its ahead runner when actually contained',()=>{
  for(const contained of [false,true]) {
    const s=createCoreScenario('TRANSITION_3V2'),p=getPlayer(s,'H03'),runner=getPlayer(s,'H01');
    runner.position={x:2,y:15};
    if(contained)getPlayer(s,'A03').position={x:10,y:21};
    s.tick=12;s.timeMs=600;coordinate(s);selectActions(s);
    if(contained){assert.equal(p.action?.kind,'PASS');assert.equal(p.action?.targetId,runner.id);}
    else {assert.equal(p.action?.kind,'DRIVE');assert.equal(p.handballIntent?.kind,'EXPLOIT_ADVANTAGE');assert.ok(p.action!.target!.y<p.position.y);}
    assert.equal(s.ball.controllerId,p.id);
  }
});

test('a transition carries the actual open lane when a settled entry would otherwise own the read',()=>{
  const s=createCoreScenario('TRANSITION_3V2'),p=getPlayer(s,'H03');p.position={x:10,y:16.5};s.ball.position={...p.position};
  s.tick=12;s.timeMs=600;offenceBefore(s);assert.ok(s.offence.entry);coordinate(s);selectActions(s);
  assert.equal(p.action?.kind,'DRIVE');assert.equal(p.handballIntent?.kind,'ATTACK_NEXT_DEFENDER');
  assert.ok(p.action!.target!.y<p.position.y);assert.equal(p.handling.dribbleUsed,false,'legal steps remain available before a required bounce');
  assert.deepEqual(p.position,{x:10,y:16.5});assert.equal(s.possession.phase,'TRANSITION');
});
