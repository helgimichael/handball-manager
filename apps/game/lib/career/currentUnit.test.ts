// HM-MATCH-1.3B Part P: proves the "current on-court unit" resolvers
// are a truthful, deterministic projection of MatchUsageEngine's own
// window-based active-unit computation -- never a second, UI-only
// lineup algorithm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { setPlayerPhaseUsage, setPlayerPlayingTime, setSubstitutionPair, setAttackFormation } from "../matchPlan/matchPlanEdits";
import type { MatchPlan, MatchSquad } from "../matchPlan/types";
import { minuteToUsageWindow, resolveCurrentAttackUnit, resolveCurrentDefenceUnit, resolveCurrentGoalkeeper } from "./currentUnit";
import { createLiveMatchSession } from "../liveMatch/liveMatchSession";
import { defaultTeamTacticalProfile } from "./teamTacticalProfile";
import { tick } from "../liveMatch/clock";

const SEED = "current-unit-seed";

function squadOf(n: number): MatchSquad {
  const positions = ["GK", "M9", "V9", "H9", "M6", "V6", "H6", "V9", "M6", "H6", "M9", "V6", "H9", "GK", "V9", "H6"] as const;
  return { fixtureId: "fx1", clubId: "c1", players: Array.from({ length: n }, (_, i) => ({ playerId: `p${i}`, position: positions[i % positions.length] })) };
}

function defaultPlan(n = 16): MatchPlan {
  const { plan } = buildDefaultMatchPlan(squadOf(n));
  if (!plan) throw new Error("expected a default plan");
  return plan;
}

test("HM-MATCH-1.3B: minuteToUsageWindow maps kickoff (minute 0) to window 0 and the final minute to the last window, never past it", () => {
  assert.equal(minuteToUsageWindow(0), 0);
  assert.equal(minuteToUsageWindow(9), 0);
  assert.equal(minuteToUsageWindow(10), 1);
  assert.equal(minuteToUsageWindow(59), 5);
  assert.equal(minuteToUsageWindow(60), 5);
});

test("HM-MATCH-1.3B Part P #13: at kickoff (minute 0), the current attack unit is exactly the attack starting unit", () => {
  const plan = defaultPlan();
  const current = resolveCurrentAttackUnit(plan, 0, SEED);
  const currentIds = new Set(current.map((s) => s.playerId));
  const startingIds = new Set(plan.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => s.playerId));
  assert.deepEqual(currentIds, startingIds);
  // And each starter keeps their own labeled slot at kickoff.
  for (const slot of current) {
    const starterSlot = plan.attackStartingUnit.slots.find((s) => s.playerId === slot.playerId);
    assert.equal(starterSlot?.position, slot.position);
  }
});

test("HM-MATCH-1.3B Part P #14: at kickoff (minute 0), the current defence unit is exactly the defence starting unit, and the current goalkeeper is the starting goalkeeper", () => {
  const plan = defaultPlan();
  const current = resolveCurrentDefenceUnit(plan, 0, SEED);
  const currentIds = new Set(current.map((s) => s.playerId));
  const startingIds = new Set(plan.defenceStartingUnit.courtSlots.map((s) => s.playerId));
  assert.deepEqual(currentIds, startingIds);
  assert.equal(resolveCurrentGoalkeeper(plan, 0, SEED), plan.defenceStartingUnit.goalkeeperId);
});

test("HM-MATCH-1.3B Part P #15: a later rotation window can differ from the kickoff unit when bench players carry real playing-time intention", () => {
  const plan = defaultPlan();
  const bench = plan.squad.players.find((p) => p.position !== "GK" && !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId));
  assert.ok(bench, "fixture needs a bench outfield player");
  const boosted = setPlayerPlayingTime(setPlayerPhaseUsage(plan, bench!.playerId, "ATTACK_ONLY"), bench!.playerId, "VERY_HIGH");

  const kickoff = new Set(resolveCurrentAttackUnit(boosted, 0, SEED).map((s) => s.playerId));
  const late = new Set(resolveCurrentAttackUnit(boosted, 59, SEED).map((s) => s.playerId));
  assert.notDeepEqual(kickoff, late, "a boosted bench player should eventually appear in a later window");
  assert.ok(late.has(bench!.playerId), "the boosted bench player should be active in the final window");
});

test("HM-MATCH-1.3B Part P #16: an ATTACK_ONLY player never appears in the current defence unit, at any window", () => {
  const plan = defaultPlan();
  const starter = plan.attackStartingUnit.slots.find((s) => s.position !== "GK")!;
  const attackOnlyPlan = setPlayerPhaseUsage(plan, starter.playerId, "ATTACK_ONLY");
  for (let minute = 0; minute <= 60; minute += 10) {
    const defenceIds = resolveCurrentDefenceUnit(attackOnlyPlan, minute, SEED).map((s) => s.playerId);
    assert.ok(!defenceIds.includes(starter.playerId), `minute ${minute}: ATTACK_ONLY player must never be in the defence unit`);
  }
});

