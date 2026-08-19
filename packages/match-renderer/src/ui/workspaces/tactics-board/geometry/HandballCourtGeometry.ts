/**
 * Handball Court layer -- the plan's OFFICIAL geometry (IHF court/line
 * dimensions), defensive zones and transition zones. Owns every
 * handball-specific number; the Geometry layer (CourtTransform.ts) never
 * sees any of this. This module must never know about coach-facing
 * concepts either (V9, M6, 6:0, spelstarter, AI, övningsdesign) -- see the
 * Taktiktavla architecture boundary.
 *
 * All measurements are in METERS. Origin (0,0) is the TOP-LEFT corner; x
 * increases right, y increases down. Goal at y=0 is the "top" goal, goal
 * at y=COURT_LENGTH_METERS is the "bottom" goal.
 */

import type { Bounds, MeterPoint, ViewportMeters } from "./CourtTransform.ts";
import {
  addPoints,
  clampToBounds,
  dotProduct,
  mirrorPointAcrossHorizontalLine,
  mirrorPointAcrossVerticalLine,
  mirrorRotationAcrossHorizontalLine,
  mirrorRotationAcrossVerticalLine,
  normalizeVector,
  scalePoint,
  subtractPoints,
  vectorLength,
} from "./CourtTransform.ts";

export const COURT_WIDTH_METERS = 20;
export const COURT_LENGTH_METERS = 40;

export const COURT_BOUNDS_METERS: Bounds = Object.freeze({
  minX: 0,
  minY: 0,
  maxX: COURT_WIDTH_METERS,
  maxY: COURT_LENGTH_METERS,
});

export type CourtView = "HALF_COURT" | "FULL_COURT";

// Half-court shows the TOP goal (per "Halvplanen ska ha målet upptill").
// Both viewports share the exact same 0..20 x-range as the full model --
// half-court is a VIEWPORT change only, never a separate geometry model.
export function buildViewportForCourtView(courtView: CourtView): ViewportMeters {
  if (courtView === "HALF_COURT") {
    return { x: 0, y: 0, width: COURT_WIDTH_METERS, height: COURT_WIDTH_METERS };
  }
  return { x: 0, y: 0, width: COURT_WIDTH_METERS, height: COURT_LENGTH_METERS };
}

// -- Official line dimensions (standard IHF handball court geometry) --
const GOAL_WIDTH_METERS = 3;
const GOAL_POST_LEFT_X = (COURT_WIDTH_METERS - GOAL_WIDTH_METERS) / 2; // 8.5
const GOAL_POST_RIGHT_X = GOAL_POST_LEFT_X + GOAL_WIDTH_METERS; // 11.5

const GOAL_AREA_RADIUS_METERS = 6; // "målgårdslinje" / 6 m line
const FREE_THROW_RADIUS_METERS = 9; // "frikastlinje" / 9 m line
const PENALTY_LINE_DISTANCE_METERS = 7; // "straffkastlinje" / 7 m line
const PENALTY_LINE_LENGTH_METERS = 1;
const GOALKEEPER_RESTRAINT_LINE_DISTANCE_METERS = 4; // "målvaktens begränsningslinje" / 4 m line
// Official minimum is 0.15 m -- rendered wider (1 m) purely so the line is
// visible at board scale; this is a rendering choice, not a geometry claim.
const GOALKEEPER_RESTRAINT_LINE_LENGTH_METERS = 1;

// Official IHF center throw-off circle (IHF Rules of the Game, Diagram
// 1b): 4 m diameter, i.e. 2 m radius, centered on the court's exact
// center point (x=10 m, y=20 m on the full 20x40 m model). The halfway
// line stops at the circle's edge on both sides and does not pass
// through it, matching Diagram 1b exactly.
const CENTER_CIRCLE_RADIUS_METERS = 2;

// Official IHF substitution line ("avbytarlinje" / "utväxlingslinje"),
// IHF Rules of the Game Diagram 1b: exactly two marks, both on the SAME
// long side (sideline) -- never mirrored onto the opposite sideline --
// one 4.5 m on each side of the halfway line, each mark 15 cm inside the
// court plus 15 cm outside the sideline (30 cm total), parallel to the
// halfway line. Fixed on the LEFT sideline (x=0); no geometry choice here
// is approximated -- every number is the official measurement.
const SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS = 4.5;
const SUBSTITUTION_LINE_INSIDE_METERS = 0.15;
const SUBSTITUTION_LINE_OUTSIDE_METERS = 0.15;

// Goal posts (stylized): a short perpendicular tick at each post,
// entering the court from the goal line, giving the crossbar (the
// existing thick goal-${side} line) a visible "post" at each end instead
// of reading as a single flat stroke.
const GOAL_POST_TICK_DEPTH_METERS = 0.18;

// Goal net (stylized, top-down "depth" cue): a shallow tinted rectangle
// BEHIND the goal line (outside the court bounds), the same width as the
// goal, plus a few diagonal hatch strokes to suggest netting -- never
// photorealistic, just enough for the goal to read as a goal rather than
// a plain line.
const GOAL_NET_DEPTH_METERS = 0.8;
const GOAL_NET_HATCH_COUNT = 5;

export type CourtLine =
  | { kind: "rect"; id: string; x: number; y: number; width: number; height: number }
  | {
      kind: "line";
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      dashed?: boolean;
      thick?: boolean;
      hatch?: boolean;
    }
  | { kind: "path"; id: string; d: string; dashed?: boolean };

export type CourtFill = { kind: "path"; id: string; d: string };

// The goal-area (6 m) and free-throw (9 m) lines share the same standard
// IHF construction: two quarter-circle arcs of the given radius, centered
// on each goalpost, connected by a straight segment parallel to the goal
// line. No corner arcs or decorative geometry are added -- where the 9 m
// arcs mathematically extend beyond the court's own side lines (radius 9 m
// exceeds the ~8.5 m post-to-sideline distance), the SVG viewBox's own
// default clipping (never a hand-crafted clip path) hides the excess,
// exactly as real courts show it.
function goalAreaArcPath(radius: number, goalY: number, direction: 1 | -1): string {
  const sweep = direction === 1 ? 0 : 1;
  const straightY = goalY + direction * radius;
  const startX = GOAL_POST_LEFT_X - radius;
  const endX = GOAL_POST_RIGHT_X + radius;

  return [
    `M ${startX} ${goalY}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${GOAL_POST_LEFT_X} ${straightY}`,
    `L ${GOAL_POST_RIGHT_X} ${straightY}`,
    `A ${radius} ${radius} 0 0 ${sweep} ${endX} ${goalY}`,
  ].join(" ");
}

/**
 * Builds every official court line, in meters. Deliberately data, not JSX
 * -- MasterCourt.tsx only maps this array to <line>/<path>/<rect>
 * elements, it never decides where a line goes.
 */
