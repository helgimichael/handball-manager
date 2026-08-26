// HM-TRAINING-1.1 Part 4/5/8: the ONE centralized mapping from training
// stimulus sources (session type, individual focus) to the canonical
// attribute families (lib/rating/types.ts) they develop. No other module
// may hardcode a session-type-to-attribute mapping (Part 5: "no hidden
// mappings scattered across UI").
import { GOALKEEPER_ATTRIBUTE_FAMILIES, OUTCOURT_ATTRIBUTE_FAMILIES, type GoalkeeperAttributeFamily, type OutcourtAttributeFamily } from "../rating/types";
import type { TrainingSessionType } from "../training/types";
import type { IndividualDevelopmentFocus } from "./types";

/**
 * Part 5/20: what an OUTCOURT player develops from each session type.
 * Omitted keys (GOALKEEPER, MATCH_PREPARATION, RECOVERY) develop nothing
 * for outcourt players -- MATCH_PREPARATION/RECOVERY deliberately carry
 * "little/no long-term attribute stimulus" per spec, and a GOALKEEPER
 * session is obviously irrelevant to an outcourt player's own development.
 */
export const OUTCOURT_SESSION_FAMILIES: Partial<Record<TrainingSessionType, readonly OutcourtAttributeFamily[]>> = {
  TECHNICAL: ["TECHNICAL"],
  ATTACK: ["TECHNICAL", "PERCEPTION_DECISION"],
  DEFENCE: ["DEFENSIVE"],
  TRANSITION: ["PERCEPTION_DECISION", "PHYSICAL"],
  TEAM_TACTICAL: ["TACTICAL"],
  SPECIAL_PLAY: ["TACTICAL"],
  STRENGTH: ["PHYSICAL"],
  CONDITIONING: ["PHYSICAL"],
};

/**
 * Part 5/20: what a GOALKEEPER develops from each session type. A GK
 * still gets a little from TEAM_TACTICAL (their own PERCEPTION_DECISION
 * family -- game reading is not outcourt-specific), but nothing from any
 * outcourt-only session (STRENGTH/CONDITIONING/TECHNICAL/ATTACK/DEFENCE/
 * TRANSITION/SPECIAL_PLAY are all omitted -- Part 20/21: a GK does not
 * receive normal outcourt development from those).
 */
export const GOALKEEPER_SESSION_FAMILIES: Partial<Record<TrainingSessionType, readonly GoalkeeperAttributeFamily[]>> = {
  GOALKEEPER: ["SHOT_STOPPING", "PERCEPTION_DECISION", "TRANSITION"],
  TEAM_TACTICAL: ["PERCEPTION_DECISION"],
};

/** Part 8: individual focus -> the family/families it emphasizes, per branch. NORMAL maps to nothing (no emphasis, no boost/reduction anywhere). */
export const INDIVIDUAL_FOCUS_OUTCOURT_FAMILIES: Partial<Record<IndividualDevelopmentFocus, readonly OutcourtAttributeFamily[]>> = {
  TECHNICAL: ["TECHNICAL"],
  ATTACKING_DECISIONS: ["PERCEPTION_DECISION"],
  DEFENCE: ["DEFENSIVE"],
  PHYSICAL: ["PHYSICAL"],
  MENTAL: ["MENTAL"],
};

export const INDIVIDUAL_FOCUS_GOALKEEPER_FAMILIES: Partial<Record<IndividualDevelopmentFocus, readonly GoalkeeperAttributeFamily[]>> = {
  GOALKEEPER: ["SHOT_STOPPING", "PERCEPTION_DECISION", "TRANSITION"],
  MENTAL: ["MENTAL"],
};

export function outcourtFamilyAttributes(family: OutcourtAttributeFamily): readonly string[] {
  return OUTCOURT_ATTRIBUTE_FAMILIES[family];
}

export function goalkeeperFamilyAttributes(family: GoalkeeperAttributeFamily): readonly string[] {
  return GOALKEEPER_ATTRIBUTE_FAMILIES[family];
}
