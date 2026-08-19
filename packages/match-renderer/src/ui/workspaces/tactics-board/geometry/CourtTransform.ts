/**
 * Pure Geometry layer -- coordinates, meter<->SVG transform, viewport,
 * clamp, pointer-to-meter. Deliberately generic: this module must never
 * know it is rendering a HANDBALL court (no goal/zone/line knowledge), so
 * it stays reusable for any meter-based 2D board. See
 * ../geometry/HandballCourtGeometry.ts for the handball-specific geometry
 * that consumes this module.
 */

export type MeterPoint = { x: number; y: number };
export type PixelSize = { width: number; height: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

// The viewport is expressed in the SAME meter units as the board itself --
// "which meter-rectangle of the board is currently visible", not a pixel
// concept.
export type ViewportMeters = { x: number; y: number; width: number; height: number };

export function clampToBounds(point: MeterPoint, bounds: Bounds): MeterPoint {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y)),
  };
}

export function viewportToViewBox(viewport: ViewportMeters): string {
  return `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`;
}

/**
 * Reflects a meter point across a horizontal line at y = axisY. Generic --
 * knows nothing about goals or zones, so any zone type mirrors a "top"
 * definition to a "bottom" one through this same function, unmodified.
 */
export function mirrorPointAcrossHorizontalLine(point: MeterPoint, axisY: number): MeterPoint {
  return { x: point.x, y: axisY * 2 - point.y };
}

/**
 * Reflects a meter point across a vertical line at x = axisX. Generic --
 * used e.g. to derive a right-side boundary from a left-side one.
 */
export function mirrorPointAcrossVerticalLine(point: MeterPoint, axisX: number): MeterPoint {
  return { x: axisX * 2 - point.x, y: point.y };
}

/**
 * Reflects a rotation angle (degrees, 0=up, clockwise-positive -- the same
 * convention as computeRotationDegrees/rotationHandlePosition in
 * pointerInteraction.ts) that belongs to a shape being mirrored across a
 * VERTICAL line alongside mirrorPointAcrossVerticalLine. Given direction
 * vector (sin(theta), -cos(theta)), a vertical mirror flips only the x
 * component, which is equivalent to negating theta.
 */
export function mirrorRotationAcrossVerticalLine(rotationDegrees: number): number {
  return (360 - (rotationDegrees % 360) + 360) % 360;
}

/**
 * Same idea as mirrorRotationAcrossVerticalLine but for a shape mirrored
 * across a HORIZONTAL line (paired with mirrorPointAcrossHorizontalLine): a
 * horizontal mirror flips only the y component of the direction vector,
 * equivalent to theta -> 180 - theta.
 */
export function mirrorRotationAcrossHorizontalLine(rotationDegrees: number): number {
  return (180 - (rotationDegrees % 360) + 360) % 360;
}

// -- Generic 2D vector math -- no handball/board knowledge, just points
// treated as vectors when convenient (e.g. constructing a ray from an
// origin in a given direction).

export function subtractPoints(a: MeterPoint, b: MeterPoint): MeterPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function addPoints(a: MeterPoint, b: MeterPoint): MeterPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scalePoint(point: MeterPoint, scalar: number): MeterPoint {
  return { x: point.x * scalar, y: point.y * scalar };
}

export function vectorLength(vector: MeterPoint): number {
  return Math.hypot(vector.x, vector.y);
}

/** Returns the zero vector for a zero-length input rather than NaN --
 * callers that need a non-degenerate direction must guard for that
 * themselves (see HandballCourtGeometry.ts's divider-direction logic). */
export function normalizeVector(vector: MeterPoint): MeterPoint {
  const length = vectorLength(vector);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
}

export function dotProduct(a: MeterPoint, b: MeterPoint): number {
  return a.x * b.x + a.y * b.y;
}

/**
 * Converts a pointer position expressed in CSS pixels RELATIVE TO the
 * rendering element's own bounding box (e.g. clientX/clientY minus
 * getBoundingClientRect().left/top) into meters, given that element's
 * on-screen pixel size and the current meter viewport.
 *
 * Replicates exactly what SVG's `preserveAspectRatio="xMidYMid meet"` does:
 * a single uniform scale (the smaller of the two axis scales, so the whole
 * viewport fits without stretching) plus centered letterboxing on
 * whichever axis has leftover space. This is the one non-trivial transform
 * in the whole board -- meter-to-SVG-position is the identity function
 * once the SVG element's own viewBox is already expressed in meters (see
 * MasterCourt.tsx), so no separate "meterToSvgPosition" helper is needed;
 * this function is its true inverse.
 */
/**
 * Rotates a point around a center by `degrees`, using the SAME convention
 * as SVG's own `rotate(deg, cx, cy)` transform (clockwise-positive in this
 * y-down coordinate system, 0deg = identity). This is a coordinate-frame
 * transform, NOT the same convention as computeRotationDegrees/
 * rotationHandlePosition in pointerInteraction.ts (those express an
 * object's own facing direction, 0deg = up) -- kept separate on purpose,
 * since "rotate this point around that pivot" and "which way is this
 * object facing" are different concepts that happen to both use degrees.
 * Used by the Area Engine (see scene/AreaObject.ts) to keep a shape's
 * rendered outline and its resize/vertex handles in the same rotated
 * frame without needing to mutate stored geometry on every rotation.
 */
export function rotatePointAroundCenter(point: MeterPoint, center: MeterPoint, degrees: number): MeterPoint {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function pointerPixelToMeter(
  pointerPx: MeterPoint,
  elementSizePx: PixelSize,
  viewport: ViewportMeters,
): MeterPoint {
  const scale = Math.min(
    elementSizePx.width / viewport.width,
    elementSizePx.height / viewport.height,
  );
  const renderedWidthPx = viewport.width * scale;
  const renderedHeightPx = viewport.height * scale;
  const offsetXPx = (elementSizePx.width - renderedWidthPx) / 2;
  const offsetYPx = (elementSizePx.height - renderedHeightPx) / 2;

  return {
    x: viewport.x + (pointerPx.x - offsetXPx) / scale,
    y: viewport.y + (pointerPx.y - offsetYPx) / scale,
  };
}