export function buildCourtLines(): readonly CourtLine[] {
  const halfwayY = COURT_LENGTH_METERS / 2;
  const centerX = COURT_WIDTH_METERS / 2;

  const lines: CourtLine[] = [
    { kind: "rect", id: "boundary", x: 0, y: 0, width: COURT_WIDTH_METERS, height: COURT_LENGTH_METERS },
    // The halfway line stops at the center circle's edge on each side
    // (never passes through it) -- two segments, not one continuous line.
    {
      kind: "line",
      id: "halfway-left",
      x1: 0,
      y1: halfwayY,
      x2: centerX - CENTER_CIRCLE_RADIUS_METERS,
      y2: halfwayY,
    },
    {
      kind: "line",
      id: "halfway-right",
      x1: centerX + CENTER_CIRCLE_RADIUS_METERS,
      y1: halfwayY,
      x2: COURT_WIDTH_METERS,
      y2: halfwayY,
    },
    {
      kind: "path",
      id: "center-circle",
      d: [
        `M ${centerX - CENTER_CIRCLE_RADIUS_METERS} ${halfwayY}`,
        `A ${CENTER_CIRCLE_RADIUS_METERS} ${CENTER_CIRCLE_RADIUS_METERS} 0 1 0 ${centerX + CENTER_CIRCLE_RADIUS_METERS} ${halfwayY}`,
        `A ${CENTER_CIRCLE_RADIUS_METERS} ${CENTER_CIRCLE_RADIUS_METERS} 0 1 0 ${centerX - CENTER_CIRCLE_RADIUS_METERS} ${halfwayY}`,
      ].join(" "),
    },
    // Official substitution marks -- both on the same (left) sideline,
    // 4.5 m either side of the halfway line, 30 cm long (15 cm in + 15 cm
    // out), parallel to the halfway line.
    {
      kind: "line",
      id: "substitution-line-before-halfway",
      x1: -SUBSTITUTION_LINE_OUTSIDE_METERS,
      y1: halfwayY - SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS,
      x2: SUBSTITUTION_LINE_INSIDE_METERS,
      y2: halfwayY - SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS,
    },
    {
      kind: "line",
      id: "substitution-line-after-halfway",
      x1: -SUBSTITUTION_LINE_OUTSIDE_METERS,
      y1: halfwayY + SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS,
      x2: SUBSTITUTION_LINE_INSIDE_METERS,
      y2: halfwayY + SUBSTITUTION_LINE_DISTANCE_FROM_HALFWAY_METERS,
    },
  ];

  (([
    [0, 1],
    [COURT_LENGTH_METERS, -1],
  ] as const)).forEach(([goalY, direction]) => {
    const side = direction === 1 ? "top" : "bottom";

    lines.push({
      kind: "line",
      id: `goal-${side}`,
      x1: GOAL_POST_LEFT_X,
      y1: goalY,
      x2: GOAL_POST_RIGHT_X,
      y2: goalY,
      thick: true,
    });
    // Post ticks -- a short perpendicular stroke at each end of the
    // crossbar line, entering the court, so the goal reads as having
    // actual posts rather than a single flat stroke.
    lines.push({
      kind: "line",
      id: `goal-post-left-${side}`,
      x1: GOAL_POST_LEFT_X,
      y1: goalY,
      x2: GOAL_POST_LEFT_X,
      y2: goalY + direction * GOAL_POST_TICK_DEPTH_METERS,
      thick: true,
    });
    lines.push({
      kind: "line",
      id: `goal-post-right-${side}`,
      x1: GOAL_POST_RIGHT_X,
      y1: goalY,
      x2: GOAL_POST_RIGHT_X,
      y2: goalY + direction * GOAL_POST_TICK_DEPTH_METERS,
      thick: true,
    });
    // Net hatch -- a handful of diagonal strokes across the net's
    // backdrop rectangle (behind the goal line, outside the court),
    // suggesting netting without a full SVG pattern definition.
    for (let i = 0; i < GOAL_NET_HATCH_COUNT; i += 1) {
      const x = GOAL_POST_LEFT_X + (GOAL_WIDTH_METERS / (GOAL_NET_HATCH_COUNT - 1)) * i;
      lines.push({
        kind: "line",
        id: `goal-net-hatch-${side}-${i}`,
        x1: x,
        y1: goalY,
        x2: x - direction * GOAL_NET_DEPTH_METERS * 0.4,
        y2: goalY - direction * GOAL_NET_DEPTH_METERS,
        hatch: true,
      });
    }
    lines.push({
      kind: "path",
      id: `goal-area-${side}`,
      d: goalAreaArcPath(GOAL_AREA_RADIUS_METERS, goalY, direction),
    });
    lines.push({
      kind: "path",
      id: `free-throw-${side}`,
      d: goalAreaArcPath(FREE_THROW_RADIUS_METERS, goalY, direction),
      dashed: true,
    });

    const penaltyY = goalY + direction * PENALTY_LINE_DISTANCE_METERS;
    lines.push({
      kind: "line",
      id: `penalty-${side}`,
      x1: (COURT_WIDTH_METERS - PENALTY_LINE_LENGTH_METERS) / 2,
      y1: penaltyY,
      x2: (COURT_WIDTH_METERS + PENALTY_LINE_LENGTH_METERS) / 2,
      y2: penaltyY,
    });

    const restraintY = goalY + direction * GOALKEEPER_RESTRAINT_LINE_DISTANCE_METERS;
    lines.push({
      kind: "line",
      id: `goalkeeper-restraint-${side}`,
      x1: (COURT_WIDTH_METERS - GOALKEEPER_RESTRAINT_LINE_LENGTH_METERS) / 2,
      y1: restraintY,
      x2: (COURT_WIDTH_METERS + GOALKEEPER_RESTRAINT_LINE_LENGTH_METERS) / 2,
      y2: restraintY,
    });
  });

  return Object.freeze(lines);
}

/**
 * The goal-area (6 m) surface, filled -- a permanent, always-visible court
 * feature (unlike the toggleable defensive/transition zone LAYERS), purely
 * so the eye immediately reads the goal area as distinct from the rest of
 * the floor. Reuses the exact same arc geometry as the goal-area LINE
 * (goalAreaArcPath) so the fill and its outline can never drift apart --
 * the path is simply closed back along the goal line with "Z".
 */
export function buildGoalAreaFills(): readonly CourtFill[] {
  return Object.freeze([
    { kind: "path", id: "goal-area-fill-top", d: `${goalAreaArcPath(GOAL_AREA_RADIUS_METERS, 0, 1)} Z` },
    {
      kind: "path",
      id: "goal-area-fill-bottom",
      d: `${goalAreaArcPath(GOAL_AREA_RADIUS_METERS, COURT_LENGTH_METERS, -1)} Z`,
    },
  ]);
}

/**
 * The goal net's shallow backdrop rectangle, BEHIND the goal line
 * (outside the 20x40 m court bounds) -- a stylized "depth" cue so the
 * goal reads as a goal, not a plain line. Geometry still comes entirely
 * from Master Court (this module): width matches the official 3 m goal
 * width exactly (GOAL_POST_LEFT_X..GOAL_POST_RIGHT_X), only the depth
 * (GOAL_NET_DEPTH_METERS) is a rendering choice, never a claimed official
 * measurement.
 */
export function buildGoalNetFills(): readonly CourtFill[] {
  const topD = [
    `M ${GOAL_POST_LEFT_X} 0`,
    `L ${GOAL_POST_RIGHT_X} 0`,
    `L ${GOAL_POST_RIGHT_X} ${-GOAL_NET_DEPTH_METERS}`,
    `L ${GOAL_POST_LEFT_X} ${-GOAL_NET_DEPTH_METERS}`,
    "Z",
  ].join(" ");
  const bottomD = [
    `M ${GOAL_POST_LEFT_X} ${COURT_LENGTH_METERS}`,
    `L ${GOAL_POST_RIGHT_X} ${COURT_LENGTH_METERS}`,
    `L ${GOAL_POST_RIGHT_X} ${COURT_LENGTH_METERS + GOAL_NET_DEPTH_METERS}`,
    `L ${GOAL_POST_LEFT_X} ${COURT_LENGTH_METERS + GOAL_NET_DEPTH_METERS}`,
    "Z",
  ].join(" ");

  return Object.freeze([
    { kind: "path", id: "goal-net-fill-top", d: topD },
    { kind: "path", id: "goal-net-fill-bottom", d: bottomD },
  ]);
}

