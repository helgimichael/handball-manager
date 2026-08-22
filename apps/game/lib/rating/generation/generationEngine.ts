// HM-RATINGS-0.4 Part B/C/D/E: the deterministic Player Rating
// GENERATION ENGINE. Transforms a sparse, evidence-backed
// PlayerRatingProfile (lib/rating/types.ts -- "what do we actually
// know?") into a COMPLETE playable attribute profile ("given what we
// know, what is the most coherent playable representation?").
//
// This module NEVER weakens or bypasses HM-RATINGS-0.1/0.2/0.3's
// evidence rules -- it only ever reads an already-validated
// PlayerRatingProfile and layers a game estimate on top. It has zero
// filesystem dependency (pure functions over an in-memory profile), so
// -- like lib/rating/types.ts -- it is safe to import directly into
// client components as well as server routes.
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, type GoalkeeperAttribute, type OutcourtAttribute, type OutcourtPositionId, type PlayerRatingProfile } from "../types";
import { OUTCOURT_ATTRIBUTE_TO_FAMILY } from "../attributeVocabulary";
import { seededOffset } from "./deterministicVariation";
import { baselineFromCA, GOALKEEPER_ARCHETYPE_ATTRIBUTE_ASSOCIATIONS, POSITION_FAMILY_EMPHASIS, ROLE_ATTRIBUTE_ASSOCIATIONS, VARIATION_MAGNITUDE } from "./priors";
import {
  GENERATION_MODEL_VERSION,
  type AttributeOriginCounts,
  type GeneratedAttributeValue,
  type GeneratedGoalkeeperProfile,
  type GeneratedOutcourtProfile,
  type GeneratedPlayerRatingProfile,
  type GenerationResult,
} from "./types";

function clampAttribute(value: number): number {
  return Math.min(ATTRIBUTE_MAX, Math.max(ATTRIBUTE_MIN, Math.round(value)));
}

function newOriginCounts(): AttributeOriginCounts {
  return { EVIDENCE_BACKED: 0, DERIVED: 0, GENERATED_PRIOR: 0 };
}

function generateOutcourtProfile(profile: PlayerRatingProfile, ca: number, modelVersion: string): { branch: GeneratedOutcourtProfile; originCounts: AttributeOriginCounts } {
  const baseline = baselineFromCA(ca);
  const familyEmphasis = POSITION_FAMILY_EMPHASIS[profile.position as OutcourtPositionId] ?? {};
  const knownRoles = [...profile.attackRoleProficiencies, ...profile.defenceRoleProficiencies].map((r) => r.role);
  const known = profile.outcourtAttributes ?? {};

  const attributes = {} as Record<OutcourtAttribute, GeneratedAttributeValue>;
  const originCounts = newOriginCounts();

  for (const attribute of OUTCOURT_ATTRIBUTES) {
    const evidenceValue = known[attribute];
    if (evidenceValue !== undefined) {
      // Evidence-backed values are NEVER overwritten by generation (Part C invariant 1).
      attributes[attribute] = { value: evidenceValue, origin: "EVIDENCE_BACKED" };
      originCounts.EVIDENCE_BACKED++;
      continue;
    }

    const family = OUTCOURT_ATTRIBUTE_TO_FAMILY[attribute];
    let adjusted = baseline + (familyEmphasis[family] ?? 0);

    let roleBoost = 0;
    let isDerived = false;
    for (const role of knownRoles) {
      const boost = ROLE_ATTRIBUTE_ASSOCIATIONS[role]?.[attribute];
      if (boost !== undefined) {
        // Multiple roles can name the same attribute -- take the
        // strongest single association rather than stacking them
        // unboundedly.
        roleBoost = Math.max(roleBoost, boost);
        isDerived = true;
      }
    }
    adjusted += roleBoost;
    adjusted += seededOffset(`${profile.playerId}:${attribute}:${modelVersion}`, VARIATION_MAGNITUDE);

    const origin = isDerived ? "DERIVED" : "GENERATED_PRIOR";
    attributes[attribute] = { value: clampAttribute(adjusted), origin };
    originCounts[origin]++;
  }

  return { branch: { branch: "OUTCOURT", attributes }, originCounts };
}

