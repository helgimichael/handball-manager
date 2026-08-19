/**
 * Area Engine v1 -- the generic data model for a filled/outlined region on
 * the plan (Rectangle or Polygon). Same architectural shape as
 * drawing/DrawingObject.ts (frozen, plain-data, a create* constructor, a
 * shared set of generic geometry helpers used by both kinds) -- reused
 * deliberately, not reinvented, so the Area Engine slots into the same
 * scene/rendering/interaction machinery the Drawing Engine already proved
 * out (endpoint/vertex handles, move-by-delta, Undo via gesture-start/end)
 * instead of becoming a second, parallel engine.
 *
 * Unlike drawings, an Area has no separate "semantics" layer in v1 -- it
 * IS its shape (a region), with no tactical meaning attached yet (no
 * PASS/SHOT-style intent union). A future analysis/training-design feature
 * that needs to tag an Area with a meaning (e.g. "pressing zone",
 * "shooting zone") can add that the exact same way DrawingObject grew
 * `semantic` -- a new, additive field, never a rewrite of this one.
 *
 * "resize" and "vertex editing" are UNIFIED into ONE generic mechanism
 * here (getAreaGeometryPoints/setAreaGeometryPoint), exactly like
 * DrawingObject's endpoint editing already unifies "drag a LINE's
 * endpoint" and "drag a CURVE's anchor": a Polygon's vertices ARE its
 * resize handles (dragging one reshapes the polygon); a Rectangle's 4
 * corners are exposed as the same kind of point, and dragging one resizes
 * the rectangle (recomputing x/y/width/height, opposite corner fixed).
 * Callers never need two different code paths for "resize" vs "reshape".
 */

import { rotatePointAroundCenter, type MeterPoint } from "../geometry/CourtTransform.ts";
import type { ObjectReference } from "../scene/ObjectReference.ts";

