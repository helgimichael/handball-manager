// HM-RATINGS-0.1: proves the Player Rating domain foundation's own
// invariants using synthetic (non-real) test players. Real Sweden
// 2026/27 calibration fixtures live in swedenCalibrationFixtures.test.ts
// and carry NO numeric CA/PA/attribute values, per this milestone's own
// scope rule -- all numeric-behavior proofs belong here instead.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CA_MAX,
  CA_MIN,
  PA_MAX,
  PA_MIN,
  type AbilityRating,
  type PlayerRatingClaim,
  type PlayerRatingProfile,
} from "./types";
import {
  MIN_LOW_CONFIDENCE_RANGE_WIDTH,
  isInjuryAvailabilityEvidence,
  isUserAnchorEvidence,
  isVerifiedCareerEvidence,
  paRatingFromPotentialAnchor,
  selectClaimsByEvidenceClass,
  unassessedAbilityRating,
  validateAbilityRating,
  validateAttributeValue,
  validatePlayerRatingClaim,
  validatePlayerRatingProfile,
} from "./validators";

function claim(overrides: Partial<PlayerRatingClaim> & Pick<PlayerRatingClaim, "id" | "playerId" | "evidenceClass" | "domain" | "key" | "value">): PlayerRatingClaim {
  return { sourceRefs: ["ev-test"], ...overrides };
}

function emptyProfile(playerId: string, position: PlayerRatingProfile["position"] = "M9"): PlayerRatingProfile {
  return {
    playerId,
    position,
    physicalProfile: {},
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    phaseAbilities: [],
    usage: { attackUsageShare: 0, defenceUsageShare: 0, transitionUsageShare: 0 },
    utility: { utility: 0, positionalFlexibility: 0 },
    ca: unassessedAbilityRating(CA_MIN, CA_MAX),
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    claims: [],
  };
}

// ---------------------------------------------------------------------------
// CA/PA scales remain separate
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: CA and PA use the independent 1-200 scale, structurally distinct from the 1-20 attribute scale", () => {
  assert.equal(CA_MIN, 1);
  assert.equal(CA_MAX, 200);
  assert.equal(PA_MIN, 1);
  assert.equal(PA_MAX, 200);
  assert.equal(validateAttributeValue(21).ok, false, "21 is outside the 1-20 attribute scale even though it is a valid CA/PA-range number");
  assert.equal(validateAttributeValue(15).ok, true);
});

test("HM-RATINGS-0.1: CA and PA are independently settable fields -- changing one never implies or requires a matching change to the other", () => {
  const profile = emptyProfile("test-player-scales");
  profile.ca = { value: 140, confidence: "HIGH", plausibleRange: { min: 138, max: 142 } };
  profile.pa = { value: 140, confidence: "HIGH", plausibleRange: { min: 138, max: 142 } }; // PA may equal CA (already at ceiling)
  assert.equal(validatePlayerRatingProfile(profile).ok, true);

  profile.pa = { value: 190, confidence: "MEDIUM", plausibleRange: { min: 180, max: 200 } }; // large development gap, still valid
  assert.equal(validatePlayerRatingProfile(profile).ok, true);
});

test("HM-RATINGS-0.1: PA is a ceiling -- it may never sit below current CA when both are known", () => {
  const profile = emptyProfile("test-player-ceiling");
  profile.ca = { value: 150, confidence: "HIGH", plausibleRange: { min: 148, max: 152 } };
  profile.pa = { value: 130, confidence: "HIGH", plausibleRange: { min: 128, max: 132 } };
  const result = validatePlayerRatingProfile(profile);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("PA is a ceiling")));
});

// ---------------------------------------------------------------------------
// PA cannot leak into current-performance data / age must not lower CA /
// nationality-club-league give no direct bonus
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: PlayerRatingProfile and AbilityRating carry no age/nationality/club/league field that could feed CA -- two profiles differing only in unrelated identity fields have identical CA representations", () => {
  const young = emptyProfile("test-player-young");
  const old = emptyProfile("test-player-old");
  young.ca = old.ca = { value: 165, confidence: "HIGH", plausibleRange: { min: 163, max: 167 } };
  // Neither PlayerRatingProfile nor AbilityRating has an age/nationality/club/league key at all -- structurally verified here.
  assert.ok(!("age" in young.ca));
  assert.ok(!("nationality" in young.ca));
  assert.ok(!("club" in young.ca));
  assert.ok(!("league" in young.ca));
  assert.deepEqual(young.ca, old.ca, "identical CA representation regardless of the players' unrelated identity/age fields");
});

