import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture, getPlayerFixtureOn } from "./calendar";
import { processDay } from "./dailyTick";
import { playManagerFixture } from "./matchdayAction";
import { TUMBA_CLUB_ID } from "../game-data";
import { continueCareerRhythm } from "./continueController";
import { snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import type { CareerState } from "./types";

// HM-CAREER-0.5: round 1's fixtures are now deterministically spread
// across a few nearby days (game-simulation's fixtures.ts) -- the
// manager's own matchday is no longer guaranteed to fall exactly on the
// season's start date, so it's looked up per fresh state via
// getNextPlayerFixture rather than assumed.
function stateAtMatchday(seed = "matchday-action-seed") {
  const fresh = createNewCareerState(seed, TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  return processDay(fresh, matchday).state;
}

/**
 * HM-MATCH-0.2: opponent player attribution only has real squad data to
 * draw on for a REAL_WORLD-backed competition (Handbollsligan) -- IFK
 * Tumba's own Allsvenskan opponents have no static squad data at all
 * (getCareerClubSquad falls back to []), same limitation AI-vs-AI
 * fixtures already had (see this milestone's audit). Mirrors the
 * existing real-club integration pattern from inboxIntegration.test.ts.
 */
function stateAtRealClubMatchday(seed: string): CareerState {
  const clubId = "se_club_alingsas_hk";
  const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
  const fresh = createNewCareerState(seed, clubId, worldSquads);
  let current = fresh;
  for (let i = 0; i < 100; i += 1) {
    const { state: next, stopReason } = continueCareerRhythm(current);
    current = next;
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") return current;
  }
  throw new Error("never reached an ACTION_REQUIRED stop");
}

test("playManagerFixture resolves the manager's own fixture, resolves MATCHDAY_READY, and creates MATCH_COMPLETED", () => {
  const state = stateAtMatchday();
  const fixture = getNextPlayerFixture(state)!;

  const { state: next, result } = playManagerFixture(state);
  assert.ok(result);
  assert.equal(result!.fixtureId, fixture.id);
  assert.ok(next.results[fixture.id]);

  const matchdayEvent = next.careerEvents.find((e) => e.type === "MATCHDAY_READY");
  assert.ok(matchdayEvent);
  assert.equal(matchdayEvent!.resolved, true);
  assert.equal(matchdayEvent!.read, true);

  const completedEvent = next.careerEvents.find((e) => e.type === "MATCH_COMPLETED");
  assert.ok(completedEvent);
  assert.equal(completedEvent!.primaryEntity?.entityId, fixture.id);
  assert.ok(next.inbox.some((m) => m.careerEventId === completedEvent!.id));

  // The original MATCHDAY_READY inbox message must also stop showing its
  // action-required badge once resolved -- not only the domain event.
  const matchdayMessage = next.inbox.find((m) => m.careerEventId === matchdayEvent!.id);
  assert.ok(matchdayMessage);
  assert.equal(matchdayMessage!.actionRequired, false);
  assert.equal(matchdayMessage!.read, true);
});

test("playManagerFixture updates club form and IFK Tumba's own player season stats", () => {
  const state = stateAtMatchday();
  const fixture = getNextPlayerFixture(state)!;
  const { state: next } = playManagerFixture(state);

  assert.ok(next.clubForm[fixture.homeClubId]?.length);
  assert.ok(next.clubForm[fixture.awayClubId]?.length);
  assert.ok(Object.keys(next.playerSeasonStats).length > 0);
});

test("playManagerFixture is a safe no-op when there is no unplayed manager fixture for the current date", () => {
  const fresh = createNewCareerState("matchday-action-seed-2", TUMBA_CLUB_ID);
  // gameDate here is the pre-season default with no processed matchday.
  const { state, result } = playManagerFixture(fresh);
  assert.equal(result, null);
  assert.equal(state, fresh);
});

test("HM-MATCH-0.1: Live Match and Instant Result use the identical pre-generated result (both paths call playManagerFixture once, nothing path-dependent)", () => {
  // Both match-preview buttons (SPELA MATCH -> live match-day screen,
  // SNABBRESULTAT -> straight to match-report) call this exact same
  // function; simulate both starting from the identical pre-matchday
  // state to prove there is no hidden path-dependent randomness.
  const liveState = stateAtMatchday();
  const instantState = stateAtMatchday();
  assert.deepEqual(liveState, instantState, "both paths must start from the identical pre-matchday state");

  const live = playManagerFixture(liveState);
  const instant = playManagerFixture(instantState);
  assert.deepEqual(live.result, instant.result, "Live Match and Instant Result must reveal the same FastMatchResult");
  assert.deepEqual(live.state.results, instant.state.results);
});

test("playManagerFixture never re-simulates an already-played fixture (idempotent)", () => {
  const state = stateAtMatchday();
  const fixture = getNextPlayerFixture(state)!;
  const first = playManagerFixture(state);
  assert.ok(first.result);

  const second = playManagerFixture(first.state);
  assert.equal(second.result, null, "the fixture is already resolved -- nothing left to simulate");
  const completedEvents = second.state.careerEvents.filter((e) => e.type === "MATCH_COMPLETED" && e.primaryEntity?.entityId === fixture.id);
  assert.equal(completedEvents.length, 1, "MATCH_COMPLETED must not duplicate");
});

test("HM-TACTICS-0.6B: changing the manager's TeamTacticalProfile before playing a fixture directionally shifts the manager's own goals across several seeded fixtures (never a claim of realistic percentages)", () => {
  const SAMPLE_SEEDS = 15;
  let lowGoalsTotal = 0;
  let highGoalsTotal = 0;

  for (let i = 0; i < SAMPLE_SEEDS; i += 1) {
    const seed = `tactical-directional-${i}`;
    const lowState = { ...stateAtMatchday(seed), tacticalProfile: { ati001UsageTendency: "LOW" as const, h2ResponsePreference: "H2_STEPS" as const, tacticalFamiliarity: "MEDIUM" as const } };
    const highState = { ...stateAtMatchday(seed), tacticalProfile: { ati001UsageTendency: "HIGH" as const, h2ResponsePreference: "H2_STEPS" as const, tacticalFamiliarity: "MEDIUM" as const } };

    const fixture = getNextPlayerFixture(lowState)!;
    const isHome = fixture.homeClubId === TUMBA_CLUB_ID;

    const lowResult = playManagerFixture(lowState).result!;
    const highResult = playManagerFixture(highState).result!;

    lowGoalsTotal += isHome ? lowResult.homeGoals : lowResult.awayGoals;
    highGoalsTotal += isHome ? highResult.homeGoals : highResult.awayGoals;
  }

  assert.ok(
    highGoalsTotal / SAMPLE_SEEDS > lowGoalsTotal / SAMPLE_SEEDS,
    `HIGH ati001UsageTendency must average more manager goals than LOW across ${SAMPLE_SEEDS} seeded fixtures (low avg=${lowGoalsTotal / SAMPLE_SEEDS}, high avg=${highGoalsTotal / SAMPLE_SEEDS})`,
  );
});

test("HM-TACTICS-0.6B: the same (save, fixture, tactical profile) always replays to the identical FastMatchResult", () => {
  const state = stateAtMatchday("tactical-determinism-seed");
  const a = playManagerFixture(state).result;
  const b = playManagerFixture(state).result;
  assert.deepEqual(a, b);
});

test("HM-MATCH-0.2: the manager's own fixture attributes real player goals/contributions to BOTH sides, not just the manager's club (REAL_WORLD-backed competition)", () => {
  const SAMPLE_SEEDS = 10;
  let sawOpponentGoalScorer = false;

  for (let i = 0; i < SAMPLE_SEEDS && !sawOpponentGoalScorer; i += 1) {
    const state = stateAtRealClubMatchday(`opponent-attribution-seed-${i}`);
    const fixture = getPlayerFixtureOn(state, state.gameDate)!;
    const { result } = playManagerFixture(state);
    const opponentIsHome = fixture.homeClubId !== "se_club_alingsas_hk";
    const opponentContributions = opponentIsHome ? result!.homePlayerContributions : result!.awayPlayerContributions;
    const opponentGoalEvents = result!.events.filter((e) => e.type === "GOAL" && e.side === (opponentIsHome ? "home" : "away"));

    assert.ok(opponentContributions.length > 0, "the opponent must have a non-empty roster of player contributions");
    if (opponentGoalEvents.length > 0 && opponentGoalEvents.some((e) => e.playerId)) {
      sawOpponentGoalScorer = true;
    }
  }

  assert.ok(sawOpponentGoalScorer, `expected at least one of ${SAMPLE_SEEDS} seeded fixtures to attribute a real opponent scorer to a GOAL event`);
});

test("HM-MATCH-0.2: opponent player goal totals reconcile exactly with the opponent's own team goal total (REAL_WORLD-backed competition)", () => {
  const state = stateAtRealClubMatchday("opponent-reconciliation-seed");
  const fixture = getPlayerFixtureOn(state, state.gameDate)!;
  const { result } = playManagerFixture(state);
  const opponentIsHome = fixture.homeClubId !== "se_club_alingsas_hk";
  const opponentContributions = opponentIsHome ? result!.homePlayerContributions : result!.awayPlayerContributions;
  const opponentTeamGoals = opponentIsHome ? result!.homeGoals : result!.awayGoals;
  const summedPlayerGoals = opponentContributions.reduce((sum, c) => sum + c.goals, 0);
  assert.equal(summedPlayerGoals, opponentTeamGoals);
});

test("HM-MATCH-0.2: opponent player attribution is honestly empty (not fabricated) for a mock, non-REAL_WORLD-backed opponent club -- e.g. IFK Tumba's own Allsvenskan opponents", () => {
  const state = stateAtMatchday("mock-opponent-no-attribution-seed");
  const { result } = playManagerFixture(state);
  const opponentIsHome = result!.homeClubId !== TUMBA_CLUB_ID;
  const opponentContributions = opponentIsHome ? result!.homePlayerContributions : result!.awayPlayerContributions;
  assert.deepEqual(opponentContributions, [], "no squad data exists for this opponent -- the honest result is an empty array, never an invented one");
});

test("HM-TACTICS-0.6B: AI-vs-AI fixtures on the same matchday are completely unaffected by the manager's TeamTacticalProfile", () => {
  const seed = "tactical-ai-unaffected-seed";
  const defaultProfileState = createNewCareerState(seed, TUMBA_CLUB_ID);
  const customProfileState = {
    ...defaultProfileState,
    tacticalProfile: { ati001UsageTendency: "HIGH" as const, h2ResponsePreference: "H2_STOPS" as const, tacticalFamiliarity: "HIGH" as const },
  };

  const matchday = getNextPlayerFixture(defaultProfileState)!.date;
  const defaultTickResult = processDay(defaultProfileState, matchday).state;
  const customTickResult = processDay(customProfileState, matchday).state;

  const aiFixtureIds = Object.keys(defaultTickResult.results).filter(
    (id) => defaultTickResult.results[id].homeClubId !== TUMBA_CLUB_ID && defaultTickResult.results[id].awayClubId !== TUMBA_CLUB_ID,
  );
  assert.ok(aiFixtureIds.length > 0, "at least one AI-vs-AI fixture must be due on the manager's own matchday for this seed");
  for (const id of aiFixtureIds) {
    assert.deepEqual(customTickResult.results[id], defaultTickResult.results[id], `AI fixture ${id} must be byte-identical regardless of the manager's tactical profile`);
  }
});
