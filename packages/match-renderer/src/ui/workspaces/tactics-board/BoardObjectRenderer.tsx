"use client";

import type { CSSProperties, ReactElement } from "react";
import {
  BOARD_OBJECT_DEFINITIONS,
  buildTrianglePoints,
  getConeFill,
  type BoardObjectShapeKind,
} from "./boardObjectDefinitions.ts";
import type { BoardObject } from "./scene/BoardObject.ts";
import styles from "./BoardObjectRenderer.module.css";

type BoardObjectRendererProps = {
  object: BoardObject;
  sizeScale?: number;
};

// The ONE place shape primitives are drawn. Branches on `shape` (a
// small, stable set of SVG primitives), never on BoardObjectType --
// adding a new object type that reuses an existing shape (see
// boardObjectDefinitions.ts) requires no change here at all.
function renderShapePrimitive(
  shape: BoardObjectShapeKind,
  centerX: number,
  centerY: number,
  sizeMeters: number,
  rotationDegrees: number,
  style: CSSProperties,
): ReactElement {
  switch (shape) {
    case "triangle":
      return (
        <polygon
          points={buildTrianglePoints(centerX, centerY, sizeMeters)}
          transform={`rotate(${rotationDegrees} ${centerX} ${centerY})`}
          className={styles.objectShape}
          style={style}
        />
      );
    case "square": {
      const half = sizeMeters / 2;
      return (
        <rect
          x={centerX - half}
          y={centerY - half}
          width={sizeMeters}
          height={sizeMeters}
          transform={`rotate(${rotationDegrees} ${centerX} ${centerY})`}
          className={styles.objectShape}
          style={style}
        />
      );
    }
    case "cone": {
      const half = sizeMeters / 2;
      const baseHeight = sizeMeters * 0.24;
      const bodyTopY = centerY - half + sizeMeters * 0.12;
      const baseTopY = centerY + half - baseHeight;
      const bodyWidthTop = sizeMeters * 0.22;
      const bodyWidthBottom = sizeMeters * 0.62;
      return (
        <g transform={`rotate(${rotationDegrees} ${centerX} ${centerY})`}>
          <rect
            x={centerX - half}
            y={baseTopY}
            width={sizeMeters}
            height={baseHeight}
            rx={baseHeight * 0.18}
            className={styles.objectShape}
            style={style}
          />
          <path
            d={[
              `M ${centerX - bodyWidthBottom / 2} ${baseTopY}`,
              `L ${centerX - bodyWidthTop / 2} ${bodyTopY}`,
              `Q ${centerX} ${bodyTopY - sizeMeters * 0.08} ${centerX + bodyWidthTop / 2} ${bodyTopY}`,
              `L ${centerX + bodyWidthBottom / 2} ${baseTopY}`,
              "Z",
            ].join(" ")}
            className={styles.objectShape}
            style={style}
          />
          <path
            d={`M ${centerX - bodyWidthBottom * 0.28} ${centerY + sizeMeters * 0.05} H ${
              centerX + bodyWidthBottom * 0.28
            }`}
            className={styles.objectShape}
            style={{ ...style, fill: "none" }}
          />
        </g>
      );
    }
    case "circle":
    default:
      return <circle cx={centerX} cy={centerY} r={sizeMeters / 2} className={styles.objectShape} style={style} />;
  }
}

// Selects the correct SVG geometry + visuals for object.type entirely
// from BOARD_OBJECT_DEFINITIONS -- purely presentational, reads the
// registry for every color/size/shape decision, owns none of its own.
// Draws ONLY the shape -- selection marking (SelectionLayer.tsx) and the
// rotation handle (RotationHandle.tsx) are separate responsibilities,
// rendered as siblings by MasterCourt.tsx, not by this component.
export default function BoardObjectRenderer({ object, sizeScale = 1 }: BoardObjectRendererProps) {
  const definition = BOARD_OBJECT_DEFINITIONS[object.type];
  const { x: cx, y: cy } = object.position;
  const rotation = definition.supportsRotation ? object.rotation : 0;
  const style = {
    "--object-stroke": definition.stroke,
    "--object-fill": definition.fill,
    "--object-glow": definition.glowColor,
    "--object-stroke-width": definition.strokeWidth,
    "--cone-fill": getConeFill(object.coneColor),
  } as CSSProperties;

  return renderShapePrimitive(definition.shape, cx, cy, definition.physicalSizeMeters * sizeScale, rotation, style);
}
