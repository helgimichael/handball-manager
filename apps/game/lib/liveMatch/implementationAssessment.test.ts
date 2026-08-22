import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyProfileMask,
  assessImplementation,
  changedProfileFields,
  IMPLEMENTATION_DELAY_EXTENSION_MINUTES,
  PROFILE_FIELD_ORDER,
  RECENT_CHANGE_WINDOW_MINUTES,
  type ImplementationContext,
} from "./implementationAssessment";
import { defaultTeamTacticalProfile } from "../career/teamTacticalProfile";

function baseContext(overrides: Partial<ImplementationContext> = {}): ImplementationContext {
  return {
    tacticalFamiliarity: "MEDIUM",
    deliveryMode: "SIDELINE",
    changedUnitCount: 1,
    recentChangeCount: 0,
    ...overrides,
  };
}

test("determinism: identical seed + context always produce an identical assessment", () => {
  const context = baseContext({ changedUnitCount: 3 });
  const a = assessImplementation(42, context);
  const b = assessImplementation(42, context);
  assert.deepEqual(a, b);
});

test("a different seed can (not must) produce a different outcome -- this is not a constant function", () => {
  const context = baseContext({ changedUnitCount: 3 });
  const outcomes = new Set<string>();
  for (let seed = 0; seed < 40; seed += 1) {
    outcomes.add(assessImplementation(seed, context).outcome);
  }
  assert.ok(outcomes.size > 1, "varying the seed must be able to reach more than one outcome");
});

test("adoptedUnitMask always has length === changedUnitCount", () => {
  for (let changedUnitCount = 0; changedUnitCount <= 3; changedUnitCount += 1) {
    for (let seed = 0; seed < 15; seed += 1) {
      const result = assessImplementation(seed, baseContext({ changedUnitCount }));
      assert.equal(result.adoptedUnitMask.length, changedUnitCount);
    }
  }
});

test("PARTIAL never occurs for a single-unit change (Spec: 7v6's ON/OFF and a 1-field profile change can only be FULL or DELAYED)", () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const result = assessImplementation(seed, baseContext({ changedUnitCount: 1 }));
    assert.notEqual(result.outcome, "PARTIAL");
    assert.deepEqual(result.adoptedUnitMask, [true]);
  }
  for (let seed = 0; seed < 200; seed += 1) {
    const result = assessImplementation(seed, baseContext({ changedUnitCount: 0 }));
    assert.notEqual(result.outcome, "PARTIAL");
  }
});

test("PARTIAL, when it occurs for a multi-unit change, always leaves at least one unit adopted and at least one not -- otherwise it would just be FULL or a full miss", () => {
  let sawPartial = false;
  for (let seed = 0; seed < 500; seed += 1) {
    const result = assessImplementation(seed, baseContext({ changedUnitCount: 3 }));
    if (result.outcome === "PARTIAL") {
      sawPartial = true;
      const trueCount = result.adoptedUnitMask.filter(Boolean).length;
      assert.ok(trueCount >= 1 && trueCount < result.adoptedUnitMask.length, `mask=${result.adoptedUnitMask}`);
    }
  }
  assert.ok(sawPartial, "expected at least one PARTIAL outcome across 500 seeded assessments of a 3-field change");
});

test("FULL and DELAYED both eventually apply every requested unit -- their mask is always all-true", () => {
  for (let seed = 0; seed < 200; seed += 1) {
    const result = assessImplementation(seed, baseContext({ changedUnitCount: 3 }));
    if (result.outcome !== "PARTIAL") {
      assert.deepEqual(result.adoptedUnitMask, [true, true, true]);
    }
  }
});

