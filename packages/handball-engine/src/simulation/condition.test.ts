// MATCH-EXPERIENCE-2.0 M25: physical condition.
//
// The test that must never be deleted is "fatigue is not a penalty". Condition
// reaches the match through exactly one channel -- how fast a player can move
// and how quickly he gets there -- and the moment somebody adds a term to a
// shot, a pass or a save because a player is tired, the model has become the
// hidden outcome modifier it was written to avoid.
//
// The second thing under test is that it is INERT until switched on. A player
// with no condition value does not have one, so every state written before M25
// fatigues nobody. That is what makes it possible to prove the state itself
// changed no matches.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { simulateMatch } from "./matchRunner";
import { step } from "./engine";
import { timeToReach, reachProfileOf } from "./spatialControl";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import {
  FULL_CONDITION,
  MINIMUM_CONDITION,
  conditionOf,
  effectiveMovementProfile,
  exertionCost,
  readCondition,
  recoverOnBench,
} from "./condition";
import type { HandballState } from "../domain/handball/state";
import type { Player } from "../domain/handball/player";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });
const DT = 0.05;

/** A lone player, given a tank, so his work can be watched without a match around him. */
function loneRunner(condition = FULL_CONDITION, overrides: Partial<Player> = {}): Player {
  const base = requireScenarioPlayer(scenario({}).handball, "M9");
  return { ...base, condition, ...overrides };
}

/** Run one player for `seconds`, re-issuing a MOVE order to keep him working. */
function work(player: Player, seconds: number, target: { x: number; y: number }): Player {
  let state: HandballState = { ...scenario({}).handball, players: [player] };
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) {
    state = step(state, { actions: [{ type: "MOVE", playerId: player.id, target }] }, DT);
  }
  return state.players[0];
}

// ---------------------------------------------------------------------------
// 1. Inert unless switched on
// ---------------------------------------------------------------------------

test("a player with no condition value never fatigues", () => {
  const noTank = { ...loneRunner(), condition: undefined };
  const after = work(noTank, 30, { x: 10, y: 1 });
  assert.equal(after.condition, undefined, "he never acquires one by running");
  assert.deepEqual(
    effectiveMovementProfile(after),
    noTank.movementProfile,
    "and he moves exactly as he always did",
  );
});

test("a match played without fatigue is the match M24 played", () => {
  const plain = simulateMatch(TOP, 12);
  assert.ok(
    plain.finalState.match.handball.players.every((p) => p.condition === undefined),
    "nobody on the court has a tank",
  );
  const withFatigue = simulateMatch(TOP, 12, { fatigue: true });
  assert.ok(
    withFatigue.finalState.match.handball.players.every((p) => p.condition !== undefined),
    "and with it on, everybody does",
  );
});

// ---------------------------------------------------------------------------
// 2. Work is what costs
// ---------------------------------------------------------------------------

test("over the same time, the player who sprints loses more than the player who barely moves", () => {
  const sprinter = work(loneRunner(), 40, { x: 10, y: 1 });
  const stroller = work(loneRunner(), 40, { x: 10.3, y: 11.9 });
  assert.ok(conditionOf(sprinter) < conditionOf(stroller), "running costs more than standing");
  assert.ok(
    conditionOf(stroller) < FULL_CONDITION,
    "and standing on a court for forty seconds is not quite free either",
  );
});

test("a metre run at speed costs more than a metre run slowly", () => {
  const slow = exertionCost(1, 1.5, 0, DT);
  const fast = exertionCost(1, 5.5, 0, DT);
  assert.ok(fast > slow * 1.5, `sprinting is dearer per metre (${fast.toFixed(6)} vs ${slow.toFixed(6)})`);
});

test("changing speed costs on top of covering ground", () => {
  const steady = exertionCost(1, 3, 0, DT);
  const accelerating = exertionCost(1, 3, 3, DT);
  assert.ok(accelerating > steady, "getting back up to speed is the expensive part of handball");
});

test("nobody runs himself to a standstill", () => {
  let player = loneRunner();
  for (let i = 0; i < 40; i += 1) player = work({ ...player, intent: { type: "IDLE" } }, 30, i % 2 ? { x: 10, y: 1 } : { x: 10, y: 20 });
  assert.ok(conditionOf(player) >= MINIMUM_CONDITION, "there is a floor");
  assert.ok(effectiveMovementProfile(player).maxSpeed > player.movementProfile.maxSpeed * 0.8, "an exhausted player is slower, not crippled");
});

// ---------------------------------------------------------------------------
// 3. It reaches the engine through movement, and only through movement
// ---------------------------------------------------------------------------

test("a tired defender takes longer to reach the same point", () => {
  const fresh = loneRunner(FULL_CONDITION);
  const tired = loneRunner(0.6);
  const point = { x: 14, y: 6 };
  const freshSeconds = timeToReach(reachProfileOf(fresh), point);
  const tiredSeconds = timeToReach(reachProfileOf(tired), point);
  assert.ok(tiredSeconds > freshSeconds, `the same run takes him longer (${tiredSeconds.toFixed(2)}s vs ${freshSeconds.toFixed(2)}s)`);
});

test("fatigue is not a penalty applied to anything else", () => {
  // Structural, and the one that matters most. If the condition module ever
  // learns the vocabulary of an outcome, M25 has become a hidden modifier.
  const source = readFileSync("src/simulation/condition.ts", "utf8");
  // Implementation tokens only: the prose above deliberately uses words like
  // "rating" to say what this module is NOT, and forbidding the word would be
  // forbidding the explanation rather than the behaviour.
  for (const word of ["rng", "chance", "Math.random", "SHOT_", "attemptSave", "resolveShot", "judgeFoul", "ratingOf"]) {
    assert.ok(!source.includes(word), `condition.ts must not mention ${word}`);
  }
});

