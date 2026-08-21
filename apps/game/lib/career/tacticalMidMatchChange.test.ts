import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getPlayerFixtureOn } from "./calendar";
import { processDay } from "./dailyTick";
import { playManagerFixture } from "./matchdayAction";
import { applyMidMatchTacticalChange } from "./tacticalMidMatchChange";
import { TUMBA_CLUB_ID } from "../game-data";

const SEASON_START = "2026-08-19";

function stateAtMatchday(seed = "midmatch-seed") {
  const fresh = createNewCareerState(seed, TUMBA_CLUB_ID);
  return processDay(fresh, SEASON_START).state;
}

function playedFixture(seed = "midmatch-seed") {
  const state = stateAtMatchday(seed);
  const fixture = getPlayerFixtureOn(state, SEASON_START)!;
  const { state: played, result } = playManagerFixture(state);
  return { state: played, fixture, original: result! };
}

const ALTERNATE_PROFILE = { ati001UsageTendency: "HIGH" as const, h2ResponsePreference: "H2_STOPS" as const, tacticalFamiliarity: "HIGH" as const };

test("changing tactics at minute X only affects future match behavior: every event with minute < X is byte-for-byte unchanged", () => {
  const { state, fixture, original } = playedFixture();
  const adoptionMinute = 20;

  const next = applyMidMatchTacticalChange(state, fixture.id, adoptionMinute, ALTERNATE_PROFILE);
  const spliced = next.results[fixture.id];

  const originalPrefix = original.events.filter((e) => e.minute < adoptionMinute);
  const splicedPrefix = spliced.events.filter((e) => e.minute < adoptionMinute);
  assert.deepEqual(splicedPrefix, originalPrefix, "the already-revealed prefix must never be regenerated");

  // The suffix is free to differ (that's the whole point of the change).
  const originalSuffix = original.events.filter((e) => e.minute >= adoptionMinute);
  const splicedSuffix = spliced.events.filter((e) => e.minute >= adoptionMinute);
  assert.notDeepEqual(splicedSuffix, originalSuffix);
});

test("same seed + same instruction timing = same match: applying the identical change twice from the identical starting state produces an identical spliced result", () => {
  const { state, fixture } = playedFixture("midmatch-determinism-seed");
  const a = applyMidMatchTacticalChange(state, fixture.id, 25, ALTERNATE_PROFILE);
  const b = applyMidMatchTacticalChange(state, fixture.id, 25, ALTERNATE_PROFILE);
  assert.deepEqual(a.results[fixture.id], b.results[fixture.id]);
});

test("a different adoption minute (different instruction timing) produces a different suffix", () => {
  const { state, fixture } = playedFixture("midmatch-timing-seed");
  const early = applyMidMatchTacticalChange(state, fixture.id, 10, ALTERNATE_PROFILE);
  const late = applyMidMatchTacticalChange(state, fixture.id, 45, ALTERNATE_PROFILE);
  assert.notDeepEqual(early.results[fixture.id].events, late.results[fixture.id].events);
});

test("no instruction = existing HM-TACTICS-0.6 behavior: a fixture nobody ever applies a mid-match change to is completely untouched", () => {
  const { state, fixture, original } = playedFixture("midmatch-untouched-seed");
  // state.results[fixture.id] was produced solely by playManagerFixture ->
  // simulateFixture -> simulateMatch, exactly like before HM-TACTICS-0.7;
  // applyMidMatchTacticalChange is never invoked in this test.
  assert.deepEqual(state.results[fixture.id], original);
});

test("final score and stats are internally consistent after splicing: GOAL event count matches homeGoals/awayGoals, and team stats are exactly re-tallied from the spliced timeline", () => {
  const { state, fixture } = playedFixture("midmatch-consistency-seed");
  const next = applyMidMatchTacticalChange(state, fixture.id, 30, ALTERNATE_PROFILE);
  const spliced = next.results[fixture.id];

  const homeGoalEvents = spliced.events.filter((e) => e.type === "GOAL" && e.side === "home").length;
  const awayGoalEvents = spliced.events.filter((e) => e.type === "GOAL" && e.side === "away").length;
  assert.equal(homeGoalEvents, spliced.homeGoals);
  assert.equal(awayGoalEvents, spliced.awayGoals);
  assert.equal(spliced.homeStats.goals, spliced.homeGoals);
  assert.equal(spliced.awayStats.goals, spliced.awayGoals);

  const lastGoal = [...spliced.events].reverse().find((e) => e.type === "GOAL");
  assert.equal(lastGoal?.homeScoreAfter, spliced.homeGoals);
  assert.equal(lastGoal?.awayScoreAfter, spliced.awayGoals);
});

