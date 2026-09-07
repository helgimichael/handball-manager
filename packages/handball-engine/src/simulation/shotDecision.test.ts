// MATCH-EXPERIENCE-2.0 M9: shooting and goalkeeper intelligence.
//
// The test that must never be deleted is "the outcome comes from the contest,
// not from a roll": M9's whole claim is that a shot is aimed at a point and
// beaten past a keeper who tried to reach it. A change that went back to
// drawing a save probability would satisfy most of the rest of this file and
// put the old "roll goal/save, then display it" model back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulatePossession, resolveShot } from "./possessionEngine";
import { createPossessionRng } from "./possessionRng";
import { SHOT_INTENTIONS, decideShot, executionSpreadMeters, perceiveShot } from "./shotDecision";
import {
  GOALKEEPER_LIMITS,
  attemptSave,
  goalWindowFrom,
  goalkeeperSetPosition,
  readShot,
  reactionDelaySeconds,
} from "../policies/goalkeeper/goalkeeperPolicy";
import { GOAL_POST_LEFT_X, GOAL_POST_RIGHT_X } from "../domain/geometry/court";
import { distanceBetween, type MeterPoint } from "../domain/geometry/coordinates";
import type { Player } from "../domain/handball/player";
import type { HandballState } from "../domain/handball/state";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const BASE = TOP.handball;
const SHOOTER_ID = "attack-attack-6-3";
const KEEPER_ID = "defense-defence-6-0-goalkeeper";

function playerById(state: HandballState, id: string): Player {
  const player = state.players.find((p) => p.id === id);
  if (!player) throw new Error(`no player ${id}`);
  return player;
}

/**
 * A shooting situation: the shooter stands where asked, the keeper is set for
 * the ball being there, and everybody else is pushed out of the way unless the
 * test wants them.
 */
function situation(shooterAt: MeterPoint, options: { keeperAt?: MeterPoint; defendersAt?: Record<string, MeterPoint>; clearDefenders?: boolean } = {}): HandballState {
  const keeperAt = options.keeperAt ?? goalkeeperSetPosition(shooterAt, "TOP");
  let farIndex = 0;
  const players = BASE.players.map((p) => {
    if (p.id === SHOOTER_ID) return { ...p, position: { ...shooterAt } };
    if (p.id === KEEPER_ID) return { ...p, position: { ...keeperAt } };
    if (options.defendersAt?.[p.id]) return { ...p, position: { ...options.defendersAt[p.id] } };
    if (options.clearDefenders !== false && p.team === "DEFENSE" && p.kind === "FIELD_PLAYER") {
      // Parked out of the way, so only the geometry under test matters.
      farIndex += 1;
      return { ...p, position: { x: 2 + farIndex, y: 30 } };
    }
    return p;
  });
  return {
    ...BASE,
    players,
    ball: { position: { ...shooterAt }, possessorId: SHOOTER_ID, status: "POSSESSED", flight: null },
  };
}

function shoot(state: HandballState, seed: number, ratings?: Parameters<typeof resolveShot>[4]) {
  return resolveShot(state, playerById(state, SHOOTER_ID), "TOP", createPossessionRng(seed), ratings);
}

// ---------------------------------------------------------------------------
// 1. Different geometry, different shot
// ---------------------------------------------------------------------------

test("different shot geometry creates different shot decisions", () => {
  const geometries: { label: string; at: MeterPoint }[] = [
    { label: "backcourt 10m", at: { x: 10, y: 10 } },
    { label: "left wing", at: { x: 1.5, y: 5 } },
    { label: "right wing", at: { x: 18.5, y: 5 } },
    { label: "breakthrough 3m", at: { x: 10, y: 3 } },
  ];
  const decisions = geometries.map(({ label, at }) => {
    const state = situation(at);
    const perception = perceiveShot(state, playerById(state, SHOOTER_ID), "TOP");
    return { label, at, perception, decision: decideShot(perception, createPossessionRng(11)) };
  });

  // Every one of them aims at a real point between the posts.
  for (const { label, decision } of decisions) {
    assert.ok(SHOT_INTENTIONS.includes(decision.intention), `${label} chose a supported intention`);
    assert.ok(decision.targetX >= GOAL_POST_LEFT_X - 0.1 && decision.targetX <= GOAL_POST_RIGHT_X + 0.1, `${label} aims into the goal`);
  }
  // The wings mirror each other: the same shot, the other way round.
  const [, leftWing, rightWing] = decisions;
  assert.ok(Math.abs((leftWing.decision.targetX - 10) + (rightWing.decision.targetX - 10)) < 0.6, "the two wings' targets mirror about the goal centre");
  // A wing has far less goal to aim at than a central back.
  const [backcourt] = decisions;
  const openFrom = (d: (typeof decisions)[number]) => d.perception.window.nearWindow.width + d.perception.window.farWindow.width;
  assert.ok(openFrom(backcourt) > openFrom(leftWing) + 0.3, `a central back sees more goal (${openFrom(backcourt).toFixed(2)}m) than a wing (${openFrom(leftWing).toFixed(2)}m)`);
  // And the keeper's own body covers far more of the goal in a breakthrough.
  const breakthrough = decisions[3];
  assert.ok(breakthrough.perception.window.shadowHalfWidth > backcourt.perception.window.shadowHalfWidth + 0.2, "coming out makes him bigger");
  assert.ok(breakthrough.perception.keeperAdvance > backcourt.perception.keeperAdvance + 0.5, "and he really has come out");
});