// -- Defensive zones --
// Exact divider coordinates are NOT yet approved by coaching staff --
// deliberately collected in this one named configuration object (never
// scattered through the renderer) so they can be replaced without touching
// rendering/layout code. Evenly-spaced 4 m bands is the provisional
// starting point.
export const PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS = Object.freeze({
  dividerXMeters: Object.freeze([4, 8, 12, 16]),
  zoneDepthMeters: 9,
});

export type DefensiveZoneId = "ZONE_1_LEFT" | "ZONE_2_LEFT" | "ZONE_3" | "ZONE_2_RIGHT" | "ZONE_1_RIGHT";

const DEFENSIVE_ZONE_IDS: readonly DefensiveZoneId[] = [
  "ZONE_1_LEFT",
  "ZONE_2_LEFT",
  "ZONE_3",
  "ZONE_2_RIGHT",
  "ZONE_1_RIGHT",
];

const DEFENSIVE_ZONE_LABELS: Record<DefensiveZoneId, string> = {
  ZONE_1_LEFT: "Zon 1 vänster",
  ZONE_2_LEFT: "Zon 2 vänster",
  ZONE_3: "Zon 3",
  ZONE_2_RIGHT: "Zon 2 höger",
  ZONE_1_RIGHT: "Zon 1 höger",
};

export type DefensiveZoneRect = {
  id: string;
  zoneId: DefensiveZoneId;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Always builds zones for BOTH goals (mirrored) -- half-court view simply
 * shows less of the same full-court-based layer via its viewport, per the
 * "single Master Court, viewport decides what's visible" rule. Never a
 * separate half-court-only zone model.
 */
export function buildDefensiveZones(): readonly DefensiveZoneRect[] {
  const { dividerXMeters, zoneDepthMeters } = PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS;
  const xBounds = [0, ...dividerXMeters, COURT_WIDTH_METERS];

  const zonesForGoal = (goalY: number, direction: 1 | -1, sideLabel: string) =>
    DEFENSIVE_ZONE_IDS.map((zoneId, index) => {
      const x = xBounds[index];
      const width = xBounds[index + 1] - xBounds[index];
      const y = direction === 1 ? goalY : goalY - zoneDepthMeters;
      return {
        id: `defensive-${sideLabel}-${zoneId}`,
        zoneId,
        label: DEFENSIVE_ZONE_LABELS[zoneId],
        x,
        y,
        width,
        height: zoneDepthMeters,
      };
    });

  return Object.freeze([
    ...zonesForGoal(0, 1, "top"),
    ...zonesForGoal(COURT_LENGTH_METERS, -1, "bottom"),
  ]);
}

// -- Defensive zone calibration --
// NOTE: buildDefensiveZones()/DefensiveZoneRect above are left untouched
// and unused by this new path, kept only as a rollback reference until
// the calibration tool below is verified. This is the new, actual
// rendering path.
//
// Geometric model: V1|V2 and V2|3 are each modeled as a 13 m
// "construction ray" -- a fixed origin plus a direction -- NOT as a
// line whose real endpoint is the zone boundary. Only the RAY'S
// DIRECTION matters; its raw 13 m endpoint may legitimately fall
// outside the visible court. The actual, VISIBLE zone boundary always
// re-derives by clipping that ray against the official 9 m free-throw
// curve (the exact same two-post-centered-arcs-plus-flat-segment
// construction goalAreaArcPath already renders -- never a separate,
// approximated curve), and consecutive clipped points are connected by
// the real arc/line segment of that same curve, never a straight chord.
//
// V1|V2 is the only coach-calibratable divider (the coach only ever
// changes its DIRECTION). V2|3 is fixed configuration, derived once
// from the direction of the earlier straight-vertical implementation,
// and is never stored as user calibration. The right-side pair (3|H2,
// H2|H1) and the bottom goal are always mirrors, computed here, never
// duplicated as stored data.

/** A single straight divider boundary -- two points, no curve. `start`
 * is a fixed origin (never draggable); `end` is the raw 13 m
 * construction point (only its direction from `start` is meaningful --
 * it is NOT itself the visible zone boundary, see module doc above). */
export type DividerLine = {
  id: "V1_V2" | "V2_3";
  start: MeterPoint;
  end: MeterPoint;
};

export type DefensiveZoneCalibration = {
  version: 2;
  // Only the calibratable V1|V2 divider is ever stored. `v1v2.start` is
  // always LEFT_DIVIDER_ORIGIN. V2_3 is fixed configuration (see
  // FIXED_V2_3_DIVIDER) and is deliberately absent from this type.
  v1v2: DividerLine;
};

export type DefensiveZonePolygon = {
  id: string;
  zoneId: DefensiveZoneId;
  label: string;
  threatLevel: "low" | "medium" | "high";
  d: string;
};

// Symmetric "threat" read for the zone overlay: the center zone (3) is
// the highest-threat area, tapering outward toward the sidelines --
// V1/H1 lowest, V2/H2 medium, 3 highest. Purely a visualization choice,
// not a claimed tactical/analytical scoring of the zones.
export const DEFENSIVE_ZONE_THREAT_LEVEL: Record<DefensiveZoneId, "low" | "medium" | "high"> = {
  ZONE_1_LEFT: "low",
  ZONE_2_LEFT: "medium",
  ZONE_3: "high",
  ZONE_2_RIGHT: "medium",
  ZONE_1_RIGHT: "low",
};

// Every construction ray is exactly this long, regardless of direction
// -- only direction is coach-controlled. The court is 20x40 m, so a
// 13 m ray from a near-goal-line origin legitimately reaches well past
// the 9 m line; that's expected and handled by the curve-clipping step.
export const CONSTRUCTION_LINE_LENGTH_METERS = 13;

// Fixed pivot points, 1 m outside each goalpost -- the LEFT origin is
// where V1|V2 and V2|3 both originate; the RIGHT origin (their mirror
// across the court's vertical center axis) is where 3|H2 and H2|H1
// originate. Never draggable.
export const LEFT_DIVIDER_ORIGIN: MeterPoint = Object.freeze({ x: GOAL_POST_LEFT_X - 1, y: 0 }); // 7.5

function directionFromOrigin(target: MeterPoint): MeterPoint {
  const raw = subtractPoints(target, LEFT_DIVIDER_ORIGIN);
  // A zero-length drag (pointer exactly on the origin) has no direction
  // -- fall back to straight down rather than produce a degenerate ray.
  return vectorLength(raw) < 1e-9 ? { x: 0, y: 1 } : normalizeVector(raw);
}

function constructionRayEnd(direction: MeterPoint): MeterPoint {
  return addPoints(LEFT_DIVIDER_ORIGIN, scalePoint(direction, CONSTRUCTION_LINE_LENGTH_METERS));
}

// V2_3 keeps the exact direction of the earlier straight-vertical
// implementation (PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS: a vertical line
// at x=dividerXMeters[1]=8, from y=0 to y=zoneDepthMeters=9, i.e.
// direction (0,1)) -- recomputed here to originate at
// LEFT_DIVIDER_ORIGIN and be exactly CONSTRUCTION_LINE_LENGTH_METERS
// long. Fixed configuration: never user-calibratable, never persisted.
const V2_3_DIRECTION: MeterPoint = normalizeVector(
  subtractPoints(
    { x: PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS.dividerXMeters[1], y: PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS.zoneDepthMeters },
    { x: PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS.dividerXMeters[1], y: 0 },
  ),
);

const FIXED_V2_3_DIVIDER: DividerLine = Object.freeze({
  id: "V2_3",
  start: LEFT_DIVIDER_ORIGIN,
  end: constructionRayEnd(V2_3_DIRECTION),
});

export function buildDividerLinePathD(divider: DividerLine): string {
  return `M ${divider.start.x} ${divider.start.y} L ${divider.end.x} ${divider.end.y}`;
}

function mirrorDividerAcrossVertical(divider: DividerLine, axisX: number): DividerLine {
  return Object.freeze({
    id: divider.id,
    start: mirrorPointAcrossVerticalLine(divider.start, axisX),
    end: mirrorPointAcrossVerticalLine(divider.end, axisX),
  });
}

function mirrorDividerAcrossHorizontal(divider: DividerLine, axisY: number): DividerLine {
  return Object.freeze({
    id: divider.id,
    start: mirrorPointAcrossHorizontalLine(divider.start, axisY),
    end: mirrorPointAcrossHorizontalLine(divider.end, axisY),
  });
}

/** Expands the stored V1|V2 divider (plus the fixed V2|3) into all 4
 * boundaries for ONE goal end, left to right: [V1|V2, V2|3, 3|H2,
 * H2|H1]. The right-side pair is a mathematical mirror across the
 * court's vertical center axis -- never separately stored data. */
export function deriveFullDividerSet(
  calibration: DefensiveZoneCalibration,
): readonly [DividerLine, DividerLine, DividerLine, DividerLine] {
  const v12 = calibration.v1v2;
  const v23 = FIXED_V2_3_DIVIDER;
  const axisX = COURT_WIDTH_METERS / 2;
  return Object.freeze([v12, v23, mirrorDividerAcrossVertical(v23, axisX), mirrorDividerAcrossVertical(v12, axisX)]);
}

// -- Official 9 m curve: ray-clipping and arc-segment reuse --
// Reuses ONLY the already-defined FREE_THROW_RADIUS_METERS/
// GOAL_POST_LEFT_X/GOAL_POST_RIGHT_X constants that goalAreaArcPath
// itself is built from -- the exact same two-quarter-circles-plus-flat
// construction, never a re-approximated curve.

type CurveHit = { distance: number; point: MeterPoint };

function intersectRayWithArc(
  origin: MeterPoint,
  direction: MeterPoint,
  center: MeterPoint,
  domainMinX: number,
  domainMaxX: number,
): CurveHit | null {
  const radius = FREE_THROW_RADIUS_METERS;
  const toOrigin = subtractPoints(origin, center);
  const b = 2 * dotProduct(direction, toOrigin);
  const c = dotProduct(toOrigin, toOrigin) - radius * radius;
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) {
    return null;
  }
  const sqrtDiscriminant = Math.sqrt(discriminant);
  let best: CurveHit | null = null;
  for (const distance of [(-b - sqrtDiscriminant) / 2, (-b + sqrtDiscriminant) / 2]) {
    if (distance <= 0) {
      continue;
    }
    const point = addPoints(origin, scalePoint(direction, distance));
    if (point.y < 0 || point.x < domainMinX || point.x > domainMaxX) {
      continue;
    }
    if (!best || distance < best.distance) {
      best = { distance, point };
    }
  }
  return best;
}

