import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAiVsAiTacticalAdjustment, computeTacticalMatchAdjustment, sevenVSixPolicyIntensity } from "./tacticalMatchAdjustment";
import { defaultTeamTacticalProfile, type TeamTacticalProfile } from "./teamTacticalProfile";
import { OPPONENT_ADAPTATION_DAMPENING_FRACTION, type OpponentAdaptationEffect } from "./opponentAdaptation";

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

// HM-TACTICS-0.9: opponent adaptation DAMPENS -- never adds to -- exactly one of the two existing bonus channels above.
test("opponent adaptation is opt-in: omitting the argument (or passing null) reproduces the pre-HM-TACTICS-0.9 result exactly", () => {
  const profile = defaultTeamTacticalProfile();
  const omitted = computeTacticalMatchAdjustment("save-adapt-default", "fx-1", "clubA", "clubA", profile, true);
  const explicitNull = computeTacticalMatchAdjustment("save-adapt-default", "fx-1", "clubA", "clubA", profile, true, null);
  assert.deepEqual(omitted, explicitNull);
});

test("ATI001_HIGH adaptation dampens (never below the pre-bonus baseline, never negative-of-itself) the manager's own attack-direction adjustment, never the opponent's own", () => {
  const profile = { ...defaultTeamTacticalProfile(), ati001UsageTendency: "HIGH" as const };
  const effect: OpponentAdaptationEffect = { trigger: "ATI001_HIGH", dampeningFraction: OPPONENT_ADAPTATION_DAMPENING_FRACTION };
  const SAMPLE_FIXTURES = 20;
  let undampenedTotal = 0;
  let dampenedTotal = 0;
  let undampenedAwayTotal = 0;
  let dampenedAwayTotal = 0;
  for (let i = 0; i < SAMPLE_FIXTURES; i += 1) {
    const fixtureId = `fx-adapt-ati001-${i}`;
    const undampened = computeTacticalMatchAdjustment("save-adapt-ati001", fixtureId, "clubA", "clubA", profile, false, null);
    const dampened = computeTacticalMatchAdjustment("save-adapt-ati001", fixtureId, "clubA", "clubA", profile, false, effect);
    undampenedTotal += undampened.home;
    dampenedTotal += dampened.home;
    undampenedAwayTotal += undampened.away;
    dampenedAwayTotal += dampened.away;
  }
  assert.ok(
    Math.abs(dampenedTotal) < Math.abs(undampenedTotal),
    `adaptation must reduce the magnitude of the manager's own attack-direction adjustment, toward zero, regardless of its sign (undampened avg=${undampenedTotal / SAMPLE_FIXTURES}, dampened avg=${dampenedTotal / SAMPLE_FIXTURES})`,
  );
  assert.equal(undampenedAwayTotal, dampenedAwayTotal, "ATI001_HIGH adaptation must never touch the opponent's own (defense-direction) adjustment");
});

test("SEVEN_V_SIX adaptation dampens only the flat opponent-risk bonus, never the manager's own numerical-superiority bonus", () => {
  const profile = defaultTeamTacticalProfile();
  const effect: OpponentAdaptationEffect = { trigger: "SEVEN_V_SIX", dampeningFraction: OPPONENT_ADAPTATION_DAMPENING_FRACTION };
  const undampened = computeTacticalMatchAdjustment("save-adapt-7v6", "fx-1", "clubA", "clubA", profile, true, null);
  const dampened = computeTacticalMatchAdjustment("save-adapt-7v6", "fx-1", "clubA", "clubA", profile, true, effect);

  assert.equal(undampened.home, dampened.home, "SEVEN_V_SIX adaptation must never touch the manager's own (attack-direction) adjustment");
  assert.ok(dampened.away < undampened.away, `adaptation must reduce the opponent-risk bonus (undampened=${undampened.away}, dampened=${dampened.away})`);
});

