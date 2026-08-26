// HM-MATCH-USAGE-1.4A: directional proofs for the two calibration fixes
// -- (1) an explicit ATTACK_ONLY/DEFENCE_ONLY substitution pair must
// reliably win a real share of its preferred phase even against a
// same-or-higher-tier generic rotation competitor (the browser QA root
// cause: SPECIALIST/HIGH pair receiving 0/0 minutes purely from squad-
// specific depth-hierarchy luck), and (2) a backup goalkeeper's default
// ROTATION/NORMAL role must NOT automatically claim any match share --
// goalkeeper rotation stays coach-driven, only responding to an
// explicitly elevated role/intention. physicalModel.ts is untouched;
// only matchUsageEngine.ts's ranking (pair boost) and goalkeeper-share
// threshold changed. All assertions run against the real engine
// (resolveMatchUsageTimeline / computeTeamUsageTrace), never hand-faked
// numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { setPlayerMatchRole, setPlayerPhaseUsage, setPlayerPlayingTime, setSubstitutionPair } from "../matchPlan/matchPlanEdits";
import type { MatchPlan, MatchSquad, Position } from "../matchPlan/types";
import { computeTeamUsageTrace, computeUsageMinutesReport, resolveMatchUsageTimeline, MATCH_USAGE_WINDOW_COUNT } from "./matchUsageEngine";

const FIXTURE_ID = "fx-specialist-gk-calibration";
const CLUB_ID = "c1";

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
  return { fixtureId: FIXTURE_ID, clubId: CLUB_ID, players: [...BASE_STARTERS, ...extra] };
}

function buildBasePlan(extra: readonly { playerId: string; position: Position }[] = []): MatchPlan {
  const result = buildDefaultMatchPlan(buildSquad(extra));
  assert.ok(result.ok && result.plan, JSON.stringify(result.errors));
  return result.plan!;
}

function pairedSpecialists(plan: MatchPlan, attackId: string, defenceId: string): MatchPlan {
  let p = plan;
  p = setPlayerPlayingTime(setPlayerMatchRole(p, attackId, "SPECIALIST"), attackId, "HIGH");
  p = setPlayerPhaseUsage(p, attackId, "ATTACK_ONLY");
  p = setPlayerPlayingTime(setPlayerMatchRole(p, defenceId, "SPECIALIST"), defenceId, "HIGH");
  p = setPlayerPhaseUsage(p, defenceId, "DEFENCE_ONLY");
  return setSubstitutionPair(p, attackId, defenceId);
}

// ---------------------------------------------------------------------------
// Specialist pair tests (1-12).
// ---------------------------------------------------------------------------

test("Specialist #1: an explicit ATTACK_ONLY/DEFENCE_ONLY pair gets real, phase-specific usage (not 0/0)", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  const trace = computeTeamUsageTrace(paired, "spec-1");
  const a = trace.players.find((p) => p.playerId === "specA")!;
  const b = trace.players.find((p) => p.playerId === "specB")!;
  assert.ok(a.attackExposure > 0, `attack specialist must get real attack usage, got ${a.attackExposure}`);
  assert.ok(b.defenceExposure > 0, `defence specialist must get real defence usage, got ${b.defenceExposure}`);
});

test("Specialist #2: the attack specialist gets more attack exposure than defence exposure", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  const trace = computeTeamUsageTrace(paired, "spec-2");
  const a = trace.players.find((p) => p.playerId === "specA")!;
  assert.ok(a.attackExposure > a.defenceExposure);
  assert.equal(a.defenceExposure, 0, "ATTACK_ONLY must still hard-zero defence exposure");
});

test("Specialist #3: the defence specialist gets more defence exposure than attack exposure", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  const trace = computeTeamUsageTrace(paired, "spec-3");
  const b = trace.players.find((p) => p.playerId === "specB")!;
  assert.ok(b.defenceExposure > b.attackExposure);
  assert.equal(b.attackExposure, 0, "DEFENCE_ONLY must still hard-zero attack exposure");
});

