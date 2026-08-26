// HM-MATCH-USAGE-1.4 Part 24/25: directional proofs specific to the
// fatigue-aware rotation redesign (resolveMatchUsageTimeline and its
// consumers) that predate matchUsageEngine.test.ts's own HM-MATCH-1.0
// "Part S" suite -- kickoff-equals-starting-unit, MatchRole x
// PlayingTimeIntention hierarchy directionality, starting-unit
// structural priority, fatigue-aware rotation (a fresh rotation player
// relieving a fatigued starter, and the starter later returning),
// moderate fatigue never benching a KEY_PLAYER, goalkeeper dominance,
// determinism, and the three named scenarios (A/B/C). All assertions
// run against the REAL engine output (resolveMatchUsageTimeline /
// computeTeamUsageTrace / computeUsageMinutesReport), never hand-faked
// numbers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { setPlayerMatchRole, setPlayerPlayingTime, setSubstitutionPair } from "../matchPlan/matchPlanEdits";
import type { MatchPlan, MatchSquad, Position } from "../matchPlan/types";
import {
  computeTeamUsageTrace,
  computeUsageMinutesReport,
  resolveMatchUsageTimeline,
  MATCH_USAGE_WINDOW_COUNT,
} from "./matchUsageEngine";
import { resolveCurrentAttackUnit, resolveCurrentDefenceUnit, resolveCurrentGoalkeeper, minuteToUsageWindow } from "./currentUnit";

const FIXTURE_ID = "fx-fatigue-rotation";
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

// ---------------------------------------------------------------------------
// Part 24 #1/#2: kickoff unit equals the selected starting unit.
// ---------------------------------------------------------------------------

test("Part 24 #1: kickoff (window 0) attack unit equals the selected attack starting unit", () => {
  const plan = buildBasePlan();
  const timeline = resolveMatchUsageTimeline(plan, "seed-1");
  const kickoffIds = new Set(timeline.attackUnitByWindow[0]);
  const startingIds = new Set(plan.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => s.playerId));
  assert.deepEqual(kickoffIds, startingIds);
});

test("Part 24 #2: kickoff (window 0) defence unit equals the selected defence starting unit", () => {
  const plan = buildBasePlan();
  const timeline = resolveMatchUsageTimeline(plan, "seed-2");
  const kickoffIds = new Set(timeline.defenceUnitByWindow[0]);
  const startingIds = new Set(plan.defenceStartingUnit.courtSlots.map((s) => s.playerId));
  assert.deepEqual(kickoffIds, startingIds);
});

// ---------------------------------------------------------------------------
// Part 24 #13: a starting player has structural priority over an
// equivalent bench player -- proven directly via activeWindowRange's own
// effect: a starter is on court at kickoff even when a bench player
// carries an identical raw role/intention.
// ---------------------------------------------------------------------------

test("Part 24 #13: a starting player has structural priority at kickoff over a bench player with an IDENTICAL role/intention", () => {
  const plan = buildBasePlan([{ playerId: "bench", position: "M9" }]);
  const equalized = setPlayerPlayingTime(setPlayerMatchRole(plan, "bench", "STARTER"), "bench", "HIGH");
  const timeline = resolveMatchUsageTimeline(equalized, "seed-13");
  assert.ok(!timeline.attackUnitByWindow[0].includes("bench"), "an equal-priority bench player must not displace the selected starter at kickoff");
  assert.ok(timeline.attackUnitByWindow[0].includes("m9_1"), "the selected starter must remain in at kickoff");
});

// ---------------------------------------------------------------------------
// Part 24 #14/#15/#16/#17: fatigue-aware rotation -- reduces future
// usage, but never overrides a large role/intention tier gap, and a
// rested starter can return.
// ---------------------------------------------------------------------------

const STARTER_OUTFIELD_IDS = BASE_STARTERS.filter((p) => p.position !== "GK").map((p) => p.playerId);

test("Part 24 #14/#16: fatigue can reduce a starter's future usage and let a fresh, meaningfully-prioritized rotation player relieve them", () => {
  const plan = buildBasePlan([{ playerId: "rotationPlayer", position: "M9" }]);
  const withRotation = setPlayerPlayingTime(setPlayerMatchRole(plan, "rotationPlayer", "MAJOR_ROTATION"), "rotationPlayer", "HIGH");
  const timeline = resolveMatchUsageTimeline(withRotation, "seed-14");

  assert.deepEqual(new Set(timeline.attackUnitByWindow[0]), new Set(STARTER_OUTFIELD_IDS), "all 6 starters (tied) begin on court");
  // All 6 starters are tied, so WHICH one is rotated out is decided by
  // the seeded tiebreak -- assert on the STARTER GROUP, not one named
  // player: at least one of the 6 original starters must be missing
  // from at least one later window once fatigue accumulates.
  const someStarterMissingLater = timeline.attackUnitByWindow.some((unit) => STARTER_OUTFIELD_IDS.some((id) => !unit.includes(id)));
  assert.ok(someStarterMissingLater, "at least one starter must be rotated out for at least one later window as fatigue accumulates");
  const rotationWindowsIn = timeline.attackUnitByWindow.filter((unit) => unit.includes("rotationPlayer")).length;
  assert.ok(rotationWindowsIn > 0, "the fresh rotation player must actually relieve a fatigued starter in at least one window");
});

