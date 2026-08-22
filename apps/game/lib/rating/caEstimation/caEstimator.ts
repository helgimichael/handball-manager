// HM-RATINGS-0.5 Part C/E/G/H: the CA ESTIMATOR. Pure, deterministic,
// fs-free (safe to import client-side, like the rest of lib/rating).
//
// A player's evidence score (signalScoring.ts) is interpolated against
// CA_SCORE_ANCHORS (anchorTable.ts) -- real calibrated players scored
// with the identical function -- rather than mapped through any fixed
// "evidence -> CA" formula (Part D: no "senior international = CA 165"
// lookup rule). A player with a score between two anchors gets a CA
// between their CA values, weighted by how close the score sits to
// each; a player whose score falls outside the anchor range is
// extrapolated but clamped to the CA scale, with a widened range to
// reflect the extra uncertainty of extrapolating past real anchors.
//
// A player with ZERO qualifying evidence is UNRESOLVED -- this
// estimator never invents a CA for "no evidence" (Rating Model §2).
import { CA_MAX, CA_MIN, type AbilityConfidence, type PlausibleRange, type PlayerRatingClaim } from "../types";
import { MIN_LOW_CONFIDENCE_RANGE_WIDTH } from "../validators";
import { CA_SCORE_ANCHORS, type CAScoreAnchor } from "./anchorTable";
import { scoreClaimsForCA } from "./signalScoring";
import { CA_ESTIMATION_MODEL_VERSION, type CAProposal } from "./types";

function clampCA(value: number): number {
  return Math.min(CA_MAX, Math.max(CA_MIN, Math.round(value)));
}

/** Linear interpolation between the two anchors bracketing `score`, or a clamped extrapolation from the nearest edge anchor when `score` falls outside the anchor range entirely. */
function interpolateCA(score: number, anchors: readonly CAScoreAnchor[]): { ca: number; extrapolated: boolean; lowerAnchor: CAScoreAnchor; upperAnchor: CAScoreAnchor } {
  const first = anchors[0];
  const last = anchors[anchors.length - 1];

  if (score <= first.score) return { ca: first.ca, extrapolated: score < first.score, lowerAnchor: first, upperAnchor: first };
  if (score >= last.score) return { ca: last.ca, extrapolated: score > last.score, lowerAnchor: last, upperAnchor: last };

  for (let i = 0; i < anchors.length - 1; i++) {
    const lower = anchors[i];
    const upper = anchors[i + 1];
    if (score >= lower.score && score <= upper.score) {
      const span = upper.score - lower.score;
      const t = span === 0 ? 0 : (score - lower.score) / span;
      return { ca: lower.ca + t * (upper.ca - lower.ca), extrapolated: false, lowerAnchor: lower, upperAnchor: upper };
    }
  }
  // Unreachable given the bounds checks above, but keeps the function total.
  return { ca: first.ca, extrapolated: true, lowerAnchor: first, upperAnchor: last };
}

/**
 * Confidence + range width follow the SAME shape validators.ts already
 * enforces for hand-calibrated profiles (LOW confidence needs a range
 * >= MIN_LOW_CONFIDENCE_RANGE_WIDTH) -- an estimated proposal is never
 * narrower than the honesty floor a manual calibration would need.
 */
function confidenceFor(anchorCount: number, careerSignalCount: number, extrapolated: boolean): AbilityConfidence {
  if (extrapolated) return "LOW";
  if (anchorCount >= 1 && careerSignalCount >= 1) return "HIGH";
  if (anchorCount >= 1 || careerSignalCount >= 2) return "MEDIUM";
  return "LOW";
}

function rangeFor(confidence: AbilityConfidence, ca: number): PlausibleRange {
  const halfWidth = confidence === "HIGH" ? 8 : confidence === "MEDIUM" ? 15 : Math.ceil(MIN_LOW_CONFIDENCE_RANGE_WIDTH / 2) + 5;
  return { min: clampCA(ca - halfWidth), max: clampCA(ca + halfWidth) };
}

/**
 * Estimates CA for one player from their (already-collected) evidence
 * claims. Deterministic: depends only on `playerId` + `claims` +
 * `modelVersion` -- no randomness, no wall-clock reads (Part H).
 */
export function estimateCA(playerId: string, claims: readonly PlayerRatingClaim[], modelVersion: string = CA_ESTIMATION_MODEL_VERSION): CAProposal {
  const { totalScore, contributingClaims, anchorClaimCount, careerSignalClaimCount } = scoreClaimsForCA(claims);

  if (contributingClaims.length === 0 || totalScore <= 0) {
    return {
      playerId,
      status: "UNRESOLVED",
      value: null,
      confidence: "LOW",
      plausibleRange: { min: CA_MIN, max: CA_MAX },
      evidenceScore: totalScore,
      contributingClaims: [],
      rationale: "No CA-relevant evidence (verified career signal or expert player anchor) found beyond structural roster claims -- CA remains unresolved rather than defaulted to an average.",
      modelVersion,
    };
  }

  if (CA_SCORE_ANCHORS.length === 0) {
    // Structurally impossible given the fixed calibration set, but keeps this function honest rather than throwing.
    return {
      playerId,
      status: "UNRESOLVED",
      value: null,
      confidence: "LOW",
      plausibleRange: { min: CA_MIN, max: CA_MAX },
      evidenceScore: totalScore,
      contributingClaims,
      rationale: "No calibration anchors available to interpolate against.",
      modelVersion,
    };
  }

  const { ca, extrapolated, lowerAnchor, upperAnchor } = interpolateCA(totalScore, CA_SCORE_ANCHORS);
  const clamped = clampCA(ca);
  const confidence = confidenceFor(anchorClaimCount, careerSignalClaimCount, extrapolated);
  const plausibleRange = rangeFor(confidence, clamped);

  const rationale = extrapolated
    ? `Evidence score ${totalScore.toFixed(1)} falls outside the calibrated anchor range [${CA_SCORE_ANCHORS[0].score.toFixed(1)}, ${CA_SCORE_ANCHORS[CA_SCORE_ANCHORS.length - 1].score.toFixed(1)}] -- extrapolated from the nearest anchor (${lowerAnchor.playerId}, CA ${lowerAnchor.ca}) with a widened LOW-confidence range rather than a confident point estimate.`
    : lowerAnchor.playerId === upperAnchor.playerId
      ? `Evidence score ${totalScore.toFixed(1)} matches calibration anchor ${lowerAnchor.playerId} (CA ${lowerAnchor.ca}) exactly.`
      : `Evidence score ${totalScore.toFixed(1)} interpolated between calibration anchors ${lowerAnchor.playerId} (score ${lowerAnchor.score.toFixed(1)}, CA ${lowerAnchor.ca}) and ${upperAnchor.playerId} (score ${upperAnchor.score.toFixed(1)}, CA ${upperAnchor.ca}).`;

  return {
    playerId,
    status: "ESTIMATED",
    value: clamped,
    confidence,
    plausibleRange,
    evidenceScore: totalScore,
    contributingClaims,
    rationale,
    modelVersion,
  };
}
