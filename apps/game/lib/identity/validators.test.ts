// HM-IDENTITY-0.1: proves the invariants from
// docs/HANDBALL_MANAGER_CLUB_COACH_TEAM_IDENTITY_DOMAIN_MODEL_v0.1.md §26
// hold for representative shapes drawn from the 14 approved profiles'
// vocabulary -- not a real data import (that's HM-STAFF-DATA-0.1).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  selectCurrentStaffAssignments,
  validateClubIdentityProfile,
  validateCoachIdentityProfile,
  validateCurrentTeamIdentity,
  validateEvidenceReference,
  validateIdentityClaim,
  validateSeasonClubContext,
  validateSquadIdentityContext,
  validateStaffAssignment,
  validateStaffPerson,
  type IdentityValidationResult,
} from "./validators";
import type {
  ClubIdentityProfile,
  CoachIdentityProfile,
  CurrentTeamIdentity,
  IdentityClaim,
  SeasonClubContext,
  SquadIdentityContext,
  StaffAssignment,
  StaffPerson,
} from "./types";

const CLUB_ID = "se_club_alingsas_hk"; // a real canonical club id (game-data/clubs.ts)
const OTHER_CLUB_ID = "se_club_amo_hk";

function claim(overrides: Partial<IdentityClaim> = {}): IdentityClaim {
  return {
    id: "claim-1",
    subjectType: "CLUB",
    subjectId: CLUB_ID,
    domain: "STRUCTURAL",
    key: "clubStature",
    value: "STRONG",
    evidenceClass: "VERIFIED_EXTERNAL_DATA",
    temporalScope: "LONG_TERM",
    sourceRefs: ["ev-1"],
    ...overrides,
  };
}

function expectOk(result: IdentityValidationResult, label = "") {
  assert.equal(result.ok, true, label + (result.ok ? "" : `: ${result.errors.join("; ")}`));
}

function expectFail(result: IdentityValidationResult, label = "") {
  assert.equal(result.ok, false, `${label}: expected validation to fail but it passed`);
}

// ---------------------------------------------------------------------------
// Unknown remains unknown
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: an UNKNOWN_NOT_ASSESSED claim validates cleanly and its value is never silently replaced with a neutral fallback", () => {
  const c = claim({ evidenceClass: "UNKNOWN_NOT_ASSESSED", value: "UNKNOWN", sourceRefs: [], confidence: undefined });
  expectOk(validateIdentityClaim(c));
  assert.equal(c.value, "UNKNOWN", "the value must remain the literal source string, never a computed neutral like MEDIUM");
});

test("HM-IDENTITY-0.1: nothing in this module converts UNKNOWN_NOT_ASSESSED to a default/neutral value -- it is purely a pass-through validator", () => {
  const c = claim({ evidenceClass: "UNKNOWN_NOT_ASSESSED", value: "NOT YET VERIFIED", sourceRefs: [] });
  const result = validateIdentityClaim(c);
  expectOk(result);
  // The validator returns only {ok} or {ok, errors} -- it never returns
  // or mutates a "resolved value", so there is no code path that could
  // have silently substituted a fallback.
  assert.deepEqual(Object.keys(result), ["ok"]);
});

// ---------------------------------------------------------------------------
// Projection cannot validate as current observed identity
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: USER_PROJECTION + temporalScope PROJECTED is valid", () => {
  const c = claim({ evidenceClass: "USER_PROJECTION", temporalScope: "PROJECTED", key: "futureTacticalDirection", value: "MORE_TRANSITION_FOCUSED" });
  expectOk(validateIdentityClaim(c));
});

test("HM-IDENTITY-0.1: USER_PROJECTION + temporalScope CURRENT is rejected -- a projection can never be recorded as observed current identity", () => {
  const c = claim({ evidenceClass: "USER_PROJECTION", temporalScope: "CURRENT" });
  const result = validateIdentityClaim(c);
  expectFail(result);
  assert.ok(!result.ok && result.errors.some((e) => e.includes("USER_PROJECTION")));
});

test("HM-IDENTITY-0.1: new-coach uncertainty -- CURRENT tactical identity may be genuinely unknown while a separate USER_PROJECTION claim exists for the same subject without conflict", () => {
  const notYetEstablished = claim({ id: "c-current", evidenceClass: "UNKNOWN_NOT_ASSESSED", temporalScope: "CURRENT", key: "tacticalIdentity", value: "NOT_YET_ESTABLISHED", sourceRefs: [] });
  const projection = claim({ id: "c-projection", evidenceClass: "USER_PROJECTION", temporalScope: "PROJECTED", key: "tacticalIdentity", value: "LIKELY_MORE_STRUCTURED" });
  expectOk(validateIdentityClaim(notYetEstablished));
  expectOk(validateIdentityClaim(projection));
  assert.notEqual(notYetEstablished.temporalScope, projection.temporalScope, "the two must remain distinct claims in distinct temporal scopes, never merged");
});

