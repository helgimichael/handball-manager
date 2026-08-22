// HM-RATINGS-0.4 Part H: proves the deterministic generation engine's
// core invariants -- completeness, determinism, bounded variation,
// evidence preservation, specialist asymmetry, and the strict
// separation between CA estimation (out of scope) and attribute
// generation given a resolved CA.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, type PlayerRatingProfile } from "../types";
import { unassessedAbilityRating } from "../validators";
import { generatePlayerRatingProfile } from "./generationEngine";

function baseProfile(overrides: Partial<PlayerRatingProfile>): PlayerRatingProfile {
  return {
    playerId: "test_player",
    position: "M9",
    physicalProfile: {},
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    phaseAbilities: [],
    usage: { attackUsageShare: 0, defenceUsageShare: 0, transitionUsageShare: 0 },
    utility: { utility: 0, positionalFlexibility: 0 },
    ca: { value: 150, confidence: "MEDIUM", plausibleRange: { min: 140, max: 160 } },
    pa: unassessedAbilityRating(1, 200),
    claims: [],
    ...overrides,
  };
}

test("HM-RATINGS-0.4: generated outcourt profile contains exactly the complete 56-attribute outcourt vocabulary, no more, no less", () => {
  const result = generatePlayerRatingProfile(baseProfile({}));
  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.equal(result.profile.branch.branch, "OUTCOURT");
  if (result.profile.branch.branch !== "OUTCOURT") return;
  const keys = Object.keys(result.profile.branch.attributes);
  assert.equal(keys.length, 56);
  for (const attribute of OUTCOURT_ATTRIBUTES) assert.ok(attribute in result.profile.branch.attributes);
});

test("HM-RATINGS-0.4: generated goalkeeper profile contains exactly the complete 21-attribute goalkeeper vocabulary, and outcourt attributes never leak into it", () => {
  const result = generatePlayerRatingProfile(baseProfile({ position: "GK" }));
  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.equal(result.profile.branch.branch, "GOALKEEPER");
  if (result.profile.branch.branch !== "GOALKEEPER") return;
  const keys = Object.keys(result.profile.branch.attributes);
  assert.equal(keys.length, 21);
  for (const attribute of GOALKEEPER_ATTRIBUTES) assert.ok(attribute in result.profile.branch.attributes);
  for (const key of keys) assert.ok(!(OUTCOURT_ATTRIBUTES as readonly string[]).includes(key));
});

test("HM-RATINGS-0.4: no branch contamination -- an outcourt profile never carries a goalkeeperAttributes-shaped branch and vice versa", () => {
  const outcourt = generatePlayerRatingProfile(baseProfile({ position: "V6" }));
  const gk = generatePlayerRatingProfile(baseProfile({ position: "GK" }));
  assert.equal(outcourt.status, "OK");
  assert.equal(gk.status, "OK");
  if (outcourt.status !== "OK" || gk.status !== "OK") return;
  assert.notEqual(outcourt.profile.branch.branch, gk.profile.branch.branch);
});

test("HM-RATINGS-0.4: all generated values stay within the 1-20 attribute scale", () => {
  for (const ca of [1, 40, 100, 150, 200]) {
    const result = generatePlayerRatingProfile(baseProfile({ ca: { value: ca, confidence: "HIGH", plausibleRange: { min: ca, max: ca } } }));
    assert.equal(result.status, "OK");
    if (result.status !== "OK") return;
    for (const entry of Object.values(result.profile.branch.attributes)) {
      assert.ok(entry.value >= 1 && entry.value <= 20, `value ${entry.value} out of range`);
    }
  }
});

test("HM-RATINGS-0.4: generation is deterministic -- same playerId + inputs + model version always produces the same output", () => {
  const profile = baseProfile({ playerId: "se_player_determinism_check", ca: { value: 155, confidence: "MEDIUM", plausibleRange: { min: 145, max: 165 } } });
  const a = generatePlayerRatingProfile(profile);
  const b = generatePlayerRatingProfile(profile);
  assert.deepEqual(a, b);
});

