// HM-CAREER-0.5: calendar.ts had no direct test file despite being the
// module that determines World Rhythm behavior (which fixtures resolve
// on which day). These tests target that module directly, complementing
// the higher-level coverage already in dailyTick.test.ts/continueController.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture, getPlayerFixtureOn, simulateAiFixturesForDate } from "./calendar";
import { processDay } from "./dailyTick";
import { getLiveStandings } from "./standings";
import { TUMBA_CLUB_ID } from "../game-data";

function freshState(seed = "calendar-seed") {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
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
