// HM-MATCH-1.2 Part U/W: the new ATTACK_SLOT/DEFENCE_SLOT change kinds
// (halftime starting-unit reassignment) and the HALFTIME delivery mode
// (0-minute adoption delay, so a change confirmed AT minute 30 adopts
// EXACTLY at 30 -- never bleeding into the second half's own window).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import type { MatchPlan, MatchSquad } from "../matchPlan/types";
import { applyMatchPlanChange, describeMatchPlanChange, matchPlanChangeAdoptionMinute, type MatchPlanChangeInstruction } from "./matchPlanChange";

function squadOf(n: number): MatchSquad {
  const positions = ["GK", "M9", "V9", "H9", "M6", "V6", "H6", "V9", "M6", "H6"] as const;
  return { fixtureId: "fx1", clubId: "c1", players: Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, position: positions[i % positions.length] })) };
}

function defaultPlan(n = 10): MatchPlan {
  const { plan } = buildDefaultMatchPlan(squadOf(n));
  if (!plan) throw new Error("expected a default plan");
  return plan;
}

test("HM-MATCH-1.2: applying an ATTACK_SLOT change assigns the named player to that attack position", () => {
  const plan = defaultPlan();
  const targetPlayerId = plan.squad.players.find((p) => p.position !== "GK")!.playerId;
  const next = applyMatchPlanChange(plan, { category: "PLAYER", kind: "ATTACK_SLOT", position: "M6", playerId: targetPlayerId, playerName: "Test" });
  const m6Slot = next.attackStartingUnit.slots.find((s) => s.position === "M6");
  assert.equal(m6Slot?.playerId, targetPlayerId);
});

test("HM-MATCH-1.2: applying a DEFENCE_SLOT change assigns the named player to that court slot", () => {
  const plan = defaultPlan();
  const targetPlayerId = plan.squad.players.find((p) => p.position !== "GK")!.playerId;
  const next = applyMatchPlanChange(plan, { category: "PLAYER", kind: "DEFENCE_SLOT", courtSlot: 3, playerId: targetPlayerId, playerName: "Test" });
  const slot3 = next.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 3);
  assert.equal(slot3?.playerId, targetPlayerId);
});

test("HM-MATCH-1.2: describeMatchPlanChange produces Swedish coaching language for ATTACK_SLOT/DEFENCE_SLOT, never a raw enum key", () => {
  const attackDesc = describeMatchPlanChange({ category: "PLAYER", kind: "ATTACK_SLOT", position: "M6", playerId: "p1", playerName: "Gustav Davidsson" });
  const defenceDesc = describeMatchPlanChange({ category: "PLAYER", kind: "DEFENCE_SLOT", courtSlot: 3, playerId: "p1", playerName: "Gustav Davidsson" });
  assert.match(attackDesc, /Gustav Davidsson/);
  assert.match(defenceDesc, /Gustav Davidsson/);
  assert.doesNotMatch(attackDesc, /ATTACK_SLOT/);
  assert.doesNotMatch(defenceDesc, /DEFENCE_SLOT/);
});

test("HM-MATCH-1.2 Part W: a HALFTIME-delivered change issued at minute 30 adopts at EXACTLY minute 30 (0-minute delay) -- so it can never bleed into the second half's own [30,60] window one way, nor stay pending past kickoff of the second half the other way", () => {
  const instruction: MatchPlanChangeInstruction = {
    id: "x",
    issuedMinute: 30,
    change: { category: "DEFENCE", kind: "FORMATION", baseFormation: "5:1" },
    deliveryMode: "HALFTIME",
  };
  assert.equal(matchPlanChangeAdoptionMinute(instruction), 30);
});

test("HM-MATCH-1.2: a SIDELINE-delivered change still adopts after its existing 3-minute delay -- the new HALFTIME mode does not change pre-existing behaviour", () => {
  const instruction: MatchPlanChangeInstruction = {
    id: "x",
    issuedMinute: 10,
    change: { category: "ATTACK", kind: "TEMPO", tempo: "FAST" },
    deliveryMode: "SIDELINE",
  };
  assert.equal(matchPlanChangeAdoptionMinute(instruction), 13);
});

test("HM-MATCH-1.2: omitting deliveryMode defaults to SIDELINE, byte-identical to every pre-HM-MATCH-1.2 caller", () => {
  const instruction: MatchPlanChangeInstruction = { id: "x", issuedMinute: 10, change: { category: "ATTACK", kind: "TEMPO", tempo: "FAST" } };
  assert.equal(matchPlanChangeAdoptionMinute(instruction), 13);
});
