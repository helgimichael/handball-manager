import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from './careerEvents';
import { createProductionSession, MATCH_BEHAVIOR_REVISION, startProductionMatch, advanceProductionMatch, commandProductionMatch, finishProductionMatch, finalizeProductionMatch, archiveFrames,resultFromSession } from './productionMatch';
import { attemptSeasonTransition } from './seasonRollover';
import { getLiveStandings } from './standings';
import { simulateFixture } from '@handball-manager/game-simulation';
import { computeSquadDerivedClubStrength } from './squadDerivedClubStrength';
import { getCareerClubSquad } from './careerWorld';
import { createSave, getSave, getMatchArchiveById, saveCareerState, __setSaveBackendForTests } from '../save/saveRepository';
import { createMemoryBackend } from '../save/saveStorage';
import { renewPlayerContract } from './contractRenewal';
import { resolveClubMatchPlanForFixture } from './playerMatchStrength';
import { STARTING_SEVEN_POSITION_ERROR } from '../matchPlan/startingUnits';

function ready() {
  let state = createNewCareerState('playable-product-2026', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
  // Resolve the actual manager club id from the existing database if the requested alias differs.
  const club = Object.keys(state.worldSquads).find(id => id.toLowerCase().includes('tumba'));
  if (club) state = { ...state, playerClubId: club };
  const fixture = state.fixtures.find(f => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId)!;
  assert.ok(fixture, `fixture for ${state.playerClubId}`);
  return { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] };
}