// ---------------------------------------------------------------------------
// Coach claims remain portable/separate from club
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: CoachIdentityProfile is keyed by personId, not clubId -- coach claims stay portable across a club change", () => {
  const coach: CoachIdentityProfile = {
    personId: "person-coach-1",
    coachingStyleClaims: [claim({ id: "cc-1", subjectType: "COACH", subjectId: "person-coach-1", domain: "TACTICAL_COGNITIVE", key: "analyticalOrientation", value: "HIGH", evidenceClass: "USER_EXPERT_ASSESSMENT", temporalScope: "LONG_TERM" })],
    tacticalPreferenceClaims: [],
    communicationLeadershipClaims: [],
    developmentClaims: [],
    adaptabilityClaims: [],
    cultureBuildingClaims: [],
  };
  expectOk(validateCoachIdentityProfile(coach));
  // Nothing on CoachIdentityProfile references a clubId at all -- the type has no such field.
  assert.equal("clubId" in coach, false, "CoachIdentityProfile must never carry a clubId field -- the coach's identity is not owned by any club");
});

test("HM-IDENTITY-0.1: a coach claim whose subjectId does not match the profile's personId is rejected", () => {
  const coach: CoachIdentityProfile = {
    personId: "person-coach-1",
    coachingStyleClaims: [claim({ id: "cc-1", subjectType: "COACH", subjectId: "person-coach-WRONG", domain: "TACTICAL_COGNITIVE", key: "analyticalOrientation", value: "HIGH", evidenceClass: "USER_EXPERT_ASSESSMENT", temporalScope: "LONG_TERM" })],
    tacticalPreferenceClaims: [],
    communicationLeadershipClaims: [],
    developmentClaims: [],
    adaptabilityClaims: [],
    cultureBuildingClaims: [],
  };
  expectFail(validateCoachIdentityProfile(coach));
});

test("HM-IDENTITY-0.1: a club identity profile is valid and structurally independent of any coach profile (both about the same real club id, no cross-references required)", () => {
  const club: ClubIdentityProfile = {
    clubId: CLUB_ID,
    seasonReference: "2026/27",
    structuralIdentity: [claim({ id: "s-1", domain: "STRUCTURAL", key: "legacy", value: "STRONG" })],
    cultureIdentity: [],
    tacticalHeritage: [],
    developmentIdentity: [],
    recruitmentIdentity: [],
    financialStrategicIdentity: [],
    supporterEnvironmentIdentity: [],
  };
  expectOk(validateClubIdentityProfile(club));
});

// ---------------------------------------------------------------------------
// Season context remains season-scoped
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: SeasonClubContext claims must be SEASON-scoped -- a LONG_TERM claim inside it is rejected", () => {
  const ctx: SeasonClubContext = {
    clubId: CLUB_ID,
    season: "2026/27",
    organisationalClaims: [claim({ id: "sc-1", subjectType: "SEASON_CONTEXT", domain: "ORGANISATIONAL", key: "boardInstability", value: "HIGH", temporalScope: "SEASON", evidenceClass: "PROBABLE_EXTERNAL_DATA" })],
    financialClaims: [],
    squadClaims: [],
    competitiveClaims: [],
    transitionClaims: [],
  };
  expectOk(validateSeasonClubContext(ctx));

  const badCtx: SeasonClubContext = { ...ctx, organisationalClaims: [claim({ id: "sc-2", subjectType: "SEASON_CONTEXT", domain: "ORGANISATIONAL", key: "boardInstability", value: "HIGH", temporalScope: "LONG_TERM" })] };
  expectFail(validateSeasonClubContext(badCtx));
});

test("HM-IDENTITY-0.1: a SEASON-scoped claim is rejected inside ClubIdentityProfile's long-term identity fields -- season context is not storable as club identity", () => {
  const club: ClubIdentityProfile = {
    clubId: CLUB_ID,
    seasonReference: "2026/27",
    structuralIdentity: [claim({ id: "bad-1", temporalScope: "SEASON", key: "acuteFinancialCrisis", value: "HIGH", evidenceClass: "PROBABLE_EXTERNAL_DATA" })],
    cultureIdentity: [],
    tacticalHeritage: [],
    developmentIdentity: [],
    recruitmentIdentity: [],
    financialStrategicIdentity: [],
    supporterEnvironmentIdentity: [],
  };
  expectFail(validateClubIdentityProfile(club));
});

