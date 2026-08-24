import { test } from "node:test";
import assert from "node:assert/strict";
import { createLiveMatchSession, isLiveMatchSessionActive } from "./liveMatchSession";
import { defaultTeamTacticalProfile } from "../career/teamTacticalProfile";
import { tick, startSecondHalf, revealInstantly } from "./clock";

const PROFILE = defaultTeamTacticalProfile();

test("HM-MATCH-1.3A: createLiveMatchSession kicks off immediately at FIRST_HALF/clockMinute 0, never leaving PRE_MATCH persisted", () => {
  const session = createLiveMatchSession("fx1", PROFILE);
  assert.equal(session.clock.phase, "FIRST_HALF");
  assert.equal(session.clock.clockMinute, 0);
});

test("HM-MATCH-1.3A: createLiveMatchSession seeds currentProfile from the given tactical profile, with sevenVSix and adaptation state all neutral", () => {
  const session = createLiveMatchSession("fx1", PROFILE);
  assert.equal(session.currentProfile, PROFILE);
  assert.equal(session.sevenVSixActive, false);
  assert.equal(session.sevenVSixActiveSinceMinute, null);
  assert.equal(session.opponentAdaptationEffect, null);
  assert.equal(session.assessedOpponentAdaptation, null);
  assert.equal(session.opponentAdaptationLanded, false);
});

test("HM-MATCH-1.3A: isLiveMatchSessionActive is false for null/undefined -- no match in progress", () => {
  assert.equal(isLiveMatchSessionActive(null), false);
  assert.equal(isLiveMatchSessionActive(undefined), false);
});

test("HM-MATCH-1.3A Part G: isLiveMatchSessionActive is true through FIRST_HALF, HALF_TIME, SECOND_HALF and TIMEOUT -- every phase that must block global Continue", () => {
  const session = createLiveMatchSession("fx1", PROFILE);
  assert.equal(isLiveMatchSessionActive(session), true, "FIRST_HALF");

  let clock = session.clock;
  for (let i = 0; i < 30; i++) clock = tick(clock);
  assert.equal(clock.phase, "HALF_TIME");
  assert.equal(isLiveMatchSessionActive({ ...session, clock }), true, "HALF_TIME");

  clock = startSecondHalf(clock);
  assert.equal(isLiveMatchSessionActive({ ...session, clock }), true, "SECOND_HALF");
});

test("HM-MATCH-1.3A Part I: isLiveMatchSessionActive is false once FULL_TIME is reached -- Continue becomes valid again", () => {
  const session = createLiveMatchSession("fx1", PROFILE);
  const fullTimeClock = revealInstantly();
  assert.equal(isLiveMatchSessionActive({ ...session, clock: fullTimeClock }), false);
});
