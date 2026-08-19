/**
 * Canonical court coordinate convention for MatchRenderSnapshot.
 *
 * This is NOT a new invention -- it is the convention already shared,
 * independently, by both migrated systems (see HM-0.2D report Sections 2-4
 * for the audit evidence): SIM's domain/geometry/court.ts and FIELD's
 * geometry/HandballCourtGeometry.ts already agree on origin, axis
 * direction, units, and court/goal dimensions. This module names that
 * shared convention explicitly so the future adapter has one place to
 * point at, rather than re-deriving agreement from two separate source
 * trees every time.
 *
 * Origin (0,0) is the TOP-LEFT corner of the full court. x increases
 * right, y increases down. Units are meters. The TOP goal sits on the
 * line y = 0; the BOTTOM goal sits on the line y = CANONICAL_COURT_LENGTH_METERS.
 */

export const CANONICAL_COURT_WIDTH_METERS = 20;
export const CANONICAL_COURT_LENGTH_METERS = 40;
export const CANONICAL_HALF_COURT_HEIGHT_METERS = CANONICAL_COURT_WIDTH_METERS;

export const CANONICAL_GOAL_WIDTH_METERS = 3;
export const CANONICAL_GOAL_POST_LEFT_X = (CANONICAL_COURT_WIDTH_METERS - CANONICAL_GOAL_WIDTH_METERS) / 2;
export const CANONICAL_GOAL_POST_RIGHT_X = (CANONICAL_COURT_WIDTH_METERS + CANONICAL_GOAL_WIDTH_METERS) / 2;

export type CanonicalCourtView = "HALF_COURT" | "FULL_COURT";

/**
 * Which goal a snapshot's attacking team is driving toward. "TOP" means
 * the goal on the y = 0 line; "BOTTOM" means the goal on the
 * y = CANONICAL_COURT_LENGTH_METERS line. Named by court geometry, not by
 * "home"/"away", because the canonical convention has no notion of a
 * home team -- that belongs to a later manager-game layer, not this
 * contract.
 */
export type CanonicalGoalSide = "TOP" | "BOTTOM";

export type CanonicalBounds = {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
};

export const CANONICAL_FULL_COURT_BOUNDS: CanonicalBounds = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: CANONICAL_COURT_WIDTH_METERS,
  maxY: CANONICAL_COURT_LENGTH_METERS,
});

export const CANONICAL_HALF_COURT_BOUNDS: CanonicalBounds = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: CANONICAL_COURT_WIDTH_METERS,
  maxY: CANONICAL_HALF_COURT_HEIGHT_METERS,
});

export function canonicalBoundsForView(view: CanonicalCourtView): CanonicalBounds {
  return view === "HALF_COURT" ? CANONICAL_HALF_COURT_BOUNDS : CANONICAL_FULL_COURT_BOUNDS;
}

export function isWithinCanonicalBounds(point: { x: number; y: number }, bounds: CanonicalBounds): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

/**
 * Mirrors a y coordinate across the court's horizontal midline
 * (y = CANONICAL_COURT_LENGTH_METERS / 2), turning a position measured
 * relative to one goal into the equivalent position relative to the
 * other. Neither SIM's nor FIELD's default formation data needs this
 * today (both default to attacking the TOP goal, y = 0 -- see the
 * HM-0.2D report's Section 4 comparison matrix), but a future scenario
 * that has a team defending the BOTTOM goal will need it, and it belongs
 * to the neutral contract's coordinate math rather than being
 * reimplemented separately by SIM and FIELD adapters.
 */
export function mirrorYForOppositeGoalSide(y: number): number {
  return CANONICAL_COURT_LENGTH_METERS - y;
}

export function oppositeGoalSide(side: CanonicalGoalSide): CanonicalGoalSide {
  return side === "TOP" ? "BOTTOM" : "TOP";
}