function intersectRayWithFlatSegment(origin: MeterPoint, direction: MeterPoint): CurveHit | null {
  if (direction.y === 0) {
    return null;
  }
  const distance = (FREE_THROW_RADIUS_METERS - origin.y) / direction.y;
  if (distance <= 0) {
    return null;
  }
  const x = origin.x + direction.x * distance;
  if (x < GOAL_POST_LEFT_X || x > GOAL_POST_RIGHT_X) {
    return null;
  }
  return { distance, point: { x, y: FREE_THROW_RADIUS_METERS } };
}

/** Clips a construction ray (from `divider.start` through `divider.end`)
 * against the official 9 m curve, returning the first point where it
 * crosses. This is the actual, visible zone-boundary point for that
 * divider -- the raw `divider.end` (13 m out) is never used directly
 * for rendering. */
function clipDividerToNineMeterCurve(divider: DividerLine): MeterPoint {
  const direction = normalizeVector(subtractPoints(divider.end, divider.start));
  const hits = [
    intersectRayWithArc(
      divider.start,
      direction,
      { x: GOAL_POST_LEFT_X, y: 0 },
      GOAL_POST_LEFT_X - FREE_THROW_RADIUS_METERS,
      GOAL_POST_LEFT_X,
    ),
    intersectRayWithFlatSegment(divider.start, direction),
    intersectRayWithArc(
      divider.start,
      direction,
      { x: GOAL_POST_RIGHT_X, y: 0 },
      GOAL_POST_RIGHT_X,
      GOAL_POST_RIGHT_X + FREE_THROW_RADIUS_METERS,
    ),
  ].filter((hit): hit is CurveHit => hit !== null);

  if (hits.length === 0) {
    // Not expected for any direction pointing into the court from
    // LEFT_DIVIDER_ORIGIN/its mirror (both well inside the curve) -- a
    // safe fallback rather than a crash if it ever occurs.
    return clampToBounds(divider.end, COURT_BOUNDS_METERS);
  }
  return hits.reduce((closest, hit) => (hit.distance < closest.distance ? hit : closest)).point;
}

/** The 9 m curve's own y at a given x (x must be within [-0.5, 20.5],
 * true for the whole court width). Used for zone edges that meet a
 * sideline rather than another divider. */
function pointOnNineMeterCurveAtX(x: number): MeterPoint {
  const radius = FREE_THROW_RADIUS_METERS;
  if (x <= GOAL_POST_LEFT_X) {
    const dx = x - GOAL_POST_LEFT_X;
    return { x, y: Math.sqrt(Math.max(0, radius * radius - dx * dx)) };
  }
  if (x >= GOAL_POST_RIGHT_X) {
    const dx = x - GOAL_POST_RIGHT_X;
    return { x, y: Math.sqrt(Math.max(0, radius * radius - dx * dx)) };
  }
  return { x, y: radius };
}

// Segment index along the composite curve (0=left arc, 1=flat, 2=right
// arc) for a given x -- the curve is single-valued in x across its
// whole domain, so this alone is enough to route path construction.
function nineMeterCurveSegmentAt(x: number): 0 | 1 | 2 {
  if (x <= GOAL_POST_LEFT_X) {
    return 0;
  }
  if (x >= GOAL_POST_RIGHT_X) {
    return 2;
  }
  return 1;
}

/** Emits the SVG path commands (continuing from a preceding M/L at
 * `from`) that trace the ACTUAL official 9 m curve from `from` to `to`
 * (both assumed to already lie on the curve, `from.x` <= `to.x`) --
 * reusing goalAreaArcPath's exact per-segment arc construction: same
 * radius, same arc centers, and the SAME `goalY`/`direction` ->
 * flat-depth/sweep-flag convention goalAreaArcPath itself uses (sweep
 * flips for the bottom goal -- mirroring across a horizontal line
 * reverses the arc's rotational handedness, exactly like
 * goalAreaArcPath's own `direction === 1 ? 0 : 1`). Never an
 * approximated curve. */