test('real career match: commands, save continuation, exact archive and exactly-once career commit', async () => {
  const state = ready();
  let running = startProductionMatch(state);
  assert.ok(running.productionMatch);
  assert.equal(Object.keys(running.results).length, 0, 'starting a match cannot update the table');
  const team = running.productionMatch.fixture.homeClubId === running.playerClubId ? 'HOME' : 'AWAY';
  const core = running.productionMatch.core;
  const out = core.players.find(p => p.team === team && p.role === 'LW' && p.population === 'COURT')!;
  const incoming = core.players.find(p => p.team === team && p.kind === out.kind && p.population === 'BENCH')!;
  const prefix = JSON.stringify(core.events);
  const tick = core.tick, seed = core.seed;
  running = commandProductionMatch(running, { kind: 'SUBSTITUTION', team, outId: out.id, inId: incoming.id });
  running = commandProductionMatch(running, { kind: 'TACTICS', team, patch: { tempo: 'QUICK', attackIdentity: 'WIDTH', defence: '5:1', aggression: 'HIGH' } });
  assert.equal(running.productionMatch!.core.tick, tick);
  assert.equal(running.productionMatch!.core.seed, seed);
  assert.equal(prefix, '[]');
  running = advanceProductionMatch(running, 100);
  const timeoutTeam = running.productionMatch!.core.possession.team;
  running = commandProductionMatch(running, { kind: 'TIMEOUT', team: timeoutTeam });
  const stopped = running.productionMatch!.core.officialClock.timeMs;
  const timeoutReload = JSON.parse(JSON.stringify(running));
  running = advanceProductionMatch(running, 200);
  assert.equal(running.productionMatch!.core.officialClock.timeMs, stopped, 'timeout consumes simulation ticks with the official clock stopped');
  assert.deepEqual(running.productionMatch, advanceProductionMatch(timeoutReload, 200).productionMatch, 'an active timeout resumes identically after save/load');
  assert.throws(() => commandProductionMatch(running, { kind: 'TIMEOUT', team: timeoutTeam }), /Beslutet/);
  running = advanceProductionMatch(running, 3000);
  assert.ok(running.productionMatch!.core.exchanges.some(e => e.inId === incoming.id && e.phase === 'COMPLETED'));
  const reloaded = JSON.parse(JSON.stringify(running));
  let halftime = running;
  for (let i=0;i<20&&!halftime.productionMatch!.pausedAtHalf;i++) halftime=advanceProductionMatch(halftime,10000);
  assert.equal(halftime.productionMatch!.core.match!.phase,'HALFTIME');
  assert.equal(halftime.productionMatch!.pausedAtHalf,true);
  assert.deepEqual(advanceProductionMatch(halftime,100),halftime,'halftime cannot advance until the manager resumes');
  let second=advanceProductionMatch(commandProductionMatch(halftime,{kind:'SECOND_HALF'}),1);
  for (let i=0;i<50&&second.productionMatch!.core.match!.phase==='PREMATCH';i++) second=advanceProductionMatch(second,100);
  assert.equal(second.productionMatch!.core.match!.phase,'SECOND_HALF');
  assert.equal(second.productionMatch!.core.period,2);
  const done = finishProductionMatch(running);
  const restored = finishProductionMatch(reloaded);
  assert.equal(done.productionMatch, null);
  assert.deepEqual(done.results, restored.results, 'save/load continues the same seeded state');
  assert.deepEqual(done.matchArchives, restored.matchArchives);
  const archive = Object.values(done.matchArchives!)[0];
  assert.equal(archive.behaviorRevision, MATCH_BEHAVIOR_REVISION);
  assert.deepEqual(archive.tactics?.kickoff?.[team], { defence: '6:0', aggression: 'BALANCED', tempo: 'BALANCED', rotationStrategy: 'BALANCED', assistantRotation: false, sevenVSix: 'OFF' }, 'the instructions the side kicked off with are archived');
  assert.deepEqual(archive.tactics?.final[team], { defence: '5:1', aggression: 'HIGH', tempo: 'QUICK', rotationStrategy: 'BALANCED', assistantRotation: false, sevenVSix: 'OFF' }, 'the in-match change is archived');
  const frames = archiveFrames(archive);
  assert.ok(frames.length > 1000);
  assert.equal(archive.result.engine, 'V2');
  const playingTime=done.playerDynamics!.playingTime![archive.fixture.id]!;
  assert.equal(playingTime.source,'MEASURED');
  assert.equal(playingTime.clubId,done.playerClubId);
  for (const [id,sample] of Object.entries(playingTime.players)) {
    assert.equal(sample.courtMinutes,Math.min(60,archive.load[id]?.minutes ?? 0),'expectations use actual court time, including defensive work');
  }
  assert.deepEqual(done.playerDynamics!.playingTime,restored.playerDynamics!.playingTime,'same match evidence after session save/load');

  assert.equal(archive.result.homeGoals + archive.result.awayGoals, archive.events.filter(e => e.type === 'GOAL').length);
  assert.equal(archive.result.homeGoals, archive.result.homePlayerContributions.reduce((n, p) => n + p.goals, 0));
  assert.equal(archive.result.awayGoals, archive.result.awayPlayerContributions.reduce((n, p) => n + p.goals, 0));
  assert.equal(frames.at(-1)![3], archive.result.homeGoals);
  assert.equal(frames.at(-1)![4], archive.result.awayGoals);
  for (const [side, team] of [['home','HOME'],['away','AWAY']] as const) {
    const ids=new Set(archive.people.filter(p=>p.team===team).map(p=>p.id));
    const stats=side==='home'?archive.result.homeStats:archive.result.awayStats;
    const contributions=side==='home'?archive.result.homePlayerContributions:archive.result.awayPlayerContributions;
    const own=archive.events.filter(e=>ids.has(e.actorId??''));
    assert.equal(stats.shots,own.filter(e=>e.type==='SHOT_RELEASED').length);
    assert.equal(stats.saves,own.filter(e=>e.type.startsWith('SAVE_')&&!archive.events.some(g=>g.type==='GOAL'&&g.actionId===e.actionId)).length);
    assert.equal(stats.twoMinuteSuspensions,own.filter(e=>e.type==='TWO_MINUTE_SUSPENSION').length);
    assert.equal(stats.sevenMetreAttempts,own.filter(e=>e.type==='SHOT_RELEASED'&&e.details.shotKind==='SEVEN_METRE').length);
    for (const p of contributions) if (team === (archive.fixture.homeClubId===done.playerClubId?'HOME':'AWAY')) {
      assert.equal(done.playerSeasonStats[p.playerId].goals,p.goals);
      assert.equal(done.playerSeasonStats[p.playerId].shots,p.shots);
      assert.equal(done.playerSeasonStats[p.playerId].saves,p.saves??0);
      assert.equal(done.playerSeasonStats[p.playerId].appearances,1);
    }
    for (const id of ids) if (team === (archive.fixture.homeClubId===done.playerClubId?'HOME':'AWAY')) {
      assert.equal(done.playerPhysicalState[id].currentEnergy,archive.load[id].energy);
      // HM-ALPHA2-02A: recentLoad is the ledger's decayed workload (match load in WP), never minutes.
      assert.equal(done.playerPhysicalState[id].recentLoad,(state.playerPhysicalState[id]?.recentLoad??0)+(archive.load[id].workload??0));
    }
  }
  const altered=structuredClone(done);
  altered.worldSquads={};altered.gameplayRatings={};altered.matchPlans={};
  assert.deepEqual(archiveFrames(Object.values(altered.matchArchives!)[0]),frames,'historical replay does not reconstruct from changed career data');
  assert.equal(getLiveStandings(done).find(r => r.clubId === done.playerClubId)!.played, 1);
  assert.deepEqual(finalizeProductionMatch(done), done);
  const duplicate = finalizeProductionMatch({ ...done, productionMatch: { ...running.productionMatch!, core: { ...running.productionMatch!.core, match: { ...running.productionMatch!.core.match!, phase: 'FULLTIME' } } } });
  assert.deepEqual(duplicate.playerSeasonStats, done.playerSeasonStats, 'a stale completed session cannot commit twice');
  assert.ok(archive.people.every(p => p.id !== 'H03' && p.id !== 'A03'), 'real player identities');
  assert.equal(archive.result.homeStats.turnovers, archive.result.events.filter(e => e.type === 'TURNOVER' && e.side === 'home').length);
  const backend = createMemoryBackend('product-match-save');
  __setSaveBackendForTests(backend);
  const save = await createSave({ selectedNations: ['SWE'], selectedCompetitionIds: ['swe-2'], clubId: done.playerClubId, manager: { name: 'Product test', nationality: 'SWE', dateOfBirth: '1980-01-01' }, gameDate: done.gameDate });
  await saveCareerState(save.saveId, state);
  assert.deepEqual((await getSave(save.saveId))!.careerState!.results, state.results);
  await Promise.all([saveCareerState(save.saveId, running), saveCareerState(save.saveId, done), saveCareerState(save.saveId, done)]);
  const loaded = await getSave(save.saveId);
  assert.equal(loaded!.careerState!.matchArchives, undefined, 'normal load keeps only replay references');
  for (const [id, archive] of Object.entries(done.matchArchives!)) assert.deepEqual(await getMatchArchiveById(id, save.saveId), archive);
  assert.deepEqual(loaded!.careerState!.results, done.results);
  assert.equal((await backend.getSave(save.saveId))!.careerState!.matchArchives, undefined, 'career autosave stores archive references, not all historical frames');
  __setSaveBackendForTests(null);
});

