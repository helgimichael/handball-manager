// MATCH-EXPERIENCE-2.0 M8: transition intelligence.
//
// The test that must never be deleted is "the break is a race, not a script":
// M8's claim is that every transition decision -- go or slow down, short or
// long, carry or pass -- comes from whether a runner can actually beat the
// retreat to a shooting position. A change that let the break decide its own
// ending, or that made the outlet a fixed sequence, would pass most of the
// rest of this file and put the scripted fast break back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateSequence, simulateTransition } from "./sequenceEngine";
import { simulatePossession } from "./possessionEngine";
import { switchPossession } from "./transition";
import { createPossessionRng } from "./possessionRng";
import {
  BREAK_SHOT_RANGE_METERS,
  TRANSITION_LANES,
  TRANSITION_LIMITS,
  advancementToward,
  assignRetreatRoles,
  assignRunningRoles,
  breakMarginSeconds,
  decideBreakAction,
  decideOutlet,
  depthInFrontOf,
  perceiveTransition,
  retreatTargetFor,
  runningTarget,
} from "./transitionDecision";
import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import type { FullCourtMatchState } from "../domain/match/possession";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });

/** A regain: the defending goalkeeper has the ball and his team now attacks BOTTOM. */
function keeperRegain(): FullCourtMatchState {
  const keeper = TOP.handball.players.find((p) => p.team === "DEFENSE" && p.kind === "GOALKEEPER")!;
  return switchPossession(TOP, "SHOT_SAVED", keeper.id).state;
}

function playerById(state: HandballState, id: string): Player {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error(`no player ${id}`);
  return player;
}

/** The same world with players stood elsewhere. Nothing else changes. */
function withPositions(state: HandballState, moves: Record<string, MeterPoint>): HandballState {
  return { ...state, players: state.players.map((p) => (moves[p.id] ? { ...p, position: { ...moves[p.id] } } : p)) };
}

function attackersOf(state: HandballState): readonly Player[] {
  return state.players.filter((p) => p.team === "ATTACK" && p.kind === "FIELD_PLAYER");
}

function defendersOf(state: HandballState): readonly Player[] {
  return state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER");
}

// ---------------------------------------------------------------------------
// 1. Running roles come from where players actually are
// ---------------------------------------------------------------------------

test("first-wave roles depend on actual position, not on shirt numbers", () => {
  const base = keeperRegain().handball;
  const attackers = attackersOf(base);
  const goalSide = "BOTTOM" as const;
  // Push two specific players up the court: they must become the first wave.
  const chosen = [attackers[4], attackers[1]];
  const advanced = withPositions(base, {
    [chosen[0].id]: { x: 3, y: 26 },
    [chosen[1].id]: { x: 17, y: 24 },
  });
  const roles = assignRunningRoles(perceiveTransition(advanced, goalSide));
  const firstWave = roles.filter((r) => r.role === "FIRST_WAVE").map((r) => r.playerId);
  assert.deepEqual([...firstWave].sort(), [chosen[0].id, chosen[1].id].sort(), "the two furthest up the court go first wave");
  assert.equal(roles.filter((r) => r.role === "SECOND_WAVE").length, 2, "two support");
  assert.ok(roles.filter((r) => r.role === "TRAILER").length >= 1, "somebody stays behind the ball");

  // Advance two DIFFERENT players and the first wave changes with them.
  const others = [attackers[0], attackers[3]];
  const swapped = withPositions(base, { [others[0].id]: { x: 5, y: 27 }, [others[1].id]: { x: 15, y: 25 } });
  const swappedFirst = assignRunningRoles(perceiveTransition(swapped, goalSide))
    .filter((r) => r.role === "FIRST_WAVE")
    .map((r) => r.playerId);
  assert.deepEqual([...swappedFirst].sort(), [others[0].id, others[1].id].sort(), "different positions, different first wave");
});