test("the placement a shooter can hold gets harder from further out, from a tighter angle and under pressure", () => {
  const open = situation({ x: 10, y: 8 });
  const far = situation({ x: 10, y: 13 });
  const wide = situation({ x: 2, y: 5 });
  const pressured = situation({ x: 10, y: 8 }, { defendersAt: { "defense-defence-6-0-3": { x: 10, y: 8.8 } } });
  const spread = (state: HandballState) =>
    executionSpreadMeters(perceiveShot(state, playerById(state, SHOOTER_ID), "TOP"), "NEAR_LOW", 10);
  assert.ok(spread(far) > spread(open), "a longer shot strays further");
  assert.ok(spread(wide) > spread(open), "so does a tighter angle");
  assert.ok(spread(pressured) > spread(open), "and so does a defender in his face");
  // Ability tightens it.
  assert.ok(
    executionSpreadMeters(perceiveShot(open, playerById(open, SHOOTER_ID), "TOP"), "NEAR_LOW", 18) <
      executionSpreadMeters(perceiveShot(open, playerById(open, SHOOTER_ID), "TOP"), "NEAR_LOW", 3),
    "a better shooter places it better",
  );
});

// ---------------------------------------------------------------------------
// 2. The goalkeeper is a spatial player
// ---------------------------------------------------------------------------

test("the goalkeeper's starting position matters to the shot and to the result", () => {
  const shooterAt = { x: 10, y: 8 };
  const onHisLine = situation(shooterAt, { keeperAt: { x: 10, y: 0.3 } });
  const wellOut = situation(shooterAt, { keeperAt: { x: 10, y: 2.2 } });
  const outOfPosition = situation(shooterAt, { keeperAt: { x: 8.6, y: 0.5 } });

  const window = (s: HandballState) => perceiveShot(s, playerById(s, SHOOTER_ID), "TOP").window;
  assert.ok(window(wellOut).shadowHalfWidth > window(onHisLine).shadowHalfWidth, "coming off his line covers more of the goal");
  const badly = window(outOfPosition);
  assert.ok(Math.abs(badly.nearWindow.width - badly.farWindow.width) > 0.5, "a keeper off to one side leaves an obvious gap");

  // Same shooter, same seed: only the keeper's position differs, and the shot
  // he is offered differs with it.
  const a = shoot(onHisLine, 4).resolution;
  const b = shoot(outOfPosition, 4).resolution;
  assert.notEqual(a.decision.targetX.toFixed(2), b.decision.targetX.toFixed(2), "he aims somewhere else");
});

test("the goalkeeper moves with the ball and comes further out the closer it is", () => {
  const far = goalkeeperSetPosition({ x: 10, y: 12 }, "TOP");
  const close = goalkeeperSetPosition({ x: 10, y: 3 }, "TOP");
  assert.ok(close.y > far.y, "he advances against a close shot");
  assert.ok(close.y <= GOALKEEPER_LIMITS.maxAdvanceMeters, "but never leaves his area");
  const left = goalkeeperSetPosition({ x: 2, y: 6 }, "TOP");
  const right = goalkeeperSetPosition({ x: 18, y: 6 }, "TOP");
  assert.ok(left.x < 10 && right.x > 10, "he covers the side the ball is on");
  assert.ok(Math.abs(left.x - 10) < 1.6 && Math.abs(right.x - 10) < 1.6, "without following it out to the wing");
  // At the other goal he does the mirror of all of it.
  const bottom = goalkeeperSetPosition({ x: 10, y: 40 - 3 }, "BOTTOM");
  assert.ok(Math.abs((40 - bottom.y) - close.y) < 1e-9, "the BOTTOM goal is the same keeper, mirrored");
});