/** HM-RATINGS-0.6: a claim marking which small GK archetype (lib/rating/gamePrior/archetypeAssignment.ts) a generated goalkeeper was assigned, if any -- absent for evidenced/calibrated goalkeepers. */
function findGkArchetype(profile: PlayerRatingProfile): string | null {
  const claim = profile.claims.find((c) => c.domain === "ARCHETYPE" && c.key === "gkArchetype");
  return claim ? String(claim.value) : null;
}

function generateGoalkeeperProfile(profile: PlayerRatingProfile, ca: number, modelVersion: string): { branch: GeneratedGoalkeeperProfile; originCounts: AttributeOriginCounts } {
  // Part C invariant 3: goalkeepers use their own model -- no attack/
  // defence role associations exist for GK, but HM-RATINGS-0.6 adds a
  // small archetype system (GOALKEEPER_ARCHETYPE_ATTRIBUTE_ASSOCIATIONS)
  // that plays the exact same role AttackRole/DefenceRole play for
  // outcourt players below: elevating a few attributes to DERIVED for a
  // generated (non-evidenced) goalkeeper.
  const baseline = baselineFromCA(ca);
  const known = profile.goalkeeperAttributes ?? {};
  const archetype = findGkArchetype(profile);
  const archetypeAssociations = archetype ? GOALKEEPER_ARCHETYPE_ATTRIBUTE_ASSOCIATIONS[archetype] : undefined;

  const attributes = {} as Record<GoalkeeperAttribute, GeneratedAttributeValue>;
  const originCounts = newOriginCounts();

  for (const attribute of GOALKEEPER_ATTRIBUTES) {
    const evidenceValue = known[attribute];
    if (evidenceValue !== undefined) {
      attributes[attribute] = { value: evidenceValue, origin: "EVIDENCE_BACKED" };
      originCounts.EVIDENCE_BACKED++;
      continue;
    }
    const archetypeBoost = archetypeAssociations?.[attribute] ?? 0;
    const adjusted = baseline + archetypeBoost + seededOffset(`${profile.playerId}:${attribute}:${modelVersion}`, VARIATION_MAGNITUDE);
    const origin = archetypeBoost > 0 ? "DERIVED" : "GENERATED_PRIOR";
    attributes[attribute] = { value: clampAttribute(adjusted), origin };
    originCounts[origin]++;
  }

  return { branch: { branch: "GOALKEEPER", attributes }, originCounts };
}

/**
 * Generate a complete playable attribute profile for `profile`.
 *
 * Deterministic: the same playerId + profile inputs + modelVersion
 * always produce the same output (Part D). Returns an explicit
 * UNAVAILABLE result -- never a silently invented CA -- when the
 * player's CA is not yet resolved (Part E); CA ESTIMATION for those
 * players is out of scope for this engine.
 */
export function generatePlayerRatingProfile(profile: PlayerRatingProfile, modelVersion: string = GENERATION_MODEL_VERSION): GenerationResult {
  if (profile.ca.value === null) {
    return { status: "UNAVAILABLE", reason: "CANNOT_GENERATE_COMPLETE_PROFILE_WITHOUT_CA", playerId: profile.playerId, position: profile.position };
  }
  const ca = profile.ca.value;

  const { branch, originCounts } = profile.position === "GK" ? generateGoalkeeperProfile(profile, ca, modelVersion) : generateOutcourtProfile(profile, ca, modelVersion);

  const generated: GeneratedPlayerRatingProfile = {
    playerId: profile.playerId,
    modelVersion,
    position: profile.position,
    ca,
    branch,
    originCounts,
  };
  return { status: "OK", profile: generated };
}
