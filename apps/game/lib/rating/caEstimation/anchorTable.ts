// HM-RATINGS-0.5 Part E: calibration anchors. The estimator reasons
// RELATIVE TO the already-calibrated HM-RATINGS-0.2 players, never an
// independently-invented scale -- built by scoring each resolved-CA
// calibration player's OWN real claims with the exact same
// scoreClaimsForCA() function a new player's evidence goes through, so
// a new player's score is directly comparable.
//
// Deliberately excludes the 2 calibration players with unresolved CA
// (Malte Haglund, Robin Järling) -- they have no (score, CA) pair to
// contribute as an anchor.
import { SWEDEN_CALIBRATION_V2_PROFILES } from "../swedenCalibrationV2";
import { scoreClaimsForCA } from "./signalScoring";

export interface CAScoreAnchor {
  playerId: string;
  score: number;
  ca: number;
}

function buildRawAnchors(): CAScoreAnchor[] {
  const anchors: CAScoreAnchor[] = [];
  for (const profile of SWEDEN_CALIBRATION_V2_PROFILES) {
    if (profile.ca.value === null) continue;
    const { totalScore } = scoreClaimsForCA(profile.claims);
    anchors.push({ playerId: profile.playerId, score: totalScore, ca: profile.ca.value });
  }
  return anchors.sort((a, b) => a.score - b.score);
}

/**
 * The 10 resolved-CA calibration players' real CA values are NOT a
 * clean function of this milestone's evidence-scoring heuristic --
 * real hand calibration legitimately weighs context this keyword-level
 * scorer can't fully see (e.g. promoted-club/production context), so
 * two anchors can score similarly (or even identically) despite quite
 * different CA. Interpolating across a non-monotonic score->CA curve
 * would let a NEW player's stronger evidence produce a LOWER estimate
 * than a weaker player's -- exactly the ordering violation Part O's
 * relative-order tests forbid. This filter keeps every anchor whose CA
 * is >= the previous KEPT anchor's CA (in ascending score order),
 * dropping the ones that would invert that order -- the dropped
 * anchors' real calibrated CA is completely untouched anywhere else in
 * the codebase; they are simply excluded from THIS interpolation curve
 * so new-player estimates stay evidence-strength-ordered.
 */
function enforceMonotonicCA(anchors: readonly CAScoreAnchor[]): CAScoreAnchor[] {
  const kept: CAScoreAnchor[] = [];
  for (const anchor of anchors) {
    if (kept.length === 0 || anchor.ca >= kept[kept.length - 1].ca) kept.push(anchor);
  }
  return kept;
}

/** Sorted ascending by score, with non-monotonic CA inversions filtered out (see enforceMonotonicCA). Computed once at module load -- pure function of the (already fixed) calibration set, so this is deterministic and identical across every call/process. */
export const CA_SCORE_ANCHORS: readonly CAScoreAnchor[] = enforceMonotonicCA(buildRawAnchors());
