export type MeterPoint = {
  x: number;
  y: number;
};

export type MeterVector = {
  x: number;
  y: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type ViewportMeters = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function clampPointToBounds(point: MeterPoint, bounds: Bounds): MeterPoint {
  return {
    x: Math.min(bounds.maxX, Math.max(bounds.minX, point.x)),
    y: Math.min(bounds.maxY, Math.max(bounds.minY, point.y))
  };
}

export function viewportToViewBox(viewport: ViewportMeters): string {
  return `${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`;
}

export function isPointWithinBounds(point: MeterPoint, bounds: Bounds): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

export function pointsEqual(a: MeterPoint, b: MeterPoint): boolean {
  return a.x === b.x && a.y === b.y;
}

export const ZERO_VECTOR: MeterVector = Object.freeze({ x: 0, y: 0 });

export function addVectors(a: MeterPoint, b: MeterVector): MeterPoint {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function subtractPoints(a: MeterPoint, b: MeterPoint): MeterVector {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scaleVector(vector: MeterVector, scalar: number): MeterVector {
  return { x: vector.x * scalar, y: vector.y * scalar };
}

export function vectorLength(vector: MeterVector): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalizeVector(vector: MeterVector): MeterVector {
  const length = vectorLength(vector);
  return length === 0 ? ZERO_VECTOR : { x: vector.x / length, y: vector.y / length };
}

export function distanceBetween(a: MeterPoint, b: MeterPoint): number {
  return vectorLength(subtractPoints(a, b));
}