test("goalkeeper ability matters: reach, reaction and how often he reads it right", () => {
  const at = { x: 10, y: 8 };
  const state = situation(at);
  const window = goalWindowFrom(at, playerById(state, KEEPER_ID).position, "TOP");
  const arrival = { x: 9.6, y: 0.5 };
  const read = readShot(window, 8, KEEPER_ID, createPossessionRng(3));

  const weak = attemptSave(10.8, 0.4, "LOW", arrival, 0.5, read, KEEPER_ID, { [KEEPER_ID]: { shotStopping: 2 } });
  const strong = attemptSave(10.8, 0.4, "LOW", arrival, 0.5, read, KEEPER_ID, { [KEEPER_ID]: { shotStopping: 20 } });
  assert.ok(strong.reachMeters > weak.reachMeters, "a better keeper reaches further");
  assert.equal(weak.gapMeters, strong.gapMeters, "from the same place -- only the reach differs");

  assert.ok(
    reactionDelaySeconds(KEEPER_ID, { [KEEPER_ID]: { shotStopping: 20 } }) < reactionDelaySeconds(KEEPER_ID, { [KEEPER_ID]: { shotStopping: 2 } }),
    "and he reacts sooner",
  );

  // Over many reads, the better keeper goes the right way more often.
  const rightWay = (rating: number) => {
    let correct = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      if (readShot(window, 8, KEEPER_ID, createPossessionRng(seed), { [KEEPER_ID]: { shotStopping: rating } }).readTheBigWindow) correct += 1;
    }
    return correct;
  };
  assert.ok(rightWay(20) > rightWay(2) + 10, "and reads the shot right more often");
});

// ---------------------------------------------------------------------------
// 3. Defensive influence
// ---------------------------------------------------------------------------

test("defensive pressure changes the shot, and a defender on the line can block it", () => {
  const at = { x: 10, y: 7 };
  const free = situation(at);
  const crowded = situation(at, { defendersAt: { "defense-defence-6-0-3": { x: 10, y: 6.2 }, "defense-defence-6-0-4": { x: 10.6, y: 6.4 } } });
  const freePerception = perceiveShot(free, playerById(free, SHOOTER_ID), "TOP");
  const crowdedPerception = perceiveShot(crowded, playerById(crowded, SHOOTER_ID), "TOP");
  assert.ok(crowdedPerception.pressure > freePerception.pressure + 0.3, "the defenders are felt");
  assert.ok(
    executionSpreadMeters(crowdedPerception, "NEAR_LOW", 10) > executionSpreadMeters(freePerception, "NEAR_LOW", 10),
    "and the shot is harder to place because of them",
  );

  // A body right on the shot line gets something to it.
  let blocked = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    if (shoot(crowded, seed).resolution.blockedByDefenderId) blocked += 1;
  }
  assert.ok(blocked > 0, "a defender standing in the shot blocks some of them");
  let blockedWhenFree = 0;
  for (let seed = 1; seed <= 40; seed += 1) {
    if (shoot(free, seed).resolution.blockedByDefenderId) blockedWhenFree += 1;
  }
  assert.equal(blockedWhenFree, 0, "and nobody blocks a shot they are nowhere near");
});

test("an open close-range shot differs materially from a pressured backcourt shot", () => {
  const open = situation({ x: 10, y: 5 });
  const hard = situation({ x: 4, y: 12 }, { defendersAt: { "defense-defence-6-0-3": { x: 4.4, y: 11.4 } } });
  const tally = (state: HandballState) => {
    const counts = { SHOT_GOAL: 0, SHOT_SAVED: 0, SHOT_MISSED: 0 };
    for (let seed = 1; seed <= 60; seed += 1) counts[shoot(state, seed).resolution.outcome] += 1;
    return counts;
  };
  const openCounts = tally(open);
  const hardCounts = tally(hard);
  assert.ok(openCounts.SHOT_GOAL > hardCounts.SHOT_GOAL, `the open chance scores more often (${openCounts.SHOT_GOAL} vs ${hardCounts.SHOT_GOAL})`);
  assert.ok(hardCounts.SHOT_MISSED > openCounts.SHOT_MISSED, `and the hard one misses the target more (${hardCounts.SHOT_MISSED} vs ${openCounts.SHOT_MISSED})`);
});