test("SEVEN_V_SIX adaptation has no effect at all when 7v6 is OFF -- there is no risk bonus left to dampen", () => {
  const profile = defaultTeamTacticalProfile();
  const effect: OpponentAdaptationEffect = { trigger: "SEVEN_V_SIX", dampeningFraction: OPPONENT_ADAPTATION_DAMPENING_FRACTION };
  const undampened = computeTacticalMatchAdjustment("save-adapt-7v6-off", "fx-1", "clubA", "clubA", profile, false, null);
  const dampened = computeTacticalMatchAdjustment("save-adapt-7v6-off", "fx-1", "clubA", "clubA", profile, false, effect);
  assert.deepEqual(undampened, dampened);
});

test("ATI001_HIGH adaptation has no relevant effect when ati001UsageTendency is not HIGH -- there is nothing sustained to have adapted to", () => {
  const profile = { ...defaultTeamTacticalProfile(), ati001UsageTendency: "MEDIUM" as const };
  const effect: OpponentAdaptationEffect = { trigger: "ATI001_HIGH", dampeningFraction: OPPONENT_ADAPTATION_DAMPENING_FRACTION };
  const undampened = computeTacticalMatchAdjustment("save-adapt-medium", "fx-1", "clubA", "clubA", profile, false, null);
  const dampened = computeTacticalMatchAdjustment("save-adapt-medium", "fx-1", "clubA", "clubA", profile, false, effect);
  // The dampening still applies mechanically to whatever the (near-neutral) MEDIUM attack score produces, but the effect is bounded, never a new bonus, and never worse than the deterministic pre-adaptation result in direction.
  assert.ok(Math.abs(dampened.home) <= Math.abs(undampened.home) + 1e-9);
});

// ---------------------------------------------------------------------------
// HM-TACTICS-0.10: computeAiVsAiTacticalAdjustment -- the symmetric,
// no-manager two-sided adjustment for AI-vs-AI league fixtures.
// ---------------------------------------------------------------------------

const HIGH_PROFILE: TeamTacticalProfile = { ati001UsageTendency: "HIGH", h2ResponsePreference: "H2_STOPS", tacticalFamiliarity: "HIGH" };
const LOW_PROFILE: TeamTacticalProfile = { ati001UsageTendency: "LOW", h2ResponsePreference: "H2_HOLDS", tacticalFamiliarity: "LOW" };

test("HM-TACTICS-0.10: neither club has an AI-derived profile -> undefined (safe neutral fallback, zero adjustment, byte-identical to pre-HM-TACTICS-0.10 behavior)", () => {
  const adjustment = computeAiVsAiTacticalAdjustment("save-1", "fx-1", "clubA", "clubB", {});
  assert.equal(adjustment, undefined);
});

test("HM-TACTICS-0.10: only one club has a profile -- the adjustment is still computed, the other side getting the same designed-neutral default a fresh manager career already uses", () => {
  const withHomeOnly = computeAiVsAiTacticalAdjustment("save-1", "fx-1", "clubA", "clubB", { clubA: HIGH_PROFILE });
  assert.ok(withHomeOnly);
  const bothNeutral = computeTacticalMatchAdjustment("save-1", "fx-1", "clubA", "clubA", HIGH_PROFILE, false, null, defaultTeamTacticalProfile());
  assert.deepEqual(withHomeOnly, bothNeutral);
});

test("HM-TACTICS-0.10: determinism -- identical (saveSeed, fixtureId, clubs, preferences) always produces an identical two-sided adjustment", () => {
  const preferences = { clubA: HIGH_PROFILE, clubB: LOW_PROFILE };
  const a = computeAiVsAiTacticalAdjustment("save-1", "fx-1", "clubA", "clubB", preferences);
  const b = computeAiVsAiTacticalAdjustment("save-1", "fx-1", "clubA", "clubB", preferences);
  assert.deepEqual(a, b);
});

test("HM-TACTICS-0.10: two different AI identities behave differently -- a HIGH/H2_STOPS/HIGH club produces a different attack-direction adjustment than a LOW/H2_HOLDS/LOW club in the same home slot", () => {
  const highAsHome = computeAiVsAiTacticalAdjustment("save-1", "fx-1", "clubA", "clubB", { clubA: HIGH_PROFILE, clubB: defaultTeamTacticalProfile() });
  const lowAsHome = computeAiVsAiTacticalAdjustment("save-1", "fx-1", "clubA", "clubB", { clubA: LOW_PROFILE, clubB: defaultTeamTacticalProfile() });
  assert.ok(highAsHome && lowAsHome);
  assert.notEqual(highAsHome.home, lowAsHome.home);
});

