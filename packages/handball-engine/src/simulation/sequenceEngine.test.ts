// MATCH-EXPERIENCE-2.0 M2: change of possession and the full-court transition.
//
// The test that must never be deleted is "the state is continuous, not reset":
// M2's entire claim is that a save or turnover carries the SAME world into the
// opposite direction. A change that rebuilds a fresh formation between the shot
// and the fast break would pass almost everything else here and still destroy
// the property the full-court foundation exists for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_COURT_LENGTH_METERS, CANONICAL_FULL_COURT_BOUNDS, isWithinCanonicalBounds } from "@handball-manager/match-contract";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulatePossession } from "./possessionEngine";
import { simulateSequence, simulateTransition } from "./sequenceEngine";
import { switchPossession } from "./transition";
import { goalCentre, type PossessionOutcome } from "../domain/match/possession";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });

/** Seeds pinned from a 4000-seed scan, so each required behaviour has a deterministic witness. */
// Re-pinned for M6 and again for M7 (a coordinated defence) M8 (an intelligent transition) M9 (a real shot contest) and M10 (fouls and 7 metres): state-dependent attacking decisions legitimately change
// every trajectory, so the M2 witnesses no longer produce the same outcomes.
// The assertions are unchanged -- only the seeds that exercise them.
// M13 (calibration) re-pinned the free-throw witness: the split between a clean
// catch and a foul on the break moved, so seed 43's chase now ends as a clean
// steal. The assertion is unchanged.
// M17 re-pinned these: reading a passing lane and an attacking gap in SECONDS
// rather than in metres changes which option wins, and therefore every
// trajectory downstream of it. The assertions are unchanged -- only the seeds
// that exercise them. (M16's scenario layer exists so new behavioural tests do
// not have to be written this way.)
const SEED_SAVE_THEN_FREE_THROW = 31;
const SEED_SAVE_THEN_ORGANIZED = 6;
const SEED_SAVE_THEN_GOAL = 1;
const SEED_SAVE_THEN_TURNOVER = 2;
const SEED_TURNOVER_START = 3;

function sequence(seed: number) {
  return simulateSequence({ seed, initialState: TOP });
}

// ---------------------------------------------------------------------------
// 1-3. Possession actually changes, and the direction flips
// ---------------------------------------------------------------------------

test("a save changes possession and flips the attacking direction", () => {
  const result = sequence(SEED_SAVE_THEN_GOAL);
  assert.equal(result.possession.outcome, "SHOT_SAVED");
  assert.ok(result.transition, "a save must start a transition");
  assert.equal(result.possession.finalState.possession.attackingGoalSide, "TOP");
  assert.equal(result.transition!.finalState.possession.attackingGoalSide, "BOTTOM", "direction flipped TOP -> BOTTOM");
});

test("a turnover changes possession and flips the attacking direction", () => {
  const result = sequence(SEED_TURNOVER_START);
  assert.equal(result.possession.outcome, "TURNOVER");
  assert.ok(result.transition, "a turnover must start a transition");
  assert.equal(result.transition!.finalState.possession.attackingGoalSide, "BOTTOM");
});

test("outcomes that keep the ball do not start a transition", () => {
  // A goal or a miss is not a defensive regain. (M17 re-pinned the seed.)
  const goal = simulatePossession({ seed: 7, initialState: TOP });
  const result = sequence(7);
  assert.equal(result.transition, null);
  assert.equal(result.trace.length, goal.trace.length, "the trace is just the possession");
});

test("the team that defended becomes the attacking team", () => {
  const result = sequence(SEED_SAVE_THEN_GOAL);
  const before = result.possession.finalState.handball;
  const after = result.transition!.finalState.handball;
  const wasDefending = before.players.filter((p) => p.team === "DEFENSE").map((p) => p.id).sort();
  const nowAttacking = after.players.filter((p) => p.team === "ATTACK").map((p) => p.id).sort();
  assert.deepEqual(nowAttacking, wasDefending, "the defending side is now the attacking side");
});

// ---------------------------------------------------------------------------
// 4. Continuity -- do not delete
// ---------------------------------------------------------------------------

