import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from './careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch, finishProductionMatch, finalizeProductionMatch, archiveFrames } from './productionMatch';
import { rolloverSeason } from './seasonRollover';
import { getLiveStandings } from './standings';
import { simulateFixture } from '@handball-manager/game-simulation';
import { computeSquadDerivedClubStrength } from './squadDerivedClubStrength';
import { getCareerClubSquad } from './careerWorld';
import { createSave, getSave, saveCareerState, __setSaveBackendForTests } from '../save/saveRepository';
import { createMemoryBackend } from '../save/saveStorage';
import { renewPlayerContract } from './contractRenewal';

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
  running = commandProductionMatch(running, { kind: 'TACTICS', team, patch: { tempo: 'QUICK', attackIdentity: 'WIDTH', defence: '5:1' } });
  assert.equal(running.productionMatch!.core.tick, tick);
  assert.equal(running.productionMatch!.core.seed, seed);
  assert.equal(prefix, '[]');
  running = advanceProductionMatch(running, 3000);
  assert.ok(running.productionMatch!.core.exchanges.some(e => e.inId === incoming.id && e.phase === 'COMPLETED'));
  const reloaded = JSON.parse(JSON.stringify(running));
  const done = finishProductionMatch(running);
  const restored = finishProductionMatch(reloaded);
  assert.equal(done.productionMatch, null);
  assert.deepEqual(done.results, restored.results, 'save/load continues the same seeded state');
  assert.deepEqual(done.matchArchives, restored.matchArchives);
  const archive = Object.values(done.matchArchives!)[0];
  const frames = archiveFrames(archive);
  assert.ok(frames.length > 1000);
  assert.equal(archive.result.engine, 'V2');
  assert.equal(archive.result.homeGoals + archive.result.awayGoals, archive.events.filter(e => e.type === 'GOAL').length);
  assert.equal(archive.result.homeGoals, archive.result.homePlayerContributions.reduce((n, p) => n + p.goals, 0));
  assert.equal(archive.result.awayGoals, archive.result.awayPlayerContributions.reduce((n, p) => n + p.goals, 0));
  assert.equal(frames.at(-1)![3], archive.result.homeGoals);
  assert.equal(frames.at(-1)![4], archive.result.awayGoals);
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
  assert.deepEqual(loaded!.careerState!.matchArchives, done.matchArchives);
  assert.deepEqual(loaded!.careerState!.results, done.results);
  assert.equal((await backend.getSave(save.saveId))!.careerState!.matchArchives, undefined, 'career autosave stores archive references, not all historical frames');
  __setSaveBackendForTests(null);
});

test('next season archives table and statistics, gives unique fixtures and preserves contracts/calendar', () => {
  let state = ready();
  for (const f of state.fixtures) state.results[f.id] = simulateFixture(f, state.saveSeed, id => computeSquadDerivedClubStrength(id, getCareerClubSquad(state, id), state.gameplayRatings[id] ?? []));
  state = { ...state, seasonComplete: true, gameDate: state.fixtures.at(-1)!.date };
  const next = rolloverSeason(state);
  assert.equal(next.seasonId, '2027/28');
  assert.equal(next.seasonComplete, false);
  assert.equal(next.gameDate, state.gameDate, 'no offseason lifecycle days skipped');
  assert.deepEqual(next.playerContracts, state.playerContracts);
  assert.equal(next.seasonHistory!.length, 1);
  assert.equal(Object.keys(next.results).length, 0);
  assert.equal(next.fixtures.length, state.fixtures.filter(f => f.type === 'LEAGUE').length);
  assert.ok(next.fixtures.every(f => !state.fixtures.some(old => old.id === f.id)));
  assert.ok(next.fixtures.every(f => !f.id.includes('/')), 'fixture identities must fit the normal match URL');
  assert.deepEqual(rolloverSeason(next), next, 'cannot roll over an incomplete season twice');
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