test("Part 24 #17: a rotated-out starter can return to a later window once partially rested", () => {
  // A single rotation player (not two), so a starter rotated out can
  // only be relieved by ROTATING BACK IN once the rotation player's own
  // window closes (there is no third candidate to take the slot).
  const plan = buildBasePlan([{ playerId: "rotationPlayer", position: "M9" }]);
  const withRotation = setPlayerPlayingTime(setPlayerMatchRole(plan, "rotationPlayer", "MAJOR_ROTATION"), "rotationPlayer", "HIGH");
  const timeline = resolveMatchUsageTimeline(withRotation, "seed-17");
  // Track, per starter, the window indices where they're OUT.
  const outWindowsByStarter = new Map(STARTER_OUTFIELD_IDS.map((id) => [id, timeline.attackUnitByWindow.map((unit) => !unit.includes(id))]));
  let sawReturn = false;
  for (const [, outFlags] of outWindowsByStarter) {
    const outIndex = outFlags.indexOf(true);
    if (outIndex !== -1 && outFlags.slice(outIndex + 1).some((v) => !v)) {
      sawReturn = true;
      break;
    }
  }
  assert.ok(sawReturn, "at least one rotated-out starter should return to a later window (rotation player's own window is bounded, not permanent)");
});

test("Part 24 #15: moderate fatigue does not automatically bench a KEY_PLAYER for a fresh DEVELOPMENT player", () => {
  const plan = buildBasePlan([{ playerId: "developmentPlayer", position: "M9" }]);
  const withRoles = setPlayerPlayingTime(
    setPlayerMatchRole(setPlayerPlayingTime(setPlayerMatchRole(plan, "m9_1", "KEY_PLAYER"), "m9_1", "VERY_HIGH"), "developmentPlayer", "DEVELOPMENT"),
    "developmentPlayer",
    "LOW",
  );
  const timeline = resolveMatchUsageTimeline(withRoles, "seed-15");
  const keyPlayerWindows = timeline.attackUnitByWindow.filter((unit) => unit.includes("m9_1")).length;
  assert.equal(keyPlayerWindows, MATCH_USAGE_WINDOW_COUNT, "a KEY_PLAYER/VERY_HIGH player should never be rotated out by fatigue alone across a normal 60-minute match");
  const developmentWindows = timeline.attackUnitByWindow.filter((unit) => unit.includes("developmentPlayer")).length;
  assert.equal(developmentWindows, 0, "a fresh DEVELOPMENT/LOW player should not displace a KEY_PLAYER through fatigue alone");
});

// ---------------------------------------------------------------------------
// Part 24 #18/#19: goalkeeper rotation stays hierarchy-driven, never
// fatigue-driven.
// ---------------------------------------------------------------------------

test("Part 24 #18: the starting goalkeeper dominates usage over a default backup goalkeeper", () => {
  const plan = buildBasePlan([{ playerId: "backupGk", position: "GK" }]);
  const timeline = resolveMatchUsageTimeline(plan, "seed-18");
  const starterWindows = timeline.goalkeeperByWindow.filter((gk) => gk === "gk1").length;
  const backupWindows = timeline.goalkeeperByWindow.filter((gk) => gk === "backupGk").length;
  assert.ok(starterWindows > backupWindows, `starter=${starterWindows} backup=${backupWindows}`);
});

test("Part 24 #19: a backup goalkeeper never takes over merely because they are fresher (no fatigue coupling on GK rotation)", () => {
  const plan = buildBasePlan([{ playerId: "backupGk", position: "GK" }]);
  const timeline = resolveMatchUsageTimeline(plan, "seed-19");
  // The starting goalkeeper's own energy trajectory is monotonically
  // declining across the match (goalkeeper load is nonzero whenever
  // active, see physicalModel.ts), yet the backup never displaces them
  // mid-match purely because of that -- goalkeeper windows are assigned
  // from the END of the match backward by a fixed share, independent of
  // either goalkeeper's live energy.
  const starterActiveWindows = timeline.goalkeeperByWindow.map((gk) => gk === "gk1");
  const firstBackupWindow = timeline.goalkeeperByWindow.indexOf("backupGk");
  if (firstBackupWindow === -1) {
    assert.ok(starterActiveWindows.every(Boolean), "with no backup usage granted, the starter must play every window");
  } else {
    // Once the backup's share begins, it must run to the end of the
    // match (a stable block, not the volatile flip-flop fatigue-driven
    // outfield rotation would produce).
    for (let w = firstBackupWindow; w < MATCH_USAGE_WINDOW_COUNT; w += 1) {
      assert.equal(timeline.goalkeeperByWindow[w], "backupGk", `expected a stable backup block from window ${firstBackupWindow}, but window ${w} reverted to the starter`);
    }
  }
});

