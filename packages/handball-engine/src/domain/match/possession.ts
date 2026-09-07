/**
 * MATCH-EXPERIENCE-2.0 M1: the canonical FULL-COURT possession model.
 *
 * WHY FULL COURT. The match engine's world is the whole 40x20 court, always --
 * not a half-court scenario that a later milestone widens. Goalkeeper
 * possession, turnovers, first/second wave, defensive retreat and organized
 * attack at either end are all transitions ACROSS the court, so a half-court
 * spatial foundation would have to be replaced rather than extended. M1 only
 * simulates an organized attack at one end, but every player, the ball and
 * every coordinate below already live in full-court space.
 *
 * COORDINATES ARE NOT REINVENTED HERE. The canonical convention lives in
 * @handball-manager/match-contract's court.ts, which exists precisely because
 * SIM (this package's domain/geometry/court.ts) and FIELD (match-renderer's
 * geometry/HandballCourtGeometry.ts) already agreed on origin, axis direction,
 * units and dimensions. This module points at that contract instead of
 * re-deriving the agreement a third time -- origin top-left, x right, y down,
 * metres, TOP goal on y = 0 and BOTTOM goal on y = 40. Because the simulation
 * and the eventual renderer share those numbers, rendering will need no second
 * coordinate architecture.
 */
import {
  CANONICAL_COURT_LENGTH_METERS,
  CANONICAL_COURT_WIDTH_METERS,
  CANONICAL_FULL_COURT_BOUNDS,
  type CanonicalGoalSide,
} from "@handball-manager/match-contract";
import type { MeterPoint } from "../geometry/coordinates";
import type { HandballState } from "../handball/state";
import type { TeamId } from "../handball/player";

/**
 * Which goal the possessing team attacks, named by court geometry rather than
 * home/away -- reusing the contract's own type so SIM, FIELD and any future
 * manager layer cannot drift into three spellings of the same idea.
 */
export type AttackingGoalSide = CanonicalGoalSide;

/**
 * The phase vocabulary. M1 established the organized-attack phases; M2 added
 * the transition ones. Adding them required no change to the spatial state --
 * exactly the property the full-court foundation was chosen for: a transition
 * phase is new behaviour over the same coordinates, never a new world. Second
 * wave and the fuller taxonomy can arrive the same way.
 */
export const POSSESSION_PHASES = [
  "ORGANIZED_SETUP",
  "CIRCULATION",
  "ATTACK_ACTION",
  "RESOLUTION",
  "DEAD_BALL",
  // MATCH-EXPERIENCE-2.0 M2: transition. A defensive regain becomes a real
  // handball transition in the opposite direction, over the SAME full-court
  // state -- these are added members, not a second world.
  "POSSESSION_CHANGE",
  "DEFENSIVE_RETREAT",
  "FIRST_WAVE",
  // MATCH-EXPERIENCE-2.0 M8: the supporting runner arriving behind the first
  // wave. Added the same way the M2 phases were -- new behaviour over the same
  // coordinates, not a new world.
  "SECOND_WAVE",
  "EARLY_OFFENSE",
  "COMPLETE",
] as const;
export type PossessionPhase = (typeof POSSESSION_PHASES)[number];

/**
 * Terminal results. The first five end a possession; M2 adds
 * ORGANIZED_ATTACK_REACHED, which is how a transition ends when the fast break
 * does NOT resolve -- the team has simply arrived and settled into an
 * organized attacking shape at the opposite end. It exists so the engine never
 * has to fake a shot merely to terminate a transition.
 */
export const POSSESSION_OUTCOMES = [
  "SHOT_GOAL",
  "SHOT_SAVED",
  "SHOT_MISSED",
  "TURNOVER",
  "FREE_THROW",
  "ORGANIZED_ATTACK_REACHED",
] as const;

export type PossessionOutcome = (typeof POSSESSION_OUTCOMES)[number];

/**
 * The outcomes an ORGANIZED POSSESSION can end in. ORGANIZED_ATTACK_REACHED is
 * deliberately excluded: it means "the fast break did not resolve and the team
 * settled", which only a transition can produce.
 */
export const ORGANIZED_POSSESSION_OUTCOMES = [
  "SHOT_GOAL",
  "SHOT_SAVED",
  "SHOT_MISSED",
  "TURNOVER",
  "FREE_THROW",
] as const;

/** The outcomes that hand the ball to the team that was defending. */
export const POSSESSION_CHANGING_OUTCOMES = ["SHOT_SAVED", "TURNOVER"] as const;

export function changesPossession(outcome: PossessionOutcome): boolean {
  return (POSSESSION_CHANGING_OUTCOMES as readonly string[]).includes(outcome);
}

/** Spatial/match context that the raw HandballState (players + ball + defense) does not itself carry. */
export type PossessionContext = {
  /** The team currently in possession. */
  readonly attackingTeam: TeamId;
  /** The goal that team is attacking; the defending team defends the opposite one. */
  readonly attackingGoalSide: AttackingGoalSide;
  readonly phase: PossessionPhase;
  /** Set only once the possession has finished. */
  readonly outcome: PossessionOutcome | null;
};

/**
 * The canonical full-court match state: the existing spatial HandballState
 * (positions, velocity, facing, intent, ball, defensive responsibility) plus
 * the possession context above. HandballState is composed rather than forked,
 * so the existing engine step, movement integration and 6:0 defensive policy
 * all keep operating on it unchanged.
 */
export type FullCourtMatchState = {
  readonly handball: HandballState;
  readonly possession: PossessionContext;
};

export const FULL_COURT_BOUNDS = CANONICAL_FULL_COURT_BOUNDS;

/** Centre of the goal on `side`, in canonical full-court metres. */
export function goalCentre(side: AttackingGoalSide): MeterPoint {
  return { x: CANONICAL_COURT_WIDTH_METERS / 2, y: side === "TOP" ? 0 : CANONICAL_COURT_LENGTH_METERS };
}

/** The goal the DEFENDING team protects when the attackers attack `side`. */
export function defendedGoalSide(attacking: AttackingGoalSide): AttackingGoalSide {
  return attacking;
}

/**
 * Which half a point sits in, by goal side. Used only for readable assertions
 * and traces -- the simulation itself never restricts play to one half.
 */
export function goalSideOfPoint(point: MeterPoint): AttackingGoalSide {
  return point.y <= CANONICAL_COURT_LENGTH_METERS / 2 ? "TOP" : "BOTTOM";
}

export function isTerminalPhase(phase: PossessionPhase): boolean {
  return phase === "COMPLETE";
}