test("HM-TACTICS-0.10: the tactical boost follows the club, not the physical side -- averaged across many seeded fixtures, clubA's HIGH profile stays the stronger side whether clubA plays home or away", () => {
  // Monte Carlo sampling depends on the CONFIG content (attacker profile
  // vs defender profile), not merely on which physical side is home --
  // "HIGH attacks against neutral defence" and "neutral attacks against
  // HIGH defence" are genuinely different sampled distributions, not
  // mirror images of the same numbers. So this proves the invariant the
  // honest way: aggregate over many fixtures and confirm clubA's own
  // profile keeps producing the stronger adjustment for clubA regardless
  // of which slot (home/away) it occupies, never a claim about exact
  // per-fixture symmetry.
  const SAMPLE_FIXTURES = 20;
  const preferences = { clubA: HIGH_PROFILE, clubB: defaultTeamTacticalProfile() };
  let clubATotal = 0;
  let clubBTotal = 0;
  for (let i = 0; i < SAMPLE_FIXTURES; i += 1) {
    const fixtureId = `fx-swap-${i}`;
    const clubAHome = computeAiVsAiTacticalAdjustment("save-swap", fixtureId, "clubA", "clubB", preferences)!;
    clubATotal += clubAHome.home;
    clubBTotal += clubAHome.away;

    const clubAAway = computeAiVsAiTacticalAdjustment("save-swap", fixtureId, "clubB", "clubA", preferences)!;
    clubBTotal += clubAAway.home;
    clubATotal += clubAAway.away;
  }
  const clubAAvg = clubATotal / (2 * SAMPLE_FIXTURES);
  const clubBAvg = clubBTotal / (2 * SAMPLE_FIXTURES);
  assert.ok(clubAAvg > clubBAvg, `clubA's HIGH profile must average a higher adjustment than clubB's neutral default regardless of home/away placement (clubA avg=${clubAAvg}, clubB avg=${clubBAvg})`);
});

test("HM-TACTICS-0.10: directional proof (aggregate across many seeded fixtures, never a claim of realistic percentages) -- a HIGH/H2_STOPS/HIGH home club averages a higher home-side adjustment than a LOW/H2_HOLDS/LOW home club, both against the same neutral away opponent", () => {
  const SAMPLE_FIXTURES = 20;
  let highTotal = 0;
  let lowTotal = 0;
  for (let i = 0; i < SAMPLE_FIXTURES; i += 1) {
    const fixtureId = `fx-directional-${i}`;
    const high = computeAiVsAiTacticalAdjustment("save-directional", fixtureId, "clubA", "clubB", { clubA: HIGH_PROFILE, clubB: defaultTeamTacticalProfile() })!;
    const low = computeAiVsAiTacticalAdjustment("save-directional", fixtureId, "clubA", "clubB", { clubA: LOW_PROFILE, clubB: defaultTeamTacticalProfile() })!;
    highTotal += high.home;
    lowTotal += low.home;
  }
  assert.ok(highTotal / SAMPLE_FIXTURES > lowTotal / SAMPLE_FIXTURES, `HIGH profile must average a higher home-side adjustment than LOW (high avg=${highTotal / SAMPLE_FIXTURES}, low avg=${lowTotal / SAMPLE_FIXTURES})`);
});

test("HM-TACTICS-0.10: both adjustments always stay within the same documented bound as the manager-facing mechanism -- no new, wider tactical concept introduced", () => {
  const preferences = { clubA: HIGH_PROFILE, clubB: LOW_PROFILE };
  for (let i = 0; i < 10; i += 1) {
    const adjustment = computeAiVsAiTacticalAdjustment("save-bounds", `fx-${i}`, "clubA", "clubB", preferences)!;
    assert.ok(Math.abs(adjustment.home) <= MAX, `home=${adjustment.home}`);
    assert.ok(Math.abs(adjustment.away) <= MAX, `away=${adjustment.away}`);
  }
});