test("Specialist #4: a paired SPECIALIST/HIGH gets more relevant-phase exposure than an identical UNPAIRED SPECIALIST/HIGH", () => {
  const plan = buildBasePlan([{ playerId: "pairedSpec", position: "V6" }, { playerId: "pairPartner", position: "H6" }, { playerId: "unpairedSpec", position: "V6" }]);
  let withRoles = plan;
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "unpairedSpec", "SPECIALIST"), "unpairedSpec", "HIGH");
  withRoles = setPlayerPhaseUsage(withRoles, "unpairedSpec", "ATTACK_ONLY");
  const paired = pairedSpecialists(withRoles, "pairedSpec", "pairPartner");

  const trace = computeTeamUsageTrace(paired, "spec-4");
  const pairedTrace = trace.players.find((p) => p.playerId === "pairedSpec")!;
  const unpairedTrace = trace.players.find((p) => p.playerId === "unpairedSpec")!;
  assert.ok(pairedTrace.attackExposure > unpairedTrace.attackExposure, `paired=${pairedTrace.attackExposure} unpaired=${unpairedTrace.attackExposure}`);
});

test("Specialist #5: a MAJOR_ROTATION generalist cannot fully block an explicit HIGH specialist pair from its preferred phase", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }, { playerId: "rotationPlayer", position: "M9" }]);
  let withRoles = pairedSpecialists(plan, "specA", "specB");
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "rotationPlayer", "MAJOR_ROTATION"), "rotationPlayer", "HIGH");

  const trace = computeTeamUsageTrace(withRoles, "spec-5");
  const a = trace.players.find((p) => p.playerId === "specA")!;
  assert.ok(a.attackExposure > 0, `paired attack specialist must not be fully blocked by a MAJOR_ROTATION generalist, got ${a.attackExposure}`);
});

test("Specialist #6: a VERY_LOW-intention specialist still gets little-to-no usage even when paired", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  let p = plan;
  p = setPlayerPlayingTime(setPlayerMatchRole(p, "specA", "SPECIALIST"), "specA", "VERY_LOW");
  p = setPlayerPhaseUsage(p, "specA", "ATTACK_ONLY");
  p = setPlayerPlayingTime(setPlayerMatchRole(p, "specB", "SPECIALIST"), "specB", "VERY_LOW");
  p = setPlayerPhaseUsage(p, "specB", "DEFENCE_ONLY");
  p = setSubstitutionPair(p, "specA", "specB");

  const trace = computeTeamUsageTrace(p, "spec-6");
  const a = trace.players.find((x) => x.playerId === "specA")!;
  assert.ok(a.attackExposure <= 1 / MATCH_USAGE_WINDOW_COUNT, `VERY_LOW paired specialist should still be used sparingly, got ${a.attackExposure}`);
});

test("Specialist #7: fatigue can reduce a specialist's own usage across the match (their pair boost is not immune to their own tiredness)", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  const timeline = resolveMatchUsageTimeline(paired, "spec-7");
  const trajectory = timeline.trajectories.get("specA")!;
  // Whenever specA is actually active, their own energy must decline --
  // proving fatigue is genuinely applied to a paired specialist too.
  if (trajectory.attackWindowsActive > 0) {
    assert.ok(trajectory.finishingEnergy < trajectory.startingEnergy);
  }
});

test("Specialist #8: moderate fatigue does not eliminate a paired specialist's role entirely across a full match", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  const timeline = resolveMatchUsageTimeline(paired, "spec-8");
  const trajectory = timeline.trajectories.get("specA")!;
  assert.ok(trajectory.attackWindowsActive > 0, "a HIGH-intention paired specialist should retain real usage across a normal 60-minute match, not be fully squeezed out by their own accumulating fatigue");
});

test("Specialist #9: pair determinism -- identical (plan, seed) always resolves an identical pair-boosted timeline", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  const a = resolveMatchUsageTimeline(paired, "same-seed");
  const b = resolveMatchUsageTimeline(paired, "same-seed");
  assert.deepEqual(a, b);
});

