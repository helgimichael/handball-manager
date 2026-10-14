import test from 'node:test';import assert from 'node:assert/strict';
import {createCoreScenario} from './scenarios';import {createIntelligenceScenario} from './intelligenceScenarios';
import {getPlayer,record,REENTRY_RECEIVE_REASON,type CoreState} from './state';import {startAction} from './actions';
import {offenceBefore,offenceAfter} from './offence';
import {advanceCoreMutable} from './engine';import {acquire,awardRestart} from './transitions';
import {decideHandball,commitHandball,intelligenceRelevant} from './intelligence';import {applyContinuation,coordinate,selectActions,controlReadTicks} from './structure';
import {planContact} from './contact';import {lostContactShoulder,defenderRelation} from './threatRelation';
import {goal,world} from './space';import {readContact} from './sanction';import {judgeFoul} from './referee';
import {planShotTarget} from './execution';import {setProfile} from './testProfile';import {saveCore,loadCore} from './replay';

test('a physical return clears the old carrier relationship while retaining the attack and momentum',()=>{
 const {s,p,mate}=createIntelligenceScenario('A_FREE_TO_GOAL');coordinate(s);commitHandball(s,p,decideHandball(s,p));
 const possession=s.possession.id,velocity={...p.velocity};assert.ok(p.carrierRead&&p.handballIntent);
 s.ball.controllerId=mate.id;s.ball.flight=null;acquire(s,p,p.position,'Actual return receipt');
 assert.equal(s.possession.id,possession);assert.equal(p.carrierRead,undefined);assert.equal(p.handballIntent,undefined);assert.deepEqual(p.velocity,velocity);
 coordinate(s);assert.ok(p.carrierRead);assert.equal(decideHandball(s,p).chosen?.motor,'DRIVE');
});
test('recovered defence permits a physical withdrawal/recycle without ending the attack or granting a shot',()=>{
 const {s,p,mate,d}=createIntelligenceScenario('H_NO_ADVANTAGE');p.position={x:10,y:9.8};d.position={x:10,y:8.8};s.ball.position={...p.position};p.handling.heldSinceTick=s.tick;p.velocity={x:0,y:0};
 const id=s.possession.id;assert.ok(applyContinuation(s,p,{kind:'RECYCLE',receiverId:mate.id,reason:'Recovered defence: rebuild'}));
 assert.equal(p.action?.kind,'DRIBBLE');assert.ok(p.action!.target!.y>p.position.y);assert.equal(s.possession.id,id);assert.equal(s.ball.controllerId,p.id);assert.equal(s.events.filter(e=>e.type==='SHOT_RELEASED').length,0);
});
test('a second receiver with a real new window can build a shot after the first threat is stopped',()=>{
 const {s,p,mate,d,h}=createIntelligenceScenario('H_NO_ADVANTAGE');s.checkpoint.stopOnOutcome=false;
 mate.position={x:10,y:9};d.position={x:17,y:12};h.position={x:17,y:10};p.position={x:15,y:12};
 acquire(s,mate,mate.position,'Actual recycle receipt');const id=s.possession.id;
 for(let i=0;i<160&&s.status==='RUNNING'&&!s.events.some(e=>e.type==='SHOT_RELEASED');i++)advanceCoreMutable(s);
 assert.ok(s.events.some(e=>e.type==='SHOT_RELEASED'&&e.actorId===mate.id&&e.possessionId===id));
});
test('a completed good recycle retires only the old entry and allows a new entry from the retained ball',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03');offenceBefore(s);assert.ok(s.offence.entry);s.offence.entry!.established=true;const first=s.offence.entry!.id,id=s.possession.id;
 record(s,'ACTION_STARTED',p,{kind:'PASS',reason:'INTELLIGENCE RECYCLE: recovered defence'});offenceAfter(s);assert.equal(s.offence.entry,null);assert.equal(s.possession.id,id);
 s.tick+=25;s.timeMs=s.tick*50;offenceBefore(s);const next=s.offence.entry as CoreState['offence']['entry'];assert.ok(next);assert.notEqual(next.id,first);assert.equal(s.ball.controllerId,p.id);
});
test('legal side containment and a legitimately recovered defender do not choose an automatic hold',()=>{
 for(const offset of [-.2,-.5]){const {s,p,d}=createIntelligenceScenario('A_FREE_TO_GOAL');d.position={x:10.7,y:p.position.y+offset};d.profile={...d.profile,discipline:.1};s.defence.pressureId=d.id;
 startAction(s,p,'DRIVE','Actual progression',{x:10,y:8});p.action!.phase='EXECUTING';assert.equal(lostContactShoulder(p,d,goal('TOP')),false);assert.ok(planContact(s,d,p));assert.equal(d.action!.contact!.technique,'BENT_ARMS');
 assert.equal(readContact(s,p,d,'BENT_ARMS','SIDE',.8).severity,'LEGAL');}
});
test('a named second-attack back checks the actual recycle while preserving physical momentum and ownership',()=>{
 for(const oldKind of ['RUN','RECEIVE']as const){
 const s=createCoreScenario(),p=getPlayer(s,'H03'),back=getPlayer(s,'H04');s.possession.phase='ESTABLISHED';
 startAction(s,back,oldKind,'Old entry destination',{x:15,y:8});back.action!.phase='EXECUTING';back.velocity={x:1,y:0};
 startAction(s,p,'PASS','INTELLIGENCE RECYCLE: LANE_CLOSED; reconnect',null,back.id);
 const position={...back.position},velocity={...back.velocity};selectActions(s);assert.equal(back.action?.kind,'RECEIVE');assert.equal(back.action?.reason,REENTRY_RECEIVE_REASON);assert.deepEqual(back.position,position);assert.deepEqual(back.velocity,velocity);assert.equal(s.ball.controllerId,p.id);
 }
});
test('loss of the near shoulder can justify an illegal hold before the full duel-beaten margin',()=>{
 const {s,p,d}=createIntelligenceScenario('A_FREE_TO_GOAL');d.position={x:10.5,y:p.position.y+.4};d.profile={...d.profile,discipline:.1};s.defence.pressureId=d.id;
 startAction(s,p,'DRIVE','Actual progression',{x:10,y:8});p.action!.phase='EXECUTING';
 assert.equal(defenderRelation(p,d,goal('TOP')).beaten,false);assert.equal(lostContactShoulder(p,d,goal('TOP')),true);assert.ok(planContact(s,d,p));assert.equal(d.action!.contact!.technique,'HOLD');
 const read=readContact(s,p,d,'HOLD','SIDE',.7);assert.equal(read.severity,'PUNISHABLE');d.warnings=1;p.action!.phase='COMMITTED';
 judgeFoul(s,p,d,read.severity,read.reason,false,'actual-contact');assert.equal(d.population,'SUSPENDED');assert.equal(s.restart?.kind,'FREE_THROW');
});
test('court-read credit belongs only to an actually controlled prepared return and persists through JSON',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03'),back=getPlayer(s,'H04'),normal=controlReadTicks(s,back);
 startAction(s,p,'PASS','INTELLIGENCE RECYCLE: LANE_CLOSED',null,back.id);const passId=p.action!.id;
 startAction(s,back,'RECEIVE',REENTRY_RECEIVE_REASON);back.action!.phase='EXECUTING';s.tick+=12;s.timeMs=s.tick*50;
 assert.equal(back.reentryReadTicks,undefined);acquire(s,back,back.position,'Actual named return contact',passId);assert.equal(back.reentryReadTicks,12);assert.ok(controlReadTicks(s,back)<normal);assert.ok(controlReadTicks(s,back)>=4);
 const restored=structuredClone(loadCore(saveCore(s)));assert.equal(getPlayer(restored,back.id).reentryReadTicks,12);
 assert.equal(intelligenceRelevant(decideHandball(s,back),back),true,'the prepared second-entry receiver uses the current advantage read even while stationary');
 acquire(s,back,back.position,'Ordinary later receipt');assert.equal(back.reentryReadTicks,undefined);assert.equal(controlReadTicks(s,back),normal);
});
test('rear bent-arm restraint of actual progression is punishable without manufacturing a hold or a penalty',()=>{
 const {s,p,d}=createIntelligenceScenario('A_FREE_TO_GOAL');d.position={x:10.4,y:p.position.y+.4};startAction(s,p,'DRIVE','Actual progression',{x:10,y:8});p.action!.phase='EXECUTING';p.velocity={x:0,y:-2};
 const read=readContact(s,p,d,'BENT_ARMS','BEHIND',.6);assert.equal(read.severity,'PUNISHABLE');assert.equal(read.clearChance,false);assert.equal(read.detail.technique,'BENT_ARMS');assert.equal(read.detail.restrainingProgression,true);
 assert.equal(readContact(s,p,d,'BENT_ARMS','BEHIND',.9).severity,'ORDINARY','a light rear touch is not intense body restraint');
 p.velocity={x:0,y:0};assert.equal(readContact(s,p,d,'BENT_ARMS','BEHIND',.6).severity,'ORDINARY');
});
test('ordinary frontal fouls never escalate merely because global suspension counts are injected',()=>{
 const {s,p,d}=createIntelligenceScenario('H_NO_ADVANTAGE');(s as CoreState&{suspensionTarget:number}).suspensionTarget=99;d.warnings=1;d.sanctions=1;
 judgeFoul(s,p,d,'ORDINARY','Ordinary momentum foul',false,'ordinary');assert.equal(d.population,'COURT');assert.equal(d.sanctions,1);
});
test('clear chance awards and discipline remain independent; dangerous contact uses the existing sanction path',()=>{
 for(const severity of ['ORDINARY','SERIOUS']as const){const {s,p,d}=createIntelligenceScenario('H_NO_ADVANTAGE');judgeFoul(s,p,d,severity,'Controlled clear-chance fixture',true,'clear');
 assert.equal(s.restart?.kind,'SEVEN_METRE');assert.equal(d.population,severity==='SERIOUS'?'SUSPENDED':'COURT');}
});
export function penaltyDuel(seed:number,shooter=.65,keeper=.5,history?:number){
 const s=createCoreScenario('BACKCOURT_SHOT',seed),p=getPlayer(s,'H03'),k=getPlayer(s,'A07');
 if(history!==undefined)(s as CoreState&{penaltyConversionBenchmark:number}).penaltyConversionBenchmark=history;
 for(const body of s.players)if(body!==p&&body!==k){body.population='BENCH';body.zone=null;}
 p.position={x:10,y:7};k.position={x:10,y:1.2+1.2*(.25+.5*keeper)};s.ball.position={...p.position};s.ball.controllerId=p.id;s.checkpoint.stopOnOutcome=false;s.checkpoint.maxTicks=1000;
 setProfile(p,{shotPlacement:shooter,finishing:shooter,shotPower:shooter,composure:shooter});setProfile(k,{reaction:.32-.18*keeper,acceleration:5+4*keeper,topSpeed:3.2+1.6*keeper,keeper:{positioning:keeper,setPosition:keeper,reaction:keeper,explosiveness:keeper,low:keeper,high:keeper,close:keeper,long:keeper,wing:keeper,sevenMetre:keeper,reading:keeper,outlet:keeper}});
 awardRestart(s,'SEVEN_METRE','HOME',p.position,'Controlled penalty',p,false);
 for(let i=0;i<350&&s.status==='RUNNING';i++){advanceCoreMutable(s);if(s.events.some(e=>e.type==='SHOT_RELEASED')&&!s.ball.flight)break;}
 const shot=s.events.find(e=>e.type==='SHOT_RELEASED');assert.ok(shot);const goals=s.events.filter(e=>e.type==='GOAL'&&e.actionId===shot.actionId).length,saves=s.events.filter(e=>['SAVE_CAUGHT','SAVE_PARRY'].includes(e.type)&&e.actionId===shot.actionId).length;
 return{s,goal:goals>0,save:goals===0&&saves>0};
}
test('penalty placement uses finishing/composure while normal field-shot placement stays independent',()=>{
 const s=createCoreScenario(),p=getPlayer(s,'H03');startAction(s,p,'SHOOT','Normal window',null,null,'STANDING');const open=planShotTarget(s,p);
 setProfile(p,{finishing:.05,composure:.05});assert.equal(planShotTarget(s,p).placement,open.placement);
 p.action!.shotKind='SEVEN_METRE';const weak=planShotTarget(s,p).placement;setProfile(p,{finishing:.95,composure:.95});assert.ok(planShotTarget(s,p).placement>weak);
});
test('penalty shooter and keeper capacity matter, outcomes vary and the actual save/miss retains shot identity',(t)=>{
 let strong=0,weak=0,goodKeeper=0,poorKeeper=0,normal=0,saves=0;
 for(let seed=1;seed<=80;seed++){strong+=Number(penaltyDuel(seed,.9,.5).goal);weak+=Number(penaltyDuel(seed,.25,.5).goal);goodKeeper+=Number(penaltyDuel(seed,.65,.9).save);poorKeeper+=Number(penaltyDuel(seed,.65,.1).save);const d=penaltyDuel(seed);normal+=Number(d.goal);saves+=Number(d.save);}
 assert.ok(strong>weak,`${strong}/${weak}`);assert.ok(goodKeeper>poorKeeper,`${goodKeeper}/${poorKeeper}`);assert.ok(normal>0&&normal<80);assert.ok(saves>0);t.diagnostic(JSON.stringify({n:80,strong,weak,goodKeeper,poorKeeper,normal,saves}));
});
test('intents, attack continuation and sanction state survive exact mid-state JSON continuation',()=>{
 const {s,p,d}=createIntelligenceScenario('A_FREE_TO_GOAL');commitHandball(s,p,decideHandball(s,p));startAction(s,p,'DRIVE','Continue own advantage',world({x:10,y:8},'TOP'));p.action!.phase='EXECUTING';s.checkpoint.stopOnOutcome=false;
 d.position={x:10,y:11.3};d.warnings=1;judgeFoul(s,p,d,'PUNISHABLE','Actual late hold; protected continuation',false,'persisted-contact');assert.ok(s.referee.advantage);
 const restored=structuredClone(loadCore(saveCore(s)));for(let i=0;i<80&&s.status==='RUNNING';i++){advanceCoreMutable(s);advanceCoreMutable(restored);}assert.deepEqual(restored,s);
});
test('penalty outcome, identity, events and RNG ignore injected current or historical conversion benchmarks',()=>{
 const low=penaltyDuel(91,.65,.5,.01),high=penaltyDuel(91,.65,.5,.99);
 assert.deepEqual(low.s.events,high.s.events);assert.deepEqual(low.s.rng,high.s.rng);assert.deepEqual(low.s.ball,high.s.ball);assert.deepEqual(low.s.score,high.s.score);
});
test('re-entry and discipline ignore empirical targets and hypothetical per-match quota feedback',()=>{
 const {s}=createIntelligenceScenario('H_NO_ADVANTAGE');s.checkpoint.stopOnOutcome=false;
 const a=structuredClone(s),b=structuredClone(s);
 Object.assign(a,{benchmarkTargets:{attempts:1,goals:1,conversion:.01,suspensions:1,sevenMetreConversion:.01},quotaCounts:{attempts:999,goals:999,suspensions:999,sevenMetres:999}});
 Object.assign(b,{benchmarkTargets:{attempts:200,goals:100,conversion:.99,suspensions:20,sevenMetreConversion:.99},quotaCounts:{attempts:0,goals:0,suspensions:0,sevenMetres:0}});
 for(let i=0;i<160&&a.status==='RUNNING';i++){advanceCoreMutable(a);advanceCoreMutable(b);}
 assert.deepEqual(a.events,b.events);assert.deepEqual(a.players,b.players);assert.deepEqual(a.referee,b.referee);assert.deepEqual(a.possession,b.possession);assert.deepEqual(a.rng,b.rng);assert.deepEqual(a.ball,b.ball);
});
