import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getPlayerFixtureOn } from "./calendar";
import { processDay } from "./dailyTick";
import { continueCareerRhythm } from "./continueController";
import { playManagerFixture } from "./matchdayAction";
import { applyMidMatchTacticalChange } from "./tacticalMidMatchChange";
import { snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { TUMBA_CLUB_ID } from "../game-data";
import type { CareerState } from "./types";

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

/** HM-MATCH-0.2: see matchdayAction.test.ts's identical helper doc -- opponent squad data only exists for a REAL_WORLD-backed competition. */
function playedRealClubFixture(seed: string): { state: CareerState; fixture: { id: string; homeClubId: string; awayClubId: string }; original: import("@handball-manager/game-simulation").FastMatchResult } {
  const clubId = "se_club_alingsas_hk";
  const worldSquads = snapshotWorldSquads("se_handbollsligan_herr");
  const fresh = createNewCareerState(seed, clubId, worldSquads);
  let current = fresh;
  for (let i = 0; i < 100; i += 1) {
    const { state: next, stopReason } = continueCareerRhythm(current);
    current = next;
    if (stopReason === "ACTION_REQUIRED" || stopReason === "ACTION_REQUIRED_PENDING") {
      const fixture = getPlayerFixtureOn(next, next.gameDate)!;
      const { state: played, result } = playManagerFixture(next);
      return { state: played, fixture, original: result! };
    }
  }
  throw new Error("never reached an ACTION_REQUIRED stop");
}

const ALTERNATE_PROFILE = { ati001UsageTendency: "HIGH" as const, h2ResponsePreference: "H2_STOPS" as const, tacticalFamiliarity: "HIGH" as const };

test("changing tactics at minute X only affects future match behavior: every event with minute < X is byte-for-byte unchanged", () => {
  const { state, fixture, original } = playedFixture();
  const adoptionMinute = 20;

  const next = applyMidMatchTacticalChange(state, fixture.id, adoptionMinute, ALTERNATE_PROFILE, false, null);
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
  const a = applyMidMatchTacticalChange(state, fixture.id, 25, ALTERNATE_PROFILE, false, null);
  const b = applyMidMatchTacticalChange(state, fixture.id, 25, ALTERNATE_PROFILE, false, null);
  assert.deepEqual(a.results[fixture.id], b.results[fixture.id]);
});

test("a different adoption minute (different instruction timing) produces a different suffix", () => {
  const { state, fixture } = playedFixture("midmatch-timing-seed");
  const early = applyMidMatchTacticalChange(state, fixture.id, 10, ALTERNATE_PROFILE, false, null);
  const late = applyMidMatchTacticalChange(state, fixture.id, 45, ALTERNATE_PROFILE, false, null);
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
  const next = applyMidMatchTacticalChange(state, fixture.id, 30, ALTERNATE_PROFILE, false, null);
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
  const noResult = applyMidMatchTacticalChange(state, "no-such-fixture", 20, ALTERNATE_PROFILE, false, null);
  assert.equal(noResult, state);

  const pastFullTime = applyMidMatchTacticalChange(state, fixture.id, 60, ALTERNATE_PROFILE, false, null);
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

  const afterDelivery = applyMidMatchTacticalChange(state, fixture.id, deliveryMinute, overrideProfile, false, null);
  const afterExpiry = applyMidMatchTacticalChange(afterDelivery, fixture.id, expiryMinute, baselineProfile, false, null);

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
    const afterDelivery = applyMidMatchTacticalChange(state, fixture.id, 12, overrideProfile, false, null);
    return applyMidMatchTacticalChange(afterDelivery, fixture.id, 17, baselineProfile, false, null);
  }

  const a = compose();
  const b = compose();
  assert.deepEqual(a.results[fixture.id], b.results[fixture.id]);
});

// HM-TACTICS-0.8: 7v6 threads through the exact same splice as a
// profile-only change -- only the `sevenVSixActive` flag differs.
const NEUTRAL_PROFILE = { ati001UsageTendency: "MEDIUM" as const, h2ResponsePreference: "H2_STEPS" as const, tacticalFamiliarity: "MEDIUM" as const };

test("HM-TACTICS-0.8: switching 7v6 ON only affects future match progression -- prefix before the adoption minute is byte-for-byte unchanged", () => {
  const { state, fixture, original } = playedFixture("sevenvsix-prefix-seed");
  const adoptionMinute = 22;

  const next = applyMidMatchTacticalChange(state, fixture.id, adoptionMinute, NEUTRAL_PROFILE, true, null);
  const spliced = next.results[fixture.id];

  const originalPrefix = original.events.filter((e) => e.minute < adoptionMinute);
  const splicedPrefix = spliced.events.filter((e) => e.minute < adoptionMinute);
  assert.deepEqual(splicedPrefix, originalPrefix);
});

