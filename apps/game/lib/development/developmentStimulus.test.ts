// HM-TRAINING-1.1 Part 33: directional proofs for the pure session/match
// stimulus math (lib/development/developmentStimulus.ts). No CareerState
// involved -- see developmentIntegration.test.ts for the domain-
// integration layer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeMatchAttributeStimulus, computeSessionAttributeStimulus } from "./developmentStimulus";

function sum(stimulus: Partial<Record<string, number>>): number {
  return Object.values(stimulus).reduce((a: number, b) => a + (b ?? 0), 0);
}

// (1) training session creates correct attribute-family stimulus.
test("(1) a TECHNICAL session creates stimulus toward TECHNICAL-family attributes (e.g. PASSING) for an outcourt player", () => {
  const stimulus = computeSessionAttributeStimulus("TECHNICAL", "NORMAL", "NORMAL", "FULL", false, null, "seed-1");
  assert.ok((stimulus.PASSING ?? 0) > 0, `expected PASSING stimulus, got ${JSON.stringify(stimulus)}`);
});

// (2) recovery creates zero normal development stimulus.
test("(2) a RECOVERY session creates zero development stimulus", () => {
  const stimulus = computeSessionAttributeStimulus("RECOVERY", "NORMAL", "NORMAL", "FULL", false, null, "seed-2");
  assert.equal(sum(stimulus), 0);
});

test("MATCH_PREPARATION also creates zero (or negligible) development stimulus, per spec Part 5", () => {
  const stimulus = computeSessionAttributeStimulus("MATCH_PREPARATION", "NORMAL", "NORMAL", "FULL", false, null, "seed-2b");
  assert.equal(sum(stimulus), 0);
});

// (3) REST player gets zero stimulus.
test("(3) a REST participation setting produces zero stimulus regardless of session type", () => {
  const stimulus = computeSessionAttributeStimulus("TECHNICAL", "HIGH", "LONG", "REST", false, null, "seed-3");
  assert.equal(sum(stimulus), 0);
});

test("RECOVERY_ONLY participation also produces zero normal development stimulus (Part 7)", () => {
  const stimulus = computeSessionAttributeStimulus("TECHNICAL", "HIGH", "LONG", "RECOVERY_ONLY", false, null, "seed-3b");
  assert.equal(sum(stimulus), 0);
});

// (4) REDUCED < FULL stimulus.
test("(4) REDUCED participation produces strictly less stimulus than FULL, all else equal", () => {
  const full = sum(computeSessionAttributeStimulus("TECHNICAL", "NORMAL", "NORMAL", "FULL", false, null, "seed-4"));
  const reduced = sum(computeSessionAttributeStimulus("TECHNICAL", "NORMAL", "NORMAL", "REDUCED", false, null, "seed-4"));
  assert.ok(reduced < full && reduced > 0, `full=${full} reduced=${reduced}`);
});

// (5) individual focus increases relevant stimulus.
test("(5) a matching individual focus increases stimulus toward its own family versus NORMAL", () => {
  const normal = computeSessionAttributeStimulus("TECHNICAL", "NORMAL", "NORMAL", "FULL", false, "NORMAL", "seed-5");
  const focused = computeSessionAttributeStimulus("TECHNICAL", "NORMAL", "NORMAL", "FULL", false, "TECHNICAL", "seed-5");
  assert.ok(sum(focused) >= sum(normal) * 0.99, `expected focus not to reduce total noticeably, normal=${sum(normal)} focused=${sum(focused)}`);
  assert.ok((focused.PASSING ?? 0) > (normal.PASSING ?? 0), `expected boosted PASSING under focus, normal=${normal.PASSING} focused=${focused.PASSING}`);
});

test("a focus on a family NOT touched by this session has no effect (pure emphasis, never a new stimulus source)", () => {
  const normal = computeSessionAttributeStimulus("TECHNICAL", "NORMAL", "NORMAL", "FULL", false, "NORMAL", "seed-5b");
  const irrelevantFocus = computeSessionAttributeStimulus("TECHNICAL", "NORMAL", "NORMAL", "FULL", false, "DEFENCE", "seed-5b");
  assert.deepEqual(normal, irrelevantFocus);
});

// (6) individual focus does not directly increase attribute -- proven at
// the integration layer (developmentIntegration.test.ts item 6), since
// this module never touches an attribute value at all; confirmed here
// structurally: stimulus is always a small fraction, never a whole point.
test("(6) even a focused, HIGH-intensity, LONG-duration session's stimulus stays a small fraction, never a whole attribute point's worth in one session", () => {
  const stimulus = computeSessionAttributeStimulus("TECHNICAL", "VERY_HIGH", "LONG", "FULL", false, "TECHNICAL", "seed-6");
  for (const v of Object.values(stimulus)) {
    assert.ok((v ?? 0) < 1, `expected < 1 stimulus unit per attribute per session, got ${v}`);
  }
});

// (18)/(19)/(20)/(21) match exposure stimulus.
test("(18) match exposure produces bounded, non-zero development stimulus for an outcourt player with real attack exposure", () => {
  const stimulus = computeMatchAttributeStimulus(0.8, 0.2, 0, false, "seed-18");
  assert.ok(sum(stimulus) > 0);
});

test("(19) a goalkeeper's match stimulus targets only goalkeeper-family attributes", () => {
  const stimulus = computeMatchAttributeStimulus(0, 0, 0.9, true, "seed-19");
  assert.ok((stimulus.GK_POSITIONING ?? 0) > 0 || (stimulus.SHOOTER_READING ?? 0) > 0 || (stimulus.OUTLET_PASSING ?? 0) > 0, JSON.stringify(stimulus));
  // No outcourt-only attribute should ever appear on a GK's match stimulus.
  assert.equal(stimulus.PASSING, undefined);
});

test("(20)/outcourt never receives goalkeeper-family match stimulus", () => {
  const stimulus = computeMatchAttributeStimulus(0.5, 0.5, 0, false, "seed-20");
  assert.equal(stimulus.GK_POSITIONING, undefined);
});

// (21) zero match exposure creates no match stimulus.
test("(21) zero exposure across the board produces zero match stimulus", () => {
  const outcourt = computeMatchAttributeStimulus(0, 0, 0, false, "seed-21a");
  const gk = computeMatchAttributeStimulus(0, 0, 0, true, "seed-21b");
  assert.equal(sum(outcourt), 0);
  assert.equal(sum(gk), 0);
});

// (22) more playing exposure > less exposure, within cap.
test("(22) higher attack exposure produces strictly more stimulus than lower exposure, all else equal", () => {
  const low = sum(computeMatchAttributeStimulus(0.2, 0, 0, false, "seed-22"));
  const high = sum(computeMatchAttributeStimulus(0.9, 0, 0, false, "seed-22"));
  assert.ok(high > low, `low=${low} high=${high}`);
});
