// HM-COURT-GRID-0.3 Part T#19/20: proves the canonical-grid-cell
// defence board comes from manual calibration and is deterministic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { assignDefenceCellPosition, resolveDefenceSlotCells, defenceSlotTacticalPosition } from "./defenceBoard";
import { currentUnitPlayerIds } from "./matchPlanEdits";
import { validateMatchPlan } from "./matchPlan";
import type { MatchPlan, MatchSquad } from "./types";

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
  const formation = plan.defencePlan.baseFormation as "6-0";
  const cells = resolveDefenceSlotCells(formation, plan.defenceStartingUnit.courtSlots);
  const index = cells.findIndex((c) => c === cellNumber);
  return index === -1 ? undefined : plan.defenceStartingUnit.courtSlots[index].playerId;
}

// (19) defence geometry comes from manual calibration.
test("HM-COURT-GRID-0.3 (19): a freshly built 6:0 defence unit's slots resolve to exactly the manually calibrated cells", () => {
  const plan = defaultPlan();
  const cells = resolveDefenceSlotCells("6-0", plan.defenceStartingUnit.courtSlots);
  assert.deepEqual([...cells].sort((a, b) => (a ?? 0) - (b ?? 0)), [163, 165, 166, 168, 181, 190]);
});

// (20) defence preset deterministic.
test("HM-COURT-GRID-0.3 (20): resolving defence slot cells is deterministic across repeated calls", () => {
  const plan = defaultPlan();
  const a = resolveDefenceSlotCells("6-0", plan.defenceStartingUnit.courtSlots);
  const b = resolveDefenceSlotCells("6-0", plan.defenceStartingUnit.courtSlots);
  assert.deepEqual(a, b);
});

test("HM-COURT-GRID-0.3: dragging a defence player between two accepted cells of their own role (6:0 has none, but 5:1's CH 165<->166) preserves the CH label", () => {
  let plan = defaultPlan();
  plan = { ...plan, defencePlan: { ...plan.defencePlan, baseFormation: "5-1" } };
  const chPlayerId = playerIdAtCell(plan, 165)!;
  const next = assignDefenceCellPosition(plan, chPlayerId, 166);
  const index = next.defenceStartingUnit.courtSlots.findIndex((s) => s.playerId === chPlayerId);
  assert.equal(next.defenceStartingUnit.courtSlots[index].cellNumber, 166);
  assert.equal(defenceSlotTacticalPosition("5-1", next.defenceStartingUnit.courtSlots[index].courtSlot)!.id, "CH");
});

test("HM-COURT-GRID-0.3: dragging a 6:0 V1 player onto the H1 cell swaps both players' roles", () => {
  const plan = defaultPlan();
  const v1PlayerId = playerIdAtCell(plan, 181)!;
  const h1PlayerId = playerIdAtCell(plan, 190)!;
  const next = assignDefenceCellPosition(plan, v1PlayerId, 190);
  assert.equal(playerIdAtCell(next, 190), v1PlayerId);
  assert.equal(playerIdAtCell(next, 181), h1PlayerId);
});

test("HM-COURT-GRID-0.3: a bench player dropped onto an occupied defence cell replaces the occupant, who returns to the bench", () => {
  const plan = defaultPlan();
  const bench = plan.squad.players.find((p) => p.position !== "GK" && !plan.defenceStartingUnit.courtSlots.some((s) => s.playerId === p.playerId))!;
  const displaced = playerIdAtCell(plan, 181)!;
  const next = assignDefenceCellPosition(plan, bench.playerId, 181);
  assert.equal(playerIdAtCell(next, 181), bench.playerId);
  assert.ok(!next.defenceStartingUnit.courtSlots.some((s) => s.playerId === displaced));
});

test("HM-COURT-GRID-0.3: defence always keeps exactly 6 court slots (one occupant per calibrated cell) after any edit -- PÅ PLAN stays 7", () => {
  const plan = defaultPlan();
  const v1PlayerId = playerIdAtCell(plan, 181)!;
  const next = assignDefenceCellPosition(plan, v1PlayerId, 190);
  assert.equal(next.defenceStartingUnit.courtSlots.length, 6);
  assert.equal(currentUnitPlayerIds(next, "DEFENCE").size, 7);
  const validation = validateMatchPlan(next, next.squad.players.map((p) => p.playerId));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test("HM-COURT-GRID-0.3: rejects a targetCellNumber that isn't part of the current formation's own calibration -- an attack cell is never a valid defence drop target", () => {
  const plan = defaultPlan();
  const v1PlayerId = playerIdAtCell(plan, 181)!;
  const next = assignDefenceCellPosition(plan, v1PlayerId, 1); // cell 1 = attack's V6, not any 6:0 defence position
  assert.deepEqual(next, plan);
});

test("HM-COURT-GRID-0.3: switching formation changes which label a courtSlot resolves to, without moving any player -- courtSlot 3 becomes CH under 5:1 instead of V3 under 6:0", () => {
  assert.equal(defenceSlotTacticalPosition("6-0", 3)!.id, "V3");
  assert.equal(defenceSlotTacticalPosition("5-1", 3)!.id, "CH");
});
