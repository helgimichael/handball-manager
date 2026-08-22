// HM-IDENTITY-0.1: validators for the invariants in
// docs/HANDBALL_MANAGER_CLUB_COACH_TEAM_IDENTITY_DOMAIN_MODEL_v0.1.md §26.
//
// Every function here is a pure, framework-free predicate/check -- no
// throwing, no side effects, no network/filesystem access. They report
// problems as string messages so a future import pipeline (HM-STAFF-DATA-0.1)
// can decide what to do with them (reject, warn, quarantine); this
// module never decides that policy itself.
import { CLUBS } from "../game-data/clubs";
import {
  EVIDENCE_CLASSES,
  HM_STAFF_ROLES,
  TEMPORAL_SCOPES,
  type ClubIdentityProfile,
  type CoachIdentityProfile,
  type CurrentTeamIdentity,
  type EvidenceReference,
  type IdentityClaim,
  type SeasonClubContext,
  type SquadIdentityContext,
  type StaffAssignment,
  type StaffPerson,
} from "./types";
import { CLUB_IDENTITY_CLAIM_FIELDS, COACH_IDENTITY_CLAIM_FIELDS, SEASON_CLUB_CONTEXT_CLAIM_FIELDS } from "./types";

export type IdentityValidationResult = { ok: true } | { ok: false; errors: string[] };

function ok(): IdentityValidationResult {
  return { ok: true };
}

function fail(errors: string[]): IdentityValidationResult {
  return { ok: false, errors };
}

function knownClubId(clubId: string): boolean {
  return CLUBS.some((c) => c.id === clubId);
}

// ---------------------------------------------------------------------------
// IdentityClaim
// ---------------------------------------------------------------------------

/**
 * Structural + invariant checks for one claim in isolation. `expected`
 * lets a caller (e.g. validateClubIdentityProfile) additionally pin the
 * subjectType/subjectId this specific claim must carry, without this
 * function needing to know which container it came from.
 *
 * Invariant 4 (every meaningful claim has an evidence class) and
 * invariant 5 (USER_PROJECTION is never treated as observed current
 * identity) are both enforced here.
 */
export function validateIdentityClaim(claim: IdentityClaim, expected?: { subjectType?: IdentityClaim["subjectType"]; subjectId?: string }): IdentityValidationResult {
  const errors: string[] = [];

  if (!claim.id || claim.id.trim().length === 0) {
    errors.push("IdentityClaim.id must be a non-empty string.");
  }
  if (!EVIDENCE_CLASSES.includes(claim.evidenceClass)) {
    errors.push(`IdentityClaim.evidenceClass "${claim.evidenceClass}" is not a recognized EvidenceClass.`);
  }
  if (!TEMPORAL_SCOPES.includes(claim.temporalScope)) {
    errors.push(`IdentityClaim.temporalScope "${claim.temporalScope}" is not a recognized TemporalScope.`);
  }
  if (claim.value === undefined || claim.value === null) {
    errors.push("IdentityClaim.value must be present -- use evidenceClass UNKNOWN_NOT_ASSESSED with an explicit value (e.g. \"UNKNOWN\") rather than omitting value.");
  }
  if (!Array.isArray(claim.sourceRefs)) {
    errors.push("IdentityClaim.sourceRefs must be an array (may be empty only for UNKNOWN_NOT_ASSESSED claims).");
  } else if (claim.sourceRefs.length === 0 && claim.evidenceClass !== "UNKNOWN_NOT_ASSESSED") {
    errors.push(`IdentityClaim "${claim.id}" has no sourceRefs but evidenceClass is "${claim.evidenceClass}" -- every non-UNKNOWN claim must cite at least one source.`);
  }

  // Invariant 5: a projection is never allowed to masquerade as observed CURRENT identity.
  if (claim.evidenceClass === "USER_PROJECTION" && claim.temporalScope !== "PROJECTED") {
    errors.push(`IdentityClaim "${claim.id}" has evidenceClass USER_PROJECTION but temporalScope "${claim.temporalScope}" -- a projection must always carry temporalScope PROJECTED, never CURRENT/LONG_TERM/HISTORICAL/SEASON.`);
  }

  if (expected?.subjectType && claim.subjectType !== expected.subjectType) {
    errors.push(`IdentityClaim "${claim.id}" has subjectType "${claim.subjectType}", expected "${expected.subjectType}" for this container.`);
  }
  if (expected?.subjectId && claim.subjectId !== expected.subjectId) {
    errors.push(`IdentityClaim "${claim.id}" has subjectId "${claim.subjectId}", expected "${expected.subjectId}" for this container.`);
  }

  return errors.length === 0 ? ok() : fail(errors);
}