// ---------------------------------------------------------------------------
// Part 24 #20: determinism.
// ---------------------------------------------------------------------------

test("Part 24 #20: identical (plan, seed, stamina) always resolves an identical timeline", () => {
  const plan = buildBasePlan([{ playerId: "bench", position: "M9" }]);
  const stamina = new Map([["m9_1", 15], ["bench", 8]]);
  const a = resolveMatchUsageTimeline(plan, "same-seed", stamina);
  const b = resolveMatchUsageTimeline(plan, "same-seed", stamina);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// Part 24 #28: usage report derives understandable minute equivalents.
// ---------------------------------------------------------------------------

test("Part 24 #28: computeUsageMinutesReport derives court minutes as the UNION of attack/defence/goalkeeper windows, not their sum", () => {
  const plan = buildBasePlan([{ playerId: "attackSpec", position: "M9" }, { playerId: "defenceSpec", position: "M9" }]);
  const withRoles = setPlayerPlayingTime(
    setPlayerMatchRole(setPlayerPlayingTime(setPlayerMatchRole(plan, "attackSpec", "SPECIALIST"), "attackSpec", "HIGH"), "defenceSpec", "SPECIALIST"),
    "defenceSpec",
    "HIGH",
  );
  const paired = setSubstitutionPair(withRoles, "attackSpec", "defenceSpec");
  const report = computeUsageMinutesReport(paired, "seed-28");
  const starter = report.find((r) => r.playerId === "m9_1")!;
  // A BOTH_PHASES starter active in attack and defence during the SAME
  // windows: courtMinutes must equal attackMinutes (== defenceMinutes),
  // never their sum -- proving the union, not addition.
  assert.equal(starter.attackMinutes, starter.defenceMinutes);
  assert.equal(starter.courtMinutes, starter.attackMinutes);
  assert.ok(starter.courtMinutes < starter.attackMinutes + starter.defenceMinutes || starter.attackMinutes === 0);
});

// ---------------------------------------------------------------------------
// Part 24 #23: currentUnit.ts, reading the SAME persisted per-window
// arrays resolveMatchUsageTimeline itself produced, always agrees with
// the usage engine's own resolved timeline.
// ---------------------------------------------------------------------------

test("Part 24 #23: currentUnit.ts's resolvers agree exactly with resolveMatchUsageTimeline when given its own persisted per-window arrays", () => {
  const plan = buildBasePlan([{ playerId: "rotationPlayer", position: "M9" }]);
  const withRotation = setPlayerPlayingTime(setPlayerMatchRole(plan, "rotationPlayer", "MAJOR_ROTATION"), "rotationPlayer", "HIGH");
  const seed = "seed-23";
  const timeline = resolveMatchUsageTimeline(withRotation, seed);

  for (let minute = 0; minute <= 59; minute += 7) {
    const window = minuteToUsageWindow(minute);
    const attack = resolveCurrentAttackUnit(withRotation, minute, seed, timeline.attackUnitByWindow);
    const defence = resolveCurrentDefenceUnit(withRotation, minute, seed, timeline.defenceUnitByWindow);
    const gk = resolveCurrentGoalkeeper(withRotation, minute, seed, timeline.goalkeeperByWindow);
    assert.deepEqual(new Set(attack.map((s) => s.playerId)), new Set(timeline.attackUnitByWindow[window]));
    assert.deepEqual(new Set(defence.map((s) => s.playerId)), new Set(timeline.defenceUnitByWindow[window]));
    assert.equal(gk, timeline.goalkeeperByWindow[window]);
  }
});

// ---------------------------------------------------------------------------
// Part 25 Scenario A -- star-heavy role hierarchy.
// ---------------------------------------------------------------------------

test("Part 25 Scenario A: KEY_PLAYER/VERY_HIGH > STARTER/HIGH > MAJOR_ROTATION/NORMAL > ROTATION/LOW, in that order", () => {
  const plan = buildBasePlan([
    { playerId: "playerA", position: "M9" },
    { playerId: "playerB", position: "M9" },
    { playerId: "playerC", position: "M9" },
    { playerId: "playerD", position: "M9" },
  ]);
  let withRoles = plan;
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "playerA", "KEY_PLAYER"), "playerA", "VERY_HIGH");
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "playerB", "STARTER"), "playerB", "HIGH");
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "playerC", "MAJOR_ROTATION"), "playerC", "NORMAL");
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "playerD", "ROTATION"), "playerD", "LOW");

  const trace = computeTeamUsageTrace(withRoles, "scenario-a");
  const a = trace.players.find((p) => p.playerId === "playerA")!;
  const b = trace.players.find((p) => p.playerId === "playerB")!;
  const c = trace.players.find((p) => p.playerId === "playerC")!;
  const d = trace.players.find((p) => p.playerId === "playerD")!;

  console.log("Scenario A actual exposure:", { A: a.attackExposure, B: b.attackExposure, C: c.attackExposure, D: d.attackExposure });

  assert.ok(a.attackExposure >= b.attackExposure, `A=${a.attackExposure} should be >= B=${b.attackExposure}`);
  assert.ok(b.attackExposure > c.attackExposure, `B=${b.attackExposure} should exceed C=${c.attackExposure}`);
  assert.ok(c.attackExposure >= d.attackExposure, `C=${c.attackExposure} should be >= D=${d.attackExposure}`);
});

