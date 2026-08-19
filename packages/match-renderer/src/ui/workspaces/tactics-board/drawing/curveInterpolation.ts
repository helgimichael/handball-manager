/**
 * Pure curve-interpolation math -- deliberately extracted out of
 * DrawingRenderer.tsx (JSX) so the exact same code path the component
 * calls in the browser can also be executed directly in a plain Node
 * test, with no DOM/rendering environment required (the same reasoning
 * pointerInteraction.ts was split out of MasterCourt.tsx for). Reads
 * nothing but a plain point sequence -- no semantic knowledge, matching
 * every other geometry function in drawing/DrawingObject.ts.
 */

import type { MeterPoint } from "../geometry/CourtTransform.ts";

// Anchors closer together than this are treated as one point before
// interpolation -- defends the interpolation math itself against
// degenerate (zero-length) segments regardless of how the near-duplicate
// got there (e.g. an endpoint dragged on top of a neighboring anchor);
// this is separate from and in addition to the click-time minimum-
// distance filter in TacticsBoardWorkspace.tsx's handlePathAnchorAdd,
// which stops most near-duplicates from ever being stored at all.
const NEAR_DUPLICATE_EPSILON_METERS = 0.01;

export function dedupeNearlyIdenticalPoints(points: readonly MeterPoint[]): MeterPoint[] {
  const result: MeterPoint[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < NEAR_DUPLICATE_EPSILON_METERS) {
      continue;
    }
    result.push(point);
  }
  return result;
}

// Centripetal parameterization (alpha = 0.5), not uniform (alpha = 0,
// what a plain "divide the tangent by 6" conversion gives) -- uniform
// Catmull-Rom produces overshoot and self-intersecting loops whenever
// anchors are unevenly spaced, which freehand click-placed anchors always
// are. Centripetal (Yuksel, Schaefer & Keyser 2009) is the standard fix:
// weighting each segment's tangent by the ACTUAL distance between points
// (to the power of alpha) keeps the curve from swinging wide between a
// close pair of anchors next to a far pair.
const CENTRIPETAL_ALPHA = 0.5;

// The parameter "distance" between two anchors for the knot sequence
// below. Floored well above zero so a still-near-duplicate pair (can
// legitimately occur at the very first/last segment, where the endpoint-
// clamping duplication below reintroduces one) can never collapse a
// later denominator to zero and produce NaN/Infinity control points.
function knotInterval(a: MeterPoint, b: MeterPoint): number {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.max(distance ** CENTRIPETAL_ALPHA, 1e-6);
}

export function centripetalCatmullRomControlPoints(
  p0: MeterPoint,
  p1: MeterPoint,
  p2: MeterPoint,
  p3: MeterPoint,
): { controlPoint1: MeterPoint; controlPoint2: MeterPoint } {
  const t0 = 0;
  const t1 = t0 + knotInterval(p0, p1);
  const t2 = t1 + knotInterval(p1, p2);
  const t3 = t2 + knotInterval(p2, p3);

  const t1t0 = t1 - t0;
  const t2t1 = t2 - t1;
  const t3t2 = t3 - t2;
  const t2t0 = t2 - t0;
  const t3t1 = t3 - t1;

  const m1x = t2t1 * ((p1.x - p0.x) / t1t0 - (p2.x - p0.x) / t2t0 + (p2.x - p1.x) / t2t1);
  const m1y = t2t1 * ((p1.y - p0.y) / t1t0 - (p2.y - p0.y) / t2t0 + (p2.y - p1.y) / t2t1);
  const m2x = t2t1 * ((p2.x - p1.x) / t2t1 - (p3.x - p1.x) / t3t1 + (p3.x - p2.x) / t3t2);
  const m2y = t2t1 * ((p2.y - p1.y) / t2t1 - (p3.y - p1.y) / t3t1 + (p3.y - p2.y) / t3t2);

  return {
    controlPoint1: { x: p1.x + m1x / 3, y: p1.y + m1y / 3 },
    controlPoint2: { x: p2.x - m2x / 3, y: p2.y - m2y / 3 },
  };
}

// Centripetal-Catmull-Rom-to-cubic-Bezier interpolation -- turns a
// sequence of anchor points into a smooth curve that actually passes
// through every anchor (unlike a raw Bezier, whose control points don't
// lie on the curve). Endpoints are clamped by duplicating the first/last
// point as their own "virtual neighbor", the usual way to avoid needing
// an extra point outside the real sequence. `points` remains the sole
// source of truth -- this string is derived fresh on every call, never
// stored or cached anywhere.
export function buildSmoothCurvePathD(rawPoints: readonly MeterPoint[]): string | null {
  const points = dedupeNearlyIdenticalPoints(rawPoints);
  if (points.length === 0) {
    return null;
  }
  if (points.length < 3) {
    // 1 point: nothing to draw yet (matches the live-preview state right
    // after the first anchor). 2 points: a straight segment is already
    // the smoothest possible curve through exactly two anchors.
    const [first, second] = points;
    return second ? `M ${first.x} ${first.y} L ${second.x} ${second.y}` : null;
  }

  const extended = [points[0], ...points, points[points.length - 1]];
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = extended[i];
    const p1 = extended[i + 1];
    const p2 = extended[i + 2];
    const p3 = extended[i + 3];
    const { controlPoint1, controlPoint2 } = centripetalCatmullRomControlPoints(p0, p1, p2, p3);
    d += ` C ${controlPoint1.x} ${controlPoint1.y} ${controlPoint2.x} ${controlPoint2.y} ${p2.x} ${p2.y}`;
  }
  return d;
}
