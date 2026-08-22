// HM-RATINGS-0.1: validators + constructor helpers for the Player Rating
// domain foundation. Every function here is a pure, framework-free
// predicate/check -- no throwing, no side effects, no network/filesystem
// access, no CA/PA computation. Mirrors lib/identity/validators.ts's
// own {ok:true} | {ok:false, errors} convention.
import {
  ATTACK_ROLES,
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  CA_MAX,
  CA_MIN,
  DEFENCE_ROLES,
  GOALKEEPER_ATTRIBUTES,
  OUTCOURT_ATTRIBUTES,
  PA_MAX,
  PA_MIN,
  PA_PRIOR_BANDS,
  RATING_EVIDENCE_CLASSES,
  type AbilityConfidence,
  type AbilityRating,
  type PlausibleRange,
  type PlayerRatingClaim,
  type PlayerRatingProfile,
  type RatingEvidenceClass,
  type RoleProficiency,
} from "./types";

export type RatingValidationResult = { ok: true } | { ok: false; errors: string[] };

function ok(): RatingValidationResult {
  return { ok: true };
}

function fail(errors: string[]): RatingValidationResult {
  return { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Attribute values (1-20)
// ---------------------------------------------------------------------------

export function validateAttributeValue(value: number): RatingValidationResult {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fail([`attribute value ${String(value)} is not a number.`]);
  }
  if (value < ATTRIBUTE_MIN || value > ATTRIBUTE_MAX) {
    return fail([`attribute value ${value} is outside the fixed ${ATTRIBUTE_MIN}-${ATTRIBUTE_MAX} scale.`]);
  }
  return ok();
}

export function validateOutcourtAttributes(attributes: Partial<Record<string, number>>): RatingValidationResult {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (!(OUTCOURT_ATTRIBUTES as readonly string[]).includes(key)) {
      errors.push(`"${key}" is not a recognized outcourt attribute.`);
      continue;
    }
    if (value === undefined) continue;
    const result = validateAttributeValue(value);
    if (!result.ok) errors.push(...result.errors.map((e) => `outcourtAttributes.${key}: ${e}`));
  }
  return errors.length === 0 ? ok() : fail(errors);
}

export function validateGoalkeeperAttributes(attributes: Partial<Record<string, number>>): RatingValidationResult {
  const errors: string[] = [];
  for (const [key, value] of Object.entries(attributes)) {
    if (!(GOALKEEPER_ATTRIBUTES as readonly string[]).includes(key)) {
      errors.push(`"${key}" is not a recognized goalkeeper attribute.`);
      continue;
    }
    if (value === undefined) continue;
    const result = validateAttributeValue(value);
    if (!result.ok) errors.push(...result.errors.map((e) => `goalkeeperAttributes.${key}: ${e}`));
  }
  return errors.length === 0 ? ok() : fail(errors);
}

// ---------------------------------------------------------------------------
// AbilityRating (CA/PA): confidence + plausible range are first-class.
// ---------------------------------------------------------------------------

/**
 * PROVISIONAL, isolated constant (Rating Model §2: "Thin evidence should
 * widen uncertainty"). A LOW-confidence rating must span at least this
 * many points of the 1-200 scale -- prevents a thin-evidence player from
 * quietly carrying a narrow, falsely precise range. The exact width is
 * an implementation parameter, not a claim from the source documents.
 */
export const MIN_LOW_CONFIDENCE_RANGE_WIDTH = 40;

export function validatePlausibleRange(range: PlausibleRange, scaleMin: number, scaleMax: number): RatingValidationResult {
  const errors: string[] = [];
  if (range.min < scaleMin || range.min > scaleMax) errors.push(`plausibleRange.min ${range.min} is outside ${scaleMin}-${scaleMax}.`);
  if (range.max < scaleMin || range.max > scaleMax) errors.push(`plausibleRange.max ${range.max} is outside ${scaleMin}-${scaleMax}.`);
  if (range.min > range.max) errors.push(`plausibleRange.min ${range.min} is greater than plausibleRange.max ${range.max}.`);
  return errors.length === 0 ? ok() : fail(errors);
}