test("runners fill distinct lanes across the court, so a break is never single file", () => {
  const state = keeperRegain().handball;
  const roles = assignRunningRoles(perceiveTransition(state, "BOTTOM"));
  const lanes = roles.map((r) => r.laneX);
  const spread = Math.max(...lanes) - Math.min(...lanes);
  assert.ok(spread > 12, `the running lanes span the court (${spread.toFixed(1)}m)`);
  // Every lane a runner is given is one of the canonical lanes (or his own
  // width when the sixth man has no lane left), and no two share one.
  const laneCounts = new Map<number, number>();
  for (const lane of lanes) laneCounts.set(lane, (laneCounts.get(lane) ?? 0) + 1);
  for (const [lane, count] of laneCounts) {
    if (TRANSITION_LANES.includes(lane)) assert.equal(count, 1, `lane ${lane} is used once`);
  }
  assert.ok(TRANSITION_LANES.length === 5 && TRANSITION_LANES[0] < 3 && TRANSITION_LANES[4] > 17, "wing lanes are genuinely wide");
  // And the depth is staggered: first wave deepest, trailer furthest back.
  const depthOf = (role: "FIRST_WAVE" | "SECOND_WAVE" | "TRAILER") => {
    const assignment = roles.find((r) => r.role === role)!;
    return advancementToward(runningTarget(assignment, "BOTTOM"), "BOTTOM");
  };
  assert.ok(depthOf("FIRST_WAVE") > depthOf("SECOND_WAVE"), "the first wave runs deeper than its support");
  assert.ok(depthOf("SECOND_WAVE") > depthOf("TRAILER"), "and the support deeper than the trailer");
});

// ---------------------------------------------------------------------------
// 2. The outlet is a real choice
// ---------------------------------------------------------------------------

test("different regain states produce different outlet decisions", () => {
  const base = keeperRegain().handball;
  const keeper = playerById(base, base.ball.possessorId!);
  const rng = () => createPossessionRng(7);
  const mate = attackersOf(base)[0];

  // (a) Nobody has broken: everyone is still deep. The safe ball wins.
  const nobodyOn = decideOutlet(perceiveTransition(base, "BOTTOM"), keeper, rng());
  assert.ok(nobodyOn.chosen.kind === "SHORT" || nobodyOn.chosen.kind === "MEDIUM", `a covered break is not thrown long (${nobodyOn.chosen.kind})`);

  // (b) The same keeper, with one runner away up the court in a clear lane.
  const runnerGone = withPositions(base, { [mate.id]: { x: 3, y: 30 } });
  const longOn = decideOutlet(perceiveTransition(runnerGone, "BOTTOM"), keeper, rng());
  assert.equal(longOn.chosen.kind, "LONG", "with a man away the long outlet is on");
  assert.equal(longOn.chosen.targetPlayerId, mate.id);
  assert.ok(longOn.chosen.distance >= TRANSITION_LIMITS.longOutletMeters);
  assert.notEqual(longOn.chosen.targetPlayerId, nobodyOn.chosen.targetPlayerId, "different state, different outlet");

  // (c) The same runner, but a defender sitting in the passing lane. The
  // keeper does not throw it into him.
  const covered = withPositions(runnerGone, {
    [defendersOf(base)[0].id]: { x: 6, y: 16 },
    [defendersOf(base)[1].id]: { x: 3, y: 27 },
  });
  const coveredDecision = decideOutlet(perceiveTransition(covered, "BOTTOM"), keeper, rng());
  const longOption = coveredDecision.options.find((o) => o.targetPlayerId === mate.id)!;
  assert.ok(longOption.laneClearance < TRANSITION_LIMITS.laneCoverMeters, "that lane really is covered");
  assert.ok(longOption.score < longOn.chosen.score, "so the same pass is worth less than it was");
});

test("the goalkeeper does not throw long every time, and does not dribble", () => {
  const base = keeperRegain().handball;
  const keeper = playerById(base, base.ball.possessorId!);
  const options = decideOutlet(perceiveTransition(base, "BOTTOM"), keeper, createPossessionRng(3)).options;
  assert.ok(!options.some((o) => o.kind === "CARRY"), "a goalkeeper is never given the option of carrying it up");
  assert.ok(options.length >= 5, "he does consider every team-mate");
  // An outfield regainer IS allowed to carry.
  const fieldRegain = switchPossession(TOP, "TURNOVER", defendersOf(TOP.handball)[2].id).state.handball;
  const fieldCarrier = playerById(fieldRegain, fieldRegain.ball.possessorId!);
  const fieldOptions = decideOutlet(perceiveTransition(fieldRegain, "BOTTOM"), fieldCarrier, createPossessionRng(3)).options;
  assert.ok(fieldOptions.some((o) => o.kind === "CARRY"), "an outfield player can take it himself");
});

// ---------------------------------------------------------------------------
// 3. The race -- do not delete
// ---------------------------------------------------------------------------

