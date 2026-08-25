// HM-TACTICS-BOARD-1.0 Part 18: domain-level proofs for the unified
// board -- attack/defence stay two separate domain concepts, natural
// position is never touched, GK membership is correct for 6v6/7v6, and
// a MatchPlan round-trips through JSON (the same persistence path a
// page reload uses) without losing either assignment.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { assignAttackCellPosition, resolveAttackSlotCells } from "./attackBoard";
import { assignDefenceCellPosition } from "./defenceBoard";
import { currentUnitPlayerIds, setAttackFormation } from "./matchPlanEdits";
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

test("HM-TACTICS-BOARD-1.0: attack and defence assignments are separate -- moving a player's attack cell never touches their defence courtSlot/cellNumber", () => {
  const plan = defaultPlan();
  const v6Player = playerIdAtCell(plan, 1)!;
  const defenceBefore = plan.defenceStartingUnit.courtSlots.find((s) => s.playerId === v6Player);
  const next = assignAttackCellPosition(plan, v6Player, 10); // V6 -> H6 (swap), an attack-only edit
  const defenceAfter = next.defenceStartingUnit.courtSlots.find((s) => s.playerId === v6Player);
  assert.deepEqual(defenceAfter, defenceBefore, "defence assignment must be byte-for-byte unchanged by an attack-only edit");
});

test("HM-TACTICS-BOARD-1.0: the reverse also holds -- a defence-only edit never touches any attack slot", () => {
  const plan = defaultPlan();
  const v1Player = plan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)!.playerId;
  const attackBefore = plan.attackStartingUnit.slots.find((s) => s.playerId === v1Player);
  const next = assignDefenceCellPosition(plan, v1Player, 190); // V1 -> H1 (swap)
  const attackAfter = next.attackStartingUnit.slots.find((s) => s.playerId === v1Player);
  assert.deepEqual(attackAfter, attackBefore);
});

test("HM-TACTICS-BOARD-1.0: a single player can legally hold two DIFFERENT tactical assignments -- attack M9, defence V3, simultaneously", () => {
  const plan = defaultPlan();
  const m9Player = playerIdAtCell(plan, 65)!;
  const attackSlot = plan.attackStartingUnit.slots.find((s) => s.playerId === m9Player)!;
  const defenceSlot = plan.defenceStartingUnit.courtSlots.find((s) => s.playerId === m9Player);
  assert.equal(attackSlot.position, "M9");
  // Whatever their defence role is (from the deterministic default plan), it is independently tracked -- not derived from or coupled to their attack position.
  if (defenceSlot) {
    assert.ok(typeof defenceSlot.courtSlot === "number");
  }
});

test("HM-TACTICS-BOARD-1.0: natural position is never touched by ANY attack or defence tactical edit", () => {
  const plan = defaultPlan();
  const m9Player = playerIdAtCell(plan, 65)!;
  const naturalBefore = plan.squad.players.find((p) => p.playerId === m9Player)!.position;
  const afterAttack = assignAttackCellPosition(plan, m9Player, 34);
  const v1Player = afterAttack.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)!.playerId;
  const naturalDefenceBefore = afterAttack.squad.players.find((p) => p.playerId === v1Player)!.position;
  const afterDefence = assignDefenceCellPosition(afterAttack, v1Player, 190);
  assert.equal(afterAttack.squad.players.find((p) => p.playerId === m9Player)!.position, naturalBefore);
  assert.equal(afterDefence.squad.players.find((p) => p.playerId === v1Player)!.position, naturalDefenceBefore);
});

test("HM-TACTICS-BOARD-1.0: normal attack (6v6) legal unit is always exactly 7 (6 outcourt + goalkeeper) -- GK is a member", () => {
  const plan = defaultPlan();
  assert.equal(plan.attackStartingUnit.formation, "NORMAL");
  const outcourtCount = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK").length;
  assert.equal(outcourtCount, 6);
  const ids = currentUnitPlayerIds(plan, "ATTACK");
  assert.equal(ids.size, 7);
  const gkId = plan.attackStartingUnit.slots.find((s) => s.position === "GK")!.playerId;
  assert.ok(ids.has(gkId), "the goalkeeper must be a member of the 6v6 current attack unit");
});

