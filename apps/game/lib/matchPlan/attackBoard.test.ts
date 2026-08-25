// HM-COURT-GRID-0.3 Part T: proves the canonical-grid-cell attack board
// (Part 3-18, 21-22, 27-28 of the required test list).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { assignAttackCellPosition, resolveAttackSlotCells, attackSlotTacticalPosition } from "./attackBoard";
import { currentUnitPlayerIds, setAttackFormation, setSevenVSixStructure } from "./matchPlanEdits";
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
  const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
  const index = cells.findIndex((c) => c === cellNumber);
  return index === -1 ? undefined : plan.attackStartingUnit.slots[index].playerId;
}

// (3) V6 uses accepted cell 1 / (4) H6 uses accepted cell 10 -- via defaults for a freshly-built plan.
test("HM-COURT-GRID-0.3 (3/4): a freshly built plan's V6/H6 slots resolve to their calibrated cells 1 and 10", () => {
  const plan = defaultPlan();
  const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
  const v6Index = plan.attackStartingUnit.slots.findIndex((s) => s.position === "V6");
  const h6Index = plan.attackStartingUnit.slots.findIndex((s) => s.position === "H6");
  assert.equal(cells[v6Index], 1);
  assert.equal(cells[h6Index], 10);
});

// (10) dragging within same role changes cell but preserves tactical role.
test("HM-COURT-GRID-0.3 (10): dragging a player between two accepted V9 cells (51 -> 41) preserves the V9 tactical role", () => {
  const plan = defaultPlan();
  const v9PlayerId = playerIdAtCell(plan, 51)!;
  const next = assignAttackCellPosition(plan, v9PlayerId, 41);
  const cells = resolveAttackSlotCells(next.attackStartingUnit.slots);
  const index = next.attackStartingUnit.slots.findIndex((s) => s.playerId === v9PlayerId);
  assert.equal(cells[index], 41);
  assert.equal(next.attackStartingUnit.slots[index].position, "V9");
  assert.equal(attackSlotTacticalPosition(cells[index])!.id, "V9");
});

// (11) dragging M9 -> M6 changes tactical role.
test("HM-COURT-GRID-0.3 (11): dragging the M9 player onto the M6_LEFT cell (34) changes their tactical role to M6", () => {
  const plan = defaultPlan();
  const m9PlayerId = playerIdAtCell(plan, 65)!;
  const next = assignAttackCellPosition(plan, m9PlayerId, 34);
  const index = next.attackStartingUnit.slots.findIndex((s) => s.playerId === m9PlayerId);
  assert.equal(next.attackStartingUnit.slots[index].position, "M6");
  assert.equal(next.attackStartingUnit.slots[index].cellNumber, 34);
  assert.equal(attackSlotTacticalPosition(34)!.id, "M6_LEFT");
});

// (12) natural position unchanged.
test("HM-COURT-GRID-0.3 (12): a tactical reassignment never touches the player's own natural squad position", () => {
  const plan = defaultPlan();
  const m9PlayerId = playerIdAtCell(plan, 65)!;
  const naturalBefore = plan.squad.players.find((p) => p.playerId === m9PlayerId)!.position;
  const next = assignAttackCellPosition(plan, m9PlayerId, 34);
  const naturalAfter = next.squad.players.find((p) => p.playerId === m9PlayerId)!.position;
  assert.equal(naturalAfter, naturalBefore);
});

// (13) one cell cannot have two players.
test("HM-COURT-GRID-0.3 (13): after any assignment, no two slots ever resolve to the same cell", () => {
  const plan = defaultPlan();
  const m9PlayerId = playerIdAtCell(plan, 65)!;
  const next = assignAttackCellPosition(plan, m9PlayerId, 34);
  const cells = resolveAttackSlotCells(next.attackStartingUnit.slots).filter((c): c is number => c !== null);
  assert.equal(new Set(cells).size, cells.length);
});

