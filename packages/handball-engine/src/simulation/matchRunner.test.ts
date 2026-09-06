// MATCH-EXPERIENCE-2.0 M4: the 2x30 match clock and a complete match.
//
// The tests that must never be deleted are "every goal maps to a simulated
// SHOT_GOAL" and "no event is recorded beyond the whistle". A complete match is
// exactly where a precomputed scoreline would be easiest to slip back in, and
// where a clock bug would silently invent or discard play; those two assertions
// are what keep the result a consequence of the simulation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import {
  simulateMatch,
  HALF_LENGTH_SECONDS,
  FULL_TIME_SECONDS,
  MATCH_PACING_FACTOR,
  MAX_SEGMENTS_PER_HALF,
  type MatchResult,
} from "./matchRunner";

const START = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const SEED = 12;

function match(seed = SEED): MatchResult {
  return simulateMatch(START, seed);
}

// ---------------------------------------------------------------------------
// Clock structure
// ---------------------------------------------------------------------------

test("a match runs both halves and finishes at full time", () => {
  const result = match();
  assert.equal(result.phase, "FULL_TIME");
  assert.equal(HALF_LENGTH_SECONDS, 1800, "30:00 per half");
  assert.equal(FULL_TIME_SECONDS, 3600, "60:00 total");
  const halves = new Set(result.segments.map((s) => s.half));
  assert.deepEqual([...halves].sort(), [1, 2], "both halves were played");
});

test("the first half ends at 30:00 and the second reaches 60:00", () => {
  const result = match();
  const first = result.events.filter((e) => e.half === 1);
  const second = result.events.filter((e) => e.half === 2);
  assert.ok(first.length > 0 && second.length > 0);
  const lastFirst = first[first.length - 1];
  const lastSecond = second[second.length - 1];
  assert.equal(lastFirst.clockSeconds, HALF_LENGTH_SECONDS, "the first half runs out exactly at 30:00");
  assert.equal(lastFirst.matchSeconds, HALF_LENGTH_SECONDS);
  assert.equal(lastSecond.clockSeconds, HALF_LENGTH_SECONDS, "the second half runs out exactly at 30:00 of its own clock");
  assert.equal(lastSecond.matchSeconds, FULL_TIME_SECONDS, "which is 60:00 on the match clock");
});

test("no event is recorded beyond the whistle", () => {
  const result = match();
  for (const event of result.events) {
    assert.ok(event.clockSeconds <= HALF_LENGTH_SECONDS, `event at ${event.clockSeconds}s exceeded its half`);
    assert.ok(event.matchSeconds <= FULL_TIME_SECONDS, `event at ${event.matchSeconds}s exceeded full time`);
    assert.ok(event.clockSeconds >= 0);
  }
});

test("event timestamps are monotonic across the whole match", () => {
  const result = match();
  let previous = -1;
  for (const event of result.events) {
    assert.ok(event.matchSeconds >= previous, `match clock went backwards at ${event.matchSeconds}s`);
    previous = event.matchSeconds;
  }
});

test("match time and spatial simulation time are kept separate", () => {
  const result = match();
  // The pacing factor means official time runs ahead of simulated action time;
  // conflating them is exactly what would produce an absurd match volume.
  assert.ok(MATCH_PACING_FACTOR > 1, "the two clocks have different pacing");
  assert.ok(result.simulationSeconds > 0, "spatial time is tracked");
  assert.ok(result.simulationSeconds < FULL_TIME_SECONDS, "and is not the same quantity as match time");
  for (const event of result.events) {
    assert.ok(Number.isFinite(event.simulationTime), "every event keeps its spatial timestamp too");
  }
});

// ---------------------------------------------------------------------------
// Halftime
// ---------------------------------------------------------------------------

test("the score persists through halftime", () => {
  const result = match();
  const firstHalfGoals = result.events.filter((e) => e.half === 1 && e.outcome === "SHOT_GOAL").length;
  assert.equal(result.halftimeScore.HOME + result.halftimeScore.AWAY, firstHalfGoals, "halftime score is the first half's goals");
  assert.ok(result.finalScore.HOME >= result.halftimeScore.HOME, "HOME cannot lose goals over the interval");
  assert.ok(result.finalScore.AWAY >= result.halftimeScore.AWAY, "AWAY cannot lose goals over the interval");
});

test("the teams switch ends at halftime", () => {
  const result = match();
  const endsFor = (team: "HOME" | "AWAY", half: 1 | 2) =>
    new Set(result.segments.filter((s) => s.team === team && s.half === half).map((s) => s.attackingGoalSide));
  const homeFirst = [...endsFor("HOME", 1)];
  const homeSecond = [...endsFor("HOME", 2)];
  assert.equal(homeFirst.length, 1, "HOME attacks one goal all first half");
  assert.equal(homeSecond.length, 1, "and one goal all second half");
  assert.notEqual(homeSecond[0], homeFirst[0], "which must be the other end");
  // And the same must hold for AWAY, in mirror.
  assert.notEqual([...endsFor("AWAY", 2)][0], [...endsFor("AWAY", 1)][0]);
});

test("the opposite team starts the second half", () => {
  const result = match();
  const firstOfHalf = (half: 1 | 2) => result.segments.filter((s) => s.half === half)[0];
  assert.notEqual(firstOfHalf(2).team, firstOfHalf(1).team, "whoever threw off first does not throw off again");
});