test("the state is continuous, not reset, across the change of possession", () => {
  const result = sequence(SEED_SAVE_THEN_GOAL);
  const ended = result.possession.finalState.handball;
  const switched = result.transition!.trace[0];

  // Every player is in exactly the position the possession left him in.
  for (const player of ended.players) {
    const carried = switched.playerPositions.find((p) => p.playerId === player.id);
    assert.ok(carried, `${player.id} survived the possession change`);
    assert.ok(Math.abs(carried!.position.x - player.position.x) < 1e-9, `${player.id} x is unchanged`);
    assert.ok(Math.abs(carried!.position.y - player.position.y) < 1e-9, `${player.id} y is unchanged`);
  }
  // Simulation time runs on rather than restarting at zero.
  assert.ok(switched.simulationTime >= ended.simulationTime - 1e-3, "the clock is continuous (trace times are rounded to 4 decimals)");
  assert.ok(switched.simulationTime > 0, "the transition does not start from t=0");
  // And the trace is ONE sequence, not two stitched recordings.
  assert.equal(result.trace.length, result.possession.trace.length + result.transition!.trace.length);
});

test("the ball is regained where the action actually ended", () => {
  const result = sequence(SEED_SAVE_THEN_GOAL);
  const ended = result.possession.finalState.handball;
  const regainerId = result.transition!.trace[0].ballPossessorId;
  assert.ok(regainerId, "someone has the ball");
  const regainer = ended.players.find((p) => p.id === regainerId)!;
  const ballAtSwitch = result.transition!.trace[0].ballPosition;
  assert.ok(Math.abs(ballAtSwitch.x - regainer.position.x) < 1e-9);
  assert.ok(Math.abs(ballAtSwitch.y - regainer.position.y) < 1e-9);
});

// ---------------------------------------------------------------------------
// 5-7. Real movement across the full court
// ---------------------------------------------------------------------------

test("players physically cross the full court during a transition", () => {
  const result = sequence(SEED_SAVE_THEN_GOAL);
  const transition = result.transition!;
  const start = transition.trace[0].playerPositions;
  const end = transition.trace[transition.trace.length - 1].playerPositions;
  const crossed = end.filter((p) => {
    const before = start.find((q) => q.playerId === p.playerId)!;
    const half = CANONICAL_COURT_LENGTH_METERS / 2;
    return before.position.y < half && p.position.y >= half;
  });
  assert.ok(crossed.length > 0, "at least one player crossed the halfway line");
  for (const entry of transition.trace) {
    for (const p of entry.playerPositions) {
      assert.ok(isWithinCanonicalBounds(p.position, CANONICAL_FULL_COURT_BOUNDS), `${p.playerId} stayed on court`);
    }
  }
});

test("defenders retreat toward the goal they must now protect", () => {
  const result = sequence(SEED_SAVE_THEN_GOAL);
  const transition = result.transition!;
  const defenders = transition.finalState.handball.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
  const bottom = goalCentre("BOTTOM");
  const start = transition.trace[0].playerPositions;
  let closer = 0;
  for (const d of defenders) {
    const before = start.find((p) => p.playerId === d.id)!;
    const distBefore = Math.hypot(before.position.x - bottom.x, before.position.y - bottom.y);
    const distAfter = Math.hypot(d.position.x - bottom.x, d.position.y - bottom.y);
    if (distAfter < distBefore - 1) closer += 1;
  }
  assert.ok(closer >= 4, `${closer} of ${defenders.length} defenders physically retreated toward their own goal`);
  // M8 gives each retreating defender a job, so the retreat is traced as those
  // jobs rather than as one line about everybody running back. The behaviour
  // asserted above -- defenders physically closer to the goal they now defend
  // -- is unchanged.
  assert.ok(
    transition.trace.some((t) => t.note.startsWith("retreat:") && t.note.includes("protects the middle")),
    "the retreat is traced, with who is doing what",
  );
});

test("the ball advances through a real transition pass", () => {
  const result = sequence(SEED_SAVE_THEN_GOAL);
  const transition = result.transition!;
  // M8: the outlet is a choice between a short, medium or long ball rather
  // than one hard-coded pass to whoever is furthest forward, so the trace
  // names which one was played.
  assert.ok(
    transition.trace.some((t) => /plays the (short|medium|long) to/.test(t.note)),
    "an outlet was chosen and played",
  );
  const possessors = new Set(transition.trace.map((t) => t.ballPossessorId).filter((id): id is string => id !== null));
  assert.ok(possessors.size >= 2, "the ball moved between players during the transition");
});

