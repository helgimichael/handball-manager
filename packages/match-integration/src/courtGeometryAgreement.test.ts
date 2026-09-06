// MATCH-EXPERIENCE-2.0 M1: FIELD and the match engine must agree on what a
// handball court is.
//
// Three modules describe the same court: FIELD's
// match-renderer/.../HandballCourtGeometry.ts (the tactics board), SIM's
// handball-engine/domain/geometry/court.ts (the simulation), and the neutral
// @handball-manager/match-contract (the shared convention both already
// followed). M1 does not redesign FIELD and does not import a UI module into
// the engine -- it pins the agreement instead, here in the one package that
// legitimately depends on all three.
//
// If this test ever fails, the renderer and the simulation are drawing two
// different sports and any 2D presentation built on top is lying about where
// the players are.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_COURT_LENGTH_METERS,
  CANONICAL_COURT_WIDTH_METERS,
  CANONICAL_GOAL_POST_LEFT_X,
  CANONICAL_GOAL_POST_RIGHT_X,
  CANONICAL_GOAL_WIDTH_METERS,
  CANONICAL_FULL_COURT_BOUNDS,
  mirrorYForOppositeGoalSide,
} from "@handball-manager/match-contract";
import {
  COURT_LENGTH_METERS as SIM_COURT_LENGTH,
  COURT_WIDTH_METERS as SIM_COURT_WIDTH,
  GOAL_WIDTH_METERS as SIM_GOAL_WIDTH,
  GOAL_POST_LEFT_X as SIM_GOAL_POST_LEFT,
  GOAL_POST_RIGHT_X as SIM_GOAL_POST_RIGHT,
  COURT_BOUNDS_METERS as SIM_BOUNDS,
} from "@handball-manager/handball-engine/src/domain/geometry/court.ts";
import {
  COURT_LENGTH_METERS as FIELD_COURT_LENGTH,
  COURT_WIDTH_METERS as FIELD_COURT_WIDTH,
} from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/geometry/HandballCourtGeometry.ts";

test("FIELD, SIM and the canonical contract describe the same full court", () => {
  assert.equal(FIELD_COURT_WIDTH, CANONICAL_COURT_WIDTH_METERS, "FIELD court width");
  assert.equal(FIELD_COURT_LENGTH, CANONICAL_COURT_LENGTH_METERS, "FIELD court length");
  assert.equal(SIM_COURT_WIDTH, CANONICAL_COURT_WIDTH_METERS, "SIM court width");
  assert.equal(SIM_COURT_LENGTH, CANONICAL_COURT_LENGTH_METERS, "SIM court length");
  assert.equal(FIELD_COURT_WIDTH, SIM_COURT_WIDTH, "FIELD and SIM agree on width");
  assert.equal(FIELD_COURT_LENGTH, SIM_COURT_LENGTH, "FIELD and SIM agree on length");
});

test("goal geometry agrees between SIM and the canonical contract", () => {
  assert.equal(SIM_GOAL_WIDTH, CANONICAL_GOAL_WIDTH_METERS);
  assert.equal(SIM_GOAL_POST_LEFT, CANONICAL_GOAL_POST_LEFT_X);
  assert.equal(SIM_GOAL_POST_RIGHT, CANONICAL_GOAL_POST_RIGHT_X);
});

test("the simulation's enforced bounds are the FULL court, not a half", () => {
  assert.deepEqual(
    { minX: SIM_BOUNDS.minX, minY: SIM_BOUNDS.minY, maxX: SIM_BOUNDS.maxX, maxY: SIM_BOUNDS.maxY },
    CANONICAL_FULL_COURT_BOUNDS,
  );
});

test("mirroring to the opposite goal is the contract's own operation", () => {
  // The match engine positions a 6v6 at either end using exactly this; a local
  // `40 - y` in the engine would be a second source of truth.
  assert.equal(mirrorYForOppositeGoalSide(0), CANONICAL_COURT_LENGTH_METERS);
  assert.equal(mirrorYForOppositeGoalSide(CANONICAL_COURT_LENGTH_METERS), 0);
  assert.equal(mirrorYForOppositeGoalSide(6), CANONICAL_COURT_LENGTH_METERS - 6);
  assert.equal(mirrorYForOppositeGoalSide(mirrorYForOppositeGoalSide(13.5)), 13.5);
});