export function validateAbilityRating(rating: AbilityRating, scaleMin: number, scaleMax: number): RatingValidationResult {
  const errors: string[] = [];

  const rangeResult = validatePlausibleRange(rating.plausibleRange, scaleMin, scaleMax);
  if (!rangeResult.ok) errors.push(...rangeResult.errors);

  if (rating.value !== null) {
    if (rating.value < scaleMin || rating.value > scaleMax) {
      errors.push(`AbilityRating.value ${rating.value} is outside ${scaleMin}-${scaleMax}.`);
    }
    if (rangeResult.ok && (rating.value < rating.plausibleRange.min || rating.value > rating.plausibleRange.max)) {
      errors.push(`AbilityRating.value ${rating.value} falls outside its own plausibleRange [${rating.plausibleRange.min}, ${rating.plausibleRange.max}].`);
    }
  }

  // "Unknown players must not all become average" (Rating Model §2):
  // thin (LOW-confidence) evidence must widen the range, never narrow it
  // to a falsely precise point around a default.
  if (rating.confidence === "LOW" && rangeResult.ok) {
    const width = rating.plausibleRange.max - rating.plausibleRange.min;
    if (width < MIN_LOW_CONFIDENCE_RANGE_WIDTH) {
      errors.push(`LOW-confidence AbilityRating has plausibleRange width ${width}, expected at least ${MIN_LOW_CONFIDENCE_RANGE_WIDTH} -- thin evidence must widen uncertainty, not narrow it.`);
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}

/**
 * The honest "no confident estimate yet" default (Rating Model §2:
 * "Unknown players must not all become average. Thin evidence should
 * widen uncertainty rather than force mediocrity."). Full-scale range,
 * LOW confidence, no point value -- never a mid-scale "average" number.
 */
export function unassessedAbilityRating(scaleMin: number, scaleMax: number): AbilityRating {
  return { value: null, confidence: "LOW", plausibleRange: { min: scaleMin, max: scaleMax } };
}

/**
 * Seeds a PA plausibleRange from a qualitative potential anchor (Rating
 * Model §13's PA priors table) -- a RANGE, never a point value, so this
 * is explicitly NOT "assigning a final numeric PA" to anyone. Returns
 * `unassessedAbilityRating` for any anchor not in PA_PRIOR_BANDS (never
 * silently narrows for an unrecognized anchor).
 *
 * Defaults to MEDIUM confidence, not LOW: a stated qualitative anchor is
 * real (if imprecise) evidence -- more informative than the zero-evidence
 * case `unassessedAbilityRating` represents -- so it is not held to the
 * LOW-confidence minimum-width rule (the prior bands themselves are
 * narrower than that floor by design).
 */
export function paRatingFromPotentialAnchor(anchor: string, confidence: AbilityConfidence = "MEDIUM"): AbilityRating {
  const band = PA_PRIOR_BANDS[anchor];
  if (!band) return unassessedAbilityRating(PA_MIN, PA_MAX);
  return { value: null, confidence, plausibleRange: { ...band } };
}

/**
 * HM-RATINGS-0.2 MODEL ADDITION: merges two or more qualitative
 * potential-anchor bands into one wider plausibleRange -- span [min of
 * all mins, max of all maxes], never an average. Real calibration
 * exposed a case this single-anchor helper could not honestly
 * represent: a player whose expert assessment explicitly straddles two
 * adjacent bands (e.g. "future ceiling VERY_HIGH_TO_EXTREME", not
 * cleanly one or the other). Forcing a choice between the two named
 * bands would discard real information from the source evidence; a
 * single average would fabricate false precision. Falls back to
 * `unassessedAbilityRating` only if NONE of the given anchors are
 * recognized.
 */
export function paRatingFromPotentialAnchors(anchors: string[], confidence: AbilityConfidence = "MEDIUM"): AbilityRating {
  const bands = anchors.map((a) => PA_PRIOR_BANDS[a]).filter((b): b is PlausibleRange => b !== undefined);
  if (bands.length === 0) return unassessedAbilityRating(PA_MIN, PA_MAX);
  const min = Math.min(...bands.map((b) => b.min));
  const max = Math.max(...bands.map((b) => b.max));
  return { value: null, confidence, plausibleRange: { min, max } };
}

// ---------------------------------------------------------------------------
// Role proficiency: an AttackRole must never appear in the defence list
// and vice versa (attack position/role and defensive position/role are
// separate -- Rating Model §8).
// ---------------------------------------------------------------------------

export function validateAttackRoleProficiencies(proficiencies: RoleProficiency[]): RatingValidationResult {
  const errors: string[] = [];
  for (const p of proficiencies) {
    if (!(ATTACK_ROLES as readonly string[]).includes(p.role)) {
      errors.push(`"${p.role}" is not a recognized AttackRole -- it must not appear in attackRoleProficiencies.`);
    }
  }
  return errors.length === 0 ? ok() : fail(errors);
}

export function validateDefenceRoleProficiencies(proficiencies: RoleProficiency[]): RatingValidationResult {
  const errors: string[] = [];
  for (const p of proficiencies) {
    if (!(DEFENCE_ROLES as readonly string[]).includes(p.role)) {
      errors.push(`"${p.role}" is not a recognized DefenceRole -- it must not appear in defenceRoleProficiencies.`);
    }
  }
  return errors.length === 0 ? ok() : fail(errors);
}

// ---------------------------------------------------------------------------
// PlayerRatingClaim
// ---------------------------------------------------------------------------

export function validatePlayerRatingClaim(claim: PlayerRatingClaim): RatingValidationResult {
  const errors: string[] = [];

  if (!claim.id || claim.id.trim().length === 0) {
    errors.push("PlayerRatingClaim.id must be a non-empty string.");
  }
  if (!claim.playerId || claim.playerId.trim().length === 0) {
    errors.push("PlayerRatingClaim.playerId must be a non-empty string.");
  }
  if (!(RATING_EVIDENCE_CLASSES as readonly string[]).includes(claim.evidenceClass)) {
    errors.push(`PlayerRatingClaim.evidenceClass "${claim.evidenceClass}" is not a recognized RatingEvidenceClass.`);
  }
  if (claim.value === undefined || claim.value === null) {
    errors.push("PlayerRatingClaim.value must be present -- use evidenceClass UNASSESSED with an explicit value rather than omitting value.");
  }
  if (!Array.isArray(claim.sourceRefs)) {
    errors.push("PlayerRatingClaim.sourceRefs must be an array (may be empty only for UNASSESSED claims).");
  } else if (claim.sourceRefs.length === 0 && claim.evidenceClass !== "UNASSESSED") {
    errors.push(`PlayerRatingClaim "${claim.id}" has no sourceRefs but evidenceClass is "${claim.evidenceClass}" -- every non-UNASSESSED claim must cite at least one source.`);
  }

  // PROJECTION_EXPECTATION must never masquerade as verified fact (Rating Model §3).
  if (claim.evidenceClass === "PROJECTION_EXPECTATION" && claim.confidence === "CONFIRMED") {
    errors.push(`PlayerRatingClaim "${claim.id}" has evidenceClass PROJECTION_EXPECTATION but confidence "CONFIRMED" -- a projection/expectation must never be marked as confirmed fact.`);
  }

  return errors.length === 0 ? ok() : fail(errors);
}

export function isVerifiedCareerEvidence(claim: PlayerRatingClaim): boolean {
  return claim.evidenceClass === "VERIFIED_CAREER_SIGNAL";
}

export function isUserAnchorEvidence(claim: PlayerRatingClaim): boolean {
  return claim.evidenceClass === "USER_EXPERT_PLAYER_ANCHOR";
}

export function isInjuryAvailabilityEvidence(claim: PlayerRatingClaim): boolean {
  return claim.evidenceClass === "INJURY_AVAILABILITY";
}

export function isProjectionEvidence(claim: PlayerRatingClaim): boolean {
  return claim.evidenceClass === "PROJECTION_EXPECTATION";
}

export function selectClaimsByEvidenceClass(claims: PlayerRatingClaim[], evidenceClass: RatingEvidenceClass): PlayerRatingClaim[] {
  return claims.filter((c) => c.evidenceClass === evidenceClass);
}

// ---------------------------------------------------------------------------
// PlayerRatingProfile
// ---------------------------------------------------------------------------

export function validatePlayerRatingProfile(profile: PlayerRatingProfile): RatingValidationResult {
  const errors: string[] = [];

  // Goalkeeper/outcourt branches stay separate: exactly one of the two attribute branches, matching position.
  const hasOutcourt = profile.outcourtAttributes !== undefined;
  const hasGoalkeeper = profile.goalkeeperAttributes !== undefined;
  if (hasOutcourt && hasGoalkeeper) {
    errors.push("PlayerRatingProfile must not carry both outcourtAttributes and goalkeeperAttributes -- the two branches are mutually exclusive.");
  }
  if (profile.position === "GK" && hasOutcourt) {
    errors.push('PlayerRatingProfile.position is "GK" but outcourtAttributes is present -- a goalkeeper must use goalkeeperAttributes.');
  }
  if (profile.position !== "GK" && hasGoalkeeper) {
    errors.push(`PlayerRatingProfile.position is "${profile.position}" but goalkeeperAttributes is present -- only a "GK" may use the goalkeeper branch.`);
  }

  if (hasOutcourt) {
    const result = validateOutcourtAttributes(profile.outcourtAttributes!);
    if (!result.ok) errors.push(...result.errors);
  }
  if (hasGoalkeeper) {
    const result = validateGoalkeeperAttributes(profile.goalkeeperAttributes!);
    if (!result.ok) errors.push(...result.errors);
  }

  const attackResult = validateAttackRoleProficiencies(profile.attackRoleProficiencies);
  if (!attackResult.ok) errors.push(...attackResult.errors);
  const defenceResult = validateDefenceRoleProficiencies(profile.defenceRoleProficiencies);
  if (!defenceResult.ok) errors.push(...defenceResult.errors);

  const caResult = validateAbilityRating(profile.ca, CA_MIN, CA_MAX);
  if (!caResult.ok) errors.push(...caResult.errors.map((e) => `ca: ${e}`));
  const paResult = validateAbilityRating(profile.pa, PA_MIN, PA_MAX);
  if (!paResult.ok) errors.push(...paResult.errors.map((e) => `pa: ${e}`));

  // PA is a theoretical ceiling (Rating Model §13): when both are known, PA must never sit below current CA.
  if (profile.ca.value !== null && profile.pa.value !== null && profile.pa.value < profile.ca.value) {
    errors.push(`pa.value ${profile.pa.value} is below ca.value ${profile.ca.value} -- PA is a ceiling on current ability and must never sit below it.`);
  }

  for (const claim of profile.claims) {
    if (claim.playerId !== profile.playerId) {
      errors.push(`PlayerRatingClaim "${claim.id}" has playerId "${claim.playerId}", expected "${profile.playerId}" for this profile.`);
      continue;
    }
    const claimResult = validatePlayerRatingClaim(claim);
    if (!claimResult.ok) errors.push(...claimResult.errors);
  }

  return errors.length === 0 ? ok() : fail(errors);
}
