import type { Bounds, ViewportMeters } from "./coordinates";

export const COURT_WIDTH_METERS = 20;
export const COURT_LENGTH_METERS = 40;
export const GOAL_WIDTH_METERS = 3;
export const GOAL_POST_LEFT_X = (COURT_WIDTH_METERS - GOAL_WIDTH_METERS) / 2;
export const GOAL_POST_RIGHT_X = (COURT_WIDTH_METERS + GOAL_WIDTH_METERS) / 2;
export const GOAL_AREA_RADIUS_METERS = 6;
export const FREE_THROW_RADIUS_METERS = 9;
export const PENALTY_MARK_Y_METERS = 7;
export const GOALKEEPER_RESTRAINT_Y_METERS = 4;
export const CENTER_CIRCLE_RADIUS_METERS = 2;

export const COURT_BOUNDS_METERS: Bounds = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: COURT_WIDTH_METERS,
  maxY: COURT_LENGTH_METERS
});

export type CourtView = "HALF_COURT" | "FULL_COURT";

export function buildViewportForCourtView(courtView: CourtView): ViewportMeters {
  if (courtView === "HALF_COURT") {
    return { x: 0, y: 0, width: COURT_WIDTH_METERS, height: COURT_WIDTH_METERS };
  }

  return { x: 0, y: 0, width: COURT_WIDTH_METERS, height: COURT_LENGTH_METERS };
}

export type CourtLine =
  | { kind: "rect"; id: string; x: number; y: number; width: number; height: number; lineStyle?: "solid" | "dashed" | "thick" }
  | { kind: "line"; id: string; x1: number; y1: number; x2: number; y2: number; lineStyle?: "solid" | "dashed" | "thick" }
  | { kind: "circle"; id: string; cx: number; cy: number; r: number; lineStyle?: "solid" | "dashed" | "thick" }
  | { kind: "path"; id: string; d: string; lineStyle?: "solid" | "dashed" | "thick" };

export type CourtFill = {
  id: string;
  d: string;
  fillStyle: "goalArea";
};

function goalAreaArcPath(radius: number, goalY: number, direction: 1 | -1): string {
  const startX = GOAL_POST_LEFT_X - radius;
  const endX = GOAL_POST_RIGHT_X + radius;
  const straightY = goalY + direction * radius;
  const sweepFlag = direction === 1 ? 0 : 1;

  return [
    `M ${startX} ${goalY}`,
    `A ${radius} ${radius} 0 0 ${sweepFlag} ${GOAL_POST_LEFT_X} ${straightY}`,
    `L ${GOAL_POST_RIGHT_X} ${straightY}`,
    `A ${radius} ${radius} 0 0 ${sweepFlag} ${endX} ${goalY}`
  ].join(" ");
}

function goalAreaFillPath(radius: number, goalY: number, direction: 1 | -1): string {
  return `${goalAreaArcPath(radius, goalY, direction)} Z`;
}

export function buildCourtLines(): readonly CourtLine[] {
  return Object.freeze([
    { kind: "rect", id: "boundary", x: 0, y: 0, width: COURT_WIDTH_METERS, height: COURT_LENGTH_METERS },
    { kind: "line", id: "center-line-left", x1: 0, y1: 20, x2: 8, y2: 20 },
    { kind: "line", id: "center-line-right", x1: 12, y1: 20, x2: 20, y2: 20 },
    { kind: "circle", id: "center-circle", cx: 10, cy: 20, r: CENTER_CIRCLE_RADIUS_METERS },
    { kind: "line", id: "top-goal-line", x1: GOAL_POST_LEFT_X, y1: 0, x2: GOAL_POST_RIGHT_X, y2: 0, lineStyle: "thick" },
    {
      kind: "line",
      id: "bottom-goal-line",
      x1: GOAL_POST_LEFT_X,
      y1: COURT_LENGTH_METERS,
      x2: GOAL_POST_RIGHT_X,
      y2: COURT_LENGTH_METERS,
      lineStyle: "thick"
    },
    { kind: "path", id: "top-goal-area", d: goalAreaArcPath(GOAL_AREA_RADIUS_METERS, 0, 1) },
    {
      kind: "path",
      id: "bottom-goal-area",
      d: goalAreaArcPath(GOAL_AREA_RADIUS_METERS, COURT_LENGTH_METERS, -1)
    },
    { kind: "path", id: "top-free-throw", d: goalAreaArcPath(FREE_THROW_RADIUS_METERS, 0, 1), lineStyle: "dashed" },
    {
      kind: "path",
      id: "bottom-free-throw",
      d: goalAreaArcPath(FREE_THROW_RADIUS_METERS, COURT_LENGTH_METERS, -1),
      lineStyle: "dashed"
    },
    { kind: "line", id: "top-penalty-mark", x1: 9.5, y1: PENALTY_MARK_Y_METERS, x2: 10.5, y2: PENALTY_MARK_Y_METERS },
    {
      kind: "line",
      id: "bottom-penalty-mark",
      x1: 9.5,
      y1: COURT_LENGTH_METERS - PENALTY_MARK_Y_METERS,
      x2: 10.5,
      y2: COURT_LENGTH_METERS - PENALTY_MARK_Y_METERS
    },
    {
      kind: "line",
      id: "top-goalkeeper-restraint",
      x1: 9.25,
      y1: GOALKEEPER_RESTRAINT_Y_METERS,
      x2: 10.75,
      y2: GOALKEEPER_RESTRAINT_Y_METERS
    },
    {
      kind: "line",
      id: "bottom-goalkeeper-restraint",
      x1: 9.25,
      y1: COURT_LENGTH_METERS - GOALKEEPER_RESTRAINT_Y_METERS,
      x2: 10.75,
      y2: COURT_LENGTH_METERS - GOALKEEPER_RESTRAINT_Y_METERS
    }
  ]);
}

export function buildGoalAreaFills(): readonly CourtFill[] {
  return Object.freeze([
    { id: "top-goal-area-fill", d: goalAreaFillPath(GOAL_AREA_RADIUS_METERS, 0, 1), fillStyle: "goalArea" },
    {
      id: "bottom-goal-area-fill",
      d: goalAreaFillPath(GOAL_AREA_RADIUS_METERS, COURT_LENGTH_METERS, -1),
      fillStyle: "goalArea"
    }
  ]);
}