// ---------------------------------------------------------------------------
// 4. The contest -- do not delete
// ---------------------------------------------------------------------------

test("the outcome comes from the contest, not from a roll", () => {
  const state = situation({ x: 10, y: 8 });
  for (let seed = 1; seed <= 60; seed += 1) {
    const { resolution } = shoot(state, seed);
    if (resolution.blockedByDefenderId) continue;
    if (resolution.outcome === "SHOT_MISSED") {
      // A miss is a miss because the ball did not cross between the posts.
      const inside = resolution.landing.x >= GOAL_POST_LEFT_X - 0.06 && resolution.landing.x <= GOAL_POST_RIGHT_X + 0.06 && resolution.landing.height <= 2;
      assert.equal(inside, false, `seed ${seed}: a miss landed at x=${resolution.landing.x.toFixed(2)}, ${resolution.landing.height.toFixed(2)}m high`);
      continue;
    }
    // Every goal and every save is the same comparison: the gap he was left
    // with, against the reach he had.
    assert.ok(resolution.contest, `seed ${seed}: an on-target shot was contested`);
    assert.equal(resolution.outcome === "SHOT_SAVED", resolution.contest!.saved);
    assert.equal(
      resolution.contest!.saved,
      resolution.contest!.gapMeters <= resolution.contest!.reachMeters,
      `seed ${seed}: the result is exactly gap (${resolution.contest!.gapMeters.toFixed(2)}) vs reach (${resolution.contest!.reachMeters.toFixed(2)})`,
    );
    // And the gap really is between the ball and where the keeper got to.
    assert.ok(resolution.keeperAtArrival, "the keeper's arrival position is recorded");
    assert.ok(Math.abs(Math.abs(resolution.landing.x - resolution.keeperAtArrival!.x) - resolution.contest!.gapMeters) < 1e-9);
  }
});

test("a keeper who has been beaten to one side cannot save the other", () => {
  const at = { x: 10, y: 8 };
  const window = goalWindowFrom(at, { x: 10, y: 0.6 }, "TOP");
  const read = readShot(window, 8, KEEPER_ID, createPossessionRng(1));
  // He arrived at the left post; the ball crossed at the right post.
  const beaten = attemptSave(11.3, read.commitHeight === "LOW" ? 0.4 : 1.6, read.commitHeight === "LOW" ? "LOW" : "HIGH", { x: 8.8, y: 0.5 }, 0.5, read, KEEPER_ID);
  assert.equal(beaten.saved, false, "2.5m away from it, he cannot save it");
  // Standing on it, he does.
  const onIt = attemptSave(11.3, read.commitHeight === "LOW" ? 0.4 : 1.6, read.commitHeight === "LOW" ? "LOW" : "HIGH", { x: 11.2, y: 0.5 }, 0.5, read, KEEPER_ID);
  assert.equal(onIt.saved, true);
});

test("the lob exists, and only because the keeper has come out", () => {
  // Charging out at a breakthrough leaves it on...
  const chargedOut = situation({ x: 10, y: 2.5 }, { keeperAt: { x: 10, y: 2.4 } });
  const outPerception = perceiveShot(chargedOut, playerById(chargedOut, SHOOTER_ID), "TOP");
  const lobOption = decideShot(outPerception, createPossessionRng(2)).options.find((o) => o.intention === "LOB")!;
  // ...and staying at home takes it away.
  const atHome = situation({ x: 10, y: 2.5 }, { keeperAt: { x: 10, y: 0.35 } });
  const homePerception = perceiveShot(atHome, playerById(atHome, SHOOTER_ID), "TOP");
  const noLob = decideShot(homePerception, createPossessionRng(2)).options.find((o) => o.intention === "LOB")!;
  assert.ok(lobOption.score > noLob.score + 0.5, `the lob is worth far more against an advanced keeper (${lobOption.score.toFixed(2)} vs ${noLob.score.toFixed(2)})`);
  assert.ok(noLob.detail.includes("no lob on"));
  assert.equal(decideShot(outPerception, createPossessionRng(2)).intention, "LOB", "and against a keeper 2.4m off his line it is the shot he picks");

  // A keeper who has committed to his line is not beaten by height alone.
  const read = readShot(goalWindowFrom({ x: 10, y: 2.5 }, { x: 10, y: 2.4 }, "TOP"), 2.5, KEEPER_ID, createPossessionRng(1));
  const lobbed = attemptSave(10.2, 1.9, "LOB", { x: 10.2, y: 2.4 }, 2.4, read, KEEPER_ID);
  assert.equal(lobbed.saved, false, "lobbed while 2.4m off his line, he cannot get back");
  assert.ok(lobbed.detail.includes("lobbed"));
});

