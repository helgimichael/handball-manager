// MATCH-EXPERIENCE-2.0 M3: continuous game flow.
//
// The tests that must never be deleted are "a goal is only ever scored by a
// simulated shot" and "spatial state stays continuous across possessions".
// M3's whole claim is that play runs on from one full-court state; a change
// that precomputed a scoreline, or rebuilt a formation between possessions,
// would satisfy most of the rest of this file and still destroy the
// architecture M1 and M2 exist to establish.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_FULL_COURT_BOUNDS, isWithinCanonicalBounds } from "@handball-manager/match-contract";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateGameSequence, createGameFlowState, teamOf, type GameFlowResult, type MatchTeamId } from "./gameFlow";

const START = createFullCourt6v6State({ attackingGoalSide: "TOP" });

/**
 * Seeds pinned from a scan so each required behaviour has a deterministic
 * witness. Re-pinned after the organized-shape fix: restoring positional width
 * legitimately changes trajectories, so the old witnesses no longer produce the
 * same outcomes. The assertions are unchanged -- only the seeds that exercise
 * them.
 */
const SEED_FREE_THROW = 5; // free throw, continued by the same team (re-pinned for M6, again for M7)
const SEED_MIXED = 1; // goals, centre restarts, saves, settled breaks (re-pinned for M6, again for M7)
const SEED_TURNOVER = 4; // a turnover mid-run, followed by the transition it causes

function run(seed: number, maxPossessions = 8): GameFlowResult {
  return simulateGameSequence(START, seed, { maxPossessions });
}

// ---------------------------------------------------------------------------
// Score -- do not delete
// ---------------------------------------------------------------------------

test("a goal is only ever scored by a simulated shot, and increments exactly once", () => {
  for (const seed of [SEED_FREE_THROW, SEED_MIXED, SEED_TURNOVER]) {
    const result = run(seed);
    const goals = result.segments.filter((s) => s.outcome === "SHOT_GOAL").length;
    assert.equal(
      result.score.HOME + result.score.AWAY,
      goals,
      `seed ${seed}: the scoreline equals the number of simulated SHOT_GOAL outcomes, nothing else`,
    );
  }
});

test("the score starts at 0-0 and is never precomputed", () => {
  const fresh = createGameFlowState(START);
  assert.deepEqual(fresh.score, { HOME: 0, AWAY: 0 });
  // A run limited to a single possession can score at most one goal.
  const single = run(SEED_FREE_THROW, 1);
  assert.ok(single.score.HOME + single.score.AWAY <= 1);
});

test("a goal is credited to the team the scorer actually belongs to", () => {
  const result = run(SEED_FREE_THROW);
  const credited: Record<MatchTeamId, number> = { HOME: 0, AWAY: 0 };
  for (const event of result.events) {
    if (event.type !== "SHOT_GOAL" || !event.playerId) continue;
    const team = teamOf(result.finalState.rosters as Record<MatchTeamId, readonly string[]>, event.playerId);
    if (team) credited[team] += 1;
  }
  assert.deepEqual(result.score, credited, "every goal is attributed through the stable rosters");
});

// ---------------------------------------------------------------------------
// Continuation rules
// ---------------------------------------------------------------------------

test("the conceding team restarts from the centre, and play continues", () => {
  const result = run(SEED_FREE_THROW);
  const goalIndex = result.segments.findIndex((s) => s.outcome === "SHOT_GOAL");
  assert.ok(goalIndex >= 0, "this seed scores");
  const scoring = result.segments[goalIndex];
  const next = result.segments[goalIndex + 1];
  assert.ok(next, "play continues after the goal");
  assert.equal(next.kind, "CENTRE_RESTART");
  assert.notEqual(next.team, scoring.team, "the conceding team restarts");
  assert.notEqual(next.attackingGoalSide, scoring.attackingGoalSide, "and attacks the other goal");
  assert.ok(result.trace.some((t) => t.note.includes("centre restart")), "the restart is traced");
});

test("the restart brings the ball to the centre circle", () => {
  const result = run(SEED_FREE_THROW);
  const restart = result.trace.find((t) => t.note.includes("centre restart"))!;
  assert.ok(restart, "a centre restart happened");
  const distance = Math.hypot(restart.ballPosition.x - 10, restart.ballPosition.y - 20);
  assert.ok(distance <= 1.5, `the ball restarts at the centre (was ${distance.toFixed(2)}m away)`);
});

test("a save continues into a transition", () => {
  const result = run(SEED_MIXED);
  const saveIndex = result.segments.findIndex((s) => s.outcome === "SHOT_SAVED");
  assert.ok(saveIndex >= 0, "this seed contains a save");
  const next = result.segments[saveIndex + 1];
  assert.ok(next, "play continues after the save");
  assert.equal(next.kind, "TRANSITION");
  assert.notEqual(next.team, result.segments[saveIndex].team, "the saving team now attacks");
});

test("a turnover continues into a transition", () => {
  const result = run(SEED_TURNOVER, 10);
  const index = result.segments.findIndex((s) => s.outcome === "TURNOVER");
  // Asserted, not skipped: an early return here would let the test pass
  // vacuously on a seed that never turns the ball over.
  assert.ok(index >= 0, "this seed contains a turnover");
  const next = result.segments[index + 1];
  assert.ok(next, "play continues after the turnover");
  assert.equal(next.kind, "TRANSITION");
  assert.notEqual(next.team, result.segments[index].team, "the team that won the ball now attacks");
});

