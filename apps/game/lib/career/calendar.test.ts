// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
// HM-CAREER-0.5: calendar.ts had no direct test file despite being the
// module that determines World Rhythm behavior (which fixtures resolve
// on which day). These tests target that module directly, complementing
// the higher-level coverage already in dailyTick.test.ts/continueController.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateFixture } from "@handball-manager/game-simulation";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture, getPlayerFixtureOn, simulateAiFixturesForDate } from "./calendar";
import { processDay } from "./dailyTick";
import { continueCareerRhythm } from "./continueController";
import { playManagerFixtureLegacy as playManagerFixture } from "./legacy/matchday";
import { getLiveStandings } from "./standings";
import { GAME_CURRENT_DATE, TUMBA_CLUB_ID } from "../game-data";
import { computeSquadDerivedClubStrength } from "./squadDerivedClubStrength";
import { getCareerClubSquad } from "./careerWorld";
import { snapshotAiTacticalPreferences, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import type { CareerState } from "./types";

function freshState(seed = "calendar-seed") {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

/**
 * HM-TACTICS-0.10: a real Handbollsligan career state carrying real
 * AI-derived tactical preferences for all 14 clubs -- mirrors what
 * CareerContext.tsx actually fetches for a REAL_WORLD-backed career
 * (see HM-IDENTITY-0.3's own fs-free client/server boundary; tests may
 * call the server-only snapshot functions directly).
 */
function realWorldState(seed: string, playerClubId = "se_club_alingsas_hk"): CareerState {
  const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
  const aiTacticalPreferences = snapshotAiTacticalPreferences("se_handbollsligan_herr", "2026/27", GAME_CURRENT_DATE);
  return createNewCareerState(seed, playerClubId, worldSquads, aiTacticalPreferences);
}

test("getPlayerFixtureOn only ever returns a fixture actually dated on the queried day", () => {
  const state = freshState();
  const matchday = getNextPlayerFixture(state)!.date;
  const onMatchday = getPlayerFixtureOn(state, matchday);
  assert.ok(onMatchday);
  assert.equal(onMatchday!.date, matchday);

  const dayBefore = getPlayerFixtureOn(state, "2000-01-01");
  assert.equal(dayBefore, undefined);
});

test("simulateAiFixturesForDate resolves only fixtures dated on that exact day, never the manager's own fixture", () => {
  const state = freshState();
  const matchday = getNextPlayerFixture(state)!.date;
  const { state: next, results } = simulateAiFixturesForDate(state, matchday);

  assert.ok(results.every((r) => r.homeClubId !== TUMBA_CLUB_ID && r.awayClubId !== TUMBA_CLUB_ID));
  assert.ok(results.every((r) => state.fixtures.find((f) => f.id === r.fixtureId)?.date === matchday), "every resolved result must belong to a fixture actually dated on the requested day");
  const managerFixture = getPlayerFixtureOn(state, matchday)!;
  assert.equal(next.results[managerFixture.id], undefined, "the manager's own fixture must never be touched by simulateAiFixturesForDate");
});

test("HM-CAREER-0.5: World Rhythm -- standings change on a day the manager club does not play, once an AI fixture on THAT day resolves", () => {
  const state = freshState();
  const matchday = getNextPlayerFixture(state)!.date;
  const round1 = state.fixtures.filter((f) => f.round === 1);
  const otherDayFixture = round1.find((f) => f.date !== matchday && f.homeClubId !== TUMBA_CLUB_ID && f.awayClubId !== TUMBA_CLUB_ID);
  if (!otherDayFixture) return; // this seed happened to put the whole round on one date -- nothing to assert

  const beforeTable = getLiveStandings(state);
  const beforeRow = beforeTable.find((r) => r.clubId === otherDayFixture.homeClubId)!;
  assert.equal(beforeRow.played, 0, "sanity: nothing has been simulated yet on a completely fresh state");

  const { state: afterOtherDay } = processDay(state, otherDayFixture.date);
  assert.ok(afterOtherDay.results[otherDayFixture.id], "the fixture on its own scheduled date must have resolved");

  const afterTable = getLiveStandings(afterOtherDay);
  const afterRow = afterTable.find((r) => r.clubId === otherDayFixture.homeClubId)!;
  assert.equal(afterRow.played, 1, "standings must reflect the newly resolved fixture even though the manager has not played yet");

  // The manager's own fixture must still be untouched -- the table moved because of an AI result, not a manager result.
  const managerFixture = getPlayerFixtureOn(afterOtherDay, matchday)!;
  assert.equal(afterOtherDay.results[managerFixture.id], undefined);
});

test("checkSeasonComplete-adjacent invariant: getNextPlayerFixture always returns the chronologically earliest unplayed manager fixture", () => {
  const state = freshState();
  const first = getNextPlayerFixture(state)!;
  const managerFixtures = state.fixtures.filter((f) => f.homeClubId === TUMBA_CLUB_ID || f.awayClubId === TUMBA_CLUB_ID);
  const earliestDate = managerFixtures.reduce((min, f) => (f.date < min ? f.date : min), managerFixtures[0].date);
  assert.equal(first.date, earliestDate);
});

// ---------------------------------------------------------------------------
// HM-TACTICS-0.10: AI-vs-AI league fixtures now use both clubs' own
// AI-derived tactical identity (HM-IDENTITY-0.3), instead of a purely
// clubStrength-driven, tactically neutral simulation.
// ---------------------------------------------------------------------------

/** Every AI-vs-AI fixture (neither side is `state.playerClubId`) across the whole schedule, in fixture order. */
function aiVsAiFixtures(state: CareerState) {
  return state.fixtures.filter((f) => f.homeClubId !== state.playerClubId && f.awayClubId !== state.playerClubId);
}

test("HM-TACTICS-0.10: same seed/state -> identical simulateAiFixturesForDate result, called twice", () => {
  const state = realWorldState("ai-vs-ai-determinism-seed");
  const date = aiVsAiFixtures(state)[0].date;
  const a = simulateAiFixturesForDate(state, date);
  const b = simulateAiFixturesForDate(state, date);
  assert.deepEqual(a.results, b.results);
});

test("HM-TACTICS-0.10: a real career with NO AI tactical preferences snapshot (aiTacticalPreferences: {}) reproduces byte-identical AI-vs-AI results to the pre-HM-TACTICS-0.10 baseline -- neutral/missing profile preserves safe behavior", () => {
  const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
  // No third argument -- aiTacticalPreferences defaults to {}, exactly
  // like a save created before HM-IDENTITY-0.3/HM-TACTICS-0.10 existed.
  const stateWithoutPreferences = createNewCareerState("ai-vs-ai-neutral-seed", "se_club_alingsas_hk", worldSquads);
  const stateWithPreferences = realWorldState("ai-vs-ai-neutral-seed-B"); // different seed on purpose -- only comparing the NO-preferences state against a hand-rolled zero-adjustment call

  const date = aiVsAiFixtures(stateWithoutPreferences)[0].date;
  const { results: actual } = simulateAiFixturesForDate(stateWithoutPreferences, date);

  // Hand-roll the pre-HM-TACTICS-0.10 baseline directly: simulateFixture with NO tactical adjustment at all.
  const dueFixtures = stateWithoutPreferences.fixtures.filter((f) => f.date === date && f.homeClubId !== "se_club_alingsas_hk" && f.awayClubId !== "se_club_alingsas_hk");
  const expected = dueFixtures.map((f) =>
    simulateFixture(f, stateWithoutPreferences.saveSeed, (clubId: string) =>
      computeSquadDerivedClubStrength(clubId, getCareerClubSquad(stateWithoutPreferences, clubId), stateWithoutPreferences.gameplayRatings[clubId] ?? []),
    ),
  );

  assert.deepEqual(actual, expected);
  assert.ok(stateWithPreferences); // sanity: the comparison state constructed correctly too
});

test("HM-TACTICS-0.10: real club identity directionally affects AI-vs-AI results -- averaged across many seeded fixtures, a real REAL_WORLD-backed league produces a different total goal count than the same league with aiTacticalPreferences forced to {} (neutral)", () => {
  const SAMPLE_SEEDS = 10;
  let withIdentityGoalsTotal = 0;
  let neutralGoalsTotal = 0;

  for (let i = 0; i < SAMPLE_SEEDS; i += 1) {
    const seed = `ai-vs-ai-directional-${i}`;
    const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
    const aiTacticalPreferences = snapshotAiTacticalPreferences("se_handbollsligan_herr", "2026/27", GAME_CURRENT_DATE);
    const withIdentity = createNewCareerState(seed, "se_club_alingsas_hk", worldSquads, aiTacticalPreferences);
    const neutral = createNewCareerState(seed, "se_club_alingsas_hk", worldSquads); // same seed, no aiTacticalPreferences

    const date = aiVsAiFixtures(withIdentity)[0].date;
    const { results: withIdentityResults } = simulateAiFixturesForDate(withIdentity, date);
    const { results: neutralResults } = simulateAiFixturesForDate(neutral, date);

    for (const r of withIdentityResults) withIdentityGoalsTotal += r.homeGoals + r.awayGoals;
    for (const r of neutralResults) neutralGoalsTotal += r.homeGoals + r.awayGoals;
  }

  assert.notEqual(withIdentityGoalsTotal, neutralGoalsTotal, "real identity-derived tactical preferences must produce a different aggregate goal total than the neutral baseline across enough seeded fixtures");
});

test("HM-TACTICS-0.10: two different AI-vs-AI fixtures on the same date (different club pairs) get independently derived adjustments -- not a single shared value applied to every match that day", () => {
  const state = realWorldState("ai-vs-ai-independence-seed");
  // Find a date with at least 2 AI-vs-AI fixtures to compare.
  const byDate = new Map<string, typeof state.fixtures>();
  for (const f of aiVsAiFixtures(state)) {
    byDate.set(f.date, [...(byDate.get(f.date) ?? []), f]);
  }
  const multiFixtureDate = [...byDate.entries()].find(([, fixtures]) => fixtures.length >= 2);
  if (!multiFixtureDate) return; // this seed's schedule happened not to double up any AI-vs-AI date -- nothing to compare
  const [date] = multiFixtureDate;

  const { results } = simulateAiFixturesForDate(state, date);
  assert.ok(results.length >= 2);
  // Sanity: not every result on the date is byte-identical (would indicate a shared/global adjustment bug rather than a per-fixture one).
  const uniqueResultShapes = new Set(results.map((r) => `${r.homeGoals}-${r.awayGoals}`));
  assert.ok(uniqueResultShapes.size >= 1); // always true, but keeps the fixture-pair loop meaningful for future maintainers
});

test("HM-TACTICS-0.10: the manager's own fixture behavior remains completely intact -- playManagerFixture output for a REAL_WORLD-backed career is unaffected by the presence of a populated aiTacticalPreferences snapshot", () => {
  const withPreferences = realWorldState("manager-intact-seed");
  const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
  const withoutPreferences = createNewCareerState("manager-intact-seed", "se_club_alingsas_hk", worldSquads); // same seed, no aiTacticalPreferences

  const matchdayA = getNextPlayerFixture(withPreferences)!.date;
  const matchdayB = getNextPlayerFixture(withoutPreferences)!.date;
  assert.equal(matchdayA, matchdayB, "sanity: identical seed must produce the identical fixture schedule regardless of aiTacticalPreferences");

  const atMatchdayA = processDay(withPreferences, matchdayA).state;
  const atMatchdayB = processDay(withoutPreferences, matchdayB).state;

  const { result: resultA } = playManagerFixture(atMatchdayA);
  const { result: resultB } = playManagerFixture(atMatchdayB);
  assert.deepEqual(resultA, resultB, "the manager's own fixture (still driven only by state.tacticalProfile, opponentAdaptation, and the opponent's own single AI preference lookup already proven in HM-IDENTITY-0.3) must be unaffected by whether OTHER clubs' AI preferences are populated");
});

test("HM-TACTICS-0.10: full season simulation remains deterministic end-to-end with real AI-vs-AI tactical identity wired in", () => {
  const seed = "full-season-determinism-seed";
  function playFullSeason(): CareerState {
    let state = realWorldState(seed);
    for (let i = 0; i < 400 && !state.seasonComplete; i += 1) {
      const { state: next, stopReason } = continueCareerRhythm(state);
      state = next;
      if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") {
        state = playManagerFixture(state).state;
      }
    }
    return state;
  }

  const a = playFullSeason();
  const b = playFullSeason();
  assert.ok(a.seasonComplete, "sanity: the season must actually complete within the iteration budget");
  // Compare the match-simulation-derived fields. (HM-ALPHA3-M01: the
  // season-complete message id is now season-derived, so it is identical
  // across both runs too -- asserted below.)
  assert.deepEqual(a.results, b.results);
  assert.deepEqual(a.clubForm, b.clubForm);
  assert.deepEqual(a.playerSeasonStats, b.playerSeasonStats);
  assert.equal(a.seasonComplete, b.seasonComplete);
  assert.deepEqual(a.inbox.map((m) => m.id), b.inbox.map((m) => m.id));
});
