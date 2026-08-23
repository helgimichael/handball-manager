// HM-TACTICS-1.1 Part R: deterministic tactical summary + label
// coverage tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatchIdea, buildTacticalSummary, DEFENCE_COURT_SLOT_LABELS_SV, defenceCourtSlotLabel, MATCH_ROLE_LABELS_SV, PHASE_USAGE_LABELS_SV, PLAYING_TIME_INTENTION_LABELS_SV } from "./matchPlanLabels";
import { MATCH_ROLES, PLAYER_PHASE_USAGES, PLAYING_TIME_INTENTIONS } from "./types";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import type { MatchSquad } from "./types";

const squad: MatchSquad = {
  fixtureId: "fx1",
  clubId: "c1",
  players: [
    { playerId: "gk1", position: "GK" },
    { playerId: "m9", position: "M9" },
    { playerId: "v9", position: "V9" },
    { playerId: "h9", position: "H9" },
    { playerId: "m6", position: "M6" },
    { playerId: "v6", position: "V6" },
    { playerId: "h6", position: "H6" },
  ],
};

test("HM-TACTICS-1.1: buildTacticalSummary is deterministic -- the same plan always produces the same summary", () => {
  const { plan } = buildDefaultMatchPlan(squad);
  assert.ok(plan);
  assert.equal(buildTacticalSummary(plan!), buildTacticalSummary(plan!));
});

test("HM-TACTICS-1.1: buildTacticalSummary reflects a changed field deterministically (no randomness/AI)", () => {
  const { plan } = buildDefaultMatchPlan(squad);
  assert.ok(plan);
  const fast = { ...plan!, attackPlan: { ...plan!.attackPlan, tempo: "FAST" as const } };
  const slow = { ...plan!, attackPlan: { ...plan!.attackPlan, tempo: "SLOW" as const } };
  assert.ok(buildTacticalSummary(fast).includes("Snabbt anfall"));
  assert.ok(buildTacticalSummary(slow).includes("Långsamt anfall"));
});

test("HM-TACTICS-1.1: every MatchRole/PlayingTimeIntention/PlayerPhaseUsage value has a Swedish label", () => {
  for (const role of MATCH_ROLES) assert.ok(MATCH_ROLE_LABELS_SV[role]);
  for (const intention of PLAYING_TIME_INTENTIONS) assert.ok(PLAYING_TIME_INTENTION_LABELS_SV[intention]);
  for (const usage of PLAYER_PHASE_USAGES) assert.ok(PHASE_USAGE_LABELS_SV[usage]);
});

test("HM-TACTICS-1.2 Part 4: every defensive courtSlot 1-6 has a real handball label, never a generic 'Försvarsruta N'", () => {
  const labels = new Set<string>();
  for (let courtSlot = 1; courtSlot <= 6; courtSlot++) {
    const label = defenceCourtSlotLabel(courtSlot);
    assert.equal(label, DEFENCE_COURT_SLOT_LABELS_SV[courtSlot]);
    assert.ok(!label.startsWith("Försvarsruta"));
    labels.add(label);
  }
  assert.equal(labels.size, 6, "all 6 court slots must have distinct labels");
  assert.equal(defenceCourtSlotLabel(1), "V1");
  assert.equal(defenceCourtSlotLabel(6), "H1");
});

test("HM-TACTICS-1.2 Part 6: buildMatchIdea groups the same underlying fields as buildTacticalSummary, deterministically, using only real MatchPlan values", () => {
  const { plan } = buildDefaultMatchPlan(squad);
  assert.ok(plan);
  const idea = buildMatchIdea(plan!);
  assert.deepEqual(idea, buildMatchIdea(plan!));
  assert.ok(idea.defence.includes(plan!.defencePlan.baseFormation));
  assert.ok(idea.special.toLowerCase().includes("situationsbaserat"));

  const fast = { ...plan!, attackPlan: { ...plan!.attackPlan, tempo: "FAST" as const } };
  assert.ok(buildMatchIdea(fast).attack.includes("Snabbt"));
});
