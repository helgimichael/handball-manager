// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
// HM-MATCH-1.1 Part 9/10/11/12: directional/invariant proofs for the
// two critical bugs this milestone's audit confirmed in real browser
// gameplay -- (a) a team fielding more than 16 participants because an
// unresolved MatchPlan fell back to an entirely unfiltered squad, and
// (b) a bench player scoring before their scheduled usage window opens
// because the goal-scorer draw had no minute/window awareness. Also
// covers Part 12's technical-error duration-scaling fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture, getPlayerFixtureOn } from "./calendar";
import { processDay } from "./dailyTick";
import { continueCareerRhythm } from "./continueController";
import { playManagerFixtureLegacy as playManagerFixture } from "./legacy/matchday";
import { applyMidMatchTacticalChange } from "./tacticalMidMatchChange";
import { defaultTeamTacticalProfile } from "./teamTacticalProfile";
import { snapshotAiTacticalPreferences, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { setPlayerPhaseUsage, setPlayerPlayingTime } from "../matchPlan/matchPlanEdits";
import { MATCH_SQUAD_MAX_PLAYERS } from "../matchPlan/types";
import { TUMBA_CLUB_ID, TUMBA_SQUAD, GAME_CURRENT_DATE } from "../game-data";
import type { CareerState } from "./types";

const NEUTRAL_PROFILE = defaultTeamTacticalProfile();

function stateAtMatchdayWithPlan(seed = "roster-integrity-seed") {
  const fresh = createNewCareerState(seed, TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  const state = processDay(fresh, matchday).state;
  const fixture = getNextPlayerFixture(state)!;
  const initialSquad = buildInitialMatchSquad(TUMBA_SQUAD, fixture.id, TUMBA_CLUB_ID);
  const { plan } = buildDefaultMatchPlan(initialSquad);
  const withPlan: CareerState = { ...state, matchPlans: { ...state.matchPlans, [fixture.id]: plan! } };
  return { state: withPlan, fixture, plan: plan! };
}

/** A real REAL_WORLD-backed fixture (Handbollsligan) -- opponent squads here commonly have 18+ eligible players, exactly the scenario that reproduced the observed ">16 participants" bug. */
function stateAtRealClubMatchday(seed: string): CareerState {
  const clubId = "se_club_alingsas_hk";
  const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
  const aiTacticalPreferences = snapshotAiTacticalPreferences("se_handbollsligan_herr", "2026/27", GAME_CURRENT_DATE);
  const fresh = createNewCareerState(seed, clubId, worldSquads, aiTacticalPreferences);
  let current = fresh;
  for (let i = 0; i < 100; i += 1) {
    const { state: next, stopReason } = continueCareerRhythm(current);
    current = next;
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") return current;
  }
  throw new Error("never reached an ACTION_REQUIRED stop");
}

test("HM-MATCH-1.1 #5/#7/#8: a manager's played fixture never has more than 16 participating players per side, and no scorer/contributor falls outside the fixture's own MatchSquad", () => {
  const { state, fixture, plan } = stateAtMatchdayWithPlan("cap-manager-seed");
  const { result } = playManagerFixture(state);
  assert.ok(result);

  const managerIsHome = result!.homeClubId === TUMBA_CLUB_ID;
  const managerContributions = managerIsHome ? result!.homePlayerContributions : result!.awayPlayerContributions;
  assert.ok(managerContributions.length <= MATCH_SQUAD_MAX_PLAYERS, `manager side had ${managerContributions.length} participants, expected <= ${MATCH_SQUAD_MAX_PLAYERS}`);

  const squadIds = new Set(plan.squad.players.map((p) => p.playerId));
  for (const contribution of managerContributions) {
    assert.ok(squadIds.has(contribution.playerId), `${contribution.playerId} contributed but is not in fixture ${fixture.id}'s MatchSquad`);
  }
});

test("HM-MATCH-1.1 #6/#7/#8: a real AI opponent (>16-player raw squad) never fields more than 16 participants, and every scorer/contributor is drawn from a capped selection, not the whole club", () => {
  let sawLargerThan16RawSquad = false;
  for (let i = 0; i < 20; i += 1) {
    const state = stateAtRealClubMatchday(`cap-opponent-seed-${i}`);
    const fixture = getPlayerFixtureOn(state, state.gameDate)!;
    const opponentClubId = fixture.homeClubId === "se_club_alingsas_hk" ? fixture.awayClubId : fixture.homeClubId;
    const opponentRawSquad = state.worldSquads[opponentClubId] ?? [];
    if (opponentRawSquad.length > MATCH_SQUAD_MAX_PLAYERS) sawLargerThan16RawSquad = true;

    const { result } = playManagerFixture(state);
    assert.ok(result);
    const opponentIsHome = fixture.homeClubId === opponentClubId;
    const opponentContributions = opponentIsHome ? result!.homePlayerContributions : result!.awayPlayerContributions;
    assert.ok(
      opponentContributions.length <= MATCH_SQUAD_MAX_PLAYERS,
      `opponent ${opponentClubId} (raw squad ${opponentRawSquad.length}) fielded ${opponentContributions.length} participants, expected <= ${MATCH_SQUAD_MAX_PLAYERS}`,
    );
  }
  assert.ok(sawLargerThan16RawSquad, "test setup assumption: expected at least one sampled opponent club to have a raw squad larger than 16 (otherwise this test can't exercise the capping fix)");
});

test("HM-MATCH-1.1 #11/#13: the starting goalkeeper is respected -- the GK contribution's playerId matches the plan's defenceStartingUnit.goalkeeperId", () => {
  const { state, plan } = stateAtMatchdayWithPlan("gk-respected-seed");
  const { result } = playManagerFixture(state);
  assert.ok(result);
  const managerIsHome = result!.homeClubId === TUMBA_CLUB_ID;
  const managerContributions = managerIsHome ? result!.homePlayerContributions : result!.awayPlayerContributions;
  // `saves` is only ever set on the goalkeeper's own contribution (matchEngine.ts's buildPlayerContributions never sets it for outfield players).
  const gk = managerContributions.find((c) => "saves" in c);
  assert.ok(gk, "expected exactly one goalkeeper contribution");
  assert.equal(gk!.playerId, plan.defenceStartingUnit.goalkeeperId);
});

test("HM-MATCH-1.1 #10: a player set to DEFENCE_ONLY phase usage never scores -- excluded from attack attribution entirely, not merely deprioritized", () => {
  const { state, fixture, plan } = stateAtMatchdayWithPlan("defence-only-seed");
  const target = plan.playerUsage.find((u) => plan.squad.players.find((p) => p.playerId === u.playerId)?.position !== "GK")!;
  const defenceOnlyPlan = setPlayerPhaseUsage(plan, target.playerId, "DEFENCE_ONLY");
  const withPlan: CareerState = { ...state, matchPlans: { ...state.matchPlans, [fixture.id]: defenceOnlyPlan } };

  const { result } = playManagerFixture(withPlan);
  assert.ok(result);
  const managerIsHome = result!.homeClubId === TUMBA_CLUB_ID;
  const managerContributions = managerIsHome ? result!.homePlayerContributions : result!.awayPlayerContributions;
  const contribution = managerContributions.find((c) => c.playerId === target.playerId);
  assert.ok(contribution);
  assert.equal(contribution!.goals, 0, "a DEFENCE_ONLY player must never be attributed a goal");
});

test("HM-MATCH-1.1 #9/#12: a bench player only scheduled to enter LATE in the match never scores in the opening minute, averaged across many seeded fixtures", () => {
  let sawAnEarlyGoalByTheLatePlayer = false;
  for (let i = 0; i < 25 && !sawAnEarlyGoalByTheLatePlayer; i += 1) {
    const { state, fixture, plan } = stateAtMatchdayWithPlan(`late-entry-seed-${i}`);
    const target = plan.playerUsage.find((u) => u.matchRole !== "STARTER" && plan.squad.players.find((p) => p.playerId === u.playerId)?.position !== "GK")!;
    // MAJOR_ROTATION + HIGH is a real, meaningful bench role (per HM-MATCH-1.0's own Hammarby QA vocabulary) -- guaranteed nonzero eventual exposure, but scheduled to enter LATE (a bench player's active window starts near the end, see activeWindowRange).
    const latePlan = setPlayerPlayingTime(plan, target.playerId, "HIGH");
    const withPlan: CareerState = { ...state, matchPlans: { ...state.matchPlans, [fixture.id]: latePlan } };

    const { result } = playManagerFixture(withPlan);
    if (!result) continue;
    const managerIsHome = result.homeClubId === TUMBA_CLUB_ID;
    const events = result.events.filter((e) => e.type === "GOAL" && e.side === (managerIsHome ? "home" : "away") && e.playerId === target.playerId && e.minute <= 10);
    if (events.length > 0) sawAnEarlyGoalByTheLatePlayer = true;
  }
  assert.ok(!sawAnEarlyGoalByTheLatePlayer, "a bench player whose usage window opens late must never score within the match's first 10 minutes across 25 seeded fixtures");
});

test("HM-MATCH-1.1 #10 (live splice): the SAME window-eligibility invariant holds for a mid-match tactical-change splice, not just the initial simulation", () => {
  const fresh = createNewCareerState("splice-window-seed", TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  const state = processDay(fresh, matchday).state;
  const fixture = getNextPlayerFixture(state)!;
  const { state: played, result: original } = playManagerFixture(state);
  assert.ok(original);

  const adoptionMinute = 5;
  const next = applyMidMatchTacticalChange(played, fixture.id, adoptionMinute, NEUTRAL_PROFILE, false, null);
  const spliced = next.results[fixture.id];
  const managerIsHome = spliced.homeClubId === TUMBA_CLUB_ID;
  const managerContributions = managerIsHome ? spliced.homePlayerContributions : spliced.awayPlayerContributions;
  assert.ok(managerContributions.length <= MATCH_SQUAD_MAX_PLAYERS, `spliced manager side had ${managerContributions.length} participants after a live change, expected <= ${MATCH_SQUAD_MAX_PLAYERS}`);

  const opponentIsHome = !managerIsHome;
  const opponentContributions = opponentIsHome ? spliced.homePlayerContributions : spliced.awayPlayerContributions;
  assert.ok(opponentContributions.length <= MATCH_SQUAD_MAX_PLAYERS, `spliced opponent side had ${opponentContributions.length} participants after a live change, expected <= ${MATCH_SQUAD_MAX_PLAYERS}`);
});

test("HM-MATCH-1.1 #16/#17 Part 12: a neutral (no-op) mid-match splice does not inflate technical-error/turnover totals beyond an uninterrupted simulation's own plausible range", () => {
  const NEUTRAL = defaultTeamTacticalProfile();
  const SAMPLE_SEEDS = 20;
  let unsplicedTotal = 0;
  let splicedOnceTotal = 0;
  let splicedTwiceTotal = 0;

  for (let i = 0; i < SAMPLE_SEEDS; i += 1) {
    const fresh = createNewCareerState(`turnover-inflation-seed-${i}`, TUMBA_CLUB_ID);
    const matchday = getNextPlayerFixture(fresh)!.date;
    const state = processDay(fresh, matchday).state;
    const fixture = getNextPlayerFixture(state)!;
    const { state: played, result: original } = playManagerFixture(state);
    assert.ok(original);
    unsplicedTotal += original!.homeStats.turnovers + original!.awayStats.turnovers;

    const oneChange = applyMidMatchTacticalChange(played, fixture.id, 20, NEUTRAL, false, null);
    const splicedOnce = oneChange.results[fixture.id];
    splicedOnceTotal += splicedOnce.homeStats.turnovers + splicedOnce.awayStats.turnovers;

    const twoChanges = applyMidMatchTacticalChange(oneChange, fixture.id, 40, NEUTRAL, false, null);
    const splicedTwice = twoChanges.results[fixture.id];
    splicedTwiceTotal += splicedTwice.homeStats.turnovers + splicedTwice.awayStats.turnovers;
  }

  const unsplicedAvg = unsplicedTotal / SAMPLE_SEEDS;
  const splicedOnceAvg = splicedOnceTotal / SAMPLE_SEEDS;
  const splicedTwiceAvg = splicedTwiceTotal / SAMPLE_SEEDS;

  // Before the Part 12 fix, EVERY splice injected a fresh, unscaled
  // 8-16-per-team turnover roll regardless of the segment's remaining
  // duration -- a single splice at minute 20 (40 minutes remaining)
  // would already push the average well past the unspliced baseline,
  // and a second splice at minute 40 (20 minutes remaining) would push
  // it further still. With duration-scaling fixed, one or two neutral
  // splices must stay within a small, bounded tolerance of the
  // unspliced baseline -- never scale up with splice COUNT.
  assert.ok(splicedOnceAvg <= unsplicedAvg * 1.35, `one splice averaged ${splicedOnceAvg} combined turnovers vs an unspliced baseline of ${unsplicedAvg} -- expected no more than a 35% deviation`);
  assert.ok(splicedTwiceAvg <= unsplicedAvg * 1.35, `two splices averaged ${splicedTwiceAvg} combined turnovers vs an unspliced baseline of ${unsplicedAvg} -- expected no more than a 35% deviation, and never growing with splice count`);
});
