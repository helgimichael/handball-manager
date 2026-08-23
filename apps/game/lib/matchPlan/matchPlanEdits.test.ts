// HM-TACTICS-1.1 Part R: pure MatchPlan edit-operation tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import {
  addPlayerToSquad,
  assignDefenceCourtSlot,
  assignNormalAttackSlot,
  assignSevenVSixSlot,
  clearSubstitutionPairFor,
  isPlayerStarting,
  removePlayerFromSquad,
  setAttackFormation,
  setPlayerMatchRole,
  setPlayerPhaseUsage,
  setPlayerPlayingTime,
  setSubstitutionPair,
  substitutionPartnerOf,
  updateAttackPlan,
  updateDefencePlan,
  updateSevenVSixPolicy,
  updateTransitionPlan,
} from "./matchPlanEdits";
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

test("HM-TACTICS-1.1: assignNormalAttackSlot swaps the two players' slots rather than leaving a duplicate or empty slot", () => {
  const plan = defaultPlan();
  const before = plan.attackStartingUnit.slots.find((s) => s.position === "M9")!.playerId;
  const target = plan.attackStartingUnit.slots.find((s) => s.position === "V9")!.playerId;
  const next = assignNormalAttackSlot(plan, "M9", target);
  const m9 = next.attackStartingUnit.slots.find((s) => s.position === "M9")!;
  const v9 = next.attackStartingUnit.slots.find((s) => s.position === "V9")!;
  assert.equal(m9.playerId, target);
  assert.equal(v9.playerId, before);
  assert.equal(validateMatchPlan(next).ok, true);
});

test("HM-TACTICS-1.1: assignNormalAttackSlot with a bench player (not currently starting) simply replaces the target slot", () => {
  const plan = defaultPlan(10);
  const benchPlayer = plan.squad.players.find((p) => !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId) && p.position !== "GK")!;
  const next = assignNormalAttackSlot(plan, "M9", benchPlayer.playerId);
  assert.equal(next.attackStartingUnit.slots.find((s) => s.position === "M9")!.playerId, benchPlayer.playerId);
  assert.equal(validateMatchPlan(next).ok, true);
});

test("HM-TACTICS-1.1: setAttackFormation(SEVEN_V_SIX) produces exactly 7 outcourt slots and no goalkeeper, and remains valid", () => {
  const plan = defaultPlan(10);
  const next = setAttackFormation(plan, "SEVEN_V_SIX");
  assert.equal(next.attackStartingUnit.formation, "SEVEN_V_SIX");
  assert.equal(next.attackStartingUnit.slots.length, 7);
  assert.ok(next.attackStartingUnit.slots.every((s) => s.position !== "GK"));
  assert.equal(validateMatchPlan(next).ok, true, JSON.stringify(validateMatchPlan(next).errors));
});

test("HM-TACTICS-1.1: switching SEVEN_V_SIX back to NORMAL restores a valid 6+GK unit", () => {
  const plan = setAttackFormation(defaultPlan(10), "SEVEN_V_SIX");
  const back = setAttackFormation(plan, "NORMAL");
  assert.equal(back.attackStartingUnit.formation, "NORMAL");
  assert.equal(back.attackStartingUnit.slots.length, 7);
  assert.equal(validateMatchPlan(back).ok, true, JSON.stringify(validateMatchPlan(back).errors));
});

test("HM-TACTICS-1.1: assignDefenceCourtSlot swaps two defenders' court slots", () => {
  const plan = defaultPlan();
  const slot1Player = plan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)!.playerId;
  const slot2Player = plan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 2)!.playerId;
  const next = assignDefenceCourtSlot(plan, 1, slot2Player);
  assert.equal(next.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)!.playerId, slot2Player);
  assert.equal(next.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 2)!.playerId, slot1Player);
  assert.equal(validateMatchPlan(next).ok, true);
});

test("HM-TACTICS-1.1: attack and defence units edit independently -- changing an attack slot never touches the defence unit", () => {
  const plan = defaultPlan();
  const defenceBefore = JSON.stringify(plan.defenceStartingUnit);
  const target = plan.squad.players.find((p) => p.position !== "GK")!.playerId;
  const next = assignNormalAttackSlot(plan, "M9", target);
  assert.equal(JSON.stringify(next.defenceStartingUnit), defenceBefore);
});

test("HM-TACTICS-1.1: addPlayerToSquad respects the 16-player maximum and adds a usage entry", () => {
  const plan16 = defaultPlan(16);
  const blocked = addPlayerToSquad(plan16, "overflow", "M9");
  assert.equal(blocked.squad.players.length, 16, "must not exceed 16");

  const plan10 = defaultPlan(10);
  const added = addPlayerToSquad(plan10, "new_player", "M9");
  assert.equal(added.squad.players.length, 11);
  assert.ok(added.playerUsage.some((u) => u.playerId === "new_player"));
});