test("a free throw preserves the attacking team, and the possession continues", () => {
  const result = run(SEED_FREE_THROW);
  const index = result.segments.findIndex((s) => s.outcome === "FREE_THROW");
  assert.ok(index >= 0, "this seed contains a free throw");
  const before = result.segments[index];
  const after = result.segments[index + 1];
  assert.ok(after, "a free throw does not terminate the sequence -- M1 treated it as terminal, M3 does not");
  assert.equal(after.kind, "FREE_THROW_CONTINUATION");
  assert.equal(after.team, before.team, "the same team keeps the ball");
  assert.equal(after.attackingGoalSide, before.attackingGoalSide, "attacking the same goal");
  assert.equal(after.possessionNumber, before.possessionNumber, "it is the SAME possession, not a new one");
});

test("ORGANIZED_ATTACK_REACHED flows straight into an organized possession", () => {
  const result = run(SEED_MIXED);
  const index = result.segments.findIndex((s) => s.outcome === "ORGANIZED_ATTACK_REACHED");
  assert.ok(index >= 0, "this seed settles a break at least once");
  const before = result.segments[index];
  const after = result.segments[index + 1];
  assert.ok(after, "the settled attack plays on");
  assert.equal(after.kind, "ORGANIZED");
  assert.equal(after.team, before.team, "the same team continues attacking");
  assert.equal(after.possessionNumber, before.possessionNumber, "still the same possession");
});

test("the attacking direction alternates correctly between the two teams", () => {
  const result = run(SEED_MIXED);
  for (const segment of result.segments) {
    // HOME starts attacking TOP; each team always attacks its own end.
    const expected = segment.team === "HOME" ? "TOP" : "BOTTOM";
    assert.equal(segment.attackingGoalSide, expected, `${segment.team} must attack the ${expected} goal`);
  }
});

// ---------------------------------------------------------------------------
// Continuity -- do not delete
// ---------------------------------------------------------------------------

test("spatial state stays continuous across possessions", () => {
  const result = run(SEED_FREE_THROW);
  assert.ok(result.trace.length > 20, "a multi-possession run leaves a substantial trace");
  let previousTime = -1;
  for (const entry of result.trace) {
    // Time never restarts: possessions run on from one clock.
    assert.ok(entry.simulationTime >= previousTime - 1e-9, `time went backwards at ${entry.note}`);
    previousTime = entry.simulationTime;
    assert.equal(entry.playerPositions.length, START.handball.players.length, "the squad never changes size");
    for (const p of entry.playerPositions) {
      assert.ok(isWithinCanonicalBounds(p.position, CANONICAL_FULL_COURT_BOUNDS), `${p.playerId} stayed on court`);
    }
  }
  // Both goalkeepers survive the whole run.
  const keepers = result.finalState.match.handball.players.filter((p) => p.kind === "GOALKEEPER");
  assert.equal(keepers.length, 2);
});

test("multiple possessions are simulated in one continuous run", () => {
  const result = run(SEED_MIXED);
  const possessions = new Set(result.segments.map((s) => s.possessionNumber));
  assert.ok(possessions.size >= 4, `several distinct possessions were played (${possessions.size})`);
  assert.ok(result.segments.length >= possessions.size, "some possessions contain more than one segment");
  const teams = new Set(result.segments.map((s) => s.team));
  assert.equal(teams.size, 2, "both teams had the ball");
});

// ---------------------------------------------------------------------------
// Determinism and limits
// ---------------------------------------------------------------------------

test("the same state, seed and limits give an identical sequence and score", () => {
  const a = run(SEED_FREE_THROW);
  const b = run(SEED_FREE_THROW);
  assert.deepEqual(b.score, a.score);
  assert.deepEqual(b.segments, a.segments);
  assert.deepEqual(b.trace, a.trace, "byte-for-byte identical across every possession");
  assert.equal(b.steps, a.steps);
});

test("different seeds can produce different matches", () => {
  const scores = new Set([SEED_FREE_THROW, SEED_MIXED, SEED_TURNOVER].map((s) => JSON.stringify(run(s).score)));
  assert.ok(scores.size >= 2, "seeds diverge into different scorelines");
});

test("the max-possession limit terminates the run safely", () => {
  for (const limit of [1, 2, 5]) {
    const result = run(SEED_MIXED, limit);
    const highest = Math.max(...result.segments.map((s) => s.possessionNumber));
    assert.ok(highest <= limit, `no possession beyond the limit of ${limit} (saw ${highest})`);
    assert.ok(result.segments.length > 0, "the run still produced play");
  }
});

test("the max-step limit terminates the run safely", () => {
  const result = simulateGameSequence(START, SEED_MIXED, { maxPossessions: 100, maxSteps: 200 });
  assert.equal(result.limitReached, true);
  assert.ok(result.steps >= 200, "it stopped at the step budget");
  assert.ok(result.steps < 200 + 2400, "and did not overrun by more than one possession's own guard");
});
