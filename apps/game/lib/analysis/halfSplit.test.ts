import { test } from "node:test";
import assert from "node:assert/strict";
import type { FastMatchResult, MatchEvent } from "@handball-manager/game-simulation";
import { computeHalfSplit } from "./halfSplit";

function result(events: MatchEvent[], homeGoals: number, awayGoals: number): FastMatchResult {
  const homeStats = {
    goals: events.filter((e) => e.side === "home" && e.type === "GOAL").length,
    shots: events.filter((e) => e.side === "home" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length,
    shootingPct: 0,
    saves: events.filter((e) => e.side === "home" && e.type === "SAVE").length,
    shotsFaced: events.filter((e) => e.side === "away" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length,
    turnovers: events.filter((e) => e.side === "home" && e.type === "TURNOVER").length,
    twoMinuteSuspensions: events.filter((e) => e.side === "home" && e.type === "TWO_MIN").length,
    sevenMetreGoals: 0,
    sevenMetreAttempts: 0,
  };
  const awayStats = {
    goals: events.filter((e) => e.side === "away" && e.type === "GOAL").length,
    shots: events.filter((e) => e.side === "away" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length,
    shootingPct: 0,
    saves: events.filter((e) => e.side === "away" && e.type === "SAVE").length,
    shotsFaced: events.filter((e) => e.side === "home" && (e.type === "GOAL" || e.type === "MISS" || e.type === "SAVE")).length,
    turnovers: events.filter((e) => e.side === "away" && e.type === "TURNOVER").length,
    twoMinuteSuspensions: events.filter((e) => e.side === "away" && e.type === "TWO_MIN").length,
    sevenMetreGoals: 0,
    sevenMetreAttempts: 0,
  };
  return { fixtureId: "f1", seed: 1, homeClubId: "home", awayClubId: "away", homeGoals, awayGoals, homeStats, awayStats, events, homePlayerContributions: [], awayPlayerContributions: [] };
}

test("events at minute <= 30 belong to the first half", () => {
  const r = result([{ minute: 30, side: "home", type: "GOAL", homeScoreAfter: 1, awayScoreAfter: 0 }], 1, 0);
  const { firstHalf, secondHalf } = computeHalfSplit(r);
  assert.equal(firstHalf.home.goals, 1);
  assert.equal(secondHalf.home.goals, 0);
});

test("events at minute > 30 belong to the second half", () => {
  const r = result([{ minute: 31, side: "away", type: "GOAL", homeScoreAfter: 0, awayScoreAfter: 1 }], 0, 1);
  const { firstHalf, secondHalf } = computeHalfSplit(r);
  assert.equal(firstHalf.away.goals, 0);
  assert.equal(secondHalf.away.goals, 1);
});

test("first-half goals + second-half goals sum to the match's full-time goals", () => {
  const events: MatchEvent[] = [
    { minute: 5, side: "home", type: "GOAL", homeScoreAfter: 1, awayScoreAfter: 0 },
    { minute: 25, side: "home", type: "GOAL", homeScoreAfter: 2, awayScoreAfter: 0 },
    { minute: 40, side: "home", type: "GOAL", homeScoreAfter: 3, awayScoreAfter: 0 },
    { minute: 10, side: "away", type: "GOAL", homeScoreAfter: 3, awayScoreAfter: 1 },
    { minute: 55, side: "away", type: "GOAL", homeScoreAfter: 3, awayScoreAfter: 2 },
  ];
  const r = result(events, 3, 2);
  const { firstHalf, secondHalf } = computeHalfSplit(r);
  assert.equal(firstHalf.home.goals + secondHalf.home.goals, r.homeGoals);
  assert.equal(firstHalf.away.goals + secondHalf.away.goals, r.awayGoals);
});

test("turnovers split correctly between halves", () => {
  const events: MatchEvent[] = [
    { minute: 10, side: "home", type: "TURNOVER" },
    { minute: 45, side: "home", type: "TURNOVER" },
    { minute: 50, side: "home", type: "TURNOVER" },
  ];
  const r = result(events, 0, 0);
  const { firstHalf, secondHalf } = computeHalfSplit(r);
  assert.equal(firstHalf.home.turnovers, 1);
  assert.equal(secondHalf.home.turnovers, 2);
});

test("saves split correctly between halves and shotsFaced uses the other side's within-half shots", () => {
  const events: MatchEvent[] = [
    { minute: 5, side: "away", type: "SAVE" },
    { minute: 6, side: "home", type: "MISS" },
    { minute: 40, side: "away", type: "SAVE" },
  ];
  const r = result(events, 0, 0);
  const { firstHalf, secondHalf } = computeHalfSplit(r);
  assert.equal(firstHalf.away.saves, 1);
  assert.equal(secondHalf.away.saves, 1);
  assert.equal(firstHalf.home.shotsFaced, 1); // away's 1 save-attempt-worthy shot in the first half
});