test("HM-TACTICS-0.8: same seed + same switch minute/state = same result", () => {
  const { state, fixture } = playedFixture("sevenvsix-determinism-seed");
  const a = applyMidMatchTacticalChange(state, fixture.id, 18, NEUTRAL_PROFILE, true, null);
  const b = applyMidMatchTacticalChange(state, fixture.id, 18, NEUTRAL_PROFILE, true, null);
  assert.deepEqual(a.results[fixture.id], b.results[fixture.id]);
});

test("HM-TACTICS-0.8: ON and OFF at the identical adoption minute produce different suffixes -- the switch actually changes the segment simulated", () => {
  const { state, fixture } = playedFixture("sevenvsix-onoff-seed");
  const on = applyMidMatchTacticalChange(state, fixture.id, 20, NEUTRAL_PROFILE, true, null);
  const off = applyMidMatchTacticalChange(state, fixture.id, 20, NEUTRAL_PROFILE, false, null);
  assert.notDeepEqual(on.results[fixture.id].events, off.results[fixture.id].events);
});

test("HM-TACTICS-0.8: switching ON then later OFF composes correctly (mirrors the shout delivery+expiry composition above) -- the post-switch-off suffix differs from staying ON", () => {
  const { state, fixture, original } = playedFixture("sevenvsix-compose-seed");
  const onMinute = 15;
  const offMinute = 25;

  const afterOn = applyMidMatchTacticalChange(state, fixture.id, onMinute, NEUTRAL_PROFILE, true, null);
  const afterOff = applyMidMatchTacticalChange(afterOn, fixture.id, offMinute, NEUTRAL_PROFILE, false, null);
  const finalResult = afterOff.results[fixture.id];

  const originalPrefix = original.events.filter((e) => e.minute < onMinute);
  const finalPrefix = finalResult.events.filter((e) => e.minute < onMinute);
  assert.deepEqual(finalPrefix, originalPrefix);

  const stayedOnSuffix = applyMidMatchTacticalChange(afterOn, fixture.id, offMinute, NEUTRAL_PROFILE, true, null).results[fixture.id].events.filter(
    (e) => e.minute >= offMinute,
  );
  const switchedOffSuffix = finalResult.events.filter((e) => e.minute >= offMinute);
  assert.notDeepEqual(switchedOffSuffix, stayedOnSuffix);
});

test("HM-TACTICS-0.8: directional upside -- averaged across seeded fixtures, the manager's own goals from the adoption minute onward are higher with 7v6 ON than OFF (never a claim of realistic percentages)", () => {
  const SAMPLE_SEEDS = 15;
  let onTotal = 0;
  let offTotal = 0;
  for (let i = 0; i < SAMPLE_SEEDS; i += 1) {
    const { state, fixture } = playedFixture(`sevenvsix-directional-${i}`);
    const managerIsHome = fixture.homeClubId === TUMBA_CLUB_ID;
    const on = applyMidMatchTacticalChange(state, fixture.id, 10, NEUTRAL_PROFILE, true, null).results[fixture.id];
    const off = applyMidMatchTacticalChange(state, fixture.id, 10, NEUTRAL_PROFILE, false, null).results[fixture.id];
    onTotal += managerIsHome ? on.homeGoals : on.awayGoals;
    offTotal += managerIsHome ? off.homeGoals : off.awayGoals;
  }
  assert.ok(onTotal / SAMPLE_SEEDS > offTotal / SAMPLE_SEEDS, `7v6 ON must average more manager goals than OFF (on avg=${onTotal / SAMPLE_SEEDS}, off avg=${offTotal / SAMPLE_SEEDS})`);
});

test("HM-TACTICS-0.8: directional downside -- averaged across seeded fixtures, the OPPONENT's goals from the adoption minute onward are also higher with 7v6 ON than OFF (the empty-net/numerical-risk counterpart)", () => {
  const SAMPLE_SEEDS = 15;
  let onTotal = 0;
  let offTotal = 0;
  for (let i = 0; i < SAMPLE_SEEDS; i += 1) {
    const { state, fixture } = playedFixture(`sevenvsix-downside-${i}`);
    const managerIsHome = fixture.homeClubId === TUMBA_CLUB_ID;
    const on = applyMidMatchTacticalChange(state, fixture.id, 10, NEUTRAL_PROFILE, true, null).results[fixture.id];
    const off = applyMidMatchTacticalChange(state, fixture.id, 10, NEUTRAL_PROFILE, false, null).results[fixture.id];
    onTotal += managerIsHome ? on.awayGoals : on.homeGoals;
    offTotal += managerIsHome ? off.awayGoals : off.homeGoals;
  }
  assert.ok(
    onTotal / SAMPLE_SEEDS > offTotal / SAMPLE_SEEDS,
    `7v6 ON must average more OPPONENT goals than OFF (the downside) (on avg=${onTotal / SAMPLE_SEEDS}, off avg=${offTotal / SAMPLE_SEEDS})`,
  );
});

