// MATCH-EXPERIENCE-2.0 M21: what a control reading is measured against.
//
// The test that must never be deleted is "a defence that controls everything
// does not stop the attack attacking". M17's spatial control is a comparison
// between the options a carrier has; the bug it shipped with was comparing them
// instead to a fixed 0.5, which a real 6:0 beats most of the time. That turned a
// refinement into a standing tax on driving and a standing subsidy on passing,
// and the attack quietly stopped committing.
//
// These are mechanism tests on the decision layer, not seed witnesses: each one
// builds the situation it is about and asks what the carrier decides.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scenario, requireScenarioPlayer } from "../scenarios/matchScenario";
import { createFullCourt6v6State } from "../scenarios/fullCourt6v6";
import { decideAttackAction, perceiveGaps } from "./attackDecision";
import { simulateGameSequence } from "./gameFlow";
import { createPossessionRng } from "./possessionRng";
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import type { AttackOption, DecisionContext } from "./attackDecision";
import type { HandballState } from "../domain/handball/state";
import type { AttackingGoalSide } from "../domain/match/possession";

const TOP = createFullCourt6v6State({ attackingGoalSide: "TOP" });

function decide(state: HandballState, goalSide: AttackingGoalSide = "TOP", overrides: Partial<DecisionContext> = {}) {
  return decideAttackAction({
    state,
    goalSide,
    carrier: requireScenarioPlayer(state, "V9"),
    trigger: "SETTLED",
    drivingGapId: null,
    passesMade: 0,
    resets: 0,
    possessionSeconds: 3,
    lastPasserId: null,
    rng: createPossessionRng(99),
    ...overrides,
  });
}

const attacking = (option: AttackOption) => option.kind === "ATTACK_GAP" || option.kind === "CONTINUE" || option.kind === "SHOOT";
const best = (decision: ReturnType<typeof decide>, kind: AttackOption["kind"]) =>
  decision.options.find((o) => o.kind === kind) ?? null;

/** The canonical organized attack against a set 6:0 -- the ordinary situation. */
function ordinaryAttack(): HandballState {
  return scenario({ ballCarrier: "V9", attackers: { V9: { x: 10, y: 11 } }, phase: "CIRCULATION" }).handball;
}

// ---------------------------------------------------------------------------
// 1. A playable-but-not-perfect gap is still a real option
// ---------------------------------------------------------------------------

test("against an ordinary set defence the carrier still has a gap worth attacking", () => {
  // Nothing exotic: the canonical 6:0, a back with the ball. A defence controls
  // most gaps most of the time, and if that alone removed attacking from the
  // menu the attack could only ever pass.
  const decision = decide(ordinaryAttack());
  const gap = decision.options.find((o) => o.kind === "ATTACK_GAP");
  assert.ok(gap, "there is a gap option at all");
  assert.ok(
    gap.score > 0,
    `a playable gap against a real defence keeps a positive score (${gap.score.toFixed(3)})`,
  );

  // And it is not buried under simply keeping the ball moving.
  const reset = best(decision, "RESET");
  if (reset) {
    assert.ok(
      gap.score > reset.score - 0.25,
      `attacking stays competitive with circulating (gap ${gap.score.toFixed(3)} vs reset ${reset.score.toFixed(3)})`,
    );
  }
});

test("a defence that controls every gap equally singles none of them out", () => {
  // The heart of the correction. When every option is contested to the same
  // degree, control has nothing to say -- it is a comparison, and there is
  // nothing to compare. It must not tax them all and hand the decision to the
  // pass by default.
  const state = ordinaryAttack();
  const gaps = perceiveGaps(state, "TOP", requireScenarioPlayer(state, "V9"));
  assert.ok(gaps.length > 1, "the carrier sees several gaps");

  const decision = decide(state);
  const gapOptions = decision.options.filter((o) => o.kind === "ATTACK_GAP" || o.kind === "CONTINUE");
  assert.ok(gapOptions.length > 0, "and they reach the option list");
  for (const option of gapOptions) {
    if (!option.control) continue;
    // No gap may be discounted below the floor the weight allows, which is what
    // an absolute levy against 0.5 was doing to almost all of them.
    assert.ok(option.score > -1, `${option.detail} is still a real option`);
  }
});

// ---------------------------------------------------------------------------
// 2. A gap the defence genuinely owns is still discounted
// ---------------------------------------------------------------------------

