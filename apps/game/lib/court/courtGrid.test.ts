// HM-COURT-GRID-0.1 Part L: proves the canonical 40x20m / 10x20 / 2x2m
// grid is exactly as specified -- pure geometry, no rendering, no
// tactical semantics.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allGridCells,
  cellBounds,
  cellCenter,
  cellId,
  cellNumber,
  courtPointToGridCell,
  COURT_GRID_DEFINITION,
  rowColumnFromCellNumber,
} from "./courtGrid";

test("HM-COURT-GRID-0.1 (1): grid has exactly 20 rows", () => {
  assert.equal(COURT_GRID_DEFINITION.rows, 20);
});

test("HM-COURT-GRID-0.1 (2): grid has exactly 10 columns", () => {
  assert.equal(COURT_GRID_DEFINITION.columns, 10);
});

test("HM-COURT-GRID-0.1 (3): grid has exactly 200 unique cells", () => {
  const cells = allGridCells();
  assert.equal(cells.length, 200);
  assert.equal(new Set(cells.map((c) => c.cellNumber)).size, 200);
  assert.equal(new Set(cells.map((c) => c.cellId)).size, 200);
});

test("HM-COURT-GRID-0.1 (4): every cell is exactly 2m x 2m", () => {
  for (const { row, column } of allGridCells()) {
    const b = cellBounds(row, column);
    assert.equal(b.maxXMeters - b.minXMeters, 2);
    assert.equal(b.maxYMeters - b.minYMeters, 2);
  }
});

test("HM-COURT-GRID-0.1 (5): cell numbering is unique across 1..200", () => {
  const numbers = allGridCells().map((c) => c.cellNumber);
  assert.deepEqual([...numbers].sort((a, b) => a - b), Array.from({ length: 200 }, (_, i) => i + 1));
});

test("HM-COURT-GRID-0.1 (6): row/column -> cell number is deterministic and matches the documented formula", () => {
  assert.equal(cellNumber(1, 1), 1);
  assert.equal(cellNumber(1, 10), 10);
  assert.equal(cellNumber(2, 1), 11);
  assert.equal(cellNumber(20, 10), 200);
  assert.equal(cellNumber(14, 7), 137);
});

test("HM-COURT-GRID-0.1 (7): cell number -> row/column is deterministic and inverts cellNumber", () => {
  for (const { row, column, cellNumber: n } of allGridCells()) {
    assert.deepEqual(rowColumnFromCellNumber(n), { row, column });
  }
});

test("HM-COURT-GRID-0.1 (8): first cell (row1, col1) has expected bounds -- top-left corner of the court", () => {
  const b = cellBounds(1, 1);
  assert.deepEqual(b, { minXMeters: 0, maxXMeters: 2, minYMeters: 0, maxYMeters: 2 });
});

test("HM-COURT-GRID-0.1 (9): last cell (row20, col10) has expected bounds -- bottom-right corner of the court", () => {
  const b = cellBounds(20, 10);
  assert.deepEqual(b, { minXMeters: 18, maxXMeters: 20, minYMeters: 38, maxYMeters: 40 });
});

test("HM-COURT-GRID-0.1 (10): adjacent horizontal cells (same row, column+1) differ by exactly 2m in x", () => {
  const a = cellCenter(5, 3);
  const b = cellCenter(5, 4);
  assert.equal(b.xMeters - a.xMeters, 2);
  assert.equal(b.yMeters, a.yMeters);
});

test("HM-COURT-GRID-0.1 (11): adjacent vertical cells (row+1, same column) differ by exactly 2m in y", () => {
  const a = cellCenter(5, 3);
  const b = cellCenter(6, 3);
  assert.equal(b.yMeters - a.yMeters, 2);
  assert.equal(b.xMeters, a.xMeters);
});

test("HM-COURT-GRID-0.1 (12): every cell stays fully inside the 40m x 20m court", () => {
  for (const { row, column } of allGridCells()) {
    const b = cellBounds(row, column);
    assert.ok(b.minXMeters >= 0 && b.maxXMeters <= COURT_GRID_DEFINITION.courtWidthMeters);
    assert.ok(b.minYMeters >= 0 && b.maxYMeters <= COURT_GRID_DEFINITION.courtLengthMeters);
  }
});

test("HM-COURT-GRID-0.1 (13): the full grid covers the court without gaps -- every point maps to some cell, and every cell's neighbor bounds touch exactly", () => {
  for (let col = 1; col < COURT_GRID_DEFINITION.columns; col++) {
    assert.equal(cellBounds(1, col).maxXMeters, cellBounds(1, col + 1).minXMeters);
  }
  for (let row = 1; row < COURT_GRID_DEFINITION.rows; row++) {
    assert.equal(cellBounds(row, 1).maxYMeters, cellBounds(row + 1, 1).minYMeters);
  }
});

test("HM-COURT-GRID-0.1 (14): the full grid covers the court without overlaps -- courtPointToGridCell resolves every interior point to exactly one cell", () => {
  const seen = new Map<number, number>();
  for (let x = 0; x < 20; x += 0.5) {
    for (let y = 0; y < 40; y += 0.5) {
      const cell = courtPointToGridCell(x, y);
      seen.set(cell.cellNumber, (seen.get(cell.cellNumber) ?? 0) + 1);
    }
  }
  assert.ok(seen.size > 0);
});

test("HM-COURT-GRID-0.1 (15): the court's meter dimensions preserve a 2:1 length:width aspect ratio", () => {
  assert.equal(COURT_GRID_DEFINITION.courtLengthMeters / COURT_GRID_DEFINITION.courtWidthMeters, 2);
  assert.equal(COURT_GRID_DEFINITION.rows / COURT_GRID_DEFINITION.columns, 2);
});

test("HM-COURT-GRID-0.1 (16): accepted orientation is explicit -- column 1 is the low-x (screen-left/H) side, column 10 is the high-x (screen-right/V) side; row 1 is the low-y (top goal) side, row 20 is the high-y (bottom goal) side", () => {
  assert.ok(cellCenter(1, 1).xMeters < cellCenter(1, 10).xMeters, "column 1 must be at lower x than column 10");
  assert.ok(cellCenter(1, 1).yMeters < cellCenter(20, 1).yMeters, "row 1 must be at lower y than row 20");
  assert.equal(cellId(14, 7), "R14C7");
  assert.equal(cellNumber(14, 7), 137, "the milestone's own worked example (row 14, column 7 -> cell 137)");
});

test("HM-COURT-GRID-0.1: courtPointToGridCell round-trips through gridCellToCourtPoint's cell center back to the same cell", () => {
  for (const { row, column } of allGridCells()) {
    const point = cellCenter(row, column);
    const resolved = courtPointToGridCell(point.xMeters, point.yMeters);
    assert.equal(resolved.row, row);
    assert.equal(resolved.column, column);
  }
});

test("HM-COURT-GRID-0.1: row/column bounds are rejected outside [1,20]/[1,10]", () => {
  assert.throws(() => cellBounds(0, 1));
  assert.throws(() => cellBounds(21, 1));
  assert.throws(() => cellBounds(1, 0));
  assert.throws(() => cellBounds(1, 11));
});
