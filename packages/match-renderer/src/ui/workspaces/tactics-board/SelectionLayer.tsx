"use client";

import type { CSSProperties } from "react";
import { SELECTION_RING_SIZE_RATIO, SELECTION_RING_STROKE } from "./boardObjectDefinitions.ts";
import styles from "./SelectionLayer.module.css";

type SelectionLayerProps = {
  centerX: number;
  centerY: number;
  objectRadiusMeters: number;
};

// The ONLY visible marking for a selected object -- a thin, transparent-
// fill, pointer-events:none ring sized as a fixed ratio of the object's
// own radius (see boardObjectDefinitions.ts, SELECTION_RING_SIZE_RATIO).
// Deliberately its own component/file (separate from BoardObjectRenderer
// and RotationHandle): "selection" is a distinct concern from "shape" and
// from "how to rotate it" -- rendering it here, once, is also what
// guarantees the oversized-native-focus-ring regression (see
// MasterCourt.module.css's .boardObject) can never resurface disguised as
// a second/duplicate marking element.
export default function SelectionLayer({ centerX, centerY, objectRadiusMeters }: SelectionLayerProps) {
  return (
    <circle
      cx={centerX}
      cy={centerY}
      r={objectRadiusMeters * SELECTION_RING_SIZE_RATIO}
      className={styles.selectionRing}
      style={{ "--selection-stroke": SELECTION_RING_STROKE } as CSSProperties}
    />
  );
}
