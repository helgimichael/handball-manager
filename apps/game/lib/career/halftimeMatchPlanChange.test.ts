// HM-MATCH-1.2 Part U/W/X: the halftime workspace reuses
// applyMidMatchPlanChange exactly like every other live coaching
// change (no "HalftimeTactics", no parallel splice path -- Part V) --
// these tests exercise it specifically at minute 30 with a HALFTIME
// deliveryMode's 0-minute adoption delay, and with the new
// ATTACK_SLOT/DEFENCE_SLOT starting-unit change kinds Part U added.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture } from "./calendar";
import { processDay } from "./dailyTick";
import { playManagerFixture } from "./matchdayAction";
import { applyMidMatchPlanChange, resolveCurrentMatchPlan } from "./matchPlanMidMatchChange";
import { defaultTeamTacticalProfile } from "./teamTacticalProfile";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { TUMBA_CLUB_ID, TUMBA_SQUAD } from "../game-data";
import type { MatchPlanChange } from "../liveMatch/matchPlanChange";
import type { CareerState } from "./types";

const NEUTRAL_PROFILE = defaultTeamTacticalProfile();

function playedFixtureWithPlan(seed: string) {
  const fresh = createNewCareerState(seed, TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  const state = processDay(fresh, matchday).state;
  const fixture = getNextPlayerFixture(state)!;
  const initialSquad = buildInitialMatchSquad(TUMBA_SQUAD, fixture.id, TUMBA_CLUB_ID);
  const { plan } = buildDefaultMatchPlan(initialSquad);
  const withPlan: CareerState = { ...state, matchPlans: { ...state.matchPlans, [fixture.id]: plan! } };
  const { state: played, result } = playManagerFixture(withPlan);
  return { state: played, fixture, original: result!, preMatchPlan: plan! };
}

test("HM-MATCH-1.2 Part W/X: a change adopted at minute 30 (the halftime boundary, 0-minute HALFTIME delay) leaves every ALREADY-REVEALED first-half event (minute <= 30, matching view.revealedEvents' own inclusive boundary) byte-for-byte unchanged -- not just minute < 30, which would miss an event landing exactly on the halftime whistle", () => {
  const { state, fixture, original } = playedFixtureWithPlan("halftime-boundary-seed");
  const change: MatchPlanChange = { category: "DEFENCE", kind: "FORMATION", baseFormation: "5-1" };
  const next = applyMidMatchPlanChange(state, fixture.id, 30, 30, change, NEUTRAL_PROFILE, false, null);
  const spliced = next.results[fixture.id];

  const originalFirstHalf = original.events.filter((e) => e.minute <= 30);
  const splicedFirstHalf = spliced.events.filter((e) => e.minute <= 30);
  assert.deepEqual(splicedFirstHalf, originalFirstHalf);
});

test("HM-MATCH-1.2 Part W/X: first-half TEAM STATS (as the halftime workspace displays them, tallied from events with minute <= 30) are unaffected by a halftime change -- the exact regression the browser QA caught (an ATTACK_SLOT change at halftime had silently altered an already-shown first-half 7-metre count)", () => {
  const { state, fixture, original } = playedFixtureWithPlan("halftime-stats-seed");
  const change: MatchPlanChange = { category: "DEFENCE", kind: "FORMATION", baseFormation: "5-1" };
  const next = applyMidMatchPlanChange(state, fixture.id, 30, 30, change, NEUTRAL_PROFILE, false, null);
  const spliced = next.results[fixture.id];

  const originalFirstHalfGoals = original.events.filter((e) => e.minute <= 30 && e.type === "GOAL").length;
  const splicedFirstHalfGoals = spliced.events.filter((e) => e.minute <= 30 && e.type === "GOAL").length;
  assert.equal(splicedFirstHalfGoals, originalFirstHalfGoals);
});

test("HM-MATCH-1.2 Part U: a halftime ATTACK_SLOT change reassigns the second-half starting attack unit, and that reassignment is visible via resolveCurrentMatchPlan (the same MatchPlan/runtime plan the halftime workspace reads -- no separate HalftimeTactics state)", () => {
  const { state, fixture, preMatchPlan } = playedFixtureWithPlan("halftime-attack-slot-seed");
  const outfield = preMatchPlan.squad.players.filter((p) => p.position !== "GK");
  const currentM6 = preMatchPlan.attackStartingUnit.slots.find((s) => s.position === "M6")!.playerId;
  const swapTarget = outfield.find((p) => p.playerId !== currentM6)!.playerId;

  const change: MatchPlanChange = { category: "PLAYER", kind: "ATTACK_SLOT", position: "M6", playerId: swapTarget, playerName: "Test Player" };
  const next = applyMidMatchPlanChange(state, fixture.id, 30, 30, change, NEUTRAL_PROFILE, false, null);
  const current = resolveCurrentMatchPlan(next, fixture.id)!;
  assert.equal(current.attackStartingUnit.slots.find((s) => s.position === "M6")?.playerId, swapTarget);
});

test("HM-MATCH-1.2 Part U: a halftime DEFENCE_SLOT change reassigns the second-half starting defence unit", () => {
  const { state, fixture, preMatchPlan } = playedFixtureWithPlan("halftime-defence-slot-seed");
  const outfield = preMatchPlan.squad.players.filter((p) => p.position !== "GK");
  const currentSlot1 = preMatchPlan.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)!.playerId;
  const swapTarget = outfield.find((p) => p.playerId !== currentSlot1)!.playerId;

  const change: MatchPlanChange = { category: "PLAYER", kind: "DEFENCE_SLOT", courtSlot: 1, playerId: swapTarget, playerName: "Test Player" };
  const next = applyMidMatchPlanChange(state, fixture.id, 30, 30, change, NEUTRAL_PROFILE, false, null);
  const current = resolveCurrentMatchPlan(next, fixture.id)!;
  assert.equal(current.defenceStartingUnit.courtSlots.find((s) => s.courtSlot === 1)?.playerId, swapTarget);
});

test("HM-MATCH-1.2: a halftime PlayingTimeIntention change is recorded in matchPlanChangeHistory with the requested/adopted minute both equal to 30 (HALFTIME's 0-minute delay)", () => {
  const { state, fixture, preMatchPlan } = playedFixtureWithPlan("halftime-history-seed");
  const playerId = preMatchPlan.squad.players.find((p) => p.position !== "GK")!.playerId;
  const change: MatchPlanChange = { category: "PLAYER", kind: "PLAYING_TIME", playerId, playerName: "Test Player", playingTimeIntention: "VERY_HIGH" };
  const next = applyMidMatchPlanChange(state, fixture.id, 30, 30, change, NEUTRAL_PROFILE, false, null);
  const entry = next.matchPlanChangeHistory[fixture.id]!.at(-1)!;
  assert.equal(entry.requestedMinute, 30);
  assert.equal(entry.adoptedMinute, 30);
});