function validateClaimList(claims: IdentityClaim[], containerLabel: string, expected?: { subjectType?: IdentityClaim["subjectType"]; subjectId?: string }): string[] {
  const errors: string[] = [];
  for (const claim of claims) {
    const result = validateIdentityClaim(claim, expected);
    if (!result.ok) {
      errors.push(...result.errors.map((e) => `${containerLabel}: ${e}`));
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// ClubIdentityProfile
// ---------------------------------------------------------------------------

/** Invariant 7 (partial): a club's long-term identity fields must never carry a SEASON-scoped claim -- that belongs in SeasonClubContext instead. */
export function validateClubIdentityProfile(profile: ClubIdentityProfile): IdentityValidationResult {
  const errors: string[] = [];

  if (!knownClubId(profile.clubId)) {
    errors.push(`ClubIdentityProfile.clubId "${profile.clubId}" does not match any known canonical club id.`);
  }

  for (const field of CLUB_IDENTITY_CLAIM_FIELDS) {
    const claims = profile[field];
    errors.push(...validateClaimList(claims, `ClubIdentityProfile.${field}`, { subjectId: profile.clubId }));
    for (const claim of claims) {
      if (claim.temporalScope === "SEASON") {
        errors.push(`ClubIdentityProfile.${field}: claim "${claim.id}" has temporalScope SEASON -- season-scoped claims belong in SeasonClubContext, not in long-term club identity.`);
      }
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}

// ---------------------------------------------------------------------------
// CoachIdentityProfile
// ---------------------------------------------------------------------------

/** Invariant 8: coach claims belong to coach identity -- every claim under a CoachIdentityProfile must be subjectType COACH, subjectId === personId. */
export function validateCoachIdentityProfile(profile: CoachIdentityProfile): IdentityValidationResult {
  const errors: string[] = [];

  if (!profile.personId || profile.personId.trim().length === 0) {
    errors.push("CoachIdentityProfile.personId must be a non-empty string.");
  }

  for (const field of COACH_IDENTITY_CLAIM_FIELDS) {
    errors.push(...validateClaimList(profile[field], `CoachIdentityProfile.${field}`, { subjectType: "COACH", subjectId: profile.personId }));
  }

  return errors.length === 0 ? ok() : fail(errors);
}

// ---------------------------------------------------------------------------
// StaffPerson / StaffAssignment
// ---------------------------------------------------------------------------

export function validateStaffPerson(person: StaffPerson): IdentityValidationResult {
  const errors: string[] = [];
  if (!person.id || person.id.trim().length === 0) {
    errors.push("StaffPerson.id must be a non-empty string.");
  }
  if (!person.displayName || person.displayName.trim().length === 0) {
    errors.push("StaffPerson.displayName must be a non-empty string.");
  }
  return errors.length === 0 ? ok() : fail(errors);
}

/**
 * Invariant 1 (references a known person and club), invariant 2 (official
 * role text is preserved), invariant 3 (standardized role is never the
 * only role record), invariant 11 (probable/confirmed/historical status
 * distinguishable -- enforced structurally by the `status` union, checked
 * here for a recognized value).
 *
 * `knownPersonIds` is supplied by the caller (this module has no
 * database of its own -- see HM-STAFF-DATA-0.1 for the actual import).
 */
export function validateStaffAssignment(assignment: StaffAssignment, knownPersonIds: ReadonlySet<string>): IdentityValidationResult {
  const errors: string[] = [];

  if (!knownPersonIds.has(assignment.personId)) {
    errors.push(`StaffAssignment.personId "${assignment.personId}" does not reference a known StaffPerson.`);
  }
  if (!knownClubId(assignment.clubId)) {
    errors.push(`StaffAssignment.clubId "${assignment.clubId}" does not match any known canonical club id.`);
  }
  if (!assignment.officialRole || assignment.officialRole.trim().length === 0) {
    errors.push("StaffAssignment.officialRole must be a non-empty string -- the standardized role alone is never sufficient (invariant 2/3).");
  }
  if (!Array.isArray(assignment.standardRoles) || assignment.standardRoles.length === 0) {
    errors.push("StaffAssignment.standardRoles must contain at least one HMStaffRole.");
  } else {
    for (const role of assignment.standardRoles) {
      if (!HM_STAFF_ROLES.includes(role)) {
        errors.push(`StaffAssignment.standardRoles contains unrecognized role "${role}".`);
      }
    }
  }
  const validStatuses = ["CONFIRMED", "PROBABLE", "HISTORICAL", "ROLE_NEEDS_CLARIFICATION", "DUAL_STATUS"];
  if (!validStatuses.includes(assignment.status)) {
    errors.push(`StaffAssignment.status "${assignment.status}" is not a recognized status.`);
  }
  if (!Array.isArray(assignment.evidence)) {
    errors.push("StaffAssignment.evidence must be an array.");
  }

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateEvidenceReference(ref: EvidenceReference): IdentityValidationResult {
  const errors: string[] = [];
  if (!ref.id || ref.id.trim().length === 0) {
    errors.push("EvidenceReference.id must be a non-empty string.");
  }
  if (!ref.sourceDocument || ref.sourceDocument.trim().length === 0) {
    errors.push("EvidenceReference.sourceDocument must be a non-empty string.");
  }
  return errors.length === 0 ? ok() : fail(errors);
}

/**
 * Invariant 10: historical assignments are not loaded as current staff.
 * This is the load-bearing selector every future "who currently works
 * here" screen should use -- filtering is centralized here rather than
 * reimplemented ad hoc per caller.
 */
export function selectCurrentStaffAssignments(assignments: readonly StaffAssignment[], asOfDate: string): StaffAssignment[] {
  return assignments.filter((a) => {
    if (a.status === "HISTORICAL") return false;
    if (a.validTo && a.validTo < asOfDate) return false;
    if (a.validFrom && a.validFrom > asOfDate) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// SquadIdentityContext
// ---------------------------------------------------------------------------

export function validateSquadIdentityContext(ctx: SquadIdentityContext): IdentityValidationResult {
  const errors: string[] = [];
  if (!knownClubId(ctx.clubId)) {
    errors.push(`SquadIdentityContext.clubId "${ctx.clubId}" does not match any known canonical club id.`);
  }
  if (!ctx.season || ctx.season.trim().length === 0) {
    errors.push("SquadIdentityContext.season must be a non-empty string.");
  }
  errors.push(...validateClaimList(ctx.claims, "SquadIdentityContext.claims", { subjectId: ctx.clubId }));
  return errors.length === 0 ? ok() : fail(errors);
}

// ---------------------------------------------------------------------------
// SeasonClubContext
// ---------------------------------------------------------------------------

/** Invariant 7: season context is not stored as long-term club identity -- every claim here must actually be SEASON-scoped (or PROJECTED, for forward-looking season claims), never LONG_TERM/HISTORICAL/CURRENT. */
export function validateSeasonClubContext(ctx: SeasonClubContext): IdentityValidationResult {
  const errors: string[] = [];

  if (!knownClubId(ctx.clubId)) {
    errors.push(`SeasonClubContext.clubId "${ctx.clubId}" does not match any known canonical club id.`);
  }
  if (!ctx.season || ctx.season.trim().length === 0) {
    errors.push("SeasonClubContext.season must be a non-empty string.");
  }

  for (const field of SEASON_CLUB_CONTEXT_CLAIM_FIELDS) {
    const claims = ctx[field];
    errors.push(...validateClaimList(claims, `SeasonClubContext.${field}`, { subjectId: ctx.clubId }));
    for (const claim of claims) {
      if (claim.temporalScope !== "SEASON" && claim.temporalScope !== "PROJECTED") {
        errors.push(`SeasonClubContext.${field}: claim "${claim.id}" has temporalScope "${claim.temporalScope}" -- season context claims must be SEASON (or PROJECTED), never LONG_TERM/HISTORICAL/CURRENT.`);
      }
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}

// ---------------------------------------------------------------------------
// CurrentTeamIdentity
// ---------------------------------------------------------------------------

/**
 * Every derived claim retains provenance (non-empty sourceRefs), every
 * claim's subjectType is TEAM, and -- structurally guaranteed by the
 * type itself, checked here defensively against loosely-typed input --
 * no opaque aggregate "overall identity" field exists anywhere on the
 * object (Spec §16).
 */
export function validateCurrentTeamIdentity(identity: CurrentTeamIdentity): IdentityValidationResult {
  const errors: string[] = [];

  if (!knownClubId(identity.clubId)) {
    errors.push(`CurrentTeamIdentity.clubId "${identity.clubId}" does not match any known canonical club id.`);
  }

  errors.push(...validateClaimList(identity.claims, "CurrentTeamIdentity.claims", { subjectType: "TEAM", subjectId: identity.clubId }));
  for (const claim of identity.claims) {
    if (claim.sourceRefs.length === 0) {
      errors.push(`CurrentTeamIdentity.claims: derived claim "${claim.id}" has no sourceRefs -- every derived value must retain provenance.`);
    }
  }

  const FORBIDDEN_AGGREGATE_KEYS = ["overallScore", "overallRating", "rating", "score", "identityScore"];
  for (const key of FORBIDDEN_AGGREGATE_KEYS) {
    if (key in (identity as unknown as Record<string, unknown>)) {
      errors.push(`CurrentTeamIdentity must never carry an opaque aggregate field -- found "${key}".`);
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}
