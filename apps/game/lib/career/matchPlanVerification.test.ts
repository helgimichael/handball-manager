// HM-PLAYTEST-01 release readiness: every handball match-plan feature,
// demonstrated in real engine-driven career matches. Each match is observed
// tick by tick (identity, legal on-court numbers, the planned behaviour) and
// crosses a save/reload that must not change the outcome.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { buildMatchdayReadyEvent } from './careerEvents';
import { startProductionMatch, advanceProductionMatch, commandProductionMatch, finalizeProductionMatch } from './productionMatch';
import { getCareerClubSquad } from './careerWorld';
import { buildDefaultMatchPlan } from '../matchPlan/defaultMatchPlan';
import { setPenaltyTakers } from './teamRoles';
import { sevenVSixPolicyFor } from '../matchPlan/sevenVSix';
import { courtLimit } from '@handball-manager/handball-engine/src/v2/core/population';
import { unitSituation } from '@handball-manager/handball-engine/src/v2/core/matchPlanDirectives';
import type { CoreEvent, CoreState } from '@handball-manager/handball-engine/src/v2/core/state';
import type { CareerState } from './types';
import type { MatchPlan } from '../matchPlan/types';

const SIX = ['V6', 'V9', 'M9', 'H9', 'H6', 'M6'] as const;
type Team = 'HOME' | 'AWAY';