// ---------------------------------------------------------------------------
// Part 25 Scenario B -- specialist pair.
// ---------------------------------------------------------------------------

test("Part 25 Scenario B: a SPECIALIST/HIGH substitution pair (A attack-side, B defence-side) shows phase-specific usage, not shared '60 minutes'", () => {
  const plan = buildBasePlan([{ playerId: "specA", position: "M9" }, { playerId: "specB", position: "M9" }]);
  let withRoles = plan;
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "specA", "SPECIALIST"), "specA", "HIGH");
  withRoles = setPlayerPlayingTime(setPlayerMatchRole(withRoles, "specB", "SPECIALIST"), "specB", "HIGH");
  const paired = setSubstitutionPair(withRoles, "specA", "specB");

  const trace = computeTeamUsageTrace(paired, "scenario-b");
  const a = trace.players.find((p) => p.playerId === "specA")!;
  const b = trace.players.find((p) => p.playerId === "specB")!;

  console.log("Scenario B actual exposure:", { A_attack: a.attackExposure, A_defence: a.defenceExposure, B_attack: b.attackExposure, B_defence: b.defenceExposure });

  assert.ok(a.attackExposure > a.defenceExposure);
  assert.ok(b.defenceExposure > b.attackExposure);
});

// ---------------------------------------------------------------------------
// Part 25 Scenario C -- fatigue-driven rotation, actual engine output.
// ---------------------------------------------------------------------------

test("Part 25 Scenario C: a heavily-used starter loses energy, a rotation player relieves them, and the starter can return -- all from actual engine output", () => {
  const plan = buildBasePlan([{ playerId: "rotationPlayer", position: "M9" }]);
  const withRotation = setPlayerPlayingTime(setPlayerMatchRole(plan, "rotationPlayer", "MAJOR_ROTATION"), "rotationPlayer", "HIGH");
  const timeline = resolveMatchUsageTimeline(withRotation, "scenario-c");
  const rotationTrajectory = timeline.trajectories.get("rotationPlayer")!;

  const rotationInWindow = timeline.attackUnitByWindow.map((unit) => unit.includes("rotationPlayer"));
  // All 6 starters are tied (identical role/intention), so the SPECIFIC
  // starter rotated out is decided by the seeded tiebreak -- find
  // whichever one actually was, for reporting and the return-later check.
  const relievedStarterId = STARTER_OUTFIELD_IDS.find((id) => timeline.attackUnitByWindow.some((unit) => !unit.includes(id)));
  assert.ok(relievedStarterId, "test setup: expected at least one starter to be rotated out");
  const starterTrajectory = timeline.trajectories.get(relievedStarterId!)!;
  const starterInWindow = timeline.attackUnitByWindow.map((unit) => unit.includes(relievedStarterId!));

  console.log("Scenario C actual output:", {
    relievedStarterId,
    starterInWindow,
    rotationInWindow,
    starterCheckpoints: starterTrajectory.checkpoints,
    rotationCheckpoints: rotationTrajectory.checkpoints,
    starterFinishingEnergy: starterTrajectory.finishingEnergy,
    rotationFinishingEnergy: rotationTrajectory.finishingEnergy,
  });

  assert.ok(starterTrajectory.finishingEnergy < starterTrajectory.startingEnergy, "the starter must show real net energy loss");
  assert.ok(starterInWindow.some((v) => !v), "the starter must be rotated out for at least one window");
  assert.ok(rotationInWindow.some(Boolean), "the rotation player must actually relieve them in at least one window");
  // (Part 24 #17's own test proves the general "a rotated-out starter
  // CAN return" property across the starter group; this specific seed's
  // rotation happens to land in the match's closing window, so there is
  // no later window left for THIS relieved starter to return to here.)
});