test("directional: HIGH tacticalFamiliarity yields FULL more often (and DELAYED less often) than LOW, averaged over many seeds (never a claim of realistic percentages)", () => {
  const SAMPLES = 300;
  let fullAtLow = 0;
  let fullAtHigh = 0;
  let delayedAtLow = 0;
  let delayedAtHigh = 0;
  for (let seed = 0; seed < SAMPLES; seed += 1) {
    const low = assessImplementation(seed, baseContext({ tacticalFamiliarity: "LOW", changedUnitCount: 2 }));
    const high = assessImplementation(seed, baseContext({ tacticalFamiliarity: "HIGH", changedUnitCount: 2 }));
    if (low.outcome === "FULL") fullAtLow += 1;
    if (high.outcome === "FULL") fullAtHigh += 1;
    if (low.outcome === "DELAYED") delayedAtLow += 1;
    if (high.outcome === "DELAYED") delayedAtHigh += 1;
  }
  assert.ok(fullAtHigh > fullAtLow, `HIGH familiarity must reach FULL more often than LOW (high=${fullAtHigh}, low=${fullAtLow})`);
  assert.ok(delayedAtHigh < delayedAtLow, `HIGH familiarity must reach DELAYED less often than LOW (high=${delayedAtHigh}, low=${delayedAtLow})`);
});

test("directional: TIMEOUT delivery yields FULL more often (and DELAYED less often) than SIDELINE, averaged over many seeds -- delivery reliability only, never a claim about tactical strength", () => {
  const SAMPLES = 300;
  let fullAtSideline = 0;
  let fullAtTimeout = 0;
  let delayedAtSideline = 0;
  let delayedAtTimeout = 0;
  for (let seed = 0; seed < SAMPLES; seed += 1) {
    const sideline = assessImplementation(seed, baseContext({ deliveryMode: "SIDELINE", changedUnitCount: 2 }));
    const timeout = assessImplementation(seed, baseContext({ deliveryMode: "TIMEOUT", changedUnitCount: 2 }));
    if (sideline.outcome === "FULL") fullAtSideline += 1;
    if (timeout.outcome === "FULL") fullAtTimeout += 1;
    if (sideline.outcome === "DELAYED") delayedAtSideline += 1;
    if (timeout.outcome === "DELAYED") delayedAtTimeout += 1;
  }
  assert.ok(fullAtTimeout > fullAtSideline, `TIMEOUT must reach FULL more often than SIDELINE (timeout=${fullAtTimeout}, sideline=${fullAtSideline})`);
  assert.ok(delayedAtTimeout < delayedAtSideline, `TIMEOUT must reach DELAYED less often than SIDELINE (timeout=${delayedAtTimeout}, sideline=${delayedAtSideline})`);
});

test("HM-TACTICS-0.9 directional: HALFTIME delivery yields FULL more often (and DELAYED less often) than TIMEOUT, averaged over many seeds -- still delivery reliability only, never a claim about tactical strength", () => {
  const SAMPLES = 300;
  let fullAtTimeout = 0;
  let fullAtHalftime = 0;
  let delayedAtTimeout = 0;
  let delayedAtHalftime = 0;
  for (let seed = 0; seed < SAMPLES; seed += 1) {
    const timeout = assessImplementation(seed, baseContext({ deliveryMode: "TIMEOUT", changedUnitCount: 2 }));
    const halftime = assessImplementation(seed, baseContext({ deliveryMode: "HALFTIME", changedUnitCount: 2 }));
    if (timeout.outcome === "FULL") fullAtTimeout += 1;
    if (halftime.outcome === "FULL") fullAtHalftime += 1;
    if (timeout.outcome === "DELAYED") delayedAtTimeout += 1;
    if (halftime.outcome === "DELAYED") delayedAtHalftime += 1;
  }
  assert.ok(fullAtHalftime > fullAtTimeout, `HALFTIME must reach FULL more often than TIMEOUT (halftime=${fullAtHalftime}, timeout=${fullAtTimeout})`);
  assert.ok(delayedAtHalftime < delayedAtTimeout, `HALFTIME must reach DELAYED less often than TIMEOUT (halftime=${delayedAtHalftime}, timeout=${delayedAtTimeout})`);
});