function career(fixtureId: string) {
  let state = createNewCareerState('playable-product-2026', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
  const club = Object.keys(state.worldSquads).find(id => id.toLowerCase().includes('tumba'))!;
  state = { ...state, playerClubId: club };
  const fixture = state.fixtures.find(f => f.id === fixtureId)!;
  const squad = getCareerClubSquad(state, club);
  const keepers = squad.filter(p => p.position === 'MV');
  const outfield = squad.filter(p => p.position !== 'MV');
  const used = new Set<string>();
  const pick = (pos: string) => { const p = outfield.find(x => x.position === pos && !used.has(x.id)) ?? outfield.find(x => !used.has(x.id))!; used.add(p.id); return p; };
  const six = SIX.map(pick);
  const bench = outfield.filter(p => !used.has(p.id)).slice(0, 7);
  const players = [{ playerId: keepers[0].id, position: 'GK' as const }, ...SIX.map((position, i) => ({ playerId: six[i].id, position })), ...bench.map(p => ({ playerId: p.id, position: p.position as typeof SIX[number] })), { playerId: keepers[1].id, position: 'GK' as const }];
  const base = buildDefaultMatchPlan({ fixtureId, clubId: club, players }).plan!;
  return { state, fixture, club, six: six.map(p => p.id), bench: bench.map(p => p.id), base: { ...base, transitionPlan: { ...base.transitionPlan, assistantRotation: false } } as MatchPlan, team: (fixture.homeClubId === club ? 'HOME' : 'AWAY') as Team };
}

type Observer = (core: Readonly<CoreState>, events: readonly CoreEvent[]) => void;
function play(state: CareerState, fixtureId: string, observe: Observer, reloadAtTick = 30000) {
  let s = startProductionMatch(state, fixtureId);
  let reloaded = false;
  for (let i = 0; i < 400 && s.productionMatch?.core.status === 'RUNNING'; i++) {
    if (s.productionMatch.pausedAtHalf) s = commandProductionMatch(s, { kind: 'SECOND_HALF' });
    s = advanceProductionMatch(s, 1000, false, observe as never);
    if (!reloaded && s.productionMatch && s.productionMatch.core.tick >= reloadAtTick) { s = JSON.parse(JSON.stringify(s)); reloaded = true; }
  }
  assert.ok(reloaded, 'crossed a save/reload');
  return finalizeProductionMatch(s);
}

/** Identity and legal numbers, every tick. */
function legality(team: Team, registered: ReadonlySet<string>) {
  const stats = { ticks: 0, overLimit: 0, outsiders: 0, suspendedOnCourt: 0, maxShort: 0 };
  const check = (core: Readonly<CoreState>) => {
    stats.ticks++;
    const own = core.players.filter(p => p.team === team);
    for (const p of own) if (!registered.has(p.id)) stats.outsiders++;
    const court = own.filter(p => p.population === 'COURT');
    const limit = courtLimit(core as CoreState, team);
    if (court.length > limit) stats.overLimit++;
    if (own.some(p => p.population === 'COURT' && p.suspensionUntilMs !== null && p.suspensionUntilMs > core.officialClock.timeMs)) stats.suspendedOnCourt++;
    stats.maxShort = Math.max(stats.maxShort, 7 - limit);
  };
  return { stats, check };
}

test('6-0 spaces, attack-defence pairs, 6v5, 5v6 and the 7-metre order in one real match, across save/reload', (t) => {
  const { state, fixture, six, bench, base, team } = career('swe-2-f5');
  const spaces6 = [2, 1, 0, 5, 4, 3];
  const pivot = six[5], specialist = bench[0];
  const fiveSpaces = [5, 4, 2, 1, 0];
  const five = [specialist, six[0], six[1], six[2], six[4]];
  const plan: MatchPlan = {
    ...base,
    substitutionPairs: [{ attackPlayerId: pivot, defencePlayerId: specialist }],
    defenceAssignments: { '6-0': Object.fromEntries(six.map((id, i) => [id, spaces6[i]])) },
    situationUnits: {
      ATTACK_6V5: [...six.slice(0, 5).map((id, i) => ({ playerId: id, position: SIX[i] })), { playerId: bench[1], position: 'M6' as const }],
      DEFENCE_5V6: five.map((playerId, i) => ({ playerId, zone: fiveSpaces[i] })),
    },
  };
  const ready = setPenaltyTakers({ ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)], matchPlans: { [fixture.id]: plan } }, [six[0], six[4]]);
  const registered = new Set(plan.squad.players.map(p => p.playerId));
  const legal = legality(team, registered);
  const planned: Record<string, number> = Object.fromEntries(six.map((id, i) => [id, spaces6[i]]));
  planned[specialist] = planned[pivot];
  const m = { def: 0, specialistDef: 0, att: 0, pivotAtt: 0, zoneOk: 0, zoneN: 0, u65: 0, u65full: 0, u56: 0, u56full: 0, u56missingIneligible: 0, u56zoneOk: 0, u56zoneN: 0, sevens: 0, sevensPlanned: 0, sevensBackup: 0 };
  const observe: Observer = (core, events) => {
    legal.check(core);
    const court = core.players.filter(p => p.team === team && p.population === 'COURT');
    const situation = unitSituation(core as CoreState, team);
    const pending = core.exchanges.some(e => e.team === team && e.phase !== 'COMPLETED' && e.phase !== 'CANCELLED');
    if (situation === 'ATTACK_6V5') { m.u65++; if (plan.situationUnits!.ATTACK_6V5!.every(e => court.some(p => p.id === e.playerId))) m.u65full++; }
    if (situation === 'DEFENCE_5V6') {
      // The suspension that creates 5v6 often hits one of the five planned defenders:
      // the unit is complete when every ELIGIBLE member is on court.
      const eligible = five.filter(id => { const p = core.players.find(x => x.id === id)!; return p.population === 'COURT' || (p.population === 'BENCH' && !p.condition.unavailable); });
      m.u56++; m.u56missingIneligible += five.length - eligible.length;
      const onCourtFive = eligible.every(id => court.some(p => p.id === id));
      if (onCourtFive) m.u56full++;
      if (onCourtFive && core.ball.live && !pending) for (const p of court) { const i = five.indexOf(p.id); if (i >= 0 && p.zone !== null) { m.u56zoneN++; if (p.zone === fiveSpaces[i]) m.u56zoneOk++; } }
    }
    if (!situation && core.ball.live && court.length === 7 && !pending) {
      if (core.possession.team === team) { m.att++; if (court.some(p => p.id === pivot)) m.pivotAtt++; }
      else { m.def++; if (court.some(p => p.id === specialist)) m.specialistDef++; for (const d of court) if (d.kind === 'FIELD_PLAYER' && d.zone !== null && planned[d.id] !== undefined) { m.zoneN++; if (d.zone === planned[d.id]) m.zoneOk++; } }
    }
    for (const e of events) if (e.type === 'SHOT_RELEASED' && e.details.shotKind === 'SEVEN_METRE' && court.some(p => p.id === e.actorId)) {
      m.sevens++;
      const primaryOn = court.some(p => p.id === six[0]), backupOn = court.some(p => p.id === six[4]);
      if (e.actorId === six[0]) m.sevensPlanned++;
      else if (!primaryOn && e.actorId === six[4]) m.sevensBackup++;
      else assert.ok(!primaryOn && !backupOn, `7m by ${e.actorId} although a planned taker was on court`);
    }
  };
  const done = play(ready, fixture.id, observe);
  const result = done.results[fixture.id];
  const exchanges = done.matchArchives![fixture.id].events.filter(e => e.type === 'EXCHANGE_COMPLETED');
  t.diagnostic(JSON.stringify({ score: `${result.homeGoals}-${result.awayGoals}`, legality: legal.stats, ...m, pairExchanges: exchanges.filter(e => e.actorId === specialist || e.actorId === pivot).length }));
  assert.equal(legal.stats.outsiders, 0, 'only registered players');
  assert.equal(legal.stats.overLimit, 0, 'never more players on court than allowed');
  assert.equal(legal.stats.suspendedOnCourt, 0, 'a suspended player never plays');
  assert.ok(legal.stats.maxShort >= 1, 'the side really played short-handed');
  // Exchanges take real time (off over the line, then on), so the pair is never 100%.
  assert.ok(m.specialistDef / m.def > 0.6 && m.pivotAtt / m.att > 0.6, 'attack-defence pair followed');
  assert.ok(m.zoneOk / m.zoneN > 0.8, '6-0 spaces held');
  assert.ok(m.u65 > 200 && m.u65full / m.u65 > 0.4, '6v5 unit reached the court');
  assert.ok(m.u56 > 200 && m.u56full / m.u56 > 0.4, '5v6 unit reached the court');
  assert.ok(m.u56zoneN === 0 || m.u56zoneOk / m.u56zoneN > 0.8, '5v6 spaces held');
  assert.ok(m.sevens > 0 && m.sevensPlanned + m.sevensBackup > 0, 'planned 7-metre takers took the 7-metres');
});

