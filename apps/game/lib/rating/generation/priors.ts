// HM-RATINGS-0.4 Part C: the priors that shape a GENERATED attribute
// distribution. Deliberately small, bounded adjustments layered on top
// of a CA-derived baseline -- never a per-attribute formula strong
// enough to make every player at a position (or with a given role)
// converge to the same profile. Evidence-backed attributes are never
// touched by any of this (see generationEngine.ts).
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, CA_MAX, CA_MIN, type AttackRole, type DefenceRole, type OutcourtAttribute, type OutcourtAttributeFamily, type OutcourtPositionId } from "../types";

/**
 * Maps a resolved CA (1-200) to a coherent attribute-scale (1-20)
 * baseline "overall skill level" -- explicitly NOT `ca / 56` or any
 * similar naive average, and explicitly NOT applied uniformly to every
 * attribute. This is only the starting point; position/role emphasis,
 * evidence, and bounded variation then shape the actual distribution
 * around it (Part C: "A CA 166 playmaker and a CA 166 defensive
 * specialist must be able to have radically different profiles").
 */
export function baselineFromCA(ca: number): number {
  const clamped = Math.min(CA_MAX, Math.max(CA_MIN, ca));
  const t = (clamped - CA_MIN) / (CA_MAX - CA_MIN);
  return ATTRIBUTE_MIN + t * (ATTRIBUTE_MAX - ATTRIBUTE_MIN);
}

/**
 * Small, bounded per-family emphasis by outcourt position (Part C
 * invariant 4: "Position should influence priors but must NOT rigidly
 * clone every player at that position" -- these shift the baseline by
 * at most a couple of points per family, leaving role association and
 * seeded variation to do the rest of the differentiation).
 */
export const POSITION_FAMILY_EMPHASIS: Record<OutcourtPositionId, Partial<Record<OutcourtAttributeFamily, number>>> = {
  M9: { PERCEPTION_DECISION: 2, TACTICAL: 1, PHYSICAL: -1 },
  V9: { TECHNICAL: 2, PHYSICAL: 1, DEFENSIVE: -1 },
  H9: { TECHNICAL: 2, PHYSICAL: 1, DEFENSIVE: -1 },
  M6: { PHYSICAL: 2, TECHNICAL: 1, PERCEPTION_DECISION: -1 },
  V6: { PHYSICAL: 2, TECHNICAL: 1, PERCEPTION_DECISION: -1, DEFENSIVE: -1 },
  H6: { PHYSICAL: 2, TECHNICAL: 1, PERCEPTION_DECISION: -1, DEFENSIVE: -1 },
};

/**
 * Attributes strongly implied by a known (evidence-backed) attack or
 * defence role -- these are what elevate a non-evidenced attribute from
 * GENERATED_PRIOR to DERIVED (Part B). Deliberately a curated subset per
 * role, not "every attribute gets a little of every role" -- a role
 * that isn't listed for an attribute contributes nothing to it.
 */
export const ROLE_ATTRIBUTE_ASSOCIATIONS: Partial<Record<AttackRole | DefenceRole, Partial<Record<OutcourtAttribute, number>>>> = {
  // Attack roles, M9 (playmaker)
  PRIMARY_PLAYMAKER: { PLAYMAKING: 3, GAME_READING: 2, DECISION_MAKING: 2, TEMPO_CONTROL: 2, TACTICAL_UNDERSTANDING: 1 },
  BREAKTHROUGH_CREATOR: { BREAKTHROUGH: 3, DECISION_MAKING: 1, ADVANTAGE_RECOGNITION: 2 },
  SCORING_CENTRE_BACK: { SHOOTING_PLACEMENT: 2, SHOOTING_POWER: 2, FINISHING: 1 },
  TEMPO_CONTROLLER: { TEMPO_CONTROL: 3, GAME_READING: 1 },
  // Attack roles, V9/H9 (shooting backs)
  SHOOTING_BACK: { SHOOTING_POWER: 3, SHOOTING_PLACEMENT: 2 },
  BREAKTHROUGH_BACK: { BREAKTHROUGH: 3, EXPLOSIVENESS: 1 },
  CREATIVE_BACK: { PLAYMAKING: 2, GAME_READING: 1 },
  COMPLETE_BACK: { SHOOTING_POWER: 1, PLAYMAKING: 1, BREAKTHROUGH: 1 },
  // Attack roles, M6 (pivot)
  PHYSICAL_PIVOT: { STRENGTH: 3, CONTACT_BALANCE: 2, SCREENING: 1 },
  MOBILE_PIVOT: { AGILITY: 2, OFF_BALL_MOVEMENT: 2 },
  SCREENING_PIVOT: { SCREENING: 3, CONTACT_BALANCE: 1 },
  OFFENSIVE_PIVOT: { PIVOT_PLAY: 3, FINISHING: 2 },
  TWO_WAY_M6: { DEFENSIVE_POSITIONING: 2, PIVOT_PLAY: 1 },
  // Attack roles, V6/H6 (wings)
  ELITE_FINISHER: { WING_FINISHING: 3, TOP_SPEED: 1 },
  TRANSITION_WING: { TOP_SPEED: 3, ACCELERATION: 2, TRANSITION_UNDERSTANDING: 2 },
  CREATIVE_WING: { WING_FINISHING: 1, GAME_READING: 1, SHOOTING_VARIETY: 1 },
  TWO_WAY_WING: { DEFENSIVE_POSITIONING: 2, WING_FINISHING: 1 },
  // Defence roles (position-independent)
  CENTRAL_ANCHOR: { CENTRAL_DEFENCE: 3, COVERING: 2 },
  AGGRESSIVE_SECOND: { CONTACT_ABILITY: 2, BALL_WINNING: 2 },
  MOBILE_DEFENDER: { LATERAL_DEFENCE: 2, AGILITY: 1 },
  DEFENSIVE_SPECIALIST: { DEFENSIVE_POSITIONING: 3, DEFENSIVE_TIMING: 2, BALL_WINNING: 1 },
  MULTI_POSITION_DEFENDER: { SWITCHING_HANDOVER: 3, DEFENSIVE_POSITIONING: 1 },
};

/** Deterministic variation stays small relative to baseline/family/role signals (Part D: "must never overpower CA, known evidence, role structure, position structure"). */
export const VARIATION_MAGNITUDE = 1;
