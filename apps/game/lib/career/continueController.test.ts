// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { continueCareerRhythm } from "./continueController";
import { getNextPlayerFixture } from "./calendar";
import { playManagerFixtureLegacy as playManagerFixture } from "./legacy/matchday";
import { TUMBA_CLUB_ID } from "../game-data";

test("Continue Controller: full walkthrough -- quiet-day skipping, IMPORTANT stop, MATCHDAY_READY hard stop, resume, no rerun", () => {
  let state = createNewCareerState("continue-walkthrough-seed", TUMBA_CLUB_ID);
  // HM-CAREER-0.5: round 1's fixtures are now deterministically spread
  // across a few nearby days (game-simulation's fixtures.ts) -- the
  // manager's own matchday is no longer guaranteed to fall exactly on
  // the season's start date, so it must be looked up, not assumed.
  const firstMatchday = getNextPlayerFixture(state)!.date;

  // 1) CONTINUE advances toward round 1's matchday, possibly stopping at
  //    IMPORTANT events along the way first (same as the round-2 walk in
  //    step 4 below), then hard-stopping at the matchday itself.
  let firstLegGuard = 0;
  let firstPress = continueCareerRhythm(state);
  state = firstPress.state;
  while (firstPress.stopReason === "IMPORTANT") {
    firstLegGuard += 1;
    assert.ok(firstLegGuard < 20, "runaway loop -- round 1's matchday should be reached well within 20 presses");
    firstPress = continueCareerRhythm(state);
    state = firstPress.state;
  }
  assert.equal(firstPress.stopReason, "ACTION_REQUIRED");
  assert.ok(firstPress.daysProcessed >= 1);
  assert.equal(state.gameDate, firstMatchday);
  assert.ok(state.careerEvents.some((e) => e.type === "MATCHDAY_READY" && !e.resolved));

  // 2) CONTINUE cannot skip the unresolved ACTION_REQUIRED event.
  const blocked = continueCareerRhythm(state);
  assert.equal(blocked.stopReason, "ACTION_REQUIRED_PENDING");
  assert.equal(blocked.daysProcessed, 0);
  assert.equal(blocked.state.processedThroughDate, state.processedThroughDate, "no day may be processed while blocked");

  // 3) Resolve the matchday through the existing match flow.
  const played = playManagerFixture(state);
  assert.ok(played.result, "the manager fixture must actually resolve");
  state = played.state;
  assert.ok(state.careerEvents.some((e) => e.type === "MATCHDAY_READY" && e.resolved));
  assert.ok(state.careerEvents.some((e) => e.type === "MATCH_COMPLETED"));

  // 4) CONTINUE now advances toward round 2's matchday, one press at a time,
  //    stopping at every IMPORTANT event along the way (STAFF_REPORT,
  //    OPPONENT_REPORT_READY, MATCH_PREPARATION_READY are all plausible
  //    stops before the hard stop -- the exact mix is event-driven per the
  //    spec, not scripted, so this only asserts the invariants that must
  //    hold regardless of which IMPORTANT events land on which day).
  let importantStops = 0;
  let sawMultiDaySkip = false;
  let guard = 0;
  while (true) {
    guard += 1;
    assert.ok(guard < 20, "runaway loop -- round 2's matchday should be reached well within 20 presses");
    const press = continueCareerRhythm(state);
    state = press.state;
    if (press.stopReason === "ACTION_REQUIRED") {
      break;
    }
    assert.equal(press.stopReason, "IMPORTANT", "the only other reason to stop before the next matchday is an IMPORTANT event");
    importantStops += 1;
    if (press.daysProcessed > 1) {
      sawMultiDaySkip = true;
    }
  }
  assert.ok(importantStops >= 1, "at least one IMPORTANT stop should occur on the way to the next matchday");
  assert.ok(sawMultiDaySkip, "at least one press should have auto-advanced through more than one quiet day");
  assert.ok(state.careerEvents.some((e) => e.type === "MATCHDAY_READY" && e.date !== firstMatchday && !e.resolved));

  // 5) No day is ever reprocessed: no duplicate ids anywhere in the log, however many presses it took.
  const ids = state.careerEvents.map((e) => e.id);
  assert.equal(ids.length, new Set(ids).size, "careerEvents must never contain duplicate ids");

  // 6) Continue resumes correctly once the new matchday is resolved too.
  const secondMatch = playManagerFixture(state);
  assert.ok(secondMatch.result);
  state = secondMatch.state;
  const afterSecondMatch = continueCareerRhythm(state);
  assert.notEqual(afterSecondMatch.stopReason, "ACTION_REQUIRED_PENDING");
});

function playThroughFullSeason(seed: string) {
  let state = createNewCareerState(seed, TUMBA_CLUB_ID);
  let guard = 0;
  while (!state.seasonComplete) {
    guard += 1;
    assert.ok(guard < 500, "runaway loop -- a season must complete well within 500 CONTINUE presses");
    const press = continueCareerRhythm(state);
    state = press.state;
    if (press.stopReason === "ACTION_REQUIRED") {
      const played = playManagerFixture(state);
      assert.ok(played.result, "every ACTION_REQUIRED stop in this walkthrough must be the manager's own matchday");
      state = played.state;
    }
  }
  return state;
}

test("Continue Controller: same seed reproduces an identical season end-to-end (Spec S26/S29.6)", () => {
  const a = playThroughFullSeason("reproducibility-seed");
  const b = playThroughFullSeason("reproducibility-seed");

  assert.deepEqual(a.results, b.results);
  assert.equal(a.careerEvents.length, b.careerEvents.length);
  assert.deepEqual(
    a.careerEvents.map((e) => e.id),
    b.careerEvents.map((e) => e.id),
  );
  assert.deepEqual(a.clubForm, b.clubForm);
  assert.equal(a.gameDate, b.gameDate);
});

test("Continue Controller: an already-complete season is a pure no-op", () => {
  let state = createNewCareerState("continue-complete-seed", TUMBA_CLUB_ID);
  state = { ...state, seasonComplete: true };
  const result = continueCareerRhythm(state);
  assert.equal(result.stopReason, "SEASON_COMPLETE");
  assert.equal(result.daysProcessed, 0);
  assert.equal(result.state, state);
});