export type RectangleAreaGeometry = {
  kind: "RECTANGLE";
  // Un-rotated, top-left-anchored bounds (x/y/width/height always describe
  // the LOCAL, pre-rotation rectangle) -- `rotation` is applied as a
  // separate transform around the rectangle's own centroid at render time
  // (see AreaRenderer.tsx) and when computing/interpreting handle
  // positions (see rotatePointAroundCenter in CourtTransform.ts), never
  // baked into x/y/width/height. This keeps resize math simple (always
  // axis-aligned in local space) regardless of the current rotation.
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type PolygonAreaGeometry = {
  kind: "POLYGON";
  // Ordered vertex list, local (pre-rotation) coordinates -- same
  // rotation-as-separate-transform convention as RECTANGLE above, so a
  // rotated polygon's stored points never need rewriting just because the
  // coach rotated it.
  points: readonly MeterPoint[];
  rotation: number;
  // Explicit, PERSISTENT rotation pivot -- deliberately NOT derived from
  // getAreaCentroid(geometry) at render/interaction time (see
  // getAreaRotationPivot's doc comment below for the full root-cause
  // story: averaging the LIVE points as the pivot means editing ONE
  // vertex silently moves the pivot every OTHER vertex is rotated around,
  // so a vertex whose local coordinate is completely untouched still
  // visibly drifts in world space the instant rotation != 0). Set once,
  // at creation, to the polygon's initial centroid (see
  // computePolygonPointsCentroid) -- from then on it is ONLY ever shifted
  // by translateAreaGeometry (a whole-shape move legitimately moves its
  // own pivot too) and is otherwise held perfectly fixed by every other
  // mutation (vertex edits via setAreaGeometryPoint, rotation changes via
  // setAreaRotation). This is what makes "only the dragged vertex moves
  // in world space, rotation is a pure numeric field, nothing jumps"
  // actually true, for any N >= 3, not just an approximation that
  // happens to look right for a rectangle's 2 diagonal pairs.
  transformOrigin: MeterPoint;
};

export type AreaGeometry = RectangleAreaGeometry | PolygonAreaGeometry;

// fillOpacity is a first-class, per-object number (not baked into
// fillColor as an rgba string) so a future analysis feature (heatmap
// cells, expected-threat overlays) can drive it directly and
// independently from color -- see the file header.
export type AreaStyle = {
  fillColor: string;
  strokeColor: string;
  fillOpacity: number;
  strokeWidth: number;
};

export type AreaObject = {
  id: string;
  geometry: AreaGeometry;
  style: AreaStyle;
  selected: boolean;
  locked: boolean;
  // Spatial Engine Epic I, Del 5 -- same generic, meaning-free
  // ObjectReference already used by DrawingObject.ts (see
  // scene/ObjectReference.ts's own doc comment): an Area can optionally
  // point at a BoardObject (any type, including BALL) by id. Inert in v1
  // -- nothing reads this to drive behavior; it exists as a tested engine
  // capability for a future tool (e.g. "this Area tracks a player's
  // pressing zone") to use, exactly like DrawingObject.reference.
  reference: ObjectReference | null;
};

export type CreateAreaObjectInput = {
  id: string;
  geometry: AreaGeometry;
  style?: AreaStyle;
  selected?: boolean;
  locked?: boolean;
  reference?: ObjectReference | null;
};

// Default appearance -- Rectangle and Polygon get distinct default colors
// (visual Area Engine correction) so the two tools read apart from each
// other at a glance without opening the tool panel. Hardcoded hex, not a
// --ds-color-* token, specifically because these two colors must NOT
// collide with any semantic color already spoken for elsewhere: violet
// and lime sit outside the whole existing palette --
// boardObjectDefinitions.ts's NEON_RED/NEON_BLUE/NEON_YELLOW (players),
// drawingPresets.ts's --ds-color-accent/#FFE100/#FF9500 (Rörelse/
// Passning/Skott), and --ds-color-success/-warning/-error/-info (generic
// UI chrome, including the single green this replaced). Both stay at a
// low fillOpacity, same magnitude as the previous shared default -- an
// Area is meant to read as a translucent zone overlay, never a solid
// block competing with the court's own markings.
const RECTANGLE_AREA_COLOR = "#8B5CF6"; // violet/lila
const POLYGON_AREA_COLOR = "#A3E635"; // lime/grön
const AREA_FILL_OPACITY = 0.18;
const AREA_STROKE_WIDTH = 0.08;

export const DEFAULT_RECTANGLE_AREA_STYLE: AreaStyle = {
  fillColor: RECTANGLE_AREA_COLOR,
  strokeColor: RECTANGLE_AREA_COLOR,
  fillOpacity: AREA_FILL_OPACITY,
  strokeWidth: AREA_STROKE_WIDTH,
};

export const DEFAULT_POLYGON_AREA_STYLE: AreaStyle = {
  fillColor: POLYGON_AREA_COLOR,
  strokeColor: POLYGON_AREA_COLOR,
  fillOpacity: AREA_FILL_OPACITY,
  strokeWidth: AREA_STROKE_WIDTH,
};

function defaultAreaStyleForGeometry(geometry: AreaGeometry): AreaStyle {
  return geometry.kind === "RECTANGLE" ? DEFAULT_RECTANGLE_AREA_STYLE : DEFAULT_POLYGON_AREA_STYLE;
}

export function createAreaObject(input: CreateAreaObjectInput): AreaObject {
  const style = input.style ?? defaultAreaStyleForGeometry(input.geometry);
  const object: AreaObject = {
    id: input.id,
    geometry: freezeAreaGeometry(input.geometry),
    style: Object.freeze({ ...style }),
    selected: input.selected ?? false,
    locked: input.locked ?? false,
    reference: input.reference ? Object.freeze({ ...input.reference }) : null,
  };
  return Object.freeze(object);
}

function freezeAreaGeometry(geometry: AreaGeometry): AreaGeometry {
  if (geometry.kind === "RECTANGLE") {
    return Object.freeze({ ...geometry });
  }
  return Object.freeze({
    kind: "POLYGON",
    points: Object.freeze(geometry.points.map((point) => Object.freeze({ ...point }))),
    rotation: geometry.rotation,
    transformOrigin: Object.freeze({ ...geometry.transformOrigin }),
  });
}

function rectangleCorners(geometry: RectangleAreaGeometry): MeterPoint[] {
  return [
    { x: geometry.x, y: geometry.y },
    { x: geometry.x + geometry.width, y: geometry.y },
    { x: geometry.x + geometry.width, y: geometry.y + geometry.height },
    { x: geometry.x, y: geometry.y + geometry.height },
  ];
}

/**
 * The plain average of a set of points -- the shared math behind
 * getAreaCentroid's POLYGON branch AND, separately, the ONE moment a
 * Polygon's transformOrigin is ever computed FROM its points: at
 * creation (see the Workspace integration, which calls this directly
 * before a PolygonAreaGeometry object even exists yet, to seed
 * `transformOrigin`). Never used again after that -- see
 * transformOrigin's own doc comment for why re-deriving it from live
 * points on every render/edit is exactly the bug this data model fixes.
 */
export function computePolygonPointsCentroid(points: readonly MeterPoint[]): MeterPoint {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * The centroid of an Area's LOCAL (pre-rotation) geometry -- i.e. its
 * actual, live geometric center, recomputed fresh from x/y/width/height
 * or points every time this is called. Still exactly right as a RENDER
 * pivot for RECTANGLE (see resizeRectangleToFixedAnchor's doc comment:
 * that function's math is specifically solved so the live centroid IS
 * the correct pivot after every resize). For POLYGON, this is NO LONGER
 * used as a rotation pivot anywhere (see getAreaRotationPivot below) --
 * it remains here only as a general "where is this shape's middle right
 * now" query, e.g. for UI that wants to point at a shape's visual center
 * without caring about its rotation pivot specifically.
 */
export function getAreaCentroid(geometry: AreaGeometry): MeterPoint {
  if (geometry.kind === "RECTANGLE") {
    return { x: geometry.x + geometry.width / 2, y: geometry.y + geometry.height / 2 };
  }
  return computePolygonPointsCentroid(geometry.points);
}

/**
 * The pivot every rotation transform (rendering, in AreaRenderer.tsx;
 * handle positioning, in MasterCourt.tsx; the RotationHandle's own
 * displayed position) is applied around -- the ONE function every one of
 * those call sites must use instead of reaching for getAreaCentroid
 * directly. RECTANGLE and POLYGON deliberately answer this differently:
 *
 * - RECTANGLE: the LIVE centroid (getAreaCentroid) -- correct because
 *   resizeRectangleToFixedAnchor's math is solved specifically so that,
 *   after every resize, the live centroid IS the rectangle's true
 *   center, and rotating a rectangle around its own true center is
 *   exactly right.
 * - POLYGON: the PERSISTENT, stored `transformOrigin` field -- NEVER the
 *   live centroid. This is the actual fix for "dragging one vertex moves
 *   several others": averaging live points as the pivot means editing
 *   ONE vertex silently relocates the pivot every OTHER vertex gets
 *   rotated around, so a vertex whose local coordinate never changed
 *   still visibly drifts in world space once rotation != 0 (invisible at
 *   rotation=0, where rotating around any pivot is the identity
 *   transform -- exactly why this bug was easy to miss until a rotated
 *   polygon was edited). Reading a fixed, edit-independent field instead
 *   guarantees every untouched vertex's world position is bit-for-bit
 *   identical before and after another vertex moves, for any N >= 3.
 */
export function getAreaRotationPivot(geometry: AreaGeometry): MeterPoint {
  if (geometry.kind === "POLYGON") {
    return geometry.transformOrigin;
  }
  return getAreaCentroid(geometry);
}

/**
 * Generic point accessor -- the individually-draggable points of ANY
 * Area geometry kind, in LOCAL (pre-rotation) coordinates: a Rectangle's 4
 * corners (top-left, top-right, bottom-right, bottom-left, in that
 * order), or a Polygon's own vertex list. Callers rotate these into world
 * space themselves (via localAreaPointToWorld, i.e. rotatePointAroundCenter
 * + getAreaRotationPivot) before rendering a handle -- this function never
 * knows about rotation.
 */
export function getAreaGeometryPoints(geometry: AreaGeometry): readonly MeterPoint[] {
  if (geometry.kind === "RECTANGLE") {
    return rectangleCorners(geometry);
  }
  return geometry.points;
}

/**
 * Generic point replacement, in LOCAL (pre-rotation) coordinates. For
 * POLYGON this is the actual vertex-edit mechanism the interactive handle-
 * drag uses: "reshape a Polygon" is exactly "move vertex `index`, leave
 * every other point untouched" -- nothing more.
 *
 * For RECTANGLE, this function's "keep the opposite corner's LOCAL
 * coordinate literally unchanged" approach looks equivalent to a proper
 * resize but is NOT safe for interactive dragging once `rotation !== 0`:
 * AreaRenderer.tsx always rotates a shape around ITS OWN LIVE centroid
 * (recomputed fresh from x/y/width/height on every render), and resizing
 * asymmetrically inherently moves that centroid -- so a corner whose local
 * coordinate is frozen still visibly drifts in WORLD space, rotated around
 * a pivot that shifts under it every frame (invisible at rotation=0, where
 * rotating around ANY pivot is the identity transform -- exactly why this
 * bug was invisible until a rotated shape was resized). The interactive
 * handle-drag therefore does NOT use this RECTANGLE branch at all --
 * see resizeRectangleToFixedAnchor below, which solves for a WORLD-space-
 * fixed anchor instead. This branch is kept as a plain, correct, LOCAL-
 * frame-only primitive (still exercised by tests), not because anything
 * calls it for an interactive drag today.
 *
 * `localPosition` must already be inverse-rotated into the geometry's
 * local frame by the caller (see rotatePointAroundCenter) -- this function
 * itself never reads `rotation`, only carries it through unchanged.
 */
export function setAreaGeometryPoint(geometry: AreaGeometry, index: number, localPosition: MeterPoint): AreaGeometry {
  if (geometry.kind === "RECTANGLE") {
    const corners = rectangleCorners(geometry);
    const oppositeIndex = (index + 2) % 4;
    const opposite = corners[oppositeIndex];
    const x = Math.min(localPosition.x, opposite.x);
    const y = Math.min(localPosition.y, opposite.y);
    const width = Math.abs(localPosition.x - opposite.x);
    const height = Math.abs(localPosition.y - opposite.y);
    return Object.freeze({ kind: "RECTANGLE", x, y, width, height, rotation: geometry.rotation });
  }
  // transformOrigin is passed through completely unchanged -- this is the
  // entire fix: a vertex edit touches ONLY `points[index]`, never the
  // pivot every other vertex is rotated around (see transformOrigin's own
  // doc comment).
  const points = geometry.points.map((existing, i) =>
    i === index ? Object.freeze({ x: localPosition.x, y: localPosition.y }) : Object.freeze({ ...existing }),
  );
  return Object.freeze({
    kind: "POLYGON",
    points: Object.freeze(points),
    rotation: geometry.rotation,
    transformOrigin: Object.freeze({ ...geometry.transformOrigin }),
  });
}

/**
 * Whole-shape move -- shifts every local point by the same delta (a
 * Rectangle's x/y, or every Polygon vertex) -- AND, for POLYGON, shifts
 * `transformOrigin` by that same delta too: moving the WHOLE shape
 * legitimately moves its own pivot along with it (unlike a single-vertex
 * edit, see setAreaGeometryPoint above, which must never touch it).
 * Generic across both kinds, same shape as DrawingObject.ts's
 * translateDrawingGeometry.
 */
export function translateAreaGeometry(geometry: AreaGeometry, delta: MeterPoint): AreaGeometry {
  if (geometry.kind === "RECTANGLE") {
    return Object.freeze({ ...geometry, x: geometry.x + delta.x, y: geometry.y + delta.y });
  }
  const points = geometry.points.map((point) => Object.freeze({ x: point.x + delta.x, y: point.y + delta.y }));
  return Object.freeze({
    kind: "POLYGON",
    points: Object.freeze(points),
    rotation: geometry.rotation,
    transformOrigin: Object.freeze({
      x: geometry.transformOrigin.x + delta.x,
      y: geometry.transformOrigin.y + delta.y,
    }),
  });
}

/**
 * Sets an Area's rotation (degrees, normalized to [0, 360)) -- generic
 * across both geometry kinds since both carry the same `rotation` field.
 * Applied around getAreaRotationPivot at render/handle-position time;
 * never mutates x/y/width/height, the stored points, or (for POLYGON)
 * transformOrigin -- a pure numeric field change, exactly as required
 * ("rotationens numeriska värde ska förbli oförändrat" applies to every
 * OTHER mutation; this is the one function that's SUPPOSED to change it,
 * and only it).
 */
export function setAreaRotation(geometry: AreaGeometry, rotationDegrees: number): AreaGeometry {
  const normalized = ((rotationDegrees % 360) + 360) % 360;
  return Object.freeze({ ...geometry, rotation: normalized });
}

// -- World<->local transform helpers (Area handle-drag interaction fix) --
//
// A handle's rendered WORLD position is `rotatePointAroundCenter(localPoint,
// getAreaRotationPivot(geometry), geometry.rotation)` (see MasterCourt.tsx/
// AreaRenderer.tsx). These two functions are the named, testable, exact
// forward/inverse pair of that same operation -- callers should reach for
// these instead of re-deriving pivot+rotatePointAroundCenter inline.

/** The WORLD position of a point given IN this Area's local frame. */
export function localAreaPointToWorld(geometry: AreaGeometry, localPoint: MeterPoint): MeterPoint {
  return rotatePointAroundCenter(localPoint, getAreaRotationPivot(geometry), geometry.rotation);
}

/**
 * The LOCAL position of a point given in WORLD space, using an explicit
 * (caller-supplied) centroid and rotation rather than reading them off a
 * geometry object -- deliberately decoupled from `AreaGeometry` so a
 * caller mid-gesture can supply a centroid captured ONCE at gesture-start
 * instead of one recomputed from a geometry that's mutating step to step
 * (see resizeRectangleToFixedAnchor's doc comment, and
 * MasterCourt.tsx's handleAreaPointHandlePointerMove, for why that
 * distinction is exactly the fix this file's handle-drag bug needed).
 */
export function worldAreaPointToLocal(centroid: MeterPoint, rotationDegrees: number, worldPoint: MeterPoint): MeterPoint {
  return rotatePointAroundCenter(worldPoint, centroid, -rotationDegrees);
}

/**
 * Rectangle resize with a WORLD-space-fixed opposite corner -- the
 * mathematically correct replacement for routing rectangle corner-drag
 * through setAreaGeometryPoint (see that function's doc comment for the
 * full root-cause explanation of why "opposite corner's LOCAL coordinate
 * stays the same" does NOT mean "opposite corner's WORLD position stays
 * the same" once rotation != 0).
 *
 * The insight this relies on: for ANY rectangle, the two corners on a
 * diagonal are always symmetric about the centroid -- in local space by
 * construction, and in world space too, since rotation is a rigid
 * transform that preserves that symmetry. So if we already know where the
 * anchor corner must end up in the world (`fixedWorldAnchor`, captured
 * ONCE at gesture-start by the caller -- it must never move once a drag
 * begins) and where the dragged corner must end up (`worldMousePoint`,
 * the live pointer position), their WORLD midpoint IS the rectangle's new
 * centroid -- no separate solve needed. Both corners' local coordinates
 * then fall out of a single inverse-rotation each, around that centroid.
 * `rotation` is only ever read, never recomputed or adjusted -- the
 * returned geometry always carries the exact same value it was given.
 */
export function resizeRectangleToFixedAnchor(
  rotationDegrees: number,
  fixedWorldAnchor: MeterPoint,
  worldMousePoint: MeterPoint,
): RectangleAreaGeometry {
  const centroid: MeterPoint = {
    x: (fixedWorldAnchor.x + worldMousePoint.x) / 2,
    y: (fixedWorldAnchor.y + worldMousePoint.y) / 2,
  };
  const localDragged = worldAreaPointToLocal(centroid, rotationDegrees, worldMousePoint);
  const localAnchor = worldAreaPointToLocal(centroid, rotationDegrees, fixedWorldAnchor);
  const x = Math.min(localDragged.x, localAnchor.x);
  const y = Math.min(localDragged.y, localAnchor.y);
  const width = Math.abs(localDragged.x - localAnchor.x);
  const height = Math.abs(localDragged.y - localAnchor.y);
  return Object.freeze({ kind: "RECTANGLE", x, y, width, height, rotation: rotationDegrees });
}
