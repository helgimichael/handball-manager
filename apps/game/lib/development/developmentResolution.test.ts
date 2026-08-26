// HM-TRAINING-1.1 Part 33: directional proofs for the pure weekly
// resolution math (lib/development/developmentResolution.ts) -- age,
// headroom, fatigue, CA recompute, thresholds, diminishing returns. No
// CareerState involved -- see developmentIntegration.test.ts for the
// domain-integration layer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN } from "../rating/types";
import { ageDevelopmentMultiplier, fatigueDevelopmentMultiplier, headroomDevelopmentMultiplier, PROGRESS_THRESHOLD_PER_POINT, resolveAttributeForWeek } from "./developmentResolution";

// (11) younger comparable player develops faster than older -- via age multiplier directly.
test("(11) ageDevelopmentMultiplier is strictly higher for a young player than a veteran", () => {
  const young = ageDevelopmentMultiplier(19);
  const prime = ageDevelopmentMultiplier(26);
  const veteran = ageDevelopmentMultiplier(33);
  assert.ok(young > prime, `young=${young} prime=${prime}`);
  assert.ok(prime > veteran, `prime=${prime} veteran=${veteran}`);
});

test("age multiplier has no hard cliff -- adjacent ages differ smoothly, never a step to near-zero", () => {
  const a = ageDevelopmentMultiplier(29);
  const b = ageDevelopmentMultiplier(30);
  assert.ok(Math.abs(a - b) < 0.15, `expected a smooth step, got a=${a} b=${b}`);
});

// (12) high-headroom player develops faster than low-headroom.
test("(12) headroomDevelopmentMultiplier is strictly higher for a large CA/PA gap than a small one", () => {
  const highHeadroom = headroomDevelopmentMultiplier(100, 160); // 60pt gap
  const lowHeadroom = headroomDevelopmentMultiplier(100, 110); // 10pt gap
  assert.ok(highHeadroom > lowHeadroom, `high=${highHeadroom} low=${lowHeadroom}`);
});

// (13) at/near potential development slows -- never an absolute wall.
test("(13) at or above potential, the headroom multiplier is extremely small but never exactly zero", () => {
  const atPotential = headroomDevelopmentMultiplier(150, 150);
  const abovePotential = headroomDevelopmentMultiplier(160, 150);
  assert.ok(atPotential > 0);
  assert.ok(abovePotential > 0);
  assert.ok(atPotential < 0.1);
});

// (25) very low energy reduces development efficiency.
test("(25) fatigueDevelopmentMultiplier is strictly lower at low energy than at high energy", () => {
  const fresh = fatigueDevelopmentMultiplier(95);
  const exhausted = fatigueDevelopmentMultiplier(5);
  assert.ok(fresh > exhausted, `fresh=${fresh} exhausted=${exhausted}`);
});

// (26) fatigue does not create negative attribute changes by itself.
test("(26) fatigueDevelopmentMultiplier never goes below its documented floor (never negative, never zero)", () => {
  assert.ok(fatigueDevelopmentMultiplier(0) > 0);
  assert.ok(fatigueDevelopmentMultiplier(0) >= 0.4 - 1e-9);
});

// (7) repeated sessions accumulate stimulus / (8) one session normally
// does not create visible +1 / (9) weekly resolution deterministic.
test("(8) a single, ordinary week's raw stimulus does not cross the point threshold for a fresh (age 24, big headroom, full energy) player", () => {
  const result = resolveAttributeForWeek("OUTCOURT", 10, 100, 160, 0, { attribute: "PASSING", rawStimulus: 0.5, age: 24, currentEnergy: 100 });
  assert.equal(result.event, undefined, `expected no visible change from a single small week, got ${JSON.stringify(result)}`);
  assert.ok(result.nextProgress > 0, "but progress should have moved forward");
});

test("(7)/(9)/(10) repeated identical weekly resolutions eventually cross the threshold, deterministically", () => {
  let progress = 0;
  let crossedAt = -1;
  for (let week = 1; week <= 60; week++) {
    const result = resolveAttributeForWeek("OUTCOURT", 10, 100, 160, progress, { attribute: "PASSING", rawStimulus: 1.0, age: 20, currentEnergy: 100 });
    progress = result.nextProgress;
    if (result.event) {
      crossedAt = week;
      break;
    }
  }
  assert.ok(crossedAt > 1, `expected it to take more than 1 week, crossed at week ${crossedAt}`);
  assert.ok(crossedAt < 60, "expected it to eventually cross within 60 weeks at this stimulus rate");

  // (10) same seed/history = same result -- pure function, re-running the identical sequence reproduces the identical crossing week.
  let progress2 = 0;
  let crossedAt2 = -1;
  for (let week = 1; week <= 60; week++) {
    const result = resolveAttributeForWeek("OUTCOURT", 10, 100, 160, progress2, { attribute: "PASSING", rawStimulus: 1.0, age: 20, currentEnergy: 100 });
    progress2 = result.nextProgress;
    if (result.event) {
      crossedAt2 = week;
      break;
    }
  }
  assert.equal(crossedAt, crossedAt2);
});

