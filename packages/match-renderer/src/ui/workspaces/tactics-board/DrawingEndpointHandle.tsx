"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import styles from "./DrawingEndpointHandle.module.css";

// Same "large invisible hit area + small visible dot" idiom as
// RotationHandle.tsx/CalibrationHandle.tsx -- discrete, not visually
// dominant, easy to grab with a mouse.
const HANDLE_RADIUS_METERS = 0.09;
const HANDLE_HIT_RADIUS_METERS = 0.2;

type DrawingEndpointHandleProps = {
  x: number;
  y: number;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<SVGGElement>) => void;
};

// One draggable point of a selected drawing's geometry (a LINE's start or
// end today; a future POLYLINE/CURVE's control points reuse this same
// component unchanged). Purely presentational -- MasterCourt.tsx owns all
// pointer-capture and pixel-to-meter drag math, matching
// RotationHandle.tsx/CalibrationHandle.tsx's split of responsibility.
export default function DrawingEndpointHandle({
  x,
  y,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: DrawingEndpointHandleProps) {
  return (
    <g
      role="slider"
      aria-label="Ändpunkt"
      className={styles.handleGroup}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <circle cx={x} cy={y} r={HANDLE_HIT_RADIUS_METERS} className={styles.hitArea} />
      <circle cx={x} cy={y} r={HANDLE_RADIUS_METERS} className={styles.handle} pointerEvents="none" />
    </g>
  );
}
