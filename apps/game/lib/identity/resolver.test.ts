// HM-IDENTITY-0.2: proves the Current Team Identity resolver's core
// invariants using constructed (synthetic but schema-valid) fixtures --
// see gameWorld/currentTeamIdentity.test.ts for the same invariants
// proven again against real imported clubs/coaches.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateCurrentTeamIdentity } from "./validators";
import { CONFLICTING_VALUE_SENTINEL, resolveCurrentTeamIdentity, type ResolveCurrentTeamIdentityInputs } from "./resolver";
import type { ClubIdentityProfile, CoachIdentityProfile, IdentityClaim, SeasonClubContext } from "./types";

const CLUB_ID = "se_club_alingsas_hk";

function claim(overrides: Partial<IdentityClaim> & Pick<IdentityClaim, "id" | "subjectType" | "subjectId" | "domain" | "key" | "value">): IdentityClaim {
  return {
    evidenceClass: "USER_EXPERT_ASSESSMENT",
    temporalScope: "LONG_TERM",
    sourceRefs: ["ev-1"],
    ...overrides,
  };
}

function emptyClubProfile(overrides: Partial<ClubIdentityProfile> = {}): ClubIdentityProfile {
  return {
    clubId: CLUB_ID,
    seasonReference: "2026/27",
    structuralIdentity: [],
    cultureIdentity: [],
    tacticalHeritage: [],
    developmentIdentity: [],
    recruitmentIdentity: [],
    financialStrategicIdentity: [],
    supporterEnvironmentIdentity: [],
    ...overrides,
  };
}

function emptyCoachProfile(personId: string, overrides: Partial<CoachIdentityProfile> = {}): CoachIdentityProfile {
  return {
    personId,
    coachingStyleClaims: [],
    tacticalPreferenceClaims: [],
    communicationLeadershipClaims: [],
    developmentClaims: [],
    adaptabilityClaims: [],
    cultureBuildingClaims: [],
    ...overrides,
  };
}

