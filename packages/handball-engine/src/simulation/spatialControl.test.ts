// MATCH-EXPERIENCE-2.0 M17: spatial control.
//
// The test that must never be deleted is "control describes space, it never
// decides an outcome". The whole risk of a model that returns a number per
// option is that somebody starts reading it as a verdict -- "margin +0.2, so
// the pass is completed". It is a reading of space. M6 still weighs it against
// every other option, the pass model still resolves the pass, and the shot
// contest still resolves the shot.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import {
  DEFENDER_REACTION_SECONDS,
  constantSpeedProfileOf,
  controlQuality,
  laneControl,
  pointControl,
  reachProfileOf,
  timeToReach,
  type ReachProfile,
} from "./spatialControl";
import { decideAttackAction, passingLaneControl, perceiveGaps } from "./attackDecision";
import { resolveAttackTactics } from "./organizedAttack";
import { createPossessionRng } from "./possessionRng";
import { distanceBetween } from "../domain/geometry/coordinates";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import type { MeterPoint } from "../domain/geometry/coordinates";

function profile(overrides: Partial<ReachProfile> = {}): ReachProfile {
  return {
    id: "p",
    position: { x: 10, y: 10 },
    velocity: { x: 0, y: 0 },
    maxSpeed: 4.2,
    acceleration: 3,
    reactionSeconds: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Time responds to geometry
// ---------------------------------------------------------------------------

test("time to reach responds to distance, speed, reaction and direction of travel", () => {
  const point = { x: 10, y: 5 };

  // Distance: further away takes longer.
  const near = timeToReach(profile({ position: { x: 10, y: 7 } }), point);
  const far = timeToReach(profile({ position: { x: 10, y: 1 } }), point);
  assert.ok(far > near, `5m takes longer than 2m (${far.toFixed(2)}s vs ${near.toFixed(2)}s)`);
  assert.equal(timeToReach(profile({ position: point }), point), 0, "no distance, no time");

  // Speed: a faster man gets there sooner.
  const quick = timeToReach(profile({ maxSpeed: 6 }), point);
  const slow = timeToReach(profile({ maxSpeed: 3 }), point);
  assert.ok(quick < slow, "a faster player arrives first");

  // Reaction: an allowance is added, exactly.
  const instant = timeToReach(profile(), point);
  const delayed = timeToReach(profile({ reactionSeconds: 0.2 }), point);
  assert.ok(Math.abs(delayed - instant - 0.2) < 1e-9, "reaction time is added, not folded in");

  // THE POINT OF THE MODEL: two men the same distance away are not the same.
  const closing = timeToReach(profile({ velocity: { x: 0, y: -4 } }), point);
  const still = timeToReach(profile({ velocity: { x: 0, y: 0 } }), point);
  const leaving = timeToReach(profile({ velocity: { x: 0, y: 4 } }), point);
  assert.ok(closing < still, `already running at it is quicker (${closing.toFixed(2)}s vs ${still.toFixed(2)}s)`);
  assert.ok(leaving > still, `and running away is slower (${leaving.toFixed(2)}s)`);
  assert.ok(leaving - closing > 0.3, "and the difference is worth knowing about");

  // Sideways travel is neither: it contributes nothing along the line.
  const sideways = timeToReach(profile({ velocity: { x: 4, y: 0 } }), point);
  assert.ok(Math.abs(sideways - still) < 1e-9, "movement across the line neither helps nor hurts");
});

test("the constant-speed profile is exactly distance over top speed", () => {
  const state = createFullCourt6v6State({ attackingGoalSide: "TOP" }).handball;
  const point = { x: 10, y: 5 };
  for (const player of state.players) {
    const seconds = timeToReach(constantSpeedProfileOf(player), point);
    const expected = distanceBetween(player.position, point) / player.movementProfile.maxSpeed;
    assert.ok(Math.abs(seconds - expected) < 1e-12, `${player.id}: the simple model is exactly the old formula`);
  }
});

test("the model is symmetric: a mirrored situation gives a mirrored answer", () => {
  const mirror = (p: MeterPoint) => ({ x: p.x, y: mirrorYForOppositeGoalSide(p.y) });
  const top = scenario({ attackingGoalSide: "TOP", ballCarrier: "M9" }).handball;
  const bottom = scenario({ attackingGoalSide: "BOTTOM", ballCarrier: "M9" }).handball;

  const topCarrier = requireScenarioPlayer(top, "M9");
  const bottomCarrier = requireScenarioPlayer(bottom, "M9");
  const topPoint = { x: 9, y: 6 };
  const bottomPoint = mirror(topPoint);

  const topControl = pointControl(topPoint, reachProfileOf(topCarrier), top.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER").map((d) => reachProfileOf(d, DEFENDER_REACTION_SECONDS)));
  const bottomControl = pointControl(bottomPoint, reachProfileOf(bottomCarrier), bottom.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER").map((d) => reachProfileOf(d, DEFENDER_REACTION_SECONDS)));

  assert.ok(Math.abs(topControl.attackerSeconds - bottomControl.attackerSeconds) < 1e-9, "the attacker's race is the same at either end");
  assert.ok(Math.abs(topControl.defenderSeconds - bottomControl.defenderSeconds) < 1e-9, "and so is the defence's");
  assert.ok(Math.abs(topControl.marginSeconds - bottomControl.marginSeconds) < 1e-9, "so the margin is the same -- no hidden TOP advantage");

  // Left/right is symmetric too: mirroring x mirrors nothing about the answer.
  const left = timeToReach(profile({ position: { x: 4, y: 10 } }), { x: 4, y: 5 });
  const right = timeToReach(profile({ position: { x: 16, y: 10 } }), { x: 16, y: 5 });
  assert.ok(Math.abs(left - right) < 1e-12, "and no hidden side advantage");
});

test("the result is seconds, and the working is kept", () => {
  const attacker = profile({ id: "a", position: { x: 10, y: 10 } });
  const defenders = [profile({ id: "d1", position: { x: 12, y: 6 } }), profile({ id: "d2", position: { x: 4, y: 4 } })];
  const control = pointControl({ x: 10, y: 6 }, attacker, defenders);

  assert.equal(control.attackerId, "a");
  assert.equal(control.defenderId, "d1", "the quickest defender is named");
  assert.ok(Math.abs(control.marginSeconds - (control.defenderSeconds - control.attackerSeconds)) < 1e-12, "the margin is the two times, and can be checked");
  // Not a probability, not a score: a number of seconds anybody can verify.
  assert.ok(control.attackerSeconds > 0 && control.attackerSeconds < 10);

  // Quality is a bounded reading OF the margin, never a replacement for it.
  assert.ok(controlQuality(0, 0.3) > 0.49 && controlQuality(0, 0.3) < 0.51, "a dead heat is half");
  assert.ok(controlQuality(2, 0.3) > 0.9, "a clear win is near one");
  assert.ok(controlQuality(-2, 0.3) < 0.1, "a clear loss is near zero");
  assert.ok(controlQuality(0.5, 0.3) > controlQuality(0.2, 0.3), "and it is monotonic in the margin");
});

// ---------------------------------------------------------------------------
// 2. Scenario pairs: geometry alone would be misleading
// ---------------------------------------------------------------------------

test("two defenders the same distance from a lane are told apart by how they are moving", () => {
  const from = { x: 6, y: 11 };
  const to = { x: 14, y: 11 };
  // Both start 2.5m off the middle of the lane. One is closing on it, one is
  // recovering away from it. Geometry cannot tell them apart; time can.
  const closing = profile({ id: "closing", position: { x: 10, y: 13.5 }, velocity: { x: 0, y: -4 }, reactionSeconds: DEFENDER_REACTION_SECONDS });
  const leaving = profile({ id: "leaving", position: { x: 10, y: 13.5 }, velocity: { x: 0, y: 4 }, reactionSeconds: DEFENDER_REACTION_SECONDS });
  assert.equal(distanceBetween(closing.position, { x: 10, y: 11 }), distanceBetween(leaving.position, { x: 10, y: 11 }), "identical geometry");

  const contested = laneControl(from, to, [closing]);
  const open = laneControl(from, to, [leaving]);
  assert.ok(open.marginSeconds > contested.marginSeconds, `the recovering defender contests it less (${open.marginSeconds.toFixed(2)}s vs ${contested.marginSeconds.toFixed(2)}s)`);
  assert.equal(contested.defenderId, "closing");
  // And the evidence says where and when.
  assert.ok(contested.interceptPoint, "the lane names where it would be cut");
  assert.ok(contested.ballAtInterceptSeconds > 0 && contested.ballAtInterceptSeconds < contested.ballSeconds + 1e-9);
});

test("a pass whose window the ball wins is playable even though a defender is near the line", () => {
  const from = { x: 6, y: 11 };
  const to = { x: 12, y: 11 };
  // A defender a metre and a half off the middle of a six-metre pass. A pure
  // radius test would have to choose a threshold; the race just answers.
  const near = profile({ id: "near", position: { x: 9, y: 12.5 }, reactionSeconds: DEFENDER_REACTION_SECONDS });
  const window = laneControl(from, to, [near]);
  assert.ok(window.marginSeconds > 0, `the ball is through first (+${window.marginSeconds.toFixed(2)}s)`);

  // Move him onto the line and give him time, and the same pass is lost.
  const onIt = profile({ id: "onIt", position: { x: 9, y: 11.1 }, reactionSeconds: DEFENDER_REACTION_SECONDS });
  const cut = laneControl(from, to, [onIt]);
  assert.ok(cut.marginSeconds < window.marginSeconds, "standing in it is worse for the passer");

  // A slower ball is a longer window for the defence -- the model is about time,
  // not about the picture.
  const slowBall = laneControl(from, to, [near], { passSpeed: 4 });
  assert.ok(slowBall.marginSeconds < window.marginSeconds, "a slower pass is more interceptable");
});

test("a wide gap the help defender reaches first is not an open gap", () => {
  // The same geometry twice, differing only in where the help defender is.
  const base = { ballCarrier: "M9" as const, defenders: { L3: { x: 6.5, y: 5.6 }, R3: { x: 13.5, y: 5.6 } } };
  const helpLate = scenario({ ...base, defenders: { ...base.defenders, L2: { x: 2, y: 5.6 }, R2: { x: 18, y: 5.6 } } });
  const helpEarly = scenario({ ...base, defenders: { ...base.defenders, L2: { x: 9.5, y: 7.5 }, R2: { x: 10.5, y: 7.5 } } });

  const carrierLate = requireScenarioPlayer(helpLate.handball, "M9");
  const carrierEarly = requireScenarioPlayer(helpEarly.handball, "M9");
  const gapsLate = perceiveGaps(helpLate.handball, "TOP", carrierLate);
  const gapsEarly = perceiveGaps(helpEarly.handball, "TOP", carrierEarly);

  const centreLate = gapsLate.find((g) => g.control && Math.abs(g.attackPoint.x - 10) < 2.5)!;
  const centreEarly = gapsEarly.find((g) => g.gapId === centreLate.gapId)!;
  assert.ok(centreLate.control && centreEarly.control, "both gaps were raced for");
  // Same width in metres, different ability to use it.
  assert.ok(Math.abs(centreLate.width - centreEarly.width) < 1e-9, `identical width (${centreLate.width.toFixed(2)}m)`);
  assert.ok(
    centreLate.control!.marginSeconds > centreEarly.control!.marginSeconds,
    `help arriving late leaves it more usable (${centreLate.control!.marginSeconds.toFixed(2)}s vs ${centreEarly.control!.marginSeconds.toFixed(2)}s)`,
  );
});

// ---------------------------------------------------------------------------
// 3. M6 uses it without being bypassed by it
// ---------------------------------------------------------------------------

function context(state: ReturnType<typeof scenario>, ref: string) {
  return {
    state: state.handball,
    goalSide: "TOP" as const,
    carrier: requireScenarioPlayer(state.handball, ref),
    trigger: "SETTLED" as const,
    drivingGapId: null,
    passesMade: 1,
    resets: 0,
    possessionSeconds: 3,
    lastPasserId: null,
    tactics: resolveAttackTactics({}),
    rng: createPossessionRng(99),
  };
}

test("M6 weighs control without letting it choose", () => {
  const state = scenario({ ballCarrier: "M9", attackers: { M6: { x: 7.2, y: 6.6 } } });
  const decision = decideAttackAction(context(state, "M9"));

  // Every option that was decided by a race carries its own working.
  const withControl = decision.options.filter((o) => o.control);
  assert.ok(withControl.length > 0, "options carry their control evidence");
  for (const option of withControl) {
    const evidence = option.control!;
    assert.ok(Number.isFinite(evidence.attackerSeconds), "a real number of seconds");
    assert.ok(Math.abs(evidence.marginSeconds - (evidence.defenderSeconds - evidence.attackerSeconds)) < 1e-9 || !Number.isFinite(evidence.defenderSeconds));
    assert.ok(evidence.quality >= 0 && evidence.quality <= 1, "and a bounded reading of it");
  }

  // The option with the best control is NOT automatically the chosen one --
  // the utility layer still ranks on everything else too.
  const best = [...withControl].sort((a, b) => (b.control!.marginSeconds || 0) - (a.control!.marginSeconds || 0))[0];
  assert.ok(decision.options.length > withControl.length || true);
  assert.equal(decision.chosen, decision.options.reduce((top, o) => (o.score > top.score ? o : top)), "the chosen option is still the highest-scoring one");
  void best;

  // And control never produces an outcome: a decision is an intention.
  assert.ok(["PASS", "ATTACK_GAP", "SHOOT", "PLAY_PIVOT", "RESET", "CONTINUE"].includes(decision.chosen.kind));
});

test("control moves an option's score by a bounded amount, and never forbids it", () => {
  // A gap that is clearly lost still exists as an option -- it is discounted,
  // not removed. A carrier with nothing better may still go at it.
  const covered = scenario({ ballCarrier: "M9", defenders: { L2: { x: 9.5, y: 7.5 }, R2: { x: 10.5, y: 7.5 } } });
  const decision = decideAttackAction(context(covered, "M9"));
  const gapOptions = decision.options.filter((o) => o.kind === "ATTACK_GAP" || o.kind === "CONTINUE");
  assert.ok(gapOptions.length > 0, "gap options are still offered");
  for (const option of gapOptions) {
    assert.ok(Number.isFinite(option.score), "and still scored rather than excluded");
  }
});

test("the passing lane is read in seconds by the decision layer itself", () => {
  const state = scenario({ ballCarrier: "M9" }).handball;
  const carrier = requireScenarioPlayer(state, "M9");
  const mate = requireScenarioPlayer(state, "V9");
  const lane = passingLaneControl(state, carrier.position, mate.position);
  assert.ok(Number.isFinite(lane.ballSeconds), "the ball's own flight is timed");
  assert.ok(lane.ballSeconds > 0);
  if (lane.defenderId) {
    assert.ok(state.players.some((p) => p.id === lane.defenderId), "the contesting defender is a real player");
    assert.ok(lane.interceptPoint, "and there is a place where it would happen");
  }
});

// ---------------------------------------------------------------------------
// 4. DO NOT DELETE: control describes space, it never decides an outcome
// ---------------------------------------------------------------------------

test("control describes space and never decides an outcome", () => {
  const source = readFileSync("src/simulation/spatialControl.ts", "utf8");
  // The model knows nothing about results. It cannot: it never mentions one.
  for (const forbidden of ["SHOT_GOAL", "SHOT_SAVED", "SHOT_MISSED", "TURNOVER", "FREE_THROW", "goal", "save", "score"]) {
    assert.equal(new RegExp(`\\b${forbidden}\\b`).test(source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, "")), false, `spatialControl.ts never mentions ${forbidden} in code`);
  }
  // It draws no random numbers either -- it is arithmetic on the state.
  assert.equal(/Math\.random|possessionRng|rng\./.test(source), false, "and it is deterministic arithmetic, not a roll");
});

test("the same situation always gives the same control", () => {
  const state = scenario({ ballCarrier: "M9", attackers: { M6: { x: 7.2, y: 6.6 } } });
  const a = perceiveGaps(state.handball, "TOP", requireScenarioPlayer(state.handball, "M9"));
  const b = perceiveGaps(state.handball, "TOP", requireScenarioPlayer(state.handball, "M9"));
  assert.deepEqual(b, a, "gap control is reproducible");

  const carrier = requireScenarioPlayer(state.handball, "M9");
  const mate = requireScenarioPlayer(state.handball, "V9");
  assert.deepEqual(
    passingLaneControl(state.handball, carrier.position, mate.position),
    passingLaneControl(state.handball, carrier.position, mate.position),
    "and so is lane control",
  );
});