function nineMeterCurveSegmentCommands(from: MeterPoint, to: MeterPoint, goalY: number, direction: 1 | -1): string {
  const radius = FREE_THROW_RADIUS_METERS;
  const sweep = direction === 1 ? 0 : 1;
  const flatY = goalY + direction * radius;
  const leftArcEnd: MeterPoint = { x: GOAL_POST_LEFT_X, y: flatY };
  const rightArcStart: MeterPoint = { x: GOAL_POST_RIGHT_X, y: flatY };
  const fromSegment = nineMeterCurveSegmentAt(from.x);
  const toSegment = nineMeterCurveSegmentAt(to.x);
  const commands: string[] = [];

  if (fromSegment === 0) {
    const arcTo = toSegment === 0 ? to : leftArcEnd;
    commands.push(`A ${radius} ${radius} 0 0 ${sweep} ${arcTo.x} ${arcTo.y}`);
  }
  if (toSegment >= 1 && fromSegment <= 1) {
    const flatTo = toSegment === 1 ? to : rightArcStart;
    commands.push(`L ${flatTo.x} ${flatTo.y}`);
  }
  if (toSegment === 2) {
    commands.push(`A ${radius} ${radius} 0 0 ${sweep} ${to.x} ${to.y}`);
  }
  return commands.join(" ");
}

// The clip-vs-9m-curve math (clipDividerToNineMeterCurve,
// pointOnNineMeterCurveAtX) only knows the TOP goal's curve (centered
// at y=0). Every zone-path builder below therefore takes an ALREADY
// resolved clip/sideline point rather than a divider to clip itself --
// for the bottom goal, the caller (buildZonePolygonsForGoal) computes
// the clip in TOP space first (where the math is valid) and mirrors
// the resulting POINT, exactly like it already does for the dividers
// themselves. Clipping a pre-mirrored bottom-goal divider directly
// would silently test it against the wrong (top) curve.

function buildLeftEdgeZonePath(
  divider: DividerLine,
  clip: MeterPoint,
  sidelinePoint: MeterPoint,
  goalY: number,
  direction: 1 | -1,
): string {
  return [
    `M 0 ${divider.start.y}`,
    `L 0 ${sidelinePoint.y}`,
    nineMeterCurveSegmentCommands(sidelinePoint, clip, goalY, direction),
    `L ${divider.start.x} ${divider.start.y}`,
    "Z",
  ]
    .filter((command) => command !== "")
    .join(" ");
}

function buildRightEdgeZonePath(
  divider: DividerLine,
  clip: MeterPoint,
  sidelinePoint: MeterPoint,
  goalY: number,
  direction: 1 | -1,
): string {
  // Traverse origin -> clip -> (arc) -> sideline -> close, so the arc
  // command always starts from the cursor's actual position (clip),
  // matching nineMeterCurveSegmentCommands' left-to-right assumption
  // (clip.x < sidelinePoint.x here) -- the reverse order used for the
  // left edge would replay the arc backwards and produce a degenerate
  // curve.
  return [
    `M ${divider.start.x} ${divider.start.y}`,
    `L ${clip.x} ${clip.y}`,
    nineMeterCurveSegmentCommands(clip, sidelinePoint, goalY, direction),
    `L ${COURT_WIDTH_METERS} ${divider.start.y}`,
    "Z",
  ]
    .filter((command) => command !== "")
    .join(" ");
}

/** Bounds an interior zone by two dividers -- V1|V2/V2|3 (sharing the
 * same LEFT_DIVIDER_ORIGIN, so this is a wedge) or V2|3/3|H2 (different
 * origins, so the implicit "Z" close draws the goal-line base between
 * them -- exactly the zone-3 shape). Either way: divider down, official
 * 9 m arc across, divider back up, close. */
function buildInteriorZonePath(
  left: DividerLine,
  leftClip: MeterPoint,
  right: DividerLine,
  rightClip: MeterPoint,
  goalY: number,
  direction: 1 | -1,
): string {
  return [
    `M ${left.start.x} ${left.start.y}`,
    `L ${leftClip.x} ${leftClip.y}`,
    nineMeterCurveSegmentCommands(leftClip, rightClip, goalY, direction),
    `L ${right.start.x} ${right.start.y}`,
    "Z",
  ]
    .filter((command) => command !== "")
    .join(" ");
}

/** Builds one goal's 5 zone polygons from its (already-in-TOP-space)
 * dividers, clipping every divider against the 9 m curve exactly once
 * here, then mirroring both dividers and their clip points together
 * for the bottom goal -- never re-clipping a pre-mirrored divider. */
function buildZonePolygonsForGoal(
  topDividers: readonly [DividerLine, DividerLine, DividerLine, DividerLine],
  goalSide: "top" | "bottom",
): readonly DefensiveZonePolygon[] {
  const axisY = COURT_LENGTH_METERS / 2;
  const toGoalSide = <T extends MeterPoint>(point: T): T =>
    goalSide === "bottom" ? (mirrorPointAcrossHorizontalLine(point, axisY) as T) : point;
  const dividerToGoalSide = (divider: DividerLine): DividerLine =>
    goalSide === "bottom" ? mirrorDividerAcrossHorizontal(divider, axisY) : divider;

  const [d1, d2, d3, d4] = topDividers.map(dividerToGoalSide) as [DividerLine, DividerLine, DividerLine, DividerLine];
  const [clip1, clip2, clip3, clip4] = topDividers.map((divider) =>
    toGoalSide(clipDividerToNineMeterCurve(divider)),
  ) as [MeterPoint, MeterPoint, MeterPoint, MeterPoint];
  const leftSidelinePoint = toGoalSide(pointOnNineMeterCurveAtX(0));
  const rightSidelinePoint = toGoalSide(pointOnNineMeterCurveAtX(COURT_WIDTH_METERS));
  // Same goalY/direction convention buildCourtLines/goalAreaArcPath
  // already use for top vs. bottom -- passed through so the arc
  // segments' sweep flag and flat-depth match the official line exactly.
  const goalY = goalSide === "top" ? 0 : COURT_LENGTH_METERS;
  const direction: 1 | -1 = goalSide === "top" ? 1 : -1;

  const pathByZoneId: Record<DefensiveZoneId, string> = {
    ZONE_1_LEFT: buildLeftEdgeZonePath(d1, clip1, leftSidelinePoint, goalY, direction),
    ZONE_2_LEFT: buildInteriorZonePath(d1, clip1, d2, clip2, goalY, direction),
    ZONE_3: buildInteriorZonePath(d2, clip2, d3, clip3, goalY, direction),
    ZONE_2_RIGHT: buildInteriorZonePath(d3, clip3, d4, clip4, goalY, direction),
    ZONE_1_RIGHT: buildRightEdgeZonePath(d4, clip4, rightSidelinePoint, goalY, direction),
  };
  return DEFENSIVE_ZONE_IDS.map((zoneId) => ({
    id: `defensive-${goalSide}-${zoneId}`,
    zoneId,
    label: DEFENSIVE_ZONE_LABELS[zoneId],
    threatLevel: DEFENSIVE_ZONE_THREAT_LEVEL[zoneId],
    d: pathByZoneId[zoneId],
  }));
}

/** The actually-rendered defensive zone builder -- consumes a coach
 * calibration (V1|V2 only) and derives the right-side mirror, the
 * fixed V2|3, and the bottom-goal mirror, then clips every divider
 * against the official 9 m curve for the visible boundary. Replaces
 * buildDefensiveZones() in the renderer; that older function is left in
 * place, unused, as a rollback reference only. */
