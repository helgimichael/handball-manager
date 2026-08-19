/**
 * Drawing Engine -- the generic ritlager's core data model. This module
 * is the ONE place that defines what a drawing IS. It must stay strictly
 * split into two halves that never leak into each other:
 *
 *   - Geometry (DrawingGeometry): purely spatial -- POINT/LINE/POLYLINE/
 *     CURVE. Never knows a handball term exists. Every drawing tool
 *     (PLAYER_MOVEMENT/PASS/SHOT) always uses CURVE geometry -- see the
 *     Drawing Engine UX Refactor note on DrawingIntent below for why a
 *     single geometry kind covers both straight AND curved outcomes.
 *     LINE/POLYLINE remain in this union for a future geometry that
 *     genuinely needs them (e.g. a non-curved Area outline), not used by
 *     any drawing tool today.
 *   - Semantics (DrawingSemantic): what the drawing MEANS (PLAYER_MOVEMENT/
 *     PASS/SHOT). Semantics never encodes HOW to draw -- it only carries
 *     meaning plus (via drawingPresets.ts) a default appearance. Geometry
 *     code (DrawingRenderer.tsx, this file's translateDrawingGeometry)
 *     never reads `.semantic`.
 *
 * This exact seam was anticipated by scene/BoardObject.ts's own doc
 * comment ("a future tactical line/path ... a separate BoardPath type,
 * kept out of this union") -- DrawingObject is that seam, deliberately
 * NOT merged into BoardObject (players are single points with a role;
 * drawings are geometry with a meaning -- different shapes entirely).
 */

import type { MeterPoint } from "../geometry/CourtTransform.ts";
import {
  anchorPointFromMeterPoint,
  type AnchorPoint,
  type AnchorAttachmentRef,
  type PointConstraint,
} from "../spatial/AnchorPoint.ts";
import { DRAWING_PRESETS } from "./drawingPresets.ts";
import type { ObjectReference } from "../scene/ObjectReference.ts";

// -- Geometry: purely spatial, no domain knowledge --

export type DrawingGeometry =
  | { kind: "POINT"; point: AnchorPoint }
  | { kind: "LINE"; start: AnchorPoint; end: AnchorPoint }
  | { kind: "POLYLINE"; points: readonly AnchorPoint[] }
  | { kind: "CURVE"; points: readonly AnchorPoint[] }; // control points; interpolation (quadratic/cubic) is a future renderer concern, not stored here

export type ResolvedDrawingGeometry =
  | { kind: "POINT"; point: MeterPoint }
  | { kind: "LINE"; start: MeterPoint; end: MeterPoint }
  | { kind: "POLYLINE"; points: readonly MeterPoint[] }
  | { kind: "CURVE"; points: readonly MeterPoint[] };

export type DrawingGeometryInput = DrawingGeometry | ResolvedDrawingGeometry;

// -- Semantics: what the drawing MEANS, never how it's drawn --

// Named "Intent" (not "SemanticType") so the geometry/semantics split
// reads unambiguously at every call site -- this is never a shape.
//
// Drawing Engine UX Refactor: collapsed from six intents (a straight and
// a curved variant per tactical meaning) down to exactly three -- one per
// tactical meaning. Geometry (straight vs curved) is now decided PURELY
// by how many anchors the coach places during a single click-sequence
// gesture (see MasterCourt.tsx and the Workspace's own click-sequence
// handlers): 2 anchors is a
// straight line, 3+ is a smooth curve, both are the SAME CURVE geometry
// kind (buildSmoothCurvePathD in curveInterpolation.ts already collapses
// to a straight `L` segment for exactly 2 points -- see that function's
// own comment). There is therefore no longer a PLAYER_PATH/PASS_CURVED/
// SHOT_CURVED-style second member per family: DrawingIntent now maps
// 1:1 onto "what does this drawing mean", never onto "what shape did the
// coach happen to draw it with".
export type DrawingIntent = "PLAYER_MOVEMENT" | "PASS" | "SHOT";

