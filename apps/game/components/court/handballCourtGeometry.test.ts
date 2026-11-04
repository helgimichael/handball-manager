import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COURT_WIDTH_METERS,
  HALF_COURT_LENGTH_METERS,
  FULL_COURT_LENGTH_METERS,
  GOAL_WIDTH_METERS,
  GOAL_POST_LEFT_X,
  GOAL_POST_RIGHT_X,
  GOAL_AREA_RADIUS_METERS,
  FREE_THROW_RADIUS_METERS,
  PENALTY_LINE_DISTANCE_METERS,
  PENALTY_LINE_LENGTH_METERS,
  GOALKEEPER_RESTRAINT_LINE_DISTANCE_METERS,
  GOALKEEPER_RESTRAINT_LINE_LENGTH_METERS,
  CENTER_CIRCLE_RADIUS_METERS,
  SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS,
  SUBSTITUTION_LINE_INSIDE_METERS,
  SUBSTITUTION_LINE_OUTSIDE_METERS,
  getHalfCourtGeometry,
  goalAreaArcPath,
} from './HandballCourtGeometry';

describe('Handball Court Geometry (IHF / SHF Official Specifications)', () => {
  it('has exact 1:1 aspect ratio for 20m x 20m half-court', () => {
    const geo = getHalfCourtGeometry();
    assert.equal(COURT_WIDTH_METERS, 20);
    assert.equal(HALF_COURT_LENGTH_METERS, 20);
    assert.equal(geo.aspectRatio, 1.0);
    assert.equal(geo.widthMeters, 20);
    assert.equal(geo.heightMeters, 20);
    assert.deepEqual(geo.boundary, { x: 0, y: 0, width: 20, height: 20 });
  });

  it('has 3.0m goal centrally positioned between x = 8.5m and 11.5m', () => {
    const geo = getHalfCourtGeometry();
    assert.equal(GOAL_WIDTH_METERS, 3);
    assert.equal(GOAL_POST_LEFT_X, 8.5);
    assert.equal(GOAL_POST_RIGHT_X, 11.5);
    assert.equal(GOAL_POST_RIGHT_X - GOAL_POST_LEFT_X, 3.0);
    assert.equal((COURT_WIDTH_METERS - GOAL_WIDTH_METERS) / 2, 8.5);

    assert.equal(geo.goalLine.x1, 8.5);
    assert.equal(geo.goalLine.x2, 11.5);
    assert.equal(geo.goalLine.y1, 0);
    assert.equal(geo.goalLine.y2, 0);
  });

  it('constructs 6.0m goal area with 6m radius quarter arcs and 3m apex line', () => {
    const geo = getHalfCourtGeometry();
    assert.equal(GOAL_AREA_RADIUS_METERS, 6);

    // Left post is at 8.5, right post at 11.5
    // Left arc starts on goal line at x = 8.5 - 6 = 2.5, y = 0
    // Straight apex segment runs between (8.5, 6) and (11.5, 6)
    // Right arc ends on goal line at x = 11.5 + 6 = 17.5, y = 0
    const expectedPath = 'M 2.5 0 A 6 6 0 0 0 8.5 6 L 11.5 6 A 6 6 0 0 0 17.5 0';
    assert.equal(geo.goalAreaLine, expectedPath);
    assert.equal(geo.goalAreaFill, `${expectedPath} Z`);
  });

  it('constructs 9.0m free throw line with 9m radius arcs and 3m apex line at y = 9m', () => {
    const geo = getHalfCourtGeometry();
    assert.equal(FREE_THROW_RADIUS_METERS, 9);

    // Left arc starts at x = 8.5 - 9 = -0.5, y = 0
    // Straight apex segment runs between (8.5, 9) and (11.5, 9) at distance 9m
    // Right arc ends at x = 11.5 + 9 = 20.5, y = 0
    const expectedPath = 'M -0.5 0 A 9 9 0 0 0 8.5 9 L 11.5 9 A 9 9 0 0 0 20.5 0';
    assert.equal(geo.freeThrowLine, expectedPath);

    // Mathematical verification: 9m radius circle from (8.5, 0)
    // At x = 0 (sideline), y^2 + (0 - 8.5)^2 = 9^2 -> y^2 + 72.25 = 81 -> y = sqrt(8.75) ≈ 2.958m
    const yAtSideline = Math.sqrt(9 * 9 - 8.5 * 8.5);
    assert.ok(Math.abs(yAtSideline - 2.958) < 0.001);
  });

  it('places 7.0m penalty line at distance 7m with length 1.0m centered at x = 10m', () => {
    const geo = getHalfCourtGeometry();
    assert.equal(PENALTY_LINE_DISTANCE_METERS, 7);
    assert.equal(PENALTY_LINE_LENGTH_METERS, 1);

    assert.equal(geo.penaltyLine.y1, 7);
    assert.equal(geo.penaltyLine.y2, 7);
    assert.equal(geo.penaltyLine.x1, 9.5);
    assert.equal(geo.penaltyLine.x2, 10.5);
    assert.equal(geo.penaltyLine.x2 - geo.penaltyLine.x1, 1.0);
  });

  it('places 4.0m goalkeeper restraint line at distance 4m centered at x = 10m', () => {
    const geo = getHalfCourtGeometry();
    assert.equal(GOALKEEPER_RESTRAINT_LINE_DISTANCE_METERS, 4);
    assert.equal(GOALKEEPER_RESTRAINT_LINE_LENGTH_METERS, 1);

    assert.equal(geo.goalkeeperRestraintLine.y1, 4);
    assert.equal(geo.goalkeeperRestraintLine.y2, 4);
    assert.equal(geo.goalkeeperRestraintLine.x1, 9.5);
    assert.equal(geo.goalkeeperRestraintLine.x2, 10.5);
  });

  it('positions substitution line 4.5m from halfway line on sideline', () => {
    const geo = getHalfCourtGeometry();
    assert.equal(SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS, 4.5);
    // Halfway is at y = 20m, so substitution mark is at y = 15.5m
    assert.equal(geo.substitutionMark.y1, 15.5);
    assert.equal(geo.substitutionMark.y2, 15.5);
    assert.equal(geo.substitutionMark.x1, -SUBSTITUTION_LINE_OUTSIDE_METERS);
    assert.equal(geo.substitutionMark.x2, SUBSTITUTION_LINE_INSIDE_METERS);
    assert.equal(geo.substitutionMark.x2 - geo.substitutionMark.x1, 0.30);
  });

  it('places center throw-off circle with diameter 4.0m (radius 2.0m) at halfway line', () => {
    const geo = getHalfCourtGeometry();
    assert.equal(CENTER_CIRCLE_RADIUS_METERS, 2);
    // Halfway line segments break for the center circle (centerX = 10, radius = 2 -> [0, 8] and [12, 20])
    assert.deepEqual(geo.halfwayLineSegments[0], { x1: 0, y1: 20, x2: 8, y2: 20 });
    assert.deepEqual(geo.halfwayLineSegments[1], { x1: 12, y1: 20, x2: 20, y2: 20 });
    assert.equal(geo.centerCircleArc, 'M 8 20 A 2 2 0 0 1 12 20');
  });

  it('supports bottom goal orientation for full court simulations', () => {
    // Bottom goal at y = 40, direction = -1
    const bottom6m = goalAreaArcPath(6, FULL_COURT_LENGTH_METERS, -1);
    assert.equal(bottom6m, 'M 2.5 40 A 6 6 0 0 1 8.5 34 L 11.5 34 A 6 6 0 0 1 17.5 40');
  });
});