test('5-1 spaces are a separate saved assignment and the engine plays them; the backup 7-metre taker steps in', (t) => {
  const { state, fixture, six, bench, base, team } = career('swe-2-f13');
  const spaces51 = [5, 4, 2, 3, 1, 0]; // M9 as the framskjuten center (space 2)
  const plan: MatchPlan = { ...base, defencePlan: { ...base.defencePlan, baseFormation: '5-1' }, defenceAssignments: { '6-0': Object.fromEntries(six.map((id, i) => [id, [0, 1, 2, 3, 4, 5][i]])), '5-1': Object.fromEntries(six.map((id, i) => [id, spaces51[i]])) } };
  // Primary taker sits on the bench (never rotated on: assistant rotation is off); the backup is a starter.
  const primary = bench[5], backup = six[3];
  const ready = setPenaltyTakers({ ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)], matchPlans: { [fixture.id]: plan } }, [primary, backup]);
  const legal = legality(team, new Set(plan.squad.players.map(p => p.playerId)));
  const m = { zoneOk: 0, zoneN: 0, system: '', sevens: 0, byBackup: 0, byPrimary: 0 };
  const observe: Observer = (core, events) => {
    legal.check(core);
    const court = core.players.filter(p => p.team === team && p.population === 'COURT');
    for (const e of events) if (e.type === 'SHOT_RELEASED' && e.details.shotKind === 'SEVEN_METRE' && court.some(p => p.id === e.actorId)) {
      m.sevens++;
      if (e.actorId === primary) m.byPrimary++;
      else if (e.actorId === backup) m.byBackup++;
      else assert.ok(!court.some(p => p.id === backup), '7m by a non-planned player while the backup was on court');
    }
    if (core.possession.team !== team && core.ball.live && !unitSituation(core as CoreState, team)) {
      m.system = core.defence.system;
      for (const d of core.players.filter(p => p.team === team && p.population === 'COURT' && p.kind === 'FIELD_PLAYER' && p.zone !== null)) { const i = six.indexOf(d.id); if (i >= 0) { m.zoneN++; if (d.zone === spaces51[i]) m.zoneOk++; } }
    }
  };
  play(ready, fixture.id, observe);
  t.diagnostic(JSON.stringify({ legality: legal.stats, ...m }));
  assert.equal(m.system, '5:1');
  assert.equal(legal.stats.outsiders + legal.stats.overLimit, 0);
  assert.ok(m.zoneOk / m.zoneN > 0.85, `5-1 spaces held (${m.zoneOk}/${m.zoneN})`);
  assert.ok(m.sevens > 0 && m.byBackup > 0, 'with the primary off court, the backup took the 7-metres');
});

