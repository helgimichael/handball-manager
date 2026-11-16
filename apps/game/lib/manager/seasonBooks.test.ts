// Arena Nights MGR-02 / MGR-02a: season book covers from archived seasons only.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ManagerCareerState } from "../board/types";
import { bestAndWorst, buildSeasonBook, type BookMatch, type SeasonHistoryEntry } from "./seasonBooks";

const row = (clubId: string, points: number) => ({ clubId, played: 26, won: points / 2, drawn: 0, lost: 26 - points / 2, goalsFor: 700, goalsAgainst: 690, goalDifference: 10, points });
const fx = (id: string, home: string, away: string, date: string) => ({ id, competitionId: "swe-2", round: 1, date, homeClubId: home, awayClubId: away, type: "LEAGUE" as const });
const res = (id: string, home: string, away: string, hg: number, ag: number) => ({ fixtureId: id, seed: 1, homeClubId: home, awayClubId: away, homeGoals: hg, awayGoals: ag });

const entry = {
  seasonId: "2026/27", competitionId: "swe-2",
  table: [row("x", 40), row("me", 38)],
  tables: { "swe-2": [row("x", 40), row("me", 38)] },
  stats: { p1: { playerId: "p1", appearances: 26, starts: 26, goals: 150, shots: 220, saves: 0, shotsFaced: 0, ratingSum: 180 }, p2: { playerId: "p2", appearances: 20, starts: 10, goals: 40, shots: 70, saves: 0, shotsFaced: 0, ratingSum: 120 } },
  fixtures: [fx("f1", "me", "x", "2026-09-01"), fx("f2", "x", "me", "2027-02-01"), fx("f3", "me", "y", "2027-03-01")],
  results: { f1: res("f1", "me", "x", 34, 25), f2: res("f2", "x", "me", 33, 24), f3: res("f3", "me", "y", 30, 29) },
  outcome: { seasonId: "2026/27", phase: "COMPLETE", bothTiersSimulated: true, regularSeasonWinners: { "swe-2": "x" }, nextMembership: {}, promoted: ["x", "me"], relegated: [], awards: [], announced: [] },
} as unknown as SeasonHistoryEntry;

const mc = {
  reputation: 40, contract: {}, vacancies: [], applications: {}, offers: {}, milestones: [],
  stints: [{ clubId: "me", from: "2026-07-01", seasons: [{ seasonId: "2026/27", competitionId: "swe-2", position: 2, objectivesScore: 0.9, honours: [] }] }],
  reputationLog: [{ date: "2027-05-30", delta: 8, after: 40, reason: "Uppflyttning" }, { date: "2028-05-30", delta: 3, after: 43, reason: "Nästa år" }],
} as unknown as ManagerCareerState;

test("cover facts: position, honours, top scorer, best/worst match, board, reputation", () => {
  const b = buildSeasonBook(entry, mc, "other");
  assert.equal(b.clubId, "me");
  assert.equal(b.position, 2);
  assert.equal(b.points, 38);
  assert.deepEqual(b.honours, ["Uppflyttning"]);
  assert.equal(b.star, true);
  assert.deepEqual(b.topScorer, { playerId: "p1", goals: 150 });
  assert.equal(b.bestMatch!.fixtureId, "f1");
  assert.equal(b.worstMatch!.fixtureId, "f2");
  assert.equal(b.boardScore, 0.9);
  assert.equal(b.reputationDelta, 8, "only the season's own window");
});

test("best and worst are null without wins or losses", () => {
  const draw: BookMatch = { fixtureId: "d", opponentId: "x", home: true, goalsFor: 20, goalsAgainst: 20, date: "2027-01-01", type: "LEAGUE" };
  assert.deepEqual(bestAndWorst([draw]), { best: null, worst: null });
});