// Only "USER" is ever produced in v1 -- the union exists now so a future
// AI-suggested or system-generated drawing needs no type migration.
export type DrawingCreator = "USER" | "AI" | "SYSTEM";

export type PlayerMovementSemantic = { type: "PLAYER_MOVEMENT"; createdBy: DrawingCreator };
export type PassSemantic = { type: "PASS"; createdBy: DrawingCreator };
export type ShotSemantic = { type: "SHOT"; createdBy: DrawingCreator };

// Discriminated union on `type` -- grows alongside DrawingIntent as new
// tactical meanings are added (each a new member here, never a field
// bolted onto this one).
export type DrawingSemantic = PlayerMovementSemantic | PassSemantic | ShotSemantic;

// -- Style: resolved, storable per-object, but SEEDED from a preset (see
// drawingPresets.ts) -- meters for strokeWidth/arrowSize, matching every
// other meter-based size in this codebase (BOARD_OBJECT_DEFINITIONS.
// strokeWidth etc.). arrowSize is the arrowhead's length in meters; 0
// means "no arrowhead" (a future non-directional drawing type, e.g. an
// Area outline, can reuse this same style shape without special-casing
// the renderer -- see DrawingRenderer.tsx's arrowhead branch).
// strokeDasharray is a raw SVG dasharray string ("" = solid) -- Rörelse
// is locked solid, Passning/Skott are locked dashed (see
// drawingPresets.ts), and the field is generic enough that a future
// drawing type can pick its own pattern without a renderer change.
export type DrawingStyle = { color: string; strokeWidth: number; arrowSize: number; strokeDasharray: string };

export type DrawingObject = {
  id: string;
  geometry: DrawingGeometry;
  semantic: DrawingSemantic;
  style: DrawingStyle;
  selected: boolean;
  // First-class field, never duplicated inside `semantic` -- locking is a
  // geometry-engine concern (can this object be moved/deleted right now),
  // not a tactical-meaning concern.
  locked: boolean;
  // Optional reference to another scene entity (typically a BoardObject),
  // by id -- see scene/ObjectReference.ts. Inert in v1: nothing reads this
  // to drive behavior (no follow/animate logic). No UI sets it yet either;
  // it exists as a tested engine capability for a future tool to use.
  reference: ObjectReference | null;
};

export type CreateDrawingObjectInput = {
  id: string;
  geometry: DrawingGeometryInput;
  semantic: DrawingSemantic;
  // Omitted -> resolved from DRAWING_PRESETS[semantic.type].style. Storing
  // the resolved style ON the object (rather than re-resolving it from the
  // preset on every render) is what lets a future per-object style
  // override exist without changing this shape.
  style?: DrawingStyle;
  selected?: boolean;
  locked?: boolean;
  reference?: ObjectReference | null;
};

export function createDrawingObject(input: CreateDrawingObjectInput): DrawingObject {
  const style = input.style ?? DRAWING_PRESETS[input.semantic.type].style;

  const object: DrawingObject = {
    id: input.id,
    geometry: freezeGeometry(input.geometry),
    semantic: Object.freeze({ ...input.semantic }),
    style: Object.freeze({ ...style }),
    selected: input.selected ?? false,
    locked: input.locked ?? false,
    reference: input.reference ? Object.freeze({ ...input.reference }) : null,
  };

  return Object.freeze(object);
}

function cloneMeterPoint(point: MeterPoint): MeterPoint {
  return Object.freeze({ x: point.x, y: point.y });
}

function isAnchorPoint(point: AnchorPoint | MeterPoint): point is AnchorPoint {
  return "fallbackPosition" in point;
}