export function buildDefensiveZonePolygonsFromCalibration(
  calibration: DefensiveZoneCalibration,
): readonly DefensiveZonePolygon[] {
  const topDividers = deriveFullDividerSet(calibration);
  return Object.freeze([
    ...buildZonePolygonsForGoal(topDividers, "top"),
    ...buildZonePolygonsForGoal(topDividers, "bottom"),
  ]);
}

/** Immutable update of V1|V2's direction from a dragged pointer
 * position -- only the DIRECTION from LEFT_DIVIDER_ORIGIN matters; the
 * stored `end` is always re-normalized to exactly
 * CONSTRUCTION_LINE_LENGTH_METERS from the origin, never the raw
 * pointer position itself. */
export function updateDividerCalibrationPoint(
  calibration: DefensiveZoneCalibration,
  position: MeterPoint,
): DefensiveZoneCalibration {
  const direction = directionFromOrigin(position);
  return Object.freeze({
    version: 2,
    v1v2: Object.freeze({ id: "V1_V2" as const, start: LEFT_DIVIDER_ORIGIN, end: constructionRayEnd(direction) }),
  });
}

// Provisional starting DIRECTION for the calibratable V1|V2 divider --
// aimed toward the same rough area (x=4, y=9) as the earlier
// PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS default, just re-expressed as a
// direction from LEFT_DIVIDER_ORIGIN. Still explicitly provisional/
// non-official -- only a seed for the coach to drag from.
const PROVISIONAL_V1_V2_DIRECTION: MeterPoint = normalizeVector(
  subtractPoints(
    { x: PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS.dividerXMeters[0], y: PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS.zoneDepthMeters },
    LEFT_DIVIDER_ORIGIN,
  ),
);

export const PROVISIONAL_DEFENSIVE_ZONE_CALIBRATION: DefensiveZoneCalibration = Object.freeze({
  version: 2,
  v1v2: Object.freeze({
    id: "V1_V2",
    start: LEFT_DIVIDER_ORIGIN,
    end: constructionRayEnd(PROVISIONAL_V1_V2_DIRECTION),
  }),
}) as DefensiveZoneCalibration;

// Approved by the coaching staff via the internal calibration tool
// (src/app/ui/workspaces/tactics-board/calibration/calibrationDevTools.ts
// gates that tool behind a developer-only flag; it is hidden from normal
// users). This is the permanent default defensive-zone geometry for
// normal operation -- baked in directly from the calibration tool's
// approved output, not read from localStorage. Do not hand-edit this
// value without re-running the calibration tool and re-approving the
// result; PROVISIONAL_DEFENSIVE_ZONE_CALIBRATION above is unrelated and
// still only the calibration tool's own reset/seed geometry.
export const APPROVED_DEFENSIVE_ZONE_CALIBRATION: DefensiveZoneCalibration = Object.freeze({
  version: 2,
  v1v2: Object.freeze({
    id: "V1_V2",
    start: LEFT_DIVIDER_ORIGIN,
    end: Object.freeze({ x: -3.222844228424707, y: 7.349871539893668 }),
  }),
}) as DefensiveZoneCalibration;

export function exportDefensiveZoneCalibrationToJson(calibration: DefensiveZoneCalibration): string {
  return JSON.stringify(calibration, null, 2);
}

// -- Defensive zone label calibration --
// Visible name labels (H1/H2/3/V2/V1) for the defensive zones -- distinct
// from DEFENSIVE_ZONE_LABELS above (full Swedish strings, used only for
// the zone-fill <title> tooltip). Only the three canonical labels at the
// TOP goal's left half (h1, h2, center) are ever stored/calibrated; every
// other position (V1/V2 and the whole bottom goal) is derived below by
// mirroring -- a single source of truth per the UX-sprint spec.

export type DefensiveZoneLabelKey = "h1" | "h2" | "center";

export type DefensiveZoneLabelTransform = {
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
};

export type DefensiveZoneLabelCalibration = {
  version: 1;
  h1: DefensiveZoneLabelTransform;
  h2: DefensiveZoneLabelTransform;
  center: DefensiveZoneLabelTransform;
};

export type DefensiveZoneLabelText = "H1" | "H2" | "3" | "V2" | "V1";

export type DefensiveZoneLabelPosition = {
  id: string;
  goal: "TOP" | "BOTTOM";
  text: DefensiveZoneLabelText;
  // Set only for the three directly-editable labels (always the TOP
  // goal's H1/H2/center) -- every mirrored/derived position has this as
  // null, so dragging one never creates a second, conflicting source of
  // truth for the same calibration key.
  calibrationKey: DefensiveZoneLabelKey | null;
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
};

function mirrorLabelAcrossVertical(
  transform: DefensiveZoneLabelTransform,
  axisX: number,
): DefensiveZoneLabelTransform {
  const mirroredPoint = mirrorPointAcrossVerticalLine({ x: transform.x, y: transform.y }, axisX);
  return {
    x: mirroredPoint.x,
    y: mirroredPoint.y,
    rotation: mirrorRotationAcrossVerticalLine(transform.rotation),
    fontSize: transform.fontSize,
  };
}

function mirrorLabelAcrossHorizontal(
  transform: DefensiveZoneLabelTransform,
  axisY: number,
): DefensiveZoneLabelTransform {
  const mirroredPoint = mirrorPointAcrossHorizontalLine({ x: transform.x, y: transform.y }, axisY);
  return {
    x: mirroredPoint.x,
    y: mirroredPoint.y,
    rotation: mirrorRotationAcrossHorizontalLine(transform.rotation),
    fontSize: transform.fontSize,
  };
}

/** Derives all 10 defensive zone label positions (5 per goal) from the 3
 * calibrated canonical transforms. Order matches the visible left-to-
 * right requirement exactly: TOP goal reads H1 H2 3 V2 V1, BOTTOM goal
 * reads V1 V2 3 H2 H1. V and H are each team's own left/right flank, as
 * defined by that team facing OUT of their own goal -- that framing flips
 * between the two ends of the court, so H1/H2 swap identity with V1/V2
 * when mirrored to the other goal, while "3" (the center zone) keeps its
 * name at both goals. */
export function buildDefensiveZoneLabelPositions(
  calibration: DefensiveZoneLabelCalibration,
): readonly DefensiveZoneLabelPosition[] {
  const axisX = COURT_WIDTH_METERS / 2;
  const axisY = COURT_LENGTH_METERS / 2;

  const topH1 = calibration.h1;
  const topH2 = calibration.h2;
  const top3 = calibration.center;
  const topV1 = mirrorLabelAcrossVertical(topH1, axisX);
  const topV2 = mirrorLabelAcrossVertical(topH2, axisX);

  const bottomV1 = mirrorLabelAcrossHorizontal(topH1, axisY);
  const bottomV2 = mirrorLabelAcrossHorizontal(topH2, axisY);
  const bottom3 = mirrorLabelAcrossHorizontal(top3, axisY);
  const bottomH2 = mirrorLabelAcrossHorizontal(topV2, axisY);
  const bottomH1 = mirrorLabelAcrossHorizontal(topV1, axisY);

  function toPosition(
    goal: "TOP" | "BOTTOM",
    text: DefensiveZoneLabelText,
    calibrationKey: DefensiveZoneLabelKey | null,
    transform: DefensiveZoneLabelTransform,
  ): DefensiveZoneLabelPosition {
    return {
      id: `${goal}-${text}`,
      goal,
      text,
      calibrationKey,
      x: transform.x,
      y: transform.y,
      rotation: transform.rotation,
      fontSize: transform.fontSize,
    };
  }

  return Object.freeze([
    toPosition("TOP", "H1", "h1", topH1),
    toPosition("TOP", "H2", "h2", topH2),
    toPosition("TOP", "3", "center", top3),
    toPosition("TOP", "V2", null, topV2),
    toPosition("TOP", "V1", null, topV1),
    toPosition("BOTTOM", "V1", null, bottomV1),
    toPosition("BOTTOM", "V2", null, bottomV2),
    toPosition("BOTTOM", "3", null, bottom3),
    toPosition("BOTTOM", "H2", null, bottomH2),
    toPosition("BOTTOM", "H1", null, bottomH1),
  ]);
}

