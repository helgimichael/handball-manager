// HM-PLAYTEST-01 1.1/1.2: the owner's IFK Tumba playtest. Seven players
// selected, a two-minute suspension, and a player who had never been
// registered for the match came on. These tests pin the matchday roster:
// live and quick pathways, across save/reload, with real suspensions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from './careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch, finalizeProductionMatch } from './productionMatch';
import { getCareerClubSquad } from './careerWorld';
import { buildDefaultMatchPlan } from '../matchPlan/defaultMatchPlan';
import { buildEmptyMatchPlan } from './manualLineup';
import { assignManualStarter } from '../matchPlan/matchPlanEdits';
import { assessMatchdaySquad } from '../matchPlan/matchdaySquadCheck';
import { courtLimit } from '@handball-manager/handball-engine/src/v2/core/population';
import type { CoreState } from '@handball-manager/handball-engine/src/v2/core/state';
import type { CareerState } from './types';

const POSITIONS = ['V6', 'V9', 'M9', 'H9', 'H6', 'M6'] as const;

function sevenPlayerCareer() {
  let state = createNewCareerState('playable-product-2026', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
  const club = Object.keys(state.worldSquads).find(id => id.toLowerCase().includes('tumba'))!;
  state = { ...state, playerClubId: club };
  // swe-2-f5 is a seeded fixture in which the manager's seven are suspended several times.
  const fixture = state.fixtures.find(f => f.id === 'swe-2-f5' && (f.homeClubId === club || f.awayClubId === club))
    ?? state.fixtures.find(f => f.homeClubId === club || f.awayClubId === club)!;
  const squad = getCareerClubSquad(state, club);
  const used = new Set<string>();
  const pick = (pos: string) => { const p = squad.find(x => x.position === pos && !used.has(x.id)) ?? squad.find(x => x.position !== 'MV' && !used.has(x.id))!; used.add(p.id); return p; };
  const gk = squad.find(p => p.position === 'MV')!; used.add(gk.id);
  const players = [{ playerId: gk.id, position: 'GK' as const }, ...POSITIONS.map(pos => ({ playerId: pick(pos).id, position: pos }))];
  const plan = buildDefaultMatchPlan({ fixtureId: fixture.id, clubId: club, players }).plan!;
  const ready: CareerState = { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)], matchPlans: { ...state.matchPlans, [fixture.id]: plan } };
  return { ready, fixture, team: (fixture.homeClubId === club ? 'HOME' : 'AWAY') as 'HOME' | 'AWAY', selected: new Set(players.map(p => p.playerId)) };
}

function playOut(start: CareerState, team: 'HOME' | 'AWAY', selected: ReadonlySet<string>, reloadAtTick: number) {
  let state = start;
  let maxShort = 0, reloaded = false;
  const observe = (core: Readonly<CoreState>) => {
    const own = core.players.filter(p => p.team === team);
    for (const p of own) assert.ok(selected.has(p.id), `unregistered player ${p.id} in the engine population`);
    const limit = courtLimit(core as CoreState, team);
    assert.ok(own.filter(p => p.population === 'COURT').length <= limit, 'more players on court than the suspension allows');
    maxShort = Math.max(maxShort, 7 - limit);
  };
  for (let i = 0; i < 400 && state.productionMatch?.core.status === 'RUNNING'; i++) {
    if (state.productionMatch.pausedAtHalf) state = commandProductionMatch(state, { kind: 'SECOND_HALF' });
    state = advanceProductionMatch(state, 1000, false, observe);
    if (!reloaded && state.productionMatch && state.productionMatch.core.tick >= reloadAtTick) { state = JSON.parse(JSON.stringify(state)); reloaded = true; }
  }
  return { done: finalizeProductionMatch(state), maxShort, reloaded };
}

for (const quick of [false, true]) {
  test(`seven-player matchday squad: a suspension never brings on an unselected player (${quick ? 'quick result' : 'live match'}, save/reload)`, () => {
    const { ready, fixture, team, selected } = sevenPlayerCareer();
    const running = startProductionMatch(ready, fixture.id, { quick });
    assert.ok(running.productionMatch, 'the seven-player squad is a legal selection and kicks off');
    assert.equal(running.productionMatch.people.filter(p => p.team === team).length, 7, 'exactly the seven registered players exist in the match');
    const { done, maxShort, reloaded } = playOut(running, team, selected, 20000);
    assert.ok(reloaded, 'the match crossed a save/reload');
    const result = done.results[fixture.id];
    assert.ok(result, 'the match finished');
    const side = team === 'HOME' ? 'home' : 'away';
    const contributions = team === 'HOME' ? result.homePlayerContributions : result.awayPlayerContributions;
    for (const c of contributions) assert.ok(selected.has(c.playerId), `${c.playerId} appears in the result but was never selected`);
    for (const e of result.events) if (e.side === side && e.playerId) assert.ok(selected.has(e.playerId), `${e.type} credited to unselected ${e.playerId}`);
    assert.ok(result.events.some(e => e.side === side && e.type === 'TWO_MIN'), 'the seeded fixture actually contains a suspension for the seven');
    assert.ok(maxShort >= 1, 'the suspended side really played short-handed');
    for (const p of done.matchArchives![fixture.id].people.filter(p => p.team === team)) assert.ok(selected.has(p.id));
  });
}

test('manual starter pick: a newly selected player replaces the displaced starter in the squad', () => {
  let plan = buildEmptyMatchPlan('fx', 'club');
  const ids = ['gk', 'a', 'b', 'c', 'd', 'e', 'f'];
  (['GK', ...POSITIONS] as const).forEach((pos, i) => { plan = assignManualStarter(plan, pos, ids[i]).plan; });
  assert.equal(plan.squad.players.length, 7);
  const swap = assignManualStarter(plan, 'V6', 'x');
  assert.equal(swap.removedPlayerId, 'a');
  assert.equal(swap.plan.squad.players.length, 7, 'still exactly seven -- the displaced starter did not silently stay on the bench');
  assert.ok(!swap.plan.squad.players.some(p => p.playerId === 'a'));
  const moved = assignManualStarter(swap.plan, 'V6', 'b');
  assert.equal(moved.removedPlayerId, null, 'moving a starter between positions is a swap');
  assert.equal(moved.plan.squad.players.length, 7);
});

test('matchday squad check: blocks illegal selections, warns on legal but risky ones', () => {
  const players = ['gk', 'a', 'b', 'c', 'd', 'e', 'f'];
  const plan = buildDefaultMatchPlan({ fixtureId: 'fx', clubId: 'club', players: [{ playerId: 'gk', position: 'GK' }, ...POSITIONS.map((position, i) => ({ playerId: players[i + 1], position }))] }).plan!;
  const available = players.map(id => ({ id, name: id, isGoalkeeper: id === 'gk', energy: 100 }));
  const seven = assessMatchdaySquad(plan, available);
  assert.equal(seven.blocking.length, 0, 'seven players is legal');
  assert.ok(seven.warnings.find(w => w.code === 'NO_SUBSTITUTES')?.text.includes('inga avbytare'), 'but the manager is asked to confirm');
  assert.ok(assessMatchdaySquad(plan, available.filter(p => p.id !== 'c')).blocking.some(b => b.code === 'UNAVAILABLE'), 'an unavailable registered player blocks kickoff');
  assert.ok(assessMatchdaySquad(buildEmptyMatchPlan('fx', 'club'), available).blocking.length > 0);
});