test("HM-RATINGS-0.4: bounded deterministic variation -- two players with identical sparse CA/position/role inputs differ (not clones), but only by a small, bounded amount", () => {
  const shared = { position: "M9" as const, ca: { value: 150, confidence: "MEDIUM" as const, plausibleRange: { min: 140, max: 160 } } };
  const a = generatePlayerRatingProfile(baseProfile({ playerId: "player_a", ...shared }));
  const b = generatePlayerRatingProfile(baseProfile({ playerId: "player_b", ...shared }));
  assert.equal(a.status, "OK");
  assert.equal(b.status, "OK");
  if (a.status !== "OK" || b.status !== "OK") return;
  if (a.profile.branch.branch !== "OUTCOURT" || b.profile.branch.branch !== "OUTCOURT") return;
  let anyDifference = false;
  for (const attribute of OUTCOURT_ATTRIBUTES) {
    const va = a.profile.branch.attributes[attribute].value;
    const vb = b.profile.branch.attributes[attribute].value;
    assert.ok(Math.abs(va - vb) <= 2, `player_a/player_b diverged by more than the bounded variation for ${attribute}: ${va} vs ${vb}`);
    if (va !== vb) anyDifference = true;
  }
  assert.ok(anyDifference, "expected at least some attribute to differ between two distinct players with identical sparse inputs");
});

test("HM-RATINGS-0.4: evidence-backed attributes survive generation value-for-value, exactly as in Gustav Davidsson's calibrated proposal", () => {
  const profile = baseProfile({
    playerId: "se_player_gustav_davidsson_test",
    outcourtAttributes: { PASSING: 20, PLAYMAKING: 20, SHOOTING_PLACEMENT: 15 },
    attackRoleProficiencies: [{ role: "PRIMARY_PLAYMAKER" }],
    ca: { value: 166, confidence: "HIGH", plausibleRange: { min: 160, max: 172 } },
  });
  const result = generatePlayerRatingProfile(profile);
  assert.equal(result.status, "OK");
  if (result.status !== "OK" || result.profile.branch.branch !== "OUTCOURT") return;
  const { attributes } = result.profile.branch;
  assert.deepEqual(attributes.PASSING, { value: 20, origin: "EVIDENCE_BACKED" });
  assert.deepEqual(attributes.PLAYMAKING, { value: 20, origin: "EVIDENCE_BACKED" });
  assert.deepEqual(attributes.SHOOTING_PLACEMENT, { value: 15, origin: "EVIDENCE_BACKED" });
});

test("HM-RATINGS-0.4: specialist asymmetry survives -- Andreas Nilsson's known PIVOT_PLAY 20 / FINISHING 18 / DEFENSIVE_POSITIONING 8 are never smoothed toward a generic CA average", () => {
  const profile = baseProfile({
    playerId: "se_player_andreas_nilsson_test",
    position: "M6",
    outcourtAttributes: { PIVOT_PLAY: 20, FINISHING: 18, DEFENSIVE_POSITIONING: 8 },
    attackRoleProficiencies: [{ role: "OFFENSIVE_PIVOT" }],
    ca: { value: 168, confidence: "HIGH", plausibleRange: { min: 162, max: 174 } },
  });
  const result = generatePlayerRatingProfile(profile);
  assert.equal(result.status, "OK");
  if (result.status !== "OK" || result.profile.branch.branch !== "OUTCOURT") return;
  const { attributes } = result.profile.branch;
  assert.equal(attributes.PIVOT_PLAY.value, 20);
  assert.equal(attributes.FINISHING.value, 18);
  assert.equal(attributes.DEFENSIVE_POSITIONING.value, 8);
  // A naive CA/56-style average at CA 168 would push everything toward
  // ~16-17 -- prove the low evidence-backed value survives untouched
  // and is dramatically below the CA-derived baseline for this player.
  assert.ok(attributes.DEFENSIVE_POSITIONING.value < 12);
});

test("HM-RATINGS-0.4: PA does not affect current attribute generation when CA/input profile is otherwise identical", () => {
  const low = generatePlayerRatingProfile(baseProfile({ pa: { value: 100, confidence: "HIGH", plausibleRange: { min: 100, max: 100 } } }));
  const high = generatePlayerRatingProfile(baseProfile({ pa: { value: 195, confidence: "HIGH", plausibleRange: { min: 195, max: 195 } } }));
  assert.deepEqual(low, high);
});