test("HM-RATINGS-0.1: AbilityRating has no context field at all -- only PlayerRatingClaim.contextRef exists, so country/competition/club context can only ever touch evidence, never be re-applied to the finished CA/PA number", () => {
  const rating: AbilityRating = { value: 150, confidence: "HIGH", plausibleRange: { min: 148, max: 152 } };
  assert.deepEqual(Object.keys(rating).sort(), ["confidence", "plausibleRange", "value"]);
});

test("HM-RATINGS-0.1: a PlayerRatingClaim's contextRef is a single optional string -- a caller cannot structurally attach two context calibrations to the same claim", () => {
  const c = claim({ id: "c1", playerId: "test-player", evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "production", value: "STRONG", contextRef: "competition:se_handbollsligan_herr" });
  assert.equal(typeof c.contextRef, "string");
  // TypeScript itself refuses `contextRef: string[]` at the type level; this runtime check documents the same guarantee for a plain-JS/JSON-loaded claim.
  assert.equal(Array.isArray(c.contextRef), false);
});

// ---------------------------------------------------------------------------
// Injury does not alter underlying ability
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: adding an INJURY_AVAILABILITY claim never changes ca/pa -- injury is stored purely as a claim, never a field on AbilityRating", () => {
  const profile = emptyProfile("test-player-injury");
  profile.ca = { value: 160, confidence: "HIGH", plausibleRange: { min: 158, max: 162 } };
  profile.pa = { value: 175, confidence: "MEDIUM", plausibleRange: { min: 170, max: 180 } };
  const before = { ca: { ...profile.ca }, pa: { ...profile.pa } };

  const injuryClaim = claim({
    id: "injury-1",
    playerId: profile.playerId,
    evidenceClass: "INJURY_AVAILABILITY",
    domain: "INJURY",
    key: "kneeInjuryHistory",
    value: "TWO_ACL_INJURIES_REPORTED",
    sourceRefs: ["ev-user-expert"],
  });
  const next: PlayerRatingProfile = { ...profile, claims: [...profile.claims, injuryClaim] };

  assert.deepEqual(next.ca, before.ca, "adding injury evidence must never change ca");
  assert.deepEqual(next.pa, before.pa, "adding injury evidence must never change pa");
  assert.equal(validatePlayerRatingProfile(next).ok, true);
  assert.ok(isInjuryAvailabilityEvidence(injuryClaim));
});

// ---------------------------------------------------------------------------
// Specialist profiles remain representable
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: a defensive specialist with zero attack usage/proficiency and a high independently-set CA validates cleanly -- nothing forces attack presence or penalizes the absent phase", () => {
  const specialist = emptyProfile("test-player-def-specialist", "M6");
  specialist.defenceRoleProficiencies = [{ role: "DEFENSIVE_SPECIALIST", value: 95 }];
  specialist.attackRoleProficiencies = []; // no attack role at all
  specialist.phaseAbilities = [{ phase: "DEFENCE", value: 92 }]; // no ATTACK phase entry
  specialist.usage = { attackUsageShare: 0, defenceUsageShare: 1, transitionUsageShare: 0.2 };
  specialist.ca = { value: 153, confidence: "HIGH", plausibleRange: { min: 150, max: 156 } };

  const result = validatePlayerRatingProfile(specialist);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.errors));
});

test("HM-RATINGS-0.1: an attack-only offensive specialist with zero defence usage/proficiency validates cleanly, symmetric to the defensive case", () => {
  const specialist = emptyProfile("test-player-off-specialist", "M6");
  specialist.attackRoleProficiencies = [{ role: "OFFENSIVE_PIVOT", value: 96 }];
  specialist.defenceRoleProficiencies = [];
  specialist.phaseAbilities = [{ phase: "ATTACK", value: 94 }];
  specialist.usage = { attackUsageShare: 1, defenceUsageShare: 0, transitionUsageShare: 0.1 };
  specialist.ca = { value: 168, confidence: "HIGH", plausibleRange: { min: 165, max: 171 } };

  const result = validatePlayerRatingProfile(specialist);
  assert.equal(result.ok, true, result.ok ? "" : JSON.stringify(result.errors));
});