test("Specialist #10: removing the pair changes usage directionally (the pair boost is real, not a no-op)", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  let unpaired = plan;
  unpaired = setPlayerPlayingTime(setPlayerMatchRole(unpaired, "specA", "SPECIALIST"), "specA", "HIGH");
  unpaired = setPlayerPhaseUsage(unpaired, "specA", "ATTACK_ONLY");
  unpaired = setPlayerPlayingTime(setPlayerMatchRole(unpaired, "specB", "SPECIALIST"), "specB", "HIGH");
  unpaired = setPlayerPhaseUsage(unpaired, "specB", "DEFENCE_ONLY");

  const pairedTrace = computeTeamUsageTrace(paired, "spec-10");
  const unpairedTrace = computeTeamUsageTrace(unpaired, "spec-10");
  const pairedA = pairedTrace.players.find((p) => p.playerId === "specA")!;
  const unpairedA = unpairedTrace.players.find((p) => p.playerId === "specA")!;
  assert.ok(pairedA.attackExposure >= unpairedA.attackExposure, `pairing should never REDUCE the attack specialist's own attack exposure: paired=${pairedA.attackExposure} unpaired=${unpairedA.attackExposure}`);
});

test("Specialist #11: ATTACK_ONLY remains zero defence exposure even with the pair ranking boost applied", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  const trace = computeTeamUsageTrace(paired, "spec-11");
  const a = trace.players.find((p) => p.playerId === "specA")!;
  assert.equal(a.defenceExposure, 0);
});

test("Specialist #12: DEFENCE_ONLY remains zero attack exposure even with the pair ranking boost applied", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "V6" }, { playerId: "specB", position: "H6" }]);
  const paired = pairedSpecialists(plan, "specA", "specB");
  const trace = computeTeamUsageTrace(paired, "spec-12");
  const b = trace.players.find((p) => p.playerId === "specB")!;
  assert.equal(b.attackExposure, 0);
});

// ---------------------------------------------------------------------------
// Goalkeeper tests (13-24).
// ---------------------------------------------------------------------------

function backupGkTimeline(role?: Parameters<typeof setPlayerMatchRole>[2], intention?: Parameters<typeof setPlayerPlayingTime>[2]) {
  const plan = buildBasePlan([{ playerId: "backupGk", position: "GK" }]);
  let p = plan;
  if (role) p = setPlayerMatchRole(p, "backupGk", role);
  if (intention) p = setPlayerPlayingTime(p, "backupGk", intention);
  return resolveMatchUsageTimeline(p, "gk-seed");
}

test("Goalkeeper #13: the default starting goalkeeper dominates a default (ROTATION/NORMAL) backup", () => {
  const timeline = backupGkTimeline();
  const starterWindows = timeline.goalkeeperByWindow.filter((g) => g === "gk1").length;
  const backupWindows = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  assert.ok(starterWindows > backupWindows);
});

test("Goalkeeper #14: a normal default backup does NOT automatically receive any match share", () => {
  const timeline = backupGkTimeline();
  const backupWindows = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  assert.equal(backupWindows, 0, `default ROTATION/NORMAL backup should get 0 windows by default, got ${backupWindows}`);
});

test("Goalkeeper #15: the starting goalkeeper can play all 6 windows when no backup usage is granted", () => {
  const timeline = backupGkTimeline();
  const starterWindows = timeline.goalkeeperByWindow.filter((g) => g === "gk1").length;
  assert.equal(starterWindows, MATCH_USAGE_WINDOW_COUNT);
});

test("Goalkeeper #16: a fresh backup does not replace a slightly fatigued starter automatically (no fatigue coupling on GK rotation)", () => {
  const timeline = backupGkTimeline();
  const starterTrajectory = timeline.trajectories.get("gk1")!;
  // The starter's own energy is declining across the match (goalkeeper
  // load is nonzero whenever active), yet the default backup never
  // takes over -- see Goalkeeper #14 -- proving fatigue alone never
  // triggers a swap.
  assert.ok(starterTrajectory.finishingEnergy < starterTrajectory.startingEnergy);
  const backupWindows = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  assert.equal(backupWindows, 0);
});

