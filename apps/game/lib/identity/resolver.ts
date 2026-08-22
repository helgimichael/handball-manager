// HM-IDENTITY-0.2: headless, deterministic, explainable Current Team
// Identity resolver.
// Design source of truth: docs/HANDBALL_MANAGER_CLUB_COACH_TEAM_IDENTITY_DOMAIN_MODEL_v0.1.md §16
//
//   Club Identity + current Coach Identity + Squad Context + Season
//   Context + current tactical selections  →  Current Team Identity
//
// This module is a pure function: no filesystem, no randomness, no
// mutation, and -- deliberately -- no dependency on lib/career or any
// Tactical Domain package, keeping lib/identity a standalone domain
// boundary exactly as HM-IDENTITY-0.1 established. It does not decide
// what game-facing effect (if any) a resolved dimension should have;
// that is HM-IDENTITY-0.3's job, explicitly out of scope here.
//
// Core guarantees:
//  - every resolved TEAM claim always carries `contributingClaims`
//    (the literal, unmodified original claims that produced it) -- the
//    WHY. Each contributing claim's own `subjectType` (CLUB/COACH/
//    SQUAD/SEASON_CONTEXT) is what keeps the four kinds of input
//    distinguishable; the resolver never collapses that distinction.
//  - when two or more contributing claims for the same (domain, key)
//    disagree in value, the resolved claim is marked `conflicting` and
//    its own `value` becomes the literal sentinel "CONFLICTING" --
//    never an average, never an arbitrary pick. Both original claims
//    remain fully visible in `contributingClaims`.
//  - USER_PROJECTION claims are only ever resolved with their own
//    evidenceClass/temporalScope intact (PROJECTED) -- never coerced
//    toward CURRENT. This is enforced by construction (the resolver
//    copies evidenceClass/temporalScope straight from the source claim)
//    and independently re-checked by validateIdentityClaim's own
//    invariant 5 on every resolved claim.
//  - a dimension with genuinely no evidence-backed contributing claim
//    (e.g. the source explicitly says UNKNOWN_NOT_ASSESSED with no
//    citation at all) produces NO resolved claim -- absence is the
//    honest signal here, never a fabricated placeholder. This mirrors
//    validateCurrentTeamIdentity's own "every derived claim retains
//    provenance" rule (HM-IDENTITY-0.1) rather than working around it.
//  - there is no opaque aggregate "overall identity" anywhere on the
//    output type -- only a `claims` list, each independently legible.
import {
  CLUB_IDENTITY_CLAIM_FIELDS,
  COACH_IDENTITY_CLAIM_FIELDS,
  SEASON_CLUB_CONTEXT_CLAIM_FIELDS,
  type ClubIdentityProfile,
  type CoachIdentityProfile,
  type CurrentTeamIdentity,
  type IdentityClaim,
  type SeasonClubContext,
  type SquadIdentityContext,
} from "./types";

/**
 * The 8 dimensions this resolver is specifically asked to surface,
 * "especially" (not exclusively) -- a claim whose own `domain` doesn't
 * match one of these still resolves under its own domain (e.g. a squad
 * claim's "SQUAD_COMPOSITION", a season claim's "COMPETITIVE"). This
 * list exists for documentation/consumer convenience, not as a filter.
 */
export const HIGHLIGHTED_RESOLVED_DIMENSIONS = [
  "ATTACK",
  "DEFENCE",
  "TRANSITION",
  "TACTICAL_FLEXIBILITY",
  "DEVELOPMENT",
  "RECRUITMENT",
  "CULTURE",
  "COACHING_ENVIRONMENT",
] as const;

export type HighlightedResolvedDimension = (typeof HIGHLIGHTED_RESOLVED_DIMENSIONS)[number];

/**
 * The subset of highlighted dimensions a CLUB (or squad/season) claim
 * can genuinely carry -- CoachIdentityProfile's own claims use a
 * different, coach-internal domain vocabulary (Spec §13:
 * TACTICAL_COGNITIVE, LEADERSHIP, CULTURE, DEVELOPMENT,
 * SQUAD_UTILIZATION), only two of which (CULTURE, DEVELOPMENT) happen
 * to share a name with a club-facing dimension.
 */
