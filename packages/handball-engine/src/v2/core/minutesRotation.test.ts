// SQUAD-ROLE-MINUTES: planned minutes are weighted assistant inputs -- never a
// minute-exact quota, never a position the plan did not give, overridden by a
// tight finish, and never against the manager's own control.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from './match';
import { advanceCoreMutable } from './engine';
import { courtPlayers, type CorePlayer, type CoreState } from './state';
import { coachingBefore } from './coaching';
import { lockManualExchange, minutesAhead, minutesNeed, minutesReading, minutesTolerance, sameBudget, samePosition, type PlannedMinutes } from './minutesRotation';

const MIN = 60000;

/** A running first half: only HOME's assistant rotates, every HOME bench player starts unavailable and everybody is fresh. */
function running(): CoreState {
  const s = createMatch(4, 'TOP', 1800000, 0);
  for (let i = 0; i < 1200 && s.match!.phase === 'PREMATCH'; i++) advanceCoreMutable(s);
  assert.equal(s.match!.phase, 'FIRST_HALF');
  s.exchanges = s.exchanges.filter(e => e.phase === 'COMPLETED' || e.phase === 'CANCELLED');
  for (const team of ['HOME', 'AWAY'] as const) { s.coaching[team].rotation = team === 'HOME'; s.coaching[team].timeouts = false; }
  for (const p of s.players) if (p.team === 'HOME') { p.condition.energy = 1; if (p.population !== 'COURT') p.condition.unavailable = true; }
  return s;
}
/** A HOME court field player not on the ball, and a same-role bench player made available. */
function pair(s: CoreState): { court: CorePlayer; bench: CorePlayer } {
  const court = courtPlayers(s, 'HOME').find(p => p.kind === 'FIELD_PLAYER' && p.id !== s.ball.controllerId && !p.airborne && s.players.some(b => b.team === 'HOME' && b.population === 'BENCH' && b.kind === 'FIELD_PLAYER' && b.role === p.role))!;
  const bench = s.players.find(b => b.team === 'HOME' && b.population === 'BENCH' && b.kind === 'FIELD_PLAYER' && b.role === court.role)!;
  bench.condition.unavailable = false;
  return { court, bench };
}
const requested = (s: CoreState) => s.exchanges.filter(e => e.team === 'HOME' && e.phase !== 'COMPLETED' && e.phase !== 'CANCELLED');
/** Clock at `minute`, the court player having played the whole match so far. */
function at(s: CoreState, minute: number, court: CorePlayer) { s.officialClock.timeMs = minute * MIN; court.condition.courtMs = minute * MIN; }
function plan(s: CoreState, minutes: PlannedMinutes) { s.coaching.HOME.plan = { minutes }; }

test('without planned minutes the assistant behaves exactly as before', () => {
  const a = running(), b = running();
  const pa = pair(a), pb = pair(b);
  for (const [s, p] of [[a, pa], [b, pb]] as const) { at(s, 24, p.court); p.court.condition.energy = .45; }
  b.coaching.HOME.plan = {};
  coachingBefore(a); coachingBefore(b);
  assert.deepEqual(requested(a).map(e => [e.outId, e.inId]), requested(b).map(e => [e.outId, e.inId]));
  assert.equal(requested(a).length, 1, 'a tired player is still rotated by energy');
});

test('a player clearly ahead of his plan makes way for a same-role player who still needs minutes', () => {
  const s = running(), { court, bench } = pair(s);
  at(s, 24, court);
  plan(s, { [court.id]: { planned: 20, weight: .55 }, [bench.id]: { planned: 30, weight: .55 } });
  coachingBefore(s);
  const [e] = requested(s);
  assert.ok(e, 'exchange requested');
  assert.equal(e.outId, court.id); assert.equal(e.inId, bench.id);
  assert.equal(bench.role, court.role);
});

test('the plan is honoured around, never exactly at, a minute: within tolerance nothing happens', () => {
  const s = running(), { court, bench } = pair(s);
  // 24 minutes in, planned 40 -> pro-rata 16; actual 16 + (tolerance - 1) stays on.
  s.officialClock.timeMs = 24 * MIN;
  court.condition.courtMs = (16 + minutesTolerance(court.id) - 1) * MIN;
  plan(s, { [court.id]: { planned: 40, weight: 1 }, [bench.id]: { planned: 30, weight: 1 } });
  assert.equal(minutesAhead(s.coaching.HOME.plan!.minutes!, court, minutesReading(s, 'HOME')), 0);
  coachingBefore(s);
  assert.equal(requested(s).length, 0);
  assert.ok(minutesTolerance('a') >= 3 && minutesTolerance('a') <= 6);
});

test('a small weighted reading does not trigger an exchange: both signals must add up', () => {
  const s = running(), { court, bench } = pair(s);
  at(s, 12, court); // just past the settling period, barely ahead
  plan(s, { [court.id]: { planned: 45, weight: 1 }, [bench.id]: { planned: 10, weight: .3 } });
  coachingBefore(s);
  assert.equal(requested(s).length, 0);
});

test('invalid positions are impossible: no same-role replacement, no minutes exchange; keepers only swap with keepers', () => {
  const s = running(), { court, bench } = pair(s);
  const otherRole = s.players.find(b => b.team === 'HOME' && b.population === 'BENCH' && b.kind === 'FIELD_PLAYER' && b.role !== court.role)!;
  bench.condition.unavailable = true; otherRole.condition.unavailable = false;
  at(s, 24, court);
  plan(s, { [court.id]: { planned: 5, weight: 1 }, [otherRole.id]: { planned: 40, weight: 1 } });
  coachingBefore(s);
  assert.equal(requested(s).length, 0);
  const keeper = courtPlayers(s, 'HOME').find(p => p.kind === 'GOALKEEPER')!;
  assert.equal(samePosition(keeper, otherRole), false);
  assert.equal(samePosition(court, otherRole), false);
  assert.equal(samePosition(court, bench), true);
});

