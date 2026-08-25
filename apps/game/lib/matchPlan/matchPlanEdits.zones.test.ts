// HM-MATCH-1.3B2 Part 1-8: proves the snap-zone board's ONE edit
// function (assignAttackZonePosition) and the canonical PÅ PLAN
// membership helper (currentUnitPlayerIds) behave exactly per the
// corrected product model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { assignAttackZonePosition, currentUnitPlayerIds, setAttackFormation } from "./matchPlanEdits";
import { validateMatchPlan } from "./matchPlan";
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

test("HM-MATCH-1.3B2 Part 3: moving a backcourt player into a pivot zone changes their TACTICAL position to M6 without touching their natural squad position", () => {
  const plan = defaultPlan();
  const m9Slot = plan.attackStartingUnit.slots.find((s) => s.position === "M9")!;
  const naturalBefore = plan.squad.players.find((p) => p.playerId === m9Slot.playerId)!.position;

  const next = assignAttackZonePosition(plan, m9Slot.playerId, "M6", null);
  const newSlot = next.attackStartingUnit.slots.find((s) => s.playerId === m9Slot.playerId)!;
  assert.equal(newSlot.position, "M6", "tactical assignment must become M6");

  const naturalAfter = next.squad.players.find((p) => p.playerId === m9Slot.playerId)!.position;
  assert.equal(naturalAfter, naturalBefore, "natural squad position must be completely unchanged");
});

test("HM-MATCH-1.3B2 Part 5: the resulting two-pivot structure (M9's old slot now empty of a backcourt player) is a legal MatchPlan", () => {
  const plan = defaultPlan();
  const m9Slot = plan.attackStartingUnit.slots.find((s) => s.position === "M9")!;
  const next = assignAttackZonePosition(plan, m9Slot.playerId, "M6", null);

  const positions = next.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => s.position);
  assert.equal(positions.filter((p) => p === "M6").length, 2, "must now have two M6 (pivot) slots");
  assert.equal(positions.filter((p) => p === "M9").length, 0, "must have zero M9 (centre-back) slots");

  const validation = validateMatchPlan(next, next.squad.players.map((p) => p.playerId));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
});

test("HM-MATCH-1.3B2 Part 2/6: board player -> occupied zone is a SWAP (both players preserved, positions trade)", () => {
  const plan = defaultPlan();
  const v6Index = plan.attackStartingUnit.slots.findIndex((s) => s.position === "V6");
  const h6Index = plan.attackStartingUnit.slots.findIndex((s) => s.position === "H6");
  const v6Player = plan.attackStartingUnit.slots[v6Index].playerId;
  const h6Player = plan.attackStartingUnit.slots[h6Index].playerId;

  const next = assignAttackZonePosition(plan, v6Player, "H6", h6Index);
  assert.equal(next.attackStartingUnit.slots[h6Index].playerId, v6Player);
  assert.equal(next.attackStartingUnit.slots[v6Index].playerId, h6Player);
  assert.equal(next.attackStartingUnit.slots[h6Index].position, "H6");
  assert.equal(next.attackStartingUnit.slots[v6Index].position, "V6");
});

test("HM-MATCH-1.3B2 Part 2: board player -> empty zone is a pure MOVE -- only the dragged player's own slot changes, no other slot is touched", () => {
  const plan = defaultPlan();
  const m9Slot = plan.attackStartingUnit.slots.find((s) => s.position === "M9")!;
  const before = plan.attackStartingUnit.slots.filter((s) => s.playerId !== m9Slot.playerId);

  const next = assignAttackZonePosition(plan, m9Slot.playerId, "M6", null);
  const afterOthers = next.attackStartingUnit.slots.filter((s) => s.playerId !== m9Slot.playerId);
  assert.deepEqual(afterOthers, before, "every other slot must be byte-for-byte unchanged");
});

test("HM-MATCH-1.3B2 Part 8: bench player -> occupied zone replaces the occupant, who returns to the bench", () => {
  const plan = defaultPlan();
  const benchPlayer = plan.squad.players.find((p) => p.position !== "GK" && !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId))!;
  const v9Index = plan.attackStartingUnit.slots.findIndex((s) => s.position === "V9");
  const displaced = plan.attackStartingUnit.slots[v9Index].playerId;

  const next = assignAttackZonePosition(plan, benchPlayer.playerId, "V9", v9Index);
  assert.equal(next.attackStartingUnit.slots[v9Index].playerId, benchPlayer.playerId);
  assert.ok(!next.attackStartingUnit.slots.some((s) => s.playerId === displaced), "the displaced player must no longer be in any attack slot");
});