test("HM-RATINGS-0.1: an AttackRole must never appear in defenceRoleProficiencies, and vice versa", () => {
  const profile = emptyProfile("test-player-role-mismatch");
  profile.defenceRoleProficiencies = [{ role: "OFFENSIVE_PIVOT" as never, value: 50 }];
  const result = validatePlayerRatingProfile(profile);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("not a recognized DefenceRole")));
});

// ---------------------------------------------------------------------------
// Unknown evidence widens uncertainty rather than forcing average
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: unassessedAbilityRating never defaults to a mid-scale average -- it spans the full scale with no point value", () => {
  const rating = unassessedAbilityRating(CA_MIN, CA_MAX);
  assert.equal(rating.value, null);
  assert.equal(rating.confidence, "LOW");
  assert.deepEqual(rating.plausibleRange, { min: CA_MIN, max: CA_MAX });
  assert.equal(validateAbilityRating(rating, CA_MIN, CA_MAX).ok, true);
});

test("HM-RATINGS-0.1: a LOW-confidence rating with a narrow range is rejected -- thin evidence must widen uncertainty, not narrow it", () => {
  const narrowButLow: AbilityRating = { value: 140, confidence: "LOW", plausibleRange: { min: 138, max: 142 } };
  const result = validateAbilityRating(narrowButLow, CA_MIN, CA_MAX);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("thin evidence must widen uncertainty")));
});

test("HM-RATINGS-0.1: a HIGH-confidence rating may legitimately have a narrow (even zero-width) range -- the width rule only constrains LOW confidence", () => {
  const wellKnown: AbilityRating = { value: 140, confidence: "HIGH", plausibleRange: { min: 140, max: 140 } };
  assert.equal(validateAbilityRating(wellKnown, CA_MIN, CA_MAX).ok, true);
});

test("HM-RATINGS-0.1: paRatingFromPotentialAnchor seeds a RANGE from a qualitative anchor, never a point value -- this is not 'assigning a final numeric PA'", () => {
  const rating = paRatingFromPotentialAnchor("VERY_HIGH_POTENTIAL");
  assert.equal(rating.value, null);
  assert.deepEqual(rating.plausibleRange, { min: 160, max: 180 });
  assert.equal(validateAbilityRating(rating, PA_MIN, PA_MAX).ok, true);
});

test("HM-RATINGS-0.1: an unrecognized potential anchor falls back to the fully unassessed range, never a narrower guess", () => {
  const rating = paRatingFromPotentialAnchor("SOME_UNKNOWN_FUTURE_ANCHOR");
  assert.deepEqual(rating.plausibleRange, { min: PA_MIN, max: PA_MAX });
  assert.equal(rating.value, null);
});

test("HM-RATINGS-0.1: MIN_LOW_CONFIDENCE_RANGE_WIDTH is a real, positive width -- an unassessed player is never treated as equivalent to a narrowly-known average player", () => {
  assert.ok(MIN_LOW_CONFIDENCE_RANGE_WIDTH > 0);
  const unassessed = unassessedAbilityRating(CA_MIN, CA_MAX);
  const width = unassessed.plausibleRange.max - unassessed.plausibleRange.min;
  assert.ok(width >= MIN_LOW_CONFIDENCE_RANGE_WIDTH);
});

// ---------------------------------------------------------------------------
// Verified career evidence and user anchors remain distinct
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: VERIFIED_CAREER_SIGNAL and USER_EXPERT_PLAYER_ANCHOR are distinct evidence classes -- a claim of one is never also classified as the other", () => {
  const verified = claim({ id: "cs-1", playerId: "test-player", evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "seniorInternationalCaps", value: 37 });
  const anchor = claim({ id: "an-1", playerId: "test-player", evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" });

  assert.ok(isVerifiedCareerEvidence(verified));
  assert.ok(!isUserAnchorEvidence(verified));
  assert.ok(isUserAnchorEvidence(anchor));
  assert.ok(!isVerifiedCareerEvidence(anchor));

  const claims = [verified, anchor];
  assert.deepEqual(selectClaimsByEvidenceClass(claims, "VERIFIED_CAREER_SIGNAL"), [verified]);
  assert.deepEqual(selectClaimsByEvidenceClass(claims, "USER_EXPERT_PLAYER_ANCHOR"), [anchor]);
});

