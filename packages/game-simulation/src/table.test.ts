import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStandings, ALLSVENSKAN_POINTS_RULE, type CompletedResult } from "./table";

const CLUBS = ["a", "b", "c", "d"];

test("win/draw/loss points applied per the configured rule", () => {
  const results: CompletedResult[] = [
    { homeClubId: "a", awayClubId: "b", homeGoals: 30, awayGoals: 25 }, // a wins
    { homeClubId: "c", awayClubId: "d", homeGoals: 20, awayGoals: 20 }, // draw
  ];
  const table = computeStandings(CLUBS, results, ALLSVENSKAN_POINTS_RULE);
  const a = table.find((r) => r.clubId === "a")!;
  const b = table.find((r) => r.clubId === "b")!;
  const c = table.find((r) => r.clubId === "c")!;
  const d = table.find((r) => r.clubId === "d")!;

  assert.equal(a.points, 2);
  assert.equal(a.won, 1);
  assert.equal(b.points, 0);
  assert.equal(b.lost, 1);
  assert.equal(c.points, 1);
  assert.equal(c.drawn, 1);
  assert.equal(d.points, 1);
  assert.equal(d.drawn, 1);
});

test("GF/GA/GD computed correctly", () => {
  const results: CompletedResult[] = [{ homeClubId: "a", awayClubId: "b", homeGoals: 30, awayGoals: 25 }];
  const table = computeStandings(CLUBS, results);
  const a = table.find((r) => r.clubId === "a")!;
  const b = table.find((r) => r.clubId === "b")!;
  assert.equal(a.goalsFor, 30);
  assert.equal(a.goalsAgainst, 25);
  assert.equal(a.goalDifference, 5);
  assert.equal(b.goalsFor, 25);
  assert.equal(b.goalsAgainst, 30);
  assert.equal(b.goalDifference, -5);
});

test("ordering: points descending", () => {
  const results: CompletedResult[] = [
    { homeClubId: "a", awayClubId: "b", homeGoals: 30, awayGoals: 20 },
    { homeClubId: "a", awayClubId: "c", homeGoals: 30, awayGoals: 20 },
    { homeClubId: "d", awayClubId: "b", homeGoals: 25, awayGoals: 20 },
  ];
  const table = computeStandings(CLUBS, results);
  assert.equal(table[0].clubId, "a"); // 2 wins = 4 pts
  assert.equal(table[0].points, 4);
});

test("deterministic tiebreak: points -> goal difference -> goals scored -> clubId", () => {
  // a and b both finish 2 points, but a has a better goal difference.
  const results: CompletedResult[] = [
    { homeClubId: "a", awayClubId: "c", homeGoals: 35, awayGoals: 20 }, // GD +15
    { homeClubId: "b", awayClubId: "d", homeGoals: 22, awayGoals: 20 }, // GD +2
  ];
  const table = computeStandings(CLUBS, results);
  const aIndex = table.findIndex((r) => r.clubId === "a");
  const bIndex = table.findIndex((r) => r.clubId === "b");
  assert.ok(aIndex < bIndex, "a (better GD, same points) should rank above b");
});

test("tiebreak falls back to clubId when everything else is tied (fully deterministic)", () => {
  const table = computeStandings(CLUBS, []);
  // No results at all -- every row identical except clubId.
  assert.deepEqual(table.map((r) => r.clubId), ["a", "b", "c", "d"]);
});

test("totals across the table are consistent with the results (points/goals sum correctly)", () => {
  const results: CompletedResult[] = [
    { homeClubId: "a", awayClubId: "b", homeGoals: 28, awayGoals: 28 },
    { homeClubId: "c", awayClubId: "d", homeGoals: 33, awayGoals: 19 },
  ];
  const table = computeStandings(CLUBS, results);
  const totalGoals = table.reduce((sum, r) => sum + r.goalsFor, 0);
  const expectedTotal = results.reduce((sum, r) => sum + r.homeGoals + r.awayGoals, 0);
  assert.equal(totalGoals, expectedTotal);
  const totalPlayed = table.reduce((sum, r) => sum + r.played, 0);
  assert.equal(totalPlayed, results.length * 2);
});

test("recomputing from the same result set twice produces the same table (no double-counting when called repeatedly)", () => {
  const results: CompletedResult[] = [{ homeClubId: "a", awayClubId: "b", homeGoals: 27, awayGoals: 24 }];
  const first = computeStandings(CLUBS, results);
  const second = computeStandings(CLUBS, results);
  assert.deepEqual(first, second);
});
