// SQUAD-ROLE-MINUTES: the pre-match minutes planner -- role-based defaults,
// edits, availability, goalkeepers, old saves, persistence, and the path into
// the assistant's decisions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { migrateCareerState } from '../career/saveMigration';
import { getCareerClubSquad } from '../career/careerWorld';
import { updatePlayerSquadStatus, type SquadStatusTier } from '../career/squadStatus';
import { setMatchPlan } from '../career/matchPlanActions';
import { buildMatchdayReadyEvent } from '../career/careerEvents';
import { advanceProductionMatch, commandProductionMatch, startProductionMatch } from '../career/productionMatch';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import type { CareerState } from '../career/types';
import { buildInitialMatchSquad } from './careerSquadBridge';
import { buildDefaultMatchPlan } from './defaultMatchPlan';
import type { MatchPlan } from './types';
import { assignedPosition, clampPlannedMinutes, defaultPlannedMinutes, engineMinutesPlan, minutesPlannerRows, PLANNED_MINUTES_MAX, plannedMinutesFor, positionBudgets, resetPlannedMinutes, resolvePlannedMinutes, setPlannedMinutes } from './minutesPlan';
import { assessPlayingTime } from '../players/playingTime';
import { manualLocked } from '@handball-manager/handball-engine/src/v2/core/minutesRotation';

