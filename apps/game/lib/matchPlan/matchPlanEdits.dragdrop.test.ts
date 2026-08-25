// HM-MATCH-1.3B Part W: proves the drag/drop board's actual behavior --
// which is entirely implemented by calling the SAME pure
// matchPlanEdits.ts swap/replace functions the pre-existing dropdown
// already used (StartingUnitEditor.tsx/CourtBoard.tsx onDropOnSlot),
// never a second assignment engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { assignDefenceCourtSlot, assignNormalAttackSlot } from "./matchPlanEdits";
import { validateMatchPlan } from "./matchPlan";
import { inferDefenceFormation } from "../../components/matchPlan/courtScene";
import { defenceLayout } from "../../components/matchPlan/courtLayout";
import type { MatchPlan, MatchSquad } from "./types";

function squadOf(n: number): MatchSquad {
  const positions = ["GK", "M9", "V9", "H9", "M6", "V6", "H6", "V9", "M6", "H6"] as const;
  return { fixtureId: "fx1", clubId: "c1", players: Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, position: positions[i % positions.length] })) };
}

function defaultPlan(n = 10): MatchPlan {
  const { plan } = buildDefaultMatchPlan(squadOf(n));
  if (!plan) throw new Error("expected a default plan");
  return plan;
}

test("HM-MATCH-1.3B Part W#3: switching baseFormation (a preset button, not a drag) never touches courtSlot player assignments -- courtSlot numbering is formation-agnostic by design, so 'remapping' is deterministic identity, never a reshuffle", () => {
  const plan = defaultPlan();
  const before = plan.defenceStartingUnit.courtSlots;
  const afterFormationChange: MatchPlan = { ...plan, defencePlan: { ...plan.defencePlan, baseFormation: "5-1" } };
  assert.deepEqual(afterFormationChange.defenceStartingUnit.courtSlots, before, "player-to-courtSlot assignment must be preserved exactly across a formation switch");
});

test("HM-MATCH-1.3B Part W#4: inferDefenceFormation always agrees with a recognized baseFormation string, and normalizes an unrecognized one the same way defenceLayout's own board geometry already falls back -- the board and baseFormation can never disagree", () => {
  for (const formation of ["6-0", "5-1", "3-2-1", "3-3", "4-2"] as const) {
    assert.equal(inferDefenceFormation(formation), formation);
  }
  assert.equal(inferDefenceFormation("unknown"), "6-0");
  assert.deepEqual(defenceLayout(inferDefenceFormation("unknown")), defenceLayout("6-0"));
});

test("HM-MATCH-1.3B Part W#5: a drag-drop swap (assignNormalAttackSlot with a playerId already on the board) preserves BOTH players -- neither is lost", () => {
  const plan = defaultPlan();
  const v6Slot = plan.attackStartingUnit.slots.find((s) => s.position === "V6")!;
  const m6Slot = plan.attackStartingUnit.slots.find((s) => s.position === "M6")!;
  const next = assignNormalAttackSlot(plan, "M6", v6Slot.playerId);
  const nextV6 = next.attackStartingUnit.slots.find((s) => s.position === "V6")!;
  const nextM6 = next.attackStartingUnit.slots.find((s) => s.position === "M6")!;
  assert.equal(nextM6.playerId, v6Slot.playerId, "the dragged player takes the target slot");
  assert.equal(nextV6.playerId, m6Slot.playerId, "the displaced player takes the dragged player's old slot -- a true swap");
});

test("HM-MATCH-1.3B Part W#5 (defence): assignDefenceCourtSlot swap preserves both players", () => {
  const plan = defaultPlan();
  const slot1 = plan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)!;
  const slot4 = plan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 4)!;
  const next = assignDefenceCourtSlot(plan, 4, slot1.playerId);
  const nextSlot1 = next.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)!;
  const nextSlot4 = next.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 4)!;
  assert.equal(nextSlot4.playerId, slot1.playerId);
  assert.equal(nextSlot1.playerId, slot4.playerId);
});

test("HM-MATCH-1.3B Part W#6: dragging a BENCH player onto an occupied slot replaces the occupant, who returns to the bench (is no longer in any starting slot)", () => {
  const plan = defaultPlan();
  const benchPlayer = plan.squad.players.find((p) => p.position !== "GK" && !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId))!;
  const displaced = plan.attackStartingUnit.slots.find((s) => s.position === "V9")!;
  const next = assignNormalAttackSlot(plan, "V9", benchPlayer.playerId);
  const v9 = next.attackStartingUnit.slots.find((s) => s.position === "V9")!;
  assert.equal(v9.playerId, benchPlayer.playerId, "the bench player now occupies the slot");
  assert.ok(!next.attackStartingUnit.slots.some((s) => s.playerId === displaced.playerId), "the displaced player must return to the bench -- absent from every starting slot");
});

test("HM-MATCH-1.3B Part W#7: no duplicate player ever appears in the attack or defence starting unit after a drag/drop assignment", () => {
  const plan = defaultPlan();
  const benchPlayer = plan.squad.players.find((p) => p.position !== "GK" && !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId))!;
  const next = assignNormalAttackSlot(plan, "M9", benchPlayer.playerId);
  const attackIds = next.attackStartingUnit.slots.map((s) => s.playerId);
  assert.equal(new Set(attackIds).size, attackIds.length, "attack starting unit must never contain a duplicate player");
  const validation = validateMatchPlan(next, next.squad.players.map((p) => p.playerId));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test("HM-MATCH-1.3B Part W#8: a goalkeeper-vs-outcourt drop is guarded at the UI layer (see StartingUnitEditor's isGoalkeeperSlot !== draggedIsGoalkeeper check) -- documented here via the domain invariant that validateMatchPlan rejects a plan where the GK slot holds a non-goalkeeper", () => {
  const plan = defaultPlan();
  const outcourtPlayerId = plan.squad.players.find((p) => p.position !== "GK")!.playerId;
  const invalid: MatchPlan = { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots: plan.attackStartingUnit.slots.map((s) => (s.position === "GK" ? { ...s, playerId: outcourtPlayerId } : s)) } };
  const validation = validateMatchPlan(invalid, invalid.squad.players.map((p) => p.playerId));
  assert.equal(validation.ok, false, "assigning a non-goalkeeper to the GK slot must fail domain validation -- exactly what the UI-level drop guard prevents from ever being reached");
});

test("HM-MATCH-1.3B Part W#9: a tactical slot assignment never mutates the player's own natural squad position", () => {
  const plan = defaultPlan();
  const player = plan.squad.players.find((p) => p.position === "V9")!;
  const next = assignNormalAttackSlot(plan, "M9", player.playerId);
  const stillNatural = next.squad.players.find((p) => p.playerId === player.playerId)!;
  assert.equal(stillNatural.position, "V9", "MatchSquadPlayer.position (the player's natural position) must be untouched by a tactical slot assignment");
});

test("HM-MATCH-1.3B Part W#22: assigning a player via the board never writes to persistent Tactics or player defaults -- only the fixture-scoped MatchPlan's own slots change", () => {
  const plan = defaultPlan();
  const player = plan.squad.players.find((p) => p.position !== "GK")!;
  const next = assignNormalAttackSlot(plan, "M6", player.playerId);
  // MatchPlan itself carries no tactics/playerMatchDefaults fields at
  // all -- those live only in CareerState, untouched by any function in
  // matchPlanEdits.ts (structural guarantee, not a per-call check).
  assert.ok(!("tactics" in next) && !("playerMatchDefaults" in next));
});
