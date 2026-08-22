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

test("HM-RATINGS-0.6: nationality, height, and age have no channel into applyGamePrior -- PlayerRatingProfile carries no such fields for it to read", () => {
  const profile = baseProfile({});
  assert.ok(!("nationality" in profile) && !("nationalities" in profile));
  assert.ok(!("age" in profile));
  // physicalProfile only ever carries height/weight/handedness as body facts, never ability -- applyGamePrior never reads it.
  const outcome = applyGamePrior({ ...profile, physicalProfile: { heightCm: 210 } }, "se_club_hammarby_if_hf");
  const outcomeShort = applyGamePrior({ ...profile, physicalProfile: { heightCm: 170 } }, "se_club_hammarby_if_hf");
  assert.equal(outcome.profile.ca.value, outcomeShort.profile.ca.value);
});