test("Goalkeeper #17: explicit HIGH backup usage creates real GK rotation", () => {
  const timeline = backupGkTimeline("MAJOR_ROTATION", "HIGH");
  const backupWindows = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  assert.ok(backupWindows > 0, `an explicitly elevated backup should get real windows, got ${backupWindows}`);
});

test("Goalkeeper #18: a MAJOR_ROTATION/HIGH backup gets more usage than a LOW-intention backup", () => {
  const highTimeline = backupGkTimeline("MAJOR_ROTATION", "HIGH");
  const lowTimeline = backupGkTimeline(undefined, "LOW");
  const highWindows = highTimeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  const lowWindows = lowTimeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  assert.ok(highWindows > lowWindows, `high=${highWindows} low=${lowWindows}`);
});

test("Goalkeeper #19: a VERY_LOW backup normally gets zero usage", () => {
  const timeline = backupGkTimeline(undefined, "VERY_LOW");
  const backupWindows = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  assert.equal(backupWindows, 0);
});

test("Goalkeeper #20: an EMERGENCY_ONLY backup gets zero usage", () => {
  const timeline = backupGkTimeline(undefined, "EMERGENCY_ONLY");
  const backupWindows = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  assert.equal(backupWindows, 0);
});

test("Goalkeeper #21: goalkeeper usage remains deterministic for identical (plan, seed)", () => {
  const plan = buildBasePlan([{ playerId: "backupGk", position: "GK" }]);
  const withUsage = setPlayerPlayingTime(setPlayerMatchRole(plan, "backupGk", "MAJOR_ROTATION"), "backupGk", "HIGH");
  const a = resolveMatchUsageTimeline(withUsage, "gk-det-seed");
  const b = resolveMatchUsageTimeline(withUsage, "gk-det-seed");
  assert.deepEqual(a.goalkeeperByWindow, b.goalkeeperByWindow);
});

test("Goalkeeper #22: currentUnit returns the correct goalkeeper per window, matching the resolved timeline exactly", async () => {
  const { resolveCurrentGoalkeeper } = await import("./currentUnit");
  const plan = buildBasePlan([{ playerId: "backupGk", position: "GK" }]);
  const withUsage = setPlayerPlayingTime(setPlayerMatchRole(plan, "backupGk", "STARTER"), "backupGk", "HIGH");
  const seed = "gk-currentunit-seed";
  const timeline = resolveMatchUsageTimeline(withUsage, seed);
  for (let minute = 0; minute <= 59; minute += 10) {
    const window = Math.min(MATCH_USAGE_WINDOW_COUNT - 1, Math.floor(minute / 10));
    const gk = resolveCurrentGoalkeeper(withUsage, minute, seed, timeline.goalkeeperByWindow);
    assert.equal(gk, timeline.goalkeeperByWindow[window]);
  }
});

test("Goalkeeper #23: goalkeeper physical exposure follows the actual resolved GK usage (windows, not weight)", () => {
  const timeline = backupGkTimeline("MAJOR_ROTATION", "HIGH");
  const starterTrajectory = timeline.trajectories.get("gk1")!;
  const backupTrajectory = timeline.trajectories.get("backupGk")!;
  const starterActualWindows = timeline.goalkeeperByWindow.filter((g) => g === "gk1").length;
  const backupActualWindows = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length;
  assert.equal(starterTrajectory.goalkeeperWindowsActive, starterActualWindows);
  assert.equal(backupTrajectory.goalkeeperWindowsActive, backupActualWindows);
});

