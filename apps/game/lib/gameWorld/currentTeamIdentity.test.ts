// HM-IDENTITY-0.2: proves the Current Team Identity resolver against
// REAL imported clubs/coaches (Spec: "use real imported clubs/coaches
// in tests where possible") -- see lib/identity/resolver.test.ts for
// the same invariants proven with constructed synthetic fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCurrentTeamIdentity } from "../identity/resolver";
import { validateCurrentTeamIdentity } from "../identity/validators";
import { loadCoachIdentity } from "./coachIdentityLoader";
import { loadClubIdentity, loadSeasonIdentity, loadSquadIdentity } from "./clubIdentityLoader";
import { loadClubStaffIdentity } from "./staffIdentityLoader";
import { selectCurrentStaffAssignments } from "../identity/validators";

/** The real head coach's personId currently CONFIRMED at a club, or null. Mirrors how a future career-layer caller would resolve "who currently coaches this club" from imported staff data. */
function currentHeadCoachPersonId(clubId: string, asOfDate: string): string | null {
  const staff = loadClubStaffIdentity(clubId);
  if (!staff) return null;
  const current = selectCurrentStaffAssignments(staff.assignments, asOfDate);
  const headCoach = current.find((a) => a.standardRoles.includes("HEAD_COACH"));
  return headCoach?.personId ?? null;
}

function resolveForClub(clubId: string, asOfDate = "2026-08-19") {
  const club = loadClubIdentity(clubId);
  const squad = loadSquadIdentity(clubId);
  const season = loadSeasonIdentity(clubId);
  const coachPersonId = currentHeadCoachPersonId(clubId, asOfDate);
  const coach = coachPersonId ? loadCoachIdentity(coachPersonId) : null;

  return resolveCurrentTeamIdentity({
    clubId,
    season: "2026/27",
    clubIdentity: club?.profile ?? null,
    coachPersonId,
    coachIdentity: coach?.profile ?? null,
    squadContext: squad?.context ?? null,
    seasonContext: season?.context ?? null,
    tacticalProfile: null,
  });
}

test("HM-IDENTITY-0.2: Alingsås HK resolves real club (tactical heritage) + real coach (Mattias Flodman) claims together, all validating", () => {
  const identity = resolveForClub("se_club_alingsas_hk");
  assert.ok(identity.claims.length > 0);
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);

  assert.equal(identity.derivedFrom.coachIdentityRef, "person-mattias-flodman-se-club-alingsas-hk");
  const transitionClaims = identity.claims.filter((c) => c.domain === "TRANSITION");
  assert.ok(transitionClaims.length > 0, "expected real TRANSITION-domain claims for Alingsås");
  assert.ok(transitionClaims.every((c) => c.contributingClaims.every((cc) => cc.subjectType === "CLUB")), "Alingsås's coach claim (analytical orientation) has domain TACTICAL_COGNITIVE, not TRANSITION -- must never bleed into a club dimension");
});

test("HM-IDENTITY-0.2: Hammarby IF HF resolves club + squad + coach together, with TACTICAL_FLEXIBILITY genuinely populated from real tempo-control claims", () => {
  const identity = resolveForClub("se_club_hammarby_if_hf");
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);

  const flexClaims = identity.claims.filter((c) => c.domain === "TACTICAL_FLEXIBILITY");
  assert.ok(flexClaims.length >= 2, "expected tempo-control-as-flexibility claims for Hammarby");

  const squadClaims = identity.claims.filter((c) => c.contributingClaims.some((cc) => cc.subjectType === "SQUAD"));
  assert.ok(squadClaims.length > 0, "expected real SQUAD-sourced claims (squad continuity/experience/depth) for Hammarby");
  assert.equal(identity.derivedFrom.squadContextRef, "se_club_hammarby_if_hf:2026/27");
});

