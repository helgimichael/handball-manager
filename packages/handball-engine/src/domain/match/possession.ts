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
 * The minimum phase vocabulary M1 needs. Deliberately not the whole future
 * system: first wave, second wave, early offense and defensive retreat are
 * transition phases that arrive later. They can be added as further members
 * WITHOUT replacing the full-court spatial state, which is the property that
 * matters -- the state is already court-wide, so a transition phase is new
 * behaviour over the same coordinates, never a new world.
 */
export const POSSESSION_PHASES = [
  "ORGANIZED_SETUP",
  "CIRCULATION",
  "ATTACK_ACTION",
  "RESOLUTION",
  "DEAD_BALL",
  "COMPLETE",
] as const;
export type PossessionPhase = (typeof POSSESSION_PHASES)[number];

/** The terminal results M1 supports. 7m, suspensions and waves are explicitly out of scope. */
export const POSSESSION_OUTCOMES = ["SHOT_GOAL", "SHOT_SAVED", "SHOT_MISSED", "TURNOVER", "FREE_THROW"] as const;
export type PossessionOutcome = (typeof POSSESSION_OUTCOMES)[number];

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