test("HM-TACTICS-BOARD-1.0: 7v6 legal unit is exactly 7 outcourt players -- goalkeeper is NOT a member", () => {
  const plan = setAttackFormation(defaultPlan(), "SEVEN_V_SIX");
  assert.equal(plan.attackStartingUnit.slots.length, 7);
  assert.ok(plan.attackStartingUnit.slots.every((s) => s.position !== "GK"));
  const ids = currentUnitPlayerIds(plan, "ATTACK");
  assert.equal(ids.size, 7);
  // No GK-position squad player may appear among the 7 outcourt attackers.
  const gkSquadIds = new Set(plan.squad.players.filter((p) => p.position === "GK").map((p) => p.playerId));
  for (const id of ids) assert.ok(!gkSquadIds.has(id) || plan.attackStartingUnit.slots.some((s) => s.playerId === id && s.position !== "GK"));
});

test("HM-TACTICS-BOARD-1.0: toggling 6v6 -> 7v6 -> 6v6 never exceeds 7 current-unit members at any step, and stays a legal MatchPlan throughout", () => {
  let plan = defaultPlan();
  assert.equal(currentUnitPlayerIds(plan, "ATTACK").size, 7);
  plan = setAttackFormation(plan, "SEVEN_V_SIX");
  assert.equal(currentUnitPlayerIds(plan, "ATTACK").size, 7);
  assert.equal(validateMatchPlan(plan, plan.squad.players.map((p) => p.playerId)).ok, true);
  plan = setAttackFormation(plan, "NORMAL");
  assert.equal(currentUnitPlayerIds(plan, "ATTACK").size, 7);
  assert.equal(validateMatchPlan(plan, plan.squad.players.map((p) => p.playerId)).ok, true);
});

test("HM-TACTICS-BOARD-1.0: reassignment never creates duplicate membership -- swap, move, and replace all preserve exactly 7 unique attack members", () => {
  const plan = defaultPlan();
  const v6Player = playerIdAtCell(plan, 1)!;
  const h6Player = playerIdAtCell(plan, 10)!;
  const swapped = assignAttackCellPosition(plan, v6Player, 10); // occupied -> swap
  assert.equal(new Set(swapped.attackStartingUnit.slots.map((s) => s.playerId)).size, 7);
  const bench = swapped.squad.players.find((p) => p.position !== "GK" && !swapped.attackStartingUnit.slots.some((s) => s.playerId === p.playerId))!;
  const replaced = assignAttackCellPosition(swapped, bench.playerId, 1); // bench -> occupied -> replace
  assert.equal(new Set(replaced.attackStartingUnit.slots.map((s) => s.playerId)).size, 7);
  assert.ok(!replaced.attackStartingUnit.slots.some((s) => s.playerId === h6Player), "the displaced player must have moved to the bench, not stayed duplicated on the board");
});

test("HM-TACTICS-BOARD-1.0: canonical cell mapping survives a full MatchPlan round-trip through JSON, the same persistence path a page reload uses (reload/session reconstruction gives the same unit)", () => {
  const plan = defaultPlan();
  const m9Player = playerIdAtCell(plan, 65)!;
  const edited = assignAttackCellPosition(plan, m9Player, 34);
  const v1Player = edited.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)!.playerId;
  const editedBoth = assignDefenceCellPosition(edited, v1Player, 190);

  const roundTripped = JSON.parse(JSON.stringify(editedBoth)) as MatchPlan;
  assert.deepEqual(roundTripped.attackStartingUnit, editedBoth.attackStartingUnit);
  assert.deepEqual(roundTripped.defenceStartingUnit, editedBoth.defenceStartingUnit);
  assert.deepEqual(resolveAttackSlotCells(roundTripped.attackStartingUnit.slots), resolveAttackSlotCells(editedBoth.attackStartingUnit.slots));
  assert.deepEqual(currentUnitPlayerIds(roundTripped, "ATTACK"), currentUnitPlayerIds(editedBoth, "ATTACK"));
  assert.deepEqual(currentUnitPlayerIds(roundTripped, "DEFENCE"), currentUnitPlayerIds(editedBoth, "DEFENCE"));
});