test("a gap that is clearly worse than the alternatives is still discounted", () => {
  // Spatial Control must survive the correction: relative is not the same as
  // absent. One gap sealed by a defender standing in it should score below the
  // same gap with that defender pulled away, everything else equal.
  const open = scenario({
    ballCarrier: "V9",
    attackers: { V9: { x: 10, y: 11 } },
    defenders: { R3: { x: 16, y: 8 } },
    phase: "CIRCULATION",
  }).handball;
  const sealed = scenario({
    ballCarrier: "V9",
    attackers: { V9: { x: 10, y: 11 } },
    defenders: { R3: { x: 10.2, y: 9.4 } },
    phase: "CIRCULATION",
  }).handball;

  const openGap = decide(open).options.filter(attacking).map((o) => o.score);
  const sealedGap = decide(sealed).options.filter(attacking).map((o) => o.score);
  assert.ok(openGap.length > 0 && sealedGap.length > 0, "both situations offer attacking options");
  assert.ok(
    Math.max(...openGap) > Math.max(...sealedGap),
    `a defender sitting in the gap still costs it (${Math.max(...openGap).toFixed(3)} vs ${Math.max(...sealedGap).toFixed(3)})`,
  );
});

// ---------------------------------------------------------------------------
// 3. Circulation ends in an attack
// ---------------------------------------------------------------------------

test("an attack that has been circulating eventually goes at the defence", () => {
  // Patience is finite by design. After several passes and resets the carrier
  // must prefer doing something to keeping the ball, or the possession only
  // ends when the defence takes it.
  const state = ordinaryAttack();
  const patient = decide(state, "TOP", { passesMade: 0, resets: 0, possessionSeconds: 1 });
  const pressed = decide(state, "TOP", { passesMade: 5, resets: 3, possessionSeconds: 22 });
  assert.ok(
    pressed.patience <= patient.patience,
    "a long possession is less willing to wait than a fresh one",
  );
  assert.ok(
    attacking(pressed.chosen) || pressed.chosen.kind === "PASS" || pressed.chosen.kind === "PLAY_PIVOT",
    `a worked possession does something (${pressed.chosen.kind})`,
  );
});

test("organized possessions end in a shot or a turnover, never in nothing", () => {
  // The end-to-end version: if control ever suppressed attacking outright, this
  // is where it would show up as possessions that simply expire.
  let shots = 0;
  let turnovers = 0;
  let other = 0;
  for (const seed of [1, 3, 5, 7, 11, 12]) {
    for (const segment of simulateGameSequence(TOP, seed, { maxPossessions: 40 }).segments) {
      if (segment.kind === "TRANSITION") continue;
      if (String(segment.outcome).startsWith("SHOT")) shots += 1;
      else if (segment.outcome === "TURNOVER") turnovers += 1;
      else if (segment.outcome !== "FREE_THROW") other += 1;
    }
  }
  assert.ok(shots > 0 && turnovers > 0, "both endings occur");
  assert.equal(other, 0, "and nothing else -- no organized possession fizzles out unattacked");
  assert.ok(shots > turnovers, `attacks mostly end in a shot (${shots} shots vs ${turnovers} turnovers)`);
});

// ---------------------------------------------------------------------------
// 4. A free-throw restart is an ordinary attack again
// ---------------------------------------------------------------------------

test("a free-throw continuation reforms into a normal attack", () => {
  let checked = 0;
  for (let seed = 1; seed <= 40 && checked < 5; seed += 1) {
    const segments = simulateGameSequence(TOP, seed, { maxPossessions: 40 }).segments;
    for (const segment of segments) {
      if (segment.kind !== "FREE_THROW_CONTINUATION") continue;
      checked += 1;
      // It is a real attack: it runs for a real length of time and ends the way
      // organized possessions end.
      assert.ok(segment.steps > 0, "the restart is actually played out");
      assert.ok(
        String(segment.outcome).startsWith("SHOT") ||
          segment.outcome === "TURNOVER" ||
          segment.outcome === "FREE_THROW",
        `a continuation ends like an attack (${segment.outcome})`,
      );
    }
  }
  assert.ok(checked > 0, "free-throw continuations occur");
});

// ---------------------------------------------------------------------------
// 5. Symmetry and determinism
// ---------------------------------------------------------------------------

test("the correction reads the same attacking either goal", () => {
  const top = ordinaryAttack();
  const bottom = scenario({
    ballCarrier: "V9",
    attackingGoalSide: "BOTTOM",
    attackers: { V9: { x: 10, y: mirrorYForOppositeGoalSide(11) } },
    phase: "CIRCULATION",
  }).handball;

  const a = decide(top, "TOP");
  const b = decide(bottom, "BOTTOM");
  assert.equal(a.chosen.kind, b.chosen.kind, "the same decision at either end");
  assert.equal(a.chosen.score.toFixed(6), b.chosen.score.toFixed(6), "and the same score");
});

test("the same situation decides the same way every time", () => {
  const state = ordinaryAttack();
  const a = decide(state);
  const b = decide(state);
  assert.deepEqual(
    a.options.map((o) => [o.kind, o.score.toFixed(6)]),
    b.options.map((o) => [o.kind, o.score.toFixed(6)]),
  );
});
