/** Developer regression: actual canonical manager matches and season continuity. */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createNewCareerState } from '../lib/career/newCareer';
import { continueCareerRhythm } from '../lib/career/continueController';
import { playManagerFixture } from '../lib/career/matchdayAction';
import { rolloverSeason } from '../lib/career/seasonRollover';
import { getLiveStandings } from '../lib/career/standings';
import { renewPlayerContract } from '../lib/career/contractRenewal';
import { archiveFrames, finalizeProductionMatch, type PlayedMatchArchive } from '../lib/career/productionMatch';
import type { CareerState } from '../lib/career/types';
import type { PlayerMock } from '../lib/game-data';
import type { GameplayPlayerRating } from '../lib/gameWorld/gameplayRatingSnapshot';

const args=process.argv.slice(2),option=(key:string,fallback?:string)=>{const at=args.indexOf(key);return at<0?fallback:args[at+1];};
const output=resolve(option('--out','../../docs/match-realism-v21/regression')!);
const checkpoint=option('--checkpoint'),mode=checkpoint?'RETAINED_CANONICAL_CHECKPOINT':'FULL_NORMAL_SEASON';
const root=resolve(dirname(process.argv[1]),'../../..');
const fingerprint=()=>{
  const directory=join(root,'packages/handball-engine/src/v2/core');
  return Object.fromEntries([...readdirSync(directory).filter(p=>p.endsWith('.ts')&&!p.endsWith('.test.ts')).map(p=>join(directory,p)),join(root,'apps/game/lib/career/productionMatch.ts')].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
};
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const startedAt=new Date().toISOString(),beforeSources=fingerprint();
const inputs=JSON.parse(readFileSync(resolve(option('--inputs','../../docs/match-realism-v2/baseline/inputs.json')!),'utf8')) as {worldSquads:Record<string,PlayerMock[]>;gameplayRatings:Record<string,GameplayPlayerRating[]>};
let state:CareerState=checkpoint?JSON.parse(readFileSync(resolve(checkpoint),'utf8')):createNewCareerState('match-calibration-v21-season-continuity','swe2-tumba',structuredClone(inputs.worldSquads),undefined,structuredClone(inputs.gameplayRatings));
const originalSeason=state.seasonId,played:unknown[]=[];
function validateArchive(archive:PlayedMatchArchive){
  assert.equal(archive.result.engine,'V2');
  const people=new Map(archive.people.map(p=>[p.id,p]));
  for(const team of ['HOME','AWAY'] as const){
    const goalCount=archive.events.filter(e=>e.type==='GOAL'&&people.get(e.actorId??'')?.team===team).length;
    assert.equal(goalCount,team==='HOME'?archive.result.homeGoals:archive.result.awayGoals,'actual archived goals reconcile');
  }
  const frame=archiveFrames(archive).at(-1);assert.ok(frame);assert.equal(frame[3],archive.result.homeGoals);assert.equal(frame[4],archive.result.awayGoals);
  const contributions=[...archive.result.homePlayerContributions,...archive.result.awayPlayerContributions];
  assert.equal(contributions.reduce((sum,p)=>sum+p.goals,0),archive.result.homeGoals+archive.result.awayGoals);
}
function playPending(){
  const action=playManagerFixture(state);assert.ok(action.result,`Unhandled action at ${state.gameDate}`);assert.equal(action.result.engine,'V2');state=action.state;
  const archive=state.matchArchives?.[action.result.fixtureId];assert.ok(archive);validateArchive(archive);
  const before=hash({results:state.results,stats:state.playerSeasonStats,form:state.clubForm});
  state=finalizeProductionMatch(state);assert.equal(hash({results:state.results,stats:state.playerSeasonStats,form:state.clubForm}),before,'finalization is once-only');
  state=JSON.parse(JSON.stringify(state));validateArchive(state.matchArchives![archive.fixture.id]);
  played.push({fixtureId:archive.fixture.id,date:archive.fixture.date,type:archive.fixture.type,seed:archive.seed,score:[archive.result.homeGoals,archive.result.awayGoals],archiveHash:hash(archive),engine:'V2'});
  console.log(JSON.stringify({played:played.length,date:state.gameDate,fixtureId:archive.fixture.id,engine:'V2'}));
}
if(checkpoint){
  assert.ok(state.seasonComplete,'Checkpoint must be an actual completed season');
  assert.equal(state.productionMatch,null,'Checkpoint must have no running match');
  for(const archive of Object.values(state.matchArchives??{}))validateArchive(archive);
}else{
  let guard=0;
  while(!state.seasonComplete&&guard++<1000){
    const press=continueCareerRhythm(state);state=press.state;
    if(press.stopReason==='ACTION_REQUIRED'||press.stopReason==='ACTION_REQUIRED_PENDING')playPending();
  }
  assert.ok(state.seasonComplete,'Full season completes through normal Continue and canonical manager actions');
}
const managerLeague=state.fixtures.filter(f=>f.type==='LEAGUE'&&(f.homeClubId===state.playerClubId||f.awayClubId===state.playerClubId));
assert.equal(managerLeague.length,26);assert.ok(managerLeague.every(f=>state.results[f.id]?.engine==='V2'&&state.matchArchives?.[f.id]),'every manager league fixture has actual V2 result/archive');
assert.ok(getLiveStandings(state).every(row=>row.played===26),'CPU/background and manager league bookkeeping agree');
const historicalStats=structuredClone(state.playerSeasonStats),historicalTable=structuredClone(getLiveStandings(state));
const archiveHashes=Object.fromEntries(Object.entries(state.matchArchives??{}).map(([id,a])=>[id,hash(a)]));
if(!checkpoint){const directory=join(root,'.tmp/match-realism-v21');mkdirSync(directory,{recursive:true});writeFileSync(join(directory,'season-end-state.json'),JSON.stringify(state));}
const year=Number(originalSeason.slice(0,4))+1;
for(const player of state.worldSquads[state.playerClubId]??[]){
  const contract=state.playerContracts[player.id];
  if(contract&&contract.contractEndDate>=state.gameDate&&contract.contractEndDate<`${year+1}-05-31`)state=renewPlayerContract(state,player.id,2);
}
state=rolloverSeason(state);state=JSON.parse(JSON.stringify(state));
assert.notEqual(state.seasonId,originalSeason);assert.equal(Object.keys(state.results).length,0);
assert.deepEqual(state.seasonHistory?.at(-1)?.stats,historicalStats);assert.deepEqual(state.seasonHistory?.at(-1)?.table,historicalTable);
const rolledSeason=state.seasonId;
let calendarDays=0,secondSeasonFixture:string|null=null;
for(let guard=0;guard<600&&!secondSeasonFixture;guard++){
  const press=continueCareerRhythm(state);state=press.state;calendarDays+=press.daysProcessed;
  if(press.stopReason==='ACTION_REQUIRED'||press.stopReason==='ACTION_REQUIRED_PENDING'){
    playPending();secondSeasonFixture=Object.values(state.results).find(r=>r.homeClubId===state.playerClubId||r.awayClubId===state.playerClubId)?.fixtureId??null;
  }
}
assert.ok(calendarDays>0);assert.ok(secondSeasonFixture,'an actual new-season canonical match was played after daily offseason progression');
assert.equal(state.seasonId,rolledSeason);assert.equal(state.results[secondSeasonFixture].engine,'V2');
assert.ok(state.matchArchives?.[secondSeasonFixture]);
for(const [id,digest] of Object.entries(archiveHashes))assert.equal(hash(state.matchArchives![id]),digest,'historical replay truth remains immutable through rollover/new season');
assert.deepEqual(state.seasonHistory?.at(-1)?.stats,historicalStats);assert.deepEqual(fingerprint(),beforeSources,'engine source remains fixed during regression');
mkdirSync(output,{recursive:true});
writeFileSync(join(output,'season-result.json'),JSON.stringify({complete:true,mode,checkpoint:checkpoint?resolve(checkpoint):null,startedAt,finishedAt:new Date().toISOString(),
  sourceStable:true,firstSeason:originalSeason,managerLeagueMatchesVerified:managerLeague.length,newMatchesPlayedThisRun:played.length,
  secondSeason:state.seasonId,secondSeasonDate:state.gameDate,secondSeasonFixture,secondSeasonResult:state.results[secondSeasonFixture],
  archivedMatches:Object.keys(state.matchArchives??{}).length,historicalArchivesUnchanged:true,historicalStats,historicalTable,played,
  scope:checkpoint?'Retained completed canonical season checkpoint verified, rollover and actual new V2 season-two match; not a new full first-season simulation.':'Full first season through normal Continue; every manager match V2; CPU background may use Fast. Contracts renewed through existing manager agreement, daily offseason preserved, actual V2 season-two match.'},null,2)+'\n');
console.log(JSON.stringify({complete:true,mode,firstSeason:originalSeason,secondSeason:state.seasonId,secondSeasonFixture}));