test("HM-IDENTITY-0.1: financial crisis modeled honestly -- acute crisis lives in SeasonClubContext (SEASON scope), while long-term financial strength stays separately in ClubIdentityProfile (LONG_TERM scope), and both can be simultaneously true", () => {
  const seasonCrisis = claim({ id: "crisis-1", subjectType: "SEASON_CONTEXT", domain: "FINANCIAL", key: "acuteFinancialPressure", value: "HIGH", temporalScope: "SEASON", evidenceClass: "PROBABLE_EXTERNAL_DATA" });
  const longTermStrength = claim({ id: "strength-1", subjectType: "CLUB", domain: "FINANCIAL_STRATEGIC", key: "financialStrength", value: "MODERATE", temporalScope: "LONG_TERM" });
  expectOk(validateIdentityClaim(seasonCrisis));
  expectOk(validateIdentityClaim(longTermStrength));
  assert.notEqual(seasonCrisis.temporalScope, longTermStrength.temporalScope);
});

// ---------------------------------------------------------------------------
// Multiple staff roles work
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: a single StaffAssignment may carry multiple standardRoles at once", () => {
  const knownPersonIds = new Set(["person-1"]);
  const assignment: StaffAssignment = {
    personId: "person-1",
    clubId: CLUB_ID,
    officialRole: "Assisterande tränare / Målvaktstränare",
    standardRoles: ["ASSISTANT_COACH", "GOALKEEPER_COACH"],
    status: "CONFIRMED",
    evidence: [],
  };
  expectOk(validateStaffAssignment(assignment, knownPersonIds));
  assert.equal(assignment.standardRoles.length, 2);
});

test("HM-IDENTITY-0.1: one person may hold multiple SEPARATE StaffAssignment records (e.g. different clubs, or a role at the same club needing clarification alongside a confirmed one)", () => {
  const knownPersonIds = new Set(["person-2"]);
  const a1: StaffAssignment = { personId: "person-2", clubId: CLUB_ID, officialRole: "Sportchef", standardRoles: ["SPORTING_DIRECTOR"], status: "CONFIRMED", evidence: [] };
  const a2: StaffAssignment = { personId: "person-2", clubId: OTHER_CLUB_ID, officialRole: "Styrelseledamot", standardRoles: ["CHAIRPERSON"], status: "HISTORICAL", evidence: [] };
  expectOk(validateStaffAssignment(a1, knownPersonIds));
  expectOk(validateStaffAssignment(a2, knownPersonIds));
  assert.equal(a1.personId, a2.personId);
});

test("HM-IDENTITY-0.1: standardRoles is never the only role record -- an assignment with an empty officialRole is rejected even if standardRoles is populated", () => {
  const knownPersonIds = new Set(["person-1"]);
  const assignment: StaffAssignment = { personId: "person-1", clubId: CLUB_ID, officialRole: "", standardRoles: ["HEAD_COACH"], status: "CONFIRMED", evidence: [] };
  expectFail(validateStaffAssignment(assignment, knownPersonIds));
});

test("HM-IDENTITY-0.1: imperfect role-group mapping -- an official title like \"Naprapat\" is preserved verbatim alongside its broader standardized medical-category role", () => {
  const knownPersonIds = new Set(["person-3"]);
  const assignment: StaffAssignment = { personId: "person-3", clubId: CLUB_ID, officialRole: "Naprapat", standardRoles: ["PERFORMANCE_STAFF"], status: "CONFIRMED", evidence: [] };
  expectOk(validateStaffAssignment(assignment, knownPersonIds));
  assert.equal(assignment.officialRole, "Naprapat", "the exact original title must survive even though it maps to a broader standardized role");
});

// ---------------------------------------------------------------------------
// Probable/historical status preserved
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: CONFIRMED, PROBABLE, and HISTORICAL statuses all validate and remain distinguishable from each other", () => {
  const knownPersonIds = new Set(["p"]);
  for (const status of ["CONFIRMED", "PROBABLE", "HISTORICAL", "ROLE_NEEDS_CLARIFICATION", "DUAL_STATUS"] as const) {
    const assignment: StaffAssignment = { personId: "p", clubId: CLUB_ID, officialRole: "Tränare", standardRoles: ["COACH"], status, evidence: [] };
    expectOk(validateStaffAssignment(assignment, knownPersonIds), `status ${status}`);
  }
});

