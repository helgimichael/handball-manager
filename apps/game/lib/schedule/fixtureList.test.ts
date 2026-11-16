// Arena Nights 231 -- WLD-06 list view / WLD-06b chips / WLD-06a pre-season board.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CareerState } from "../career/types";
import { filterRows, fixtureRows, groupByMonth, parseTypes, parseWhen, preseasonBoard, typeCounts } from "./fixtureList";

function career(extra: Partial<CareerState> = {}): CareerState {
  const fx = (id: string, date: string, home: string, away: string, type = "LEAGUE") => ({ id, competitionId: "c", round: 1, date, homeClubId: home, awayClubId: away, type });
  return {
    playerClubId: "me", gameDate: "2026-02-01", leagueKickoffDate: "2026-09-01",
    fixtures: [fx("a", "2026-01-10", "me", "x"), fx("b", "2026-01-20", "y", "me", "CUP"), fx("c", "2026-02-10", "me", "z"), fx("d", "2026-03-05", "z", "me", "FRIENDLY"), fx("e", "2026-02-11", "x", "y")],
    results: { a: { homeGoals: 30, awayGoals: 25 }, b: { homeGoals: 28, awayGoals: 28 } },
    ...extra,
  } as unknown as CareerState;
}

test("rows: only own fixtures, outcome from our side, next fixture pinned and clickable", () => {
  const rows = fixtureRows(career());
  assert.deepEqual(rows.map((r) => r.fixture.id), ["a", "b", "c", "d"]);
  assert.equal(rows[0]!.outcome, "W"); assert.equal(rows[1]!.outcome, "D");
  assert.equal(rows[1]!.home, false); assert.equal(rows[1]!.opponentId, "y");
  assert.equal(rows.find((r) => r.isNext)?.fixture.id, "c");
  assert.deepEqual(rows.filter((r) => r.clickable).map((r) => r.fixture.id), ["a", "b", "c"], "a later fixture never opens the next match's preview");
});

test("chips: time AND competition, counts per competition under the time chip, URL parsing", () => {
  const rows = fixtureRows(career());
  assert.deepEqual(filterRows(rows, "RESULTS", []).map((r) => r.fixture.id), ["a", "b"]);
  assert.deepEqual(filterRows(rows, "ALL", ["CUP", "FRIENDLY"]).map((r) => r.fixture.id), ["b", "d"]);
  assert.deepEqual(filterRows(rows, "UPCOMING", ["LEAGUE"]).map((r) => r.fixture.id), ["c"]);
  const counts = typeCounts(rows, "UPCOMING");
  assert.equal(counts.LEAGUE, 1); assert.equal(counts.FRIENDLY, 1); assert.equal(counts.CUP, 0);
  assert.equal(parseWhen("RESULTS"), "RESULTS"); assert.equal(parseWhen("nope"), "ALL");
  assert.deepEqual(parseTypes("cup,bogus,league"), ["LEAGUE", "CUP"]);
  assert.deepEqual(groupByMonth(rows).map((g) => [g.month, g.rows.length]), [["2026-01", 2], ["2026-02", 1], ["2026-03", 1]]);
});

test("pre-season board: from today to the day before kickoff, booked days are not free, empty once the league has started", () => {
  const s = career({ gameDate: "2026-08-12", leagueKickoffDate: "2026-08-26", preseasonEvents: [{ id: "camp", kind: "CAMP", name: "Läger", location: "Bosön", startDate: "2026-08-14", endDate: "2026-08-15", costEur: 1 }], fixtures: [{ id: "f", competitionId: "c", round: 0, date: "2026-08-18", homeClubId: "me", awayClubId: "x", type: "FRIENDLY" }] } as Partial<CareerState>);
  const weeks = preseasonBoard(s);
  const days = weeks.flatMap((w) => w.days);
  assert.equal(days[0]!.date, "2026-08-12");
  assert.equal(days.at(-1)!.date, "2026-08-25");
  assert.ok(weeks.every((w) => new Date(`${w.weekStart}T00:00:00Z`).getUTCDay() === 1), "weeks start on Monday");
  assert.equal(days.find((d) => d.date === "2026-08-14")!.free, false);
  assert.equal(days.find((d) => d.date === "2026-08-18")!.fixtures.length, 1);
  assert.equal(days.find((d) => d.date === "2026-08-13")!.free, true);
  assert.deepEqual(preseasonBoard({ ...s, gameDate: "2026-08-26" } as CareerState), []);
});