// (14) attribute bounds respected.
test("(14) a value already at ATTRIBUTE_MAX never exceeds it even when the threshold is crossed", () => {
  const result = resolveAttributeForWeek("OUTCOURT", ATTRIBUTE_MAX, 190, 200, PROGRESS_THRESHOLD_PER_POINT, { attribute: "PASSING", rawStimulus: 5, age: 20, currentEnergy: 100 });
  assert.equal(result.event, undefined, "no event should fire once already at the cap");
});

test("(14) a resolved value is always within [ATTRIBUTE_MIN, ATTRIBUTE_MAX]", () => {
  const result = resolveAttributeForWeek("OUTCOURT", 19, 100, 190, PROGRESS_THRESHOLD_PER_POINT, { attribute: "PASSING", rawStimulus: 5, age: 20, currentEnergy: 100 });
  if (result.event) {
    assert.ok(result.event.newValue >= ATTRIBUTE_MIN && result.event.newValue <= ATTRIBUTE_MAX);
  }
});

// (15) CA recomputed from attributes rather than separately incremented.
test("(15) crossing the threshold produces a nonzero, bounded CA delta derived from the attribute change -- never zero when a point is gained", () => {
  const result = resolveAttributeForWeek("OUTCOURT", 10, 100, 190, PROGRESS_THRESHOLD_PER_POINT, { attribute: "PASSING", rawStimulus: 5, age: 20, currentEnergy: 100 });
  assert.ok(result.event, "expected a point to be gained here");
  assert.ok(result.caDelta > 0, `expected a positive CA delta, got ${result.caDelta}`);
  assert.ok(result.caDelta < 5, `CA delta from ONE attribute point must be small, got ${result.caDelta}`);
});

test("no event -> zero CA delta (no silent CA drift without an attribute change)", () => {
  const result = resolveAttributeForWeek("OUTCOURT", 10, 100, 160, 0, { attribute: "PASSING", rawStimulus: 0.3, age: 24, currentEnergy: 100 });
  assert.equal(result.event, undefined);
  assert.equal(result.caDelta, 0);
});

test("a goalkeeper-branch attribute point produces a LARGER per-point CA nudge than an outcourt one (21 GK attributes vs 56 outcourt -- each GK attribute is a bigger fractional share of overall ability)", () => {
  const outcourtResult = resolveAttributeForWeek("OUTCOURT", 10, 100, 190, PROGRESS_THRESHOLD_PER_POINT, { attribute: "PASSING", rawStimulus: 5, age: 20, currentEnergy: 100 });
  const gkResult = resolveAttributeForWeek("GOALKEEPER", 10, 100, 190, PROGRESS_THRESHOLD_PER_POINT, { attribute: "GK_POSITIONING", rawStimulus: 5, age: 20, currentEnergy: 100 });
  assert.ok(gkResult.caDelta > outcourtResult.caDelta, `outcourt=${outcourtResult.caDelta} gk=${gkResult.caDelta}`);
});

// (23)/(24) diminishing returns / weekly cap.
test("(23)/(24) an absurdly large raw stimulus in one week still gains at most ONE point (never multiple jumps), even starting from progress already near the threshold", () => {
  const nearThreshold = PROGRESS_THRESHOLD_PER_POINT - 0.5;
  const result = resolveAttributeForWeek("OUTCOURT", 10, 100, 190, nearThreshold, { attribute: "PASSING", rawStimulus: 1000, age: 20, currentEnergy: 100 });
  assert.ok(result.event, `expected a point to be gained, got ${JSON.stringify(result)}`);
  assert.equal(result.event!.newValue - result.event!.previousValue, 1);
});

test("(23) the weekly effective-stimulus cap means even an absurd single-week input alone (starting from zero progress) cannot cross the threshold -- diminishing returns, not unlimited improvement", () => {
  const result = resolveAttributeForWeek("OUTCOURT", 10, 100, 190, 0, { attribute: "PASSING", rawStimulus: 1000, age: 20, currentEnergy: 100 });
  assert.equal(result.event, undefined, "one week's capped effective stimulus should not, by itself, cross the multi-week threshold");
  assert.ok(result.nextProgress < PROGRESS_THRESHOLD_PER_POINT, `progress=${result.nextProgress}`);
});

test("(23) doubling raw stimulus well past the cap does not double the effective progress made (diminishing returns)", () => {
  const modest = resolveAttributeForWeek("OUTCOURT", 10, 100, 160, 0, { attribute: "PASSING", rawStimulus: 3, age: 24, currentEnergy: 100 });
  const huge = resolveAttributeForWeek("OUTCOURT", 10, 100, 160, 0, { attribute: "PASSING", rawStimulus: 30, age: 24, currentEnergy: 100 });
  // Progress from `huge` should be capped, not 10x `modest`'s.
  assert.ok(huge.nextProgress < modest.nextProgress * 10);
});

// (17) physical attribute != current energy -- proven structurally: this
// module's inputs never write to/read from a currentEnergy STATE field,
// only consume it as one INPUT multiplier; confirmed by type signature
// (AttributeResolutionInputs.currentEnergy is a plain number parameter,
// never returned or mutated).
test("(17) resolveAttributeForWeek never returns or mutates an energy value -- only ever an attribute/progress/CA result", () => {
  const result = resolveAttributeForWeek("OUTCOURT", 10, 100, 160, 0, { attribute: "STRENGTH", rawStimulus: 1, age: 24, currentEnergy: 40 });
  assert.ok(!("currentEnergy" in result));
  assert.ok(!("energy" in result));
});