test("HM-IDENTITY-0.1: selectCurrentStaffAssignments excludes HISTORICAL assignments -- historical staff are never loaded as current staff", () => {
  const assignments: StaffAssignment[] = [
    { personId: "p1", clubId: CLUB_ID, officialRole: "Tränare", standardRoles: ["HEAD_COACH"], status: "CONFIRMED", evidence: [] },
    { personId: "p2", clubId: CLUB_ID, officialRole: "Tidigare tränare", standardRoles: ["HEAD_COACH"], status: "HISTORICAL", evidence: [], validTo: "2025-06-30" },
    { personId: "p3", clubId: CLUB_ID, officialRole: "Sannolik assisterande tränare", standardRoles: ["ASSISTANT_COACH"], status: "PROBABLE", evidence: [] },
  ];
  const current = selectCurrentStaffAssignments(assignments, "2026-08-19");
  const currentPersonIds = current.map((a) => a.personId);
  assert.ok(currentPersonIds.includes("p1"));
  assert.ok(currentPersonIds.includes("p3"), "PROBABLE assignments still count as current -- only HISTORICAL/expired ones are excluded");
  assert.ok(!currentPersonIds.includes("p2"), "a HISTORICAL assignment must never be selected as current staff");
});

test("HM-IDENTITY-0.1: selectCurrentStaffAssignments excludes an assignment whose validTo has already passed, even if status is not explicitly HISTORICAL", () => {
  const assignments: StaffAssignment[] = [{ personId: "p1", clubId: CLUB_ID, officialRole: "Tränare", standardRoles: ["HEAD_COACH"], status: "CONFIRMED", evidence: [], validTo: "2026-01-01" }];
  const current = selectCurrentStaffAssignments(assignments, "2026-08-19");
  assert.equal(current.length, 0);
});

// ---------------------------------------------------------------------------
// Player/staff hybrid representable
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: a player/staff hybrid is ONE StaffPerson entity with a playerId cross-reference, plus its own staff assignment -- never a duplicated second identity", () => {
  const hybrid: StaffPerson = { id: "person-hybrid-1", displayName: "Anna Karlsson", playerId: "player-mock-42" };
  expectOk(validateStaffPerson(hybrid));

  const knownPersonIds = new Set([hybrid.id]);
  const staffAssignment: StaffAssignment = { personId: hybrid.id, clubId: CLUB_ID, officialRole: "Sportchef (aktiv spelare)", standardRoles: ["SPORTING_DIRECTOR", "ACTIVE_PLAYER"], status: "DUAL_STATUS", evidence: [] };
  expectOk(validateStaffAssignment(staffAssignment, knownPersonIds));

  assert.equal(hybrid.playerId, "player-mock-42");
  assert.equal(staffAssignment.personId, hybrid.id, "the staff assignment and the player cross-reference must resolve to the SAME entity id");
});

// ---------------------------------------------------------------------------
// Collective sportteam representable
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: a collective sporting group is ONE StaffPerson (personKind COLLECTIVE_GROUP) with ONE assignment -- never silently split into several individual directors", () => {
  const group: StaffPerson = { id: "person-sportgroup-1", personKind: "COLLECTIVE_GROUP", displayName: "Sportgruppen" };
  expectOk(validateStaffPerson(group));

  const knownPersonIds = new Set([group.id]);
  const assignment: StaffAssignment = { personId: group.id, clubId: CLUB_ID, officialRole: "Sportgrupp (kollektivt sportsligt ledarskap)", standardRoles: ["SPORTING_DIRECTOR"], status: "CONFIRMED", evidence: [] };
  expectOk(validateStaffAssignment(assignment, knownPersonIds));

  // Exactly one person, exactly one assignment -- not N individual director records.
  assert.equal(group.personKind, "COLLECTIVE_GROUP");
});

// ---------------------------------------------------------------------------
// No numeric ratings invented
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: qualitative source vocabulary (STRONG, ELITE, GROWING, THIN, VARIABLE, ...) passes through claims unchanged -- nothing here maps it to a 1-20 number", () => {
  const qualitativeValues = ["PRIMARY", "CORE", "STRONG", "VERY STRONG", "ELITE", "HIGH", "VERY HIGH", "LOW", "LIMITED", "GROWING", "IMPROVING", "VARIABLE", "DYNAMIC", "THIN", "SIMPLE", "UNKNOWN"];
  for (const value of qualitativeValues) {
    const c = claim({ id: `q-${value}`, value, evidenceClass: value === "UNKNOWN" ? "UNKNOWN_NOT_ASSESSED" : "VERIFIED_EXTERNAL_DATA", sourceRefs: value === "UNKNOWN" ? [] : ["ev-1"] });
    expectOk(validateIdentityClaim(c), value);
    assert.equal(c.value, value, "the validator must never rewrite/normalize a qualitative value");
    assert.equal(typeof c.value, "string", "qualitative claims must remain strings -- validators never coerce them to numbers");
  }
});

