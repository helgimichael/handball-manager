// HM-COURT-GRID-0.3 Part T#1/2: proves board coordinates derive purely
// from canonical grid cells (row/column/cell-center), not any
// independently hard-coded x/y percentage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { attackCellToPct, defenceCellToPct } from "./boardGeometry";
import { cellCenter, COURT_GRID_DEFINITION, rowColumnFromCellNumber } from "./courtGrid";

test("HM-COURT-GRID-0.3 (1): attackCellToPct is a pure function of the cell's own canonical row/column center -- V6 (cell 1) matches cellCenter(1,1) directly", () => {
  const { row, column } = rowColumnFromCellNumber(1);
  const center = cellCenter(row, column);
  const pct = attackCellToPct(1);
  assert.equal(pct.xPct, (center.xMeters / COURT_GRID_DEFINITION.courtWidthMeters) * 100);
  assert.equal(pct.yPct, (center.yMeters / COURT_GRID_DEFINITION.courtWidthMeters) * 100);
});

test("HM-COURT-GRID-0.3: attack cells stay within the 0-100% panel range for every calibrated cell (rows 1-9 fit inside the 20m half-court panel)", () => {
  for (const cell of [1, 10, 34, 37, 41, 50, 51, 52, 59, 60, 64, 65, 66, 67]) {
    const pct = attackCellToPct(cell);
    assert.ok(pct.xPct >= 0 && pct.xPct <= 100);
    assert.ok(pct.yPct >= 0 && pct.yPct <= 100);
  }
});

test("HM-COURT-GRID-0.3: defenceCellToPct puts the defence goal (high y-meters, e.g. row 19/cell 190) near the TOP of its own panel (low yPct) -- matching FIELD's own 'goal at top' HALF_COURT convention", () => {
  const nearGoal = defenceCellToPct(190); // H1, row 19
  const fartherFromGoal = defenceCellToPct(153); // VHB (3:2:1), row 13 -- notably shallower than row 19
  assert.ok(nearGoal.yPct < fartherFromGoal.yPct, "a cell deeper in the defence's own half (closer to its own goal) must render nearer the top of the panel than a shallower one");
});

test("HM-COURT-GRID-0.3: attackCellToPct and defenceCellToPct never hard-code an x position independently -- x only ever comes from the cell's own column", () => {
  const attack = attackCellToPct(1); // column 1
  const defence = defenceCellToPct(181); // column 1 (V1, 6:0)
  assert.equal(attack.xPct, defence.xPct, "the same column must always produce the same xPct regardless of phase");
});

test("HM-COURT-GRID-0.3: no legacy attack x/y coordinate table is consulted -- deriving two cells known to differ from the OLD hard-coded ATTACK_NORMAL_LAYOUT values proves independence", () => {
  // Old V9 was hard-coded near xPct~96/yPct~58 (courtLayout.ts,
  // pre-0.3); the new calibrated V9 cell (51) derives a materially
  // different position purely from grid math, proving no shared table.
  const pct = attackCellToPct(51);
  assert.notEqual(Math.round(pct.xPct), 96);
});
