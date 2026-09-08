// MATCH-EXPERIENCE-2.0 M16: scenario fixtures.
//
// The test that must never be deleted is "a scenario is input, never an
// expectation". The moment a fixture carries the answer -- an expectedAction, a
// pinned decision -- it stops being a controlled situation and becomes a test
// marking its own homework. Every test below builds a world and then asks the
// REAL engine what it makes of it.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLEAR_SHOT_AT_EIGHT_METRES,
  DEFENDER_STEPPED_OUT,
  PIVOT_AVAILABLE,
  PIVOT_MARKED,
  REUSABLE_SCENARIOS,
  TRANSITION_TWO_ON_ONE,
  requireScenarioPlayer,
  scenario,
  scenarioPlayer,
} from "./matchScenario";
import { createFullCourt6v6State } from "./fullCourt6v6";
import { decideAttackAction, nearestDefenderTo } from "../simulation/attackDecision";
import { evaluateSixZeroDefense } from "../policies/defense/sixZeroDefensePolicy";
import { perceiveTransition, breakMarginSeconds } from "../simulation/transitionDecision";
import { perceiveShot, decideShot } from "../simulation/shotDecision";
import { resolveAttackTactics } from "../simulation/organizedAttack";
import { createPossessionRng } from "../simulation/possessionRng";
import { simulatePossession } from "../simulation/possessionEngine";
import { simulateTransition } from "../simulation/sequenceEngine";
import { distanceBetween } from "../domain/geometry/coordinates";
import { readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// 1. A scenario is a world, built the same way every time
// ---------------------------------------------------------------------------

test("the same scenario always builds the same spatial state", () => {
  for (const [name, spec] of Object.entries(REUSABLE_SCENARIOS)) {
    const a = scenario(spec);
    const b = scenario(spec);
    assert.deepEqual(b, a, `${name} is reproducible`);
  }
  // ...and it draws no random numbers and reads no clock: an empty scenario is
  // exactly the canonical state the engine already ships.
  assert.deepEqual(scenario(), createFullCourt6v6State({ attackingGoalSide: "TOP" }));
});

test("a scenario places exactly what it names and leaves the rest canonical", () => {
  const canonical = createFullCourt6v6State({ attackingGoalSide: "TOP" }).handball;
  const state = scenario({ ballCarrier: "M9", attackers: { M6: { x: 7.2, y: 6.6 } }, defenders: { L3: { x: 8, y: 5.5 } } }).handball;

  assert.deepEqual(requireScenarioPlayer(state, "M6").position, { x: 7.2, y: 6.6 }, "the pivot went where he was put");
  assert.deepEqual(requireScenarioPlayer(state, "L3").position, { x: 8, y: 5.5 }, "and so did the defender");
  // Everybody else is untouched, by id and by position.
  for (const player of canonical.players) {
    const moved = ["M6", "L3"].some((ref) => scenarioPlayer(state, ref)?.id === player.id);
    if (moved) continue;
    const same = state.players.find((p) => p.id === player.id)!;
    assert.deepEqual(same.position, player.position, `${player.id} kept his canonical spot`);
    assert.equal(same.role, player.role, "and his canonical role");
    assert.deepEqual(same.movementProfile, player.movementProfile, "and his canonical movement profile");
  }
  assert.equal(state.players.length, canonical.players.length, "nobody was invented");
});

test("a scenario can give the ball away, take players off, and set the phase", () => {
  const state = scenario({ ballCarrier: "V9", without: ["L1", "R1"], phase: "FIRST_WAVE" });
  const carrier = requireScenarioPlayer(state.handball, "V9");
  assert.equal(state.handball.ball.possessorId, carrier.id, "the named carrier has it");
  assert.deepEqual(state.handball.ball.position, carrier.position, "and a possessed ball sits on him");
  assert.equal(state.handball.ball.status, "POSSESSED");
  assert.equal(state.handball.players.length, 12, "two defenders came off");
  assert.equal(scenarioPlayer(state.handball, "L1"), undefined);
  assert.equal(state.possession.phase, "FIRST_WAVE");

  // A loose ball is loose: nobody possesses it, and it sits where it was put.
  const loose = scenario({ ball: { x: 10, y: 20 }, ballStatus: "LOOSE" });
  assert.equal(loose.handball.ball.possessorId, null);
  assert.deepEqual(loose.handball.ball.position, { x: 10, y: 20 });

  // Naming somebody who is not there is a broken scenario, not a silent one.
  assert.throws(() => scenario({ ballCarrier: "L1", without: ["L1"] }), /not on the court/);
});

test("a scenario carries no expectation of its own", () => {
  // The fixtures are world state and nothing else: no key in any shipped spec
  // describes an outcome, an action or an assertion.
  const forbidden = /expect|assert|should|outcome|action|result/i;
  for (const [name, spec] of Object.entries(REUSABLE_SCENARIOS)) {
    for (const key of Object.keys(spec)) {
      assert.equal(forbidden.test(key), false, `${name}.${key} describes the world, not the answer`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Scenarios drive the REAL engine
// ---------------------------------------------------------------------------

function attackContext(state: ReturnType<typeof scenario>, carrierRef: string, tactics = {}) {
  const handball = state.handball;
  return {
    state: handball,
    goalSide: "TOP" as const,
    carrier: requireScenarioPlayer(handball, carrierRef),
    trigger: "SETTLED" as const,
    drivingGapId: null,
    passesMade: 1,
    resets: 0,
    possessionSeconds: 3,
    lastPasserId: null,
    tactics: resolveAttackTactics(tactics),
    rng: createPossessionRng(99),
  };
}

test("an organized-attack scenario drives M6's real decision logic", () => {
  // The situation the fixture builds is genuinely what it says: the pivot has
  // room in one and is marked in the other. Measured, not asserted by the spec.
  const free = scenario(PIVOT_AVAILABLE).handball;
  const marked = scenario(PIVOT_MARKED).handball;
  const roomFor = (state: typeof free) => nearestDefenderTo(state, requireScenarioPlayer(state, "M6").position).distance;
  assert.ok(roomFor(free) > 1.0, `the pivot is available (${roomFor(free).toFixed(2)}m of room)`);
  assert.ok(roomFor(marked) < 1.0, `and marked in the other (${roomFor(marked).toFixed(2)}m)`);

  // Now the REAL decision code, on both worlds, with the same seeded stream.
  const openDecision = decideAttackAction(attackContext(scenario(PIVOT_AVAILABLE), "M9"));
  const markedDecision = decideAttackAction(attackContext(scenario(PIVOT_MARKED), "M9"));
  const pivotScore = (d: typeof openDecision) => d.options.find((o) => o.kind === "PLAY_PIVOT")?.score ?? -1;

  assert.ok(pivotScore(openDecision) > 0, "a free pivot is worth something");
  assert.equal(pivotScore(markedDecision), 0, "a marked one is worth nothing");
  assert.ok(pivotScore(openDecision) > pivotScore(markedDecision), "and the engine can tell the two apart");
  // The scenario did not say what he should do -- only what he was looking at.
  assert.ok(openDecision.chosen.kind.length > 0, "the engine chose something");
});

test("a defensive scenario drives M7's real collective logic", () => {
  const state = scenario(DEFENDER_STEPPED_OUT).handball;
  const reaction = evaluateSixZeroDefense(state);
  assert.equal(reaction.implemented, true, "the real 6:0 policy ran on it");
  assert.equal(reaction.reactions.length, 6, "all six defenders reacted");
  for (const r of reaction.reactions) {
    assert.ok(state.players.some((p) => p.id === r.defenderId), "each is a real player in the scenario");
  }
  assert.ok(reaction.summary.length > 0, "and it produced its own account of the shape");
  // The scenario is a situation, so the policy is free to resolve it however it
  // resolves it -- this only checks it engaged with the drive at all.
  assert.ok(
    reaction.primaryDefenderId !== null || reaction.reactions.some((r) => r.reactionType !== "RECOVER"),
    "the defence is doing something about the ball",
  );
});

test("a transition scenario drives M8's real race model", () => {
  const state = scenario(TRANSITION_TWO_ON_ONE).handball;
  assert.equal(state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER").length, 1, "a one-man defence, as specified");

  const perception = perceiveTransition(state, "TOP");
  const carrier = requireScenarioPlayer(state, "M9");
  const margin = breakMarginSeconds(perception, carrier);
  assert.ok(Number.isFinite(margin), "the real race model read the situation");
  assert.ok(perception.attackers.length >= 2, "and saw the runners");

  // The same scenario runs end to end through the production transition loop.
  const result = simulateTransition({ seed: 12, initialState: scenario(TRANSITION_TWO_ON_ONE) });
  assert.equal(result.guardTripped, false, "a real transition resolved from the fixture");
  assert.ok(result.trace.length > 0);
});

test("a shot scenario drives M9's real contest", () => {
  const state = scenario(CLEAR_SHOT_AT_EIGHT_METRES).handball;
  const shooter = requireScenarioPlayer(state, "M9");
  assert.equal(state.players.filter((p) => p.team === "DEFENSE" && p.kind === "FIELD_PLAYER").length, 0, "nobody but the keeper, as specified");

  const perception = perceiveShot(state, shooter, "TOP");
  assert.ok(Math.abs(perception.distance - 8) < 0.5, `he really is at eight metres (${perception.distance.toFixed(2)}m)`);
  const decision = decideShot(perception, createPossessionRng(5));
  assert.ok(decision.intention.length > 0, "the real shot decision ran");
  assert.ok(decision.options.length > 1, "and weighed real alternatives");
  // The goalkeeper is still there to beat.
  assert.ok(scenarioPlayer(state, "GK_DEFENCE"), "the keeper defends his goal");
});

test("a scenario can be played out by the production possession engine", () => {
  const result = simulatePossession({ seed: 12, initialState: scenario(PIVOT_AVAILABLE) });
  assert.equal(result.guardTripped, false, "an ordinary possession resolved");
  assert.ok(["SHOT_GOAL", "SHOT_SAVED", "SHOT_MISSED", "TURNOVER", "FREE_THROW"].includes(result.outcome));
  assert.ok(result.trace.length > 0, "with a real trace");
  // The same scenario, the same seed, twice.
  const again = simulatePossession({ seed: 12, initialState: scenario(PIVOT_AVAILABLE) });
  assert.equal(again.outcome, result.outcome);
  assert.equal(again.steps, result.steps);
});

test("scenarios do not reimplement any decision", () => {
  // The module builds states. It must not contain a rule about what happens in
  // one -- so it never imports the decision layers it exists to feed.
  const source = readFileSync("src/scenarios/matchScenario.ts", "utf8");
  for (const forbidden of ["attackDecision", "shotDecision", "transitionDecision", "collectiveDefense", "possessionEngine", "sequenceEngine"]) {
    assert.equal(source.includes(`from "../simulation/${forbidden}"`), false, `matchScenario.ts does not import ${forbidden}`);
    assert.equal(source.includes(`from "../policies/defense/${forbidden}"`), false, `matchScenario.ts does not import ${forbidden}`);
  }
  // And the geometry it places players on is the canonical one.
  assert.ok(source.includes('from "./fullCourt6v6"'), "it builds on the canonical court");
});


test("a scenario is a full-court match state the engine already understands", () => {
  const state = scenario(PIVOT_AVAILABLE);
  // Distances are still real metres on the real court.
  const carrier = requireScenarioPlayer(state.handball, "M9");
  const pivot = requireScenarioPlayer(state.handball, "M6");
  assert.ok(distanceBetween(carrier.position, pivot.position) > 1, "the two are genuinely apart on the court");
  assert.equal(state.possession.attackingGoalSide, "TOP");
  // Both goalkeepers are present, as the canonical full court requires.
  assert.equal(state.handball.players.filter((p) => p.kind === "GOALKEEPER").length, 2);
});