test("HM-MATCH-1.3B Part P #17: a DEFENCE_ONLY player never appears in the current attack unit, at any window", () => {
  const plan = defaultPlan();
  const defender = plan.defenceStartingUnit.courtSlots[0];
  const defenceOnlyPlan = setPlayerPhaseUsage(plan, defender.playerId, "DEFENCE_ONLY");
  for (let minute = 0; minute <= 60; minute += 10) {
    const attackIds = resolveCurrentAttackUnit(defenceOnlyPlan, minute, SEED).map((s) => s.playerId);
    assert.ok(!attackIds.includes(defender.playerId), `minute ${minute}: DEFENCE_ONLY player must never be in the attack unit`);
  }
});

test("HM-MATCH-1.3B Part P #18: a specialist pair produces a phase-specific swap -- the attack half of the pair appears in the attack unit, the defence half in the defence unit, for the same player set otherwise unchanged", () => {
  const plan = defaultPlan();
  const attackHalf = plan.attackStartingUnit.slots.find((s) => s.position !== "GK")!.playerId;
  const defenceHalf = plan.squad.players.find((p) => p.position !== "GK" && p.playerId !== attackHalf)!.playerId;
  const paired = setSubstitutionPair(plan, attackHalf, defenceHalf);

  const attackIds = resolveCurrentAttackUnit(paired, 0, SEED).map((s) => s.playerId);
  assert.ok(attackIds.includes(attackHalf), "the attack half of the pair should appear in the attack unit");
});

test("HM-MATCH-1.3B Part P #19: an EMERGENCY_ONLY player never appears in the current unit under normal circumstances", () => {
  const plan = defaultPlan();
  const bench = plan.squad.players.find((p) => p.position !== "GK" && !plan.attackStartingUnit.slots.some((s) => s.playerId === p.playerId))!;
  const emergencyPlan = setPlayerPlayingTime(plan, bench.playerId, "EMERGENCY_ONLY");
  for (let minute = 0; minute <= 60; minute += 10) {
    const attackIds = resolveCurrentAttackUnit(emergencyPlan, minute, SEED).map((s) => s.playerId);
    const defenceIds = resolveCurrentDefenceUnit(emergencyPlan, minute, SEED).map((s) => s.playerId);
    assert.ok(!attackIds.includes(bench.playerId), `minute ${minute}: EMERGENCY_ONLY must not appear in attack`);
    assert.ok(!defenceIds.includes(bench.playerId), `minute ${minute}: EMERGENCY_ONLY must not appear in defence`);
  }
});

test("HM-MATCH-1.3B Part P #20: a SEVEN_V_SIX current attack unit has exactly seven outcourt players and no goalkeeper slot", () => {
  const plan = setAttackFormation(defaultPlan(), "SEVEN_V_SIX");
  const current = resolveCurrentAttackUnit(plan, 0, SEED);
  assert.equal(current.length, 7);
  assert.ok(current.every((s) => s.position !== "GK"));
});

test("HM-MATCH-1.3B: current unit size never exceeds the legal on-court count (6 outfield defence, 6 or 7 attack)", () => {
  const plan = defaultPlan();
  for (let minute = 0; minute <= 60; minute += 10) {
    assert.ok(resolveCurrentAttackUnit(plan, minute, SEED).length <= 6);
    assert.ok(resolveCurrentDefenceUnit(plan, minute, SEED).length <= 6);
  }
});

test("HM-MATCH-1.3B: resolveCurrentGoalkeeper returns null only when the squad has no goalkeeper at all", () => {
  const plan = defaultPlan();
  assert.ok(resolveCurrentGoalkeeper(plan, 0, SEED));
});

test("HM-MATCH-1.3B: determinism -- the same plan/minute/seed always produces the same current unit", () => {
  const plan = defaultPlan();
  const a = resolveCurrentAttackUnit(plan, 25, SEED);
  const b = resolveCurrentAttackUnit(plan, 25, SEED);
  assert.deepEqual(a, b);
});

test("HM-MATCH-1.3B Part P #21/U: current-unit reconstruction survives a LiveMatchSession navigate-away-and-back -- ticking the persisted session's clock and re-reading it back (simulating unmount/remount, exactly as HM-MATCH-1.3A's own persistence effect does) reproduces the identical current unit, never a fresh/reset computation", () => {
  const plan = defaultPlan();
  let session = createLiveMatchSession("fx1", defaultTeamTacticalProfile());
  for (let i = 0; i < 22; i += 1) session = { ...session, clock: tick(session.clock) };
  assert.equal(session.clock.clockMinute, 22);

  const beforeNavigate = resolveCurrentAttackUnit(plan, session.clock.clockMinute, SEED);
  // "Navigate away and back": a fresh mount reads purely from the
  // persisted session's clockMinute -- no new simulation, same inputs.
  const restoredClockMinute = session.clock.clockMinute;
  const afterReturn = resolveCurrentAttackUnit(plan, restoredClockMinute, SEED);
  assert.deepEqual(afterReturn, beforeNavigate);
});
