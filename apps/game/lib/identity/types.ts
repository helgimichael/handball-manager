// HM-IDENTITY-0.1: structured Club/Coach/Team Identity source schema.
// Design source of truth: docs/HANDBALL_MANAGER_CLUB_COACH_TEAM_IDENTITY_DOMAIN_MODEL_v0.1.md
//
// This module defines ONLY the shape of imported identity source data --
// it has no gameplay effects, no AI tactical mapping, and no rating
// scales. A single flat "ClubIdentity" object would silently merge
// long-term club heritage, portable coach philosophy, current squad
// composition, and temporary season conditions into one blob that can
// never be told apart again once merged -- that loss of separability is
// exactly what this schema exists to prevent (Spec §1/§2).
//
// Every field here is either a structural identifier (ids, references)
// or an IdentityClaim -- claims are the only place qualitative/evidence-
// bearing content lives, and they always carry their own evidence class
// and temporal scope. Nothing in this file computes, aggregates, scores,
// or infers anything; it only describes what a valid piece of imported
// identity data looks like. HM-IDENTITY-0.2 (the resolver) and
// HM-IDENTITY-0.3 (the AI tactical adapter) are explicitly out of scope.

/** Spec §3: the canonical root object kinds this schema represents. */

// ---------------------------------------------------------------------------
// Evidence model (Spec §10)
// ---------------------------------------------------------------------------

/**
 * How a claim is known, not how strong it is. Never collapsed into a
 * single "confidence score" -- each class has distinct import/consumption
 * semantics (see the spec's per-value semantics, Spec §10).
 */
export type EvidenceClass =
  | "VERIFIED_EXTERNAL_DATA"
  | "VERIFIED_EXTERNAL_CLUB_STRATEGY"
  | "VERIFIED_EXTERNAL_CLUB_STATEMENT"
  | "PROBABLE_EXTERNAL_DATA"
  | "USER_EXPERT_ASSESSMENT"
  | "USER_PROJECTION"
  | "USER_EXPERT_REQUIRES_VERIFICATION"
  | "INFERENCE"
  | "UNKNOWN_NOT_ASSESSED";

export const EVIDENCE_CLASSES: readonly EvidenceClass[] = [
  "VERIFIED_EXTERNAL_DATA",
  "VERIFIED_EXTERNAL_CLUB_STRATEGY",
  "VERIFIED_EXTERNAL_CLUB_STATEMENT",
  "PROBABLE_EXTERNAL_DATA",
  "USER_EXPERT_ASSESSMENT",
  "USER_PROJECTION",
  "USER_EXPERT_REQUIRES_VERIFICATION",
  "INFERENCE",
  "UNKNOWN_NOT_ASSESSED",
];

/**
 * A pointer to where a claim came from -- never the claim's value itself.
 * Multiple claims may cite the same EvidenceReference (via
 * IdentityClaim.sourceRefs), so this is deduplicated, not embedded.
 */
