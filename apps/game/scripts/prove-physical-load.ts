/** Sequential full-session truth proof using the frozen final cohort inputs. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {resolve,join} from 'node:path';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {createNewCareerState} from '../lib/career/newCareer';import {buildMatchdayReadyEvent} from '../lib/career/careerEvents';
import {startProductionMatch,advanceProductionMatch,resultFromSession,finalizeProductionMatch,archiveFrames} from '../lib/career/productionMatch';
import {archivedMatchModel,snapshotsFor,keeperCategories} from '../lib/matchCenter/model';import {overviewFacts,overviewMoments,sortedPlayers} from '../lib/matchCenter/workspace';
import {PhysicalLoadDiagnostics as RotationFatigueDiagnostics} from './lib/physicalLoadDiagnostics';
import {CalibrationDiagnostics} from './lib/calibrationDiagnostics';import {AttackCycleDiagnostics} from './lib/attackCycleDiagnostics';
import {enableDecisionTrace} from '@handball-manager/handball-engine/src/v2/core/intelligence';
import type {CorePlayer} from '@handball-manager/handball-engine/src/v2/core/state';
const argv=process.argv.slice(2),key=argv.includes('--league')?argv[argv.indexOf('--league')+1]:'hbl';if(!['hbl','allsv'].includes(key))throw Error('league hbl/allsv');
const dir=resolve('../../docs/physical-load-fatigue-v11/final',key),out=resolve('../../docs/physical-load-fatigue-v11/verification');mkdirSync(out,{recursive:true});
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8')),hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const inputs=read(join(dir,'inputs.json')),recipe=read(join(dir,'recipes.json'))[0],expected=read(join(dir,'chunk-000/match-000.json'));
let initial=createNewCareerState(recipe.saveSeed,recipe.managerClubId,structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));
const fixture=initial.fixtures.find(f=>recipe.fixtureId?f.id===recipe.fixtureId:f.type==='LEAGUE'&&(f.homeClubId===recipe.managerClubId||f.awayClubId===recipe.managerClubId))!;
assert.ok(fixture);initial={...initial,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};initial=startProductionMatch(initial,fixture.id);
assert.equal(hash(initial.productionMatch),expected.metadata.initialSessionHash,'exact initial cohort session');
type Career=typeof initial;let mid:Career|null=null;
const simulate=(career:Career,observe=false)=>{
 const diagnostic=new CalibrationDiagnostics(),cycles=new AttackCycleDiagnostics(),fatigue=new RotationFatigueDiagnostics();let calls=0;
 if(observe)enableDecisionTrace(career.productionMatch!.core,0);
 while(career.productionMatch!.core.status==='RUNNING'&&calls++<40){career=advanceProductionMatch(career,10000,false,observe?(s,e)=>{diagnostic.observe(s,e);cycles.observe(s,e);fatigue.observe(s,e);}:undefined);if(observe&&calls===2)mid=JSON.parse(JSON.stringify(career)) as Career;}
 assert.equal(career.productionMatch!.core.match?.phase,'FULLTIME');
 if(observe){const before=hash(career.productionMatch);diagnostic.report(career.productionMatch!.core);cycles.report(career.productionMatch!.core);fatigue.report(career.productionMatch!.core);assert.equal(hash(career.productionMatch),before,'post-match diagnostic reports do not mutate canonical truth');}
 return{career,diagnostic,cycles};
};
const started=performance.now();let observed:Career|null=simulate(structuredClone(initial),true).career;
const sessionHash=hash(observed.productionMatch),resultHash=hash(resultFromSession(observed.productionMatch!));assert.equal(sessionHash,expected.metadata.truthHash);assert.equal(resultHash,expected.metadata.resultHash);
let committed:Career|null=finalizeProductionMatch(observed);assert.equal(finalizeProductionMatch(committed),committed,'exactly-once result commit');
const archive=committed.matchArchives![fixture.id],archiveHash=hash(archive),before=hash(archive),model=archivedMatchModel(archive),names={HOME:'Home',AWAY:'Away'};
assert.equal(model.result,archive.result);assert.equal(archive.result.homeGoals+archive.result.awayGoals,archive.events.filter(e=>e.type==='GOAL').length);
assert.equal(model.shots.length,archive.events.filter(e=>e.type==='SHOT_RELEASED').length);
assert.equal(model.shots.filter(s=>s.kind==='SEVEN_METRE').length,archive.events.filter(e=>e.type==='SHOT_RELEASED'&&e.details.shotKind==='SEVEN_METRE').length);
assert.equal(model.players.reduce((n,p)=>n+p.goals,0),archive.result.homeGoals+archive.result.awayGoals);
assert.equal(model.players.reduce((n,p)=>n+p.shots,0),model.shots.length);
assert.equal(model.players.reduce((n,p)=>n+p.suspensions,0),archive.events.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length);
assert.deepEqual(model.events.filter(e=>e.type==='GOAL').at(-1)?.score,[archive.result.homeGoals,archive.result.awayGoals]);
for(const team of ['HOME','AWAY']as const){const stats=team==='HOME'?model.result.homeStats:model.result.awayStats,shots=model.shots.filter(s=>s.team===team),seven=shots.filter(s=>s.kind==='SEVEN_METRE');
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
let plain:Career|null=simulate(structuredClone(initial)).career;assert.equal(hash(plain.productionMatch),sessionHash);assert.equal(hash(resultFromSession(plain.productionMatch!)),resultHash);assert.equal(hash(finalizeProductionMatch(plain).matchArchives![fixture.id]),archiveHash);plain=null;
assert.ok(mid);const checkpoint=mid as Career;const checkpointSummary=structuredClone({tick:checkpoint.productionMatch!.core.tick,score:checkpoint.productionMatch!.core.score,intents:checkpoint.productionMatch!.core.players.filter(p=>p.handballIntent).length,reentryReaders:checkpoint.productionMatch!.core.players.filter(p=>p.reentryReadTicks!==undefined).length,conditions:checkpoint.productionMatch!.core.players.map(p=>({id:p.id,population:p.population,condition:p.condition,intent:p.handballIntent??null})),exchanges:checkpoint.productionMatch!.core.exchanges,advantage:checkpoint.productionMatch!.core.referee.advantage,sanctions:checkpoint.productionMatch!.core.referee.sanctions,rng:checkpoint.productionMatch!.core.rng});
const resumed=simulate(checkpoint).career;assert.equal(hash(resumed.productionMatch),sessionHash);assert.equal(hash(resultFromSession(resumed.productionMatch!)),resultHash);assert.equal(hash(finalizeProductionMatch(resumed).matchArchives![fixture.id]),archiveHash);
writeFileSync(join(out,`${key}-canonical-proof.json`),JSON.stringify({complete:true,league:key,recipe,inputHash:hash(inputs),sourceFingerprints:read(join(dir,'manifest.json')).sources,sessionHash,resultHash,archiveHash,exactObserverNonMutation:true,postAnalysisNonMutation:true,deterministic:true,midMatchJSONResume:true,checkpoint:checkpointSummary,exactArchive:true,exactlyOnceCommit:true,matchCenter:{energy:true,minutes:true,score:true,shots:true,conversion:true,penalties:true,suspensions:true,timeline:true,playerStats:true,keeperDenominators:true,loadedFacts:true,playerOrdering:true,keyMomentCanonicalPositions:checked},score:[archive.result.homeGoals,archive.result.awayGoals],runtimeMs:performance.now()-started},null,2));
console.log(JSON.stringify({complete:true,league:key,sessionHash,archiveHash,checked,runtimeMs:performance.now()-started}));
