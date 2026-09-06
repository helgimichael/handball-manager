// HM-PLAYER-DEVELOPMENT-2.0 PHASE 1: the retirement age tail.
//
// The test that must never be deleted is "age eventually dominates every
// protective multiplier". The P0 this milestone fixed was not a bad number, it
// was a STRUCTURAL absorbing state: RETIREMENT_AGE_ANCHORS ended at 43 and
// `interpolate` returns the final anchor forever after, while the tier
// multiplier is a lifetime constant (deriveDefaultSquadStatusTier reads static
// PlayerMock fields, never CA). A contracted KEY_PLAYER therefore sat at a
// fixed 6.9% annual retirement probability at every age past 43, and the
// 30-season benchmark measured active players aged 56-66 on all four seeds.
//
// These are analytical/life-table tests on purpose: they pin the survival
// behaviour that a 100-minute simulation run would otherwise be needed to see.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeRetirementProbability,
  retirementProbabilityFactors,
  extremeAgeRetirementFloor,
} from "./playerLifecycle";
import type { SquadStatusTier } from "./squadStatus";
import type { ContractStatus } from "../economy/types";

const TIERS: SquadStatusTier[] = ["KEY_PLAYER", "FIRST_CHOICE", "ROTATION", "SQUAD_PLAYER", "TALENT"];
/** The most protected path in the whole model: lowest tier multiplier (0.5) times the comfortably-contracted multiplier (0.15). */
const MOST_PROTECTED = { tier: "KEY_PLAYER" as SquadStatusTier, contractStatus: "UNDER_CONTRACT" as ContractStatus };

const p = (age: number, tier: SquadStatusTier, contractStatus: ContractStatus, isGoalkeeper = false, daysUnattached = 0) =>
  computeRetirementProbability({ age, isGoalkeeper, tier, contractStatus, daysUnattached });

/** Probability of surviving from `from` to `to` without retiring, on the given path. */
function survival(from: number, to: number, tier: SquadStatusTier, contractStatus: ContractStatus): number {
  let s = 1;
  for (let age = from; age < to; age++) s *= 1 - p(age, tier, contractStatus);
  return s;
}

// ---------------------------------------------------------------------------
// The invariant this module exists to satisfy -- do not delete
// ---------------------------------------------------------------------------

test("age eventually dominates every protective multiplier", () => {
  // The regression: every one of these was identical at 43, 45, 48, 50, 55, 60.
  for (const tier of TIERS) {
    for (const status of ["UNDER_CONTRACT", "EXPIRING", "FREE_AGENT"] as ContractStatus[]) {
      for (const [younger, older] of [[43, 45], [45, 48], [48, 50]] as const) {
        assert.ok(
          p(older, tier, status) > p(younger, tier, status) || p(younger, tier, status) >= 0.98,
          `${tier}/${status}: probability at ${older} (${p(older, tier, status).toFixed(4)}) must exceed ${younger} (${p(younger, tier, status).toFixed(4)}) -- a flat tail is the absorbing state this milestone removed`,
        );
      }
      // ...and it must actually reach near-certainty, not merely creep upward.
      assert.ok(p(52, tier, status) >= 0.95, `${tier}/${status}: a 52-year-old must be almost certain to retire, got ${p(52, tier, status).toFixed(4)}`);
    }
  }
});