// (14) occupied-cell board swap preserves both players.
test("HM-COURT-GRID-0.3 (14): dragging a board player onto an OCCUPIED cell swaps both players (both preserved, roles traded)", () => {
  const plan = defaultPlan();
  const v6PlayerId = playerIdAtCell(plan, 1)!;
  const h6PlayerId = playerIdAtCell(plan, 10)!;
  const next = assignAttackCellPosition(plan, v6PlayerId, 10);
  assert.equal(playerIdAtCell(next, 10), v6PlayerId);
  assert.equal(playerIdAtCell(next, 1), h6PlayerId);
  const v6Index = next.attackStartingUnit.slots.findIndex((s) => s.playerId === v6PlayerId);
  const h6Index = next.attackStartingUnit.slots.findIndex((s) => s.playerId === h6PlayerId);
  assert.equal(next.attackStartingUnit.slots[v6Index].position, "H6");
  assert.equal(next.attackStartingUnit.slots[h6Index].position, "V6");
});

// (15) bench replacement returns displaced player to bench.
test("HM-COURT-GRID-0.3 (15): a bench player dropped onto an occupied cell replaces the occupant, who returns to the bench", () => {
  const plan = defaultPlan();
  const benchPlayer = plan.squad.players.find((p) => p.position !== "GK" && !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId))!;
  const displaced = playerIdAtCell(plan, 1)!;
  const next = assignAttackCellPosition(plan, benchPlayer.playerId, 1);
  assert.equal(playerIdAtCell(next, 1), benchPlayer.playerId);
  assert.ok(!next.attackStartingUnit.slots.some((s) => s.playerId === displaced));
});

