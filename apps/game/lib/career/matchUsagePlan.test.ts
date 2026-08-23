// HM-MATCH-1.0 Part B: unit coverage for the pure MatchPlan ->
// MatchUsagePlan adapter -- weights, phase gating, specialist-pair
// boosts, and depth-hierarchy priority, in isolation from the temporal
// window engine (see matchUsageEngine.test.ts for that layer).
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMatchUsagePlan, MATCH_ROLE_WEIGHT, PHASE_USAGE_MULTIPLIER, PLAYING_TIME_MULTIPLIER } from "./matchUsagePlan";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { setPlayerMatchRole, setPlayerPhaseUsage, setPlayerPlayingTime, setSubstitutionPair } from "../matchPlan/matchPlanEdits";
import type { MatchSquad, Position } from "../matchPlan/types";

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
  return { fixtureId: "fx-usageplan", clubId: "c1", players: [...BASE_STARTERS, ...extra] };
}

function buildBasePlan(extra: readonly { playerId: string; position: Position }[] = []) {
  const result = buildDefaultMatchPlan(buildSquad(extra));
  assert.ok(result.ok && result.plan, JSON.stringify(result.errors));
  return result.plan!;
}

test("MATCH_ROLE_WEIGHT/PLAYING_TIME_MULTIPLIER are monotonic (Part C/D: higher intent/role never yields a lower weight)", () => {
  assert.ok(MATCH_ROLE_WEIGHT.KEY_PLAYER > MATCH_ROLE_WEIGHT.STARTER);
  assert.ok(MATCH_ROLE_WEIGHT.STARTER > MATCH_ROLE_WEIGHT.MAJOR_ROTATION);
  assert.ok(MATCH_ROLE_WEIGHT.MAJOR_ROTATION > MATCH_ROLE_WEIGHT.ROTATION);
  assert.ok(MATCH_ROLE_WEIGHT.ROTATION > MATCH_ROLE_WEIGHT.DEVELOPMENT);
  assert.ok(MATCH_ROLE_WEIGHT.DEVELOPMENT > MATCH_ROLE_WEIGHT.EMERGENCY);
  assert.ok(PLAYING_TIME_MULTIPLIER.VERY_HIGH > PLAYING_TIME_MULTIPLIER.HIGH);
  assert.ok(PLAYING_TIME_MULTIPLIER.HIGH > PLAYING_TIME_MULTIPLIER.NORMAL);
  assert.ok(PLAYING_TIME_MULTIPLIER.NORMAL > PLAYING_TIME_MULTIPLIER.LOW);
  assert.ok(PLAYING_TIME_MULTIPLIER.LOW > PLAYING_TIME_MULTIPLIER.VERY_LOW);
  assert.ok(PLAYING_TIME_MULTIPLIER.VERY_LOW > PLAYING_TIME_MULTIPLIER.EMERGENCY_ONLY);
});

test("Part E: ATTACK_ONLY/DEFENCE_ONLY zero the opposite phase entirely; BOTH_PHASES never zeroes either", () => {
  assert.equal(PHASE_USAGE_MULTIPLIER.ATTACK_ONLY.defence, 0);
  assert.ok(PHASE_USAGE_MULTIPLIER.ATTACK_ONLY.attack > 0);
  assert.equal(PHASE_USAGE_MULTIPLIER.DEFENCE_ONLY.attack, 0);
  assert.ok(PHASE_USAGE_MULTIPLIER.DEFENCE_ONLY.defence > 0);
  assert.ok(PHASE_USAGE_MULTIPLIER.BOTH_PHASES.attack > 0 && PHASE_USAGE_MULTIPLIER.BOTH_PHASES.defence > 0);
});

test("buildMatchUsagePlan is pure and deterministic: identical MatchPlan -> identical MatchUsagePlan", () => {
  const plan = buildBasePlan();
  assert.deepEqual(buildMatchUsagePlan(plan), buildMatchUsagePlan(plan));
});

test("a goalkeeper carries zero attack/defence usage weight, and all their weight in goalkeeperUsageWeight", () => {
  const plan = buildBasePlan();
  const usagePlan = buildMatchUsagePlan(plan);
  const gk = usagePlan.players.find((p) => p.playerId === "gk1")!;
  assert.equal(gk.attackUsageWeight, 0);
  assert.equal(gk.defenceUsageWeight, 0);
  assert.ok(gk.goalkeeperUsageWeight > 0);
});

