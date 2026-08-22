// HM-RATINGS-0.3: deterministic proposal engine.
//
// Turns one real roster player + (optional) HM-RATINGS-0.2 calibration
// match into a proposed PlayerRatingProfile. Pure function -- no I/O,
// no randomness, same inputs always produce the identical output.
//
// Two, and only two, outcomes:
//  1. A calibration match exists: the ALREADY hand-calibrated
//     HM-RATINGS-0.2 profile is adopted verbatim (ca/pa/attributes/
//     roles/claims), re-keyed onto the real roster playerId. This is
//     never a generic "label -> number" rule -- it is a direct,
//     one-to-one adoption of a specific, already-reviewed calibration
//     for that specific named player.
//  2. No calibration match: ca/pa are left fully UNASSESSED (Rating
//     Model §2: "Unknown players must not all become average"), no
//     numeric attributes are invented, no role is claimed. This is the
//     honest, expected outcome for the overwhelming majority of the
//     league in this milestone -- the pipeline's job here is to prove
//     it can safely represent "we don't know yet" at scale, not to
//     guess.
import type { RealWorldPlayer } from "../../gameWorld/realWorldLoader";
import { unassessedAbilityRating } from "../validators";
import { CA_MAX, CA_MIN, PA_MAX, PA_MIN, type PlayerRatingClaim, type PlayerRatingProfile, type Position } from "../types";
import { buildAgeContextClaim, buildPositionClaim, mapPrimaryPosition, mapSecondaryPositions, matchCalibrationReference } from "./evidenceCollection";

export interface ProposalOutcome {
  profile: PlayerRatingProfile;
  /** Whether a HM-RATINGS-0.2 calibration match was found and adopted. */
  matchedCalibration: boolean;
  /** True when the roster's primaryPosition code could not be mapped onto the rating domain's Position vocabulary (never happens for the 7 canonical codes; guards against future data drift). */
  unresolvedPosition: boolean;
}

function rekeyClaim(claim: PlayerRatingClaim, newPlayerId: string): PlayerRatingClaim {
  return { ...claim, playerId: newPlayerId };
}

/** The explicit "why" claim every unmatched player still receives -- see this module's own doc on why "no evidence" is itself explained, not silent. */
function unmatchedRationaleClaim(playerId: string): PlayerRatingClaim {
  return {
    id: `${playerId}-proposal-rationale`,
    playerId,
    evidenceClass: "UNASSESSED",
    domain: "CALIBRATION",
    key: "proposalRationale",
    value: "No verified career signal, expert anchor, or HM-RATINGS-0.2 calibration match found beyond roster position -- CA/PA are left fully unresolved rather than defaulted to an average.",
    sourceRefs: [],
  };
}

function matchedRationaleClaim(playerId: string, calibrationPlayerId: string): PlayerRatingClaim {
  return {
    id: `${playerId}-proposal-rationale`,
    playerId,
    evidenceClass: "USER_EXPERT_PLAYER_ANCHOR",
    domain: "CALIBRATION",
    key: "proposalRationale",
    value: `Matched HM-RATINGS-0.2 calibration reference "${calibrationPlayerId}" by normalized full name -- this profile's ca/pa/attributes/roles/claims are adopted directly from that already-reviewed hand calibration, re-keyed onto the real roster playerId.`,
    sourceRefs: ["ev-hm-ratings-0.3-pipeline"],
    confidence: "PROBABLE",
  };
}

/**
 * Proposes a rating profile for one real roster player. Deterministic:
 * depends only on `player` and the (already-deterministic) calibration
 * match lookup -- no randomness, no wall-clock reads.
 */
export function proposePlayerRating(player: RealWorldPlayer): ProposalOutcome {
  const position = mapPrimaryPosition(player.primaryPosition);
  const secondaryPositions = mapSecondaryPositions(player.secondaryPositions);
  const unresolvedPosition = position === null;

  const calibration = matchCalibrationReference(player);

  const structuralClaims: PlayerRatingClaim[] = [];
  if (position !== null) structuralClaims.push(buildPositionClaim(player, position));
  const ageClaim = buildAgeContextClaim(player);
  if (ageClaim) structuralClaims.push(ageClaim);

  if (calibration) {
    const profile: PlayerRatingProfile = {
      playerId: player.playerId,
      position: position ?? calibration.position,
      secondaryPositions: secondaryPositions.length > 0 ? secondaryPositions : calibration.secondaryPositions,
      physicalProfile: {
        heightCm: player.heightCm ?? calibration.physicalProfile.heightCm,
        weightKg: calibration.physicalProfile.weightKg,
        handedness: player.handedness ?? calibration.physicalProfile.handedness,
      },
      outcourtAttributes: calibration.outcourtAttributes,
      goalkeeperAttributes: calibration.goalkeeperAttributes,
      attackRoleProficiencies: calibration.attackRoleProficiencies,
      defenceRoleProficiencies: calibration.defenceRoleProficiencies,
      phaseAbilities: calibration.phaseAbilities,
      usage: calibration.usage,
      utility: calibration.utility,
      ca: calibration.ca,
      pa: calibration.pa,
      claims: [...structuralClaims, ...calibration.claims.map((c) => rekeyClaim(c, player.playerId)), matchedRationaleClaim(player.playerId, calibration.playerId)],
    };
    return { profile, matchedCalibration: true, unresolvedPosition };
  }

  const profile: PlayerRatingProfile = {
    playerId: player.playerId,
    position: position ?? ("M9" as Position), // structurally required; unresolved-position cases are flagged via `unresolvedPosition`, never silently trusted as a real M9
    secondaryPositions,
    physicalProfile: {
      heightCm: player.heightCm ?? undefined,
      handedness: player.handedness ?? undefined,
    },
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    phaseAbilities: [],
    usage: { attackUsageShare: 0, defenceUsageShare: 0, transitionUsageShare: 0 },
    utility: { utility: 0, positionalFlexibility: 0 },
    ca: unassessedAbilityRating(CA_MIN, CA_MAX),
    pa: unassessedAbilityRating(PA_MIN, PA_MAX),
    claims: [...structuralClaims, unmatchedRationaleClaim(player.playerId)],
  };
  return { profile, matchedCalibration: false, unresolvedPosition };
}