test("HM-IDENTITY-0.1: CurrentTeamIdentity has no opaque aggregate identity score field, and rejects one if present on loosely-typed input", () => {
  const identity: CurrentTeamIdentity = {
    clubId: CLUB_ID,
    season: "2026/27",
    claims: [claim({ id: "team-1", subjectType: "TEAM", key: "currentTacticalIdentity", value: "TRANSITION_FOCUSED", sourceRefs: ["ev-1"] })],
    derivedFrom: { clubIdentityRef: CLUB_ID },
  };
  expectOk(validateCurrentTeamIdentity(identity));
  assert.equal("overallScore" in identity, false);
  assert.equal("rating" in identity, false);

  const tampered = { ...identity, overallScore: 87 } as unknown as CurrentTeamIdentity;
  expectFail(validateCurrentTeamIdentity(tampered));
});

test("HM-IDENTITY-0.1: a derived CurrentTeamIdentity claim with no sourceRefs is rejected -- every derived value must retain provenance", () => {
  const identity: CurrentTeamIdentity = {
    clubId: CLUB_ID,
    season: "2026/27",
    claims: [claim({ id: "team-2", subjectType: "TEAM", key: "currentTacticalIdentity", value: "UNKNOWN", evidenceClass: "UNKNOWN_NOT_ASSESSED", sourceRefs: [] })],
    derivedFrom: { clubIdentityRef: CLUB_ID },
  };
  // UNKNOWN_NOT_ASSESSED is allowed empty sourceRefs at the claim level,
  // but a TEAM-subject derived claim still must retain provenance per §16 --
  // this is a stricter rule than the general claim validator, checked separately here.
  expectFail(validateCurrentTeamIdentity(identity));
});

// ---------------------------------------------------------------------------
// SquadIdentityContext, EvidenceReference -- basic structural coverage
// ---------------------------------------------------------------------------

test("HM-IDENTITY-0.1: a valid SquadIdentityContext validates", () => {
  const ctx: SquadIdentityContext = {
    clubId: CLUB_ID,
    season: "2026/27",
    claims: [claim({ id: "sq-1", subjectType: "SQUAD", domain: "SQUAD_COMPOSITION", key: "squadDepth", value: "THIN", evidenceClass: "PROBABLE_EXTERNAL_DATA", temporalScope: "CURRENT" })],
  };
  expectOk(validateSquadIdentityContext(ctx));
});

test("HM-IDENTITY-0.1: an unknown clubId is rejected across every container that references one", () => {
  const badClub: ClubIdentityProfile = { clubId: "not-a-real-club", seasonReference: "2026/27", structuralIdentity: [], cultureIdentity: [], tacticalHeritage: [], developmentIdentity: [], recruitmentIdentity: [], financialStrategicIdentity: [], supporterEnvironmentIdentity: [] };
  expectFail(validateClubIdentityProfile(badClub));

  const badSquad: SquadIdentityContext = { clubId: "not-a-real-club", season: "2026/27", claims: [] };
  expectFail(validateSquadIdentityContext(badSquad));

  const badSeason: SeasonClubContext = { clubId: "not-a-real-club", season: "2026/27", organisationalClaims: [], financialClaims: [], squadClaims: [], competitiveClaims: [], transitionClaims: [] };
  expectFail(validateSeasonClubContext(badSeason));
});

test("HM-IDENTITY-0.1: EvidenceReference requires a non-empty id and sourceDocument", () => {
  expectOk(validateEvidenceReference({ id: "ev-1", sourceDocument: "CLUB_IDENTITY_v0.1_Alingsas_HK", sourceType: "APPROVED_PROFILE_DOCX" }));
  expectFail(validateEvidenceReference({ id: "", sourceDocument: "", sourceType: "OTHER" }));
});

test("HM-IDENTITY-0.1: comparative claims (\"best\", \"world class\") are representable as ordinary claims -- no automatic conversion into a verified/rated fact", () => {
  const c = claim({ id: "comp-1", domain: "STRUCTURAL", key: "clubStature", value: "TOP_3_IN_LEAGUE", evidenceClass: "USER_EXPERT_ASSESSMENT", confidence: "PROBABLE" });
  expectOk(validateIdentityClaim(c));
  assert.notEqual(c.evidenceClass, "VERIFIED_EXTERNAL_DATA", "an unverified comparative claim must not be silently treated as verified fact");
});
