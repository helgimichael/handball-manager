// Historical match adapter regression. Production lifecycle is covered by productionMatch.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { getNextPlayerFixture } from "./calendar";
import { processDay } from "./dailyTick";
import { playManagerFixtureLegacy as playManagerFixture } from "./legacy/matchday";
import { applyMidMatchPlanChange, resolveCurrentMatchPlan } from "./matchPlanMidMatchChange";
import { applyMidMatchTacticalChange } from "./tacticalMidMatchChange";
import { defaultTeamTacticalProfile } from "./teamTacticalProfile";
import { computeTeamUsageTrace } from "./matchUsageEngine";
import { computeTeamTacticalPlanTrace } from "./tacticalPlanEffects";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import { TUMBA_CLUB_ID, TUMBA_SQUAD } from "../game-data";
import { applyMatchPlanChange, type MatchPlanChange } from "../liveMatch/matchPlanChange";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, type OutcourtAttribute } from "../rating/types";
import type { GeneratedAttributeValue } from "../rating/generation/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { CareerState } from "./types";

function buildGoalkeeperRating(playerId: string, ca: number, attrValue: number): GameplayPlayerRating {
  const attributes = {} as Record<(typeof GOALKEEPER_ATTRIBUTES)[number], GeneratedAttributeValue>;
  for (const attr of GOALKEEPER_ATTRIBUTES) attributes[attr] = { value: attrValue, origin: "GENERATED_PRIOR" };
  return { playerId, position: "GK", ca, pa: ca, caSource: "GENERATED_GAME_PRIOR", branch: { branch: "GOALKEEPER", attributes }, attackRoleProficiencies: [], defenceRoleProficiencies: [], attributeGenerationModelVersion: "test", locked: false };
}

const NEUTRAL_PROFILE = defaultTeamTacticalProfile();