test("directional: more recent tactical changes yield FULL less often (and DELAYED more often) than none, averaged over many seeds -- bounded, not an unlimited spiral", () => {
  const SAMPLES = 300;
  let fullAtZero = 0;
  let fullAtMany = 0;
  for (let seed = 0; seed < SAMPLES; seed += 1) {
    const calm = assessImplementation(seed, baseContext({ recentChangeCount: 0, changedUnitCount: 2 }));
    const rapid = assessImplementation(seed, baseContext({ recentChangeCount: 4, changedUnitCount: 2 }));
    if (calm.outcome === "FULL") fullAtZero += 1;
    if (rapid.outcome === "FULL") fullAtMany += 1;
  }
  assert.ok(fullAtZero > fullAtMany, `many recent changes must reach FULL less often than none (zero=${fullAtZero}, many=${fullAtMany})`);

  // Bounded: going even further beyond the documented cap must not keep making it worse.
  const atCap = assessImplementation(777, baseContext({ recentChangeCount: 4, changedUnitCount: 2 }));
  const wayPastCap = assessImplementation(777, baseContext({ recentChangeCount: 40, changedUnitCount: 2 }));
  assert.deepEqual(atCap, wayPastCap, "the recent-change penalty must be capped, not unbounded");
});

test("directional: more changed units (higher complexity) yields FULL less often than fewer, averaged over many seeds", () => {
  const SAMPLES = 300;
  let fullAtOne = 0;
  let fullAtThree = 0;
  for (let seed = 0; seed < SAMPLES; seed += 1) {
    const simple = assessImplementation(seed, baseContext({ changedUnitCount: 1 }));
    const complex = assessImplementation(seed, baseContext({ changedUnitCount: 3 }));
    if (simple.outcome === "FULL") fullAtOne += 1;
    if (complex.outcome === "FULL") fullAtThree += 1;
  }
  assert.ok(fullAtOne > fullAtThree, `a 1-unit change must reach FULL more often than a 3-unit change (one=${fullAtOne}, three=${fullAtThree})`);
});

test("no assertion in this suite claims a realistic real-world percentage -- only directional/bounded properties, and all calibration constants are isolated to this module", () => {
  assert.ok(IMPLEMENTATION_DELAY_EXTENSION_MINUTES > 0);
  assert.ok(RECENT_CHANGE_WINDOW_MINUTES > 0);
});

test("changedProfileFields lists only the fields that actually differ, in the fixed PROFILE_FIELD_ORDER", () => {
  const baseline = defaultTeamTacticalProfile();
  const requested = { ...baseline, h2ResponsePreference: "H2_STOPS" as const };
  assert.deepEqual(changedProfileFields(baseline, requested), ["h2ResponsePreference"]);

  const allChanged = { ati001UsageTendency: "HIGH" as const, h2ResponsePreference: "H2_STOPS" as const, tacticalFamiliarity: "HIGH" as const };
  assert.deepEqual(changedProfileFields(baseline, allChanged), [...PROFILE_FIELD_ORDER]);

  assert.deepEqual(changedProfileFields(baseline, baseline), []);
});

test("applyProfileMask: an all-true mask reproduces the requested profile exactly; a mixed mask keeps the baseline's value for masked-out fields", () => {
  const baseline = defaultTeamTacticalProfile();
  const requested = { ati001UsageTendency: "HIGH" as const, h2ResponsePreference: "H2_STOPS" as const, tacticalFamiliarity: "HIGH" as const };
  const changed = changedProfileFields(baseline, requested);

  const full = applyProfileMask(baseline, requested, changed, [true, true, true]);
  assert.deepEqual(full, requested);

  const partial = applyProfileMask(baseline, requested, changed, [true, false, true]);
  assert.equal(partial.ati001UsageTendency, requested.ati001UsageTendency);
  assert.equal(partial.h2ResponsePreference, baseline.h2ResponsePreference, "the masked-out field must keep the baseline's value, not the requested one");
  assert.equal(partial.tacticalFamiliarity, requested.tacticalFamiliarity);
});
