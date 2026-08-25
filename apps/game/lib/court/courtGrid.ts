// HM-COURT-GRID-0.1 Part B/C: the canonical 40m x 20m handball court,
// divided into a stable 20-row x 10-column grid of 2m x 2m cells. Pure
// geometry only -- no React, no tactical semantics (no V6/M9/6:0/7v6/
// player/MatchPlan concepts belong here). This module exists so a LATER
// milestone can say "V6 is cell 137" instead of guessing CSS pixels; this
// milestone only builds and proves the coordinate system itself.
//
// Orientation (verified against the existing codebase, see Part C/H):
//   - X / columns: reuses the coach-facing convention already established
//     and tested in components/matchPlan/courtLayout.ts (HM-MATCH-1.3B2
//     Part 4) -- x meters increase from screen-left to screen-right, no
//     flip. Column 1 (x = 0..2m) is screen-left / the "H" side; column 10
//     (x = 18..20m) is screen-right / the "V" side.
//   - Y / rows: reuses FIELD's own native, already-documented convention
//     in HandballCourtGeometry.ts ("Origin (0,0) is the TOP-LEFT corner;
//     y increases down. Goal at y=0 is the 'top' goal, goal at
//     y=COURT_LENGTH_METERS is the 'bottom' goal.") -- NOT the separate,
//     deliberately Y-flipped convention courtLayout.ts uses for its own
//     half-court chip overlay. Using FIELD's native (un-flipped) mapping
//     here means this grid's cells land pixel-for-pixel on top of
//     MasterCourtDisplay's own rendered court lines. Row 1 (y = 0..2m) is
//     the TOP goal's line; row 20 (y = 38..40m) is the BOTTOM goal's line.
import { COURT_LENGTH_METERS, COURT_WIDTH_METERS } from "@handball-manager/match-renderer/src/ui/workspaces/tactics-board/geometry/HandballCourtGeometry.ts";

export const COURT_GRID_DEFINITION = Object.freeze({
  courtLengthMeters: COURT_LENGTH_METERS,
  courtWidthMeters: COURT_WIDTH_METERS,
  rows: 20,
  columns: 10,
  cellLengthMeters: 2,
  cellWidthMeters: 2,
});

export interface GridCell {
  row: number;
  column: number;
  cellNumber: number;
  cellId: string;
}

export interface CourtBounds {
  minXMeters: number;
  maxXMeters: number;
  minYMeters: number;
  maxYMeters: number;
}

export interface CourtPoint {
  xMeters: number;
  yMeters: number;
}

function assertValidRowColumn(row: number, column: number): void {
  if (!Number.isInteger(row) || row < 1 || row > COURT_GRID_DEFINITION.rows) {
    throw new RangeError(`row must be an integer in [1, ${COURT_GRID_DEFINITION.rows}], got ${row}`);
  }
  if (!Number.isInteger(column) || column < 1 || column > COURT_GRID_DEFINITION.columns) {
    throw new RangeError(`column must be an integer in [1, ${COURT_GRID_DEFINITION.columns}], got ${column}`);
  }
}

/** Part C: `cellNumber = (row-1)*columns + column`, giving row1col1=1 .. row20col10=200. */
export function cellNumber(row: number, column: number): number {
  assertValidRowColumn(row, column);
  return (row - 1) * COURT_GRID_DEFINITION.columns + column;
}

export function cellId(row: number, column: number): string {
  assertValidRowColumn(row, column);
  return `R${row}C${column}`;
}

/** Inverse of cellNumber -- deterministic, given a value in [1, 200]. */
export function rowColumnFromCellNumber(n: number): { row: number; column: number } {
  if (!Number.isInteger(n) || n < 1 || n > COURT_GRID_DEFINITION.rows * COURT_GRID_DEFINITION.columns) {
    throw new RangeError(`cell number must be an integer in [1, ${COURT_GRID_DEFINITION.rows * COURT_GRID_DEFINITION.columns}], got ${n}`);
  }
  const row = Math.floor((n - 1) / COURT_GRID_DEFINITION.columns) + 1;
  const column = ((n - 1) % COURT_GRID_DEFINITION.columns) + 1;
  return { row, column };
}

export function cellBounds(row: number, column: number): CourtBounds {
  assertValidRowColumn(row, column);
  const { cellWidthMeters, cellLengthMeters } = COURT_GRID_DEFINITION;
  return {
    minXMeters: (column - 1) * cellWidthMeters,
    maxXMeters: column * cellWidthMeters,
    minYMeters: (row - 1) * cellLengthMeters,
    maxYMeters: row * cellLengthMeters,
  };
}

export function cellCenter(row: number, column: number): CourtPoint {
  const bounds = cellBounds(row, column);
  return {
    xMeters: (bounds.minXMeters + bounds.maxXMeters) / 2,
    yMeters: (bounds.minYMeters + bounds.maxYMeters) / 2,
  };
}

/** Which cell contains a given court point (clamped to the court's own bounds first, so an off-court point still resolves to its nearest edge cell rather than throwing). */
export function courtPointToGridCell(xMeters: number, yMeters: number): GridCell {
  const { cellWidthMeters, cellLengthMeters, rows, columns, courtWidthMeters, courtLengthMeters } = COURT_GRID_DEFINITION;
  const clampedX = Math.min(Math.max(xMeters, 0), courtWidthMeters - 1e-9);
  const clampedY = Math.min(Math.max(yMeters, 0), courtLengthMeters - 1e-9);
  const column = Math.min(Math.floor(clampedX / cellWidthMeters) + 1, columns);
  const row = Math.min(Math.floor(clampedY / cellLengthMeters) + 1, rows);
  return { row, column, cellNumber: cellNumber(row, column), cellId: cellId(row, column) };
}

export function gridCellToCourtPoint(row: number, column: number): CourtPoint {
  return cellCenter(row, column);
}

/** All 200 cells, row-major, cell 1 first. Reusable by any future consumer (calibration UI, later 2D movement) without recomputing the grid itself. */
export function allGridCells(): readonly GridCell[] {
  const cells: GridCell[] = [];
  for (let row = 1; row <= COURT_GRID_DEFINITION.rows; row++) {
    for (let column = 1; column <= COURT_GRID_DEFINITION.columns; column++) {
      cells.push({ row, column, cellNumber: cellNumber(row, column), cellId: cellId(row, column) });
    }
  }
  return cells;
}
