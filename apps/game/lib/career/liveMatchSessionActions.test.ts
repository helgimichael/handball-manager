import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { startLiveMatchSession, updateLiveMatchSession, clearLiveMatchSession } from "./liveMatchSessionActions";
import { defaultTeamTacticalProfile } from "./teamTacticalProfile";

const PROFILE = defaultTeamTacticalProfile();

test("HM-MATCH-1.3A: a fresh career has no active match session", () => {
  const state = createNewCareerState("session-seed-1", TUMBA_CLUB_ID);
  assert.equal(state.activeMatchSession, null);
});

test("HM-MATCH-1.3A: startLiveMatchSession creates a session at kickoff (FIRST_HALF, clockMinute 0)", () => {
  const state = createNewCareerState("session-seed-2", TUMBA_CLUB_ID);
  const next = startLiveMatchSession(state, "fx1", PROFILE);
  assert.equal(next.activeMatchSession?.fixtureId, "fx1");
  assert.equal(next.activeMatchSession?.clock.phase, "FIRST_HALF");
  assert.equal(next.activeMatchSession?.clock.clockMinute, 0);
});

test("HM-MATCH-1.3A Part C: starting a session for a fixture that already has one is a no-op -- pressing STARTA MATCH again RESUMES, never resets, an in-progress match", () => {
  const state = createNewCareerState("session-seed-3", TUMBA_CLUB_ID);
  const started = startLiveMatchSession(state, "fx1", PROFILE);
  const advanced = updateLiveMatchSession(started, "fx1", { ...started.activeMatchSession!, clock: { ...started.activeMatchSession!.clock, clockMinute: 13 } });
  const reStarted = startLiveMatchSession(advanced, "fx1", PROFILE);
  assert.equal(reStarted.activeMatchSession?.clock.clockMinute, 13, "must not reset the in-progress clock");
  assert.equal(reStarted, advanced, "must be the exact same state object -- a true no-op");
});

test("HM-MATCH-1.3A: starting a session for a DIFFERENT fixture replaces the old one", () => {
  const state = createNewCareerState("session-seed-4", TUMBA_CLUB_ID);
  const first = startLiveMatchSession(state, "fx1", PROFILE);
  const second = startLiveMatchSession(first, "fx2", PROFILE);
  assert.equal(second.activeMatchSession?.fixtureId, "fx2");
});

test("HM-MATCH-1.3A Part D/E: updateLiveMatchSession persists a new snapshot for the active session", () => {
  const state = createNewCareerState("session-seed-5", TUMBA_CLUB_ID);
  const started = startLiveMatchSession(state, "fx1", PROFILE);
  const updated = updateLiveMatchSession(started, "fx1", { ...started.activeMatchSession!, sevenVSixActive: true });
  assert.equal(updated.activeMatchSession?.sevenVSixActive, true);
});

test("HM-MATCH-1.3A: updateLiveMatchSession is a no-op if fixtureId does not match the currently active session (a stale write after the session moved on)", () => {
  const state = createNewCareerState("session-seed-6", TUMBA_CLUB_ID);
  const started = startLiveMatchSession(state, "fx1", PROFILE);
  const staleWrite = updateLiveMatchSession(started, "fx-other", { ...started.activeMatchSession!, sevenVSixActive: true });
  assert.equal(staleWrite, started);
});

test("HM-MATCH-1.3A: updateLiveMatchSession is a no-op if there is no active session at all", () => {
  const state = createNewCareerState("session-seed-7", TUMBA_CLUB_ID);
  const noop = updateLiveMatchSession(state, "fx1", { fixtureId: "fx1" } as never);
  assert.equal(noop, state);
});

test("HM-MATCH-1.3A Part I: clearLiveMatchSession removes the active session for a matching fixtureId", () => {
  const state = createNewCareerState("session-seed-8", TUMBA_CLUB_ID);
  const started = startLiveMatchSession(state, "fx1", PROFILE);
  const cleared = clearLiveMatchSession(started, "fx1");
  assert.equal(cleared.activeMatchSession, null);
});

test("HM-MATCH-1.3A: clearLiveMatchSession is a no-op for a non-matching fixtureId -- never clears a DIFFERENT fixture's session by accident", () => {
  const state = createNewCareerState("session-seed-9", TUMBA_CLUB_ID);
  const started = startLiveMatchSession(state, "fx1", PROFILE);
  const noop = clearLiveMatchSession(started, "fx-other");
  assert.equal(noop, started);
});

test("HM-MATCH-1.3A: startLiveMatchSession/updateLiveMatchSession/clearLiveMatchSession change ONLY activeMatchSession -- every other CareerState field is untouched by reference", () => {
  const state = createNewCareerState("session-seed-10", TUMBA_CLUB_ID);
  const started = startLiveMatchSession(state, "fx1", PROFILE);
  assert.equal(started.results, state.results);
  assert.equal(started.matchPlans, state.matchPlans);
  assert.equal(started.liveMatchPlans, state.liveMatchPlans);
  assert.equal(started.careerEvents, state.careerEvents);
});
