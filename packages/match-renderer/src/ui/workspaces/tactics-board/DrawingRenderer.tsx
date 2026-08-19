"use client";

import { getDrawingEndDirection, type DrawingObject, type ResolvedDrawingGeometry } from "./drawing/DrawingObject.ts";
import { buildSmoothCurvePathD } from "./drawing/curveInterpolation.ts";
import type { MeterPoint } from "./geometry/CourtTransform.ts";
import styles from "./DrawingRenderer.module.css";

// A wide, invisible hit-stroke so thin drawn lines stay easy to click --
// same "large invisible hit area" idiom as CalibrationHandle, adapted to
// a stroked path instead of a circle. Pointer handlers live on the
// wrapping <g> in MasterCourt.tsx (exactly like BoardObjectRenderer);
// this component stays purely presentational.
const HIT_STROKE_WIDTH_METERS = 0.5;

type DrawingRendererProps = {
  drawing: DrawingObject;
  geometry: ResolvedDrawingGeometry;
};

// The Geometry renderer -- reads ONLY geometry/style/selected off a
// DrawingObject, NEVER `.semantic`. This is the enforceable proof of the
// Drawing Engine's geometry/semantics split (see DrawingObject.ts's file
// comment): this component's code has no access to what a drawing MEANS,
// only how it's shaped and styled. Adding a future tactical meaning
// (PASS, SHOT, ...) that reuses LINE geometry requires zero changes here.
export default function DrawingRenderer({ drawing, geometry }: DrawingRendererProps) {
  const { style, selected } = drawing;
  const pathD = geometryToPathD(geometry);
  if (!pathD) {
    return null;
  }
  // arrowSize === 0 means "no arrowhead" (see DrawingStyle's doc comment)
  // -- a future non-directional drawing type (e.g. an Area outline reusing
  // this same style shape) needs no special case here, just that value.
  const endDirection = style.arrowSize > 0 ? getDrawingEndDirection(geometry) : null;
  const arrowheadD = endDirection ? buildArrowheadPathD(endDirection.point, endDirection.angleRadians, style.arrowSize) : null;

  return (
    <>
      {selected ? <path d={pathD} className={styles.selectionHighlight} pointerEvents="none" /> : null}
      <path d={pathD} className={styles.hitStroke} strokeWidth={HIT_STROKE_WIDTH_METERS} pointerEvents="stroke" />
      <path
        d={pathD}
        className={styles.visibleStroke}
        style={{ stroke: style.color, strokeWidth: style.strokeWidth, strokeDasharray: style.strokeDasharray || undefined }}
        pointerEvents="none"
      />
      {arrowheadD ? (
        <path d={arrowheadD} className={styles.arrowhead} style={{ fill: style.color }} pointerEvents="none" />
      ) : null}
    </>
  );
}

// Pure geometry -> a small filled triangle path, tip at `point` pointing
// along `angleRadians` (the direction of travel approaching that point --
// see getDrawingEndDirection). Reads only geometry-derived numbers and
// style.arrowSize; never `semantic`, matching this whole component's
// geometry-only contract. The triangle's proportions (base half-width =
// 55% of its length) are a fixed visual constant, not a per-tool knob --
// only the overall size (arrowSize, from the preset) varies by family.
function buildArrowheadPathD(point: MeterPoint, angleRadians: number, size: number): string {
  const backAngle = angleRadians + Math.PI;
  const baseCenterX = point.x + size * Math.cos(backAngle);
  const baseCenterY = point.y + size * Math.sin(backAngle);
  const perpAngle = angleRadians + Math.PI / 2;
  const halfWidth = size * 0.55;
  const leftX = baseCenterX + halfWidth * Math.cos(perpAngle);
  const leftY = baseCenterY + halfWidth * Math.sin(perpAngle);
  const rightX = baseCenterX - halfWidth * Math.cos(perpAngle);
  const rightY = baseCenterY - halfWidth * Math.sin(perpAngle);
  return `M ${point.x} ${point.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
}

// Pure geometry -> SVG path string. Switches ONLY on `geometry.kind` --
// never on anything semantic. POLYLINE renders as straight segments
// (still unused by any tool in v1). CURVE renders as a smooth spline (see
// buildSmoothCurvePathD) -- the anchor points remain the single source of
// truth in `geometry.points`; this string is derived fresh on every
// render, never stored. POINT has no stroke to draw -- no POINT-based
// drawing type exists yet in v1.
function geometryToPathD(geometry: ResolvedDrawingGeometry): string | null {
  if (geometry.kind === "POINT") {
    return null;
  }
  if (geometry.kind === "LINE") {
    return `M ${geometry.start.x} ${geometry.start.y} L ${geometry.end.x} ${geometry.end.y}`;
  }
  if (geometry.kind === "CURVE") {
    return buildSmoothCurvePathD(geometry.points);
  }
  const [first, ...rest] = geometry.points;
  if (!first) {
    return null;
  }
  const segments = rest.map((point) => `L ${point.x} ${point.y}`).join(" ");
  return `M ${first.x} ${first.y} ${segments}`;
}