test('goalkeepers follow their own plan, goalkeeper for goalkeeper', () => {
  const s = running();
  const keeper = courtPlayers(s, 'HOME').find(p => p.kind === 'GOALKEEPER')!;
  const backup = s.players.find(p => p.team === 'HOME' && p.population === 'BENCH' && p.kind === 'GOALKEEPER');
  if (!backup) return; // a scenario squad without a second keeper has nothing to test
  backup.condition.unavailable = false;
  s.officialClock.timeMs = 50 * MIN; keeper.condition.courtMs = 50 * MIN;
  s.score.HOME = 30; s.score.AWAY = 18; // decided game: the plan leads
  plan(s, { [keeper.id]: { planned: 40, weight: 1 }, [backup.id]: { planned: 20, weight: .55 } });
  s.ball.controllerId = null;
  coachingBefore(s);
  const e = requested(s).find(x => x.outId === keeper.id);
  assert.ok(e); assert.equal(s.players.find(p => p.id === e.inId)!.kind, 'GOALKEEPER');
});

test('tactical context overrides the plan: a tight finish keeps players on, a decided game shares minutes', () => {
  const build = (home: number, away: number) => {
    const s = running(), { court, bench } = pair(s);
    at(s, 53, court);
    s.score.HOME = home; s.score.AWAY = away;
    plan(s, { [court.id]: { planned: 40, weight: 1 }, [bench.id]: { planned: 20, weight: .55 } });
    coachingBefore(s);
    return requested(s).length;
  };
  assert.equal(build(25, 24), 0, 'one-goal game late: the plan yields');
  assert.equal(build(31, 20), 1, 'eleven-goal game: the plan leads');
});

test('a player in form is kept on longer than the same player out of form', () => {
  const run = (goals: number) => {
    const s = running(), { court, bench } = pair(s);
    // Exactly six minutes ahead of plan beyond tolerance: on its own just enough for the bench player who needs a little time.
    s.officialClock.timeMs = 20 * MIN;
    court.condition.courtMs = (20 / 3 + minutesTolerance(court.id) + 6) * MIN;
    plan(s, { [court.id]: { planned: 20, weight: 1 }, [bench.id]: { planned: 12, weight: .3 } });
    for (let i = 0; i < goals; i++) s.events.push({ ...s.events.at(-1)!, type: 'GOAL', actorId: court.id, officialMs: s.officialClock.timeMs - MIN });
    coachingBefore(s);
    return requested(s).length;
  };
  assert.equal(run(0), 1);
  assert.equal(run(2), 0);
});

test('manual control is respected: rotation off does nothing, a manual exchange is never reversed', () => {
  const off = running(), p1 = pair(off);
  at(off, 24, p1.court); off.coaching.HOME.rotation = false;
  plan(off, { [p1.court.id]: { planned: 5, weight: 1 }, [p1.bench.id]: { planned: 40, weight: 1 } });
  p1.court.condition.energy = .3;
  coachingBefore(off);
  assert.equal(requested(off).length, 0);

  const s = running(), { court, bench } = pair(s);
  at(s, 24, court);
  plan(s, { [court.id]: { planned: 5, weight: 1 }, [bench.id]: { planned: 40, weight: 1 } });
  lockManualExchange(s, 'HOME', [court.id]);
  court.condition.energy = .3;
  coachingBefore(s);
  assert.equal(requested(s).filter(e => e.outId === court.id).length, 0, 'neither minutes nor fatigue moves a manually placed player');
  s.officialClock.timeMs += 11 * MIN;
  coachingBefore(s);
  assert.equal(requested(s).filter(e => e.outId === court.id).length, 1, 'the lock ends after its period');
});

test('a tired player is replaced by the fresh same-role player who still needs his planned minutes', () => {
  const s = running(), { court, bench } = pair(s);
  const second = s.players.find(b => b.team === 'HOME' && b.population === 'BENCH' && b.kind === 'FIELD_PLAYER' && b.role === court.role && b.id !== bench.id);
  if (!second) return;
  second.condition.unavailable = false;
  at(s, 24, court); court.condition.energy = .45;
  const [favoured, other] = [bench.id, second.id].sort().reverse();
  plan(s, { [favoured]: { planned: 30, weight: .8 }, [other]: { planned: 0, weight: .3 } });
  coachingBefore(s);
  assert.equal(requested(s)[0]?.inId, favoured);
  assert.equal(minutesNeed(s.coaching.HOME.plan!.minutes!, s.players.find(p => p.id === other)!, minutesReading(s, 'HOME')), 0);
});

test('position budgets: the assistant only trades minutes inside one planned position budget', () => {
  const run = (benchPosition: string) => {
    const s = running(), { court, bench } = pair(s);
    at(s, 24, court);
    plan(s, { [court.id]: { planned: 20, weight: .55, position: 'V6' }, [bench.id]: { planned: 30, weight: .55, position: benchPosition } });
    coachingBefore(s);
    return requested(s).filter(e => e.outId === court.id && e.inId === bench.id).length;
  };
  assert.equal(run('V6'), 1, 'same budget: the planned minutes are traded');
  assert.equal(run('H6'), 0, 'another position\'s budget is never used to cover this one');
  const s = running(), { court, bench } = pair(s);
  assert.equal(sameBudget({ [court.id]: { planned: 20, weight: 1 } }, court, bench), true, 'no planned position: engine role alone decides, as before');
});
