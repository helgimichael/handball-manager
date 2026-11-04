/**
 * Reusable IHF / SHF Official Handball Court Geometry
 *
 * All coordinates in METERS.
 * Half-court: 20m wide x 20m long (1:1 aspect ratio). Origin (0,0) at top-left.
 * Top goal at y = 0, center line at y = 20.
 * Full-court: 20m wide x 40m long.
 *
 * Official measurements according to IHF Rules of the Game:
 * - Goal width: 3.0 m (between inner posts: x = 8.5 to 11.5 m)
 * - 6m goal area: two quarter-circle arcs of radius 6.0 m centered on inner goalposts,
 *   connected by a 3.0 m straight segment parallel to goal line at y = 6.0 m.
 * - 9m free-throw line: dashed line with two quarter-circle arcs of radius 9.0 m
 *   centered on inner goalposts, connected by a 3.0 m straight line at y = 9.0 m.
 * - 7m penalty line: 1.0 m long line, 7.0 m directly in front of the center of the goal (x = 9.5 to 10.5 m).
 * - 4m goalkeeper restraint line: 1.0 m marker at 4.0 m from the goal line (x = 9.5 to 10.5 m).
 * - Substitution line: 4.5 m from center line along the sideline.
 * - Center circle: 4.0 m diameter (radius 2.0 m).
 */

export const COURT_WIDTH_METERS = 20;
export const HALF_COURT_LENGTH_METERS = 20;
export const FULL_COURT_LENGTH_METERS = 40;

export const GOAL_WIDTH_METERS = 3;
export const GOAL_POST_LEFT_X = (COURT_WIDTH_METERS - GOAL_WIDTH_METERS) / 2; // 8.5
export const GOAL_POST_RIGHT_X = GOAL_POST_LEFT_X + GOAL_WIDTH_METERS; // 11.5

export const GOAL_AREA_RADIUS_METERS = 6;
export const FREE_THROW_RADIUS_METERS = 9;
export const PENALTY_LINE_DISTANCE_METERS = 7;
export const PENALTY_LINE_LENGTH_METERS = 1;
export const GOALKEEPER_RESTRAINT_LINE_DISTANCE_METERS = 4;
export const GOALKEEPER_RESTRAINT_LINE_LENGTH_METERS = 1;

export const CENTER_CIRCLE_RADIUS_METERS = 2;
export const SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS = 4.5;
export const SUBSTITUTION_LINE_INSIDE_METERS = 0.15;
export const SUBSTITUTION_LINE_OUTSIDE_METERS = 0.15;

export const GOAL_POST_TICK_DEPTH_METERS = 0.18;
export const GOAL_NET_DEPTH_METERS = 0.8;
export const GOAL_NET_HATCH_COUNT = 5;

/**
 * Generates the SVG path string for the standard IHF goal-area (6m) or free-throw (9m) line.
 * Two quarter-circle arcs of radius `radius` centered on the goal posts, joined by a 3m straight line.
 *
 * @param radius Radius in meters (6 or 9)
 * @param goalY Y coordinate of the goal line (0 for top, 40 for bottom)
 * @param direction 1 if court extends downwards from goal (+y), -1 if court extends upwards (-y)
 */
export function goalAreaArcPath(radius: number, goalY: number = 0, direction: 1 | -1 = 1): string {
  const sweep = direction === 1 ? 0 : 1;
  const straightY = goalY + direction * radius;
  const startX = GOAL_POST_LEFT_X - radius;
  const endX = GOAL_POST_RIGHT_X + radius;

  return [
    `M ${startX} ${goalY}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${GOAL_POST_LEFT_X} ${straightY}`,
    `L ${GOAL_POST_RIGHT_X} ${straightY}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${endX} ${goalY}`,
  ].join(' ');
}

/**
 * Returns closed SVG path string for the 6m goal area fill.
 */
export function goalAreaFillPath(radius: number = GOAL_AREA_RADIUS_METERS, goalY: number = 0, direction: 1 | -1 = 1): string {
  return `${goalAreaArcPath(radius, goalY, direction)} Z`;
}

