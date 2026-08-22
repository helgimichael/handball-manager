// HM-RATINGS-0.5 Part C: the CA ESTIMATION layer's own types.
// Deliberately separate from HM-RATINGS-0.4's generation layer (Part C:
// "Do NOT merge it into HM-RATINGS-0.4's attribute generator"). This
// module answers one question only -- "given this player's evidence,
// what CA is defensible?" -- and produces a CAProposal, never an
// attribute value. The flow is:
//
//   Player CA Evidence -> CA Estimator -> CA Proposal -> HM-RATINGS-0.4 Generator
import type { AbilityConfidence, PlausibleRange, PlayerRatingClaim } from "../types";

/** Bump on any change to the scoring/interpolation algorithm below -- same playerId + evidence + model version must always produce the same proposal (Part H). */
export const CA_ESTIMATION_MODEL_VERSION = "HM-RATINGS-0.5-v1";

export type CAEstimationStatus = "ESTIMATED" | "UNRESOLVED";

/**
 * A CA proposal is more than a number (Part C). `status: "UNRESOLVED"`
 * is the honest, expected outcome for a player with no CA-relevant
 * evidence -- `value` is always `null` in that case, never a
 * silently-invented number (Rating Model §2).
 */
export interface CAProposal {
  playerId: string;
  status: CAEstimationStatus;
  value: number | null;
  confidence: AbilityConfidence;
  plausibleRange: PlausibleRange;
  /** The evidence-strength score this proposal was derived from -- see signalScoring.ts. Purely diagnostic/auditable, not itself a CA-scale number. */
  evidenceScore: number;
  /** Exactly the claims that contributed non-zero evidence weight -- a subset of the player's full claims list, so a reviewer can see WHY without re-deriving the score. */
  contributingClaims: PlayerRatingClaim[];
  /** Human-readable (English, internal/audit-facing -- not player-facing UI text) explanation of how the proposal was derived, including which calibration anchors it was interpolated between. */
  rationale: string;
  modelVersion: string;
}
