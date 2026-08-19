import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDoubleRoundRobin } from "./fixtures";
import { simulateSeason, simulateFixture } from "./season";
import { computeStandings } from "./table";
import type { ClubStrength } from "./types";

// Headless full-season regression -- the HM-GAME-0.2A hard gate. No UI,
// no career/save layer involved: exercises game-simulation end to end
// exactly the way apps/game's career layer will drive it.

const CLUB_IDS = Array.from({ length: 14 }, (_, i) => `club-${i + 1}`);
const TUMBA_ID = "club-1";
const SEED_PREFIX = "regression-save-seed";

function strengthFor(clubId: string): ClubStrength {
  // Deterministic but varied mock strengths, spread across the 14 clubs.
  const index = CLUB_IDS.indexOf(clubId);
  const base = 45 + ((index * 7) % 40);
  return { clubId, overall: base, attack: base, defense: base - 2, goalkeeper: base + 1, depth: base - 5 };
}

function fixtures() {
  return generateDoubleRoundRobin({
    competitionId: "swe-2",
    clubIds: CLUB_IDS,
    seasonStartDate: "2026-08-15",
  });
}

test("full headless season: 182 results, every team played 26", () => {
  const allFixtures = fixtures();
  const results = simulateSeason(allFixtures, SEED_PREFIX, strengthFor);
  assert.equal(results.length, 182);

  const playedCount = new Map<string, number>();
  for (const r of results) {
    playedCount.set(r.homeClubId, (playedCount.get(r.homeClubId) ?? 0) + 1);
    playedCount.set(r.awayClubId, (playedCount.get(r.awayClubId) ?? 0) + 1);
  }
  for (const clubId of CLUB_IDS) {
    assert.equal(playedCount.get(clubId), 26, `expected 26 played for ${clubId}`);
  }
});

test("full headless season: table is valid and totals are consistent", () => {
  const allFixtures = fixtures();
  const results = simulateSeason(allFixtures, SEED_PREFIX, strengthFor);
  const table = computeStandings(
    CLUB_IDS,
    results.map((r) => ({ homeClubId: r.homeClubId, awayClubId: r.awayClubId, homeGoals: r.homeGoals, awayGoals: r.awayGoals })),
  );

  assert.equal(table.length, 14);
  for (const row of table) {
    assert.equal(row.played, 26);
    assert.equal(row.won + row.drawn + row.lost, 26);
    assert.equal(row.goalDifference, row.goalsFor - row.goalsAgainst);
  }

  const totalPoints = table.reduce((sum, r) => sum + r.points, 0);
  // Every match awards exactly 2 points total (2-0 for a win/loss pair, or 1+1 for a draw).
  assert.equal(totalPoints, 182 * 2);
});

test("full headless season: total league goals are sensible and non-zero", () => {
  const allFixtures = fixtures();
  const results = simulateSeason(allFixtures, SEED_PREFIX, strengthFor);
  const totalGoals = results.reduce((sum, r) => sum + r.homeGoals + r.awayGoals, 0);
  assert.ok(totalGoals > 0);
  // 182 matches, each team totals plausibly 16-40 -> a sane season total sits well inside 182*32*2 +/- generous margin.
  const perMatchAverage = totalGoals / 182;
  assert.ok(perMatchAverage > 35 && perMatchAverage < 70, `average total goals per match implausible: ${perMatchAverage}`);
});

test("full headless season: Tumba's own results are internally coherent", () => {
  const allFixtures = fixtures();
  const results = simulateSeason(allFixtures, SEED_PREFIX, strengthFor);
  const tumbaResults = results.filter((r) => r.homeClubId === TUMBA_ID || r.awayClubId === TUMBA_ID);
  assert.equal(tumbaResults.length, 26);
  for (const r of tumbaResults) {
    assert.ok(r.homeGoals >= 16 && r.homeGoals <= 40);
    assert.ok(r.awayGoals >= 16 && r.awayGoals <= 40);
  }
});

test("season reaches a complete state: every generated fixture has exactly one result", () => {
  const allFixtures = fixtures();
  const results = simulateSeason(allFixtures, SEED_PREFIX, strengthFor);
  const resultFixtureIds = new Set(results.map((r) => r.fixtureId));
  assert.equal(resultFixtureIds.size, allFixtures.length, "expected exactly one result per fixture, no gaps or duplicates");
  for (const f of allFixtures) {
    assert.ok(resultFixtureIds.has(f.id), `missing result for fixture ${f.id}`);
  }
});

test("no duplicate simulation: re-simulating the same fixture twice yields an identical result", () => {
  const allFixtures = fixtures();
  const fixture = allFixtures[0];
  const first = simulateFixture(fixture, SEED_PREFIX, strengthFor);
  const second = simulateFixture(fixture, SEED_PREFIX, strengthFor);
  assert.deepEqual(first, second);
});

test("persisted/resumed season produces the same final state as an uninterrupted season", () => {
  const allFixtures = fixtures();

  // "Uninterrupted": simulate everything in one pass.
  const uninterrupted = simulateSeason(allFixtures, SEED_PREFIX, strengthFor);

  // "Persisted/resumed": simulate the first half, "save", then simulate
  // the second half separately (a fresh call, as a reload would trigger)
  // -- each fixture's seed depends only on its own id, never on what
  // else has already been simulated, so this must match exactly.
  const midpoint = Math.floor(allFixtures.length / 2);
  const firstHalf = simulateSeason(allFixtures.slice(0, midpoint), SEED_PREFIX, strengthFor);
  const secondHalf = simulateSeason(allFixtures.slice(midpoint), SEED_PREFIX, strengthFor);
  const resumed = [...firstHalf, ...secondHalf];

  assert.deepEqual(resumed, uninterrupted);
});