export function updateDefensiveZoneLabelTransform(
  calibration: DefensiveZoneLabelCalibration,
  key: DefensiveZoneLabelKey,
  patch: Partial<DefensiveZoneLabelTransform>,
): DefensiveZoneLabelCalibration {
  return Object.freeze({
    ...calibration,
    [key]: Object.freeze({ ...calibration[key], ...patch }),
  }) as DefensiveZoneLabelCalibration;
}

// Reasonable starting point only -- roughly inside the top goal's left-
// half zones, rotation 0, font size matching the transition-zone labels'
// own meter size. Not visually approved; the coach drags these into
// place with the calibration tool. Hardcoding an approved result is a
// later, separate closing sprint (mirrors PROVISIONAL_DEFENSIVE_ZONE_
// CALIBRATION above, which has the same relationship to APPROVED_
// DEFENSIVE_ZONE_CALIBRATION).
export const PROVISIONAL_DEFENSIVE_ZONE_LABEL_CALIBRATION: DefensiveZoneLabelCalibration = Object.freeze({
  version: 1,
  h1: Object.freeze({ x: 2, y: 3, rotation: 0, fontSize: 1.1 }),
  h2: Object.freeze({ x: 5.5, y: 3, rotation: 0, fontSize: 1.1 }),
  center: Object.freeze({ x: 9, y: 3, rotation: 0, fontSize: 1.1 }),
}) as DefensiveZoneLabelCalibration;

// Approved by the coaching staff via the internal label calibration tool
// (calibration/calibrationDevTools.ts's defensiveZoneLabelCalibrationTool
// Enabled gates that tool behind a developer-only flag; it is hidden from
// normal users). This is the permanent default defensive-zone-label
// geometry for normal operation -- baked in directly from the tool's
// approved output, not read from localStorage. Only h1/h2/center are ever
// stored here; V1/V2 and the entire bottom goal are always derived via
// buildDefensiveZoneLabelPositions's existing mirroring, never hardcoded
// separately. Do not hand-edit this value without re-running the
// calibration tool and re-approving the result; PROVISIONAL_DEFENSIVE_
// ZONE_LABEL_CALIBRATION above is unrelated and still only the tool's own
// reset/seed geometry.
export const APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION: DefensiveZoneLabelCalibration = Object.freeze({
  version: 1,
  h1: Object.freeze({ x: 3.595505617977528, y: 1.2816011235955056, rotation: 72.64597536373867, fontSize: 1 }),
  h2: Object.freeze({ x: 5.50561797752809, y: 3.922050561797753, rotation: 39.400660663479414, fontSize: 1.05 }),
  center: Object.freeze({ x: 10, y: 5.101825842696629, rotation: 0, fontSize: 1.1 }),
}) as DefensiveZoneLabelCalibration;

export function exportDefensiveZoneLabelCalibrationToJson(calibration: DefensiveZoneLabelCalibration): string {
  return JSON.stringify(calibration, null, 2);
}

// -- Transition zones --
// Exact meter boundaries between Överblick/Transportzon/Valsituation --
// the court split into three EQUAL thirds (COURT_LENGTH_METERS / 3
// exactly, no rounded/approximated literal), confirmed geometry for
// this layer (unlike PROVISIONAL_DEFENSIVE_ZONE_DIVIDERS above, which
// is still explicitly unapproved).
export const TRANSITION_ZONE_BOUNDARIES = Object.freeze({
  firstBoundaryMeters: COURT_LENGTH_METERS / 3,
  secondBoundaryMeters: (COURT_LENGTH_METERS * 2) / 3,
});

export type TransitionDirection = "TOP_TO_BOTTOM" | "BOTTOM_TO_TOP";
export type TransitionZoneId = "OVERVIEW" | "TRANSPORT" | "DECISION";
export type TransitionZoneTone = "cool" | "neutral" | "warm";

const TRANSITION_ZONE_LABELS: Record<TransitionZoneId, string> = {
  OVERVIEW: "Överblick",
  TRANSPORT: "Transportzon",
  DECISION: "Valsituation",
};

// Approved design gradient: Överblick (cool blue/turquoise) -> Transportzon
// (neutral green) -> Valsituation (warm orange/red) -- purely a
// visualization choice describing the three transition PHASES, not a
// tactical scoring (see DEFENSIVE_ZONE_THREAT_LEVEL for the unrelated
// defensive-zone gradient, which this deliberately does not reuse).
export const TRANSITION_ZONE_TONE: Record<TransitionZoneId, TransitionZoneTone> = {
  OVERVIEW: "cool",
  TRANSPORT: "neutral",
  DECISION: "warm",
};

export type TransitionZoneRect = {
  id: string;
  zoneId: TransitionZoneId;
  label: string;
  tone: TransitionZoneTone;
  x: number;
  y: number;
  width: number;
  height: number;
};

function mirrorTransitionZoneRectVertically(zone: TransitionZoneRect, axisY: number): TransitionZoneRect {
  const top = mirrorPointAcrossHorizontalLine({ x: zone.x, y: zone.y }, axisY);
  const bottom = mirrorPointAcrossHorizontalLine({ x: zone.x, y: zone.y + zone.height }, axisY);
  return { ...zone, y: Math.min(top.y, bottom.y), height: Math.abs(top.y - bottom.y) };
}

/**
 * Always builds the full 0..40 m layer regardless of courtView -- half
 * court view shows only the part of this SAME layer inside its own
 * viewport (0..20 m), never a separately-recomputed set of zones.
 *
 * Geometry is built ONCE for the canonical TOP_TO_BOTTOM direction
 * (Överblick nearest the top/own-half goal line, Valsituation nearest
 * the bottom/opponent goal line); BOTTOM_TO_TOP is never a second,
 * independently-computed layout -- it's the canonical rects mirrored
 * across the halfway line via mirrorPointAcrossHorizontalLine, the
 * exact same generic mirroring function buildDefensiveZonePolygonsFromCalibration
 * already uses for the defensive-zone layer. No duplicated geometry.
 */
export function buildTransitionZones(direction: TransitionDirection): readonly TransitionZoneRect[] {
  const { firstBoundaryMeters, secondBoundaryMeters } = TRANSITION_ZONE_BOUNDARIES;
  const canonicalOrder: readonly TransitionZoneId[] = ["OVERVIEW", "TRANSPORT", "DECISION"];
  const bands = [
    { y: 0, height: firstBoundaryMeters },
    { y: firstBoundaryMeters, height: secondBoundaryMeters - firstBoundaryMeters },
    { y: secondBoundaryMeters, height: COURT_LENGTH_METERS - secondBoundaryMeters },
  ];

  const canonicalZones: readonly TransitionZoneRect[] = canonicalOrder.map((zoneId, index) => ({
    id: `transition-${zoneId}`,
    zoneId,
    label: TRANSITION_ZONE_LABELS[zoneId],
    tone: TRANSITION_ZONE_TONE[zoneId],
    x: 0,
    y: bands[index].y,
    width: COURT_WIDTH_METERS,
    height: bands[index].height,
  }));

  if (direction === "TOP_TO_BOTTOM") {
    return Object.freeze(canonicalZones);
  }
  const axisY = COURT_LENGTH_METERS / 2;
  return Object.freeze(canonicalZones.map((zone) => mirrorTransitionZoneRectVertically(zone, axisY)));
}