test('career capabilities use the actual attribute sheet and retain a neutral missing-data fallback independent of CA/PA', () => {
  const state = ready(), fixture = state.fixtures.find(f => f.date === state.gameDate && (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId))!;
  const low = structuredClone(state), high = structuredClone(state);
  for (const ratings of Object.values(low.gameplayRatings)) for (const rating of ratings) {
    rating.ca = 1; rating.pa = 1;
    rating.branch.attributes = {} as typeof rating.branch.attributes;
  }
  for (const ratings of Object.values(high.gameplayRatings)) for (const rating of ratings) {
    rating.ca = 200; rating.pa = 200;
    rating.branch.attributes = {} as typeof rating.branch.attributes;
  }
  const neutral = createProductionSession(low, fixture), same = createProductionSession(high, fixture);
  assert.deepEqual(neutral.core.players.map(p => p.profile), same.core.players.map(p => p.profile), 'CA/PA are not substituted for unobserved physical skills');
  const actual = structuredClone(state);
  for (const ratings of Object.values(actual.gameplayRatings)) for (const rating of ratings) for (const attribute of Object.values(rating.branch.attributes)) if (attribute) attribute.value = 20;
  const capable = createProductionSession(actual, fixture);
  assert.ok(capable.core.players.some((p, i) => p.profile.topSpeed > neutral.core.players[i].profile.topSpeed), 'real attributes reach canonical movement');
  assert.ok(capable.core.players.some((p, i) => p.profile.passing > neutral.core.players[i].profile.passing), 'real passing reaches canonical execution');
});

