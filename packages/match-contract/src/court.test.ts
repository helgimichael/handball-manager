import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_COURT_WIDTH_METERS,
  CANONICAL_COURT_LENGTH_METERS,
  CANONICAL_HALF_COURT_HEIGHT_METERS,
  CANONICAL_GOAL_WIDTH_METERS,
  CANONICAL_GOAL_POST_LEFT_X,
  CANONICAL_GOAL_POST_RIGHT_X,
  CANONICAL_FULL_COURT_BOUNDS,
  CANONICAL_HALF_COURT_BOUNDS,
  canonicalBoundsForView,
  isWithinCanonicalBounds,
  mirrorYForOppositeGoalSide,
  oppositeGoalSide,
} from "./court";

// Test 1: canonical full-court dimensions.
// Verified against both migrated sources (HM-0.2D report Section 2 & 3):
// SIM's domain/geometry/court.ts COURT_WIDTH_METERS/COURT_LENGTH_METERS
// and FIELD's geometry/HandballCourtGeometry.ts COURT_WIDTH_METERS/
// COURT_LENGTH_METERS both independently equal 20 x 40 -- the real IHF
// handball court model.
test("canonical full-court dimensions match both SIM and FIELD (20m x 40m)", () => {
  assert.equal(CANONICAL_COURT_WIDTH_METERS, 20);
  assert.equal(CANONICAL_COURT_LENGTH_METERS, 40);
  assert.deepEqual(CANONICAL_FULL_COURT_BOUNDS, { minX: 0, minY: 0, maxX: 20, maxY: 40 });
});

// Test 2: canonical half-court dimensions.
// Both SIM's buildViewportForCourtView("HALF_COURT") and FIELD's
// buildViewportForCourtView("HALF_COURT") return { x:0, y:0, width:20,
// height:20 } -- half-court is a VIEWPORT change only in both systems,
// never a separate geometry model (FIELD's own HandballCourtGeometry.ts
// comment says this explicitly).
test("canonical half-court dimensions match both SIM and FIELD (20m x 20m, top goal)", () => {
  assert.equal(CANONICAL_HALF_COURT_HEIGHT_METERS, 20);
  assert.deepEqual(CANONICAL_HALF_COURT_BOUNDS, { minX: 0, minY: 0, maxX: 20, maxY: 20 });
  assert.deepEqual(canonicalBoundsForView("HALF_COURT"), CANONICAL_HALF_COURT_BOUNDS);
  assert.deepEqual(canonicalBoundsForView("FULL_COURT"), CANONICAL_FULL_COURT_BOUNDS);
});

test("canonical goal geometry matches both SIM and FIELD (3m wide, centered)", () => {
  assert.equal(CANONICAL_GOAL_WIDTH_METERS, 3);
  assert.equal(CANONICAL_GOAL_POST_LEFT_X, 8.5);
  assert.equal(CANONICAL_GOAL_POST_RIGHT_X, 11.5);
});

// Test 3: valid coordinate bounds.
test("isWithinCanonicalBounds accepts in-bounds and rejects out-of-bounds points", () => {
  assert.equal(isWithinCanonicalBounds({ x: 10, y: 20 }, CANONICAL_FULL_COURT_BOUNDS), true);
  assert.equal(isWithinCanonicalBounds({ x: 0, y: 0 }, CANONICAL_FULL_COURT_BOUNDS), true);
  assert.equal(isWithinCanonicalBounds({ x: 20, y: 40 }, CANONICAL_FULL_COURT_BOUNDS), true);
  assert.equal(isWithinCanonicalBounds({ x: -0.01, y: 10 }, CANONICAL_FULL_COURT_BOUNDS), false);
  assert.equal(isWithinCanonicalBounds({ x: 10, y: 40.01 }, CANONICAL_FULL_COURT_BOUNDS), false);
  // A half-court-only point (y=30) is valid on the full court but not
  // within the half-court viewport bounds -- confirms the two bounds
  // are genuinely different checks, not aliases of each other.
  assert.equal(isWithinCanonicalBounds({ x: 10, y: 30 }, CANONICAL_FULL_COURT_BOUNDS), true);
  assert.equal(isWithinCanonicalBounds({ x: 10, y: 30 }, CANONICAL_HALF_COURT_BOUNDS), false);
});

// Test 6: mirroring / attack-direction assumptions.
// Neither SIM's nor FIELD's default formation data currently needs this
// (see report Section 4 -- both attack the TOP goal by default), but the
// contract must support the BOTTOM-goal case for when a future scenario
// needs it, without either source system having to duplicate the math.
test("mirrorYForOppositeGoalSide reflects across the court midline and is its own inverse", () => {
  assert.equal(mirrorYForOppositeGoalSide(0), 40);
  assert.equal(mirrorYForOppositeGoalSide(40), 0);
  assert.equal(mirrorYForOppositeGoalSide(20), 20); // midline maps to itself
  // Known SIM/FIELD goalkeeper y (defence-6-0, see snapshot.test.ts) --
  // mirroring twice must return the original value exactly.
  const knownGoalkeeperY = 0.517817;
  const mirroredOnce = mirrorYForOppositeGoalSide(knownGoalkeeperY);
  const mirroredTwice = mirrorYForOppositeGoalSide(mirroredOnce);
  assert.ok(Math.abs(mirroredTwice - knownGoalkeeperY) < 1e-9);
});

test("oppositeGoalSide toggles TOP/BOTTOM and is its own inverse", () => {
  assert.equal(oppositeGoalSide("TOP"), "BOTTOM");
  assert.equal(oppositeGoalSide("BOTTOM"), "TOP");
  assert.equal(oppositeGoalSide(oppositeGoalSide("TOP")), "TOP");
});
