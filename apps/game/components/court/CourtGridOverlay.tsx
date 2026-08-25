"use client";

// HM-COURT-GRID-0.1 Part F/G: a pure visual overlay of the canonical
// 20x10 grid (lib/court/courtGrid.ts) on top of a FULL_COURT
// MasterCourtDisplay. Deliberately uses a STRAIGHT (non-flipped)
// meters-to-percent conversion -- unlike courtLayout.ts's half-court chip
// layer, which deliberately Y-flips for its own "goal near panel bottom"
// convention -- so this grid lands pixel-for-pixel on MasterCourt's own
// rendered court lines (see courtGrid.ts's own orientation doc comment).
//
// No tactical semantics here (Part J): no V6/M9/6:0/players/MatchPlan.
// Just cell rectangles, numbers, and a hover/click inspector.
import { useState } from "react";
import { allGridCells, cellBounds, cellCenter, COURT_GRID_DEFINITION, type GridCell } from "@/lib/court/courtGrid";

function metersToPct(xMeters: number, yMeters: number): { xPct: number; yPct: number } {
  return {
    xPct: (xMeters / COURT_GRID_DEFINITION.courtWidthMeters) * 100,
    yPct: (yMeters / COURT_GRID_DEFINITION.courtLengthMeters) * 100,
  };
}

export default function CourtGridOverlay({
  showGrid,
  showNumbers,
}: {
  showGrid: boolean;
  showNumbers: boolean;
}) {
  const [inspected, setInspected] = useState<GridCell | null>(null);

  if (!showGrid) return null;

  const cells = allGridCells();

  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        {cells.map((cell) => {
          const bounds = cellBounds(cell.row, cell.column);
          const topLeft = metersToPct(bounds.minXMeters, bounds.minYMeters);
          const bottomRight = metersToPct(bounds.maxXMeters, bounds.maxYMeters);
          const isInspected = inspected?.cellNumber === cell.cellNumber;
          return (
            <button
              key={cell.cellId}
              type="button"
              onMouseEnter={() => setInspected(cell)}
              onClick={() => setInspected(cell)}
              style={{
                position: "absolute",
                left: `${topLeft.xPct}%`,
                top: `${topLeft.yPct}%`,
                width: `${bottomRight.xPct - topLeft.xPct}%`,
                height: `${bottomRight.yPct - topLeft.yPct}%`,
                border: isInspected ? "1px solid var(--hm-accent)" : "1px solid rgba(226, 245, 238, 0.18)",
                background: isInspected ? "rgba(255,255,255,0.14)" : "transparent",
                padding: 0,
                margin: 0,
                cursor: "crosshair",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-start",
              }}
            >
              {showNumbers && (
                <span
                  style={{
                    fontSize: 9,
                    lineHeight: 1,
                    color: "rgba(226, 245, 238, 0.65)",
                    padding: 2,
                    pointerEvents: "none",
                  }}
                >
                  {cell.cellNumber}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {inspected && (
        <div
          className="hm-panel"
          style={{
            position: "absolute",
            right: 8,
            bottom: 8,
            padding: "8px 12px",
            fontSize: "var(--hm-text-2xs)",
            background: "var(--hm-surface-2)",
            border: "1px solid var(--hm-border)",
            borderRadius: "var(--hm-radius-sm)",
            lineHeight: 1.6,
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 600 }}>CELL {inspected.cellNumber}</div>
          <div>Row {inspected.row} / Column {inspected.column}</div>
          {(() => {
            const b = cellBounds(inspected.row, inspected.column);
            const c = cellCenter(inspected.row, inspected.column);
            return (
              <>
                <div>
                  Bounds: x {b.minXMeters.toFixed(1)}-{b.maxXMeters.toFixed(1)}m, y {b.minYMeters.toFixed(1)}-{b.maxYMeters.toFixed(1)}m
                </div>
                <div>
                  Center: x {c.xMeters.toFixed(1)}m, y {c.yMeters.toFixed(1)}m
                </div>
              </>
            );
          })()}
        </div>
      )}
    </>
  );
}