function cloneConstraint(constraint: PointConstraint | undefined): PointConstraint | undefined {
  if (!constraint) {
    return undefined;
  }
  function cloneAttachment(attachment: AnchorAttachmentRef): AnchorAttachmentRef {
    if (attachment.kind === "LOCAL_OFFSET") {
      return Object.freeze({ kind: attachment.kind, offset: cloneMeterPoint(attachment.offset) });
    }
    if (attachment.kind === "BOUNDARY") {
      return Object.freeze({ kind: attachment.kind, localOffset: cloneMeterPoint(attachment.localOffset) });
    }
    return Object.freeze({ ...attachment });
  }
  if (constraint.kind === "RELATIVE") {
    return Object.freeze({
      kind: constraint.kind,
      target: Object.freeze({ ...constraint.target }),
      attachment: cloneAttachment(constraint.attachment),
      offset: cloneMeterPoint(constraint.offset),
    });
  }
  if (constraint.kind === "ANCHORED") {
    return Object.freeze({
      kind: constraint.kind,
      target: Object.freeze({ ...constraint.target }),
      attachment: cloneAttachment(constraint.attachment),
    });
  }
  return Object.freeze({ ...constraint });
}

function cloneAnchorPoint(point: AnchorPoint): AnchorPoint {
  return Object.freeze({
    fallbackPosition: cloneMeterPoint(point.fallbackPosition),
    constraint: cloneConstraint(point.constraint),
  });
}

function normalizeAnchorPoint(point: AnchorPoint | MeterPoint): AnchorPoint {
  return isAnchorPoint(point) ? cloneAnchorPoint(point) : anchorPointFromMeterPoint(point);
}

function pointToMeterPoint(point: AnchorPoint | MeterPoint): MeterPoint {
  return isAnchorPoint(point) ? point.fallbackPosition : point;
}

function shiftAnchorPoint(point: AnchorPoint, delta: MeterPoint): AnchorPoint {
  return Object.freeze({
    fallbackPosition: Object.freeze({
      x: point.fallbackPosition.x + delta.x,
      y: point.fallbackPosition.y + delta.y,
    }),
    constraint: cloneConstraint(point.constraint),
  });
}

function freezeGeometry(geometry: DrawingGeometryInput): DrawingGeometry {
  if (geometry.kind === "POINT") {
    return Object.freeze({ kind: "POINT", point: normalizeAnchorPoint(geometry.point) });
  }
  if (geometry.kind === "LINE") {
    return Object.freeze({
      kind: "LINE",
      start: normalizeAnchorPoint(geometry.start),
      end: normalizeAnchorPoint(geometry.end),
    });
  }
  return Object.freeze({
    kind: geometry.kind,
    points: Object.freeze(geometry.points.map(normalizeAnchorPoint)),
  });
}

/**
 * Generic geometry translation -- shifts every point in ANY geometry kind
 * by the same delta. Deliberately reads nothing but `geometry`; a caller
 * moving a DrawingObject never needs to know (and this function never
 * knows) what the object means.
 */
export function translateDrawingGeometry(geometry: DrawingGeometry, delta: MeterPoint): DrawingGeometry {
  if (geometry.kind === "POINT") {
    return Object.freeze({ kind: "POINT", point: shiftAnchorPoint(geometry.point, delta) });
  }
  if (geometry.kind === "LINE") {
    return Object.freeze({
      kind: "LINE",
      start: shiftAnchorPoint(geometry.start, delta),
      end: shiftAnchorPoint(geometry.end, delta),
    });
  }
  return Object.freeze({
    kind: geometry.kind,
    points: Object.freeze(geometry.points.map((point) => shiftAnchorPoint(point, delta))),
  });
}

/**
 * Generic point accessor -- the individually-draggable points of ANY
 * geometry kind, in a stable order (index 0 = LINE's `start`, index 1 =
 * LINE's `end`; POLYLINE/CURVE in array order). Used only to RENDER
 * endpoint handles and to address a point for setDrawingGeometryPoint
 * below -- never reads `semantic`, never special-cases PLAYER_MOVEMENT.
 */
