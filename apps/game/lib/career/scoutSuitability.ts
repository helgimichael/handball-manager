// HM-SCOUTING-1.1: the shared weighted-suitability math used by BOTH
// scouting.ts (PLAYER assignments, unchanged since HM-SCOUTING-1.0) and
// scoutDiscovery.ts (broad-assignment discovery cycles). Split into its
// own module purely to avoid a scouting.ts <-> scoutDiscovery.ts
// circular value import -- scouting.ts re-exports everything here so
// every existing `from "./scouting"` import keeps working unchanged.
import { STAFF_ATTRIBUTE_MAX, STAFF_ATTRIBUTE_MIN, type ResolvedStaffMember, type StaffAttribute } from "../staff/types";
import type { ScoutAssignmentType } from "./scouting";

export const NEUTRAL_SUITABILITY = (STAFF_ATTRIBUTE_MIN + STAFF_ATTRIBUTE_MAX) / 2; // 10.5

export function weightedSuitability(scout: ResolvedStaffMember, weights: Partial<Record<StaffAttribute, number>>): number {
  let sum = 0;
  let totalWeight = 0;
  for (const [attr, weight] of Object.entries(weights) as [StaffAttribute, number][]) {
    const entry = scout.profile.attributes[attr];
    if (!entry || weight === undefined) continue;
    sum += entry.value * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? sum / totalWeight : NEUTRAL_SUITABILITY;
}

/** The general-purpose (not one-player-specific) scout quality for a broad assignment -- NET (discovery reach) always matters, TACTICAL_ASSESSMENT always contributes a small constant weight (tactical-fit judgement), geography (REGIONAL_KNOWLEDGE/INTERNATIONAL_KNOWLEDGE) always matters, GOALKEEPER_COACHING dominates when the assignment specifically targets goalkeepers (assignmentType==="POSITION" with targetPosition "MV"), and YOUTH_DEVELOPMENT dominates for AGE_BAND. */
export function computeBroadAssignmentSuitability(scout: ResolvedStaffMember, assignmentType: ScoutAssignmentType, geographyAttr: StaffAttribute, targetPosition?: string): number {
  if (assignmentType === "POSITION" && targetPosition === "MV") {
    return weightedSuitability(scout, { PLAYER_JUDGEMENT: 0.15, POTENTIAL_JUDGEMENT: 0.1, NETWORK: 0.2, GOALKEEPER_COACHING: 0.35, TACTICAL_ASSESSMENT: 0.05, [geographyAttr]: 0.15 });
  }
  if (assignmentType === "AGE_BAND") {
    return weightedSuitability(scout, { PLAYER_JUDGEMENT: 0.15, POTENTIAL_JUDGEMENT: 0.2, YOUTH_DEVELOPMENT: 0.25, NETWORK: 0.2, TACTICAL_ASSESSMENT: 0.05, [geographyAttr]: 0.15 });
  }
  return weightedSuitability(scout, { PLAYER_JUDGEMENT: 0.2, POTENTIAL_JUDGEMENT: 0.15, NETWORK: 0.3, TACTICAL_ASSESSMENT: 0.1, [geographyAttr]: 0.25 });
}
