// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture } from "./calendar";
import { processDay } from "./dailyTick";
import { playManagerFixtureLegacy as playManagerFixture } from "./legacy/matchday";
import { getLiveStandings, getLiveTableStandings } from "./standings";
import { TUMBA_CLUB_ID } from "../game-data";

// HM-CAREER-0.5: the manager's own matchday is no longer guaranteed to
// fall exactly on the season's start date (fixtures.ts now spreads round
// 1 across a few nearby days), so it's looked up per fresh state.
function stateAfterMatchday(seed = "standings-seed") {
  const fresh = createNewCareerState(seed, TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  const atMatchday = processDay(fresh, matchday).state;
  const fixture = getNextPlayerFixture(atMatchday)!;
  const { state } = playManagerFixture(atMatchday);
  return { state, fixture };
}

test("getLiveTableStandings with the watched fixture's own final score reproduces getLiveStandings exactly", () => {
  const { state, fixture } = stateAfterMatchday();
  const result = state.results[fixture.id];
  const officialTable = getLiveStandings(state);
  const liveTable = getLiveTableStandings(state, fixture.id, result.homeGoals, result.awayGoals);
  assert.deepEqual(liveTable, officialTable);
});

test("getLiveTableStandings substitutes ONLY the watched fixture's score, never any other fixture's already-final result", () => {
  const { state, fixture } = stateAfterMatchday();
  const result = state.results[fixture.id];

  // Simulate "we're only 10 minutes in": a provisional score different from the final one.
  const provisionalHome = 0;
  const provisionalAway = 0;
  const liveTable = getLiveTableStandings(state, fixture.id, provisionalHome, provisionalAway);

  const home = liveTable.find((r) => r.clubId === fixture.homeClubId)!;
  const away = liveTable.find((r) => r.clubId === fixture.awayClubId)!;
  assert.equal(home.goalsFor, provisionalHome);
  assert.equal(away.goalsFor, provisionalAway);

  // Sanity: the official (non-live) table still reflects the real final score.
  const officialTable = getLiveStandings(state);
  const officialHome = officialTable.find((r) => r.clubId === fixture.homeClubId)!;
  assert.equal(officialHome.goalsFor, result.homeGoals);
});

test("getLiveTableStandings never mutates CareerState -- state.results is unchanged after the call", () => {
  const { state, fixture } = stateAfterMatchday();
  const before = JSON.stringify(state.results);
  getLiveTableStandings(state, fixture.id, 99, 0);
  assert.equal(JSON.stringify(state.results), before);
});

test("getLiveTableStandings is deterministic: identical inputs always produce an identical table", () => {
  const { state, fixture } = stateAfterMatchday();
  const a = getLiveTableStandings(state, fixture.id, 3, 1);
  const b = getLiveTableStandings(state, fixture.id, 3, 1);
  assert.deepEqual(a, b);
});