function baseInputs(overrides: Partial<ResolveCurrentTeamIdentityInputs> = {}): ResolveCurrentTeamIdentityInputs {
  return {
    clubId: CLUB_ID,
    season: "2026/27",
    clubIdentity: null,
    coachPersonId: null,
    coachIdentity: null,
    squadContext: null,
    seasonContext: null,
    tacticalProfile: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.2: same inputs => identical output", () => {
  const club = emptyClubProfile({ tacticalHeritage: [claim({ id: "c1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "positionalComplexity", value: "SIMPLE" })] });
  const coach = emptyCoachProfile("person-x", { coachingStyleClaims: [claim({ id: "co1", subjectType: "COACH", subjectId: "person-x", domain: "COACHING_ENVIRONMENT", key: "analyticalOrientation", value: "HIGH" })] });
  const inputs = baseInputs({ clubIdentity: club, coachIdentity: coach, coachPersonId: "person-x" });

  const a = resolveCurrentTeamIdentity(inputs);
  const b = resolveCurrentTeamIdentity(inputs);
  assert.deepEqual(a, b);

  // Also true for two structurally-identical but distinct input objects (not the same reference).
  const c = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: emptyClubProfile({ tacticalHeritage: [claim({ id: "c1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "positionalComplexity", value: "SIMPLE" })] }) }));
  const d = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: emptyClubProfile({ tacticalHeritage: [claim({ id: "c1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "positionalComplexity", value: "SIMPLE" })] }) }));
  assert.deepEqual(c, d);
});

// ---------------------------------------------------------------------------
// Club/coach separation
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.2: coach identity remains separate from club identity -- distinct (domain,key) pairs never merge, and each resolved claim's contributingClaims keep their own real subjectType", () => {
  const club = emptyClubProfile({ tacticalHeritage: [claim({ id: "c1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "positionalComplexity", value: "SIMPLE" })] });
  const coach = emptyCoachProfile("person-x", { coachingStyleClaims: [claim({ id: "co1", subjectType: "COACH", subjectId: "person-x", domain: "COACHING_ENVIRONMENT", key: "analyticalOrientation", value: "HIGH" })] });
  const identity = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: club, coachIdentity: coach, coachPersonId: "person-x" }));

  const clubClaim = identity.claims.find((c) => c.domain === "ATTACK")!;
  const coachClaim = identity.claims.find((c) => c.domain === "COACHING_ENVIRONMENT")!;
  assert.ok(clubClaim);
  assert.ok(coachClaim);
  assert.equal(clubClaim.contributingClaims.length, 1);
  assert.equal(clubClaim.contributingClaims[0].subjectType, "CLUB");
  assert.equal(coachClaim.contributingClaims.length, 1);
  assert.equal(coachClaim.contributingClaims[0].subjectType, "COACH");
  assert.notEqual(clubClaim.value, coachClaim.value);
});

test("HM-IDENTITY-0.2: replacing the coach changes only the derived CurrentTeamIdentity -- club identity survives coach replacement byte-for-byte", () => {
  const club = emptyClubProfile({ tacticalHeritage: [claim({ id: "c1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "positionalComplexity", value: "SIMPLE" })] });
  const originalClub = JSON.parse(JSON.stringify(club));

  const coachA = emptyCoachProfile("person-a", { coachingStyleClaims: [claim({ id: "coA", subjectType: "COACH", subjectId: "person-a", domain: "COACHING_ENVIRONMENT", key: "analyticalOrientation", value: "HIGH" })] });
  const coachB = emptyCoachProfile("person-b", { coachingStyleClaims: [claim({ id: "coB", subjectType: "COACH", subjectId: "person-b", domain: "COACHING_ENVIRONMENT", key: "authority", value: "VERY_STRONG" })] });

  const withCoachA = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: club, coachIdentity: coachA, coachPersonId: "person-a" }));
  const withCoachB = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: club, coachIdentity: coachB, coachPersonId: "person-b" }));

  // The INPUT club object itself is never mutated by resolving with a different coach.
  assert.deepEqual(club, originalClub);

  // The CLUB-domain resolved claim is identical across both resolutions.
  const clubClaimA = withCoachA.claims.find((c) => c.domain === "ATTACK");
  const clubClaimB = withCoachB.claims.find((c) => c.domain === "ATTACK");
  assert.deepEqual(clubClaimA, clubClaimB);

  // Only the COACHING_ENVIRONMENT-domain claim differs.
  const coachClaimA = withCoachA.claims.find((c) => c.domain === "COACHING_ENVIRONMENT");
  const coachClaimB = withCoachB.claims.find((c) => c.domain === "COACHING_ENVIRONMENT");
  assert.notDeepEqual(coachClaimA, coachClaimB);
  assert.equal(withCoachA.derivedFrom.coachIdentityRef, "person-a");
  assert.equal(withCoachB.derivedFrom.coachIdentityRef, "person-b");
});

// ---------------------------------------------------------------------------
// Season claims stay temporary
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.2: season claims remain temporary -- resolved SEASON_CONTEXT-sourced claims are always SEASON-scoped, and vanish entirely once seasonContext is no longer supplied (a new season)", () => {
  const seasonContext: SeasonClubContext = {
    clubId: CLUB_ID,
    season: "2026/27",
    organisationalClaims: [],
    financialClaims: [],
    squadClaims: [],
    competitiveClaims: [claim({ id: "s1", subjectType: "SEASON_CONTEXT", subjectId: CLUB_ID, domain: "COMPETITIVE", key: "titleContention", value: "TOP_3", temporalScope: "SEASON", season: "2026/27" })],
    transitionClaims: [],
  };

  const thisSeason = resolveCurrentTeamIdentity(baseInputs({ seasonContext }));
  const seasonClaim = thisSeason.claims.find((c) => c.domain === "COMPETITIVE");
  assert.ok(seasonClaim);
  assert.equal(seasonClaim!.temporalScope, "SEASON");
  assert.equal(seasonClaim!.contributingClaims[0].subjectType, "SEASON_CONTEXT");

  // Next season: the manager resolves again with no seasonContext (2026/27's claims are not carried forward).
  const nextSeason = resolveCurrentTeamIdentity(baseInputs({ season: "2027/28", seasonContext: null }));
  assert.equal(
    nextSeason.claims.find((c) => c.domain === "COMPETITIVE"),
    undefined,
    "a season's claims must never persist into a resolution that no longer supplies that season's context",
  );
});

// ---------------------------------------------------------------------------
// Projection / unknown handling
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.2: USER_PROJECTION never becomes observed identity -- a projected claim and a real current claim under different keys both resolve, each keeping its own evidenceClass/temporalScope untouched", () => {
  const club = emptyClubProfile({
    tacticalHeritage: [
      claim({ id: "current-1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "currentAttackingIdentity", value: "NOT_YET_ESTABLISHED", evidenceClass: "USER_EXPERT_ASSESSMENT", temporalScope: "CURRENT" }),
      claim({ id: "projection-1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "projectedAttackingTempo", value: "HIGH", evidenceClass: "USER_PROJECTION", temporalScope: "PROJECTED" }),
    ],
  });
  const identity = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: club }));

  const current = identity.claims.find((c) => c.key === "currentAttackingIdentity")!;
  const projected = identity.claims.find((c) => c.key === "projectedAttackingTempo")!;
  assert.ok(current);
  assert.ok(projected);
  assert.equal(current.evidenceClass, "USER_EXPERT_ASSESSMENT");
  assert.equal(current.temporalScope, "CURRENT");
  assert.equal(projected.evidenceClass, "USER_PROJECTION");
  assert.equal(projected.temporalScope, "PROJECTED");
  assert.equal(current.value, "NOT_YET_ESTABLISHED", "the current claim's value must never be overwritten by the projection");
  assert.equal(projected.value, "HIGH", "the projection's own value must never leak into the current claim");
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);
});

test("HM-IDENTITY-0.2: UNKNOWN remains unknown -- a club claim with UNKNOWN_NOT_ASSESSED but a genuine sourceRef still resolves (evidence of having looked and found nothing), while one with NO sourceRef produces no resolved claim at all (absence, not fabrication)", () => {
  const clubWithEvidence = emptyClubProfile({
    tacticalHeritage: [claim({ id: "u1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "detailedPrinciples", value: "UNKNOWN", evidenceClass: "UNKNOWN_NOT_ASSESSED", sourceRefs: ["ev-research-gap-note"] })],
  });
  const withEvidence = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: clubWithEvidence }));
  const resolvedUnknown = withEvidence.claims.find((c) => c.key === "detailedPrinciples");
  assert.ok(resolvedUnknown, "an UNKNOWN claim WITH a real sourceRef must still resolve -- it is honestly documented uncertainty, not silence");
  assert.equal(resolvedUnknown!.value, "UNKNOWN");

  const clubWithoutEvidence = emptyClubProfile({
    tacticalHeritage: [claim({ id: "u2", subjectType: "CLUB", subjectId: CLUB_ID, domain: "ATTACK", key: "detailedPrinciples2", value: "UNKNOWN", evidenceClass: "UNKNOWN_NOT_ASSESSED", sourceRefs: [] })],
  });
  const withoutEvidence = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: clubWithoutEvidence }));
  assert.equal(
    withoutEvidence.claims.find((c) => c.key === "detailedPrinciples2"),
    undefined,
    "a claim with no evidence reference at all must never produce a resolved TEAM claim -- absence is the honest signal",
  );
});

// ---------------------------------------------------------------------------
// Conflict handling
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.2: conflicting club/coach signals remain explainable, never silently averaged", () => {
  const club = emptyClubProfile({ tacticalHeritage: [claim({ id: "club-claim", subjectType: "CLUB", subjectId: CLUB_ID, domain: "DEFENCE", key: "primaryFormation", value: "6:0" })] });
  const coach = emptyCoachProfile("person-x", {
    tacticalPreferenceClaims: [claim({ id: "coach-claim", subjectType: "COACH", subjectId: "person-x", domain: "DEFENCE", key: "primaryFormation", value: "5:1" })],
  });
  const identity = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: club, coachIdentity: coach, coachPersonId: "person-x" }));

  const resolved = identity.claims.find((c) => c.domain === "DEFENCE" && c.key === "primaryFormation")!;
  assert.ok(resolved);
  assert.equal(resolved.conflicting, true);
  assert.equal(resolved.value, CONFLICTING_VALUE_SENTINEL);
  assert.equal(resolved.contributingClaims.length, 2);
  const values = resolved.contributingClaims.map((c) => c.value).sort();
  assert.deepEqual(values, ["5:1", "6:0"], "both original, un-averaged values must remain visible in contributingClaims");
  assert.equal(validateCurrentTeamIdentity(identity).ok, true, "a conflicting resolved claim must still validate -- it has real provenance, just disputed content");
});

test("HM-IDENTITY-0.2: non-conflicting claims (different keys, or identical values) are never flagged as conflicting", () => {
  const club = emptyClubProfile({
    tacticalHeritage: [
      claim({ id: "c1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "DEFENCE", key: "primaryFormation", value: "6:0" }),
      claim({ id: "c2", subjectType: "CLUB", subjectId: CLUB_ID, domain: "DEFENCE", key: "alternativeFormation", value: "5:1" }),
    ],
  });
  const coach = emptyCoachProfile("person-x", {
    tacticalPreferenceClaims: [claim({ id: "co1", subjectType: "COACH", subjectId: "person-x", domain: "DEFENCE", key: "primaryFormation", value: "6:0" })],
  });
  const identity = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: club, coachIdentity: coach, coachPersonId: "person-x" }));
  const primary = identity.claims.find((c) => c.key === "primaryFormation")!;
  assert.equal(primary.conflicting, false, "identical values from different sources agree, not conflict");
  assert.equal(primary.contributingClaims.length, 2);
});

// ---------------------------------------------------------------------------
// Missing coach identity
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.2: missing coach identity still resolves from available evidence without fabrication", () => {
  const club = emptyClubProfile({
    tacticalHeritage: [claim({ id: "c1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "TACTICAL_FLEXIBILITY", key: "tacticalFlexibility", value: "VERY_HIGH" })],
  });
  // coachIdentity is null (no assessment exists), but coachPersonId may still be known (the club HAS a head coach, just an unassessed one).
  const identity = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: club, coachIdentity: null, coachPersonId: "person-unassessed" }));

  assert.equal(identity.claims.length, 1, "only the genuinely-evidenced club claim resolves");
  assert.equal(identity.claims[0].domain, "TACTICAL_FLEXIBILITY");
  assert.ok(identity.claims.every((c) => c.domain !== "COACHING_ENVIRONMENT"), "no COACHING_ENVIRONMENT claim may be fabricated when the coach has no assessed identity");
  assert.equal(identity.derivedFrom.coachIdentityRef, "person-unassessed", "the coach reference is still recorded for provenance, even with nothing resolved from them");
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);
});