function career(): { s: CareerState; plan: MatchPlan; fixtureId: string } {
  let s = createNewCareerState('squad-role-minutes-planner', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'));
  const club = Object.keys(s.worldSquads).find(id => id.toLowerCase().includes('tumba'));
  if (club) s = { ...s, playerClubId: club };
  const fixture = s.fixtures.find(f => f.homeClubId === s.playerClubId || f.awayClubId === s.playerClubId)!;
  s = { ...s, gameDate: fixture.date, careerEvents: [buildMatchdayReadyEvent(fixture.id, fixture.date)] };
  const plan = buildDefaultMatchPlan(buildInitialMatchSquad(getCareerClubSquad(s, s.playerClubId), fixture.id, s.playerClubId)).plan!;
  return { s, plan, fixtureId: fixture.id };
}
const field = (plan: MatchPlan) => plan.squad.players.filter(p => p.position !== 'GK').map(p => p.playerId);
const keepers = (plan: MatchPlan) => plan.squad.players.filter(p => p.position === 'GK').map(p => p.playerId);
const starters = (plan: MatchPlan) => new Set(plan.attackStartingUnit.slots.filter(s => s.position !== 'GK').map(s => s.playerId));
const roles = (s: CareerState, entries: [string, SquadStatusTier][]) => entries.reduce((acc, [id, t]) => updatePlayerSquadStatus(acc, id, t), s);

test('role-based defaults: a Key starter is planned more than a Rotation substitute, a Squad Player substitute least', () => {
  const { s: base, plan: full } = career();
  // One position with a Talent starter and two substitutes: the defaults fit its 60 minutes with room for both.
  const pivot = full.attackStartingUnit.slots.find(x => x.position === 'M6')!.playerId;
  const start = full.attackStartingUnit.slots.find(x => x.position === 'V6')!.playerId;
  const bench = field(full).filter(id => !starters(full).has(id)).slice(0, 2);
  const keep = new Set([...starters(full), ...keepers(full), ...bench]);
  const plan: MatchPlan = { ...full, squad: { ...full.squad, players: full.squad.players.filter(p => keep.has(p.playerId)).map(p => bench.includes(p.playerId) ? { ...p, position: 'M6' as const } : p) } };
  const s = roles(base, [[start, 'KEY_PLAYER'], [pivot, 'TALENT'], [bench[0]!, 'ROTATION'], [bench[1]!, 'SQUAD_PLAYER']]);
  const key = defaultPlannedMinutes(s, plan, start), rot = defaultPlannedMinutes(s, plan, bench[0]!), squad = defaultPlannedMinutes(s, plan, bench[1]!);
  assert.ok(key > rot && rot > squad && squad > 0, `${key} > ${rot} > ${squad}`);
  assert.ok(defaultPlannedMinutes(s, plan, pivot) + rot + squad <= 60, 'inside the M6 budget');
  for (const n of [key, rot, squad]) { assert.equal(n % 5, 0); assert.ok(n >= 0 && n <= PLANNED_MINUTES_MAX); }
});

test('no forced 420-minute sum: the defaults and any edits are accepted as they are', () => {
  const { s, plan } = career();
  const total = Object.entries(resolvePlannedMinutes(s, plan)).filter(([id]) => field(plan).includes(id)).reduce((n, [, m]) => n + m, 0);
  assert.ok(total > 0);
  const zeroed = field(plan).reduce((p, id) => setPlannedMinutes(p, id, 0), plan);
  assert.equal(Object.values(resolvePlannedMinutes(s, zeroed)).filter((_, i) => field(plan).includes(plan.squad.players[i]!.playerId)).reduce((n, m) => n + m, 0), 0);
});

test('goalkeepers are planned separately: the starter takes most of the game, one backup a short spell', () => {
  const { s, plan } = career();
  const gk = keepers(plan);
  assert.ok(gk.length >= 1);
  const starter = plan.defenceStartingUnit.goalkeeperId;
  if (gk.length === 1) { assert.equal(defaultPlannedMinutes(s, plan, gk[0]!), 60); return; }
  assert.ok(defaultPlannedMinutes(s, plan, starter) >= 45);
  const backups = gk.filter(id => id !== starter).map(id => defaultPlannedMinutes(s, plan, id));
  assert.ok(backups.some(n => n > 0 && n <= 15));
  const single = { ...plan, squad: { ...plan.squad, players: plan.squad.players.filter(p => p.position !== 'GK' || p.playerId === starter) } };
  assert.equal(defaultPlannedMinutes(s, single, starter), 60, 'a lone keeper is planned for the whole game');
  const rows = minutesPlannerRows(s, plan);
  assert.ok(rows.findIndex(r => r.goalkeeper) > rows.findLastIndex(r => !r.goalkeeper), 'goalkeepers listed as their own group');
});

test('availability: an injured or suspended player is planned for 0 and cannot be planned more', () => {
  const { s: base, plan } = career();
  const id = field(plan)[0]!;
  for (const availability of ['INJURED', 'SUSPENDED'] as const) {
    const s = { ...base, playerStatuses: { ...base.playerStatuses, [id]: { playerId: id, availability } } };
    assert.equal(defaultPlannedMinutes(s, plan, id), 0);
    assert.equal(plannedMinutesFor(s, setPlannedMinutes(plan, id, 40), id), 0);
    assert.equal(minutesPlannerRows(s, plan).find(r => r.playerId === id)!.available, false);
    assert.equal(engineMinutesPlan(s, setPlannedMinutes(plan, id, 40))![id]!.planned, 0);
  }
  assert.equal(defaultPlannedMinutes(base, plan, 'not-in-squad'), 0);
});

test('editing: clamped whole minutes, zero allowed, reset to the default; nothing else in the plan changes', () => {
  const { s, plan } = career();
  const id = field(plan)[3]!;
  assert.equal(clampPlannedMinutes(-5), 0); assert.equal(clampPlannedMinutes(75), 60); assert.equal(clampPlannedMinutes(12.4), 12); assert.equal(clampPlannedMinutes(Number.NaN), 0);
  const zero = setPlannedMinutes(plan, id, 0);
  assert.equal(plannedMinutesFor(s, zero, id), 0);
  assert.equal(minutesPlannerRows(s, zero).find(r => r.playerId === id)!.edited, true);
  const { plannedMinutes, ...rest } = setPlannedMinutes(zero, id, 33);
  assert.deepEqual(plannedMinutes, { [id]: 33 });
  assert.deepEqual(rest, plan, 'only plannedMinutes is touched');
  assert.equal(plannedMinutesFor(s, resetPlannedMinutes(zero, id), id), defaultPlannedMinutes(s, plan, id));
  assert.equal(resetPlannedMinutes(zero).plannedMinutes, undefined);
  assert.equal(setPlannedMinutes(plan, 'stranger', 30), plan, 'only registered players can be planned');
});

test('editing the plan never changes squad roles, hidden expectations or satisfaction', () => {
  const { s, plan, fixtureId } = career();
  const id = field(plan)[0]!;
  const before = { roles: s.playerSquadStatus, dynamics: s.playerDynamics, time: assessPlayingTime(s, id) };
  const edited = setMatchPlan(s, fixtureId, setPlannedMinutes(plan, id, 0));
  assert.deepEqual(edited.playerSquadStatus, before.roles);
  assert.deepEqual(edited.playerDynamics, before.dynamics);
  assert.deepEqual(assessPlayingTime(edited, id), before.time);
  assert.equal(edited.matchPlans[fixtureId]!.plannedMinutes![id], 0);
});

test('old saves: a plan without planned minutes plays with defaults, and planned minutes survive save/load', () => {
  const { s, plan, fixtureId } = career();
  const legacy = migrateCareerState(JSON.parse(JSON.stringify(setMatchPlan(s, fixtureId, plan))));
  assert.equal(legacy.matchPlans[fixtureId]!.plannedMinutes, undefined);
  assert.deepEqual(resolvePlannedMinutes(legacy, legacy.matchPlans[fixtureId]!), resolvePlannedMinutes(s, plan));
  const id = field(plan)[2]!;
  const saved = setMatchPlan(s, fixtureId, setPlannedMinutes(plan, id, 17));
  const loaded = migrateCareerState(JSON.parse(JSON.stringify(saved)));
  assert.equal(loaded.matchPlans[fixtureId]!.plannedMinutes![id], 17);
  assert.equal(plannedMinutesFor(loaded, loaded.matchPlans[fixtureId]!, id), 17);
});

test('the assistant input carries planned minutes and role weights for the manager plan only', () => {
  const { s: base, plan } = career();
  const [a, b] = field(plan);
  const s = roles(base, [[a!, 'KEY_PLAYER'], [b!, 'SQUAD_PLAYER']]);
  const input = engineMinutesPlan(s, setPlannedMinutes(plan, b!, 0))!;
  assert.equal(Object.keys(input).length, plan.squad.players.length);
  assert.ok(input[a!]!.weight > input[b!]!.weight);
  assert.equal(input[b!]!.planned, 0);
  assert.equal(engineMinutesPlan(s, { ...plan, clubId: 'swe2-aranas' }), undefined, 'CPU plans never get one');
  assert.equal(engineMinutesPlan(s, null), undefined);
});

test('a started match hands the plan to the assistant; a manual substitution is locked from it', () => {
  const { s, plan, fixtureId } = career();
  const id = field(plan)[0]!;
  const running = startProductionMatch(setMatchPlan(s, fixtureId, setPlannedMinutes(plan, id, 12)));
  const session = running.productionMatch!;
  const team = session.fixture.homeClubId === running.playerClubId ? 'HOME' : 'AWAY';
  const cpu = team === 'HOME' ? 'AWAY' : 'HOME';
  assert.equal(session.core.coaching[team].plan!.minutes![id]!.planned, 12);
  assert.equal(session.core.coaching[cpu].plan?.minutes, undefined, 'the opponent is untouched');
  const out = session.core.players.find(p => p.team === team && p.kind === 'FIELD_PLAYER' && p.population === 'COURT')!;
  const incoming = session.core.players.find(p => p.team === team && p.kind === out.kind && p.population === 'BENCH')!;
  const after = commandProductionMatch(running, { kind: 'SUBSTITUTION', team, outId: out.id, inId: incoming.id });
  assert.ok(manualLocked(after.productionMatch!.core, team, out.id));
  assert.ok(manualLocked(after.productionMatch!.core, team, incoming.id));
  const reloaded = JSON.parse(JSON.stringify(after)) as CareerState;
  assert.ok(manualLocked(reloaded.productionMatch!.core, team, incoming.id), 'the lock survives save/load mid-match');
});

test('a whole quick match: planned minutes move who plays, and every exchange keeps goalkeeper-for-goalkeeper', () => {
  const { s, plan, fixtureId } = career();
  const bench = field(plan).filter(id => !starters(plan).has(id));
  const target = bench[0]!;
  // Keep the target's position inside its 60 minutes: the other players there share what is left.
  const sharing = plan.squad.players.map(p => p.playerId).filter(id => id !== target && assignedPosition(plan, id) === assignedPosition(plan, target));
  const play = (minutes: number) => {
    const others = sharing.reduce((p, id, i) => setPlannedMinutes(p, id, i === 0 ? 60 - minutes : 0), plan);
    const planned = setPlannedMinutes(others, target, minutes);
    assert.ok(positionBudgets(s, planned).every(b => b.status !== 'OVER'));
    let running = startProductionMatch(setMatchPlan(s, fixtureId, planned), fixtureId, { quick: true });
    for (let i = 0; i < 40 && running.productionMatch?.core.status === 'RUNNING'; i++) {
      if (running.productionMatch.pausedAtHalf) running = commandProductionMatch(running, { kind: 'SECOND_HALF' });
      running = advanceProductionMatch(running, 10000, false);
    }
    const core = running.productionMatch!.core;
    const kind = new Map(core.players.map(p => [p.id, p.kind]));
    for (const e of core.exchanges.filter(x => x.phase === 'COMPLETED' && x.outId)) {
      const out = kind.get(e.outId!)!, inn = kind.get(e.inId)!;
      // The only kind change the engine itself allows is the planned 7v6 keeper exchange, which a quick match never uses.
      assert.equal(out, inn, `exchange ${e.outId} -> ${e.inId} keeps the position kind`);
    }
    return core.players.find(p => p.id === target)!.condition.courtMs / 60000;
  };
  const planned = play(40), unplanned = play(0);
  assert.ok(planned > unplanned, `planned 40 -> ${planned.toFixed(1)} min, planned 0 -> ${unplanned.toFixed(1)} min`);
});

test('recent actual minutes come from the recorded match history, newest first', () => {
  const { s, plan } = career();
  const id = field(plan)[0]!;
  const sample = (fixtureId: string, date: string, minutes: number) => ({ fixtureId, seasonId: s.seasonId, clubId: s.playerClubId, date, source: 'MEASURED' as const, players: { [id]: { tier: 'ROTATION' as const, phase: 'BOTH_PHASES' as const, available: true, expectedMinutes: 18, courtMinutes: minutes } } });
  const withHistory: CareerState = { ...s, playerDynamics: { morale: {}, promises: {}, concerns: {}, requests: {}, listings: {}, departures: [], playingTime: { a: sample('a', '2026-09-01', 10), b: sample('b', '2026-09-08', 22.4), c: sample('c', '2026-08-25', 0) } } };
  assert.deepEqual(minutesPlannerRows(withHistory, plan).find(r => r.playerId === id)!.recentMinutes, [22, 10, 0]);
  assert.deepEqual(minutesPlannerRows(s, plan).find(r => r.playerId === id)!.recentMinutes, []);
});