test("Part F: a substitution pair boosts each player's designated-phase weight and dampens their other phase, independent of their own PhaseUsage setting", () => {
  const plan = buildBasePlan([
    { playerId: "attackSpecialist", position: "M9" },
    { playerId: "defenceSpecialist", position: "M9" },
  ]);
  const paired = setSubstitutionPair(plan, "attackSpecialist", "defenceSpecialist");
  const usagePlan = buildMatchUsagePlan(paired);
  const unpaired = buildMatchUsagePlan(plan);

  const attackSideBefore = unpaired.players.find((p) => p.playerId === "attackSpecialist")!;
  const attackSideAfter = usagePlan.players.find((p) => p.playerId === "attackSpecialist")!;
  const defenceSideBefore = unpaired.players.find((p) => p.playerId === "defenceSpecialist")!;
  const defenceSideAfter = usagePlan.players.find((p) => p.playerId === "defenceSpecialist")!;

  assert.ok(attackSideAfter.attackUsageWeight > attackSideBefore.attackUsageWeight, "attack-side pair member's attack weight should be boosted");
  assert.ok(attackSideAfter.defenceUsageWeight < attackSideBefore.defenceUsageWeight, "attack-side pair member's defence weight should be dampened");
  assert.ok(defenceSideAfter.defenceUsageWeight > defenceSideBefore.defenceUsageWeight, "defence-side pair member's defence weight should be boosted");
  assert.ok(defenceSideAfter.attackUsageWeight < defenceSideBefore.attackUsageWeight, "defence-side pair member's attack weight should be dampened");

  assert.equal(attackSideAfter.specialistPair?.partnerId, "defenceSpecialist");
  assert.equal(attackSideAfter.specialistPair?.side, "ATTACK_SIDE");
  assert.equal(defenceSideAfter.specialistPair?.side, "DEFENCE_SIDE");
});

test("Part D: KEY_PLAYER + VERY_HIGH produces a strictly higher base weight than ROTATION + NORMAL for otherwise identical players", () => {
  const plan = buildBasePlan([{ playerId: "benchA", position: "M9" }, { playerId: "benchB", position: "M9" }]);
  const withRoles = setPlayerPlayingTime(setPlayerMatchRole(plan, "benchA", "KEY_PLAYER"), "benchA", "VERY_HIGH");
  const usagePlan = buildMatchUsagePlan(setPlayerPlayingTime(setPlayerMatchRole(withRoles, "benchB", "ROTATION"), "benchB", "NORMAL"));
  const a = usagePlan.players.find((p) => p.playerId === "benchA")!;
  const b = usagePlan.players.find((p) => p.playerId === "benchB")!;
  assert.ok(a.attackUsageWeight > b.attackUsageWeight);
  assert.ok(a.defenceUsageWeight > b.defenceUsageWeight);
});

test("Part O: EMERGENCY_ONLY produces a near-zero base weight, regardless of MatchRole", () => {
  const plan = buildBasePlan([{ playerId: "bench", position: "M9" }]);
  const usagePlan = buildMatchUsagePlan(setPlayerPlayingTime(plan, "bench", "EMERGENCY_ONLY"));
  const p = usagePlan.players.find((x) => x.playerId === "bench")!;
  assert.ok(p.attackUsageWeight < 0.05, `expected a near-zero weight, got ${p.attackUsageWeight}`);
});

test("startingInAttack/startingInDefence reflect the plan's own starting units, independently", () => {
  const plan = buildBasePlan();
  const usagePlan = buildMatchUsagePlan(plan);
  const m9 = usagePlan.players.find((p) => p.playerId === "m9_1")!;
  assert.equal(m9.startingInAttack, true);
  assert.equal(m9.startingInDefence, true); // buildDefaultMatchPlan uses the same starting six for both phases by default
});

test("ATTACK_ONLY/DEFENCE_ONLY phaseUsage is reflected structurally in the resulting weights", () => {
  const plan = buildBasePlan([{ playerId: "attacker", position: "M9" }, { playerId: "defender", position: "M9" }]);
  const withPhases = setPlayerPhaseUsage(setPlayerPhaseUsage(plan, "attacker", "ATTACK_ONLY"), "defender", "DEFENCE_ONLY");
  const usagePlan = buildMatchUsagePlan(withPhases);
  const attacker = usagePlan.players.find((p) => p.playerId === "attacker")!;
  const defender = usagePlan.players.find((p) => p.playerId === "defender")!;
  assert.equal(attacker.defenceUsageWeight, 0);
  assert.ok(attacker.attackUsageWeight > 0);
  assert.equal(defender.attackUsageWeight, 0);
  assert.ok(defender.defenceUsageWeight > 0);
});
