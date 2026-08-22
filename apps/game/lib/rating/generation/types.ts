// HM-RATINGS-0.4 Part B/C/D: the Player Rating GENERATION layer's own
// types. Deliberately separate from lib/rating/types.ts (the SOURCE/
// EVIDENCE layer's shape) -- a GeneratedPlayerRatingProfile is a GAME
// ESTIMATE built on top of a PlayerRatingProfile, never a replacement
// for it. Nothing here is persisted as final player data yet (Part G).
import type { GoalkeeperAttribute, OutcourtAttribute, Position } from "../types";

/** Bump when the generation algorithm changes -- see deterministicVariation.ts: same playerId + inputs + version must always produce the same output, and a version bump is the only sanctioned way to intentionally change past output. */
export const GENERATION_MODEL_VERSION = "HM-RATINGS-0.4-v1";

/**
 * Provenance of one generated attribute value (Part B). Never call
 * GENERATED_PRIOR "verified" or "known" anywhere in UI text -- it is a
 * required game estimate standing in for absent player-specific
 * evidence, not a researched fact.
 *
 *  - EVIDENCE_BACKED: copied byte-for-byte from the evidence-backed
 *    rating proposal (lib/rating/types.ts PlayerRatingProfile). Never
 *    overwritten by generation.
 *  - DERIVED: not directly evidenced, but strongly implied by a known,
 *    evidence-backed attack/defence role (see priors.ts
 *    ROLE_ATTRIBUTE_ASSOCIATIONS).
 *  - GENERATED_PRIOR: no direct evidence or role association -- a CA +
 *    position + bounded deterministic-variation estimate, required so
 *    the game has a complete playable profile.
 *  - EDITOR_OVERRIDE (HM-RATINGS-0.5 Part J): a human reviewer manually
 *    chose this value in the Editor, overriding whatever this engine
 *    would otherwise have produced. Never applied by this module itself
 *    -- only ever set by the Editor's override/lock workflow after
 *    generation has already run.
 */
export type AttributeOrigin = "EVIDENCE_BACKED" | "DERIVED" | "GENERATED_PRIOR" | "EDITOR_OVERRIDE";

export interface GeneratedAttributeValue {
  /** 1-20, same scale as PlayerRatingProfile's known attributes. */
  value: number;
  origin: AttributeOrigin;
}

export interface GeneratedOutcourtProfile {
  branch: "OUTCOURT";
  /** Always the COMPLETE 56-key outcourt vocabulary -- never partial. */
  attributes: Record<OutcourtAttribute, GeneratedAttributeValue>;
}

export interface GeneratedGoalkeeperProfile {
  branch: "GOALKEEPER";
  /** Always the COMPLETE 21-key goalkeeper vocabulary -- never partial, and never mixed with outcourt attributes. */
  attributes: Record<GoalkeeperAttribute, GeneratedAttributeValue>;
}

export interface AttributeOriginCounts {
  EVIDENCE_BACKED: number;
  DERIVED: number;
  GENERATED_PRIOR: number;
}

export interface GeneratedPlayerRatingProfile {
  playerId: string;
  modelVersion: string;
  position: Position;
  /** The CA value generation was anchored to (Part C) -- always a resolved number here; see GenerationFailure for the unresolved-CA case (Part E). */
  ca: number;
  branch: GeneratedOutcourtProfile | GeneratedGoalkeeperProfile;
  originCounts: AttributeOriginCounts;
}

/**
 * Part E: CA ESTIMATION is explicitly out of scope for this engine --
 * generation only shapes attributes GIVEN an already-resolved CA. A
 * player with unresolved CA gets this explicit, honest failure, never a
 * silently invented CA.
 */
export type GenerationFailureReason = "CANNOT_GENERATE_COMPLETE_PROFILE_WITHOUT_CA";

export interface GenerationFailure {
  status: "UNAVAILABLE";
  reason: GenerationFailureReason;
  playerId: string;
  position: Position;
}

export interface GenerationSuccess {
  status: "OK";
  profile: GeneratedPlayerRatingProfile;
}

export type GenerationResult = GenerationSuccess | GenerationFailure;
