// HM-MATCH-1.3A: integration coverage across matchdayAction.ts +
// liveMatchSessionActions.ts -- proves the actual matchday boundary
// (Part C), that navigation/reconstruction is a pure read of already-
// persisted CareerState (Part D/E), and that reopening an already-
// finished fixture never spontaneously creates a session (Part M #15).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture } from "./calendar";
import { processDay } from "./dailyTick";
import { playManagerFixture } from "./matchdayAction";
import { startLiveMatchSession, updateLiveMatchSession } from "./liveMatchSessionActions";
import { isLiveMatchSessionActive } from "../liveMatch/liveMatchSession";
import { computeLiveMatchView } from "../liveMatch/liveMatchView";
import { tick } from "../liveMatch/clock";
import { TUMBA_CLUB_ID } from "../game-data";

function stateAtMatchday(seed: string) {
  const fresh = createNewCareerState(seed, TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  const state = processDay(fresh, matchday).state;
  const fixture = getNextPlayerFixture(state)!;
  return { state, fixture };
}

test("HM-MATCH-1.3A Part C: reaching matchday (Continue's own stop condition) never creates a live session by itself -- no session exists until STARTA MATCH is pressed", () => {
  const { state } = stateAtMatchday("matchday-session-seed-1");
  assert.equal(state.activeMatchSession, null);
});

test("HM-MATCH-1.3A Part C: simulating the fixture (playManagerFixture, what STARTA MATCH's handler calls first) ALSO does not by itself create a session -- the explicit startLiveMatchSession call is the only thing that may transition into FIRST_HALF", () => {
  const { state, fixture } = stateAtMatchday("matchday-session-seed-2");
  const { state: played } = playManagerFixture(state);
  assert.ok(played.results[fixture.id], "the fixture must have been simulated");
  assert.equal(played.activeMatchSession, null, "a result existing must never imply a session exists");
});

test("HM-MATCH-1.3A Part C: only after BOTH playManagerFixture AND startLiveMatchSession does a live session exist, at kickoff", () => {
  const { state, fixture } = stateAtMatchday("matchday-session-seed-3");
  const { state: played } = playManagerFixture(state);
  const started = startLiveMatchSession(played, fixture.id, played.tacticalProfile);
  assert.equal(started.activeMatchSession?.fixtureId, fixture.id);
  assert.equal(isLiveMatchSessionActive(started.activeMatchSession), true);
});

test("HM-MATCH-1.3A Part D/E: navigation reconstruction is just re-reading CareerState -- ticking the clock, persisting it, then reading it back (simulating unmount/remount) reproduces the identical score/phase/minute, never a reset to 0-0/00:00", () => {
  const { state, fixture } = stateAtMatchday("matchday-session-seed-4");
  const { state: played, result } = playManagerFixture(state);
  const started = startLiveMatchSession(played, fixture.id, played.tacticalProfile);

  // Simulate 13 minutes of play having happened, each tick persisted
  // exactly like the real persistence effect does.
  let session = started.activeMatchSession!;
  let career = started;
  for (let i = 0; i < 13; i++) {
    session = { ...session, clock: tick(session.clock) };
    career = updateLiveMatchSession(career, fixture.id, session);
  }
  assert.equal(career.activeMatchSession?.clock.clockMinute, 13);

  // "Navigate away and back": a fresh mount would seed purely from
  // `career.activeMatchSession` -- reconstruct the view from exactly
  // that, with no new simulation involved (`result` is the SAME object
  // read again).
  const reconstructedView = computeLiveMatchView(result!, career.activeMatchSession!.clock);
  const originalView = computeLiveMatchView(result!, session.clock);
  assert.deepEqual(reconstructedView, originalView);
  assert.notEqual(reconstructedView.clockMinute, 0, "must not have reset to 00:00");
});

test("HM-MATCH-1.3A Part E: coaching state (currentProfile/7v6) set mid-match survives being persisted and re-read exactly", () => {
  const { state, fixture } = stateAtMatchday("matchday-session-seed-5");
  const { state: played } = playManagerFixture(state);
  const started = startLiveMatchSession(played, fixture.id, played.tacticalProfile);
  const withChange = updateLiveMatchSession(started, fixture.id, {
    ...started.activeMatchSession!,
    sevenVSixActive: true,
    sevenVSixActiveSinceMinute: 7,
  });
  assert.equal(withChange.activeMatchSession?.sevenVSixActive, true);
  assert.equal(withChange.activeMatchSession?.sevenVSixActiveSinceMinute, 7);
});

test("HM-MATCH-1.3A Part M #15: reopening an already-finished fixture (result exists, but the session was never started or was already cleared) never creates a new session -- a caller must explicitly call startLiveMatchSession for that to happen", () => {
  const { state, fixture } = stateAtMatchday("matchday-session-seed-6");
  const { state: played } = playManagerFixture(state);
  // No startLiveMatchSession call at all -- mirrors SNABBRESULTAT, which
  // never touches Live Match.
  assert.ok(played.results[fixture.id]);
  assert.equal(played.activeMatchSession, null);
});
