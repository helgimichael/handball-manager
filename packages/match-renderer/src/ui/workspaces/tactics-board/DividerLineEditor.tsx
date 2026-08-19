"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { buildDividerLinePathD, type DividerLine } from "./geometry/HandballCourtGeometry.ts";
import CalibrationHandle from "./CalibrationHandle.tsx";
import styles from "./DividerLineEditor.module.css";

const ANCHOR_RADIUS_METERS = 0.06;

type DividerLineEditorProps = {
  divider: DividerLine;
  label: string;
  onEndPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  onEndPointerMove: (event: ReactPointerEvent<SVGGElement>) => void;
  onEndPointerUp: (event: ReactPointerEvent<SVGGElement>) => void;
  onEndPointerCancel: (event: ReactPointerEvent<SVGGElement>) => void;
};

// One divider's full calibration UI: the straight line itself, a fixed
// (non-interactive) anchor marker at its goal-line start, and a single
// draggable CalibrationHandle at its end. Purely presentational --
// MasterCourt.tsx owns all pointer-capture and drag math.
export default function DividerLineEditor({
  divider,
  label,
  onEndPointerDown,
  onEndPointerMove,
  onEndPointerUp,
  onEndPointerCancel,
}: DividerLineEditorProps) {
  return (
    <g aria-label={label}>
      <path d={buildDividerLinePathD(divider)} className={styles.line} pointerEvents="none" fill="none" />
      <circle
        cx={divider.start.x}
        cy={divider.start.y}
        r={ANCHOR_RADIUS_METERS}
        className={styles.anchor}
        pointerEvents="none"
      />
      <CalibrationHandle
        x={divider.end.x}
        y={divider.end.y}
        label={`${label} -- dra för att justera`}
        onPointerDown={onEndPointerDown}
        onPointerMove={onEndPointerMove}
        onPointerUp={onEndPointerUp}
        onPointerCancel={onEndPointerCancel}
      />
    </g>
  );
}
