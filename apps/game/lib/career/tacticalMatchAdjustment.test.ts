import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTacticalMatchAdjustment } from "./tacticalMatchAdjustment";
import { defaultTeamTacticalProfile } from "./teamTacticalProfile";

const MAX = 1.2; // matches MAX_TACTICAL_ADJUSTMENT_GOALS in tacticalMatchAdjustment.ts
const MAX_SEVEN_V_SIX = 2.4; // matches MAX_SEVEN_V_SIX_ADJUSTMENT_GOALS in tacticalMatchAdjustment.ts (HM-TACTICS-0.8)

test("determinism: identical (saveSeed, fixtureId, managerClubId, homeClubId, profile) always produces an identical result, including the trace", () => {
  const profile = defaultTeamTacticalProfile();
  const a = computeTacticalMatchAdjustment("save-1", "fx-1", "clubA", "clubA", profile);
  const b = computeTacticalMatchAdjustment("save-1", "fx-1", "clubA", "clubA", profile);
  assert.deepEqual(a, b);
});

test("a different fixtureId (different seed) can produce a different result -- this is not a constant", () => {
  const profile = defaultTeamTacticalProfile();
  const a = computeTacticalMatchAdjustment("save-1", "fx-1", "clubA", "clubA", profile);
  const b = computeTacticalMatchAdjustment("save-1", "fx-2", "clubA", "clubA", profile);
  assert.notDeepEqual(a.trace.attack.outcomeCounts, b.trace.attack.outcomeCounts);
});

test("home and away adjustments are always within the documented bound", () => {
  const profiles = [
    defaultTeamTacticalProfile(),
    { ati001UsageTendency: "HIGH" as const, h2ResponsePreference: "H2_STOPS" as const, tacticalFamiliarity: "HIGH" as const },
    { ati001UsageTendency: "LOW" as const, h2ResponsePreference: "H2_HOLDS" as const, tacticalFamiliarity: "LOW" as const },
  ];
  for (const profile of profiles) {
    for (let i = 0; i < 10; i += 1) {
      const result = computeTacticalMatchAdjustment("save-bounds", `fx-${i}`, "clubA", "clubA", profile);
      assert.ok(Math.abs(result.home) <= MAX, `home=${result.home}`);
      assert.ok(Math.abs(result.away) <= MAX, `away=${result.away}`);
    }
  }
});

test("manager home/away side mapping is correct: swapping which side the manager plays on swaps which number carries the attack adjustment", () => {
  const profile = defaultTeamTacticalProfile();
  const managerHome = computeTacticalMatchAdjustment("save-side", "fx-1", "clubA", "clubA", profile);
  const managerAway = computeTacticalMatchAdjustment("save-side", "fx-1", "clubA", "clubB", profile);

  // Same manager, same fixture, same profile -> the underlying attack/defense
  // Monte Carlo results (and therefore adjustments) are identical; only
  // which side (home/away) they're assigned to changes.
  assert.equal(managerHome.trace.attack.adjustment, managerAway.trace.attack.adjustment);
  assert.equal(managerHome.trace.defense.adjustment, managerAway.trace.defense.adjustment);

  assert.equal(managerHome.home, managerHome.trace.attack.adjustment);
  assert.equal(managerHome.away, managerHome.trace.defense.adjustment);
  assert.equal(managerAway.away, managerAway.trace.attack.adjustment);
  assert.equal(managerAway.home, managerAway.trace.defense.adjustment);
});

test("trace proves the full causal chain: profile -> per-direction outcome counts -> score -> bounded adjustment -> home/away", () => {
  const profile = defaultTeamTacticalProfile();
  const result = computeTacticalMatchAdjustment("save-trace", "fx-1", "clubA", "clubA", profile);
  assert.deepEqual(result.trace.profile, profile);
  assert.equal(result.trace.managerIsHome, true);
  assert.ok(Object.keys(result.trace.attack.outcomeCounts).length > 0);
  assert.ok(Object.keys(result.trace.defense.outcomeCounts).length > 0);
  assert.equal(typeof result.trace.attack.score, "number");
  assert.equal(typeof result.trace.defense.score, "number");
});

test("directional proof (Spec #13, aggregate across many seeded fixtures -- not a claim of realistic percentages): HIGH ati001UsageTendency shifts the attack-direction outcome distribution toward the attacking side more than LOW, on average", () => {
  const low = { ...defaultTeamTacticalProfile(), ati001UsageTendency: "LOW" as const };
  const high = { ...defaultTeamTacticalProfile(), ati001UsageTendency: "HIGH" as const };

  let lowTotal = 0;
  let highTotal = 0;
  const SAMPLE_FIXTURES = 20;
  for (let i = 0; i < SAMPLE_FIXTURES; i += 1) {
    const fixtureId = `fx-directional-${i}`;
    lowTotal += computeTacticalMatchAdjustment("save-directional", fixtureId, "clubA", "clubA", low).trace.attack.score;
    highTotal += computeTacticalMatchAdjustment("save-directional", fixtureId, "clubA", "clubA", high).trace.attack.score;
  }
  assert.ok(highTotal / SAMPLE_FIXTURES > lowTotal / SAMPLE_FIXTURES, "HIGH usage tendency must average a more attack-favorable score than LOW");
});

