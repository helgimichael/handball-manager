"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import styles from "./CalibrationHandle.module.css";

// Same "large invisible hit area + small visible dot" idiom as
// RotationHandle.tsx -- easy to grab with a mouse without visually
// dominating the court underneath it.
const HANDLE_RADIUS_METERS = 0.09;
const HANDLE_HIT_RADIUS_METERS = 0.2;

type CalibrationHandleProps = {
  x: number;
  y: number;
  label: string;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerMove: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerUp: (event: ReactPointerEvent<SVGGElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<SVGGElement>) => void;
};

// A single draggable calibration point (a divider's end point). Purely
// presentational -- MasterCourt.tsx owns all pointer-capture and
// pixel-to-meter drag math, matching RotationHandle.tsx's split of
// responsibility.
export default function CalibrationHandle({
  x,
  y,
  label,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CalibrationHandleProps) {
  return (
    <g
      role="slider"
      aria-label={label}
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