export function getDrawingGeometryPoints(geometry: DrawingGeometry | ResolvedDrawingGeometry): readonly MeterPoint[] {
  if (geometry.kind === "POINT") {
    return [pointToMeterPoint(geometry.point)];
  }
  if (geometry.kind === "LINE") {
    return [pointToMeterPoint(geometry.start), pointToMeterPoint(geometry.end)];
  }
  return geometry.points.map(pointToMeterPoint);
}

/**
 * Generic point replacement -- moves ONE point (by index, see
 * getDrawingGeometryPoints) to a new absolute position, leaving every
 * other point untouched. This is what endpoint-drag editing calls;
 * translateDrawingGeometry (above) remains the whole-shape move.
 */
export function setDrawingGeometryPoint(geometry: DrawingGeometry, index: number, position: MeterPoint): DrawingGeometry {
  const point = anchorPointFromMeterPoint(position);
  // Untouched points are re-frozen too (not just passed through), so the
  // result is unconditionally frozen regardless of whether the input
  // geometry already was -- matching freezeGeometry/translateDrawingGeometry's
  // guarantee elsewhere in this file.
  function keep(existing: AnchorPoint): AnchorPoint {
    return cloneAnchorPoint(existing);
  }

  if (geometry.kind === "POINT") {
    return Object.freeze({ kind: "POINT", point });
  }
  if (geometry.kind === "LINE") {
    return Object.freeze({
      kind: "LINE",
      start: index === 0 ? point : keep(geometry.start),
      end: index === 1 ? point : keep(geometry.end),
    });
  }
  return Object.freeze({
    kind: geometry.kind,
    points: Object.freeze(geometry.points.map((existing, i) => (i === index ? point : keep(existing)))),
  });
}

export function setDrawingGeometryAnchorPoint(
  geometry: DrawingGeometry,
  index: number,
  point: AnchorPoint,
): DrawingGeometry {
  const nextPoint = cloneAnchorPoint(point);

  function keep(existing: AnchorPoint): AnchorPoint {
    return cloneAnchorPoint(existing);
  }

  if (geometry.kind === "POINT") {
    return Object.freeze({ kind: "POINT", point: nextPoint });
  }
  if (geometry.kind === "LINE") {
    return Object.freeze({
      kind: "LINE",
      start: index === 0 ? nextPoint : keep(geometry.start),
      end: index === 1 ? nextPoint : keep(geometry.end),
    });
  }
  return Object.freeze({
    kind: geometry.kind,
    points: Object.freeze(geometry.points.map((existing, i) => (i === index ? nextPoint : keep(existing)))),
  });
}

/**
 * Generic end-direction accessor -- the point ANY geometry kind ends at,
 * plus the direction of travel approaching it (the vector from the
 * second-to-last point to the last one). Used today to orient an
 * arrowhead (see DrawingRenderer.tsx), but deliberately generic and
 * geometry-only (never reads `semantic`, never special-cases straight vs
 * curved) so it is equally reusable by a future feature that needs
 * "which way is this drawing pointing" for a reason other than rendering
 * -- e.g. orienting a player at the end of an animated PLAYER_MOVEMENT.
 * Returns null when the geometry has fewer than 2 points (POINT, or a
 * degenerate 0/1-point POLYLINE/CURVE) -- there is no direction to report.
 */
export function getDrawingEndDirection(
  geometry: DrawingGeometry | ResolvedDrawingGeometry,
): { point: MeterPoint; angleRadians: number } | null {
  const points = getDrawingGeometryPoints(geometry);
  if (points.length < 2) {
    return null;
  }
  const end = points[points.length - 1];
  const previous = points[points.length - 2];
  const dx = end.x - previous.x;
  const dy = end.y - previous.y;
  if (dx === 0 && dy === 0) {
    return null;
  }
  return { point: end, angleRadians: Math.atan2(dy, dx) };
}