function stateAtMatchdayWithPlan(seed = "coaching-seed") {
  const fresh = createNewCareerState(seed, TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  const state = processDay(fresh, matchday).state;
  const fixture = getNextPlayerFixture(state)!;
  const initialSquad = buildInitialMatchSquad(TUMBA_SQUAD, fixture.id, TUMBA_CLUB_ID);
  const { plan } = buildDefaultMatchPlan(initialSquad);
  const withPlan: CareerState = { ...state, matchPlans: { ...state.matchPlans, [fixture.id]: plan! } };
  return { state: withPlan, fixture, preMatchPlan: plan! };
}

function playedFixtureWithPlan(seed = "coaching-seed") {
  const { state, fixture, preMatchPlan } = stateAtMatchdayWithPlan(seed);
  const { state: played, result } = playManagerFixture(state);
  return { state: played, fixture, original: result!, preMatchPlan };
}

function outfieldPlayerId(state: CareerState, fixtureId: string): string {
  const plan = resolveCurrentMatchPlan(state, fixtureId)!;
  const usage = plan.playerUsage.find((u) => plan.squad.players.find((p) => p.playerId === u.playerId)?.position !== "GK");
  return usage!.playerId;
}

const FORMATION_CHANGE: MatchPlanChange = { category: "DEFENCE", kind: "FORMATION", baseFormation: "5-1" };
const TEMPO_CHANGE: MatchPlanChange = { category: "ATTACK", kind: "TEMPO", tempo: "FAST" };

test("HM-COACHING-1.0: requesting a live change never rewrites the saved PRE-MATCH plan", () => {
  const { state, fixture, preMatchPlan } = playedFixtureWithPlan("preserve-premtach-seed");
  const next = applyMidMatchPlanChange(state, fixture.id, 20, 17, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  assert.deepEqual(next.matchPlans[fixture.id], preMatchPlan, "state.matchPlans (the pre-match plan) must be untouched by a live change");
});

test("HM-COACHING-1.0: an adopted change modifies the CURRENT MatchPlan (state.liveMatchPlans), diverging from the pre-match plan", () => {
  const { state, fixture, preMatchPlan } = playedFixtureWithPlan("current-plan-mutation-seed");
  const next = applyMidMatchPlanChange(state, fixture.id, 20, 17, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  const current = resolveCurrentMatchPlan(next, fixture.id)!;
  assert.equal(current.defencePlan.baseFormation, "5-1");
  assert.notEqual(preMatchPlan.defencePlan.baseFormation, "5-1", "test fixture assumption: the default plan must not already be 5-1, otherwise this test can't detect a divergence");
});

test("HM-COACHING-1.0: before any live change, the current plan resolves to the pre-match plan (currentMatchPlan = preMatchPlan at kickoff)", () => {
  const { state, fixture, preMatchPlan } = playedFixtureWithPlan("kickoff-equivalence-seed");
  assert.deepEqual(resolveCurrentMatchPlan(state, fixture.id), preMatchPlan);
});

test("HM-COACHING-1.0: a formation change only affects future match behavior -- the already-revealed prefix is byte-for-byte unchanged", () => {
  const { state, fixture, original } = playedFixtureWithPlan("formation-prefix-seed");
  const adoptionMinute = 22;
  const next = applyMidMatchPlanChange(state, fixture.id, adoptionMinute, 19, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  const spliced = next.results[fixture.id];

  const originalPrefix = original.events.filter((e) => e.minute < adoptionMinute);
  const splicedPrefix = spliced.events.filter((e) => e.minute < adoptionMinute);
  assert.deepEqual(splicedPrefix, originalPrefix);
});

test("HM-COACHING-1.0: a formation change modifies the future tactical effect that feeds the resimulated segment -- verified directly against HM-TACTICS-1.3's own adjustment function (the exact same one applyMidMatchPlanChange calls), against a squad genuinely suited to one formation over the other (mirrors tacticalPlanEffects.test.ts's own #8, since a neutral/empty-ratings squad has zero tactical fit either way and can't show this)", () => {
  const { state, fixture } = playedFixtureWithPlan("formation-effect-seed");
  const basePlan = resolveCurrentMatchPlan(state, fixture.id)!;
  const changedPlan = applyMatchPlanChange(basePlan, FORMATION_CHANGE);
  assert.notEqual(basePlan.defencePlan.baseFormation, changedPlan.defencePlan.baseFormation);

  const attributes = {} as Record<OutcourtAttribute, GeneratedAttributeValue>;
  for (const attr of OUTCOURT_ATTRIBUTES) attributes[attr] = { value: 10, origin: "GENERATED_PRIOR" as const };
  for (const attr of ["DEFENSIVE_POSITIONING", "CENTRAL_DEFENCE", "COVERING"] as const) attributes[attr] = { value: 19, origin: "GENERATED_PRIOR" };
  for (const attr of ["BALL_WINNING", "CONTACT_ABILITY", "LATERAL_DEFENCE"] as const) attributes[attr] = { value: 2, origin: "GENERATED_PRIOR" };
  const managerRatings: GameplayPlayerRating[] = basePlan.squad.players.map((p) =>
    p.position === "GK"
      ? buildGoalkeeperRating(p.playerId, 140, 14)
      : { playerId: p.playerId, position: p.position, ca: 140, pa: 140, caSource: "GENERATED_GAME_PRIOR", branch: { branch: "OUTCOURT", attributes }, attackRoleProficiencies: [], defenceRoleProficiencies: [], attributeGenerationModelVersion: "test", locked: false },
  );

  // Directly against computeTeamTacticalPlanTrace's own defenceBonus --
  // the same function computeTacticalMatchPlanAdjustment (and therefore
  // applyMidMatchPlanChange) composes it from, isolating the formation's
  // own effect from the home/away attackBonus-vs-opponent's-defenceBonus
  // asymmetry that the combined adjustment formula introduces.
  const changedUsageTrace = computeTeamUsageTrace(changedPlan, "formation-effect-usage-seed");
  const baseUsageTrace = computeTeamUsageTrace(basePlan, "formation-effect-usage-seed");
  const changedTrace = computeTeamTacticalPlanTrace(changedPlan, managerRatings, changedUsageTrace, null);
  const baseTrace = computeTeamTacticalPlanTrace(basePlan, managerRatings, baseUsageTrace, null);

  assert.notEqual(changedTrace.defenceBonus, baseTrace.defenceBonus, "a formation change must change the computed defenceBonus for a squad genuinely suited to one formation over the other");
});

test("HM-COACHING-1.0: a later change never retroactively alters an earlier, already-spliced segment", () => {
  const { state, fixture, original } = playedFixtureWithPlan("no-retroactive-seed");
  const firstAdoption = 15;
  const afterFirst = applyMidMatchPlanChange(state, fixture.id, firstAdoption, 12, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  const firstWindow = afterFirst.results[fixture.id].events.filter((e) => e.minute >= firstAdoption && e.minute < 25);

  const secondAdoption = 25;
  const afterSecond = applyMidMatchPlanChange(afterFirst, fixture.id, secondAdoption, 22, TEMPO_CHANGE, NEUTRAL_PROFILE, false, null);
  const windowAfterSecondChange = afterSecond.results[fixture.id].events.filter((e) => e.minute >= firstAdoption && e.minute < 25);

  assert.deepEqual(windowAfterSecondChange, firstWindow, "the [firstAdoption, secondAdoption) window must survive the later splice's own prefix preservation");

  const originalPrefix = original.events.filter((e) => e.minute < firstAdoption);
  const finalPrefix = afterSecond.results[fixture.id].events.filter((e) => e.minute < firstAdoption);
  assert.deepEqual(finalPrefix, originalPrefix);
});

test("HM-COACHING-1.0: a PlayingTimeIntention change affects future exposure -- raising a bench player to VERY_HIGH changes who is on court after adoption (averaged across seeded fixtures)", () => {
  let sawDifference = false;
  for (let i = 0; i < 15 && !sawDifference; i += 1) {
    const { state, fixture } = playedFixtureWithPlan(`playing-time-exposure-seed-${i}`);
    const plan = resolveCurrentMatchPlan(state, fixture.id)!;
    // HM-MATCH-USAGE-1.4: must be a genuine BENCH player (not one of the
    // selected starting units) -- a starting player's own window
    // eligibility is now unconditionally the full match (Part 6), so
    // raising an already-starting player's intention can no longer, by
    // itself, change which windows they're eligible for; only a bench
    // player's own eligibility window widens with a higher intention.
    const attackStartingIds = new Set(plan.attackStartingUnit.slots.map((s) => s.playerId));
    const defenceStartingIds = new Set([...plan.defenceStartingUnit.courtSlots.map((s) => s.playerId), plan.defenceStartingUnit.goalkeeperId]);
    const target = plan.playerUsage.find(
      (u) =>
        u.playingTimeIntention !== "VERY_HIGH" &&
        plan.squad.players.find((p) => p.playerId === u.playerId)?.position !== "GK" &&
        !attackStartingIds.has(u.playerId) &&
        !defenceStartingIds.has(u.playerId),
    )!;
    const change: MatchPlanChange = { category: "PLAYER", kind: "PLAYING_TIME", playerId: target.playerId, playerName: "Test Player", playingTimeIntention: "VERY_HIGH" };
    const adoptionMinute = 20;

    const withChange = applyMidMatchPlanChange(state, fixture.id, adoptionMinute, 17, change, NEUTRAL_PROFILE, false, null);
    const withoutChange = applyMidMatchPlanChange(
      state,
      fixture.id,
      adoptionMinute,
      17,
      { category: "PLAYER", kind: "PLAYING_TIME", playerId: target.playerId, playerName: "Test Player", playingTimeIntention: target.playingTimeIntention },
      NEUTRAL_PROFILE,
      false,
      null,
    );
    if (JSON.stringify(withChange.results[fixture.id].events) !== JSON.stringify(withoutChange.results[fixture.id].events)) {
      sawDifference = true;
    }
  }
  assert.ok(sawDifference, "expected at least one of 15 seeded fixtures to show a PlayingTimeIntention-change effect");
});

test("HM-COACHING-1.0: a PhaseUsage change affects future exposure the same way (averaged across seeded fixtures)", () => {
  let sawDifference = false;
  for (let i = 0; i < 15 && !sawDifference; i += 1) {
    const { state, fixture } = playedFixtureWithPlan(`phase-usage-exposure-seed-${i}`);
    const playerId = outfieldPlayerId(state, fixture.id);
    const adoptionMinute = 20;
    const toAttackOnly: MatchPlanChange = { category: "PLAYER", kind: "PHASE_USAGE", playerId, playerName: "Test Player", phaseUsage: "ATTACK_ONLY" };
    const toDefenceOnly: MatchPlanChange = { category: "PLAYER", kind: "PHASE_USAGE", playerId, playerName: "Test Player", phaseUsage: "DEFENCE_ONLY" };

    const attackOnly = applyMidMatchPlanChange(state, fixture.id, adoptionMinute, 17, toAttackOnly, NEUTRAL_PROFILE, false, null);
    const defenceOnly = applyMidMatchPlanChange(state, fixture.id, adoptionMinute, 17, toDefenceOnly, NEUTRAL_PROFILE, false, null);
    if (JSON.stringify(attackOnly.results[fixture.id].events) !== JSON.stringify(defenceOnly.results[fixture.id].events)) {
      sawDifference = true;
    }
  }
  assert.ok(sawDifference, "expected at least one of 15 seeded fixtures to show a PhaseUsage-change effect");
});

test("HM-COACHING-1.0: a specialist-pair change updates the current plan's substitutionPairs and affects future phase usage (averaged across seeded fixtures)", () => {
  let sawDifference = false;
  for (let i = 0; i < 15 && !sawDifference; i += 1) {
    const { state, fixture } = playedFixtureWithPlan(`specialist-pair-seed-${i}`);
    const plan = resolveCurrentMatchPlan(state, fixture.id)!;
    const outfield = plan.playerUsage.filter((u) => plan.squad.players.find((p) => p.playerId === u.playerId)?.position !== "GK");
    const attacker = outfield[0]!.playerId;
    const defender = outfield[1]!.playerId;
    const pairChange: MatchPlanChange = { category: "PLAYER", kind: "SPECIALIST_PAIR", attackPlayerId: attacker, attackPlayerName: "A", defencePlayerId: defender, defencePlayerName: "D" };
    const adoptionMinute = 20;

    const withPair = applyMidMatchPlanChange(state, fixture.id, adoptionMinute, 17, pairChange, NEUTRAL_PROFILE, false, null);
    const currentPlan = resolveCurrentMatchPlan(withPair, fixture.id)!;
    assert.ok(currentPlan.substitutionPairs.some((p) => p.attackPlayerId === attacker && p.defencePlayerId === defender));

    const withoutPair = applyMidMatchPlanChange(state, fixture.id, adoptionMinute, 17, TEMPO_CHANGE, NEUTRAL_PROFILE, false, null);
    if (JSON.stringify(withPair.results[fixture.id].events) !== JSON.stringify(withoutPair.results[fixture.id].events)) {
      sawDifference = true;
    }
  }
  assert.ok(sawDifference, "expected at least one of 15 seeded fixtures to show a specialist-pair effect");
});

test("HM-COACHING-1.0: a live 7v6 change reuses the EXISTING mechanism (applyMidMatchTacticalChange), not a duplicate path -- composing a MatchPlan change with 7v6 ON produces a different result than OFF (averaged across seeded fixtures)", () => {
  let sawDifference = false;
  let sawDifferenceOnOnlyMechanism = false;
  for (let i = 0; i < 15 && !(sawDifference && sawDifferenceOnOnlyMechanism); i += 1) {
    const { state, fixture } = playedFixtureWithPlan(`live-7v6-seed-${i}`);
    const adoptionMinute = 20;
    const on = applyMidMatchPlanChange(state, fixture.id, adoptionMinute, 17, TEMPO_CHANGE, NEUTRAL_PROFILE, true, null);
    const off = applyMidMatchPlanChange(state, fixture.id, adoptionMinute, 17, TEMPO_CHANGE, NEUTRAL_PROFILE, false, null);
    if (JSON.stringify(on.results[fixture.id].events) !== JSON.stringify(off.results[fixture.id].events)) {
      sawDifference = true;
    }

    // The same tacticalMidMatchChange.ts machinery underlies both -- verified
    // by confirming applyMidMatchTacticalChange alone (profile/7v6 only, no
    // MatchPlan change) is ALSO sensitive to the same sevenVSixActive flag,
    // proving no second, parallel 7v6 implementation was introduced here.
    const onOnly = applyMidMatchTacticalChange(state, fixture.id, adoptionMinute, NEUTRAL_PROFILE, true, null);
    const offOnly = applyMidMatchTacticalChange(state, fixture.id, adoptionMinute, NEUTRAL_PROFILE, false, null);
    if (JSON.stringify(onOnly.results[fixture.id].events) !== JSON.stringify(offOnly.results[fixture.id].events)) {
      sawDifferenceOnOnlyMechanism = true;
    }
  }
  assert.ok(sawDifference, "expected at least one of 15 seeded fixtures to show a 7v6 effect when composed with a MatchPlan change");
  assert.ok(sawDifferenceOnOnlyMechanism, "expected the existing profile-only 7v6 mechanism to also be sensitive to the flag, proving no duplicate implementation");
});

test("HM-COACHING-1.0: determinism -- the identical change applied twice from the identical starting state produces an identical spliced result", () => {
  const { state, fixture } = playedFixtureWithPlan("determinism-same-seed");
  const a = applyMidMatchPlanChange(state, fixture.id, 20, 17, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  const b = applyMidMatchPlanChange(state, fixture.id, 20, 17, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  assert.deepEqual(a.results[fixture.id], b.results[fixture.id]);
  assert.deepEqual(a.liveMatchPlans[fixture.id], b.liveMatchPlans[fixture.id]);
});

test("HM-COACHING-1.0: determinism -- materially different changes at the same minute produce different results at least some of the time (averaged across seeded fixtures, since a single tiny adjustment delta can coincidentally land on the same sampled outcome for one seed)", () => {
  // HM-DATA-ALLSVENSKAN-1.0: widened from 15 to 50 seeds -- the
  // divergence rate for this particular (FORMATION_CHANGE vs
  // TEMPO_CHANGE) comparison is genuinely low (~4%, confirmed by direct
  // measurement), so a 15-seed sample has a real (~54%) chance of never
  // hitting a divergent seed even when the underlying logic is correct
  // -- this got exposed (not caused) by the Allsvenskan club-list
  // correction shifting which specific match situations seeds 0-14 draw.
  let sawDifference = false;
  for (let i = 0; i < 50 && !sawDifference; i += 1) {
    const { state, fixture } = playedFixtureWithPlan(`determinism-diff-seed-${i}`);
    const a = applyMidMatchPlanChange(state, fixture.id, 20, 17, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
    const b = applyMidMatchPlanChange(state, fixture.id, 20, 17, TEMPO_CHANGE, NEUTRAL_PROFILE, false, null);
    if (JSON.stringify(a.results[fixture.id].events) !== JSON.stringify(b.results[fixture.id].events)) {
      sawDifference = true;
    }
  }
  assert.ok(sawDifference, "expected at least one of 15 seeded fixtures to show a different spliced suffix for a materially different MatchPlan change");
});

test("HM-COACHING-1.0: multiple sequential changes preserve order -- the second change's effect layers on top of the first's already-adopted plan", () => {
  const { state, fixture } = playedFixtureWithPlan("sequential-order-seed");
  const afterFirst = applyMidMatchPlanChange(state, fixture.id, 15, 12, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  const afterSecond = applyMidMatchPlanChange(afterFirst, fixture.id, 25, 22, TEMPO_CHANGE, NEUTRAL_PROFILE, false, null);

  const finalPlan = resolveCurrentMatchPlan(afterSecond, fixture.id)!;
  assert.equal(finalPlan.defencePlan.baseFormation, "5-1", "the first change must still be in effect");
  assert.equal(finalPlan.attackPlan.tempo, "FAST", "the second change must also be in effect");

  const history = afterSecond.matchPlanChangeHistory[fixture.id]!;
  assert.equal(history.length, 2);
  assert.equal(history[0]!.requestedMinute, 12);
  assert.equal(history[1]!.requestedMinute, 22);
});

test("HM-COACHING-1.0: change history records requested and adopted timing correctly", () => {
  const { state, fixture } = playedFixtureWithPlan("history-timing-seed");
  const next = applyMidMatchPlanChange(state, fixture.id, 23, 20, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  const history = next.matchPlanChangeHistory[fixture.id]!;
  assert.equal(history.length, 1);
  assert.equal(history[0]!.requestedMinute, 20);
  assert.equal(history[0]!.adoptedMinute, 23);
  assert.equal(history[0]!.category, "DEFENCE");
  assert.ok(history[0]!.label.length > 0);
});

test("HM-COACHING-1.0: is a safe no-op when the fixture has no stored result, or the adoption minute is already at/past full time", () => {
  const { state, fixture } = playedFixtureWithPlan("noop-seed");
  const noResult = applyMidMatchPlanChange(state, "no-such-fixture", 20, 17, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  assert.equal(noResult, state);

  const pastFullTime = applyMidMatchPlanChange(state, fixture.id, 60, 57, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  assert.equal(pastFullTime, state);
});

test("HM-COACHING-1.0: final score and stats stay internally consistent after a MatchPlan splice", () => {
  const { state, fixture } = playedFixtureWithPlan("consistency-seed");
  const next = applyMidMatchPlanChange(state, fixture.id, 30, 27, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  const spliced = next.results[fixture.id];

  const homeGoalEvents = spliced.events.filter((e) => e.type === "GOAL" && e.side === "home").length;
  const awayGoalEvents = spliced.events.filter((e) => e.type === "GOAL" && e.side === "away").length;
  assert.equal(homeGoalEvents, spliced.homeGoals);
  assert.equal(awayGoalEvents, spliced.awayGoals);

  const managerIsHome = spliced.homeClubId === TUMBA_CLUB_ID;
  const managerContributions = managerIsHome ? spliced.homePlayerContributions : spliced.awayPlayerContributions;
  const managerGoals = managerIsHome ? spliced.homeGoals : spliced.awayGoals;
  assert.equal(managerContributions.reduce((sum, c) => sum + c.goals, 0), managerGoals);
});

test("HM-COACHING-1.0: a manager Live Match with no live change at all completes with results identical to the original simulation (no accidental behavior change)", () => {
  const { state, fixture, original } = playedFixtureWithPlan("untouched-seed");
  assert.deepEqual(state.results[fixture.id], original);
  assert.equal(state.liveMatchPlans[fixture.id], undefined);
  assert.deepEqual(state.matchPlanChangeHistory[fixture.id] ?? [], []);
});

test("HM-COACHING-1.0: save-reload safety -- a CareerState with an adopted live change round-trips through JSON without losing liveMatchPlans/matchPlanChangeHistory", () => {
  const { state, fixture } = playedFixtureWithPlan("save-reload-seed");
  const next = applyMidMatchPlanChange(state, fixture.id, 20, 17, FORMATION_CHANGE, NEUTRAL_PROFILE, false, null);
  const roundTripped: CareerState = JSON.parse(JSON.stringify(next));
  assert.deepEqual(roundTripped.liveMatchPlans[fixture.id], next.liveMatchPlans[fixture.id]);
  assert.deepEqual(roundTripped.matchPlanChangeHistory[fixture.id], next.matchPlanChangeHistory[fixture.id]);
  assert.deepEqual(roundTripped.matchPlans[fixture.id], next.matchPlans[fixture.id]);
});

test("HM-COACHING-1.0: a fixture with no saved pre-match plan still resolves a current plan (falls back to the same deterministic default any unplanned fixture gets)", () => {
  const fresh = createNewCareerState("no-saved-plan-seed", TUMBA_CLUB_ID);
  const matchday = getNextPlayerFixture(fresh)!.date;
  const state = processDay(fresh, matchday).state;
  const fixture = getNextPlayerFixture(state)!;
  const { state: played } = playManagerFixture(state);
  const current = resolveCurrentMatchPlan(played, fixture.id);
  assert.ok(current !== null);
});