// (16) custom two-M6 shape validates.
test("HM-COURT-GRID-0.3 (16): a custom two-pivot shape (V9 player moved to M6_RIGHT) validates as a legal MatchPlan", () => {
  const plan = defaultPlan();
  const v9PlayerId = playerIdAtCell(plan, 51)!;
  const next = assignAttackCellPosition(plan, v9PlayerId, 37);
  const positions = next.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => s.position);
  assert.equal(positions.filter((p) => p === "M6").length, 2);
  const validation = validateMatchPlan(next, next.squad.players.map((p) => p.playerId));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

// (17) custom four-backcourt shape validates.
test("HM-COURT-GRID-0.3 (17): a custom four-backcourt shape (V6/V9/LEFT_M9/RIGHT_M9/H9/H6, no M6) validates as a legal MatchPlan -- the milestone's own Part I example", () => {
  let plan = defaultPlan();
  const m9Player = playerIdAtCell(plan, 65)!;
  plan = assignAttackCellPosition(plan, m9Player, 64); // central M9 -> LEFT_M9
  const m6Player = playerIdAtCell(plan, 34)!;
  plan = assignAttackCellPosition(plan, m6Player, 67); // M6 -> RIGHT_M9

  const positions = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => s.position);
  assert.equal(positions.filter((p) => p === "M9").length, 2, "LEFT_M9 and RIGHT_M9 both resolve to engine position M9 -- four backcourt players total (V9, LEFT_M9, RIGHT_M9, H9)");
  assert.equal(positions.filter((p) => p === "M6").length, 0, "no M6 remains in this custom shape");
  assert.equal(attackSlotTacticalPosition(64)!.id, "LEFT_M9");
  assert.equal(attackSlotTacticalPosition(67)!.id, "RIGHT_M9");
  const validation = validateMatchPlan(plan, plan.squad.players.map((p) => p.playerId));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

// (18) normal complete attack contains exactly 7.
test("HM-COURT-GRID-0.3 (18): a normal complete attack unit always contains exactly 7 slots regardless of shape edits", () => {
  const plan = defaultPlan();
  const m9PlayerId = playerIdAtCell(plan, 65)!;
  const next = assignAttackCellPosition(plan, m9PlayerId, 34);
  assert.equal(next.attackStartingUnit.slots.length, 7);
  assert.equal(currentUnitPlayerIds(next, "ATTACK").size, 7);
});

// (21) 7v6 DOUBLE M6 uses both M6 cells.
test("HM-COURT-GRID-0.3 (21): switching to 7v6 DOUBLE_PIVOT uses both calibrated M6 cells (34 and 37)", () => {
  const plan = setAttackFormation(defaultPlan(), "SEVEN_V_SIX", "DOUBLE_PIVOT");
  const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots);
  assert.ok(cells.includes(34), "M6_LEFT cell must be used");
  assert.ok(cells.includes(37), "M6_RIGHT cell must be used");
});

// (22) 7v6 has seven outcourt/no GK.
test("HM-COURT-GRID-0.3 (22): a 7v6 attack unit has exactly 7 outcourt slots and no goalkeeper slot", () => {
  const plan = setAttackFormation(defaultPlan(), "SEVEN_V_SIX", "EXTRA_BACKCOURT");
  assert.equal(plan.attackStartingUnit.slots.length, 7);
  assert.ok(!plan.attackStartingUnit.slots.some((s) => s.position === "GK"));
  assert.equal(currentUnitPlayerIds(plan, "ATTACK").size, 7);
});

test("HM-COURT-GRID-0.3: 7v6 EXTRA_BACKCOURT's two M9-position slots resolve to distinct calibrated cells (M9 and RIGHT_M9), eliminating the old duplicate-wing overlap bug", () => {
  const plan = setSevenVSixStructure(setAttackFormation(defaultPlan(), "SEVEN_V_SIX", "EXTRA_BACKCOURT"), "EXTRA_BACKCOURT");
  const cells = resolveAttackSlotCells(plan.attackStartingUnit.slots).filter((c): c is number => c !== null);
  assert.equal(new Set(cells).size, cells.length, "no two slots share a cell");
});

test("HM-COURT-GRID-0.3: rejects a targetCellNumber that isn't part of the attack calibration -- never invents a snap cell", () => {
  const plan = defaultPlan();
  const v6PlayerId = playerIdAtCell(plan, 1)!;
  const next = assignAttackCellPosition(plan, v6PlayerId, 999);
  assert.deepEqual(next, plan);
});

test("HM-COURT-GRID-0.3: regression -- moving one M9 slot onto the M6_RIGHT cell while a second, still-default M6 slot exists must NOT collide (found via browser QA: the second slot's fallback previously ignored cells already explicitly claimed elsewhere)", () => {
  const plan = defaultPlan();
  const m9PlayerId = playerIdAtCell(plan, 65)!;
  const oliverM6LeftPlayerId = playerIdAtCell(plan, 34)!;
  const next = assignAttackCellPosition(plan, m9PlayerId, 37); // M9 -> M6_RIGHT, while the OTHER M6 slot (34) still has no explicit cellNumber
  assert.notEqual(oliverM6LeftPlayerId, undefined);
  assert.equal(playerIdAtCell(next, 37), m9PlayerId, "the dragged player must be at cell 37");
  assert.equal(playerIdAtCell(next, 34), oliverM6LeftPlayerId, "the untouched M6 slot must still resolve to its own default cell 34, not also collide at 37");
  const cells = resolveAttackSlotCells(next.attackStartingUnit.slots).filter((c): c is number => c !== null);
  assert.equal(new Set(cells).size, cells.length, "no two slots share a cell");
});

test("HM-COURT-GRID-0.3: an old-style AttackUnitSlot with no cellNumber at all still resolves deterministically via defaults (migration path)", () => {
  const plan = defaultPlan();
  const stripped = { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots: plan.attackStartingUnit.slots.map((s) => ({ playerId: s.playerId, position: s.position })) } };
  const cells = resolveAttackSlotCells(stripped.attackStartingUnit.slots);
  const cellsAgain = resolveAttackSlotCells(stripped.attackStartingUnit.slots);
  assert.deepEqual(cells, cellsAgain, "deterministic across repeated calls");
  const v6Index = stripped.attackStartingUnit.slots.findIndex((s) => s.position === "V6");
  assert.equal(cells[v6Index], 1);
});