test('developer tick observation leaves the canonical state, RNG, events and frames unchanged',()=>{
  const started=startProductionMatch(ready());
  const normal=advanceProductionMatch(started,600,false);
  let observations=0,lastTick=0,facts=0;
  const observed=advanceProductionMatch(started,600,false,(core,newEvents)=>{
    observations++;assert.ok(core.tick>lastTick);lastTick=core.tick;facts+=newEvents.length;
    assert.ok(newEvents.every(e=>e.tick===core.tick));
  });
  assert.equal(observations,600);assert.ok(facts>0);
  assert.deepEqual(observed,normal,'diagnostics reads do not create a second simulation or consume seeded draws');
});

test('career role tendencies retain basic duties and respect recorded personal roles without changing capabilities',()=>{
 const state=ready(),fixture=state.fixtures.find(f=>f.date===state.gameDate&&(f.homeClubId===state.playerClubId||f.awayClubId===state.playerClubId))!;
 for(const ratings of Object.values(state.gameplayRatings))for(const r of ratings)r.attackRoleProficiencies=[];
 const normal=createProductionSession(state,fixture),centre=normal.core.players.find(p=>p.population==='COURT'&&p.role==='CB')!;
 assert.ok(centre.profile.tendency.feed>centre.profile.tendency.shoot);
 const changed=structuredClone(state);for(const ratings of Object.values(changed.gameplayRatings))for(const r of ratings)if(r.playerId===centre.id)r.attackRoleProficiencies=[{role:'SCORING_CENTRE_BACK',value:14},{role:'PRIMARY_PLAYMAKER',value:10}];
 const scorer=createProductionSession(changed,fixture).core.players.find(p=>p.id===centre.id)!;
 assert.ok(scorer.profile.tendency.shoot>scorer.profile.tendency.feed);
 assert.deepEqual({...scorer.profile,tendency:null},{...centre.profile,tendency:null});
});

test('keeper result shots faced count saves and attributed goals, excluding wide, blocks and parry goals',()=>{
 const state=ready(),fixture=state.fixtures.find(f=>f.date===state.gameDate&&(f.homeClubId===state.playerClubId||f.awayClubId===state.playerClubId))!,session=createProductionSession(state,fixture);
 const keeper=session.core.players.find(p=>p.team==='AWAY'&&p.kind==='GOALKEEPER')!,shooter=session.core.players.find(p=>p.team==='HOME'&&p.role==='CB')!;
 const event=(type:string,actionId:string,actorId:string,details:Record<string,string|number|boolean>={})=>({id:type+actionId,tick:1,timeMs:50,officialMs:50,type,possessionId:'fixture-possession',actionId,actorId,relatedIds:[],contestId:null,details});
 session.core.events=[event('SHOT_RELEASED','saved',shooter.id,{goalkeeperId:keeper.id}),event('SAVE_CAUGHT','saved',keeper.id),event('SHOT_RELEASED','goal',shooter.id,{goalkeeperId:keeper.id}),event('GOAL','goal',shooter.id),event('SHOT_RELEASED','wide',shooter.id,{goalkeeperId:keeper.id}),event('SHOT_RELEASED','block',shooter.id,{goalkeeperId:keeper.id}),event('SHOT_BLOCKED','block',keeper.id),event('SHOT_RELEASED','parry-goal',shooter.id,{goalkeeperId:keeper.id}),event('SAVE_PARRY','parry-goal',keeper.id),event('GOAL','parry-goal',shooter.id)];
 const result=resultFromSession(session),k=result.awayPlayerContributions.find(p=>p.playerId===keeper.id)!;
 assert.equal(k.saves,1);assert.equal(k.shotsFaced,3);assert.equal(result.awayStats.saves,1);
});