test("player identity survives halftime", () => {
  const result = match();
  const rosters = result.finalState.rosters;
  assert.ok(rosters.HOME.length > 0 && rosters.AWAY.length > 0);
  const overlap = rosters.HOME.filter((id) => rosters.AWAY.includes(id));
  assert.equal(overlap.length, 0, "a player belongs to exactly one side for the whole match");
  const keepers = result.finalState.match.handball.players.filter((p) => p.kind === "GOALKEEPER");
  assert.equal(keepers.length, 2, "both goalkeepers are still on court at full time");
});

// ---------------------------------------------------------------------------
// Score integrity -- do not delete
// ---------------------------------------------------------------------------

test("every goal in the score maps to a simulated SHOT_GOAL", () => {
  for (const seed of [12, 7, 2026]) {
    const result = match(seed);
    const goals = result.events.filter((e) => e.outcome === "SHOT_GOAL").length;
    assert.equal(
      result.finalScore.HOME + result.finalScore.AWAY,
      goals,
      `seed ${seed}: the final score equals the number of simulated goals, nothing else`,
    );
    // Each SHOT_GOAL event must carry the shot that produced it.
    for (const event of result.events) {
      if (event.outcome !== "SHOT_GOAL") continue;
      assert.ok(event.event.shotOrigin, "a goal knows where it was scored from");
      assert.ok(event.event.playerId, "and who scored it");
    }
  }
});

test("halftime and final score derive from the event stream", () => {
  const result = match();
  const tally = (upTo: (e: (typeof result.events)[number]) => boolean) => {
    let home = 0;
    let away = 0;
    for (const event of result.events) {
      if (!upTo(event) || event.outcome !== "SHOT_GOAL") continue;
      if (event.team === "HOME") home += 1;
      else away += 1;
    }
    return { HOME: home, AWAY: away };
  };
  assert.deepEqual(tally((e) => e.half === 1), result.halftimeScore, "halftime score is reconstructable from events");
  assert.deepEqual(tally(() => true), result.finalScore, "final score is reconstructable from events");
});

test("the winner reflects the final score", () => {
  const result = match();
  const { HOME, AWAY } = result.finalScore;
  const expected = HOME > AWAY ? "HOME" : AWAY > HOME ? "AWAY" : "DRAW";
  assert.equal(result.winner, expected);
});

// ---------------------------------------------------------------------------
// Cadence and safety
// ---------------------------------------------------------------------------

test("a full match contains many possessions for both teams", () => {
  const result = match();
  assert.ok(result.totalPossessions > 40, `a match is not a handful of actions (${result.totalPossessions} possessions)`);
  for (const half of [1, 2] as const) {
    const teams = new Set(result.segments.filter((s) => s.half === half).map((s) => s.team));
    assert.equal(teams.size, 2, `both teams had the ball in half ${half}`);
  }
});

test("match cadence is not obviously broken", () => {
  // Not calibration -- just a guard against the failure modes M4 must avoid:
  // hundreds of possessions per half, absurd scorelines, or a match that ends
  // after a few actions.
  for (const seed of [12, 7, 2026]) {
    const result = match(seed);
    for (const half of [1, 2] as const) {
      const count = result.segments.filter((s) => s.half === half).length;
      assert.ok(count < 300, `half ${half} of seed ${seed} played ${count} segments`);
      assert.ok(count > 10, `half ${half} of seed ${seed} played only ${count} segments`);
    }
    const total = result.finalScore.HOME + result.finalScore.AWAY;
    assert.ok(total < 100, `seed ${seed} produced an absurd ${total}-goal match`);
    assert.ok(total > 5, `seed ${seed} produced only ${total} goals`);
    assert.equal(result.guardTripped, false, `seed ${seed} needed the safety guard`);
  }
});

test("the safety guard bounds a half rather than hanging", () => {
  assert.ok(MAX_SEGMENTS_PER_HALF > 100, "the bound is far above a plausible half");
  const result = match();
  for (const half of [1, 2] as const) {
    assert.ok(result.segments.filter((s) => s.half === half).length <= MAX_SEGMENTS_PER_HALF);
  }
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("the same inputs produce an identical complete match", () => {
  const a = match();
  const b = match();
  assert.deepEqual(b.halftimeScore, a.halftimeScore);
  assert.deepEqual(b.finalScore, a.finalScore);
  assert.equal(b.winner, a.winner);
  assert.equal(b.totalPossessions, a.totalPossessions);
  assert.deepEqual(b.segments, a.segments, "identical segment sequence");
  assert.deepEqual(
    b.events.map((e) => [e.half, e.clockSeconds, e.matchSeconds, e.outcome, e.team]),
    a.events.map((e) => [e.half, e.clockSeconds, e.matchSeconds, e.outcome, e.team]),
    "identical events at identical timestamps",
  );
  assert.deepEqual(b.trace, a.trace, "identical spatial trace");
  assert.equal(b.finalState.match.handball.simulationTime, a.finalState.match.handball.simulationTime);
});

test("different seeds produce different matches", () => {
  const scores = new Set([12, 7, 2026].map((s) => JSON.stringify(match(s).finalScore)));
  assert.ok(scores.size >= 2, "seeds diverge into different matches");
});
