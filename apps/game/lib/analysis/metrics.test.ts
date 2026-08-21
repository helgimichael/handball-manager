import { test } from "node:test";
import assert from "node:assert/strict";
import type { TeamMatchStats } from "@handball-manager/game-simulation";
import type { ClubMatchStatRow } from "./types";
import * as metrics from "./metrics";

function stats(overrides: Partial<TeamMatchStats> = {}): TeamMatchStats {
  return { goals: 0, shots: 0, shootingPct: 0, saves: 0, shotsFaced: 0, turnovers: 0, twoMinuteSuspensions: 0, sevenMetreGoals: 0, sevenMetreAttempts: 0, ...overrides };
}

function row(overrides: Partial<ClubMatchStatRow> = {}): ClubMatchStatRow {
  return {
    fixtureId: "f1",
    date: "2026-08-19",
    round: 1,
    opponentClubId: "opp",
    isHome: true,
    goalsFor: 0,
    goalsAgainst: 0,
    result: "D",
    own: stats(),
    opponent: stats(),
    events: [],
    ...overrides,
  };
}

test("goalsPerMatch / goalsConcededPerMatch average across rows", () => {
  const rows = [row({ goalsFor: 30, goalsAgainst: 25 }), row({ goalsFor: 20, goalsAgainst: 15 })];
  assert.equal(metrics.goalsPerMatch(rows), 25);
  assert.equal(metrics.goalsConcededPerMatch(rows), 20);
});

test("shootingPct = sum(goals)/sum(shots), across matches (not averaged per-match percentages)", () => {
  const rows = [row({ own: stats({ goals: 10, shots: 20 }) }), row({ own: stats({ goals: 20, shots: 30 }) })];
  assert.equal(metrics.shootingPct(rows), 30 / 50);
});

test("savePct = sum(saves)/sum(shotsFaced)", () => {
  const rows = [row({ own: stats({ saves: 8, shotsFaced: 10 }) }), row({ own: stats({ saves: 12, shotsFaced: 20 }) })];
  assert.equal(metrics.savePct(rows), 20 / 30);
});

test("sevenMetreConversion = sum(goals)/sum(attempts)", () => {
  const rows = [row({ own: stats({ sevenMetreGoals: 2, sevenMetreAttempts: 3 }) }), row({ own: stats({ sevenMetreGoals: 1, sevenMetreAttempts: 1 }) })];
  assert.equal(metrics.sevenMetreConversion(rows), 3 / 4);
});

test("all ratio metrics return null (never 0 or NaN) for a zero denominator", () => {
  const rows = [row({ own: stats({ goals: 0, shots: 0, saves: 0, shotsFaced: 0, sevenMetreGoals: 0, sevenMetreAttempts: 0 }) })];
  assert.equal(metrics.shootingPct(rows), null);
  assert.equal(metrics.savePct(rows), null);
  assert.equal(metrics.sevenMetreConversion(rows), null);
});

test("goalsPerMatch/goalsConcededPerMatch return null for an empty row list", () => {
  assert.equal(metrics.goalsPerMatch([]), null);
  assert.equal(metrics.goalsConcededPerMatch([]), null);
});

test("goalDifference sums for minus against across the given rows", () => {
  const rows = [row({ goalsFor: 30, goalsAgainst: 28 }), row({ goalsFor: 25, goalsAgainst: 30 })];
  assert.equal(metrics.goalDifference(rows), (30 - 28) + (25 - 30));
});

test("form returns W/D/L in row order, not sorted or reversed", () => {
  const rows = [row({ result: "W" }), row({ result: "L" }), row({ result: "D" })];
  assert.deepEqual(metrics.form(rows), ["W", "L", "D"]);
});

test("first/second half goals split by event minute, home and away perspective both correct", () => {
  const homeRow = row({
    isHome: true,
    events: [
      { minute: 10, side: "home", type: "GOAL" },
      { minute: 45, side: "home", type: "GOAL" },
      { minute: 20, side: "away", type: "GOAL" },
    ],
  });
  assert.equal(metrics.firstHalfGoals([homeRow]), 1);
  assert.equal(metrics.secondHalfGoals([homeRow]), 1);

  const awayRow = row({
    isHome: false,
    events: [
      { minute: 10, side: "home", type: "GOAL" },
      { minute: 50, side: "away", type: "GOAL" },
      { minute: 55, side: "away", type: "GOAL" },
    ],
  });
  assert.equal(metrics.firstHalfGoals([awayRow]), 0);
  assert.equal(metrics.secondHalfGoals([awayRow]), 2);
});

test("no metric function mutates its input rows", () => {
  const rows = [row({ goalsFor: 10, goalsAgainst: 5 })];
  const before = JSON.stringify(rows);
  metrics.goalsPerMatch(rows);
  metrics.shootingPct(rows);
  metrics.form(rows);
  assert.equal(JSON.stringify(rows), before);
});