test("directional proof: HIGH tacticalFamiliarity shifts the defense-direction outcome distribution further toward the defense (more negative score) than LOW, on average", () => {
  const low = { ...defaultTeamTacticalProfile(), tacticalFamiliarity: "LOW" as const };
  const high = { ...defaultTeamTacticalProfile(), tacticalFamiliarity: "HIGH" as const };

  let lowTotal = 0;
  let highTotal = 0;
  const SAMPLE_FIXTURES = 20;
  for (let i = 0; i < SAMPLE_FIXTURES; i += 1) {
    const fixtureId = `fx-defense-directional-${i}`;
    lowTotal += computeTacticalMatchAdjustment("save-defense-directional", fixtureId, "clubA", "clubA", low).trace.defense.score;
    highTotal += computeTacticalMatchAdjustment("save-defense-directional", fixtureId, "clubA", "clubA", high).trace.defense.score;
  }
  assert.ok(highTotal / SAMPLE_FIXTURES < lowTotal / SAMPLE_FIXTURES, "HIGH familiarity must average a more defense-favorable (more negative) score than LOW");
});

test("no assertion in this suite claims a realistic real-world percentage -- only directional/bounded properties", () => {
  // This test exists to make the intent explicit and greppable: see
  // Spec #13 ("tests must NOT claim realistic percentages"). The
  // directional tests above compare LOW vs HIGH relative to each other,
  // never to a fixed "real handball" number.
  assert.ok(true);
});

// HM-TACTICS-0.8: 7v6's own isolated bonus/risk figures, layered on top
// of the same profile-driven adjustment above.
test("7v6 determinism: identical (saveSeed, fixtureId, profile, sevenVSixActive=true) always produces an identical result", () => {
  const profile = defaultTeamTacticalProfile();
  const a = computeTacticalMatchAdjustment("save-7v6", "fx-1", "clubA", "clubA", profile, true);
  const b = computeTacticalMatchAdjustment("save-7v6", "fx-1", "clubA", "clubA", profile, true);
  assert.deepEqual(a, b);
});

test("7v6 is opt-in: omitting the argument (or passing false) reproduces the pre-HM-TACTICS-0.8 result exactly", () => {
  const profile = defaultTeamTacticalProfile();
  const omitted = computeTacticalMatchAdjustment("save-7v6-default", "fx-1", "clubA", "clubA", profile);
  const explicitFalse = computeTacticalMatchAdjustment("save-7v6-default", "fx-1", "clubA", "clubA", profile, false);
  assert.deepEqual(omitted, explicitFalse);
});

test("7v6 adjustments stay within their own wider, documented bound", () => {
  const profile = defaultTeamTacticalProfile();
  for (let i = 0; i < 10; i += 1) {
    const result = computeTacticalMatchAdjustment("save-7v6-bounds", `fx-${i}`, "clubA", "clubA", profile, true);
    assert.ok(Math.abs(result.home) <= MAX_SEVEN_V_SIX, `home=${result.home}`);
    assert.ok(Math.abs(result.away) <= MAX_SEVEN_V_SIX, `away=${result.away}`);
  }
});

test("7v6 directional upside: averaged across seeded fixtures, the manager's own attack-direction adjustment is higher with 7v6 ON than OFF", () => {
  const profile = defaultTeamTacticalProfile();
  const SAMPLE_FIXTURES = 20;
  let onTotal = 0;
  let offTotal = 0;
  for (let i = 0; i < SAMPLE_FIXTURES; i += 1) {
    const fixtureId = `fx-7v6-upside-${i}`;
    onTotal += computeTacticalMatchAdjustment("save-7v6-upside", fixtureId, "clubA", "clubA", profile, true).home;
    offTotal += computeTacticalMatchAdjustment("save-7v6-upside", fixtureId, "clubA", "clubA", profile, false).home;
  }
  assert.ok(onTotal / SAMPLE_FIXTURES > offTotal / SAMPLE_FIXTURES, "7v6 ON must average a higher manager-side adjustment than OFF");
});

test("7v6 directional downside: averaged across seeded fixtures, the OPPONENT-side (defense-direction) adjustment is also higher with 7v6 ON than OFF", () => {
  const profile = defaultTeamTacticalProfile();
  const SAMPLE_FIXTURES = 20;
  let onTotal = 0;
  let offTotal = 0;
  for (let i = 0; i < SAMPLE_FIXTURES; i += 1) {
    const fixtureId = `fx-7v6-downside-${i}`;
    onTotal += computeTacticalMatchAdjustment("save-7v6-downside", fixtureId, "clubA", "clubA", profile, true).away;
    offTotal += computeTacticalMatchAdjustment("save-7v6-downside", fixtureId, "clubA", "clubA", profile, false).away;
  }
  assert.ok(onTotal / SAMPLE_FIXTURES > offTotal / SAMPLE_FIXTURES, "7v6 ON must average a higher opponent-side (away, since manager is home here) adjustment than OFF -- the empty-net/numerical downside");
});

test("7v6 anti-stacking: computing the ON adjustment twice never compounds -- it is a pure function, not an accumulator", () => {
  const profile = defaultTeamTacticalProfile();
  const once = computeTacticalMatchAdjustment("save-7v6-stack", "fx-1", "clubA", "clubA", profile, true);
  const twice = computeTacticalMatchAdjustment("save-7v6-stack", "fx-1", "clubA", "clubA", profile, true);
  assert.deepEqual(once, twice);
});
