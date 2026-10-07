// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "../career/newCareer";
import { continueCareerRhythm } from "../career/continueController";
import { playManagerFixtureLegacy as playManagerFixture } from "../career/legacy/matchday";
import type { CareerState } from "../career/types";
import { getClubMatchHistory, sliceWindow } from "./matchHistory";

/** Plays exactly `n` of the manager's own matchdays forward via the real Career Rhythm loop -- never hand-crafts a FastMatchResult. */
function playManagerMatchdays(state: CareerState, n: number): CareerState {
  let current = state;
  let played = 0;
  let guard = 0;
  while (played < n && guard < 500) {
    guard += 1;
    const { state: next } = continueCareerRhythm(current);
    current = next;
    const pending = current.careerEvents.find((e) => e.type === "MATCHDAY_READY" && !e.resolved);
    if (pending) {
      const result = playManagerFixture(current);
      current = result.state;
      if (result.result) played += 1;
    }
  }
  return current;
}

test("getClubMatchHistory returns only completed matches, from the requested club's own perspective, ascending by date", () => {
  const state = playManagerMatchdays(createNewCareerState("history-seed-1", TUMBA_CLUB_ID), 3);
  const rows = getClubMatchHistory(state, TUMBA_CLUB_ID);
  assert.equal(rows.length, 3);
  for (let i = 1; i < rows.length; i += 1) {
    assert.ok(rows[i - 1].date <= rows[i].date);
  }
  for (const row of rows) {
    assert.ok(state.results[row.fixtureId], "every row must correspond to an actually-stored result");
    const result = state.results[row.fixtureId];
    if (row.isHome) {
      assert.equal(row.goalsFor, result.homeGoals);
      assert.equal(row.own.goals, result.homeStats.goals);
    } else {
      assert.equal(row.goalsFor, result.awayGoals);
      assert.equal(row.own.goals, result.awayStats.goals);
    }
  }
});

test("getClubMatchHistory also works for an AI opponent club, using its own real stored results (not fabricated)", () => {
  const state = playManagerMatchdays(createNewCareerState("history-seed-2", TUMBA_CLUB_ID), 2);
  // Any AI club with at least one AI-vs-AI result stored on the same matchdays.
  const anAiFixture = Object.values(state.results).find((r) => r.homeClubId !== TUMBA_CLUB_ID && r.awayClubId !== TUMBA_CLUB_ID);
  assert.ok(anAiFixture, "the daily tick must simulate AI-vs-AI fixtures on the same matchday too");
  const rows = getClubMatchHistory(state, anAiFixture!.homeClubId);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.opponentClubId !== anAiFixture!.homeClubId));
});

test("sliceWindow never returns more rows than exist and never pads", () => {
  const state = playManagerMatchdays(createNewCareerState("history-seed-3", TUMBA_CLUB_ID), 2);
  const rows = getClubMatchHistory(state, TUMBA_CLUB_ID);
  assert.equal(sliceWindow(rows, "LAST_5").length, rows.length);
  assert.equal(sliceWindow(rows, "LAST_3").length, Math.min(3, rows.length));
  assert.equal(sliceWindow(rows, "LAST_MATCH").length, Math.min(1, rows.length));
  assert.equal(sliceWindow(rows, "SEASON").length, rows.length);
});

test("getClubMatchHistory returns an empty list for a club with zero completed matches (fresh career)", () => {
  const fresh = createNewCareerState("history-seed-4", TUMBA_CLUB_ID);
  assert.deepEqual(getClubMatchHistory(fresh, TUMBA_CLUB_ID), []);
});
