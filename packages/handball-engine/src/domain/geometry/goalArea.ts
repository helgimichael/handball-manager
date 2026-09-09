// HUMAN QA FIX 2A: the goal area, as a region rather than as a drawing.
//
// `court.ts` has always known how to DRAW the D -- two quarter circles around
// the posts joined by a straight line -- but nothing in the engine could ask
// whether a point was inside it, so every caller that needed to know either
// guessed with `y >= 6` or copied a predicate into a test file. That is what
// let a breaking carrier be ordered at the goal centre and shoot from two
// metres out, standing in the area, and it is why the 3:2:1 base once sat
// inside the D.
//
// The shape is exact and stated once: the D is every point within
// GOAL_AREA_RADIUS_METERS of the GOAL LINE SEGMENT between the posts. That
// single sentence produces both quarter circles and the straight part, and it
// is the same region `goalAreaArcPath` draws.

import { GOAL_AREA_RADIUS_METERS, GOAL_POST_LEFT_X, GOAL_POST_RIGHT_X, COURT_LENGTH_METERS } from "./court";
import { distanceBetween, type MeterPoint } from "./coordinates";

/** Which goal an area belongs to, in the canonical full-court frame. */
export type GoalAreaSide = "TOP" | "BOTTOM";

/** The y of a goal line: the top goal is at 0, the bottom at the far end. */
export function goalLineY(side: GoalAreaSide): number {
  return side === "TOP" ? 0 : COURT_LENGTH_METERS;
}

/** Distance from a point to the segment a-b. */
function distanceToSegment(point: MeterPoint, a: MeterPoint, b: MeterPoint): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return distanceBetween(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / len2));
  return Math.hypot(point.x - (a.x + abx * t), point.y - (a.y + aby * t));
}

/**
 * How far a point is from the goal-area LINE: positive outside, negative
 * inside, zero on it.
 *
 * The whole module is built on this one number. It is a genuine signed
 * distance to a convex region, which is what makes "the latest legal point on
 * this path" solvable rather than sampled.
 */
export function goalAreaClearance(point: MeterPoint, side: GoalAreaSide): number {
  const goalY = goalLineY(side);
  const toGoalLine = distanceToSegment(point, { x: GOAL_POST_LEFT_X, y: goalY }, { x: GOAL_POST_RIGHT_X, y: goalY });
  return toGoalLine - GOAL_AREA_RADIUS_METERS;
}

/**
 * How far outside the line a computed legal point is placed.
 *
 * A point ON the line is legal by rule, but a point computed to be exactly on
 * it lands a floating-point hair either side of it, and half the time that hair
 * is inside. It also has to survive being used as a MOVE target: a player
 * ordered to a point arrives within the movement model's own tolerance of it,
 * and with a hair's margin that tolerance put him back a few millimetres inside
 * -- which is how the last thirty-nine frames of an outfield carrier in the
 * goal area were made. Five centimetres is nothing in handball, is smaller than
 * the player it positions, and leaves every point this module returns outside
 * the line when it is measured again.
 */
export const GOAL_AREA_MARGIN_METERS = 0.05;

/** Is this point inside the goal area at `side`? The line itself is legal. */
export function insideGoalArea(point: MeterPoint, side: GoalAreaSide): boolean {
  return goalAreaClearance(point, side) < 0;
}

/** Is this point inside EITHER goal area? */
export function insideAnyGoalArea(point: MeterPoint): boolean {
  return insideGoalArea(point, "TOP") || insideGoalArea(point, "BOTTOM");
}

/** The goal area a point is inside, if it is inside one. */
export function goalAreaContaining(point: MeterPoint): GoalAreaSide | null {
  if (insideGoalArea(point, "TOP")) return "TOP";
  if (insideGoalArea(point, "BOTTOM")) return "BOTTOM";
  return null;
}

/**
 * The nearest point on or outside the goal-area line.
 *
 * Radially outward from the nearest point of the goal line, which for a convex
 * offset region is the true nearest legal point. Used only as a safety net: a
 * player who is somehow already inside with the ball has to let it go from
 * somewhere legal, and this is the closest such place.
 */
export function nearestLegalPoint(point: MeterPoint, side: GoalAreaSide): MeterPoint {
  const clearance = goalAreaClearance(point, side);
  if (clearance >= 0) return { ...point };
  const goalY = goalLineY(side);
  const anchor: MeterPoint = { x: Math.min(GOAL_POST_RIGHT_X, Math.max(GOAL_POST_LEFT_X, point.x)), y: goalY };
  const dx = point.x - anchor.x;
  const dy = point.y - anchor.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-9) {
    // Standing exactly on the goal line between the posts: there is no outward
    // direction, so step straight out along the court.
    const out = GOAL_AREA_RADIUS_METERS + GOAL_AREA_MARGIN_METERS;
    return { x: point.x, y: goalY + (side === "TOP" ? out : -out) };
  }
  const scale = (GOAL_AREA_RADIUS_METERS + GOAL_AREA_MARGIN_METERS) / length;
  return { x: anchor.x + dx * scale, y: anchor.y + dy * scale };
}

/**
 * The last point on the path `from -> to` that is still legal.
 *
 * `from` must be legal. Returns `to` when the path never enters the area, so a
 * caller can use this unconditionally as "where I am allowed to run to".
 *
 * The clearance is convex along a straight line, so the crossing is a single
 * root and bisection finds it to within a millimetre in twenty steps. The
 * result is nudged back onto the legal side, because a point ON the line is
 * legal by rule but a floating-point hair past it is not.
 */
export function latestLegalPointOnPath(from: MeterPoint, to: MeterPoint, side: GoalAreaSide): MeterPoint {
  if (goalAreaClearance(to, side) >= 0) return { ...to };
  const at = (t: number): MeterPoint => ({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  if (goalAreaClearance(from, side) < 0) return { ...from };
  let legal = 0;
  let illegal = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (legal + illegal) / 2;
    if (goalAreaClearance(at(mid), side) >= 0) legal = mid;
    else illegal = mid;
  }
  return at(legal);
}