test('a legacy unsupported own formation requires a real plan correction rather than silently playing 6:0',()=>{
  const state=ready(),fixture=state.fixtures.find(f=>f.date===state.gameDate&&(f.homeClubId===state.playerClubId||f.awayClubId===state.playerClubId))!;
  const plan=resolveClubMatchPlanForFixture(state.playerClubId,fixture.id,getCareerClubSquad(state,state.playerClubId),undefined)!;
  assert.ok(plan);plan.defencePlan={...plan.defencePlan,baseFormation:'3-2-1'};
  assert.throws(()=>startProductionMatch({...state,matchPlans:{[fixture.id]:plan}}),/6–0 eller 5–1/);
  plan.defencePlan={...plan.defencePlan,baseFormation:'5-1'};
  const started=startProductionMatch({...state,matchPlans:{[fixture.id]:plan}});
  const team=fixture.homeClubId===state.playerClubId?'HOME':'AWAY';
  assert.equal(started.productionMatch!.core.coaching[team].defence,'5:1');
});

test('alpha kickoff rejects two pivots and preserves the exact selected 16 on a valid plan', () => {
  const state = ready();
  const fixture = state.fixtures.find(f => f.date === state.gameDate && (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId))!;
  const squad = getCareerClubSquad(state, state.playerClubId);
  const plan = resolveClubMatchPlanForFixture(state.playerClubId, fixture.id, squad, undefined)!;
  const invalid = structuredClone(plan);
  invalid.attackStartingUnit = { ...invalid.attackStartingUnit, slots: invalid.attackStartingUnit.slots.map(slot => slot.position === 'M9' ? { ...slot, position: 'M6' as const } : slot) };
  assert.throws(() => startProductionMatch({ ...state, matchPlans: { [fixture.id]: invalid } }), error => error instanceof Error && error.message === STARTING_SEVEN_POSITION_ERROR);
  const started = startProductionMatch({ ...state, matchPlans: { [fixture.id]: plan } });
  const team = fixture.homeClubId === state.playerClubId ? 'HOME' : 'AWAY';
  const people = started.productionMatch!.people.filter(p => p.team === team);
  assert.equal(people.length, 16);
  assert.deepEqual(people.map(p => p.id).sort(), plan.squad.players.map(p => p.playerId).sort());
});

test('completed legacy match calendar blocks rollover without losing contracts or archives', () => {
  let state = ready();
  for (const f of state.fixtures) state.results[f.id] = simulateFixture(f, state.saveSeed, id => computeSquadDerivedClubStrength(id, getCareerClubSquad(state, id), state.gameplayRatings[id] ?? []));
  state = { ...state, seasonComplete: true, gameDate: state.fixtures.at(-1)!.date };
  const result = attemptSeasonTransition(state);
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.state, state);
  assert.ok(result.blockers.some(b => b.code === 'NEXT_SEASON_PROFILE_REQUIRED'));
});

test('own player agreements extend persistent contracts without duplicate wage commitments', () => {
  let state = ready();
  const player = getCareerClubSquad(state, state.playerClubId)[0];
  state = { ...state, playerContracts: { ...state.playerContracts, [player.id]: { playerId: player.id, clubId: state.playerClubId, contractEndDate: '2027-05-31', wageEurPerMonth: 1000 } } };
  const next = renewPlayerContract(state, player.id, 1);
  assert.equal(next.playerContracts[player.id].contractEndDate, '2028-05-31');
  assert.equal(next.playerContracts[player.id].wageEurPerMonth, 1000);
  assert.equal(Object.keys(next.playerContracts).length, Object.keys(state.playerContracts).length);
  assert.throws(() => renewPlayerContract(state, player.id, 1, 500));
  assert.throws(() => renewPlayerContract({ ...state, gameDate: '2027-06-01' }, player.id));
  assert.throws(() => renewPlayerContract(next, player.id, 1), /redan/);
});