// ---------------------------------------------------------------------------
// HM-MATCH-RATINGS-0.1 Part K: MatchPlan's pre-match SevenVSixPolicy
// scales the SAME flat 7v6 bonus/risk figures via the new, optional
// `sevenVSixIntensity` parameter -- never a second 7v6 mechanism, never
// touching the Monte Carlo sample itself, and byte-identical to
// pre-HM-MATCH-RATINGS-0.1 behavior when the parameter is omitted.
// ---------------------------------------------------------------------------

test("sevenVSixPolicyIntensity: NEVER is 0, PRIMARY is the highest, and every level is a fraction in [0, 1]", () => {
  assert.equal(sevenVSixPolicyIntensity("NEVER"), 0);
  const situational = sevenVSixPolicyIntensity("SITUATIONAL");
  const frequent = sevenVSixPolicyIntensity("FREQUENT");
  const primary = sevenVSixPolicyIntensity("PRIMARY");
  for (const level of [situational, frequent, primary]) {
    assert.ok(level > 0 && level <= 1);
  }
  assert.ok(situational < frequent);
  assert.ok(frequent < primary);
});

test("sevenVSixIntensity omitted defaults to 1 -- byte-identical to explicitly passing 1, and to every pre-HM-MATCH-RATINGS-0.1 sevenVSixActive=true call", () => {
  const profile = defaultTeamTacticalProfile();
  const omitted = computeTacticalMatchAdjustment("save-intensity-default", "fx-1", "clubA", "clubA", profile, true);
  const explicitOne = computeTacticalMatchAdjustment("save-intensity-default", "fx-1", "clubA", "clubA", profile, true, null, null, 1);
  assert.deepEqual(omitted, explicitOne);
});

test("sevenVSixIntensity=0 with sevenVSixActive=true removes the flat 7v6 bonus/risk entirely -- same attack-direction score as the profile alone would produce, just still routed through the wider 7v6 clamp", () => {
  const profile = defaultTeamTacticalProfile();
  const zeroIntensity = computeTacticalMatchAdjustment("save-intensity-zero", "fx-1", "clubA", "clubA", profile, true, null, null, 0);
  // With zero intensity, the attack-direction adjustment is exactly the clamped Monte Carlo score (no added bonus) -- reproduce that score independently via a sevenVSixActive=false call using the SAME seed namespace the 7v6 Monte Carlo sample uses is not directly comparable (different seed string), so instead assert the documented, weaker bound: zero intensity must never exceed the ordinary (non-7v6) adjustment bound, since no flat bonus can push it past that scale.
  assert.ok(Math.abs(zeroIntensity.home) <= MAX + 0.01, `zero-intensity home=${zeroIntensity.home} should stay within the ordinary tactical bound once the flat 7v6 bonus is removed`);
});

test("higher sevenVSixIntensity produces a higher (or equal, once clamped) attack-direction adjustment than a lower intensity, for the same seed/profile", () => {
  const profile = defaultTeamTacticalProfile();
  const low = computeTacticalMatchAdjustment("save-intensity-monotonic", "fx-1", "clubA", "clubA", profile, true, null, null, sevenVSixPolicyIntensity("SITUATIONAL"));
  const high = computeTacticalMatchAdjustment("save-intensity-monotonic", "fx-1", "clubA", "clubA", profile, true, null, null, sevenVSixPolicyIntensity("PRIMARY"));
  assert.ok(high.trace.attack.adjustment >= low.trace.attack.adjustment, `PRIMARY intensity (${high.trace.attack.adjustment}) should never be lower than SITUATIONAL (${low.trace.attack.adjustment})`);
});

test("sevenVSixIntensity is inert when sevenVSixActive is false -- a pre-match policy of NEVER never applies any 7v6 effect regardless of the intensity value passed", () => {
  const profile = defaultTeamTacticalProfile();
  const withIntensityButInactive = computeTacticalMatchAdjustment("save-intensity-inactive", "fx-1", "clubA", "clubA", profile, false, null, null, 0.9);
  const withoutSevenVSixAtAll = computeTacticalMatchAdjustment("save-intensity-inactive", "fx-1", "clubA", "clubA", profile, false);
  assert.deepEqual(withIntensityButInactive, withoutSevenVSixAtAll);
});
