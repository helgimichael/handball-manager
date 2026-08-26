// HM-STAFF-1.0 Part 5/7: the ONE centralized mapping from staff roles to
// their relevant attributes (role suitability, Part 17) and from
// training session types to eligible roles + quality-relevant attributes
// (Part 7/8). No other module may hardcode either mapping.
import type { TrainingSessionType } from "../training/types";
import type { StaffAttribute, StaffRole } from "./types";

/**
 * Part 5: each role's relevant-attribute weights (sum to 1.0 per role) --
 * NOT every attribute affects every role. Attributes omitted from a
 * role's weights never contribute to that role's suitability score.
 */
export const ROLE_ATTRIBUTE_WEIGHTS: Record<StaffRole, Partial<Record<StaffAttribute, number>>> = {
  HEAD_COACH: { TACTICAL_COACHING: 0.3, LEADERSHIP: 0.3, COMMUNICATION: 0.2, PLAYER_DEVELOPMENT: 0.2 },
  ASSISTANT_COACH: { TECHNICAL_COACHING: 0.3, TACTICAL_COACHING: 0.3, PLAYER_DEVELOPMENT: 0.2, COMMUNICATION: 0.2 },
  GOALKEEPER_COACH: { GOALKEEPER_COACHING: 0.7, PLAYER_DEVELOPMENT: 0.3 },
  PHYSICAL_COACH: { PHYSICAL_COACHING: 0.7, PLAYER_DEVELOPMENT: 0.3 },
  ANALYST: { ANALYSIS: 0.6, MATCH_PREPARATION: 0.4 },
  PHYSIO: { MEDICAL: 1.0 },
  SCOUT: { PLAYER_JUDGEMENT: 0.5, POTENTIAL_JUDGEMENT: 0.5 },
};

/**
 * Part 7/8: which roles may lead each session type (also the set a
 * manager may pick a responsible coach from in the Training UI -- Part
 * 8: "only eligible staff should appear", "do not allow a scout to lead
 * goalkeeper training"). RECOVERY has no eligible role at all -- no
 * coach needed, no quality effect (Part 7/30).
 */
export const SESSION_ELIGIBLE_ROLES: Record<TrainingSessionType, readonly StaffRole[]> = {
  TECHNICAL: ["ASSISTANT_COACH", "HEAD_COACH"],
  ATTACK: ["ASSISTANT_COACH", "HEAD_COACH"],
  DEFENCE: ["ASSISTANT_COACH", "HEAD_COACH"],
  TRANSITION: ["ASSISTANT_COACH", "PHYSICAL_COACH", "HEAD_COACH"],
  SPECIAL_PLAY: ["HEAD_COACH", "ASSISTANT_COACH"],
  PHYSICAL: ["PHYSICAL_COACH"],
  STRENGTH: ["PHYSICAL_COACH"],
  CONDITIONING: ["PHYSICAL_COACH"],
  GOALKEEPER: ["GOALKEEPER_COACH", "HEAD_COACH", "ASSISTANT_COACH"],
  TEAM_TACTICAL: ["HEAD_COACH", "ASSISTANT_COACH"],
  MATCH_PREPARATION: ["HEAD_COACH", "ANALYST"],
  RECOVERY: [],
};

/**
 * Part 7: which SPECIFIC attribute(s) of the resolved coach determine
 * that session's training quality -- finer-grained than role suitability
 * (e.g. an ATTACK session cares about ATTACKING_COACHING+TACTICAL_COACHING
 * specifically, not a HEAD_COACH's full relevant-attribute weighting).
 * An empty/omitted list means the session carries no coaching-quality
 * effect (RECOVERY).
 */
export const SESSION_QUALITY_ATTRIBUTES: Record<TrainingSessionType, readonly StaffAttribute[]> = {
  TECHNICAL: ["TECHNICAL_COACHING"],
  ATTACK: ["ATTACKING_COACHING", "TACTICAL_COACHING"],
  DEFENCE: ["DEFENSIVE_COACHING", "TACTICAL_COACHING"],
  TRANSITION: ["TACTICAL_COACHING", "PHYSICAL_COACHING"],
  SPECIAL_PLAY: ["TACTICAL_COACHING"],
  PHYSICAL: ["PHYSICAL_COACHING"],
  STRENGTH: ["PHYSICAL_COACHING"],
  CONDITIONING: ["PHYSICAL_COACHING"],
  GOALKEEPER: ["GOALKEEPER_COACHING"],
  TEAM_TACTICAL: ["TACTICAL_COACHING"],
  MATCH_PREPARATION: ["ANALYSIS", "MATCH_PREPARATION"],
  RECOVERY: [],
};