const CLUB_FACING_DIMENSIONS: ReadonlySet<string> = new Set(["ATTACK", "DEFENCE", "TRANSITION", "TACTICAL_FLEXIBILITY", "DEVELOPMENT", "RECRUITMENT", "CULTURE"]);

/**
 * A coach claim genuinely contributes to (and can conflict with) a
 * club-facing dimension when its own domain already names one (e.g. a
 * coach's tactical preference tagged DEFENCE, or CULTURE/DEVELOPMENT --
 * the two categories Spec §13's coach vocabulary shares with the club
 * vocabulary) -- "current coach influence may modify current team
 * identity" is exactly this case. Everything else about how this coach
 * operates (their cognitive/leadership/squad-utilization traits, which
 * have no club-facing dimension to compare against) is bucketed under
 * the catch-all COACHING_ENVIRONMENT dimension instead of inventing a
 * new top-level dimension per internal coach category.
 */
function effectiveDimension(claim: IdentityClaim): string {
  if (claim.subjectType === "COACH" && !CLUB_FACING_DIMENSIONS.has(claim.domain)) {
    return "COACHING_ENVIRONMENT";
  }
  return claim.domain;
}

/** The sentinel value a resolved claim's `value` takes when its contributing claims disagree -- never a fabricated blend. */
export const CONFLICTING_VALUE_SENTINEL = "CONFLICTING";

export interface ResolvedTeamClaim extends IdentityClaim {
  /**
   * Every original claim (from CLUB/COACH/SQUAD/SEASON_CONTEXT -- each
   * still carrying its own real subjectType) that produced this
   * resolved dimension. Always at least 1 entry -- this is the literal
   * WHY. `sourceRefs` above is the union of these claims' own
   * sourceRefs (evidence-reference ids), never fabricated.
   */
  contributingClaims: IdentityClaim[];
  /** True iff 2+ contributingClaims disagree in value for this (domain, key) -- see CONFLICTING_VALUE_SENTINEL. */
  conflicting: boolean;
}

/**
 * A read-only, structural view of the manager's current tactical
 * selections. Deliberately NOT importing career/teamTacticalProfile.ts's
 * concrete type here (lib/identity has no dependency on lib/career or
 * any Tactical Domain package) -- any object with this shape works,
 * including career.tacticalProfile passed in as-is by a future caller.
 */
export interface CurrentTacticalSelectionView {
  ati001UsageTendency: string;
  h2ResponsePreference: string;
  tacticalFamiliarity: string;
}

export interface ResolvedCurrentTeamIdentity extends CurrentTeamIdentity {
  claims: ResolvedTeamClaim[];
  /**
   * The manager's current tactical selections, exposed as plain live
   * game state -- NOT wrapped as an IdentityClaim (it has no
   * EvidenceReference-backed provenance to cite; it is simply today's
   * setting, not a piece of imported source evidence). `null` when the
   * caller has no current profile to report (e.g. resolving before a
   * career/tactics screen exists).
   */
  currentTacticalSelection: CurrentTacticalSelectionView | null;
}

export interface ResolveCurrentTeamIdentityInputs {
  clubId: string;
  season: string;
  clubIdentity: ClubIdentityProfile | null;
  /** The current head coach's person id, even if `coachIdentity` itself is null (unassessed) -- still recorded in `derivedFrom` for provenance. */
  coachPersonId: string | null;
  coachIdentity: CoachIdentityProfile | null;
  squadContext: SquadIdentityContext | null;
  seasonContext: SeasonClubContext | null;
  tacticalProfile: CurrentTacticalSelectionView | null;
}

function collectClubClaims(profile: ClubIdentityProfile | null): IdentityClaim[] {
  if (!profile) return [];
  return CLUB_IDENTITY_CLAIM_FIELDS.flatMap((field) => profile[field]);
}

function collectCoachClaims(profile: CoachIdentityProfile | null): IdentityClaim[] {
  if (!profile) return [];
  return COACH_IDENTITY_CLAIM_FIELDS.flatMap((field) => profile[field]);
}

