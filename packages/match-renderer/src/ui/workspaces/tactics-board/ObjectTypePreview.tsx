"use client";

import { BOARD_OBJECT_DEFINITIONS } from "./boardObjectDefinitions.ts";
import { getConeFill } from "./boardObjectDefinitions.ts";
import type { BoardObjectType, ConeColor } from "./scene/BoardObject.ts";
import styles from "./ObjectTypePreview.module.css";

type ObjectTypePreviewProps = {
  type: BoardObjectType;
  coneColor?: ConeColor;
  className?: string;
};

// A small shape preview (triangle/circle/square, matching the real board
// object) rather than a generic colored dot -- reads shape+color directly
// from BOARD_OBJECT_DEFINITIONS, the SAME registry BoardObjectRenderer.tsx
// uses for the actual court rendering, so any preview built from this
// component (the ToolPanel's object library, the "Aktivt verktyg"
// summary, ...) can never drift out of sync with what actually gets
// placed on the court.
export default function ObjectTypePreview({ type, coneColor, className }: ObjectTypePreviewProps) {
  const definition = BOARD_OBJECT_DEFINITIONS[type];
  const style = {
    stroke: type === "CONE" ? "color-mix(in srgb, currentColor 78%, black 22%)" : definition.stroke,
    fill: type === "CONE" ? getConeFill(coneColor) : definition.fill,
  } as const;
  const combinedClassName = className ? `${styles.preview} ${className}` : styles.preview;

  return (
    <svg className={combinedClassName} viewBox="0 0 16 16" aria-hidden="true">
      {definition.shape === "triangle" ? <polygon points="8,2 14,13 2,13" style={style} /> : null}
      {definition.shape === "circle" ? <circle cx={8} cy={8} r={6} style={style} /> : null}
      {definition.shape === "square" ? <rect x={2} y={2} width={12} height={12} style={style} /> : null}
      {definition.shape === "cone" ? (
        <g style={{ color: getConeFill(coneColor) }}>
          <rect x={2} y={11} width={12} height={3} rx={0.6} style={style} />
          <path d="M4.5 11 L6.8 3.2 Q8 2.1 9.2 3.2 L11.5 11 Z" style={style} />
          <path d="M5.8 8.4 H10.2" fill="none" stroke={style.stroke} strokeWidth={1} />
        </g>
      ) : null}
    </svg>
  );
}