test("is a safe no-op when the fixture has no stored result, or the adoption minute is already at/past full time", () => {
  const { state, fixture } = playedFixture("midmatch-noop-seed");
  const noResult = applyMidMatchTacticalChange(state, "no-such-fixture", 20, ALTERNATE_PROFILE);
  assert.equal(noResult, state);

  const pastFullTime = applyMidMatchTacticalChange(state, fixture.id, 60, ALTERNATE_PROFILE);
  assert.equal(pastFullTime, state);
});

// HM-COACHING-0.2: a shout composes two applyMidMatchTacticalChange
// calls in sequence (delivery, then a later revert-to-baseline) --
// exactly the pattern CareerContext's applyMidMatchTacticalChangeAction
// now supports via a functional state update (see its own doc comment).
// These tests exercise that composition directly at the pure-function
// level, chaining the SECOND call's input state from the FIRST call's
// output, the same way the functional update guarantees in the app.
test("HM-COACHING-0.2: a shout's delivery + later expiry compose correctly -- prefix before delivery is untouched, and the post-expiry suffix uses the reverted (baseline) profile again", () => {
  const { state, fixture, original } = playedFixture("midmatch-shout-compose-seed");
  const baselineProfile = { ati001UsageTendency: "MEDIUM" as const, h2ResponsePreference: "H2_STEPS" as const, tacticalFamiliarity: "MEDIUM" as const };
  const overrideProfile = { ...baselineProfile, ati001UsageTendency: "HIGH" as const };

  const deliveryMinute = 15;
  const expiryMinute = 21;

  const afterDelivery = applyMidMatchTacticalChange(state, fixture.id, deliveryMinute, overrideProfile);
  const afterExpiry = applyMidMatchTacticalChange(afterDelivery, fixture.id, expiryMinute, baselineProfile);

  const finalResult = afterExpiry.results[fixture.id];

  // Prefix before the shout was ever delivered is exactly the original, untouched.
  const originalPrefix = original.events.filter((e) => e.minute < deliveryMinute);
  const finalPrefix = finalResult.events.filter((e) => e.minute < deliveryMinute);
  assert.deepEqual(finalPrefix, originalPrefix);

  // The [delivery, expiry) window came from the override-splice's own suffix, preserved by the second splice's own prefix-preservation.
  const deliveredWindow = afterDelivery.results[fixture.id].events.filter((e) => e.minute >= deliveryMinute && e.minute < expiryMinute);
  const finalWindow = finalResult.events.filter((e) => e.minute >= deliveryMinute && e.minute < expiryMinute);
  assert.deepEqual(finalWindow, deliveredWindow, "the active-shout window must survive the later revert-splice's own prefix preservation");

  // And the post-expiry suffix differs from what the override-splice alone would have produced, since it was resimulated with the reverted baseline.
  const overrideOnlySuffix = afterDelivery.results[fixture.id].events.filter((e) => e.minute >= expiryMinute);
  const finalSuffix = finalResult.events.filter((e) => e.minute >= expiryMinute);
  assert.notDeepEqual(finalSuffix, overrideOnlySuffix);
});

test("HM-COACHING-0.2: the same seed + same shout delivery/expiry timing always composes to the identical final result", () => {
  const { state, fixture } = playedFixture("midmatch-shout-determinism-seed");
  const baselineProfile = { ati001UsageTendency: "MEDIUM" as const, h2ResponsePreference: "H2_STEPS" as const, tacticalFamiliarity: "MEDIUM" as const };
  const overrideProfile = { ...baselineProfile, h2ResponsePreference: "H2_HOLDS" as const };

  function compose() {
    const afterDelivery = applyMidMatchTacticalChange(state, fixture.id, 12, overrideProfile);
    return applyMidMatchTacticalChange(afterDelivery, fixture.id, 17, baselineProfile);
  }

  const a = compose();
  const b = compose();
  assert.deepEqual(a.results[fixture.id], b.results[fixture.id]);
});
