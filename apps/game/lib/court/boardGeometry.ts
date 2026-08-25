// HM-COURT-GRID-0.3.1 Part B/O: the ONE canonical court projection --
// cellNumber -> row/column -> cell center -> FULL_COURT render
// percentage. This is the EXACT SAME formula
// components/court/CourtGridOverlay.tsx (the /editor/court-grid
// calibration view) already used privately as its own `metersToPct` --
// extracted here so the real Tactics board and the calibration editor
// share one projection function, never two independently-maintained
// copies (Part O: "the calibration editor and the real Tactics
// workspace must not interpret the same cell differently").
//
// HM-COURT-GRID-0.3.1 root cause (Part A, confirmed via inspection of
// MasterCourt.tsx): the SVG's own `preserveAspectRatio="xMidYMid meet"`
// letterboxes whenever its wrapper's rendered aspect ratio doesn't
// exactly match the scene's viewBox ratio. HM-COURT-GRID-0.3's board
// used a fixed pixel HEIGHT with a fluid, unconstrained WIDTH -- almost
// never exactly 1:1 (its old HALF_COURT viewBox) or 1:2 (FULL_COURT) --
// so MasterCourt rendered inside a centered, narrower sub-rectangle of
// the wrapper while this module's percentages were computed against the
// FULL wrapper box, not that letterboxed sub-rect. Cells near the edges
// (column 1/10, row 1/20) therefore projected outside the visually
// rendered court. The fix lives in CourtBoard.tsx's own wrapper (locks
// the wrapper's rendered aspect ratio to exactly match FULL_COURT's
// 20:40, eliminating letterboxing entirely, the same technique already
// proven correct in the calibration editor's own wrapper) -- this
// module's projection math itself was never the bug.
import { cellCenter, COURT_GRID_DEFINITION } from "./courtGrid";

export interface BoardPct {
  xPct: number;
  yPct: number;
}

/**
 * The core primitive every other projection in this codebase (the real
 * Tactics board AND the /editor/court-grid calibration overlay, which
 * needs raw meters for its cell BOUNDS, not just centers) shares --
 * straight, non-flipped meters-to-percent over the full 40m x 20m
 * court. Deterministic, viewport-independent (Part M#5/#18).
 */
export function metersToFullCourtPct(xMeters: number, yMeters: number): BoardPct {
  return {
    xPct: (xMeters / COURT_GRID_DEFINITION.courtWidthMeters) * 100,
    yPct: (yMeters / COURT_GRID_DEFINITION.courtLengthMeters) * 100,
  };
}

/** The one canonical projection for a CELL: cell center, as a percentage of the FULL 40m x 20m court. */
export function cellToFullCourtPct(cellNumber: number): BoardPct {
  const { row, column } = rowColumnOf(cellNumber);
  const center = cellCenter(row, column);
  return metersToFullCourtPct(center.xMeters, center.yMeters);
}

function rowColumnOf(cellNumber: number): { row: number; column: number } {
  const row = Math.floor((cellNumber - 1) / COURT_GRID_DEFINITION.columns) + 1;
  const column = ((cellNumber - 1) % COURT_GRID_DEFINITION.columns) + 1;
  return { row, column };
}

/**
 * Fixed anchors for the goalkeeper, who is explicitly OUT of calibration
 * scope this milestone (tacticalPositionCalibration.ts Part C: "If
 * goalkeeper later needs calibration, that is a separate user-calibrated
 * addition. Do not guess it now."). On the full 40m court, attack's own
 * goal sits at y=0 (top) and defence's own goal at y=40 (bottom) -- see
 * courtGrid.ts's own orientation doc -- so each anchor sits just in
 * front of its own goal.
 */
export const ATTACK_GK_ANCHOR_PCT: BoardPct = { xPct: 50, yPct: 2 };
export const DEFENCE_GK_ANCHOR_PCT: BoardPct = { xPct: 50, yPct: 98 };