test("the break is a race, not a script: numerical advantage changes the decision", () => {
  const base = keeperRegain().handball;
  const goal = { x: 10, y: 40 };
  const runner = attackersOf(base)[0];
  // A runner 14m out with the defence stranded 30m behind him is away.
  const away = withPositions(base, {
    [runner.id]: { x: 10, y: 26 },
    ...Object.fromEntries(defendersOf(base).map((d, i) => [d.id, { x: 4 + i * 2.4, y: 4 }])),
  });
  const awayPerception = perceiveTransition({ ...away, ball: { ...away.ball, possessorId: runner.id, position: { ...playerById(away, runner.id).position }, status: "POSSESSED", flight: null } }, "BOTTOM");
  const awayMargin = breakMarginSeconds(awayPerception, playerById(away, runner.id));
  assert.ok(awayMargin > 2, `he wins that race comfortably (+${awayMargin.toFixed(1)}s)`);
  const goingOn = decideBreakAction(awayPerception, playerById(away, runner.id), false);
  assert.ok(goingOn.kind === "CONTINUE" || goingOn.kind === "SHOOT", `so he goes (${goingOn.kind})`);

  // The same runner in the same place, with the defence home in front of the
  // goal instead. Same player, same position, opposite decision.
  const covered = withPositions(base, {
    [runner.id]: { x: 10, y: 26 },
    ...Object.fromEntries(defendersOf(base).map((d, i) => [d.id, { x: 5 + i * 2, y: 33 }])),
  });
  const coveredPerception = perceiveTransition({ ...covered, ball: { ...covered.ball, possessorId: runner.id, position: { ...playerById(covered, runner.id).position }, status: "POSSESSED", flight: null } }, "BOTTOM");
  const coveredMargin = breakMarginSeconds(coveredPerception, playerById(covered, runner.id));
  assert.ok(coveredMargin < 0, `now the defence gets there first (${coveredMargin.toFixed(1)}s)`);
  const slowing = decideBreakAction(coveredPerception, playerById(covered, runner.id), false);
  assert.equal(slowing.kind, "SLOW_DOWN", "so he slows the break down instead of forcing it");
  assert.notEqual(slowing.kind, goingOn.kind, "the same player in the same spot decides differently on the state around him");
  assert.ok(distanceBetween(playerById(away, runner.id).position, goal) === distanceBetween(playerById(covered, runner.id).position, goal), "identical distance to goal -- only the defence differs");
});

test("a recovered defence forces early offense rather than a manufactured shot", () => {
  const base = keeperRegain().handball;
  const runner = attackersOf(base)[0];
  const state = withPositions(base, {
    [runner.id]: { x: 10, y: 24 },
    ...Object.fromEntries(defendersOf(base).map((d, i) => [d.id, { x: 5 + i * 2, y: 33 }])),
  });
  const perception = perceiveTransition({ ...state, ball: { ...state.ball, possessorId: runner.id, position: { ...playerById(state, runner.id).position }, status: "POSSESSED", flight: null } }, "BOTTOM");
  // Explicitly recovered: the decision is SLOW_DOWN whatever the race says.
  const decision = decideBreakAction(perception, playerById(state, runner.id), true);
  assert.equal(decision.kind, "SLOW_DOWN");
  assert.ok(decision.detail.includes("set goal-side"), "and it says why");
  // ...and a whole transition from that state ends in an organized attack.
  const settled = simulateTransition({
    seed: 5,
    initialState: {
      handball: { ...state, ball: { ...state.ball, possessorId: runner.id, position: { ...playerById(state, runner.id).position }, status: "POSSESSED", flight: null } },
      possession: { attackingTeam: "ATTACK", attackingGoalSide: "BOTTOM", phase: "POSSESSION_CHANGE", outcome: null },
    },
  });
  assert.equal(settled.outcome, "ORGANIZED_ATTACK_REACHED", "the break becomes a positional attack");
  assert.equal(settled.shotOrigin, null, "no shot was invented to end it");
  assert.ok(settled.trace.some((t) => t.note.includes("the break slows")), "the slowdown is traced");
  assert.ok(settled.trace.some((t) => t.note.includes("settles into an organized shape")));
});

// ---------------------------------------------------------------------------
// 4. Defensive retreat priorities
// ---------------------------------------------------------------------------

