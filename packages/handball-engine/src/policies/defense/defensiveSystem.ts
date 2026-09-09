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
export const THREE_TWO_ONE_DEFENSE_FORMATION_ID = "defence-3-2-1";

/**
 * M24: WHICH LAYER A DEFENDER BELONGS TO.
 *
 * This is the role identity M23 did without and said so. A 5:1 only needed to
 * know which man was in front; a 3:2:1 has a middle layer that is neither the
 * line nor the point, and calling those men "L2" and "R2" says where they stand
 * in a 6:0 and nothing about the job they are doing here.
 *
 * Deliberately a property of the SYSTEM rather than a new `DefenseRole`. The
 * role ids are woven through gap responsibility, adjacency and the canonical
 * shapes; adding members to that union would touch all of it to express
 * something none of it needs. What the engine actually needs to ask is "what
 * layer is this man in", and the system is the only thing that knows.
 */
export type DefensiveLayer = "BASE" | "INTERMEDIATE" | "FRONT";

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

/**
 * The 3:2:1: three across the line, two in the half-spaces, one at the point.
 *
 * Three genuine depths. The base is tight and deep because three men cannot
 * hold the width six did and must instead hold the middle and the line; the two
 * intermediates sit in the half-spaces, high enough to reach a back before he
 * has built any speed; the point man works the centre. It gives away the wings
 * and buys pressure on the backcourt, which is the trade the system exists for.
 *
 * Symmetric about the middle of the court by construction (5.5/14.5, 6.8/13.2,
 * and 10 for both the centre of the base and the point).
 *
 * QA GATE 1: the base stands ON the goal-area line, not inside it. The first
 * version of this shape put all three base defenders inside the six-metre area
 * -- the middle man was 3.2m from his own goal line -- which is not a defence,
 * it is three players standing where no player may stand, and a human saw it
 * immediately. The area is not a circle around the goal centre but two quarter
 * circles around the POSTS joined by a straight line, so the outside men can
 * stand shallower than the middle one and still be legal; that is what these
 * numbers are, with a little clearance so they are visibly outside it.
 *
 * The point man stands a little further out than the one in a 5:1, and
 * deliberately: a 5:1's front man is the only thing between the backcourt and a
 * flat line, so he cannot afford to stray far from it, while this one has two
 * men in the half-spaces behind him and can meet the attack earlier. It is only
 * a little further, though -- a point man who stands deeper than the centre
 * back he is supposed to be pressing is not in front of anybody, and would
 * spend the possession recovering.
 */
const THREE_TWO_ONE_SHAPE: Readonly<Record<DefenseRole, MeterPoint>> = Object.freeze({
  L1: Object.freeze({ x: 5.5, y: 5.6 }),
  R3: Object.freeze({ x: 10.0, y: 6.5 }),
  R1: Object.freeze({ x: 14.5, y: 5.6 }),
  L2: Object.freeze({ x: 6.8, y: 9.4 }),
  R2: Object.freeze({ x: 13.2, y: 9.4 }),
  L3: Object.freeze({ x: 10.0, y: 12.0 }),
});

/** The point man in a 3:2:1, and in a 5:1: the same job in both. */
const FRONT_ROLE: DefenseRole = "L3";
/** The two half-space defenders of a 3:2:1. */
export const THREE_TWO_ONE_INTERMEDIATE_ROLES: readonly DefenseRole[] = Object.freeze(["L2", "R2"]);
/** The three who hold the line, left to right. */
export const THREE_TWO_ONE_BASE_ROLE_ORDER: readonly DefenseRole[] = Object.freeze(["L1", "R3", "R1"]);

export type DefensiveSystemId =
  | typeof SIX_ZERO_DEFENSE_FORMATION_ID
  | typeof FIVE_ONE_DEFENSE_FORMATION_ID
  | typeof THREE_TWO_ONE_DEFENSE_FORMATION_ID;

/** Is this formation one the collective layer knows how to run? */
export function isKnownDefensiveSystem(formationId: string): boolean {
  return (
    formationId === SIX_ZERO_DEFENSE_FORMATION_ID ||
    formationId === FIVE_ONE_DEFENSE_FORMATION_ID ||
    formationId === THREE_TWO_ONE_DEFENSE_FORMATION_ID
  );
}

/**
 * Which layer this role plays in, in this system.
 *
 * A flat system has one layer and every man is in it. That is not a special
 * case being tolerated -- it is what "6:0" means -- and it is why nothing
 * downstream needs to know which system it is looking at, only which layer the
 * man in front of it belongs to.
 */
export function defensiveLayerOf(formationId: string, role: DefenseRole): DefensiveLayer {
  if (formationId === FIVE_ONE_DEFENSE_FORMATION_ID) return role === FRONT_ROLE ? "FRONT" : "BASE";
  if (formationId === THREE_TWO_ONE_DEFENSE_FORMATION_ID) {
    if (role === FRONT_ROLE) return "FRONT";
    return THREE_TWO_ONE_INTERMEDIATE_ROLES.includes(role) ? "INTERMEDIATE" : "BASE";
  }
  return "BASE";
}

/** Canonical home for a role in whichever system, at the goal it protects. */
export function defensiveHomePosition(
  formationId: string,
  role: DefenseRole,
  defendedGoalSide: AttackingGoalSide,
): MeterPoint | null {
  if (formationId === FIVE_ONE_DEFENSE_FORMATION_ID) return fiveOneHomePosition(role, defendedGoalSide);
  if (formationId === THREE_TWO_ONE_DEFENSE_FORMATION_ID) return atGoalSide(THREE_TWO_ONE_SHAPE[role], defendedGoalSide);
  return null;
}

function atGoalSide(point: MeterPoint | undefined, defendedGoalSide: AttackingGoalSide): MeterPoint | null {
  if (!point) return null;
  return defendedGoalSide === SOURCE_GOAL_SIDE ? { ...point } : { x: point.x, y: mirrorYForOppositeGoalSide(point.y) };
}

/**
 * The role playing in front, or null for a flat system.
 *
 * This is the whole of what "5:1" means to the rest of the engine. Nothing else
 * branches on the formation id: a defence with a front role has a front
 * defender, and a defence without one does not.
 */
export function frontDefenderRoleOf(formationId: string): DefenseRole | null {
  return formationId === FIVE_ONE_DEFENSE_FORMATION_ID || formationId === THREE_TWO_ONE_DEFENSE_FORMATION_ID
    ? FRONT_ROLE
    : null;
}

/** The roles playing between the line and the point, if the system has any. */
export function intermediateRolesOf(formationId: string): readonly DefenseRole[] {
  return formationId === THREE_TWO_ONE_DEFENSE_FORMATION_ID ? THREE_TWO_ONE_INTERMEDIATE_ROLES : [];
}

/** Canonical 5:1 home for a defensive role at the goal it protects. */
export function fiveOneHomePosition(role: DefenseRole, defendedGoalSide: AttackingGoalSide): MeterPoint | null {
  return atGoalSide(FIVE_ONE_SHAPE[role], defendedGoalSide);
}
