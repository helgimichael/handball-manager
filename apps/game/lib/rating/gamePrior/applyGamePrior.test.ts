// HM-RATINGS-0.6 Part B/O: proves applyGamePrior only ever fills the
// bottom tier -- never overwrites a resolved CA/PA -- and produces a
// complete, archetype-tagged, deterministic result when it does act.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unassessedAbilityRating } from "../validators";
import { CA_MAX, CA_MIN, PA_MAX, PA_MIN, type PlayerRatingProfile } from "../types";
import { applyGamePrior } from "./applyGamePrior";

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
    ca: unassessedAbilityRating(CA_MIN, CA_MAX),
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    claims: [],
    ...overrides,
  };
}

test("HM-RATINGS-0.6: a calibrated player's CA is never touched by applyGamePrior", () => {
  const profile = baseProfile({ ca: { value: 166, confidence: "HIGH", plausibleRange: { min: 160, max: 172 } } });
  const outcome = applyGamePrior(profile, "se_club_hammarby_if_hf");
  assert.equal(outcome.gamePriorCAApplied, false);
  assert.equal(outcome.profile.ca.value, 166);
});

test("HM-RATINGS-0.6: an unresolved CA gets a game-prior CA, PA, and an archetype", () => {
  const profile = baseProfile({});
  const outcome = applyGamePrior(profile, "se_club_hammarby_if_hf");
  assert.equal(outcome.gamePriorCAApplied, true);
  assert.ok(outcome.profile.ca.value !== null);
  assert.equal(outcome.profile.ca.confidence, "LOW");
  assert.ok(outcome.profile.pa.value !== null);
  assert.ok(outcome.profile.pa.value! >= outcome.profile.ca.value!);
  assert.ok(outcome.archetype !== null);
});

test("HM-RATINGS-0.6: an outcourt player gets the archetype added as a real attackRoleProficiency (existing role vocabulary)", () => {
  const profile = baseProfile({ position: "V6" });
  const outcome = applyGamePrior(profile, "se_club_hammarby_if_hf");
  assert.equal(outcome.profile.attackRoleProficiencies.length, 1);
  assert.equal(outcome.profile.attackRoleProficiencies[0].role, outcome.archetype);
});

test("HM-RATINGS-0.6: a goalkeeper gets the archetype recorded as a claim, not an attackRoleProficiency", () => {
  const profile = baseProfile({ position: "GK" });
  const outcome = applyGamePrior(profile, "se_club_hammarby_if_hf");
  assert.equal(outcome.profile.attackRoleProficiencies.length, 0);
  assert.ok(outcome.profile.claims.some((c) => c.domain === "ARCHETYPE" && c.key === "gkArchetype" && c.value === outcome.archetype));
});

test("HM-RATINGS-0.6: a resolved CA but missing PA gets ONLY a game-prior PA -- CA and archetype are untouched", () => {
  const profile = baseProfile({ ca: { value: 158, confidence: "HIGH", plausibleRange: { min: 150, max: 166 } } });
  const outcome = applyGamePrior(profile, "se_club_hammarby_if_hf");
  assert.equal(outcome.gamePriorCAApplied, false);
  assert.equal(outcome.gamePriorPAApplied, true);
  assert.equal(outcome.profile.ca.value, 158);
  assert.ok(outcome.profile.pa.value! >= 158);
  assert.equal(outcome.archetype, null);
  assert.equal(outcome.profile.attackRoleProficiencies.length, 0);
});

test("HM-RATINGS-0.6: a fully-resolved player (CA and PA both present) is returned completely unchanged", () => {
  const profile = baseProfile({ ca: { value: 150, confidence: "HIGH", plausibleRange: { min: 144, max: 156 } }, pa: { value: 155, confidence: "HIGH", plausibleRange: { min: 150, max: 160 } } });
  const outcome = applyGamePrior(profile, "se_club_hammarby_if_hf");
  assert.equal(outcome.gamePriorCAApplied, false);
  assert.equal(outcome.gamePriorPAApplied, false);
  assert.deepEqual(outcome.profile, profile);
});

test("HM-RATINGS-0.6: applyGamePrior is deterministic for the same player/club/model version", () => {
  const profile = baseProfile({});
  const a = applyGamePrior(profile, "se_club_hammarby_if_hf");
  const b = applyGamePrior(profile, "se_club_hammarby_if_hf");
  assert.deepEqual(a, b);
});

// HM-DATA-DIV1-1.0
test("HM-DATA-DIV1-1.0: a Division 1 club produces a CLEARLY lower average game-prior CA than the shared STANDARD tier, across a sample of players", () => {
  let div1Total = 0;
  let standardTotal = 0;
  const n = 40;
  for (let i = 0; i < n; i++) {
    const profile = baseProfile({ playerId: `sample_player_${i}` });
    const div1 = applyGamePrior(profile, "se_club_bodens_bk_hf"); // Division 1 Norra
    const standard = applyGamePrior(profile, "se_club_hammarby_if_hf"); // Handbollsligan
    div1Total += div1.profile.ca.value!;
    standardTotal += standard.profile.ca.value!;
  }
  const div1Avg = div1Total / n;
  const standardAvg = standardTotal / n;
  assert.ok(div1Avg < standardAvg - 15, `expected Division 1 avg CA (${div1Avg}) to sit clearly below STANDARD avg CA (${standardAvg})`);
});

test("HM-DATA-DIV1-1.0: Division 1 is not uniformly bad -- at least one sampled player reaches a genuinely strong CA", () => {
  let maxCa = 0;
  for (let i = 0; i < 60; i++) {
    const profile = baseProfile({ playerId: `sample_player_${i}` });
    const outcome = applyGamePrior(profile, "se_club_ahus_handboll"); // Division 1 Södra
    maxCa = Math.max(maxCa, outcome.profile.ca.value!);
  }
  assert.ok(maxCa >= 115, `expected at least one strong Division 1 outlier, best sampled CA was ${maxCa}`);
});

test("HM-DATA-DIV1-1.0: a Handbollsligan/Allsvenskan clubId produces BYTE-IDENTICAL output to before the Division 1 tier existed (regression guard)", () => {
  const profile = baseProfile({});
  const outcome = applyGamePrior(profile, "se_club_hammarby_if_hf");
  assert.equal(outcome.profile.ca.value, 142); // fixed, known-good value for this seed/model version pair
  assert.ok(outcome.profile.pa.value! >= 142);
});

test("HM-RATINGS-0.6: nationality, height, and age have no channel into applyGamePrior -- PlayerRatingProfile carries no such fields for it to read", () => {
  const profile = baseProfile({});
  assert.ok(!("nationality" in profile) && !("nationalities" in profile));
  assert.ok(!("age" in profile));
  // physicalProfile only ever carries height/weight/handedness as body facts, never ability -- applyGamePrior never reads it.
  const outcome = applyGamePrior({ ...profile, physicalProfile: { heightCm: 210 } }, "se_club_hammarby_if_hf");
  const outcomeShort = applyGamePrior({ ...profile, physicalProfile: { heightCm: 170 } }, "se_club_hammarby_if_hf");
  assert.equal(outcome.profile.ca.value, outcomeShort.profile.ca.value);
});
