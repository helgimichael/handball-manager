/**
 * Pure pointer-interaction decision logic -- deliberately extracted out of
 * MasterCourt.tsx (JSX) so the exact same code path the component calls in
 * the browser can also be executed directly in a plain Node test, with no
 * DOM/rendering environment required. This is the "lowest possible
 * executable level" for the empty-court click chain: pixel position + the
 * element's real on-screen size + the current viewport + the active tool
 * in, a concrete action out. Never silently swallows a bad result -- a
 * non-finite meter point is a thrown error, not a dropped click.
 */

import { pointerPixelToMeter, type MeterPoint, type PixelSize, type ViewportMeters } from "./geometry/CourtTransform.ts";
import type { BoardObjectType, ConeColor } from "./scene/BoardObject.ts";
import type { DrawingIntent } from "./drawing/DrawingObject.ts";
import { DRAWING_PRESETS, type DrawingPreset } from "./drawing/drawingPresets.ts";

// Area Engine v1 -- exactly two tools (Rectangle Area, Polygon Area), so a
// small local record (AREA_TOOL_CREATION_MODES below) plays the same role
// DRAWING_PRESETS' creationMode field plays for drawing tools, without a
// whole preset registry -- the per-kind default color pair (see
// area/AreaObject.ts's DEFAULT_RECTANGLE_AREA_STYLE/
// DEFAULT_POLYGON_AREA_STYLE) is picked directly from geometry.kind inside
// createAreaObject, not from a tool-keyed registry like DRAWING_PRESETS.
export type AreaToolId = "AREA_RECTANGLE" | "AREA_POLYGON";
export type ConeToolId = "CONE_ORANGE" | "CONE_YELLOW";
export type PlacementToolId = Exclude<BoardObjectType, "CONE"> | ConeToolId;

export type ToolId = "SELECT" | "DELETE" | PlacementToolId | DrawingIntent | AreaToolId;
export type InteractionMode = "IDLE" | "PLACEMENT" | "CONTINUOUS_DRAWING";

const TOOL_INTERACTION_MODES: Record<ToolId, InteractionMode> = {
  SELECT: "IDLE",
  DELETE: "IDLE",
  ATTACKER: "PLACEMENT",
  DEFENDER: "PLACEMENT",
  GOALKEEPER: "PLACEMENT",
  BALL: "PLACEMENT",
  CONE_ORANGE: "PLACEMENT",
  CONE_YELLOW: "PLACEMENT",
  PLAYER_MOVEMENT: "CONTINUOUS_DRAWING",
  PASS: "CONTINUOUS_DRAWING",
  SHOT: "CONTINUOUS_DRAWING",
  AREA_RECTANGLE: "PLACEMENT",
  AREA_POLYGON: "CONTINUOUS_DRAWING",
};

export function getToolInteractionMode(tool: ToolId): InteractionMode {
  return TOOL_INTERACTION_MODES[tool];
}

export function isPlacementTool(tool: ToolId): tool is PlacementToolId {
  return (
    tool === "ATTACKER" ||
    tool === "DEFENDER" ||
    tool === "GOALKEEPER" ||
    tool === "BALL" ||
    tool === "CONE_ORANGE" ||
    tool === "CONE_YELLOW"
  );
}

export function getPlacementObjectInput(tool: PlacementToolId): { type: BoardObjectType; coneColor?: ConeColor } {
  if (tool === "CONE_ORANGE") {
    return { type: "CONE", coneColor: "ORANGE" };
  }
  if (tool === "CONE_YELLOW") {
    return { type: "CONE", coneColor: "YELLOW" };
  }
  return { type: tool };
}

// Drawing tools are a click-sequence gesture, never an instant PLACE the
// way board objects are -- see resolveBackgroundPointerAction below,
// which deliberately does NOT return a PLACE action for these.
// MasterCourt.tsx owns the actual anchor-placement logic.
export function isDrawingTool(tool: ToolId): tool is DrawingIntent {
  return tool === "PLAYER_MOVEMENT" || tool === "PASS" || tool === "SHOT";
}

// Which pointer gesture a drawing tool uses to create its drawing --
// looked up from the preset registry (DRAWING_PRESETS) so MasterCourt.tsx
// never dispatches on a tool's name directly; a future drawing tool needs
// only a new preset entry, not a new branch here.
export function getDrawingCreationMode(tool: DrawingIntent): DrawingPreset["creationMode"] {
  return DRAWING_PRESETS[tool].creationMode;
}