// -- Transition zone label placement --
// A small, reusable, pure layout function. SVG text x/y is a BASELINE
// anchor, not the true visual center of the glyphs' bounding box --
// and critically, dominantBaseline="middle" does NOT split that box
// symmetrically around the anchor either (verified live: measuring
// getBBox() on the actual rendered <text> in Chromium shows the anchor
// sits closer to the box's bottom edge than its top -- ascent and
// descent from a "middle" baseline are genuinely different distances).
// So placing labels by "zone geometric center" (the old approach), or
// even by a symmetric half-height guess, does not reliably keep a
// label's real visual edge a specific distance from another line. This
// computes each label's anchor y using the MEASURED, asymmetric
// ascent/descent offsets below, so the box's actual near edge lands
// exactly at the required margin.
//
// Never a fresh/parallel geometry computation: it reads the zone rects
// buildTransitionZones already produced (already correctly mirrored
// for the chosen direction) and classifies each zone by which goal
// line (if any) it touches -- the outer zone touching a goal line gets
// the 9 m-line rule (mirrored automatically, since which zoneId
// touches which goal line already flips with direction); the zone
// touching neither goal line (the self-symmetric middle third) always
// gets the center-circle rule, which is direction-invariant by
// construction (the circle and halfway line never move).

// The label's font-size, in the SAME meter units MasterCourt.module.css's
// .transitionZoneLabel uses (font-size: 1.1px, interpreted as user
// units inside the SVG's meter-based viewBox -- see that file).
export const TRANSITION_LABEL_FONT_SIZE_METERS = 1.1;

/** A label's actual visual bounding box, expressed as the two
 * (asymmetric) offsets from a dominantBaseline="middle" anchor to the
 * box's real top and bottom edges -- NOT a single symmetric height. */
export type TransitionLabelBox = { ascentMeters: number; descentMeters: number; widthMeters: number };

// MEASURED directly from the actual rendered <text
// class="transitionZoneLabel"> in Chromium via element.getBBox(), at
// this exact font-size/family/weight -- not a guessed/assumed ratio.
// dominantBaseline="middle" places the anchor 0.6733x font-size above
// the box's true top edge and 0.4589x font-size below its true bottom
// edge (identical across "Överblick"/"Transportzon"/"Valsituation",
// confirming these are font metrics, not per-glyph ink extents). If
// the label's font-size, font-family, or font-weight ever changes,
// re-measure via getBBox() and update these two ratios.
const TRANSITION_LABEL_ASCENT_RATIO = 0.673285;
const TRANSITION_LABEL_DESCENT_RATIO = 0.458915;

// Width is generous/unused by the current (Y-only) margin rules; kept
// so the box type is genuinely 2D for future reuse.
export const TRANSITION_LABEL_BOX: TransitionLabelBox = Object.freeze({
  ascentMeters: TRANSITION_LABEL_FONT_SIZE_METERS * TRANSITION_LABEL_ASCENT_RATIO,
  descentMeters: TRANSITION_LABEL_FONT_SIZE_METERS * TRANSITION_LABEL_DESCENT_RATIO,
  widthMeters: 6,
});

const NINE_METER_LINE_LABEL_MARGIN_METERS = 1;
const CENTER_CIRCLE_LABEL_MARGIN_METERS = 1;
// Exact thirds make goal-line-adjacency an exact equality in practice,
// but a small epsilon keeps the classification robust to floating point.
const GOAL_LINE_ADJACENCY_EPSILON_METERS = 0.01;

export type TransitionZoneLabelPosition = {
  zoneId: TransitionZoneId;
  x: number;
  y: number;
};

/** Given a reference y (a line/edge in the court) and a required
 * margin, returns the ANCHOR y (for dominantBaseline="middle") such
 * that the label's real visual bounding box -- using its actual,
 * asymmetric ascent/descent offsets -- has its near edge sit EXACTLY
 * `marginMeters` away, on the requested side. */
function anchorYKeepingMargin(
  referenceY: number,
  marginMeters: number,
  box: TransitionLabelBox,
  extendsToward: "increasingY" | "decreasingY",
): number {
  return extendsToward === "increasingY"
    ? referenceY + marginMeters + box.ascentMeters
    : referenceY - marginMeters - box.descentMeters;
}

/**
 * Computes each transition zone's label anchor from the zone rects
 * `buildTransitionZones` already produced -- never a bare geometric
 * center, never a fresh direction-branching computation.
 */
export function buildTransitionZoneLabelPositions(
  zones: readonly TransitionZoneRect[],
  box: TransitionLabelBox = TRANSITION_LABEL_BOX,
): readonly TransitionZoneLabelPosition[] {
  const centerX = COURT_WIDTH_METERS / 2;
  const centerCircleTopY = COURT_LENGTH_METERS / 2 - CENTER_CIRCLE_RADIUS_METERS;

  return Object.freeze(
    zones.map((zone) => {
      const touchesTopGoalLine = Math.abs(zone.y) < GOAL_LINE_ADJACENCY_EPSILON_METERS;
      const touchesBottomGoalLine =
        Math.abs(zone.y + zone.height - COURT_LENGTH_METERS) < GOAL_LINE_ADJACENCY_EPSILON_METERS;

      let y: number;
      if (touchesTopGoalLine) {
        // Nearest the top goal -- sit just past ITS 9 m line (the flat
        // segment's depth, reusing FREE_THROW_RADIUS_METERS directly,
        // never a re-guessed number), text extending deeper into the
        // court (toward the halfway line). The box's TOP edge is the
        // near edge here, so it's offset by the ASCENT.
        y = anchorYKeepingMargin(FREE_THROW_RADIUS_METERS, NINE_METER_LINE_LABEL_MARGIN_METERS, box, "increasingY");
      } else if (touchesBottomGoalLine) {
        // Mirror image of the top case -- near edge is the BOTTOM edge,
        // offset by the DESCENT.
        y = anchorYKeepingMargin(
          COURT_LENGTH_METERS - FREE_THROW_RADIUS_METERS,
          NINE_METER_LINE_LABEL_MARGIN_METERS,
          box,
          "decreasingY",
        );
      } else {
        // The middle (self-symmetric) zone -- always above the center
        // circle's topmost point, regardless of direction. Near edge is
        // the BOTTOM edge (offset by the DESCENT).
        y = anchorYKeepingMargin(centerCircleTopY, CENTER_CIRCLE_LABEL_MARGIN_METERS, box, "decreasingY");
      }

      return { zoneId: zone.zoneId, x: centerX, y };
    }),
  );
}

// -- Physical object sizes --
// Still provisional REPRESENTATION measurements (not exact
// anthropometric/equipment data), but the relationship to the court must
// stay consistent across every viewport size -- meters, not pixels.
export const PLAYER_PHYSICAL_DIAMETER_METERS = 0.5;
// Handball size-3 ball circumference is 58-60 cm, i.e. ~0.19 m diameter.
export const BALL_PHYSICAL_DIAMETER_METERS = 0.19;
