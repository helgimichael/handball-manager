import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TIMEOUTS_PER_HALF,
  callTimeout,
  canCallTimeout,
  endTimeout,
  initLiveMatchClock,
  kickoff,
  revealInstantly,
  setSpeed,
  startSecondHalf,
  tick,
} from "./clock";

test("starts at 00:00, PRE_MATCH", () => {
  const clock = initLiveMatchClock();
  assert.equal(clock.clockMinute, 0);
  assert.equal(clock.phase, "PRE_MATCH");
});

test("kickoff enters FIRST_HALF at X1 speed, and is a no-op once already started", () => {
  const clock = kickoff(initLiveMatchClock());
  assert.equal(clock.phase, "FIRST_HALF");
  assert.equal(clock.speed, "X1");
  const kickedOffAgain = kickoff(kickoff(clock));
  assert.deepEqual(kickedOffAgain, clock);
});

test("tick advances by exactly one minute in FIRST_HALF", () => {
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 5; i += 1) clock = tick(clock);
  assert.equal(clock.clockMinute, 5);
  assert.equal(clock.phase, "FIRST_HALF");
});

test("tick stops exactly at 30 and enters HALF_TIME, pausing speed", () => {
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 40; i += 1) clock = tick(clock); // way past 30 -- must clamp, not overshoot
  assert.equal(clock.clockMinute, 30);
  assert.equal(clock.phase, "HALF_TIME");
  assert.equal(clock.speed, "PAUSED");
});

test("HALF_TIME never advances on its own -- tick is a no-op until startSecondHalf", () => {
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  assert.equal(clock.phase, "HALF_TIME");
  const stillHalfTime = tick(clock);
  assert.deepEqual(stillHalfTime, clock);
});

test("startSecondHalf only works from HALF_TIME, resumes at X1, keeps clock at 30", () => {
  const notYetHalfTime = startSecondHalf(kickoff(initLiveMatchClock()));
  assert.equal(notYetHalfTime.phase, "FIRST_HALF", "must be a no-op outside HALF_TIME");

  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  const secondHalf = startSecondHalf(clock);
  assert.equal(secondHalf.phase, "SECOND_HALF");
  assert.equal(secondHalf.clockMinute, 30);
  assert.equal(secondHalf.speed, "X1");
});

test("second half ticks from 30 to exactly 60 and enters FULL_TIME", () => {
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  clock = startSecondHalf(clock);
  for (let i = 0; i < 40; i += 1) clock = tick(clock); // overshoot again -- must clamp at 60
  assert.equal(clock.clockMinute, 60);
  assert.equal(clock.phase, "FULL_TIME");
  assert.equal(clock.speed, "PAUSED");
});

test("FULL_TIME never advances further", () => {
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  clock = startSecondHalf(clock);
  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  const stillFullTime = tick(clock);
  assert.deepEqual(stillFullTime, clock);
});

test("setSpeed only takes effect during FIRST_HALF/SECOND_HALF", () => {
  const atKickoff = initLiveMatchClock();
  assert.deepEqual(setSpeed(atKickoff, "X4"), atKickoff, "no playback speed before kickoff");

  let clock = kickoff(initLiveMatchClock());
  clock = setSpeed(clock, "X8");
  assert.equal(clock.speed, "X8");

  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  assert.deepEqual(setSpeed(clock, "X8"), clock, "no playback speed during HALF_TIME");
});

test("revealInstantly jumps straight to FULL_TIME/60:00 from any phase", () => {
  const expected = { phase: "FULL_TIME", clockMinute: 60, speed: "PAUSED", timeoutsUsed: { firstHalf: 0, secondHalf: 0 } };
  assert.deepEqual(revealInstantly(), expected);
  const midMatch = tick(tick(kickoff(initLiveMatchClock())));
  assert.deepEqual(revealInstantly(), expected);
  void midMatch;
});

test("HM-COACHING-0.1: canCallTimeout is only true during FIRST_HALF/SECOND_HALF, up to MAX_TIMEOUTS_PER_HALF times", () => {
  assert.equal(canCallTimeout(initLiveMatchClock()), false, "not yet kicked off");

  let clock = kickoff(initLiveMatchClock());
  assert.equal(canCallTimeout(clock), true);
  for (let i = 0; i < MAX_TIMEOUTS_PER_HALF; i += 1) {
    clock = callTimeout(clock);
    assert.equal(clock.phase, "TIMEOUT");
    clock = endTimeout(clock);
    assert.equal(clock.phase, "FIRST_HALF");
  }
  assert.equal(canCallTimeout(clock), false, "this half's timeout budget is spent");

  for (let i = 0; i < 30; i += 1) clock = tick(clock);
  clock = startSecondHalf(clock);
  assert.equal(canCallTimeout(clock), true, "the second half has its own separate budget");
});

test("HM-COACHING-0.1: callTimeout freezes clockMinute -- tick is a no-op during TIMEOUT", () => {
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 12; i += 1) clock = tick(clock);
  assert.equal(clock.clockMinute, 12);

  clock = callTimeout(clock);
  assert.equal(clock.phase, "TIMEOUT");
  assert.equal(clock.speed, "PAUSED");
  for (let i = 0; i < 5; i += 1) clock = tick(clock);
  assert.equal(clock.clockMinute, 12, "simulated match time must not advance during a timeout");
});

test("HM-COACHING-0.1: endTimeout resumes exactly the half the timeout was called from, at the same clockMinute, at X1", () => {
  let clock = kickoff(initLiveMatchClock());
  for (let i = 0; i < 40; i += 1) clock = tick(clock); // into second half
  clock = startSecondHalf(clock);
  for (let i = 0; i < 5; i += 1) clock = tick(clock);
  assert.equal(clock.clockMinute, 35);

  clock = callTimeout(clock);
  clock = endTimeout(clock);
  assert.equal(clock.phase, "SECOND_HALF");
  assert.equal(clock.clockMinute, 35);
  assert.equal(clock.speed, "X1");
});

test("HM-COACHING-0.1: callTimeout/endTimeout are no-ops outside their valid phases", () => {
  const preMatch = initLiveMatchClock();
  assert.deepEqual(callTimeout(preMatch), preMatch);

  let clock = kickoff(initLiveMatchClock());
  assert.deepEqual(endTimeout(clock), clock, "endTimeout outside TIMEOUT is a no-op");

  // spend this half's only timeout, then confirm a second call is a no-op
  clock = callTimeout(clock);
  clock = endTimeout(clock);
  const spent = clock;
  assert.deepEqual(callTimeout(spent), spent, "no timeouts left this half");
});
