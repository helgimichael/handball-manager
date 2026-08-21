import { test } from "node:test";
import assert from "node:assert/strict";
import type { TeamMatchStats } from "@handball-manager/game-simulation";
import type { ClubMatchStatRow } from "./types";
import { computeAllPatterns, concededTrend, goalkeeperOutput, recentScoringVsSeason, scoringConsistency, turnoverFrequency } from "./patterns";

function stats(overrides: Partial<TeamMatchStats> = {}): TeamMatchStats {
  return { goals: 0, shots: 0, shootingPct: 0, saves: 0, shotsFaced: 0, turnovers: 0, twoMinuteSuspensions: 0, sevenMetreGoals: 0, sevenMetreAttempts: 0, ...overrides };
}

function row(i: number, overrides: Partial<ClubMatchStatRow> = {}): ClubMatchStatRow {
  return {
    fixtureId: `f${i}`,
    date: `2026-08-${10 + i}`,
    round: i,
    opponentClubId: "opp",
    isHome: true,
    goalsFor: 30,
    goalsAgainst: 25,
    result: "W",
    own: stats({ goals: 30, shots: 60, turnovers: 10, saves: 12, shotsFaced: 25 }),
    opponent: stats({ goals: 25 }),
    events: [],
    ...overrides,
  };
}

test("insufficient sample (fewer than 3 matches) returns INSUFFICIENT_DATA, never a fabricated pattern", () => {
  const rows = [row(1), row(2)];
  const result = scoringConsistency(rows, "club-a");
  assert.equal(result.status, "MISSING");
  if (result.status === "MISSING") assert.equal(result.state, "INSUFFICIENT_DATA");
});

test("zero matches returns NO_MATCHES_YET, distinct from INSUFFICIENT_DATA", () => {
  const result = scoringConsistency([], "club-a");
  assert.equal(result.status, "MISSING");
  if (result.status === "MISSING") assert.equal(result.state, "NO_MATCHES_YET");
});

test("scoringConsistency reports the true minimum, only when literally true", () => {
  const rows = [row(1, { goalsFor: 28 }), row(2, { goalsFor: 35 }), row(3, { goalsFor: 30 })];
  const result = scoringConsistency(rows, "club-a");
  assert.equal(result.status, "OK");
  if (result.status === "OK") {
    assert.equal(result.pattern.evidence.minGoals, 28);
    assert.ok(result.pattern.statement.includes("28"));
  }
});

test("recentScoringVsSeason uses LAST_5 vs full SEASON windows correctly", () => {
  const rows = [
    row(1, { goalsFor: 20 }), row(2, { goalsFor: 20 }), row(3, { goalsFor: 20 }), row(4, { goalsFor: 20 }), row(5, { goalsFor: 20 }),
    row(6, { goalsFor: 30 }), row(7, { goalsFor: 30 }), row(8, { goalsFor: 30 }), row(9, { goalsFor: 30 }), row(10, { goalsFor: 30 }),
  ];
  const result = recentScoringVsSeason(rows, "club-a");
  assert.equal(result.status, "OK");
  if (result.status === "OK") {
    assert.equal(result.pattern.evidence.recent, 30); // last 5 rows are the 30-goal ones
    assert.equal(result.pattern.evidence.season, 25); // average across all 10
    assert.ok(result.pattern.statement.includes("above"));
  }
});

test("turnover direction is correctly reported as increased or decreased", () => {
  const seasonLow = Array.from({ length: 5 }, (_, i) => row(i, { own: stats({ turnovers: 5 }) }));
  const recentHigh = Array.from({ length: 5 }, (_, i) => row(i + 5, { own: stats({ turnovers: 15 }) }));
  const increased = turnoverFrequency([...seasonLow, ...recentHigh], "club-a");
  assert.equal(increased.status, "OK");
  if (increased.status === "OK") assert.ok(increased.pattern.statement.includes("increased"));

  const seasonHigh = Array.from({ length: 5 }, (_, i) => row(i, { own: stats({ turnovers: 15 }) }));
  const recentLow = Array.from({ length: 5 }, (_, i) => row(i + 5, { own: stats({ turnovers: 5 }) }));
  const decreased = turnoverFrequency([...seasonHigh, ...recentLow], "club-a");
  assert.equal(decreased.status, "OK");
  if (decreased.status === "OK") assert.ok(decreased.pattern.statement.includes("decreased"));
});

test("goalkeeper comparison uses savesPerMatch and reports the correct direction", () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => row(i, { own: stats({ saves: 8 }) })),
    ...Array.from({ length: 5 }, (_, i) => row(i + 5, { own: stats({ saves: 14 }) })),
  ];
  const result = goalkeeperOutput(rows, "club-a");
  assert.equal(result.status, "OK");
  if (result.status === "OK") {
    assert.equal(result.pattern.evidence.recent, 14);
    assert.ok(result.pattern.statement.includes("above"));
  }
});

test("concededTrend reports fewer/more correctly", () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => row(i, { goalsAgainst: 30 })),
    ...Array.from({ length: 5 }, (_, i) => row(i + 5, { goalsAgainst: 20 })),
  ];
  const result = concededTrend(rows, "club-a");
  assert.equal(result.status, "OK");
  if (result.status === "OK") assert.ok(result.pattern.statement.includes("fewer"));
});

test("computeAllPatterns is deterministic: identical input produces an identical pattern list", () => {
  const rows = Array.from({ length: 6 }, (_, i) => row(i, { goalsFor: 20 + i, own: stats({ turnovers: 5 + i, saves: 10 }) }));
  const first = computeAllPatterns(rows, "club-a");
  const second = computeAllPatterns([...rows], "club-a");
  assert.deepEqual(first, second);
});

test("every produced pattern carries evidence and fixtureIds for provenance", () => {
  const rows = Array.from({ length: 6 }, (_, i) => row(i, { goalsFor: 25 }));
  const patterns = computeAllPatterns(rows, "club-a");
  for (const p of patterns) {
    assert.ok(Object.keys(p.evidence).length > 0);
    assert.ok(p.fixtureIds.length > 0);
    assert.equal(p.subjectClubId, "club-a");
  }
});