test("condition is inspectable, in the units the engine works in", () => {
  const reading = readCondition(loneRunner(0.71));
  assert.equal(reading.condition, 0.71);
  assert.ok(reading.maxSpeed > 0 && reading.acceleration > 0);
  assert.ok(reading.speedRetained < 1 && reading.speedRetained > 0.9, "a readable fraction of his fresh speed");
  assert.equal(reading.playerId, loneRunner().id);
});

// ---------------------------------------------------------------------------
// 4. Rest, and identity
// ---------------------------------------------------------------------------

test("a rested player recovers, but is not restored", () => {
  const spent = loneRunner(0.62);
  const afterAMinute = recoverOnBench(spent, 60);
  assert.ok(conditionOf(afterAMinute) > 0.62, "sitting down helps");
  assert.ok(conditionOf(afterAMinute) < FULL_CONDITION, "and does not hand him a new match");
  const afterTen = recoverOnBench(spent, 600);
  assert.ok(conditionOf(afterTen) <= FULL_CONDITION, "and never overfills");
});

test("a goalkeeper's work costs him less than the same work costs a wing", () => {
  const keeper = { ...loneRunner(), kind: "GOALKEEPER" as const, id: "keeper" };
  const outfield = loneRunner();
  const target = { x: 10, y: 2 };
  const tiredKeeper = work(keeper, 30, target);
  const tiredOutfield = work(outfield, 30, target);
  assert.ok(conditionOf(tiredKeeper) > conditionOf(tiredOutfield), "the same running is cheaper for him");
  assert.ok(conditionOf(tiredKeeper) < FULL_CONDITION, "but he is not exempt from the model");
});

// ---------------------------------------------------------------------------
// 5. Through a real match
// ---------------------------------------------------------------------------

test("condition follows the player through substitutions and across the interval", () => {
  const match = simulateMatch(TOP, 12, { fatigue: true });
  const onCourt = match.finalState.match.handball.players;
  const bench = [...match.finalState.bench.HOME, ...match.finalState.bench.AWAY];

  // Everybody in the squad has a tank, and nobody has an impossible one.
  for (const player of [...onCourt, ...bench]) {
    const value = conditionOf(player);
    assert.ok(value >= MINIMUM_CONDITION && value <= FULL_CONDITION, `${player.id} has a legal condition (${value})`);
  }

  // Somebody actually got tired: a full match of work has to show.
  assert.ok(
    [...onCourt, ...bench].some((p) => conditionOf(p) < 0.95),
    "a match of real running leaves a mark",
  );

  // And no player id appears twice with two different tanks -- one player, one
  // condition, whichever side of the line he is on.
  const seen = new Map<string, number>();
  for (const player of [...onCourt, ...bench]) {
    assert.ok(!seen.has(player.id), `${player.id} exists once`);
    seen.set(player.id, conditionOf(player));
  }
});

test("rotation is worth something: the bench comes back fresher than the men who stayed on", () => {
  const match = simulateMatch(TOP, 12, { fatigue: true });
  const bench = [...match.finalState.bench.HOME, ...match.finalState.bench.AWAY].filter((p) => p.kind === "FIELD_PLAYER");
  const onCourt = match.finalState.match.handball.players.filter((p) => p.kind === "FIELD_PLAYER");
  const mean = (players: readonly Player[]) => players.reduce((sum, p) => sum + conditionOf(p), 0) / Math.max(1, players.length);
  assert.ok(bench.length > 0 && onCourt.length > 0);
  assert.ok(
    mean(bench) > mean(onCourt),
    `resting men are fresher than working ones (${mean(bench).toFixed(3)} vs ${mean(onCourt).toFixed(3)})`,
  );
});

test("a fresh substitute can reach what a tired starter cannot", () => {
  // The whole point of a rotation, stated spatially: same position, same order,
  // different tank, and the difference is a real metre of court.
  const point = { x: 16, y: 4 };
  const tired = loneRunner(MINIMUM_CONDITION);
  const fresh = loneRunner(FULL_CONDITION);
  const window = timeToReach(reachProfileOf(fresh), point);
  assert.ok(
    timeToReach(reachProfileOf(tired), point) > window,
    "the tired man does not get there in the time the fresh man does",
  );
});

// ---------------------------------------------------------------------------
// 6. Determinism and symmetry
// ---------------------------------------------------------------------------

test("the same match fatigues the same players by the same amounts", () => {
  const a = simulateMatch(TOP, 12, { fatigue: true });
  const b = simulateMatch(TOP, 12, { fatigue: true });
  const tanks = (match: typeof a) =>
    match.finalState.match.handball.players.map((p) => `${p.id}:${conditionOf(p).toFixed(9)}`).sort();
  assert.deepEqual(tanks(a), tanks(b));
});

test("fatigue does not care which end of the court a player works at", () => {
  // The same run, mirrored: the runner's own start AND his target both flipped,
  // so the two players cover identical ground in identical time.
  const base = loneRunner();
  const target = { x: base.position.x, y: 1 };
  const atTop = work(base, 20, target);
  const atBottom = work(
    { ...base, position: { x: base.position.x, y: mirrorYForOppositeGoalSide(base.position.y) } },
    20,
    { x: target.x, y: mirrorYForOppositeGoalSide(target.y) },
  );
  assert.equal(conditionOf(atTop).toFixed(9), conditionOf(atBottom).toFixed(9), "the same run costs the same at either end");
});