// ---------------------------------------------------------------------------
// 8-10. Transition resolutions
// ---------------------------------------------------------------------------

test("a first wave can produce a shot", () => {
  const result = sequence(SEED_SAVE_THEN_GOAL);
  assert.equal(result.transition!.outcome, "SHOT_GOAL");
  assert.ok(result.transition!.shotOrigin, "the shot has a real origin on court");
  assert.ok(result.transition!.trace.some((t) => t.note.includes("breaks clear")), "the shot was earned by breaking clear");
});

test("a first wave can fail and settle into an organized attack", () => {
  const result = sequence(SEED_SAVE_THEN_ORGANIZED);
  assert.equal(result.transition!.outcome, "ORGANIZED_ATTACK_REACHED");
  assert.equal(result.transition!.shotOrigin, null, "no shot was faked merely to terminate the transition");
  assert.ok(result.transition!.trace.some((t) => t.phase === "EARLY_OFFENSE"), "it passed through early offense");
  assert.ok(result.transition!.trace.some((t) => t.note.includes("settles into an organized shape")));
});

test("a transition can itself produce a turnover or a free throw", () => {
  assert.equal(sequence(SEED_SAVE_THEN_TURNOVER).transition!.outcome, "TURNOVER");
  assert.equal(sequence(SEED_SAVE_THEN_FREE_THROW).transition!.outcome, "FREE_THROW");
});

test("the transition passes through the M2 phases in order", () => {
  const phases = sequence(SEED_SAVE_THEN_GOAL).transition!.trace.map((t) => t.phase);
  assert.equal(phases[0], "POSSESSION_CHANGE");
  assert.ok(phases.includes("DEFENSIVE_RETREAT"), "defensive retreat is a real phase");
  assert.ok(phases.includes("FIRST_WAVE"), "first wave is a real phase");
  assert.equal(phases[phases.length - 1], "COMPLETE");
});

// ---------------------------------------------------------------------------
// 11-12. Determinism and the guard
// ---------------------------------------------------------------------------

test("the same seed produces an identical transition trace", () => {
  const a = sequence(SEED_SAVE_THEN_GOAL);
  const b = sequence(SEED_SAVE_THEN_GOAL);
  assert.deepEqual(b.trace, a.trace, "byte-for-byte identical across possession AND transition");
  assert.equal(b.transition!.outcome, a.transition!.outcome);
  assert.deepEqual(b.events, a.events);
});

test("the max-step guard prevents an infinite transition", () => {
  const saved = simulatePossession({ seed: SEED_SAVE_THEN_GOAL, initialState: TOP });
  const keeper = saved.finalState.handball.players.find((p) => p.team === "DEFENSE" && p.kind === "GOALKEEPER")!;
  const switched = switchPossession(saved.finalState, "SHOT_SAVED", keeper.id);
  const result = simulateTransition({ seed: 1, initialState: switched.state, maxSteps: 4 });
  assert.equal(result.guardTripped, true);
  assert.equal(result.outcome, "TURNOVER", "the guard still yields a valid terminal outcome");
  assert.equal(result.steps, 4);
});

test("every transition outcome the model supports is reachable", () => {
  const seen = new Set<PossessionOutcome>();
  for (let seed = 1; seed <= 3000; seed += 1) {
    const result = sequence(seed);
    if (result.transition) seen.add(result.transition.outcome);
    if (seen.size === 6) break;
  }
  for (const outcome of ["SHOT_GOAL", "SHOT_SAVED", "SHOT_MISSED", "TURNOVER", "FREE_THROW", "ORGANIZED_ATTACK_REACHED"] as const) {
    assert.ok(seen.has(outcome), `${outcome} was never produced by a transition`);
  }
});

// ---------------------------------------------------------------------------
// Two goalkeepers -- a full court has two defended goals
// ---------------------------------------------------------------------------