function collectSquadClaims(context: SquadIdentityContext | null): IdentityClaim[] {
  if (!context) return [];
  return context.claims;
}

function collectSeasonClaims(context: SeasonClubContext | null): IdentityClaim[] {
  if (!context) return [];
  return SEASON_CLUB_CONTEXT_CLAIM_FIELDS.flatMap((field) => context[field]);
}

/** Only claims with at least one real (non-empty) sourceRef can ever be resolved -- see this module's own doc on why an unresolvable UNKNOWN is an omission, not a placeholder. */
function hasResolvableProvenance(claim: IdentityClaim): boolean {
  return Array.isArray(claim.sourceRefs) && claim.sourceRefs.length > 0;
}

/**
 * Pure, deterministic resolution. Same inputs always produce a
 * byte-identical output (plain object construction/grouping only -- no
 * randomness, no wall-clock reads, no I/O).
 */
export function resolveCurrentTeamIdentity(inputs: ResolveCurrentTeamIdentityInputs): ResolvedCurrentTeamIdentity {
  const allSourceClaims = [
    ...collectClubClaims(inputs.clubIdentity),
    ...collectCoachClaims(inputs.coachIdentity),
    ...collectSquadClaims(inputs.squadContext),
    ...collectSeasonClaims(inputs.seasonContext),
  ].filter(hasResolvableProvenance);

  // Group by (domain, key) -- this is the ONLY grouping key. Two claims
  // with the same domain+key but different subjectType (e.g. a club
  // tacticalHeritage claim and a coach tacticalPreference claim that
  // happen to share domain/key) are treated as contributions to the
  // SAME resolved dimension, exactly as the model diagram intends.
  const groups = new Map<string, IdentityClaim[]>();
  for (const claim of allSourceClaims) {
    const groupKey = `${effectiveDimension(claim)}::${claim.key}`;
    const bucket = groups.get(groupKey);
    if (bucket) bucket.push(claim);
    else groups.set(groupKey, [claim]);
  }

  const resolvedClaims: ResolvedTeamClaim[] = [];
  // Map iteration order is insertion order, which is itself fully
  // determined by allSourceClaims's own deterministic order (club field
  // order, then coach field order, then squad, then season -- all fixed
  // array literals) -- so output order is stable for identical inputs.
  for (const [groupKey, contributingClaims] of groups) {
    const distinctValues = new Set(contributingClaims.map((c) => String(c.value)));
    const conflicting = distinctValues.size > 1;
    const dominant = contributingClaims[0];
    const sourceRefs = [...new Set(contributingClaims.flatMap((c) => c.sourceRefs))];

    resolvedClaims.push({
      id: `team-${inputs.clubId}-${groupKey.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      subjectType: "TEAM",
      subjectId: inputs.clubId,
      domain: effectiveDimension(dominant),
      key: dominant.key,
      value: conflicting ? CONFLICTING_VALUE_SENTINEL : dominant.value,
      // A conflicting dimension has no single evidence class/temporal
      // scope that honestly describes it -- surfaced via contributingClaims instead.
      evidenceClass: conflicting ? "INFERENCE" : dominant.evidenceClass,
      temporalScope: conflicting ? "CURRENT" : dominant.temporalScope,
      season: dominant.season,
      sourceRefs,
      notes: conflicting
        ? `Conflicting inputs for ${dominant.domain}/${dominant.key} -- see contributingClaims for each source's own value, never averaged.`
        : dominant.notes,
      contributingClaims,
      conflicting,
    });
  }

  return {
    clubId: inputs.clubId,
    season: inputs.season,
    claims: resolvedClaims,
    derivedFrom: {
      clubIdentityRef: inputs.clubId,
      coachIdentityRef: inputs.coachPersonId ?? undefined,
      squadContextRef: inputs.squadContext ? `${inputs.clubId}:${inputs.season}` : undefined,
      seasonContextRef: inputs.seasonContext ? `${inputs.clubId}:${inputs.season}` : undefined,
    },
    currentTacticalSelection: inputs.tacticalProfile,
  };
}