test("HM-RATINGS-0.1: PROJECTION_EXPECTATION can never be marked CONFIRMED -- a projection must never be silently promoted to verified fact", () => {
  const projection = claim({
    id: "proj-1",
    playerId: "test-player",
    evidenceClass: "PROJECTION_EXPECTATION",
    domain: "PROJECTION",
    key: "expectedTrajectory",
    value: "MAJOR_EUROPEAN_INTEREST",
    confidence: "CONFIRMED",
  });
  const result = validatePlayerRatingClaim(projection);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("never be marked as confirmed fact")));
});

test("HM-RATINGS-0.1: UNASSESSED is not negative evidence -- a claim with no sourceRefs is valid only for UNASSESSED, and is a legitimate, non-error state", () => {
  const unassessed = claim({ id: "un-1", playerId: "test-player", evidenceClass: "UNASSESSED", domain: "ANCHOR", key: "importance", value: "NO_EXPERT_ANCHOR", sourceRefs: [] });
  assert.equal(validatePlayerRatingClaim(unassessed).ok, true);

  const missingSourceForVerified = claim({ id: "bad-1", playerId: "test-player", evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "x", value: "y", sourceRefs: [] });
  assert.equal(validatePlayerRatingClaim(missingSourceForVerified).ok, false);
});

// ---------------------------------------------------------------------------
// Club/competition context cannot be applied twice
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: club/competition context modifies evidence claims only -- it has no separate multiplier field anywhere on PlayerRatingProfile that could double it up alongside a claim's contextRef", () => {
  const profile = emptyProfile("test-player-context");
  const contextualClaim = claim({
    id: "cs-context",
    playerId: profile.playerId,
    evidenceClass: "VERIFIED_CAREER_SIGNAL",
    domain: "CAREER_SIGNAL",
    key: "leagueProduction",
    value: "TOP_SCORER",
    contextRef: "competition:se_handbollsligan_herr",
  });
  profile.claims = [contextualClaim];

  // No key on PlayerRatingProfile or AbilityRating represents a
  // context/competition multiplier -- the only place context can attach
  // is the single optional contextRef on the claim itself.
  const profileKeys = Object.keys(profile);
  assert.ok(!profileKeys.some((k) => /context|competition|club|league/i.test(k)));
  assert.equal(validatePlayerRatingProfile(profile).ok, true);
});

// ---------------------------------------------------------------------------
// Goalkeeper/outcourt branches stay separate
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.1: a GK profile with outcourtAttributes is rejected -- goalkeepers must use the goalkeeper branch", () => {
  const gk = emptyProfile("test-player-gk", "GK");
  gk.outcourtAttributes = { PASSING: 12 };
  const result = validatePlayerRatingProfile(gk);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("must use goalkeeperAttributes")));
});

test("HM-RATINGS-0.1: an outcourt profile with goalkeeperAttributes is rejected -- only GK may use the goalkeeper branch", () => {
  const wing = emptyProfile("test-player-wing", "V6");
  wing.goalkeeperAttributes = { LOW_SAVES: 14 };
  const result = validatePlayerRatingProfile(wing);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes('only a "GK" may use the goalkeeper branch')));
});

test("HM-RATINGS-0.1: a profile carrying both outcourtAttributes and goalkeeperAttributes is rejected outright, regardless of position", () => {
  const both = emptyProfile("test-player-both", "GK");
  both.outcourtAttributes = { PASSING: 10 };
  both.goalkeeperAttributes = { LOW_SAVES: 10 };
  const result = validatePlayerRatingProfile(both);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("mutually exclusive")));
});

test("HM-RATINGS-0.1: a valid GK profile (goalkeeperAttributes only) and a valid outcourt profile (outcourtAttributes only) both validate cleanly", () => {
  const gk = emptyProfile("test-player-gk-valid", "GK");
  gk.goalkeeperAttributes = { LOW_SAVES: 15, REACTION: 16 };
  assert.equal(validatePlayerRatingProfile(gk).ok, true);

  const back = emptyProfile("test-player-back-valid", "M9");
  back.outcourtAttributes = { PLAYMAKING: 17, PASSING: 16 };
  assert.equal(validatePlayerRatingProfile(back).ok, true);
});

test("HM-RATINGS-0.1: an unrecognized attribute name in either branch is rejected", () => {
  const profile = emptyProfile("test-player-bad-attr", "M9");
  profile.outcourtAttributes = { NOT_A_REAL_ATTRIBUTE: 10 } as never;
  const result = validatePlayerRatingProfile(profile);
  assert.equal(result.ok, false);
  if (!result.ok) assert.ok(result.errors.some((e) => e.includes("is not a recognized outcourt attribute")));
});