export function isAreaTool(tool: ToolId): tool is AreaToolId {
  return tool === "AREA_RECTANGLE" || tool === "AREA_POLYGON";
}

// Same creationMode vocabulary as drawing tools (DRAG vs CLICK_SEQUENCE),
// so MasterCourt.tsx's existing DRAG/CLICK_SEQUENCE branches (see
// handleBackgroundPointerDown/handleSvgPointerDown) extend to Area tools
// by checking this alongside getDrawingCreationMode, never a third
// dispatch mechanism.
const AREA_TOOL_CREATION_MODES: Record<AreaToolId, DrawingPreset["creationMode"]> = {
  AREA_RECTANGLE: "DRAG",
  AREA_POLYGON: "CLICK_SEQUENCE",
};

export function getAreaCreationMode(tool: AreaToolId): DrawingPreset["creationMode"] {
  return AREA_TOOL_CREATION_MODES[tool];
}

export type BackgroundPointerAction =
  | { kind: "PLACE"; meterPoint: MeterPoint }
  | { kind: "DESELECT" };

/**
 * Resolves what an empty-court pointerdown should do. Returns null only
 * when the element hasn't been laid out yet (zero-size bounding box) --
 * the one legitimate "not ready" case, distinct from an actual bug. Any
 * OTHER invalid result (NaN, non-finite) is a thrown error, never a silent
 * no-op, so a coordinate-transform regression fails loudly instead of just
 * quietly not placing anything (which is exactly the class of bug this
 * module exists to make visible).
 */
export function resolveBackgroundPointerAction(
  pointerPositionPx: MeterPoint,
  elementSizePx: PixelSize,
  viewport: ViewportMeters,
  activeTool: ToolId,
): BackgroundPointerAction | null {
  if (elementSizePx.width === 0 || elementSizePx.height === 0) {
    return null;
  }

  const meterPoint = pointerPixelToMeter(pointerPositionPx, elementSizePx, viewport);
  if (!Number.isFinite(meterPoint.x) || !Number.isFinite(meterPoint.y)) {
    throw new Error(
      `resolveBackgroundPointerAction produced a non-finite meter point: ${JSON.stringify(meterPoint)}`,
    );
  }

  if (isPlacementTool(activeTool)) {
    return { kind: "PLACE", meterPoint };
  }
  return { kind: "DESELECT" };
}

/**
 * Pure angle math for the rotation handle: given an object's center and
 * the pointer's CURRENT position (both already in meter space, i.e.
 * already camera/zoom/pan-corrected via pointerPixelToMeter), returns the
 * rotation in degrees such that 0deg points "up" (matching the triangle's
 * un-rotated apex direction in buildTrianglePoints) and increases
 * clockwise (matching SVG's rotate() convention). Angle is invariant
 * under the uniform scale + translation that zoom/pan and the SVG
 * viewBox apply, so this works correctly at any zoom level without extra
 * transform work -- meter-space deltas and screen-pixel deltas point in
 * the same direction, only their magnitude differs.
 */
export function computeRotationDegrees(centerMeter: MeterPoint, pointerMeter: MeterPoint): number {
  const dx = pointerMeter.x - centerMeter.x;
  const dy = pointerMeter.y - centerMeter.y;
  const angleRad = Math.atan2(dx, -dy);
  const angleDeg = (angleRad * 180) / Math.PI;
  return ((angleDeg % 360) + 360) % 360;
}

/**
 * Given a rotation in degrees (0deg = up, clockwise) and a distance from
 * the object's center, returns where the rotation HANDLE itself should
 * be drawn -- the exact geometric inverse of computeRotationDegrees, so
 * dragging the handle to point at the pointer and then re-deriving its
 * angle from that same position is a lossless round-trip.
 */
export function rotationHandlePosition(
  centerMeter: MeterPoint,
  rotationDegrees: number,
  distanceMeters: number,
): MeterPoint {
  const angleRad = (rotationDegrees * Math.PI) / 180;
  return {
    x: centerMeter.x + distanceMeters * Math.sin(angleRad),
    y: centerMeter.y - distanceMeters * Math.cos(angleRad),
  };
}

// Continuous (not stepped) scroll-to-zoom factor -- smooth regardless of
// whether the wheel delta comes from a notched mouse wheel or a
// high-resolution trackpad. Positive deltaY (scroll down/away) zooms out,
// negative (scroll up/toward) zooms in.
export function computeWheelZoomFactor(deltaY: number): number {
  return Math.pow(1.0015, -deltaY);
}