test('7v6: the selected extra attacker is the one who replaces the goalkeeper', (t) => {
  const { state, fixture, bench, base, team } = career('swe-2-f21');
  const extra = bench[3];
  const plan: MatchPlan = { ...base, attackPlan: { ...base.attackPlan, sevenVSixPolicy: sevenVSixPolicyFor('ALWAYS') }, sevenVSixPlayerId: extra };
  const ready = { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)], matchPlans: { [fixture.id]: plan } };
  const legal = legality(team, new Set(plan.squad.players.map(p => p.playerId)));
  const m = { sevenTicks: 0, chosen: 0, other: 0, otherWhileChosenUnavailable: 0, emptyGoalOverSeven: 0 };
  const observe: Observer = (core) => {
    legal.check(core);
    if (core.flow.sevenVTeam !== team) return;
    const court = core.players.filter(p => p.team === team && p.population === 'COURT');
    if (court.some(p => p.kind === 'GOALKEEPER')) return;
    m.sevenTicks++;
    if (court.filter(p => p.kind === 'FIELD_PLAYER').length > courtLimit(core as CoreState, team)) m.emptyGoalOverSeven++;
    const p2 = court.find(p => p.role === 'P2');
    if (!p2) return;
    if (p2.id === extra) m.chosen++;
    else { m.other++; const x = core.players.find(p => p.id === extra)!; if (x.population === 'COURT' || x.population !== 'BENCH' || x.condition.unavailable) m.otherWhileChosenUnavailable++; }
  };
  play(ready, fixture.id, observe);
  t.diagnostic(JSON.stringify({ legality: legal.stats, ...m }));
  assert.ok(m.sevenTicks > 500, '7v6 was actually played');
  assert.equal(legal.stats.outsiders + legal.stats.overLimit + m.emptyGoalOverSeven, 0);
  assert.ok(m.chosen / (m.chosen + m.other) > 0.6, `the chosen player is the seventh (${m.chosen}/${m.chosen + m.other})`);
});

test('save/reload mid-match changes nothing: the same plan replays to the same result', () => {
  const { state, fixture, six, bench, base } = career('swe-2-f5');
  const plan: MatchPlan = { ...base, substitutionPairs: [{ attackPlayerId: six[5], defencePlayerId: bench[0] }] };
  const ready = { ...state, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)], matchPlans: { [fixture.id]: plan } };
  const a = play(ready, fixture.id, () => {}, 25000).results[fixture.id];
  const b = play(ready, fixture.id, () => {}, 50000).results[fixture.id];
  assert.deepEqual(a, b);
});