export interface HalfCourtGeometry {
  viewBox: string;
  widthMeters: number;
  heightMeters: number;
  aspectRatio: number;
  boundary: { x: number; y: number; width: number; height: number };
  goalLine: { x1: number; y1: number; x2: number; y2: number };
  goalPosts: readonly [
    { x1: number; y1: number; x2: number; y2: number },
    { x1: number; y1: number; x2: number; y2: number },
  ];
  goalNet: {
    backRect: { x: number; y: number; width: number; height: number };
    hatches: readonly { x1: number; y1: number; x2: number; y2: number }[];
  };
  goalAreaFill: string;
  goalAreaLine: string;
  freeThrowLine: string;
  penaltyLine: { x1: number; y1: number; x2: number; y2: number };
  goalkeeperRestraintLine: { x1: number; y1: number; x2: number; y2: number };
  halfwayLineSegments: readonly [
    { x1: number; y1: number; x2: number; y2: number },
    { x1: number; y1: number; x2: number; y2: number },
  ];
  centerCircleArc: string;
  substitutionMark: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Returns authoritative mathematical descriptors for a 20x20m half-court (goal at y=0, center line at y=20).
 */
export function getHalfCourtGeometry(): HalfCourtGeometry {
  const goalY = 0;
  const direction: 1 | -1 = 1;
  const halfwayY = HALF_COURT_LENGTH_METERS;
  const centerX = COURT_WIDTH_METERS / 2;

  const hatches = [];
  for (let i = 0; i < GOAL_NET_HATCH_COUNT; i++) {
    const x = GOAL_POST_LEFT_X + (GOAL_WIDTH_METERS / (GOAL_NET_HATCH_COUNT - 1)) * i;
    hatches.push({
      x1: x,
      y1: goalY,
      x2: x - direction * GOAL_NET_DEPTH_METERS * 0.4,
      y2: goalY - direction * GOAL_NET_DEPTH_METERS,
    });
  }

  return {
    viewBox: `0 0 ${COURT_WIDTH_METERS} ${HALF_COURT_LENGTH_METERS}`,
    widthMeters: COURT_WIDTH_METERS,
    heightMeters: HALF_COURT_LENGTH_METERS,
    aspectRatio: COURT_WIDTH_METERS / HALF_COURT_LENGTH_METERS, // exactly 1.0 (1:1)
    boundary: { x: 0, y: 0, width: COURT_WIDTH_METERS, height: HALF_COURT_LENGTH_METERS },
    goalLine: { x1: GOAL_POST_LEFT_X, y1: goalY, x2: GOAL_POST_RIGHT_X, y2: goalY },
    goalPosts: [
      { x1: GOAL_POST_LEFT_X, y1: goalY, x2: GOAL_POST_LEFT_X, y2: goalY + direction * GOAL_POST_TICK_DEPTH_METERS },
      { x1: GOAL_POST_RIGHT_X, y1: goalY, x2: GOAL_POST_RIGHT_X, y2: goalY + direction * GOAL_POST_TICK_DEPTH_METERS },
    ],
    goalNet: {
      backRect: {
        x: GOAL_POST_LEFT_X,
        y: goalY - GOAL_NET_DEPTH_METERS,
        width: GOAL_WIDTH_METERS,
        height: GOAL_NET_DEPTH_METERS,
      },
      hatches,
    },
    goalAreaFill: goalAreaFillPath(GOAL_AREA_RADIUS_METERS, goalY, direction),
    goalAreaLine: goalAreaArcPath(GOAL_AREA_RADIUS_METERS, goalY, direction),
    freeThrowLine: goalAreaArcPath(FREE_THROW_RADIUS_METERS, goalY, direction),
    penaltyLine: {
      x1: (COURT_WIDTH_METERS - PENALTY_LINE_LENGTH_METERS) / 2,
      y1: goalY + direction * PENALTY_LINE_DISTANCE_METERS,
      x2: (COURT_WIDTH_METERS + PENALTY_LINE_LENGTH_METERS) / 2,
      y2: goalY + direction * PENALTY_LINE_DISTANCE_METERS,
    },
    goalkeeperRestraintLine: {
      x1: (COURT_WIDTH_METERS - GOALKEEPER_RESTRAINT_LINE_LENGTH_METERS) / 2,
      y1: goalY + direction * GOALKEEPER_RESTRAINT_LINE_DISTANCE_METERS,
      x2: (COURT_WIDTH_METERS + GOALKEEPER_RESTRAINT_LINE_LENGTH_METERS) / 2,
      y2: goalY + direction * GOALKEEPER_RESTRAINT_LINE_DISTANCE_METERS,
    },
    halfwayLineSegments: [
      { x1: 0, y1: halfwayY, x2: centerX - CENTER_CIRCLE_RADIUS_METERS, y2: halfwayY },
      { x1: centerX + CENTER_CIRCLE_RADIUS_METERS, y1: halfwayY, x2: COURT_WIDTH_METERS, y2: halfwayY },
    ],
    // In half court, the top half of the center circle enters the viewport from y=20
    centerCircleArc: `M ${centerX - CENTER_CIRCLE_RADIUS_METERS} ${halfwayY} A ${CENTER_CIRCLE_RADIUS_METERS} ${CENTER_CIRCLE_RADIUS_METERS} 0 0 1 ${centerX + CENTER_CIRCLE_RADIUS_METERS} ${halfwayY}`,
    substitutionMark: {
      x1: -SUBSTITUTION_LINE_OUTSIDE_METERS,
      y1: halfwayY - SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS,
      x2: SUBSTITUTION_LINE_INSIDE_METERS,
      y2: halfwayY - SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS,
    },
  };
}

