"use client";

import { getAreaRotationPivot, type AreaGeometry, type AreaObject } from "./area/AreaObject.ts";
import styles from "./AreaRenderer.module.css";

type AreaRendererProps = {
  area: AreaObject;
};

// The Geometry renderer for Areas -- reads ONLY geometry/style/selected,
// same "geometry-only" contract as DrawingRenderer.tsx. Rotation is
// applied as a single wrapping <g transform="rotate(...)">, around
// getAreaRotationPivot(geometry) -- the LIVE centroid for RECTANGLE, a
// persistent stored `transformOrigin` for POLYGON (see that function's
// own doc comment for why the two kinds deliberately answer this
// differently). The stored x/y/width/height or points never get pre-
// rotated, so resize/vertex math in MasterCourt.tsx always operates in a
// simple, un-rotated local frame (see AreaObject.ts's
// setAreaGeometryPoint doc comment).
export default function AreaRenderer({ area }: AreaRendererProps) {
  const { geometry, style, selected } = area;
  const shapeD = geometryToPathD(geometry);
  if (!shapeD) {
    return null;
  }
  const pivot = getAreaRotationPivot(geometry);

  return (
    <g transform={`rotate(${geometry.rotation} ${pivot.x} ${pivot.y})`}>
      {selected ? <path d={shapeD} className={styles.selectionHighlight} pointerEvents="none" /> : null}
      <path
        d={shapeD}
        className={styles.visibleShape}
        style={{
          fill: style.fillColor,
          fillOpacity: style.fillOpacity,
          stroke: style.strokeColor,
          strokeWidth: style.strokeWidth,
        }}
        pointerEvents="all"
      />
    </g>
  );
}

// Pure geometry -> a closed SVG path string. Unlike DrawingRenderer's
// switch (which stays open-ended for future geometry kinds), Areas have
// exactly two kinds today -- both always closed (Z), since an Area is a
// region, never an open line.
function geometryToPathD(geometry: AreaGeometry): string | null {
  if (geometry.kind === "RECTANGLE") {
    const { x, y, width, height } = geometry;
    return `M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`;
  }
  const [first, ...rest] = geometry.points;
  if (!first) {
    return null;
  }
  const segments = rest.map((point) => `L ${point.x} ${point.y}`).join(" ");
  return `M ${first.x} ${first.y} ${segments} Z`;
}