test("the retreat gives defenders different jobs and keeps a defendable structure", () => {
  const state = keeperRegain().handball;
  const perception = perceiveTransition(state, "BOTTOM");
  const retreat = assignRetreatRoles(perception);
  assert.equal(retreat.length, defendersOf(state).length, "every retreating defender has a job");
  const roles = retreat.map((r) => r.role);
  assert.equal(roles.filter((r) => r === "CENTRE_PROTECTOR").length, 1, "exactly one man protects the middle");
  assert.ok(roles.filter((r) => r === "BALL_STOPPER").length <= 1, "at most one goes to the ball");
  assert.ok(roles.filter((r) => r === "PICK_UP_RUNNER").length >= 2, "the rest pick up runners");
  // Nobody is marked twice, and the marks are real players.
  const marks = retreat.map((r) => r.marksPlayerId).filter((id): id is string => id !== null);
  assert.equal(new Set(marks).size, marks.length, "no runner is picked up by two defenders");

  // The targets are not one coordinate: they do not all chase the ball.
  const targets = retreat.map((r) => retreatTargetFor(r, playerById(state, r.defenderId), perception, state));
  const xs = targets.map((t) => t.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 6, `the retreat spreads across the court (${(Math.max(...xs) - Math.min(...xs)).toFixed(1)}m)`);
  const ball = state.ball.position;
  assert.ok(targets.filter((t) => distanceBetween(t, ball) < 5).length <= 1, "at most one man is running at the ball");
  // The centre protector really does hold the middle in front of his own goal.
  const protector = retreat.find((r) => r.role === "CENTRE_PROTECTOR")!;
  const protectTarget = retreatTargetFor(protector, playerById(state, protector.defenderId), perception, state);
  assert.ok(Math.abs(protectTarget.x - 10) < 0.01, "in the centre");
  assert.ok(Math.abs(protectTarget.y - depthInFrontOf("BOTTOM", TRANSITION_LIMITS.centreProtectDepthMeters)) < 0.01, "in front of the goal he defends");
});

test("the man who picks up a runner goes goal-side of that runner, wherever he is", () => {
  const base = keeperRegain().handball;
  const runner = attackersOf(base)[0];
  const state = withPositions(base, { [runner.id]: { x: 17, y: 28 } });
  const perception = perceiveTransition(state, "BOTTOM");
  const retreat = assignRetreatRoles(perception);
  const marker = retreat.find((r) => r.marksPlayerId === runner.id);
  assert.ok(marker, "the man furthest up the court is picked up");
  const target = retreatTargetFor(marker!, playerById(state, marker!.defenderId), perception, state);
  const runnerPosition = playerById(state, runner.id).position;
  assert.ok(target.y > runnerPosition.y, "goal-side of him, between him and the goal");
  assert.ok(Math.abs(target.x - runnerPosition.x) < 2, "and in his lane, not in the middle");
});

// ---------------------------------------------------------------------------
// 5. Whole transitions
// ---------------------------------------------------------------------------

test("a transition can finish, and only when the advantage is real", () => {
  // Scanned rather than pinned: the property is what matters.
  let shots = 0;
  let settled = 0;
  for (let seed = 1; seed <= 200; seed += 1) {
    const sequence = simulateSequence({ seed, initialState: TOP });
    const transition = sequence.transition;
    if (!transition) continue;
    if (transition.shotOrigin) {
      shots += 1;
      // Every break shot was taken in range, and the trace says he was clear.
      assert.ok(distanceBetween(transition.shotOrigin, { x: 10, y: 40 }) <= BREAK_SHOT_RANGE_METERS + 0.5 || distanceBetween(transition.shotOrigin, { x: 10, y: 0 }) <= BREAK_SHOT_RANGE_METERS + 0.5);
      assert.ok(transition.trace.some((t) => t.note.includes("breaks clear")), "a break shot is explained by the clearance that earned it");
    }
    if (transition.outcome === "ORGANIZED_ATTACK_REACHED") settled += 1;
    assert.equal(transition.guardTripped, false, `seed ${seed} needed the guard`);
  }
  assert.ok(shots > 0, "breaks do get finished");
  assert.ok(settled > 0, "and breaks do get shut down");
});

test("the second wave exists: a supporting runner can be found behind the break", () => {
  let witnessed: string | null = null;
  for (let seed = 1; seed <= 120 && witnessed === null; seed += 1) {
    const sequence = simulateSequence({ seed, initialState: TOP });
    const entry = sequence.transition?.trace.find((t) => t.note.includes("second wave:"));
    if (entry) witnessed = entry.note;
  }
  assert.ok(witnessed, "a second-wave ball was played behind a stalled first wave");
  assert.ok(witnessed!.includes("arriving behind the break"));
});