test("Goalkeeper #24: no outcourt (attack/defence) logic is accidentally applied to a goalkeeper", () => {
  const timeline = backupGkTimeline("MAJOR_ROTATION", "HIGH");
  const starterTrajectory = timeline.trajectories.get("gk1")!;
  const backupTrajectory = timeline.trajectories.get("backupGk")!;
  assert.equal(starterTrajectory.attackWindowsActive, 0);
  assert.equal(starterTrajectory.defenceWindowsActive, 0);
  assert.equal(backupTrajectory.attackWindowsActive, 0);
  assert.equal(backupTrajectory.defenceWindowsActive, 0);
});

// ---------------------------------------------------------------------------
// Real Scenario A -- specialist pair in a fuller squad (real engine output).
// ---------------------------------------------------------------------------

test("Real Scenario A: specialist pair alongside KEY_PLAYER/STARTER/MAJOR_ROTATION/ROTATION -- actual usage report", () => {
  const plan = buildBasePlan([
    { playerId: "specA", position: "V6" },
    { playerId: "specB", position: "H6" },
    { playerId: "keyPlayer", position: "M9" },
    { playerId: "rotationPlayer", position: "M9" },
  ]);
  let withRoles = pairedSpecialists(plan, "specA", "specB");
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "keyPlayer", "KEY_PLAYER"), "keyPlayer", "VERY_HIGH");
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "rotationPlayer", "ROTATION"), "rotationPlayer", "NORMAL");

  const report = computeUsageMinutesReport(withRoles, "scenario-a-calibration");
  const specA = report.find((r) => r.playerId === "specA")!;
  const specB = report.find((r) => r.playerId === "specB")!;

  console.log("Real Scenario A actual minutes:", {
    specA: { att: specA.attackMinutes, def: specA.defenceMinutes, court: specA.courtMinutes },
    specB: { att: specB.attackMinutes, def: specB.defenceMinutes, court: specB.courtMinutes },
  });

  assert.ok(specA.attackMinutes > 0, `attack specialist must get real attack minutes, got ${specA.attackMinutes}`);
  assert.ok(specB.defenceMinutes > 0, `defence specialist must get real defence minutes, got ${specB.defenceMinutes}`);
});

// ---------------------------------------------------------------------------
// Real Scenario B -- goalkeepers, three sub-scenarios (real engine output).
// ---------------------------------------------------------------------------

test("Real Scenario B.1: STARTER/HIGH starting GK vs ROTATION/NORMAL backup -- backup gets 0 default minutes", () => {
  const timeline = backupGkTimeline(undefined, undefined);
  const starterMin = timeline.goalkeeperByWindow.filter((g) => g === "gk1").length * 10;
  const backupMin = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length * 10;
  console.log("Real Scenario B.1:", { starterMin, backupMin, starterFinishE: timeline.trajectories.get("gk1")!.finishingEnergy, backupFinishE: timeline.trajectories.get("backupGk")!.finishingEnergy });
  assert.equal(backupMin, 0);
});

test("Real Scenario B.2: STARTER/HIGH starting GK vs MAJOR_ROTATION/HIGH backup -- backup gets a real shared usage", () => {
  const timeline = backupGkTimeline("MAJOR_ROTATION", "HIGH");
  const starterMin = timeline.goalkeeperByWindow.filter((g) => g === "gk1").length * 10;
  const backupMin = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length * 10;
  console.log("Real Scenario B.2:", { starterMin, backupMin, starterFinishE: timeline.trajectories.get("gk1")!.finishingEnergy, backupFinishE: timeline.trajectories.get("backupGk")!.finishingEnergy });
  assert.ok(backupMin > 0);
  assert.ok(starterMin > backupMin, "starter should still dominate even with an explicitly elevated backup");
});

test("Real Scenario B.3: EMERGENCY_ONLY backup gets 0 minutes", () => {
  const timeline = backupGkTimeline(undefined, "EMERGENCY_ONLY");
  const backupMin = timeline.goalkeeperByWindow.filter((g) => g === "backupGk").length * 10;
  console.log("Real Scenario B.3:", { backupMin, backupFinishE: timeline.trajectories.get("backupGk")!.finishingEnergy });
  assert.equal(backupMin, 0);
});
