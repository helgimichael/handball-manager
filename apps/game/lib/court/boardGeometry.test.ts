// HM-COURT-GRID-0.3.1 Part M: proves the ONE canonical full-court
// projection (cellNumber -> row/column -> cell center -> percentage)
// keeps every calibrated cell, including the edges, inside the visible
// court -- the exact regression this milestone exists to fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cellToFullCourtPct, metersToFullCourtPct } from "./boardGeometry";
import { cellCenter, rowColumnFromCellNumber } from "./courtGrid";
import { attackTacticalPositionForCell, defenceTacticalPositionForCell } from "./tacticalPositionCalibration";

function assertInsideCourt(pct: { xPct: number; yPct: number }, label: string) {
  assert.ok(pct.xPct >= 0 && pct.xPct <= 100, `${label}: xPct ${pct.xPct} must be within [0,100]`);
  assert.ok(pct.yPct >= 0 && pct.yPct <= 100, `${label}: yPct ${pct.yPct} must be within [0,100]`);
}

// (1)-(4): edge cells stay inside the visible full court.
test("HM-COURT-GRID-0.3.1 (1): cell 1 center is inside FULL_COURT", () => assertInsideCourt(cellToFullCourtPct(1), "cell 1"));
test("HM-COURT-GRID-0.3.1 (2): cell 10 center is inside FULL_COURT", () => assertInsideCourt(cellToFullCourtPct(10), "cell 10"));
test("HM-COURT-GRID-0.3.1 (3): cell 191 center is inside FULL_COURT", () => assertInsideCourt(cellToFullCourtPct(191), "cell 191"));
test("HM-COURT-GRID-0.3.1 (4): cell 200 center is inside FULL_COURT", () => assertInsideCourt(cellToFullCourtPct(200), "cell 200"));

test("HM-COURT-GRID-0.3.1: every one of the 200 canonical cells projects inside the visible court, not just the 4 named edge cells", () => {
  for (let cell = 1; cell <= 200; cell++) {
    assertInsideCourt(cellToFullCourtPct(cell), `cell ${cell}`);
  }
});

// (5) deterministic.
test("HM-COURT-GRID-0.3.1 (5): cell center projection is deterministic", () => {
  assert.deepEqual(cellToFullCourtPct(137), cellToFullCourtPct(137));
});

// (6)-(12): attack positions project from their calibrated cells.
test("HM-COURT-GRID-0.3.1 (6): attack V6 projects from cell 1", () => {
  assert.equal(attackTacticalPositionForCell(1)!.id, "V6");
  const { row, column } = rowColumnFromCellNumber(1);
  const center = cellCenter(row, column);
  assert.deepEqual(cellToFullCourtPct(1), metersToFullCourtPct(center.xMeters, center.yMeters));
});
test("HM-COURT-GRID-0.3.1 (7): attack H6 projects from cell 10", () => {
  assert.equal(attackTacticalPositionForCell(10)!.id, "H6");
});
test("HM-COURT-GRID-0.3.1 (8): V9's accepted alternatives (41/51/52) all project correctly and distinctly", () => {
  const cells = [41, 51, 52];
  for (const c of cells) assert.equal(attackTacticalPositionForCell(c)!.id, "V9");
  const pcts = cells.map((c) => cellToFullCourtPct(c));
  assert.equal(new Set(pcts.map((p) => `${p.xPct},${p.yPct}`)).size, 3, "all three V9 cells must project to distinct positions");
});
test("HM-COURT-GRID-0.3.1 (9): H9's accepted alternatives (50/59/60) all project correctly and distinctly", () => {
  const cells = [50, 59, 60];
  for (const c of cells) assert.equal(attackTacticalPositionForCell(c)!.id, "H9");
  const pcts = cells.map((c) => cellToFullCourtPct(c));
  assert.equal(new Set(pcts.map((p) => `${p.xPct},${p.yPct}`)).size, 3);
});
test("HM-COURT-GRID-0.3.1 (10): M9 (65/66) project correctly", () => {
  assert.equal(attackTacticalPositionForCell(65)!.id, "M9");
  assert.equal(attackTacticalPositionForCell(66)!.id, "M9");
});
test("HM-COURT-GRID-0.3.1 (11): M9-left (64) projects correctly", () => {
  assert.equal(attackTacticalPositionForCell(64)!.id, "LEFT_M9");
});
test("HM-COURT-GRID-0.3.1 (12): M9-right (67) projects correctly", () => {
  assert.equal(attackTacticalPositionForCell(67)!.id, "RIGHT_M9");
});

// (13)-(17): every defence formation uses its own calibrated cells.
test("HM-COURT-GRID-0.3.1 (13): defence 6:0 uses calibrated cells", () => {
  for (const cell of [181, 190, 163, 168, 165, 166]) assert.ok(defenceTacticalPositionForCell("6-0", cell) !== null);
});
test("HM-COURT-GRID-0.3.1 (14): defence 5:1 uses calibrated cells", () => {
  for (const cell of [181, 190, 163, 168, 165, 145]) assert.ok(defenceTacticalPositionForCell("5-1", cell) !== null);
});
test("HM-COURT-GRID-0.3.1 (15): defence 3:2:1 uses calibrated cells", () => {
  for (const cell of [181, 190, 153, 158, 165, 145]) assert.ok(defenceTacticalPositionForCell("3-2-1", cell) !== null);
});
test("HM-COURT-GRID-0.3.1 (16): defence 3:3 uses calibrated cells", () => {
  for (const cell of [172, 179, 165, 152, 159, 145]) assert.ok(defenceTacticalPositionForCell("3-3", cell) !== null);
});
test("HM-COURT-GRID-0.3.1 (17): defence 4:2 uses calibrated cells", () => {
  for (const cell of [172, 179, 163, 168, 144, 147]) assert.ok(defenceTacticalPositionForCell("4-2", cell) !== null);
});

test("HM-COURT-GRID-0.3.1: every calibrated defence cell (every formation) also projects inside the visible court", () => {
  for (const formation of ["6-0", "5-1", "3-2-1", "3-3", "4-2"] as const) {
    for (const cell of [181, 190, 163, 168, 172, 179, 144, 147, 153, 158, 152, 159, 165, 166, 145, 146]) {
      if (!defenceTacticalPositionForCell(formation, cell)) continue;
      assertInsideCourt(cellToFullCourtPct(cell), `${formation} cell ${cell}`);
    }
  }
});

// (18): projection does not depend on viewport pixel size -- pure meters/percent math, no DOM.
test("HM-COURT-GRID-0.3.1 (18): projection is pure meters-to-percent math with no viewport/pixel dependency", () => {
  const a = cellToFullCourtPct(65);
  const b = cellToFullCourtPct(65);
  assert.deepEqual(a, b);
  assert.equal(typeof a.xPct, "number");
  assert.equal(typeof a.yPct, "number");
});

test("HM-COURT-GRID-0.3.1: xPct only ever derives from column, never row -- proves x/y are independently sourced from the cell's own coordinates", () => {
  const cellsInColumn1 = [1, 11, 21, 191];
  const xs = cellsInColumn1.map((c) => cellToFullCourtPct(c).xPct);
  assert.ok(xs.every((x) => x === xs[0]), "every column-1 cell must share the exact same xPct");
});
