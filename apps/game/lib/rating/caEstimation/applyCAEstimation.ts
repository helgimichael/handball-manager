// HM-RATINGS-0.5 Part C/I: the orchestration step that composes
// HM-RATINGS-0.3's evidence-backed proposal with this milestone's CA
// estimator, WITHOUT modifying proposalEngine.ts itself (HM-RATINGS-0.1
// through 0.4 stay untouched and independently green). This is exactly
// the "Player CA Evidence -> CA Estimator -> CA Proposal ->
// HM-RATINGS-0.4 Generator" pipeline Part C describes, expressed as a
// pure function over an already-proposed profile.
import { unassessedAbilityRating } from "../validators";
import { PA_MAX, PA_MIN, type PlayerRatingClaim, type PlayerRatingProfile } from "../types";
import { matchExtendedEvidence } from "./extendedPlayerEvidence";
import { estimateCA } from "./caEstimator";
import type { CAProposal } from "./types";

export interface CAEstimationOutcome {
  /** The profile to hand to HM-RATINGS-0.4's generator: unchanged for a calibrated player; CA replaced with the estimator's value for a newly-ESTIMATED player; unchanged (still unassessed) for an UNRESOLVED player. */
  profile: PlayerRatingProfile;
  /** `null` for an already-calibrated player -- no estimation was needed or attempted, so there is nothing to show as "this milestone's proposal". */
  caProposal: CAProposal | null;
  extendedEvidenceClaims: PlayerRatingClaim[];
}

/**
 * `matchedCalibration` players are returned completely untouched --
 * HM-RATINGS-0.2's hand calibration always wins over estimation, and
 * this function never second-guesses it.
 */
export function applyCAEstimation(profile: PlayerRatingProfile, fullName: string, matchedCalibration: boolean): CAEstimationOutcome {
  if (matchedCalibration) {
    return { profile, caProposal: null, extendedEvidenceClaims: [] };
  }

  const extendedEvidenceClaims = matchExtendedEvidence(fullName, profile.playerId);
  const claimsForEstimation = [...profile.claims, ...extendedEvidenceClaims];
  const caProposal = estimateCA(profile.playerId, claimsForEstimation);

  if (caProposal.status !== "ESTIMATED" || caProposal.value === null) {
    // Still unresolved -- profile keeps its existing (unassessed) CA,
    // but the extended evidence claims (if any) are still worth
    // surfacing for audit even though they weren't enough to estimate.
    return {
      profile: extendedEvidenceClaims.length > 0 ? { ...profile, claims: claimsForEstimation } : profile,
      caProposal,
      extendedEvidenceClaims,
    };
  }

  const estimatedProfile: PlayerRatingProfile = {
    ...profile,
    ca: { value: caProposal.value, confidence: caProposal.confidence, plausibleRange: caProposal.plausibleRange },
    // PA estimation is explicitly out of scope for this milestone (Part
    // C scopes this engine to CA only) -- a newly-estimated player's PA
    // stays honestly unassessed unless an editor overrides it.
    pa: profile.pa.value === null ? unassessedAbilityRating(PA_MIN, PA_MAX) : profile.pa,
    claims: claimsForEstimation,
  };

  return { profile: estimatedProfile, caProposal, extendedEvidenceClaims };
}