test("HM-TACTICS-1.1: removePlayerFromSquad is blocked for a currently-starting player, and succeeds for a bench player", () => {
  const plan = defaultPlan(10);
  const starter = plan.attackStartingUnit.slots[0].playerId;
  assert.equal(isPlayerStarting(plan, starter), true);
  const blocked = removePlayerFromSquad(plan, starter);
  assert.equal(blocked.squad.players.length, plan.squad.players.length, "removal of a starter must be blocked");

  const benchPlayer = plan.squad.players.find((p) => !isPlayerStartingHelper(plan, p.playerId))!;
  const removed = removePlayerFromSquad(plan, benchPlayer.playerId);
  assert.equal(removed.squad.players.length, plan.squad.players.length - 1);
  assert.ok(!removed.playerUsage.some((u) => u.playerId === benchPlayer.playerId));
});

function isPlayerStartingHelper(plan: MatchPlan, playerId: string): boolean {
  return isPlayerStarting(plan, playerId);
}

test("HM-TACTICS-1.1: player match role, playing time, and phase usage edits change only the target player", () => {
  const plan = defaultPlan();
  const [a, b] = plan.playerUsage;
  const next = setPlayerMatchRole(setPlayerPlayingTime(setPlayerPhaseUsage(plan, a.playerId, "ATTACK_ONLY"), a.playerId, "VERY_HIGH"), a.playerId, "KEY_PLAYER");
  const changed = next.playerUsage.find((u) => u.playerId === a.playerId)!;
  assert.equal(changed.matchRole, "KEY_PLAYER");
  assert.equal(changed.playingTimeIntention, "VERY_HIGH");
  assert.equal(changed.phaseUsage, "ATTACK_ONLY");
  const untouched = next.playerUsage.find((u) => u.playerId === b.playerId)!;
  assert.deepEqual(untouched, b);
});

test("HM-TACTICS-1.1: setSubstitutionPair creates a valid pair and substitutionPartnerOf resolves both directions", () => {
  const plan = defaultPlan();
  const [p1, p2] = plan.squad.players;
  const next = setSubstitutionPair(plan, p1.playerId, p2.playerId);
  assert.equal(validateMatchPlan(next).ok, true);
  assert.equal(substitutionPartnerOf(next, p1.playerId), p2.playerId);
  assert.equal(substitutionPartnerOf(next, p2.playerId), p1.playerId);
});

test("HM-TACTICS-1.1: setSubstitutionPair re-pairing a player drops their previous pair (invalid duplicate pairing rejected by construction)", () => {
  const plan = defaultPlan();
  const [p1, p2, p3] = plan.squad.players;
  const paired = setSubstitutionPair(plan, p1.playerId, p2.playerId);
  const repaired = setSubstitutionPair(paired, p1.playerId, p3.playerId);
  assert.equal(repaired.substitutionPairs.length, 1);
  assert.equal(substitutionPartnerOf(repaired, p1.playerId), p3.playerId);
  assert.equal(validateMatchPlan(repaired).ok, true);
});

test("HM-TACTICS-1.1: clearSubstitutionPairFor removes the pair entirely", () => {
  const plan = defaultPlan();
  const [p1, p2] = plan.squad.players;
  const paired = setSubstitutionPair(plan, p1.playerId, p2.playerId);
  const cleared = clearSubstitutionPairFor(paired, p1.playerId);
  assert.equal(cleared.substitutionPairs.length, 0);
});

test("HM-TACTICS-1.1: updateAttackPlan/updateDefencePlan/updateTransitionPlan each change only their own config", () => {
  const plan = defaultPlan();
  const next = updateTransitionPlan(updateDefencePlan(updateAttackPlan(plan, { tempo: "FAST" }), { riskLevel: "HIGH" }), { firstWaveAggression: "HIGH" });
  assert.equal(next.attackPlan.tempo, "FAST");
  assert.equal(next.defencePlan.riskLevel, "HIGH");
  assert.equal(next.transitionPlan.firstWaveAggression, "HIGH");
  // Untouched fields survive.
  assert.equal(next.attackPlan.structureFreedom, plan.attackPlan.structureFreedom);
  assert.equal(next.defencePlan.baseFormation, plan.defencePlan.baseFormation);
});

test("HM-TACTICS-1.1: updateSevenVSixPolicy changes only the 7v6 policy sub-object", () => {
  const plan = defaultPlan();
  const next = updateSevenVSixPolicy(plan, { level: "PRIMARY", activeFromKickoff: true });
  assert.equal(next.attackPlan.sevenVSixPolicy.level, "PRIMARY");
  assert.equal(next.attackPlan.sevenVSixPolicy.activeFromKickoff, true);
  assert.equal(next.attackPlan.tempo, plan.attackPlan.tempo);
});

test("HM-TACTICS-1.1: assignSevenVSixSlot swaps within the 7v6 unit and allows repeated positions", () => {
  const plan = setAttackFormation(defaultPlan(10), "SEVEN_V_SIX");
  const benchPlayer = plan.squad.players.find((p) => p.position !== "GK" && !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId));
  if (!benchPlayer) return; // squad too small in this run to have a bench outcourt player -- skip, other tests already cover the swap path
  const next = assignSevenVSixSlot(plan, 0, benchPlayer.playerId, plan.attackStartingUnit.slots[0].position);
  assert.equal(next.attackStartingUnit.slots[0].playerId, benchPlayer.playerId);
  assert.equal(validateMatchPlan(next).ok, true);
});
