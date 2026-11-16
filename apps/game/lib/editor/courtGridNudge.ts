// Arena Nights SYS-02e -- keyboard nudge for the court grid inspector (dev editor only).
// Pure: moves the inspected cell one step on the canonical grid, clamped at the court edges.
// Uses the canonical grid helpers; never changes the grid or calibration itself.
import { cellId, cellNumber, COURT_GRID_DEFINITION, rowColumnFromCellNumber, type GridCell } from "../court/courtGrid";

export type NudgeKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

export function isNudgeKey(key: string): key is NudgeKey {
  return key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight";
}

/** Next cell from `current` (null = start at cell 1). Up = towards row 1 (top goal), Left = towards column 1. */
export function nudgeCell(current: number | null, key: NudgeKey): GridCell {
  const { rows, columns } = COURT_GRID_DEFINITION;
  const start = current === null ? { row: 1, column: 1 } : rowColumnFromCellNumber(current);
  let { row, column } = start;
  if (current !== null) {
    if (key === "ArrowUp") row = Math.max(1, row - 1);
    if (key === "ArrowDown") row = Math.min(rows, row + 1);
    if (key === "ArrowLeft") column = Math.max(1, column - 1);
    if (key === "ArrowRight") column = Math.min(columns, column + 1);
  }
  return { row, column, cellNumber: cellNumber(row, column), cellId: cellId(row, column) };
}
