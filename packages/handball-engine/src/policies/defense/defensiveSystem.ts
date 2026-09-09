/**
 * MATCH-EXPERIENCE-2.0 M23: THE DEFENSIVE SYSTEM.
 *
 * Until now there was one way to defend and the engine did not need a word for
 * it. A 5:1 is not a 6:0 with a man pushed forward -- five defenders have to
 * cover the width six were covering, and the man in front is doing a different
 * job from any of them -- so the engine needs to be able to say which system a
 * team is playing, and every piece of shared machinery has to keep working
 * across both.
 *
 * WHAT A SYSTEM IS, HERE. Two facts and nothing else: where each role stands
 * when the defence is at home, and which role (if any) plays in front. Every
 * other difference between 6:0 and 5:1 falls out of those. The collective layer
 * already reads its shape from `state.defense.homePositions` rather than from a
 * hardcoded line, so seeding a different shape moves the whole defence; and the
 * front man's behaviour is one reaction added beside the ones M7 already has.
 *
 * WHAT IS DELIBERATELY SHARED. Spatial Control, defensive reach, the engagement
 * race, help, the pivot marker and the whole M18/M19/M20 contact model are
 * untouched and used identically by both systems. A 5:1 defender races an
 * attacker with the same `timeToReach`, meets him with the same posture and
 * fouls him under the same M10. The systems differ in structure, not in physics.
 */
import { mirrorYForOppositeGoalSide } from "@handball-manager/match-contract";
import { SIX_ZERO_DEFENSE_FORMATION_ID } from "./sixZeroDefensePolicy";
import type { MeterPoint } from "../../domain/geometry/coordinates";
import type { DefenseRole } from "../../domain/handball/player";
import type { AttackingGoalSide } from "../../domain/match/possession";

export const FIVE_ONE_DEFENSE_FORMATION_ID = "defence-5-1";

/** The goal the shapes below are authored against; the other end is mirrored. */
const SOURCE_GOAL_SIDE: AttackingGoalSide = "TOP";

/**
 * The 5:1, as five men across the line and one in front of them.
 *
 * The base is deliberately NOT the 6:0 line with a gap in it. Five players have
 * to hold the same width six did, so they stand further apart and the middle of
 * the line is a single man rather than a pair -- which is precisely the trade
 * a 5:1 makes: pressure at the top of the attack, bought with a thinner line
 * behind it.
 *
 * Symmetric about the centre of the court by construction (2/18, 5.6/14.4, and
 * 10 in the middle), so the system reads the same against a left-handed attack
 * as a right-handed one.
 *
 * The front man stands about four and a half metres ahead of the middle of the
 * line -- far enough to be in the backcourt's passing and driving space, near
 * enough that the five behind him can still cover what he vacates.
 */
const FIVE_ONE_SHAPE: Readonly<Record<DefenseRole, MeterPoint>> = Object.freeze({
  L1: Object.freeze({ x: 2.0, y: 2.05 }),
  L2: Object.freeze({ x: 5.6, y: 5.9 }),
  R3: Object.freeze({ x: 10.0, y: 6.95 }),
  R2: Object.freeze({ x: 14.4, y: 5.9 }),
  R1: Object.freeze({ x: 18.0, y: 2.05 }),
  /** The one. */
  L3: Object.freeze({ x: 10.0, y: 11.5 }),
});

/** Which role plays in front in a 5:1. */
export const FIVE_ONE_FRONT_ROLE: DefenseRole = "L3";

/** The five who hold the line, in left-to-right order. */
export const FIVE_ONE_BASE_ROLE_ORDER: readonly DefenseRole[] = Object.freeze(["L1", "L2", "R3", "R2", "R1"]);

export type DefensiveSystemId = typeof SIX_ZERO_DEFENSE_FORMATION_ID | typeof FIVE_ONE_DEFENSE_FORMATION_ID;

/** Is this formation one the collective layer knows how to run? */
export function isKnownDefensiveSystem(formationId: string): boolean {
  return formationId === SIX_ZERO_DEFENSE_FORMATION_ID || formationId === FIVE_ONE_DEFENSE_FORMATION_ID;
}

/**
 * The role playing in front, or null for a flat system.
 *
 * This is the whole of what "5:1" means to the rest of the engine. Nothing else
 * branches on the formation id: a defence with a front role has a front
 * defender, and a defence without one does not.
 */
export function frontDefenderRoleOf(formationId: string): DefenseRole | null {
  return formationId === FIVE_ONE_DEFENSE_FORMATION_ID ? FIVE_ONE_FRONT_ROLE : null;
}

/** Canonical 5:1 home for a defensive role at the goal it protects. */
export function fiveOneHomePosition(role: DefenseRole, defendedGoalSide: AttackingGoalSide): MeterPoint | null {
  const canonical = FIVE_ONE_SHAPE[role];
  if (!canonical) return null;
  return defendedGoalSide === SOURCE_GOAL_SIDE
    ? { ...canonical }
    : { x: canonical.x, y: mirrorYForOppositeGoalSide(canonical.y) };
}