test("both goals have a goalkeeper, at either end", () => {
  for (const side of ["TOP", "BOTTOM"] as const) {
    const state = createFullCourt6v6State({ attackingGoalSide: side });
    const keepers = state.handball.players.filter((p) => p.kind === "GOALKEEPER");
    assert.equal(keepers.length, 2, `attacking ${side}: one keeper per goal`);
    // The defending team's keeper stands in the goal being attacked; the
    // attacking team's keeper stands in the goal they themselves defend.
    const defending = keepers.find((k) => k.team === "DEFENSE")!;
    const attacking = keepers.find((k) => k.team === "ATTACK")!;
    const attackedGoal = goalCentre(side);
    const ownGoal = goalCentre(side === "TOP" ? "BOTTOM" : "TOP");
    assert.ok(Math.abs(defending.position.y - attackedGoal.y) < 2, "defending keeper is in the attacked goal");
    assert.ok(Math.abs(attacking.position.y - ownGoal.y) < 2, "attacking keeper is in his own goal");
    assert.equal(attacking.role, "GOALKEEPER");
    assert.equal(defending.role, "GOALKEEPER");
  }
});

test("a change of possession keeps both keepers, and neither becomes an outfield attacker", () => {
  for (const seed of [SEED_SAVE_THEN_GOAL, SEED_TURNOVER_START]) {
    const result = sequence(seed);
    assert.ok(result.transition, `seed ${seed} must produce a transition`);
    const after = result.transition!.finalState.handball.players;
    const keepers = after.filter((p) => p.kind === "GOALKEEPER");
    assert.equal(keepers.length, 2, "both keepers survive the possession change");
    for (const keeper of keepers) {
      assert.equal(keeper.role, "GOALKEEPER", `${keeper.id} is still a goalkeeper, not an outfield attacker`);
      assert.equal(keeper.kind, "GOALKEEPER");
    }
    // Exactly one keeper per team, still one at each end.
    assert.equal(keepers.filter((k) => k.team === "ATTACK").length, 1);
    assert.equal(keepers.filter((k) => k.team === "DEFENSE").length, 1);
    const ends = keepers.map((k) => (k.position.y < CANONICAL_COURT_LENGTH_METERS / 2 ? "TOP" : "BOTTOM")).sort();
    assert.deepEqual(ends, ["BOTTOM", "TOP"], "one keeper at each goal");
  }
});

test("a transition shot toward BOTTOM is faced by the BOTTOM goalkeeper", () => {
  // The possession attacks TOP, so the transition attacks BOTTOM.
  const result = sequence(SEED_SAVE_THEN_GOAL);
  const transition = result.transition!;
  assert.equal(transition.finalState.possession.attackingGoalSide, "BOTTOM");
  assert.ok(transition.shotOrigin, "this seed ends in a shot");
  assert.ok(transition.goalkeeperId, "a shot on a defended goal always names its goalkeeper");
  const keeper = transition.finalState.handball.players.find((p) => p.id === transition.goalkeeperId)!;
  assert.equal(keeper.kind, "GOALKEEPER");
  assert.ok(keeper.position.y > CANONICAL_COURT_LENGTH_METERS / 2, "the keeper faced is the one in the BOTTOM goal");
});

test("a transition shot toward TOP is faced by the TOP goalkeeper", () => {
  // Mirror the scenario: the possession attacks BOTTOM, so the transition attacks TOP.
  const bottom = createFullCourt6v6State({ attackingGoalSide: "BOTTOM" });
  let found = false;
  for (let seed = 1; seed <= 3000 && !found; seed += 1) {
    const result = simulateSequence({ seed, initialState: bottom });
    const transition = result.transition;
    if (!transition || !transition.shotOrigin) continue;
    assert.equal(transition.finalState.possession.attackingGoalSide, "TOP");
    assert.ok(transition.goalkeeperId, "a shot on a defended goal always names its goalkeeper");
    const keeper = transition.finalState.handball.players.find((p) => p.id === transition.goalkeeperId)!;
    assert.ok(keeper.position.y < CANONICAL_COURT_LENGTH_METERS / 2, "the keeper faced is the one in the TOP goal");
    found = true;
  }
  assert.ok(found, "a transition shot toward TOP must be reachable");
});

test("no normal shot on a defended goal ever reports a null goalkeeper", () => {
  for (let seed = 1; seed <= 600; seed += 1) {
    const result = sequence(seed);
    for (const [label, part] of [["possession", result.possession], ["transition", result.transition]] as const) {
      if (!part || !part.shotOrigin) continue;
      assert.ok(part.goalkeeperId, `seed ${seed} ${label}: a shot resolved against no goalkeeper`);
    }
  }
});