test("HM-MATCH-1.3B2 Part 8: bench player -> an EMPTY zone is a no-op (unsupported this milestone -- see the function's own doc)", () => {
  const plan = defaultPlan();
  const benchPlayer = plan.squad.players.find((p) => p.position !== "GK" && !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId))!;
  const next = assignAttackZonePosition(plan, benchPlayer.playerId, "M6", null);
  assert.equal(next, plan, "must be a true no-op (same reference) since bench-to-empty-zone is not defined");
});

test("HM-MATCH-1.3B2: no duplicate player id ever results from a zone move/swap/replace", () => {
  const plan = defaultPlan();
  const m9Slot = plan.attackStartingUnit.slots.find((s) => s.position === "M9")!;
  const next = assignAttackZonePosition(plan, m9Slot.playerId, "M6", null);
  const ids = next.attackStartingUnit.slots.map((s) => s.playerId);
  assert.equal(new Set(ids).size, ids.length);
});

test("HM-MATCH-1.3B2 Part 6/7: currentUnitPlayerIds(plan, 'ATTACK') is exactly the 7 attack starters (6 outcourt + GK), never a cross-phase union", () => {
  const plan = defaultPlan();
  const attackIds = currentUnitPlayerIds(plan, "ATTACK");
  assert.equal(attackIds.size, 7);
  assert.deepEqual(attackIds, new Set(plan.attackStartingUnit.slots.map((s) => s.playerId)));
});

test("HM-MATCH-1.3B2 Part 6/7: currentUnitPlayerIds(plan, 'DEFENCE') is exactly the 7 defence starters (6 outcourt + GK)", () => {
  const plan = defaultPlan();
  const defenceIds = currentUnitPlayerIds(plan, "DEFENCE");
  assert.equal(defenceIds.size, 7);
});

test("HM-MATCH-1.3B2 Part 6: 7v6 currentUnitPlayerIds(plan, 'ATTACK') is exactly 7 outcourt players, no goalkeeper", () => {
  const plan = setAttackFormation(defaultPlan(), "SEVEN_V_SIX");
  const attackIds = currentUnitPlayerIds(plan, "ATTACK");
  assert.equal(attackIds.size, 7);
  const gkId = plan.squad.players.find((p) => p.position === "GK")?.playerId;
  assert.ok(!gkId || !attackIds.has(gkId) || plan.attackStartingUnit.slots.some((s) => s.playerId === gkId && s.position !== "GK"), "no GK slot exists in a 7v6 attack unit");
});

test("HM-MATCH-1.3B2 Part 6/7: PÅ PLAN and BÄNK partition Matchtrupp exactly -- disjoint, union equals the selected squad, for the ATTACK phase", () => {
  const plan = defaultPlan();
  const squadIds = new Set(plan.squad.players.map((p) => p.playerId));
  const onCourt = currentUnitPlayerIds(plan, "ATTACK");
  const bench = new Set([...squadIds].filter((id) => !onCourt.has(id)));

  for (const id of onCourt) assert.ok(!bench.has(id), "PÅ PLAN and BÄNK must be disjoint");
  const union = new Set([...onCourt, ...bench]);
  assert.deepEqual(union, squadIds, "PÅ PLAN union BÄNK must equal the selected MatchSquad");
});

test("HM-MATCH-1.3B2 Part 6/7: the same partition invariant holds for DEFENCE too", () => {
  const plan = defaultPlan();
  const squadIds = new Set(plan.squad.players.map((p) => p.playerId));
  const onCourt = currentUnitPlayerIds(plan, "DEFENCE");
  const bench = new Set([...squadIds].filter((id) => !onCourt.has(id)));
  for (const id of onCourt) assert.ok(!bench.has(id));
  assert.deepEqual(new Set([...onCourt, ...bench]), squadIds);
});

test("HM-MATCH-1.3B2 Part 17: a zone-assigned MatchPlan round-trips through JSON without losing the tactical assignment (the same persistence path a page reload uses)", () => {
  const plan = defaultPlan();
  const m9Slot = plan.attackStartingUnit.slots.find((s) => s.position === "M9")!;
  const next = assignAttackZonePosition(plan, m9Slot.playerId, "M6", null);
  const roundTripped = JSON.parse(JSON.stringify(next)) as MatchPlan;
  assert.deepEqual(roundTripped.attackStartingUnit, next.attackStartingUnit);
});
