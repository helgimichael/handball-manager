import {
  COURT_LENGTH_METERS,
  COURT_WIDTH_METERS,
  FREE_THROW_RADIUS_METERS,
  GOAL_POST_LEFT_X,
  GOAL_POST_RIGHT_X
} from "../../domain/geometry/court";
import type { MeterPoint, MeterVector } from "../../domain/geometry/coordinates";
import { addVectors, clampPointToBounds, normalizeVector, scaleVector, subtractPoints } from "../../domain/geometry/coordinates";

export type DefensiveZoneId = "ZONE_1_LEFT" | "ZONE_2_LEFT" | "ZONE_3" | "ZONE_2_RIGHT" | "ZONE_1_RIGHT";
export type DefensiveGoalSide = "top" | "bottom";

export type DefensiveZonePolygon = {
  id: string;
  zoneId: DefensiveZoneId;
  goalSide: DefensiveGoalSide;
  label: string;
  displayLabel: "H1" | "H2" | "3" | "V2" | "V1";
  threatLevel: "low" | "medium" | "high";
  d: string;
};

export type DefensiveZoneLabelPosition = {
  id: string;
  goalSide: DefensiveGoalSide;
  text: DefensiveZonePolygon["displayLabel"];
  x: number;
  y: number;
  rotation: number;
  fontSize: number;
};

type DividerLine = {
  id: "V1_V2" | "V2_3";
  start: MeterPoint;
  end: MeterPoint;
};

type DefensiveZoneCalibration = {
  version: 2;
  v1v2: DividerLine;
};

type LabelTransform = { x: number; y: number; rotation: number; fontSize: number };

const DEFENSIVE_ZONE_IDS: readonly DefensiveZoneId[] = [
  "ZONE_1_LEFT",
  "ZONE_2_LEFT",
  "ZONE_3",
  "ZONE_2_RIGHT",
  "ZONE_1_RIGHT"
];

const DEFENSIVE_ZONE_LABELS: Record<DefensiveZoneId, string> = {
  ZONE_1_LEFT: "Zon 1 vänster",
  ZONE_2_LEFT: "Zon 2 vänster",
  ZONE_3: "Zon 3",
  ZONE_2_RIGHT: "Zon 2 höger",
  ZONE_1_RIGHT: "Zon 1 höger"
};

const TOP_DISPLAY_LABELS: Record<DefensiveZoneId, DefensiveZonePolygon["displayLabel"]> = {
  ZONE_1_LEFT: "H1",
  ZONE_2_LEFT: "H2",
  ZONE_3: "3",
  ZONE_2_RIGHT: "V2",
  ZONE_1_RIGHT: "V1"
};

const BOTTOM_DISPLAY_LABELS: Record<DefensiveZoneId, DefensiveZonePolygon["displayLabel"]> = {
  ZONE_1_LEFT: "V1",
  ZONE_2_LEFT: "V2",
  ZONE_3: "3",
  ZONE_2_RIGHT: "H2",
  ZONE_1_RIGHT: "H1"
};

const DEFENSIVE_ZONE_THREAT_LEVEL: Record<DefensiveZoneId, "low" | "medium" | "high"> = {
  ZONE_1_LEFT: "low",
  ZONE_2_LEFT: "medium",
  ZONE_3: "high",
  ZONE_2_RIGHT: "medium",
  ZONE_1_RIGHT: "low"
};

const CONSTRUCTION_LINE_LENGTH_METERS = 13;
const LEFT_DIVIDER_ORIGIN: MeterPoint = Object.freeze({ x: GOAL_POST_LEFT_X - 1, y: 0 });

const APPROVED_DEFENSIVE_ZONE_CALIBRATION: DefensiveZoneCalibration = Object.freeze({
  version: 2,
  v1v2: Object.freeze({
    id: "V1_V2",
    start: LEFT_DIVIDER_ORIGIN,
    end: Object.freeze({ x: -3.222844228424707, y: 7.349871539893668 })
  })
}) as DefensiveZoneCalibration;

const APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION = Object.freeze({
  version: 1,
  h1: Object.freeze({ x: 3.595505617977528, y: 1.2816011235955056, rotation: 72.64597536373867, fontSize: 1 }),
  h2: Object.freeze({ x: 5.50561797752809, y: 3.922050561797753, rotation: 39.400660663479414, fontSize: 1.05 }),
  center: Object.freeze({ x: 10, y: 5.101825842696629, rotation: 0, fontSize: 1.1 })
});

function addPoints(a: MeterPoint, b: MeterVector): MeterPoint {
  return addVectors(a, b);
}

function dotProduct(a: MeterVector, b: MeterVector): number {
  return a.x * b.x + a.y * b.y;
}

function mirrorPointAcrossVerticalLine(point: MeterPoint, axisX: number): MeterPoint {
  return { x: axisX * 2 - point.x, y: point.y };
}

function mirrorPointAcrossHorizontalLine(point: MeterPoint, axisY: number): MeterPoint {
  return { x: point.x, y: axisY * 2 - point.y };
}

function mirrorRotationAcrossVerticalLine(rotationDegrees: number): number {
  return (360 - (rotationDegrees % 360) + 360) % 360;
}

function mirrorRotationAcrossHorizontalLine(rotationDegrees: number): number {
  return (180 - (rotationDegrees % 360) + 360) % 360;
}

function constructionRayEnd(direction: MeterVector): MeterPoint {
  return addPoints(LEFT_DIVIDER_ORIGIN, scaleVector(direction, CONSTRUCTION_LINE_LENGTH_METERS));
}

const FIXED_V2_3_DIVIDER: DividerLine = Object.freeze({
  id: "V2_3",
  start: LEFT_DIVIDER_ORIGIN,
  end: constructionRayEnd({ x: 0, y: 1 })
});

function mirrorDividerAcrossVertical(divider: DividerLine, axisX: number): DividerLine {
  return Object.freeze({
    id: divider.id,
    start: mirrorPointAcrossVerticalLine(divider.start, axisX),
    end: mirrorPointAcrossVerticalLine(divider.end, axisX)
  });
}

function mirrorDividerAcrossHorizontal(divider: DividerLine, axisY: number): DividerLine {
  return Object.freeze({
    id: divider.id,
    start: mirrorPointAcrossHorizontalLine(divider.start, axisY),
    end: mirrorPointAcrossHorizontalLine(divider.end, axisY)
  });
}

function deriveFullDividerSet(calibration: DefensiveZoneCalibration): readonly [DividerLine, DividerLine, DividerLine, DividerLine] {
  const v12 = calibration.v1v2;
  const v23 = FIXED_V2_3_DIVIDER;
  const axisX = COURT_WIDTH_METERS / 2;

  return Object.freeze([v12, v23, mirrorDividerAcrossVertical(v23, axisX), mirrorDividerAcrossVertical(v12, axisX)]);
}

type CurveHit = { distance: number; point: MeterPoint };

function intersectRayWithArc(origin: MeterPoint, direction: MeterVector, center: MeterPoint, domainMinX: number, domainMaxX: number): CurveHit | null {
  const toOrigin = subtractPoints(origin, center);
  const b = 2 * dotProduct(direction, toOrigin);
  const c = dotProduct(toOrigin, toOrigin) - FREE_THROW_RADIUS_METERS * FREE_THROW_RADIUS_METERS;
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
    const point = addPoints(origin, scaleVector(direction, distance));
    if (point.y < 0 || point.x < domainMinX || point.x > domainMaxX) {
      continue;
    }
    if (!best || distance < best.distance) {
      best = { distance, point };
    }
  }

  return best;
}