test("an outlet into a covered lane can be intercepted, through the same pass model an attack uses", () => {
  let witnessed = false;
  for (let seed = 1; seed <= 200 && !witnessed; seed += 1) {
    const sequence = simulateSequence({ seed, initialState: TOP });
    witnessed = sequence.transition?.trace.some((t) => t.note.includes("intercepts")) ?? false;
  }
  assert.ok(witnessed, "a transition pass was read and intercepted by a real defender");
});

test("transitions keep their width: the break is not a single file through the middle", () => {
  const widths: number[] = [];
  for (let seed = 1; seed <= 60; seed += 1) {
    const sequence = simulateSequence({ seed, initialState: TOP });
    const transition = sequence.transition;
    if (!transition) continue;
    const attackerIds = new Set(attackersOf(transition.finalState.handball).map((p) => p.id));
    for (const entry of transition.trace) {
      const xs = entry.playerPositions.filter((p) => attackerIds.has(p.playerId)).map((p) => p.position.x);
      if (xs.length >= 4) widths.push(Math.max(...xs) - Math.min(...xs));
    }
  }
  assert.ok(widths.length > 50, "enough transition frames to judge");
  const mean = widths.reduce((a, b) => a + b, 0) / widths.length;
  const narrow = widths.filter((w) => w < 8).length / widths.length;
  assert.ok(mean > 11, `the breaking team stays spread across the court (mean ${mean.toFixed(1)}m)`);
  assert.ok(narrow < 0.1, `${(narrow * 100).toFixed(1)}% of frames are narrower than 8m`);
});

// ---------------------------------------------------------------------------
// 6. Determinism and continuity
// ---------------------------------------------------------------------------

test("the same state and seed produce an identical transition", () => {
  const a = simulateTransition({ seed: 42, initialState: keeperRegain() });
  const b = simulateTransition({ seed: 42, initialState: keeperRegain() });
  assert.equal(b.outcome, a.outcome);
  assert.equal(b.steps, a.steps);
  assert.deepEqual(b.trace, a.trace, "byte-for-byte identical transition");
  // The decisions themselves are pure: asked twice, they answer the same.
  const state = keeperRegain().handball;
  const perception = perceiveTransition(state, "BOTTOM");
  assert.deepEqual(assignRunningRoles(perception), assignRunningRoles(perception));
  assert.deepEqual(assignRetreatRoles(perception), assignRetreatRoles(perception));
  assert.deepEqual(
    decideOutlet(perception, playerById(state, state.ball.possessorId!), createPossessionRng(9)),
    decideOutlet(perception, playerById(state, state.ball.possessorId!), createPossessionRng(9)),
  );
});

test("different seeds diverge, and no defender is ever teleported", () => {
  const outcomes = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const result = simulateTransition({ seed, initialState: keeperRegain() });
    outcomes.add(result.outcome);
    // Nobody moves further in one step than his own top speed allows.
    for (let i = 1; i < result.trace.length; i += 1) {
      const dt = result.trace[i].simulationTime - result.trace[i - 1].simulationTime;
      if (dt <= 0) continue;
      for (const now of result.trace[i].playerPositions) {
        const before = result.trace[i - 1].playerPositions.find((p) => p.playerId === now.playerId);
        if (!before) continue;
        const player = result.finalState.handball.players.find((p) => p.id === now.playerId)!;
        assert.ok(
          distanceBetween(before.position, now.position) <= player.movementProfile.maxSpeed * dt + 1e-6,
          `${now.playerId} moved further than he can run`,
        );
      }
    }
  }
  assert.ok(outcomes.size >= 2, `seeds diverge into different transitions (${[...outcomes].join(", ")})`);
});

test("the regain read is recorded, so a transition can be explained", () => {
  const result = simulateTransition({ seed: 11, initialState: keeperRegain() });
  const notes = result.trace.map((t) => t.note);
  assert.ok(notes.some((n) => n.startsWith("regain read:")), "the numbers at the regain");
  assert.ok(notes.some((n) => n.startsWith("attack: first wave")), "who runs where");
  assert.ok(notes.some((n) => n.startsWith("retreat:") && n.includes("protects the middle")), "and what each defender is doing");
  // A possession that keeps the ball never enters any of this.
  const kept = simulatePossession({ seed: 2, initialState: TOP });
  assert.ok(kept.outcome === "SHOT_GOAL" || kept.outcome === "SHOT_MISSED");
  assert.equal(simulateSequence({ seed: 2, initialState: TOP }).transition, null);
});