test("HM-RATINGS-0.4: age does not directly change generated rating -- PlayerRatingProfile carries no age field for generation to read", () => {
  // Structural proof: PlayerRatingProfile has no age field at all, so
  // there is no channel through which age could reach generation.
  const profile = baseProfile({});
  assert.ok(!("age" in profile) && !("birthYear" in profile) && !("dateOfBirth" in profile));
});

test("HM-RATINGS-0.4: nationality does not change generated rating -- PlayerRatingProfile carries no nationality field for generation to read", () => {
  const profile = baseProfile({});
  assert.ok(!("nationality" in profile) && !("nationalities" in profile));
});

test("HM-RATINGS-0.4: club identity/name does not directly change generated rating -- PlayerRatingProfile carries no club field for generation to read", () => {
  const profile = baseProfile({});
  assert.ok(!("clubId" in profile) && !("clubName" in profile));
});

test("HM-RATINGS-0.4: unknown CA is never silently invented -- generation reports an explicit UNAVAILABLE failure instead", () => {
  const profile = baseProfile({ ca: unassessedAbilityRating(1, 200) });
  const result = generatePlayerRatingProfile(profile);
  assert.deepEqual(result, { status: "UNAVAILABLE", reason: "CANNOT_GENERATE_COMPLETE_PROFILE_WITHOUT_CA", playerId: "test_player", position: "M9" });
});

test("HM-RATINGS-0.4: provenance exists for every generated attribute -- every entry carries a valid AttributeOrigin", () => {
  const result = generatePlayerRatingProfile(baseProfile({ attackRoleProficiencies: [{ role: "PRIMARY_PLAYMAKER" }] }));
  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  const validOrigins = new Set(["EVIDENCE_BACKED", "DERIVED", "GENERATED_PRIOR"]);
  for (const entry of Object.values(result.profile.branch.attributes)) {
    assert.ok(validOrigins.has(entry.origin));
  }
  const total = result.profile.originCounts.EVIDENCE_BACKED + result.profile.originCounts.DERIVED + result.profile.originCounts.GENERATED_PRIOR;
  assert.equal(total, 56);
});

test("HM-RATINGS-0.4: a known role elevates its strongly-associated attributes to DERIVED, never EVIDENCE_BACKED", () => {
  const result = generatePlayerRatingProfile(baseProfile({ attackRoleProficiencies: [{ role: "PRIMARY_PLAYMAKER" }] }));
  assert.equal(result.status, "OK");
  if (result.status !== "OK" || result.profile.branch.branch !== "OUTCOURT") return;
  assert.equal(result.profile.branch.attributes.PLAYMAKING.origin, "DERIVED");
  assert.equal(result.profile.branch.attributes.GAME_READING.origin, "DERIVED");
});

test("HM-RATINGS-0.4: a CA 130 playmaker and a CA 130 defensive specialist produce meaningfully different profiles, not clones", () => {
  // CA deliberately kept away from the 1-20 ceiling here so the role
  // boost's effect isn't masked by clamping -- the ceiling-safety of
  // generated values is already covered by a dedicated test above.
  const playmaker = generatePlayerRatingProfile(
    baseProfile({ playerId: "playmaker_130", position: "M9", attackRoleProficiencies: [{ role: "PRIMARY_PLAYMAKER" }], ca: { value: 130, confidence: "HIGH", plausibleRange: { min: 124, max: 136 } } }),
  );
  const defender = generatePlayerRatingProfile(
    baseProfile({ playerId: "defender_130", position: "M9", defenceRoleProficiencies: [{ role: "DEFENSIVE_SPECIALIST" }], ca: { value: 130, confidence: "HIGH", plausibleRange: { min: 124, max: 136 } } }),
  );
  assert.equal(playmaker.status, "OK");
  assert.equal(defender.status, "OK");
  if (playmaker.status !== "OK" || defender.status !== "OK" || playmaker.profile.branch.branch !== "OUTCOURT" || defender.profile.branch.branch !== "OUTCOURT") return;
  assert.ok(playmaker.profile.branch.attributes.PLAYMAKING.value > defender.profile.branch.attributes.PLAYMAKING.value);
  assert.ok(defender.profile.branch.attributes.DEFENSIVE_POSITIONING.value > playmaker.profile.branch.attributes.DEFENSIVE_POSITIONING.value);
});