test("HM-TACTICS-0.8: no unlimited stacking -- applying ON twice in a row (re-adopting the same state) never compounds beyond the single bounded adjustment", () => {
  const { state, fixture } = playedFixture("sevenvsix-stacking-seed");
  const onOnce = applyMidMatchTacticalChange(state, fixture.id, 14, NEUTRAL_PROFILE, true, null);
  const onTwice = applyMidMatchTacticalChange(onOnce, fixture.id, 14, NEUTRAL_PROFILE, true, null);
  // Re-adopting at the SAME adoption minute with the SAME state is a
  // pure function of the same inputs -- it must reproduce, not stack
  // on top of, the same result (the splice always recomputes the
  // adjustment from scratch; it is never cumulative).
  assert.deepEqual(onTwice.results[fixture.id], onOnce.results[fixture.id]);
});

// HM-TACTICS-0.9: halftime instructions (adoptionMinute 30, the only
// minute HALF_TIME exists at) and the opponent-adaptation effect both
// thread through this exact same splice -- no new mechanism.
test("HM-TACTICS-0.9: a halftime-style change at adoptionMinute 30 preserves the entire first-half prefix byte-for-byte", () => {
  const { state, fixture, original } = playedFixture("halftime-prefix-seed");
  const next = applyMidMatchTacticalChange(state, fixture.id, 30, NEUTRAL_PROFILE, false, null);
  const spliced = next.results[fixture.id];

  const originalFirstHalf = original.events.filter((e) => e.minute < 30);
  const splicedFirstHalf = spliced.events.filter((e) => e.minute < 30);
  assert.deepEqual(splicedFirstHalf, originalFirstHalf);
});

test("HM-TACTICS-0.9: an opponent-adaptation effect isn't silently ignored by the splice -- averaged across seeded fixtures, it changes the spliced suffix at least some of the time", () => {
  let sawDifference = false;
  for (let i = 0; i < 15 && !sawDifference; i += 1) {
    const { state, fixture } = playedFixture(`opponent-adapt-splice-seed-${i}`);
    const withoutAdaptation = applyMidMatchTacticalChange(state, fixture.id, 33, NEUTRAL_PROFILE, true, null);
    const withAdaptation = applyMidMatchTacticalChange(state, fixture.id, 33, NEUTRAL_PROFILE, true, {
      trigger: "SEVEN_V_SIX",
      dampeningFraction: 0.5,
    });
    if (JSON.stringify(withAdaptation.results[fixture.id].events) !== JSON.stringify(withoutAdaptation.results[fixture.id].events)) {
      sawDifference = true;
    }
  }
  assert.ok(sawDifference, "expected at least one of 15 seeded fixtures to show a different spliced suffix once the opponent has adapted");
});

test("HM-TACTICS-0.9: same seed + same opponent-adaptation effect + same timing = same spliced result", () => {
  const { state, fixture } = playedFixture("opponent-adapt-determinism-seed");
  const effect = { trigger: "ATI001_HIGH" as const, dampeningFraction: 0.5 };
  const a = applyMidMatchTacticalChange(state, fixture.id, 33, NEUTRAL_PROFILE, false, effect);
  const b = applyMidMatchTacticalChange(state, fixture.id, 33, NEUTRAL_PROFILE, false, effect);
  assert.deepEqual(a.results[fixture.id], b.results[fixture.id]);
});

test("HM-MATCH-0.2: a mid-match splice keeps the opponent's player goal totals reconciled with the opponent's own team goal total, not just the manager's side (REAL_WORLD-backed competition)", () => {
  const { state, fixture } = playedRealClubFixture("midmatch-opponent-reconciliation-seed");
  const next = applyMidMatchTacticalChange(state, fixture.id, 25, ALTERNATE_PROFILE, false, null);
  const spliced = next.results[fixture.id];
  const managerIsHome = spliced.homeClubId === "se_club_alingsas_hk";

  const opponentContributions = managerIsHome ? spliced.awayPlayerContributions : spliced.homePlayerContributions;
  const opponentTeamGoals = managerIsHome ? spliced.awayGoals : spliced.homeGoals;
  assert.ok(opponentContributions.length > 0, "the opponent must still have a non-empty roster of contributions after a splice");
  const summedOpponentGoals = opponentContributions.reduce((sum, c) => sum + c.goals, 0);
  assert.equal(summedOpponentGoals, opponentTeamGoals);

  const managerContributions = managerIsHome ? spliced.homePlayerContributions : spliced.awayPlayerContributions;
  const managerTeamGoals = managerIsHome ? spliced.homeGoals : spliced.awayGoals;
  const summedManagerGoals = managerContributions.reduce((sum, c) => sum + c.goals, 0);
  assert.equal(summedManagerGoals, managerTeamGoals);
});
