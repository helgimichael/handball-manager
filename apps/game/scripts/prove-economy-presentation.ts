/** Passive retained-core presentation proof. No match ticks, storage or reconstructed frames. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {gunzipSync} from 'node:zlib';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import type {CoreEvent,CoreState,TeamId} from '@handball-manager/handball-engine/src/v2/core/state';
import {ledger,lossClassOf} from '@handball-manager/handball-engine/src/v2/core/ledger';
import {createNewCareerState} from '../lib/career/newCareer';
import {buildMatchdayReadyEvent} from '../lib/career/careerEvents';
import {archiveFrames,finalizeProductionMatch,resultFromSession,startProductionMatch} from '../lib/career/productionMatch';
import {archivedMatchModel,createLiveMatchReader,liveMatchModel,type MatchCenterModel} from '../lib/matchCenter/model';
import {readOrdinaryFreeThrows} from '../lib/matchCenter/freeThrows';
import {TeamStats} from '../components/matchCenter/WorkspaceViews';

// The existing component tests use the same classic-JSX compatibility for tsx.
Object.assign(globalThis,{React});
const root=resolve('../..'),out=join(root,'docs/player-attributes-possession-economy-v1/verification');
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const textHash=(path:string)=>createHash('sha256').update(readFileSync(path,'utf8')).digest('hex');
const sourcePaths=[
 'apps/game/scripts/prove-economy-presentation.ts',
 'apps/game/lib/career/productionMatch.ts',
 'apps/game/lib/matchCenter/model.ts',
 'apps/game/lib/matchCenter/freeThrows.ts',
 'apps/game/components/matchCenter/WorkspaceViews.tsx',
 'packages/handball-engine/src/v2/core/ledger.ts',
];
const fingerprint=()=>Object.fromEntries(sourcePaths.map(path=>[path,textHash(join(root,path))]));
const sources=fingerprint(),started=performance.now();
const projection=(model:MatchCenterModel)=>({
 result:model.result,freeThrows:model.freeThrows,shots:model.shots,
 // Live availability and archive population labels intentionally have different
 // sources. Compare recorded identity, canonical performance and actual load.
 players:model.players.map(p=>({id:p.id,name:p.name,number:p.number,role:p.role,team:p.team,started:p.started,startEnergy:p.startEnergy,
  minutes:p.minutes,energy:p.energy,goals:p.goals,shots:p.shots,saves:p.saves,shotsFaced:p.shotsFaced,rating:p.rating,suspensions:p.suspensions,technicalViolations:p.technicalViolations})),
 transitionGoals:Object.fromEntries((['HOME','AWAY']as const).map(team=>[team,model.shots.filter(s=>s.team===team&&s.phase==='TRANSITION'&&s.outcome==='GOAL').length])),
});

const receipts=[];
for(const league of ['hbl','allsv']){
 const dir=join(root,'docs/player-attributes-possession-economy-v1/final',league),inputs=read(join(dir,'inputs.json')),recipe=read(join(dir,'recipes.json'))[0],original=read(join(dir,'match-000.json'));
 const reportPath=existsSync(join(dir,'reconciled/match-000.json'))?join(dir,'reconciled/match-000.json'):join(dir,'match-000.json'),expected=read(reportPath);
 const retained=JSON.parse(gunzipSync(readFileSync(join(dir,'core-000.json.gz'))).toString('utf8')) as CoreState;
 const coreHash=hash(retained),rngBefore=structuredClone(retained.rng),tickBefore=retained.tick;
 assert.equal(coreHash,original.coreHash,'Retained core identity');assert.equal(retained.match?.phase,'FULLTIME');
 let career=createNewCareerState(recipe.saveSeed,recipe.managerClubId,structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));
 const fixture=career.fixtures.find(f=>f.id===recipe.fixtureId)!;assert.ok(fixture);
 career={...career,gameDate:fixture.date,careerEvents:[buildMatchdayReadyEvent(fixture.id,fixture.date)]};career=startProductionMatch(career,fixture.id);
 assert.ok(career.productionMatch);assert.equal(career.productionMatch.core.tick,0,'Initial wrapper creates no advanced match ticks');
 assert.equal(hash(career.productionMatch),original.initialHash,'Genuine recipe people and initial production wrapper');
 const peopleHash=hash(career.productionMatch.people);
 career={...career,productionMatch:{...career.productionMatch,core:retained,frames:[],pausedAtHalf:false,error:null}};
 const session=career.productionMatch!,people=new Map(session.people.map(p=>[p.id,p]));
 assert.equal(people.size,session.people.length);assert.deepEqual([...people.keys()].sort(),retained.players.map(p=>p.id).sort());
 const raw=retained.events,shots=raw.filter(e=>e.type==='SHOT_RELEASED'),goals=raw.filter(e=>e.type==='GOAL');
 const releaseByAction=new Map(shots.map(e=>[e.actionId,e])),goalActions=new Set(goals.map(e=>e.actionId));
 assert.ok(shots.every(e=>e.actionId!==null));assert.equal(releaseByAction.size,shots.length,'One actual release per shot action');
 for(const goal of goals){assert.ok(goal.actionId!==null);assert.equal(releaseByAction.get(goal.actionId)?.actorId,goal.actorId,'Goal joins its actual original release');}
 const creditedSaves=raw.filter(e=>['SAVE_CAUGHT','SAVE_PARRY'].includes(e.type)&&!goalActions.has(e.actionId));
 const book=ledger(retained),freeThrows=readOrdinaryFreeThrows(raw,{source:'LIVE',behaviorRevision:session.behaviorRevision,complete:true});
 assert.equal(freeThrows.provenance,'CANONICAL_WHISTLES');assert.ok(freeThrows.counts);
 const whistles=new Map<string,CoreEvent>();
 for(const event of raw.filter(e=>e.type==='WHISTLE_RESTART'&&e.details.kind==='FREE_THROW')){
  assert.equal(typeof event.details.foulId,'string');const id=String(event.details.foulId),previous=whistles.get(id);
  if(previous)assert.equal(previous.details.owner,event.details.owner);else whistles.set(id,event);
 }
 const belongs=(event:CoreEvent,team:TeamId)=>people.get(event.actorId??'')?.team===team;
 const teams=Object.fromEntries((['HOME','AWAY']as const).map(team=>{
  const ownShots=shots.filter(e=>belongs(e,team)),ownGoals=goals.filter(e=>belongs(e,team)),seven=ownShots.filter(e=>e.details.shotKind==='SEVEN_METRE');
  const keepers=new Set(session.people.filter(p=>p.team===team&&p.role==='GK').map(p=>p.id));
  const saves=creditedSaves.filter(e=>belongs(e,team)).length;
  const conceded=goals.filter(e=>keepers.has(String(releaseByAction.get(e.actionId)?.details.goalkeeperId??''))).length;
  return[team,{goals:ownGoals.length,shots:ownShots.length,shootingPct:ownShots.length?Math.round(ownGoals.length/ownShots.length*1000)/10:0,
   saves,shotsFaced:saves+conceded,broadBallLosses:book.records.filter(r=>r.team===team&&lossClassOf(r.ending)).length,
   sevenMetreAttempts:seven.length,sevenMetreGoals:seven.filter(e=>goalActions.has(e.actionId)).length,
   twoMinuteSuspensions:raw.filter(e=>e.type==='TWO_MINUTE_SUSPENSION'&&belongs(e,team)).length,
   freeThrows:[...whistles.values()].filter(e=>e.details.owner===team).length,
   transitionGoals:ownGoals.filter(e=>releaseByAction.get(e.actionId)?.details.phase==='TRANSITION').length}];
 })) as Record<TeamId,{goals:number;shots:number;shootingPct:number;saves:number;shotsFaced:number;broadBallLosses:number;sevenMetreAttempts:number;sevenMetreGoals:number;twoMinuteSuspensions:number;freeThrows:number;transitionGoals:number}>;
 const result=resultFromSession(session),live=liveMatchModel(session),reader=createLiveMatchReader(),cached=reader(session),cachedAgain=reader(session);
 assert.deepEqual(projection(cached),projection(live),'Cached and direct live models agree');
 assert.deepEqual(projection(cachedAgain),projection(cached),'Repeated passive cached reading is idempotent');
 assert.equal(hash(retained),coreHash,'Result/live/cached reading preserves complete canonical state');
 const committed=finalizeProductionMatch(career),archive=committed.matchArchives![fixture.id];assert.ok(archive);
 assert.equal(archiveFrames(archive).length,0,'No frame reconstruction is claimed by this passive proof');
 assert.deepEqual(archive.result,result,'Actual production finalization persists the current result');
 assert.equal(hash(archive.people),peopleHash,'Actual finalization retains genuine match people');
 const archived=archivedMatchModel(archive),loaded=archivedMatchModel(JSON.parse(JSON.stringify(archive)));
 assert.deepEqual(projection(archived),projection(live),'Actual archive and live canonical presentation facts agree');
 assert.deepEqual(projection(loaded),projection(archived),'Serialized actual archive preserves presentation facts');
 for(const [label,model]of [['live',live],['cached',cached],['archived',archived],['loadedArchive',loaded]] as const){
  for(const team of ['HOME','AWAY']as const){
   const fact=teams[team],stats=team==='HOME'?model.result.homeStats:model.result.awayStats;
   assert.equal(stats.goals,fact.goals);assert.equal(stats.shots,fact.shots);assert.equal(stats.shootingPct,fact.shootingPct);
   assert.equal(stats.saves,fact.saves);assert.equal(stats.shotsFaced,fact.shotsFaced);assert.equal(stats.turnovers,fact.broadBallLosses);
   assert.equal(stats.sevenMetreAttempts,fact.sevenMetreAttempts);assert.equal(stats.sevenMetreGoals,fact.sevenMetreGoals);assert.equal(stats.twoMinuteSuspensions,fact.twoMinuteSuspensions);
   assert.equal(model.freeThrows?.counts?.[team],fact.freeThrows);assert.equal(freeThrows.counts![team],fact.freeThrows);
   assert.equal(fact.broadBallLosses,expected.teams[team].canonicalUiBallLosses);assert.equal(fact.freeThrows,expected.teams[team].freeThrows);
   assert.equal(model.shots.filter(s=>s.team===team&&s.phase==='TRANSITION'&&s.outcome==='GOAL').length,fact.transitionGoals,`${label}: phase joined to original shot action, not goal-time possession state`);
   assert.equal(model.result.events.filter(e=>e.side===(team==='HOME'?'home':'away')&&e.type==='TURNOVER').length,fact.broadBallLosses);
  }
  for(const row of model.players){
   const p=retained.players.find(p=>p.id===row.id)!;assert.ok(p);const own=raw.filter(e=>e.actorId===row.id);
   assert.equal(row.goals,own.filter(e=>e.type==='GOAL').length);assert.equal(row.shots,own.filter(e=>e.type==='SHOT_RELEASED').length);
   assert.equal(row.saves,creditedSaves.filter(e=>e.actorId===row.id).length);
   if(row.role==='GK')assert.equal(row.shotsFaced,row.saves+goals.filter(e=>releaseByAction.get(e.actionId)?.details.goalkeeperId===row.id).length);
   assert.equal(row.suspensions,own.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length);
   assert.equal(row.technicalViolations,own.filter(e=>e.type==='TECHNICAL_VIOLATION'||e.type==='OFFENSIVE_FOUL').length);
   assert.equal(row.minutes,p.condition.courtMs/60000);assert.equal(row.energy,p.condition.energy*100);
   const contribution=[...result.homePlayerContributions,...result.awayPlayerContributions].find(c=>c.playerId===row.id);
   assert.equal(row.rating,contribution?.rating??null,'Existing canonical contribution/rating remains authoritative');
  }
  for(const fact of model.shots){
   const originalShot=raw.find(e=>e.id===fact.eventId)!;assert.equal(originalShot.type,'SHOT_RELEASED');
   assert.equal(fact.phase,String(originalShot.details.phase??''));assert.equal(fact.outcome==='GOAL',goalActions.has(originalShot.actionId));
  }
  const html=renderToStaticMarkup(React.createElement(TeamStats,{model}));
  const transitionRow=`<td>${teams.HOME.transitionGoals}</td><th scope="row">Omst\u00e4llningsm\u00e5l</th><td>${teams.AWAY.transitionGoals}</td>`;
  const freeThrowRow=`<td>${teams.HOME.freeThrows}</td><th scope="row">Frikast</th><td>${teams.AWAY.freeThrows}</td>`;
  assert.ok(html.includes(transitionRow),`${label}: rendered transition-goal row is canonical`);
  assert.ok(html.includes(freeThrowRow),`${label}: rendered ordinary free-throw row is canonical`);
 }
 assert.equal(hash(retained),coreHash,'Finalization and all passive presentation reads preserve canonical state');
 assert.deepEqual(retained.rng,rngBefore);assert.equal(retained.tick,tickBefore);
 receipts.push({league,complete:true,recipe,retainedCoreHash:coreHash,initialWrapperHash:original.initialHash,genuinePeopleHash:peopleHash,resultHash:hash(result),archiveHash:hash(archive),teams,
  models:{directLive:true,cachedLive:true,repeatedCachedLive:true,actualFinalizedArchive:true,jsonLoadedArchive:true},
  assertions:{goals:true,shots:true,conversion:true,saves:true,keeperDenominators:true,broadBallLosses:true,sevenMetres:true,twoMinuteSuspensions:true,playerRows:true,ordinaryFreeThrows:true,transitionGoalsFromOriginalShotPhaseAndGoalAction:true,renderedTransitionGoals:true,renderedFreeThrows:true,retainedCoreAndRngUnchanged:true},
  scope:'Passive final-core presentation/finalization evidence only. Genuine initial wrapper/people from retained recipe; verified saved full-time core attached in memory. No simulation ticks, reconstructed or retained frames, database writes, imported QA save, or replacement for full replay/archive-frame proofs.'});
}
assert.deepEqual(fingerprint(),sources,'Presentation proof sources remain unchanged');
mkdirSync(out,{recursive:true});
writeFileSync(join(out,'presentation-proof.json'),JSON.stringify({complete:true,sourceFingerprints:sources,receipts,runtimeMs:performance.now()-started},null,2)+'\n');
console.log(JSON.stringify({complete:true,leagues:receipts.map(r=>({league:r.league,transitionGoals:{HOME:r.teams.HOME.transitionGoals,AWAY:r.teams.AWAY.transitionGoals}})),receipt:'docs/player-attributes-possession-economy-v1/verification/presentation-proof.json'}));