test("HM-IDENTITY-0.2: IK Sävehof (real club with NO assessed coach -- Linus Ekman is unsupported) still resolves TACTICAL_FLEXIBILITY/DEVELOPMENT/RECRUITMENT/CULTURE from club+squad evidence alone, without fabricating a coach claim", () => {
  const identity = resolveForClub("se_club_ik_savehof");
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);

  assert.ok(identity.claims.some((c) => c.domain === "TACTICAL_FLEXIBILITY"));
  assert.ok(identity.claims.some((c) => c.domain === "DEVELOPMENT"));
  assert.ok(identity.claims.some((c) => c.domain === "RECRUITMENT"));
  assert.ok(identity.claims.some((c) => c.domain === "CULTURE"));
  assert.ok(identity.claims.every((c) => c.domain !== "COACHING_ENVIRONMENT"), "Sävehof's head coach has no assessed identity -- no COACHING_ENVIRONMENT claim may exist");

  // The coach IS on staff (Linus Ekman, HEAD_COACH) -- just unassessed. The reference should still be present for provenance.
  assert.equal(identity.derivedFrom.coachIdentityRef, "person-linus-ekman-se-club-ik-savehof");
});

test("HM-IDENTITY-0.2: OV Helsingborg HK's real projection claims (Siglev era) resolve as genuinely separate PROJECTED claims, never merged into the CURRENT/NOT_YET_ESTABLISHED claims", () => {
  const identity = resolveForClub("se_club_ov_helsingborg");
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);

  const currentAttack = identity.claims.find((c) => c.key === "currentAttackingIdentity")!;
  const projectedAttack = identity.claims.find((c) => c.key === "projectedAttackingTempo")!;
  assert.ok(currentAttack);
  assert.ok(projectedAttack);
  assert.equal(currentAttack.value, "NOT_YET_ESTABLISHED");
  assert.equal(currentAttack.evidenceClass, "USER_EXPERT_ASSESSMENT");
  assert.equal(projectedAttack.value, "HIGH");
  assert.equal(projectedAttack.evidenceClass, "USER_PROJECTION");
  assert.equal(projectedAttack.temporalScope, "PROJECTED");

  // Real SeasonClubContext for OV: head-coach transition, tactical certainty LOW.
  assert.equal(identity.derivedFrom.seasonContextRef, "se_club_ov_helsingborg:2026/27");
  const seasonSourced = identity.claims.filter((c) => c.contributingClaims.some((cc) => cc.subjectType === "SEASON_CONTEXT"));
  assert.ok(seasonSourced.length > 0);
  assert.ok(seasonSourced.every((c) => c.temporalScope === "SEASON"));
});

test("HM-IDENTITY-0.2: HK Malmö's real historical-recruitment + current-youth-integration claims resolve as two genuinely distinct, correctly-temporal-scoped claims -- the exact Spec §19 worked example, with real source data", () => {
  const identity = resolveForClub("se_club_hk_malmo");
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);

  const historical = identity.claims.find((c) => c.key === "historicalExternalRecruitment")!;
  const current = identity.claims.find((c) => c.key === "currentYouthIntegration")!;
  assert.ok(historical);
  assert.ok(current);
  assert.equal(historical.temporalScope, "HISTORICAL");
  assert.equal(current.temporalScope, "CURRENT");
  assert.notEqual(historical.domain, undefined);

  // Real season context: this club has real coach data too (Zoran Roganovic).
  assert.equal(identity.derivedFrom.coachIdentityRef, "person-zoran-roganovic-se-club-hk-malmo");
  const coachClaims = identity.claims.filter((c) => c.domain === "COACHING_ENVIRONMENT");
  assert.ok(coachClaims.length > 0, "expected real coaching-environment claims for HK Malmö (Roganovic's authority/discipline profile)");
});

test("HM-IDENTITY-0.2: same real inputs resolved twice produce byte-identical output", () => {
  const a = resolveForClub("se_club_alingsas_hk");
  const b = resolveForClub("se_club_alingsas_hk");
  assert.deepEqual(a, b);
});

test("HM-IDENTITY-0.2: a club with no imported club/squad/season/coach identity file yet (e.g. IF Hallby HK -- real staff data exists, but neither club-level claims nor an assessed coach have been imported) resolves to an honest, fully empty, still-valid identity -- never invents any of it", () => {
  const identity = resolveForClub("se_club_if_hallby_hk");
  assert.deepEqual(identity.claims, []);
  // Hallby's real head coach (Tobias Nordendorph) is on staff -- his personId is still recorded for provenance -- but he has no assessed identity, so nothing was resolved FROM him.
  assert.equal(identity.derivedFrom.coachIdentityRef, "person-tobias-nordendorph-se-club-if-hallby-hk");
  assert.equal(validateCurrentTeamIdentity(identity).ok, true);
});