test("HM-IDENTITY-0.2: fully empty inputs resolve to an empty, still-valid identity -- never invents Squad/Season data", () => {
  const identity = resolveCurrentTeamIdentity(baseInputs());
  assert.deepEqual(identity.claims, []);
  assert.equal(identity.derivedFrom.squadContextRef, undefined);
  assert.equal(identity.derivedFrom.seasonContextRef, undefined);
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);
});

// ---------------------------------------------------------------------------
// No numeric ratings / no aggregate score
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.2: no numeric overall/rating is ever generated -- every resolved claim's value stays a string (including the CONFLICTING sentinel), and no aggregate field exists on the output", () => {
  const club = emptyClubProfile({
    tacticalHeritage: [
      claim({ id: "c1", subjectType: "CLUB", subjectId: CLUB_ID, domain: "DEFENCE", key: "primaryFormation", value: "6:0" }),
      claim({ id: "c2", subjectType: "CLUB", subjectId: CLUB_ID, domain: "CULTURE", key: "clubStature", value: "ELITE" }),
    ],
  });
  const coach = emptyCoachProfile("person-x", {
    tacticalPreferenceClaims: [claim({ id: "co1", subjectType: "COACH", subjectId: "person-x", domain: "DEFENCE", key: "primaryFormation", value: "5:1" })],
  });
  const identity = resolveCurrentTeamIdentity(baseInputs({ clubIdentity: club, coachIdentity: coach, coachPersonId: "person-x" }));

  for (const c of identity.claims) {
    assert.equal(typeof c.value, "string");
  }
  assert.equal("overallScore" in identity, false);
  assert.equal("rating" in identity, false);
  assert.equal("score" in identity, false);
});

test("HM-IDENTITY-0.2: current tactical selections are exposed as plain live state, never wrapped as a fabricated evidence-backed claim", () => {
  const identity = resolveCurrentTeamIdentity(baseInputs({ tacticalProfile: { ati001UsageTendency: "HIGH", h2ResponsePreference: "H2_STOPS", tacticalFamiliarity: "MEDIUM" } }));
  assert.deepEqual(identity.currentTacticalSelection, { ati001UsageTendency: "HIGH", h2ResponsePreference: "H2_STOPS", tacticalFamiliarity: "MEDIUM" });
  // It must never appear inside `claims` as if it were sourced identity evidence.
  assert.ok(identity.claims.every((c) => c.domain !== "CURRENT_TACTICAL_SELECTION"));
});