test("no protective multiplier can create an indefinite low-retirement state", () => {
  // The multipliers are bounded below by 0.5 * 0.15 = 0.075, so age can never
  // dominate MULTIPLICATIVELY -- proving the floor has to be applied after them.
  const prob = p(50, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
  assert.ok(prob >= 0.95, `the most protected 50-year-old must still be near-certain to retire, got ${prob.toFixed(4)}`);
  const f = retirementProbabilityFactors({ age: 50, isGoalkeeper: false, ...MOST_PROTECTED, daysUnattached: 0 });
  assert.ok(f.floorBinds, "the extreme-age floor, not the multiplier path, must decide the outcome at 50");
  assert.ok(f.base * f.tier * f.contract * f.freeAgent < 0.1, "the multiplier path alone would still be under 10% -- which is exactly the defect");
});

// ---------------------------------------------------------------------------
// Survival calibration -- the acceptance table
// ---------------------------------------------------------------------------

test("exceptional careers into the early 40s remain possible", () => {
  // Reaching 43 from 40 must stay a real outcome, not a rounding artefact.
  const s = survival(40, 43, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
  assert.ok(s > 0.25, `an exceptional 40-year-old must have a real chance of reaching 43, got ${(100 * s).toFixed(1)}%`);
  assert.ok(s < 0.75, `...but it must not be the default outcome, got ${(100 * s).toFixed(1)}%`);
});

test("mid-to-late 40s are rare, 50+ effectively absent, 55+ absent", () => {
  const to45 = survival(40, 45, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
  const to50 = survival(43, 50, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
  const to50from45 = survival(45, 50, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
  const to55 = survival(50, 55, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
  // Before the fix these were 71.88% / 60.62% / 69.94% / 69.94%.
  assert.ok(to45 > 0.02 && to45 < 0.25, `40->45 survival ${(100 * to45).toFixed(2)}% must be rare but possible`);
  assert.ok(to50 < 0.001, `43->50 survival ${(100 * to50).toFixed(5)}% must be effectively absent`);
  assert.ok(to50from45 < 0.01, `45->50 survival ${(100 * to50from45).toFixed(5)}% must be effectively absent`);
  assert.ok(to55 < 0.0001, `50->55 survival ${(100 * to55).toFixed(5)}% must be absent`);
});

test("a life table from 28 leaves nobody alive past the mid 50s", () => {
  let alive = 1_000_000;
  const at: Record<number, number> = {};
  for (let age = 28; age <= 60; age++) {
    at[age] = alive;
    alive *= 1 - p(age, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
  }
  assert.ok(at[40] > 500_000, `a 28-year-old must usually still be playing at 40 (${at[40].toFixed(0)} per million)`);
  assert.ok(at[45] < 200_000 && at[45] > 1_000, `age 45 must be rare but reachable (${at[45].toFixed(0)} per million)`);
  assert.ok(at[50] < 100, `age 50 must be extremely rare (${at[50].toFixed(2)} per million)`);
  assert.ok(at[55] < 0.01, `age 55 must be effectively absent (${at[55].toFixed(6)} per million)`);
});

test("there is no abrupt mass retirement at 40-43", () => {
  // A cliff would be as wrong as the flat tail. Nothing may more than double
  // year over year through the band where the floor takes over.
  for (let age = 38; age <= 46; age++) {
    const a = p(age, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
    const b = p(age + 1, MOST_PROTECTED.tier, MOST_PROTECTED.contractStatus);
    assert.ok(b <= Math.max(0.12, a * 2.2), `retirement probability must not spike from ${age} (${a.toFixed(3)}) to ${age + 1} (${b.toFixed(3)})`);
  }
});

// ---------------------------------------------------------------------------
// Scope guards -- what this milestone must NOT have changed
// ---------------------------------------------------------------------------

test("ordinary careers are completely unchanged", () => {
  // The floor is 0 below 38, so every probability under 38 must still be the
  // pure multiplier product. These are the exact pre-fix values.
  assert.equal(extremeAgeRetirementFloor(37, false), 0);
  for (const [age, tier, expected] of [
    [31, "ROTATION", 0.0015], [35, "KEY_PLAYER", 0.00975], [37, "SQUAD_PLAYER", 0.05625],
  ] as [number, SquadStatusTier, number][]) {
    assert.ok(Math.abs(p(age, tier, "UNDER_CONTRACT") - expected) < 1e-9, `age ${age} ${tier} must still be ${expected}, got ${p(age, tier, "UNDER_CONTRACT")}`);
  }
  // Nobody under RETIREMENT_MIN_EVAL_AGE is even evaluated, and the curve is 0 there anyway.
  assert.equal(p(27, "SQUAD_PLAYER", "FREE_AGENT"), 0);
});

test("goalkeepers keep the same effective-age discount, not a second rule", () => {
  // The floor is read on effectiveAge like every other curve here.
  for (const age of [42, 45, 48, 50]) {
    assert.ok(
      Math.abs(extremeAgeRetirementFloor(age, true) - extremeAgeRetirementFloor(age - 2.5, false)) < 1e-9,
      `goalkeeper floor at ${age} must equal the outcourt floor at ${age - 2.5}`,
    );
    assert.ok(p(age, "ROTATION", "UNDER_CONTRACT", true) < p(age, "ROTATION", "UNDER_CONTRACT", false), `a goalkeeper must retire later than an outcourt player at ${age}`);
  }
});

test("the floor only ever raises the probability, never lowers it", () => {
  for (let age = 28; age <= 60; age++) {
    for (const tier of TIERS) {
      for (const status of ["UNDER_CONTRACT", "EXPIRING", "FREE_AGENT"] as ContractStatus[]) {
        const f = retirementProbabilityFactors({ age, isGoalkeeper: false, tier, contractStatus: status, daysUnattached: 400 });
        const multiplierPath = Math.min(0.98, f.base * f.tier * f.contract * f.freeAgent);
        assert.ok(
          p(age, tier, status, false, 400) >= multiplierPath - 1e-12,
          `age ${age} ${tier}/${status}: the floor must never reduce a probability the multiplier path already produced`,
        );
      }
    }
  }
});

test("probabilities stay valid everywhere", () => {
  for (let age = 16; age <= 80; age++) {
    for (const tier of TIERS) {
      for (const status of ["UNDER_CONTRACT", "EXPIRING", "EXPIRING_SOON", "FREE_AGENT"] as ContractStatus[]) {
        const v = p(age, tier, status, age % 2 === 0, 900);
        assert.ok(v >= 0 && v <= 0.98, `age ${age} ${tier}/${status} produced ${v}, outside [0, 0.98]`);
      }
    }
  }
});
