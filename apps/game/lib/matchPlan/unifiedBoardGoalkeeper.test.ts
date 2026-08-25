// HM-TACTICS-BOARD-1.0A Part 11: proves the goalkeeper is excluded from
// the offensive tactical board (visible only in defence) at the DOMAIN
// level -- the level the UI's chip-building loop actually reads from --
// plus the full-cell drop-target geometry invariants (Part 5-9).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { assignAttackCellPosition, resolveAttackSlotCells } from "./attackBoard";
import { currentUnitPlayerIds, setAttackFormation } from "./matchPlanEdits";
import type { MatchPlan, MatchSquad } from "./types";
import { allGridCells, cellBounds, cellCenter, COURT_GRID_DEFINITION, courtPointToGridCell } from "@/lib/court/courtGrid";
import { cellToFullCourtPct } from "@/lib/court/boardGeometry";

function squadOf(n: number): MatchSquad {
  const positions = ["GK", "M9", "V9", "H9", "M6", "V6", "H6", "V9", "M6", "H6"] as const;
  return { fixtureId: "fx1", clubId: "c1", players: Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, position: positions[i % positions.length] })) };
}

function defaultPlan(n = 12): MatchPlan {
  const { plan } = buildDefaultMatchPlan(squadOf(n));
  if (!plan) throw new Error("expected a default plan");
  return plan;
}

function playerIdAtCell(plan: MatchPlan, cellNumber: number): string | undefined {
  const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
  const index = cells.findIndex((c) => c === cellNumber);
  return index === -1 ? undefined : plan.attackStartingUnit.slots[index].playerId;
}

// (1) normal attack board renders 6 outcourt assignments.
test("HM-TACTICS-BOARD-1.0A (1): normal (6v6) attack resolves exactly 6 non-null outcourt cells", () => {
  const plan = defaultPlan();
  const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
  const nonNull = cells.filter((c) => c !== null);
  assert.equal(nonNull.length, 6);
  assert.equal(cells.length, 7, "the 7th slot (GK) still exists structurally in the domain");
});

// (2) normal attack board does not expose GK tactical marker.
test("HM-TACTICS-BOARD-1.0A (2): the GK slot always resolves to null (never a calibrated cell) -- this is exactly the signal the board's chip-building loop uses to skip it", () => {
  const plan = defaultPlan();
  const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
  const gkIndex = plan.attackStartingUnit.slots.findIndex((s) => s.position === "GK");
  assert.equal(cells[gkIndex], null);
});

// (3) defence board still exposes goalkeeper.
test("HM-TACTICS-BOARD-1.0A (3): defence still exposes a real goalkeeperId, untouched by the attack-GK-hiding change", () => {
  const plan = defaultPlan();
  assert.ok(plan.defenceStartingUnit.goalkeeperId);
  assert.equal(plan.squad.players.find((p) => p.playerId === plan.defenceStartingUnit.goalkeeperId)?.position, "GK");
});

// (4) 7v6 attack board renders exactly 7 outcourt markers.
test("HM-TACTICS-BOARD-1.0A (4): 7v6 attack resolves exactly 7 non-null outcourt cells", () => {
  const plan = setAttackFormation(defaultPlan(), "SEVEN_V_SIX");
  const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
  assert.equal(cells.filter((c) => c !== null).length, 7);
  assert.equal(cells.length, 7);
});

// (5) 7v6 attack board has no goalkeeper marker.
test("HM-TACTICS-BOARD-1.0A (5): 7v6 has zero GK-position slots at all -- there is nothing for the board to even consider skipping", () => {
  const plan = setAttackFormation(defaultPlan(), "SEVEN_V_SIX");
  assert.ok(!plan.attackStartingUnit.slots.some((s) => s.position === "GK"));
});

// (6) normal MatchUsage current unit still contains GK correctly.
test("HM-TACTICS-BOARD-1.0A (6): currentUnitPlayerIds('ATTACK') for 6v6 is still 7 and includes the goalkeeper -- hiding the MARKER never changes actual match membership", () => {
  const plan = defaultPlan();
  const ids = currentUnitPlayerIds(plan, "ATTACK");
  assert.equal(ids.size, 7);
  const gkId = plan.attackStartingUnit.slots.find((s) => s.position === "GK")!.playerId;
  assert.ok(ids.has(gkId));
});

// (7) full canonical grid cell bounds are used as drop target.
test("HM-TACTICS-BOARD-1.0A (7): every canonical cell is exactly 2m x 2m -- the constant fraction CourtBoard.tsx derives its full-cell drop hitbox from", () => {
  for (const { row, column } of allGridCells()) {
    const b = cellBounds(row, column);
    assert.equal(b.maxXMeters - b.minXMeters, COURT_GRID_DEFINITION.cellWidthMeters);
    assert.equal(b.maxYMeters - b.minYMeters, COURT_GRID_DEFINITION.cellLengthMeters);
  }
});

// (8) drop anywhere within valid cell resolves to same cellNumber.
test("HM-TACTICS-BOARD-1.0A (8): any point within a cell's bounds -- center, corners, edges -- resolves to the SAME canonical cellNumber", () => {
  const cellNumber = 65; // M9
  const { row, column } = allGridCells().find((c) => c.cellNumber === cellNumber)!;
  const b = cellBounds(row, column);
  const points = [
    cellCenter(row, column),
    { xMeters: b.minXMeters + 0.01, yMeters: b.minYMeters + 0.01 }, // near top-left corner
    { xMeters: b.maxXMeters - 0.01, yMeters: b.maxYMeters - 0.01 }, // near bottom-right corner
    { xMeters: b.minXMeters + 0.01, yMeters: b.maxYMeters - 0.01 }, // near bottom-left corner
    { xMeters: b.maxXMeters - 0.01, yMeters: b.minYMeters + 0.01 }, // near top-right corner
  ];
  for (const p of points) {
    assert.equal(courtPointToGridCell(p.xMeters, p.yMeters).cellNumber, cellNumber);
  }
});

// (9) invalid/non-approved cells reject tactical drop.
test("HM-TACTICS-BOARD-1.0A (9): dropping onto a cell outside the attack calibration is rejected -- the plan is returned unchanged", () => {
  const plan = defaultPlan();
  const v6Player = playerIdAtCell(plan, 1)!;
  const next = assignAttackCellPosition(plan, v6Player, 999);
  assert.deepEqual(next, plan);
});

// (10) player marker snaps to cell center after drop.
test("HM-TACTICS-BOARD-1.0A (10): the assigned marker position is always the cell's own CENTER, regardless of which cellNumber-resolving point the drop occurred at -- cellToFullCourtPct depends only on cellNumber, never a pointer coordinate", () => {
  const plan = defaultPlan();
  const m9Player = playerIdAtCell(plan, 65)!;
  const next = assignAttackCellPosition(plan, m9Player, 34); // M6_LEFT
  const index = next.attackStartingUnit.slots.findIndex((s) => s.playerId === m9Player);
  assert.equal(next.attackStartingUnit.slots[index].cellNumber, 34);
  const pct = cellToFullCourtPct(34);
  const { row, column } = allGridCells().find((c) => c.cellNumber === 34)!;
  const center = cellCenter(row, column);
  assert.equal(pct.xPct, (center.xMeters / COURT_GRID_DEFINITION.courtWidthMeters) * 100);
  assert.equal(pct.yPct, (center.yMeters / COURT_GRID_DEFINITION.courtLengthMeters) * 100);
});
