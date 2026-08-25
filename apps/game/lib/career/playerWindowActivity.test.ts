// HM-PHYSICAL-1.0 Part 4/11: proves computePlayerWindowActivity is a
// thin, correct repackaging of the SAME activeWindowRange/
// resolveActiveGoalkeeperForWindow logic matchUsageEngine.ts already
// uses -- never a second lineup/minutes algorithm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePlayerWindowActivity, computeTeamUsageTrace, MATCH_USAGE_WINDOW_COUNT } from "./matchUsageEngine";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { setAttackFormation } from "../matchPlan/matchPlanEdits";
import type { MatchPlan, MatchSquad, Position } from "../matchPlan/types";

const BASE_STARTERS: readonly { playerId: string; position: Position }[] = [
  { playerId: "gk1", position: "GK" },
  { playerId: "m9_1", position: "M9" },
  { playerId: "v9_1", position: "V9" },
  { playerId: "h9_1", position: "H9" },
  { playerId: "m6_1", position: "M6" },
  { playerId: "v6_1", position: "V6" },
  { playerId: "h6_1", position: "H6" },
];

function buildSquad(extra: readonly { playerId: string; position: Position }[] = []): MatchSquad {
  return { fixtureId: "fx-window-activity", clubId: "c1", players: [...BASE_STARTERS, ...extra] };
}

function buildBasePlan(extra: readonly { playerId: string; position: Position }[] = []): MatchPlan {
  const result = buildDefaultMatchPlan(buildSquad(extra));
  assert.ok(result.ok && result.plan, JSON.stringify(result.errors));
  return result.plan!;
}

test("HM-PHYSICAL-1.0: every player gets exactly MATCH_USAGE_WINDOW_COUNT entries per activity array", () => {
  const plan = buildBasePlan();
  const activities = computePlayerWindowActivity(plan);
  for (const a of activities) {
    assert.equal(a.attackActive.length, MATCH_USAGE_WINDOW_COUNT);
    assert.equal(a.defenceActive.length, MATCH_USAGE_WINDOW_COUNT);
    assert.equal(a.goalkeeperActive.length, MATCH_USAGE_WINDOW_COUNT);
  }
});

test("HM-PHYSICAL-1.0: the goalkeeper's attack/defence activity is always all-false; only goalkeeperActive is meaningful", () => {
  const plan = buildBasePlan();
  const activities = computePlayerWindowActivity(plan);
  const gk = activities.find((a) => a.playerId === "gk1")!;
  assert.ok(gk.isGoalkeeper);
  assert.ok(gk.attackActive.every((b) => b === false));
  assert.ok(gk.defenceActive.every((b) => b === false));
  assert.ok(gk.goalkeeperActive.some((b) => b === true), "the starting goalkeeper must be active in at least one window");
});

test("HM-PHYSICAL-1.0: an outcourt player's goalkeeperActive is always all-false", () => {
  const plan = buildBasePlan();
  const activities = computePlayerWindowActivity(plan);
  const outfield = activities.find((a) => a.playerId === "m9_1")!;
  assert.ok(!outfield.isGoalkeeper);
  assert.ok(outfield.goalkeeperActive.every((b) => b === false));
});

test("HM-PHYSICAL-1.0: a starting outfield player is active in window 0 for whichever phase(s) they start", () => {
  const plan = buildBasePlan();
  const activities = computePlayerWindowActivity(plan);
  const v6 = activities.find((a) => a.playerId === "v6_1")!;
  assert.equal(v6.attackActive[0], true);
  assert.equal(v6.defenceActive[0], true);
});

test("HM-PHYSICAL-1.0: window-activity window counts exactly match TeamUsageTrace's own attackWindowsActive/defenceWindowsActive/goalkeeperWindowsActive -- one consistent source of truth, never two divergent derivations", () => {
  const plan = buildBasePlan();
  const activities = computePlayerWindowActivity(plan);
  const trace = computeTeamUsageTrace(plan, "seed-a");
  for (const trace_p of trace.players) {
    const activity = activities.find((a) => a.playerId === trace_p.playerId)!;
    assert.equal(activity.attackActive.filter(Boolean).length, trace_p.attackWindowsActive);
    assert.equal(activity.defenceActive.filter(Boolean).length, trace_p.defenceWindowsActive);
    assert.equal(activity.goalkeeperActive.filter(Boolean).length, trace_p.goalkeeperWindowsActive);
  }
});

test("HM-PHYSICAL-1.0 (23): 7v6 exposure works correctly -- outcourt players still get correctly derived attack activity, and the defence unit's own goalkeeper (untouched by attack formation) still shows goalkeeper activity", () => {
  const plan = setAttackFormation(buildBasePlan(), "SEVEN_V_SIX");
  const activities = computePlayerWindowActivity(plan);
  const v6 = activities.find((a) => a.playerId === "v6_1")!;
  assert.equal(v6.attackActive[0], true);
  assert.ok(!v6.goalkeeperActive.some(Boolean), "an outcourt player must never register goalkeeper activity");
  const gk = activities.find((a) => a.playerId === "gk1")!;
  assert.ok(gk.goalkeeperActive.some(Boolean), "the defence unit's own goalkeeper is unaffected by the attack formation switch -- HM-COURT-GRID-0.3.1's own goalkeeper/7v6 separation");
});

test("HM-PHYSICAL-1.0: is deterministic across repeated calls", () => {
  const plan = buildBasePlan();
  const a = computePlayerWindowActivity(plan);
  const b = computePlayerWindowActivity(plan);
  assert.deepEqual(a, b);
});
