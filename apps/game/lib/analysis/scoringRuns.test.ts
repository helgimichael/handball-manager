import { test } from "node:test";
import assert from "node:assert/strict";
import type { MatchEvent } from "@handball-manager/game-simulation";
import { detectScoringRuns } from "./scoringRuns";

function goal(minute: number, side: "home" | "away", homeScoreAfter: number, awayScoreAfter: number): MatchEvent {
  return { minute, side, type: "GOAL", homeScoreAfter, awayScoreAfter };
}

test("a 3-0 run is detected", () => {
  const events = [goal(10, "home", 1, 0), goal(12, "home", 2, 0), goal(14, "home", 3, 0)];
  const runs = detectScoringRuns(events);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].goals, 3);
  assert.equal(runs[0].side, "home");
  assert.equal(runs[0].startMinute, 10);
  assert.equal(runs[0].endMinute, 14);
});

test("a 4-0 run is detected as a single run of 4, not two runs", () => {
  const events = [goal(1, "away", 0, 1), goal(2, "away", 0, 2), goal(3, "away", 0, 3), goal(4, "away", 0, 4)];
  const runs = detectScoringRuns(events);
  assert.equal(runs.length, 1);
  assert.equal(runs[0].goals, 4);
});

test("a 2-0 sequence is not shown at the default threshold of 3", () => {
  const events = [goal(1, "home", 1, 0), goal(2, "home", 2, 0)];
  assert.deepEqual(detectScoringRuns(events), []);
});

test("an opponent goal breaks the run", () => {
  const events = [goal(1, "home", 1, 0), goal(2, "home", 2, 0), goal(3, "away", 2, 1), goal(4, "home", 3, 1)];
  assert.deepEqual(detectScoringRuns(events), []);
});

test("multiple separate runs are all detected, in chronological order", () => {
  const events = [
    goal(1, "home", 1, 0), goal(2, "home", 2, 0), goal(3, "home", 3, 0), // home run of 3
    goal(10, "away", 3, 1), // single away goal, breaks the home run but is not itself a run
    goal(15, "home", 4, 1), // single home goal, breaks the away goal's streak too
    goal(20, "away", 4, 2), goal(21, "away", 4, 3), goal(22, "away", 4, 4), // away run of 3
  ];
  const runs = detectScoringRuns(events);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].side, "home");
  assert.equal(runs[1].side, "away");
  assert.equal(runs[1].startMinute, 20);
  assert.equal(runs[1].endMinute, 22);
});

test("scoreAfter reflects the score after the run's final goal", () => {
  const events = [goal(1, "home", 1, 0), goal(2, "home", 2, 0), goal(3, "home", 3, 0)];
  assert.deepEqual(detectScoringRuns(events)[0].scoreAfter, { home: 3, away: 0 });
});

test("detecting runs never mutates or reorders the caller's event array", () => {
  const events = [goal(5, "home", 1, 0), goal(1, "home", 2, 0), goal(3, "home", 3, 0)];
  const before = JSON.stringify(events);
  detectScoringRuns(events);
  assert.equal(JSON.stringify(events), before);
});

test("non-GOAL events are ignored entirely", () => {
  const events: MatchEvent[] = [
    { minute: 1, side: "home", type: "SAVE" },
    goal(2, "home", 1, 0),
    goal(3, "home", 2, 0),
    goal(4, "home", 3, 0),
    { minute: 5, side: "away", type: "TURNOVER" },
  ];
  assert.equal(detectScoringRuns(events).length, 1);
});