export interface EvidenceReference {
  id: string;
  sourceDocument: string;
  sourceType: "APPROVED_PROFILE_DOCX" | "EXTERNAL_ARTICLE" | "CLUB_STATEMENT" | "EXPERT_ASSESSMENT" | "OTHER";
  /** e.g. a section/paragraph/table reference within the source document. */
  locator?: string;
  retrievedDate?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Temporal model (Spec §17)
// ---------------------------------------------------------------------------

export type TemporalScope = "LONG_TERM" | "HISTORICAL" | "CURRENT" | "SEASON" | "PROJECTED";

export const TEMPORAL_SCOPES: readonly TemporalScope[] = ["LONG_TERM", "HISTORICAL", "CURRENT", "SEASON", "PROJECTED"];

// ---------------------------------------------------------------------------
// IdentityClaim (Spec §11)
// ---------------------------------------------------------------------------

export type IdentityClaimSubjectType = "CLUB" | "COACH" | "STAFF" | "SQUAD" | "TEAM" | "SEASON_CONTEXT" | "ENVIRONMENT";

export const IDENTITY_CLAIM_SUBJECT_TYPES: readonly IdentityClaimSubjectType[] = ["CLUB", "COACH", "STAFF", "SQUAD", "TEAM", "SEASON_CONTEXT", "ENVIRONMENT"];

/**
 * The atomic unit of imported identity information. Deliberately NOT
 * numeric-only -- the approved source vocabulary is qualitative (PRIMARY,
 * CORE, STRONG, ELITE, GROWING, THIN, UNKNOWN, ...) and this schema never
 * prematurely collapses that to a 1-20 scale (Spec §11, §24).
 */
export interface IdentityClaim {
  id: string;
  subjectType: IdentityClaimSubjectType;
  /** The id of the thing this claim is about -- a clubId, personId, etc, depending on subjectType. */
  subjectId: string;
  /** A domain grouping (e.g. "TACTICAL_HERITAGE", "RECRUITMENT") -- free-form but stable per caller, not a closed enum (the 14 source profiles' domain vocabulary is still growing). */
  domain: string;
  key: string;
  value: string | number | boolean;
  evidenceClass: EvidenceClass;
  confidence?: "CONFIRMED" | "PROBABLE" | "UNCERTAIN";
  temporalScope: TemporalScope;
  season?: string;
  validFrom?: string;
  validTo?: string;
  /** EvidenceReference ids this claim is backed by -- may be empty only for UNKNOWN_NOT_ASSESSED claims (see validators.ts). */
  sourceRefs: string[];
  notes?: string;
}

// ---------------------------------------------------------------------------
// ClubIdentityProfile (Spec §4, §12)
// ---------------------------------------------------------------------------

/**
 * Long-term structural/cultural/tactical heritage that can persist beyond
 * the current coach and current squad. Must never directly contain
 * current player ratings, current squad strength, current coach traits,
 * temporary transfer losses, injury state, or season-specific title
 * expectations (Spec §4) -- those live in SquadIdentityContext /
 * SeasonClubContext / CoachIdentityProfile instead.
 */
export interface ClubIdentityProfile {
  clubId: string;
  seasonReference: string;
  structuralIdentity: IdentityClaim[];
  cultureIdentity: IdentityClaim[];
  tacticalHeritage: IdentityClaim[];
  developmentIdentity: IdentityClaim[];
  recruitmentIdentity: IdentityClaim[];
  financialStrategicIdentity: IdentityClaim[];
  supporterEnvironmentIdentity: IdentityClaim[];
}

/** Every IdentityClaim[] field on ClubIdentityProfile, for iteration by validators/tests. */
export const CLUB_IDENTITY_CLAIM_FIELDS = [
  "structuralIdentity",
  "cultureIdentity",
  "tacticalHeritage",
  "developmentIdentity",
  "recruitmentIdentity",
  "financialStrategicIdentity",
  "supporterEnvironmentIdentity",
] as const satisfies readonly (keyof ClubIdentityProfile)[];

// ---------------------------------------------------------------------------
// CoachIdentityProfile (Spec §5, §13)
// ---------------------------------------------------------------------------

/**
 * Coach identity belongs to the PERSON and moves with them if they
 * change club (Spec §5, §18) -- keyed by personId, never by clubId.
 * Preference/philosophy and quality/capability are kept in separate
 * claim buckets rather than collapsed into one generic coaching rating
 * (Spec §5, §13).
 */
export interface CoachIdentityProfile {
  personId: string;
  coachingStyleClaims: IdentityClaim[];
  tacticalPreferenceClaims: IdentityClaim[];
  communicationLeadershipClaims: IdentityClaim[];
  developmentClaims: IdentityClaim[];
  adaptabilityClaims: IdentityClaim[];
  cultureBuildingClaims: IdentityClaim[];
}

export const COACH_IDENTITY_CLAIM_FIELDS = [
  "coachingStyleClaims",
  "tacticalPreferenceClaims",
  "communicationLeadershipClaims",
  "developmentClaims",
  "adaptabilityClaims",
  "cultureBuildingClaims",
] as const satisfies readonly (keyof CoachIdentityProfile)[];

// ---------------------------------------------------------------------------
// Staff (Spec §6, §7, §8, §9)
// ---------------------------------------------------------------------------

/** Spec §8: the initial HM staff-role vocabulary. Always accompanies (never replaces) an assignment's free-text officialRole. */
export const HM_STAFF_ROLES = [
  "CHAIRPERSON",
  "CLUB_DIRECTOR",
  "SPORTING_DIRECTOR",
  "SENIOR_DIRECTOR",
  "ELITE_DIRECTOR",
  "HEAD_COACH",
  "ASSISTANT_COACH",
  "COACH",
  "GOALKEEPER_COACH",
  "STRENGTH_CONDITIONING_COACH",
  "PHYSIOTHERAPIST",
  "DOCTOR",
  "PERFORMANCE_STAFF",
  "TEAM_MANAGER",
  "TEAM_ADMIN",
  "EQUIPMENT_MANAGER",
  "ANALYST",
  "SCOUT",
  "OTHER",
  "ACTIVE_PLAYER",
] as const;

export type HMStaffRole = (typeof HM_STAFF_ROLES)[number];

/**
 * Spec §9: whether this StaffPerson entity is one individual human or one
 * collective leadership body (e.g. a club's "sportgrupp"/sporting group).
 * A collective group is still exactly ONE StaffPerson/StaffAssignment --
 * it must never be silently split into several independent individual
 * director records the source data never actually named.
 */
export type StaffPersonKind = "INDIVIDUAL" | "COLLECTIVE_GROUP";

export interface StaffPerson {
  id: string;
  personKind?: StaffPersonKind;
  displayName: string;
  nationality?: string;
  dateOfBirth?: string;
  externalCareerNotes?: string[];
  /**
   * Spec §9/§20.4: cross-reference to an existing player identity (e.g. a
   * PlayerMock id from lib/game-data/players.ts) when this staff person
   * is ALSO an active player -- a player/staff hybrid. This never
   * duplicates player data; it only links to it. Absent for staff who
   * are not also players.
   */
  playerId?: string;
}

/**
 * Spec §7: roles belong to ASSIGNMENTS, not to the person directly -- one
 * person may hold multiple StaffAssignment records (different clubs over
 * time, or genuinely simultaneous distinct assignments), and a single
 * assignment may itself carry multiple standardRoles at once.
 */
export interface StaffAssignment {
  personId: string;
  clubId: string;
  /** The free-text role exactly as the source describes it (e.g. "Naprapat") -- always preserved alongside standardRoles, never replaced by it (Spec §8, invariant 2/3). */
  officialRole: string;
  standardRoles: HMStaffRole[];
  validFrom?: string;
  validTo?: string;
  season?: string;
  status: "CONFIRMED" | "PROBABLE" | "HISTORICAL" | "ROLE_NEEDS_CLARIFICATION" | "DUAL_STATUS";
  evidence: EvidenceReference[];
}

// ---------------------------------------------------------------------------
// SquadIdentityContext (Spec §14)
// ---------------------------------------------------------------------------

/** Current-squad claims (depth, age, continuity, ...) -- belongs to the squad, never automatically promoted to permanent club identity. */
export interface SquadIdentityContext {
  clubId: string;
  season: string;
  claims: IdentityClaim[];
}

// ---------------------------------------------------------------------------
// SeasonClubContext (Spec §15)
// ---------------------------------------------------------------------------

/** Temporary, season-scoped conditions that expire or require reassessment -- never long-term club identity (Spec §15, invariant 7). */
export interface SeasonClubContext {
  clubId: string;
  season: string;
  organisationalClaims: IdentityClaim[];
  financialClaims: IdentityClaim[];
  squadClaims: IdentityClaim[];
  competitiveClaims: IdentityClaim[];
  transitionClaims: IdentityClaim[];
}

export const SEASON_CLUB_CONTEXT_CLAIM_FIELDS = [
  "organisationalClaims",
  "financialClaims",
  "squadClaims",
  "competitiveClaims",
  "transitionClaims",
] as const satisfies readonly (keyof SeasonClubContext)[];

// ---------------------------------------------------------------------------
// CurrentTeamIdentity (Spec §16) -- TYPE ONLY, no resolver in this milestone
// ---------------------------------------------------------------------------

/**
 * Derived gameplay-facing state, not directly authored source data (Spec
 * §16). HM-IDENTITY-0.1 defines only the SHAPE this takes; the actual
 * resolver that combines club + coach + squad + season + tactical
 * selections into one is HM-IDENTITY-0.2, explicitly out of scope here.
 *
 * Two hard constraints baked into the shape itself:
 *  - every claim retains provenance (IdentityClaim.sourceRefs is never
 *    empty for a derived TEAM claim -- see validators.ts);
 *  - there is no opaque aggregate "overall identity" field anywhere on
 *    this type. If a future milestone wants a summary number, it is a
 *    new, explicitly-provisional field elsewhere -- never bolted on here.
 */
export interface CurrentTeamIdentity {
  clubId: string;
  season: string;
  /** subjectType is always "TEAM" for every claim in this array (see validators.ts). */
  claims: IdentityClaim[];
  derivedFrom: {
    clubIdentityRef: string;
    coachIdentityRef?: string;
    squadContextRef?: string;
    seasonContextRef?: string;
  };
}