// ---------------------------------------------------------------------------
// 5. Determinism, and the shot in the running engine
// ---------------------------------------------------------------------------

test("the same state and seed produce the same shot decision and the same outcome", () => {
  const state = situation({ x: 9, y: 9 });
  const a = shoot(state, 77);
  const b = shoot(state, 77);
  assert.deepEqual(b.resolution, a.resolution, "identical decision, landing, read, contest and outcome");
  assert.deepEqual(b.state.players.map((p) => p.position), a.state.players.map((p) => p.position), "and an identical world afterwards");
  // Different seeds diverge -- through the inputs, not the verdict.
  const outcomes = new Set<string>();
  const targets = new Set<string>();
  for (let seed = 1; seed <= 40; seed += 1) {
    const { resolution } = shoot(state, seed);
    outcomes.add(resolution.outcome);
    targets.add(resolution.decision.targetX.toFixed(2));
  }
  assert.ok(outcomes.size >= 2, "seeds produce different outcomes");
  assert.ok(targets.size >= 2, "because they produce different shots");
});

test("the ball really travels, and the keeper really moves while it does", () => {
  const state = situation({ x: 10, y: 9 }, { keeperAt: { x: 10, y: 0.6 } });
  const steps: { ballY: number; keeperX: number }[] = [];
  const event = resolveShot(state, playerById(state, SHOOTER_ID), "TOP", createPossessionRng(5), undefined, (flying) => {
    steps.push({ ballY: flying.ball.position.y, keeperX: playerById(flying, KEEPER_ID).position.x });
  });
  assert.ok(steps.length >= 3, `the flight was simulated over ${steps.length} steps`);
  for (let i = 1; i < steps.length; i += 1) {
    assert.ok(steps[i].ballY <= steps[i - 1].ballY + 1e-9, "the ball travels toward the goal, never backwards");
  }
  assert.ok(Math.abs(steps[steps.length - 1].ballY) < 0.01, "and reaches the goal line");
  const keeperMoved = Math.abs(steps[steps.length - 1].keeperX - steps[0].keeperX);
  assert.ok(keeperMoved > 0.01, `the keeper moved ${keeperMoved.toFixed(2)}m during the flight`);
  assert.ok(event.resolution.flightSeconds > 0.1, "a shot from 9m takes real time to arrive");
});

test("shots in a running possession are all decisions against a keeper", () => {
  let shots = 0;
  const intentions = new Set<string>();
  for (let seed = 1; seed <= 120; seed += 1) {
    const result = simulatePossession({ seed, initialState: TOP });
    if (!result.shotOrigin) continue;
    shots += 1;
    const note = result.trace.find((t) => SHOT_INTENTIONS.some((i) => t.note.includes(i)));
    assert.ok(note, `seed ${seed}: the shot names the intention it was`);
    for (const intention of SHOT_INTENTIONS) if (note!.note.includes(intention)) intentions.add(intention);
    // The keeper was involved in every on-target shot.
    if (result.outcome === "SHOT_SAVED" || result.outcome === "SHOT_GOAL") {
      assert.ok(result.goalkeeperId, `seed ${seed}: a goalkeeper faced it`);
    }
  }
  assert.ok(shots > 40, `enough shots to judge (${shots})`);
  assert.ok(intentions.size >= 3, `several different shots were chosen (${[...intentions].join(", ")})`);
});

test("the keeper is an active player in a running possession, not furniture", () => {
  const result = simulatePossession({ seed: 12, initialState: TOP });
  const keeperTrack = result.trace.map((t) => t.playerPositions.find((p) => p.playerId === KEEPER_ID)!.position);
  const moved = keeperTrack.reduce((total, p, i) => (i === 0 ? 0 : total + distanceBetween(keeperTrack[i - 1], p)), 0);
  assert.ok(moved > 1, `he covered ${moved.toFixed(2)}m during the possession`);
  const xs = keeperTrack.map((p) => p.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) > 0.2, "tracking the ball across his goal");
  for (const p of keeperTrack) {
    assert.ok(p.y >= -0.01 && p.y <= GOALKEEPER_LIMITS.maxAdvanceMeters + 0.5, "and never wandering out of his goal");
  }
});
