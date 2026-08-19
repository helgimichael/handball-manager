"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { rotationHandlePosition } from "./pointerInteraction.ts";
import styles from "./RotationHandle.module.css";

// Distance beyond the object's own radius, and the handle's own visible
// radius -- both in meters, kept small and deliberately outside the
// shape's bounding box (radius + offset clears even the triangle's
// furthest vertex) without visually dominating the object it belongs to.
const HANDLE_OFFSET_METERS = 0.3;
const HANDLE_RADIUS_METERS = 0.11;
// A larger, invisible hit area so the handle is easy to grab with a
// mouse without needing to draw a bigger (visually dominant) dot.
const HANDLE_HIT_RADIUS_METERS = 0.22;

type RotationHandleProps = {
  centerX: number;
  centerY: number;
  rotationDegrees: number;
  objectRadiusMeters: number;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<SVGGElement>) => void;
};

// Free-rotation affordance for a selected, rotation-capable object --
// a distinct responsibility from SelectionLayer (marks "this is selected")
// and from BoardObjectRenderer (draws the shape itself). Purely
// presentational: MasterCourt.tsx owns the actual pointer-drag angle
// math (see pointerInteraction.ts's computeRotationDegrees) and passes
// only the resulting position/rotation down as props.
export default function RotationHandle({
  centerX,
  centerY,
  rotationDegrees,
  objectRadiusMeters,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: RotationHandleProps) {
  const distance = objectRadiusMeters + HANDLE_OFFSET_METERS;
  const handle = rotationHandlePosition({ x: centerX, y: centerY }, rotationDegrees, distance);

  return (
    <g
      role="slider"
      aria-label="Rotationshandtag"
      aria-valuenow={rotationDegrees}
      aria-valuemin={0}
      aria-valuemax={359}
      className={styles.handleGroup}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {/* Thin visual connection to the object's center -- optional per
          spec ("om det förbättrar tydligheten"), included since it makes
          the handle read as "belonging to" the object at a glance rather
          than a stray floating dot. */}
      <line x1={centerX} y1={centerY} x2={handle.x} y2={handle.y} className={styles.connector} pointerEvents="none" />
      {/* Larger invisible hit target, separate from the small visible dot
          -- easy to grab without visually dominating the object. */}
      <circle cx={handle.x} cy={handle.y} r={HANDLE_HIT_RADIUS_METERS} className={styles.hitArea} />
      <circle cx={handle.x} cy={handle.y} r={HANDLE_RADIUS_METERS} className={styles.handle} pointerEvents="none" />
    </g>
  );
}
