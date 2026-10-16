/** Sequential full-session truth proof using the frozen final cohort inputs. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
import {createNewCareerState} from '../lib/career/newCareer';import {buildMatchdayReadyEvent} from '../lib/career/careerEvents';
import {startProductionMatch,advanceProductionMatch,resultFromSession,finalizeProductionMatch,archiveFrames} from '../lib/career/productionMatch';
import {archivedMatchModel,snapshotsFor,keeperCategories} from '../lib/matchCenter/model';import {overviewFacts,overviewMoments,sortedPlayers} from '../lib/matchCenter/workspace';
import {readOrdinaryFreeThrows} from '../lib/matchCenter/freeThrows';
import {EconomyObserver as RotationFatigueDiagnostics,possessionEconomy} from './lib/possessionEconomy';
import {CalibrationDiagnostics} from './lib/calibrationDiagnostics';import {AttackCycleDiagnostics} from './lib/attackCycleDiagnostics';
import {enableDecisionTrace} from '@handball-manager/handball-engine/src/v2/core/intelligence';
import {ledger} from '@handball-manager/handball-engine/src/v2/core/ledger';
import type {CorePlayer,CoreState,CoreEvent} from '@handball-manager/handball-engine/src/v2/core/state';
const argv=process.argv.slice(2),key=argv.includes('--league')?argv[argv.indexOf('--league')+1]:'hbl';if(!['hbl','allsv'].includes(key))throw Error('league hbl/allsv');
const dir=resolve('../../docs/player-attribute-integration-v1/final',key),out=resolve('../../docs/player-attribute-integration-v1/verification');mkdirSync(out,{recursive:true});
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const inputs=read(join(dir,'inputs.json')),recipe=read(join(dir,'recipes.json'))[0],originalExpected=read(join(dir,'match-000.json'));
const reconciledPath=join(dir,'reconciled','match-000.json'),expected=existsSync(reconciledPath)?read(reconciledPath):originalExpected;
// Reprocessing retained cores can update the pure economy reader without
// retaining a complete result wrapper. Fixture zero's original result hash is
// a limited baseline; all current observed/plain/resumed result hashes are also
// compared directly below, independently of that historical reader receipt.
const expectedInitialHash=expected.initialHash??originalExpected.initialHash,expectedSessionHash=expected.sessionHash??originalExpected.sessionHash,expectedResultHash=expected.resultHash??originalExpected.resultHash;
const cohortManifest=read(join(dir,'manifest.json')),root=resolve('../..');
const proofSourcePaths=[...new Set<string>([...Object.keys(cohortManifest.sources),'apps/game/scripts/prove-player-attribute-truth.ts','apps/game/lib/matchCenter/model.ts','apps/game/lib/matchCenter/workspace.ts'])];
const fingerprint=()=>Object.fromEntries(proofSourcePaths.map(p=>[p,createHash('sha256').update(readFileSync(resolve(root,p),'utf8')).digest('hex')]));
const proofSources=fingerprint();
const targetWhistle:CoreEvent=(()=>{
 const retained=JSON.parse(gunzipSync(readFileSync(join(dir,'core-000.json.gz'))).toString('utf8')) as CoreState;
 assert.equal(hash(retained),expected.coreHash??originalExpected.coreHash,'Exact retained canonical core used to select a natural checkpoint');
 const whistle=retained.events.find(e=>e.type==='WHISTLE_RESTART'&&e.details.kind==='FREE_THROW');
 assert.ok(whistle,'Fixture zero must contain a naturally awarded ordinary free throw');
 return structuredClone(whistle);
})();
let initial=createNewCareerState(recipe.saveSeed,recipe.managerClubId,structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));
const fixture=initial.fixtures.find(f=>recipe.fixtureId?f.id===recipe.fixtureId:f.type==='LEAGUE'&&(f.homeClubId===recipe.managerClubId||f.awayClubId===recipe.managerClubId))!;
assert.ok(fixture);initial={...initial,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};initial=startProductionMatch(initial,fixture.id);
assert.equal(hash(initial.productionMatch),expectedInitialHash,'exact initial cohort session');
type Career=typeof initial;let mid:Career|null=null;let checkpointCaptureMs=0;
const simulationTimings:{observersEnabled:boolean;startTick:number;endTick:number;simulationMs:number;analysisMs:number;calls:number}[]=[];
function checkpointFacts(career:Career){
 const session=career.productionMatch!,core=session.core,economy=possessionEconomy(core),book=ledger(core);
 return structuredClone({tick:core.tick,period:core.period,score:core.score,possession:core.possession,owner:core.possession.team,restart:core.restart,rng:core.rng,
  currentAttack:economy.records.find(r=>r.canonicalId===core.possession.id&&r.period===core.period)??null,
  canonicalCurrentAttack:book.records.find(r=>r.possessionId===core.possession.id)??null,
  freeThrows:readOrdinaryFreeThrows(core.events,{source:'LIVE',behaviorRevision:session.behaviorRevision,complete:false}),
  whistle:core.events.find(e=>e.id===targetWhistle.id)??null,eventCount:core.events.length,
  intents:core.players.filter(p=>p.handballIntent).length,reentryReaders:core.players.filter(p=>p.reentryReadTicks!==undefined).length,
  conditions:core.players.map(p=>({id:p.id,population:p.population,condition:p.condition,intent:p.handballIntent??null})),
  exchanges:core.exchanges,advantage:core.referee.advantage,sanctions:core.referee.sanctions});
}
const simulate=(career:Career,observe=false)=>{
 const diagnostic=new CalibrationDiagnostics(),cycles=new AttackCycleDiagnostics(),fatigue=new RotationFatigueDiagnostics();let calls=0;const simulationStarted=performance.now(),startTick=career.productionMatch!.core.tick;
 if(observe)enableDecisionTrace(career.productionMatch!.core,0);
 while(career.productionMatch!.core.status==='RUNNING'&&calls++<40){
  const tick=career.productionMatch!.core.tick,chunk=tick<targetWhistle.tick?Math.min(10000,targetWhistle.tick-tick):10000;
  career=advanceProductionMatch(career,chunk,false,observe?(s,e)=>{diagnostic.observe(s,e);cycles.observe(s,e);fatigue.observe(s,e);}:undefined);
  if(observe&&!mid&&career.productionMatch!.core.tick===targetWhistle.tick){
   const captureStarted=performance.now(),core=career.productionMatch!.core;
   assert.deepEqual(core.events.find(e=>e.id===targetWhistle.id),targetWhistle,'Natural whistle is unchanged');
   assert.equal(core.restart?.kind,'FREE_THROW');assert.notEqual(core.restart?.phase,'COMPLETED');
   assert.equal(core.restart?.awardedTick,targetWhistle.tick);assert.equal(core.restart?.owner,targetWhistle.details.owner);
   assert.equal(core.possession.team,targetWhistle.details.owner);assert.equal(core.possession.id,targetWhistle.possessionId);
   assert.equal(core.ball.live,false,'JSON checkpoint is inside an actual active ordinary free-throw restart');
   const before=checkpointFacts(career);mid=JSON.parse(JSON.stringify(career)) as Career;
   assert.equal(hash(mid),hash(career),'Complete Career JSON roundtrip is exact');
   assert.deepEqual(checkpointFacts(mid),before,'Owner, attack, RNG, restart, free throws and player state survive JSON exactly');
   assert.ok(before.currentAttack,'The naturally interrupted attack was actually played');
   checkpointCaptureMs+=performance.now()-captureStarted;
  }
 }
 const simulationMs=performance.now()-simulationStarted;
 assert.equal(career.productionMatch!.core.match?.phase,'FULLTIME');
 const analysisStarted=performance.now();
 if(observe){const before=hash(career.productionMatch);diagnostic.report(career.productionMatch!.core);cycles.report(career.productionMatch!.core);possessionEconomy(career.productionMatch!.core,fatigue.technical);assert.equal(hash(career.productionMatch),before,'post-match diagnostic reports do not mutate canonical truth');}
 simulationTimings.push({observersEnabled:observe,startTick,endTick:career.productionMatch!.core.tick,simulationMs,analysisMs:performance.now()-analysisStarted,calls});
 return career;
};
const started=performance.now();let observed:Career|null=simulate(structuredClone(initial),true);
const sessionHash=hash(observed.productionMatch),resultHash=hash(resultFromSession(observed.productionMatch!));assert.equal(sessionHash,expectedSessionHash);assert.equal(resultHash,expectedResultHash);
let committed:Career|null=finalizeProductionMatch(observed);assert.equal(finalizeProductionMatch(committed),committed,'exactly-once result commit');
const archive=committed.matchArchives![fixture.id],archiveHash=hash(archive),before=hash(archive),model=archivedMatchModel(archive),names={HOME:'Home',AWAY:'Away'};
assert.equal(model.result,archive.result);assert.equal(archive.result.homeGoals+archive.result.awayGoals,archive.events.filter(e=>e.type==='GOAL').length);
const economy=possessionEconomy(observed!.productionMatch!.core);for(const team of ['HOME','AWAY']as const){assert.equal(model.freeThrows?.counts?.[team],economy.teams[team].freeThrows);assert.equal((team==='HOME'?model.result.homeStats:model.result.awayStats).turnovers,economy.teams[team].canonicalUiBallLosses);}
assert.ok(mid,'Exact natural ordinary free-throw checkpoint was captured');
const checkpointSummary=checkpointFacts(mid as Career),checkpointSessionHash=hash((mid as Career).productionMatch),checkpointEvents=(mid as Career).productionMatch!.core.events;
function continuationFacts(career:Career){
 const session=career.productionMatch!,core=session.core;
 assert.equal(hash(core.events.slice(0,checkpointSummary.eventCount)),hash(checkpointEvents),'Canonical pre-checkpoint event prefix is unchanged');
 const future=core.events.slice(checkpointSummary.eventCount);
 const completed=future.find(e=>e.type==='RESTART_COMPLETED'&&e.details.kind==='FREE_THROW');
 assert.ok(completed,'The exact naturally paused ordinary free throw completes');
 assert.equal(completed.possessionId,checkpointSummary.possession.id,'Same-team free throw continues the existing attack');
 assert.ok(!future.some(e=>e.tick<=completed.tick&&['POSSESSION_CHANGED','POSSESSION_AWARDED'].includes(e.type)&&e.details.ended===true),'No artificial attack ending before the paused free throw completes');
 const nextTouch=future.find(e=>e.tick>=completed.tick&&e.possessionId===checkpointSummary.possession.id&&['PASS_RELEASED','PASS_RECEIVED','BALL_CONTROLLED','SHOT_RELEASED'].includes(e.type));
 assert.ok(nextTouch,'The resumed restart has a real played touch in the same attack');
 assert.equal(core.players.find(p=>p.id===nextTouch.actorId)?.team,checkpointSummary.owner,'The original attacking owner executes the continuation');
 const freeThrows=readOrdinaryFreeThrows(core.events,{source:'LIVE',behaviorRevision:session.behaviorRevision,complete:true});
 assert.ok(freeThrows.counts);assert.ok(checkpointSummary.freeThrows.counts);
 const prefixIds=new Set(checkpointSummary.freeThrows.eventIds),newIds=freeThrows.eventIds.filter(id=>!prefixIds.has(id));
 for(const id of prefixIds)assert.ok(freeThrows.eventIds.includes(id),'Checkpoint free-throw fact survives exactly once');
 assert.equal(new Set(freeThrows.eventIds).size,freeThrows.eventIds.length,'No duplicate counted free throw after resumption');
 for(const team of ['HOME','AWAY']as const){
  const added=newIds.filter(id=>core.events.find(e=>e.id===id)?.details.owner===team).length;
  assert.equal(freeThrows.counts[team],checkpointSummary.freeThrows.counts[team]+added,'Free-throw counter continues from checkpoint without reset or duplication');
 }
 const finalEconomy=possessionEconomy(core),finishedAttack=finalEconomy.records.find(r=>r.key===checkpointSummary.currentAttack!.key);
 assert.ok(finishedAttack);assert.equal(finishedAttack.team,checkpointSummary.owner);assert.equal(finishedAttack.firstTick,checkpointSummary.currentAttack!.firstTick);
 return{eventSuffixHash:hash(future),rngAtEnd:structuredClone(core.rng),restartCompleted:structuredClone(completed),firstPlayedContinuation:structuredClone(nextTouch),freeThrows,addedFreeThrowEventIds:newIds,finishedAttack,economyHash:hash(finalEconomy)};
}
const continuation=continuationFacts(observed!);

assert.equal(model.shots.length,archive.events.filter(e=>e.type==='SHOT_RELEASED').length);
assert.equal(model.shots.filter(s=>s.kind==='SEVEN_METRE').length,archive.events.filter(e=>e.type==='SHOT_RELEASED'&&e.details.shotKind==='SEVEN_METRE').length);
assert.equal(model.players.reduce((n,p)=>n+p.goals,0),archive.result.homeGoals+archive.result.awayGoals);
assert.equal(model.players.reduce((n,p)=>n+p.shots,0),model.shots.length);
assert.equal(model.players.reduce((n,p)=>n+p.suspensions,0),archive.events.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length);
assert.deepEqual(model.events.filter(e=>e.type==='GOAL').at(-1)?.score,[archive.result.homeGoals,archive.result.awayGoals]);
for(const team of ['HOME','AWAY']as const){const stats=team==='HOME'?model.result.homeStats:model.result.awayStats,shots=model.shots.filter(s=>s.team===team),seven=shots.filter(s=>s.kind==='SEVEN_METRE');
 const releaseByAction=new Map(archive.events.filter(e=>e.type==='SHOT_RELEASED').map(e=>[e.actionId,e]));
 assert.equal(shots.filter(s=>s.phase==='TRANSITION'&&s.outcome==='GOAL').length,archive.events.filter(e=>e.type==='GOAL'&&e.actorId&&archive.people.find(p=>p.id===e.actorId)?.team===team&&releaseByAction.get(e.actionId)?.details.phase==='TRANSITION').length);
 assert.equal(stats.goals,shots.filter(s=>s.outcome==='GOAL').length);assert.equal(stats.shots,shots.length);assert.equal(stats.shootingPct,shots.length?Math.round(stats.goals/shots.length*1000)/10:0);
 assert.equal(stats.sevenMetreAttempts,seven.length);assert.equal(stats.sevenMetreGoals,seven.filter(s=>s.outcome==='GOAL').length);assert.equal(stats.twoMinuteSuspensions,model.events.filter(e=>e.team===team&&e.type==='TWO_MINUTE_SUSPENSION').length);
}
for(const player of model.players){const load=archive.load[player.id];assert.equal(player.energy,load.energy);assert.equal(player.minutes,load.minutes);const core:CorePlayer=observed!.productionMatch!.core.players.find(p=>p.id===player.id)!;assert.equal(load.energy,core.condition.energy*100);assert.equal(load.minutes,core.condition.courtMs/60000);}
const facts=overviewFacts(model,names),loadedModel=archivedMatchModel(JSON.parse(JSON.stringify(archive)));assert.deepEqual(overviewFacts(loadedModel,names),facts);assert.deepEqual(sortedPlayers(loadedModel.players,'HOME','RATING'),sortedPlayers(model.players,'HOME','RATING'));
for(const player of model.players.filter(p=>p.role==='GK')){const rows=keeperCategories(player.id,model.shots,model.events);assert.equal(rows.reduce((n,r)=>n+r.saves,0),player.saves);assert.equal(rows.reduce((n,r)=>n+r.faced,0),player.shotsFaced);}
const frames=archiveFrames(archive);let checked=0;
for(const moment of overviewMoments(model))for(const snapshot of snapshotsFor(moment.canonicalEventId,archive.events,frames,archive.people)){
 const frame=frames.find(f=>f[0]===snapshot.tick)!;assert.ok(frame);assert.equal(snapshot.ball.x,frame[5]/100);assert.equal(snapshot.ball.y,frame[6]/100);
 for(const player of snapshot.players){const index=archive.people.indexOf(player.person),at=frame.findIndex((v,i)=>i>=7&&(i-7)%3===0&&v===index);assert.ok(at>=7);assert.equal(player.position.x,frame[at+1]/100);assert.equal(player.position.y,frame[at+2]/100);}checked++;
}
assert.equal(hash(archive),before,'truth derivation does not mutate archive');
// Scope each continuation separately so three complete career sessions are
// never intentionally retained together. Jobs and simulations are sequential.
observed=null;committed=null;
let plain:Career|null=simulate(structuredClone(initial));assert.equal(hash(plain.productionMatch),sessionHash);assert.equal(hash(resultFromSession(plain.productionMatch!)),resultHash);assert.equal(hash(finalizeProductionMatch(plain).matchArchives![fixture.id]),archiveHash);assert.deepEqual(continuationFacts(plain),continuation,'Plain replay has the same paused-attack and free-throw continuation');plain=null;
const checkpoint=mid as Career;assert.equal(hash(checkpoint.productionMatch),checkpointSessionHash);assert.deepEqual(checkpointFacts(checkpoint),checkpointSummary,'Stored checkpoint was not changed by the other full replays');
const resumed=simulate(checkpoint);assert.equal(hash(resumed.productionMatch),sessionHash);assert.equal(hash(resultFromSession(resumed.productionMatch!)),resultHash);assert.equal(hash(finalizeProductionMatch(resumed).matchArchives![fixture.id]),archiveHash);assert.deepEqual(continuationFacts(resumed),continuation,'Resumed ownership, current attack, RNG, restart, counters and event suffix exactly match uninterrupted play');
assert.deepEqual(fingerprint(),proofSources,'Proof sources remain unchanged');
const performanceComparison={design:'One observed and one plain full replay of the identical fixture with matching natural-checkpoint chunk boundaries, plus one partial JSON continuation. Descriptive single-run timings, not a statistical performance benchmark.',observers:'CalibrationDiagnostics + AttackCycleDiagnostics + EconomyObserver + enabled zero-capacity decision trace',observed:simulationTimings[0],plain:simulationTimings[1],resumed:simulationTimings[2],checkpointCaptureMs,observedSimulationExcludingCheckpointCaptureMs:simulationTimings[0].simulationMs-checkpointCaptureMs,observedOverPlain:simulationTimings[1].simulationMs?simulationTimings[0].simulationMs/simulationTimings[1].simulationMs:null};
writeFileSync(join(out,`${key}-canonical-proof.json`),JSON.stringify({complete:true,league:key,recipe,inputHash:hash(inputs),sourceFingerprints:proofSources,cohortSourceFingerprints:cohortManifest.sources,reference:{economyReport:existsSync(reconciledPath)?reconciledPath:join(dir,'match-000.json'),sessionHashSource:'Original unchanged canonical session receipt',resultHashSource:expected.resultHash?'Selected economy report result receipt':'Original fixture-zero result receipt; reprocessed core report lacks result wrapper. Current observed/plain/resumed result equality is checked separately.',currentResultComparedAcrossAllThreeRuns:true},sessionHash,resultHash,archiveHash,exactObserverNonMutation:true,postAnalysisNonMutation:true,deterministic:true,midMatchJSONResume:true,checkpointSelection:{basis:'First naturally observed ordinary WHISTLE_RESTART/FREE_THROW in retained canonical fixture; exact tick boundary after whistle/restart award',eventId:targetWhistle.id,tick:targetWhistle.tick},checkpointSessionHash,checkpoint:checkpointSummary,continuation,exactOwnerAttackRngRestartAndCounterResume:true,exactArchive:true,exactlyOnceCommit:true,performanceComparison,matchCenter:{transitionGoalsFromOriginalShotAction:true,freeThrows:true,broadBallLosses:true,energy:true,minutes:true,score:true,shots:true,conversion:true,penalties:true,suspensions:true,timeline:true,playerStats:true,keeperDenominators:true,loadedFacts:true,playerOrdering:true,keyMomentCanonicalPositions:checked},score:[archive.result.homeGoals,archive.result.awayGoals],runtimeMs:performance.now()-started},null,2));
console.log(JSON.stringify({complete:true,league:key,sessionHash,archiveHash,checkpointTick:targetWhistle.tick,checked,performanceComparison,runtimeMs:performance.now()-started}));