function intersectRayWithFlatSegment(origin: MeterPoint, direction: MeterVector): CurveHit | null {
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

function clipDividerToNineMeterCurve(divider: DividerLine): MeterPoint {
  const direction = normalizeVector(subtractPoints(divider.end, divider.start));
  const hits = [
    intersectRayWithArc(divider.start, direction, { x: GOAL_POST_LEFT_X, y: 0 }, GOAL_POST_LEFT_X - FREE_THROW_RADIUS_METERS, GOAL_POST_LEFT_X),
    intersectRayWithFlatSegment(divider.start, direction),
    intersectRayWithArc(divider.start, direction, { x: GOAL_POST_RIGHT_X, y: 0 }, GOAL_POST_RIGHT_X, GOAL_POST_RIGHT_X + FREE_THROW_RADIUS_METERS)
  ].filter((hit): hit is CurveHit => hit !== null);

  if (hits.length === 0) {
    return clampPointToBounds(divider.end, { minX: 0, minY: 0, maxX: COURT_WIDTH_METERS, maxY: COURT_LENGTH_METERS });
  }

  return hits.reduce((closest, hit) => (hit.distance < closest.distance ? hit : closest)).point;
}

function pointOnNineMeterCurveAtX(x: number): MeterPoint {
  if (x <= GOAL_POST_LEFT_X) {
    const dx = x - GOAL_POST_LEFT_X;
    return { x, y: Math.sqrt(Math.max(0, FREE_THROW_RADIUS_METERS * FREE_THROW_RADIUS_METERS - dx * dx)) };
  }
  if (x >= GOAL_POST_RIGHT_X) {
    const dx = x - GOAL_POST_RIGHT_X;
    return { x, y: Math.sqrt(Math.max(0, FREE_THROW_RADIUS_METERS * FREE_THROW_RADIUS_METERS - dx * dx)) };
  }
  return { x, y: FREE_THROW_RADIUS_METERS };
}

function nineMeterCurveSegmentAt(x: number): 0 | 1 | 2 {
  if (x <= GOAL_POST_LEFT_X) {
    return 0;
  }
  if (x >= GOAL_POST_RIGHT_X) {
    return 2;
  }
  return 1;
}

function nineMeterCurveSegmentCommands(from: MeterPoint, to: MeterPoint, goalY: number, direction: 1 | -1): string {
  const sweep = direction === 1 ? 0 : 1;
  const flatY = goalY + direction * FREE_THROW_RADIUS_METERS;
  const leftArcEnd: MeterPoint = { x: GOAL_POST_LEFT_X, y: flatY };
  const rightArcStart: MeterPoint = { x: GOAL_POST_RIGHT_X, y: flatY };
  const fromSegment = nineMeterCurveSegmentAt(from.x);
  const toSegment = nineMeterCurveSegmentAt(to.x);
  const commands: string[] = [];

  if (fromSegment === 0) {
    const arcTo = toSegment === 0 ? to : leftArcEnd;
    commands.push(`A ${FREE_THROW_RADIUS_METERS} ${FREE_THROW_RADIUS_METERS} 0 0 ${sweep} ${arcTo.x} ${arcTo.y}`);
  }
  if (toSegment >= 1 && fromSegment <= 1) {
    const flatTo = toSegment === 1 ? to : rightArcStart;
    commands.push(`L ${flatTo.x} ${flatTo.y}`);
  }
  if (toSegment === 2) {
    commands.push(`A ${FREE_THROW_RADIUS_METERS} ${FREE_THROW_RADIUS_METERS} 0 0 ${sweep} ${to.x} ${to.y}`);
  }

  return commands.join(" ");
}

function buildLeftEdgeZonePath(divider: DividerLine, clip: MeterPoint, sidelinePoint: MeterPoint, goalY: number, direction: 1 | -1): string {
  return [`M 0 ${divider.start.y}`, `L 0 ${sidelinePoint.y}`, nineMeterCurveSegmentCommands(sidelinePoint, clip, goalY, direction), `L ${divider.start.x} ${divider.start.y}`, "Z"]
    .filter((command) => command !== "")
    .join(" ");
}

function buildRightEdgeZonePath(divider: DividerLine, clip: MeterPoint, sidelinePoint: MeterPoint, goalY: number, direction: 1 | -1): string {
  return [`M ${divider.start.x} ${divider.start.y}`, `L ${clip.x} ${clip.y}`, nineMeterCurveSegmentCommands(clip, sidelinePoint, goalY, direction), `L ${COURT_WIDTH_METERS} ${divider.start.y}`, "Z"]
    .filter((command) => command !== "")
    .join(" ");
}

function buildInteriorZonePath(left: DividerLine, leftClip: MeterPoint, right: DividerLine, rightClip: MeterPoint, goalY: number, direction: 1 | -1): string {
  return [`M ${left.start.x} ${left.start.y}`, `L ${leftClip.x} ${leftClip.y}`, nineMeterCurveSegmentCommands(leftClip, rightClip, goalY, direction), `L ${right.start.x} ${right.start.y}`, "Z"]
    .filter((command) => command !== "")
    .join(" ");
}

function buildZonePolygonsForGoal(topDividers: readonly [DividerLine, DividerLine, DividerLine, DividerLine], goalSide: DefensiveGoalSide): readonly DefensiveZonePolygon[] {
  const axisY = COURT_LENGTH_METERS / 2;
  const toGoalSide = <T extends MeterPoint>(point: T): T => (goalSide === "bottom" ? (mirrorPointAcrossHorizontalLine(point, axisY) as T) : point);
  const dividerToGoalSide = (divider: DividerLine): DividerLine => (goalSide === "bottom" ? mirrorDividerAcrossHorizontal(divider, axisY) : divider);
  const [d1, d2, d3, d4] = topDividers.map(dividerToGoalSide) as [DividerLine, DividerLine, DividerLine, DividerLine];
  const [clip1, clip2, clip3, clip4] = topDividers.map((divider) => toGoalSide(clipDividerToNineMeterCurve(divider))) as [
    MeterPoint,
    MeterPoint,
    MeterPoint,
    MeterPoint
  ];
  const leftSidelinePoint = toGoalSide(pointOnNineMeterCurveAtX(0));
  const rightSidelinePoint = toGoalSide(pointOnNineMeterCurveAtX(COURT_WIDTH_METERS));
  const goalY = goalSide === "top" ? 0 : COURT_LENGTH_METERS;
  const direction: 1 | -1 = goalSide === "top" ? 1 : -1;
  const displayLabels = goalSide === "top" ? TOP_DISPLAY_LABELS : BOTTOM_DISPLAY_LABELS;
  const pathByZoneId: Record<DefensiveZoneId, string> = {
    ZONE_1_LEFT: buildLeftEdgeZonePath(d1, clip1, leftSidelinePoint, goalY, direction),
    ZONE_2_LEFT: buildInteriorZonePath(d1, clip1, d2, clip2, goalY, direction),
    ZONE_3: buildInteriorZonePath(d2, clip2, d3, clip3, goalY, direction),
    ZONE_2_RIGHT: buildInteriorZonePath(d3, clip3, d4, clip4, goalY, direction),
    ZONE_1_RIGHT: buildRightEdgeZonePath(d4, clip4, rightSidelinePoint, goalY, direction)
  };

  return DEFENSIVE_ZONE_IDS.map((zoneId) => ({
    id: `defensive-${goalSide}-${zoneId}`,
    zoneId,
    goalSide,
    label: DEFENSIVE_ZONE_LABELS[zoneId],
    displayLabel: displayLabels[zoneId],
    threatLevel: DEFENSIVE_ZONE_THREAT_LEVEL[zoneId],
    d: pathByZoneId[zoneId]
  }));
}

export function buildCanonicalDefensiveZonePolygons(): readonly DefensiveZonePolygon[] {
  const topDividers = deriveFullDividerSet(APPROVED_DEFENSIVE_ZONE_CALIBRATION);
  return Object.freeze([...buildZonePolygonsForGoal(topDividers, "top"), ...buildZonePolygonsForGoal(topDividers, "bottom")]);
}

function mirrorLabelAcrossVertical(transform: LabelTransform, axisX: number): LabelTransform {
  const mirroredPoint = mirrorPointAcrossVerticalLine({ x: transform.x, y: transform.y }, axisX);
  return { x: mirroredPoint.x, y: mirroredPoint.y, rotation: mirrorRotationAcrossVerticalLine(transform.rotation), fontSize: transform.fontSize };
}

function mirrorLabelAcrossHorizontal(transform: LabelTransform, axisY: number): LabelTransform {
  const mirroredPoint = mirrorPointAcrossHorizontalLine({ x: transform.x, y: transform.y }, axisY);
  return { x: mirroredPoint.x, y: mirroredPoint.y, rotation: mirrorRotationAcrossHorizontalLine(transform.rotation), fontSize: transform.fontSize };
}

export function buildCanonicalDefensiveZoneLabelPositions(): readonly DefensiveZoneLabelPosition[] {
  const axisX = COURT_WIDTH_METERS / 2;
  const axisY = COURT_LENGTH_METERS / 2;
  const topH1 = APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION.h1;
  const topH2 = APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION.h2;
  const top3 = APPROVED_DEFENSIVE_ZONE_LABEL_CALIBRATION.center;
  const topV1 = mirrorLabelAcrossVertical(topH1, axisX);
  const topV2 = mirrorLabelAcrossVertical(topH2, axisX);
  const bottomV1 = mirrorLabelAcrossHorizontal(topH1, axisY);
  const bottomV2 = mirrorLabelAcrossHorizontal(topH2, axisY);
  const bottom3 = mirrorLabelAcrossHorizontal(top3, axisY);
  const bottomH2 = mirrorLabelAcrossHorizontal(topV2, axisY);
  const bottomH1 = mirrorLabelAcrossHorizontal(topV1, axisY);

  function toPosition(goalSide: DefensiveGoalSide, text: DefensiveZoneLabelPosition["text"], transform: LabelTransform): DefensiveZoneLabelPosition {
    return { id: `${goalSide}-${text}`, goalSide, text, x: transform.x, y: transform.y, rotation: transform.rotation, fontSize: transform.fontSize };
  }

  return Object.freeze([
    toPosition("top", "H1", topH1),
    toPosition("top", "H2", topH2),
    toPosition("top", "3", top3),
    toPosition("top", "V2", topV2),
    toPosition("top", "V1", topV1),
    toPosition("bottom", "V1", bottomV1),
    toPosition("bottom", "V2", bottomV2),
    toPosition("bottom", "3", bottom3),
    toPosition("bottom", "H2", bottomH2),
    toPosition("bottom", "H1", bottomH1)
  ]);
}

function normalizePointToTopGoal(point: MeterPoint): { point: MeterPoint; goalSide: DefensiveGoalSide } | null {
  if (point.y >= 0 && point.y <= FREE_THROW_RADIUS_METERS) {
    return { point, goalSide: "top" };
  }
  if (point.y >= COURT_LENGTH_METERS - FREE_THROW_RADIUS_METERS && point.y <= COURT_LENGTH_METERS) {
    return { point: mirrorPointAcrossHorizontalLine(point, COURT_LENGTH_METERS / 2), goalSide: "bottom" };
  }
  return null;
}

function isPointInsideTopNineMeterShape(point: MeterPoint): boolean {
  if (point.x < 0 || point.x > COURT_WIDTH_METERS || point.y < 0) {
    return false;
  }

  return point.y <= pointOnNineMeterCurveAtX(point.x).y + 1e-9;
}

function dividerXAtY(divider: DividerLine, y: number): number {
  const dy = divider.end.y - divider.start.y;
  if (Math.abs(dy) < 1e-9) {
    return divider.start.x;
  }
  const t = (y - divider.start.y) / dy;
  return divider.start.x + (divider.end.x - divider.start.x) * t;
}

export function getDefenseZoneAtPosition(point: MeterPoint): DefensiveZonePolygon | null {
  const normalized = normalizePointToTopGoal(point);
  if (!normalized || !isPointInsideTopNineMeterShape(normalized.point)) {
    return null;
  }

  const [d1, d2, d3, d4] = deriveFullDividerSet(APPROVED_DEFENSIVE_ZONE_CALIBRATION);
  const x = normalized.point.x;
  const y = normalized.point.y;
  const boundaries = [dividerXAtY(d1, y), dividerXAtY(d2, y), dividerXAtY(d3, y), dividerXAtY(d4, y)];
  const index = x <= boundaries[0] ? 0 : x <= boundaries[1] ? 1 : x <= boundaries[2] ? 2 : x <= boundaries[3] ? 3 : 4;
  const zoneId = DEFENSIVE_ZONE_IDS[index];

  return buildCanonicalDefensiveZonePolygons().find((zone) => zone.goalSide === normalized.goalSide && zone.zoneId === zoneId) ?? null;
}

export function isCanonicalDefensiveZonePath(d: string): boolean {
  return buildCanonicalDefensiveZonePolygons().some((zone) => zone.d === d);
}
