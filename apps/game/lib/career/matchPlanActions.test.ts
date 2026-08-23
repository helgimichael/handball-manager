// HM-TACTICS-1.1: proves setMatchPlan is a targeted, pure update --
// exactly one fixture's entry changes, everything else (including
// tacticalProfile) is untouched. Mirrors tacticalProfileActions.test.ts's
// exact pattern.
//
// HM-MATCH-1.1 Part 1/2: setMatchPlan is ALSO the one place a pre-match
// edit syncs the manager's persistent `tactics`/`playerMatchDefaults`
// templates forward -- deliberately, not accidentally, per this
// milestone's own architecture correction (Tactics persists across
// fixtures; MatchPlan is fixture-specific). The "every other field
// untouched" test below is updated to name `tactics`/`playerMatchDefaults`
// as the two additional fields this function is allowed to change,
// rather than silently drifting out of date with the new contract.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { setMatchPlan } from "./matchPlanActions";
import type { MatchPlan } from "../matchPlan/types";

function samplePlan(fixtureId: string, clubId: string, playerUsage: MatchPlan["playerUsage"] = []): MatchPlan {
  return {
    fixtureId,
    clubId,
    squad: { fixtureId, clubId, players: [{ playerId: "gk1", position: "GK" }] },
    attackStartingUnit: { formation: "NORMAL", slots: [] },
    defenceStartingUnit: { courtSlots: [], goalkeeperId: "gk1" },
    playerUsage,
    substitutionPairs: [],
    depthHierarchy: [],
    attackPlan: {
      tempo: "BALANCED",
      structureFreedom: "BALANCED",
      pivotUsage: "MEDIUM",
      twoVTwoEmphasis: "MEDIUM",
      breakthroughEmphasis: "MEDIUM",
      shootingEmphasis: "MEDIUM",
      wingUsage: "MEDIUM",
      ballCirculation: "BALANCED",
      sevenVSixPolicy: { level: "SITUATIONAL", activeFromKickoff: false },
    },
    defencePlan: { baseFormation: "6-0", defensiveDepth: "STANDARD", contactIntent: "MEDIUM", coverBlockingEmphasis: "MEDIUM", ballOrientedPressure: "MEDIUM", riskLevel: "MEDIUM" },
    transitionPlan: { offensiveTransitionIntent: "MEDIUM", defensiveRetreatIntent: "MEDIUM", firstWaveAggression: "MEDIUM", goalkeeperInitiation: "MEDIUM", substitutionPriority: "BALANCED" },
  };
}

test("HM-TACTICS-1.1: a fresh career starts with an empty matchPlans store", () => {
  const state = createNewCareerState("matchplan-seed-1", TUMBA_CLUB_ID);
  assert.deepEqual(state.matchPlans, {});
});

test("HM-TACTICS-1.1: setMatchPlan adds a fixture's plan and leaves tacticalProfile untouched", () => {
  const state = createNewCareerState("matchplan-seed-2", TUMBA_CLUB_ID);
  const plan = samplePlan("fx1", state.playerClubId);
  const next = setMatchPlan(state, "fx1", plan);
  assert.deepEqual(next.matchPlans, { fx1: plan });
  assert.equal(next.tacticalProfile, state.tacticalProfile, "tacticalProfile object reference must be untouched");
});

test("HM-TACTICS-1.1/HM-MATCH-1.1: setMatchPlan changes only matchPlans, tactics, and playerMatchDefaults -- every other CareerState field is untouched", () => {
  const state = createNewCareerState("matchplan-seed-3", TUMBA_CLUB_ID);
  const next = setMatchPlan(state, "fx1", samplePlan("fx1", state.playerClubId));
  const nextRest: Partial<typeof next> = { ...next };
  delete nextRest.matchPlans;
  delete nextRest.tactics;
  delete nextRest.playerMatchDefaults;
  const stateRest: Partial<typeof state> = { ...state };
  delete stateRest.matchPlans;
  delete stateRest.tactics;
  delete stateRest.playerMatchDefaults;
  assert.deepEqual(nextRest, stateRest);
});

test("HM-MATCH-1.1 #1/#2: a pre-match plan edit persists the club's attackPlan/defencePlan/transitionPlan into state.tactics, independently of the fixture-scoped matchPlans entry", () => {
  const state = createNewCareerState("tactics-persist-seed-1", TUMBA_CLUB_ID);
  const plan = samplePlan("fx1", state.playerClubId);
  const next = setMatchPlan(state, "fx1", plan);
  assert.deepEqual(next.tactics[state.playerClubId], { attackPlan: plan.attackPlan, defencePlan: plan.defencePlan, transitionPlan: plan.transitionPlan });
  // Independence: a later edit for a DIFFERENT fixture with different tactics updates the SAME club-keyed tactics entry, not a fixture-keyed one.
  const revisedPlan = { ...samplePlan("fx2", state.playerClubId), attackPlan: { ...plan.attackPlan, tempo: "FAST" as const } };
  const next2 = setMatchPlan(next, "fx2", revisedPlan);
  assert.equal(next2.tactics[state.playerClubId].attackPlan.tempo, "FAST");
  assert.equal(next2.matchPlans.fx1.attackPlan.tempo, "BALANCED", "fixture fx1's own already-saved MatchPlan must not retroactively change just because a later fixture's tactics were edited");
});

test("HM-MATCH-1.1 #3/#4: a player's matchRole persists into state.playerMatchDefaults from a pre-match edit, and a fixture-specific override does not mutate that persistent default", () => {
  const state = createNewCareerState("player-default-persist-seed", TUMBA_CLUB_ID);
  const usage: MatchPlan["playerUsage"] = [{ playerId: "p1", matchRole: "KEY_PLAYER", playingTimeIntention: "VERY_HIGH", phaseUsage: "BOTH_PHASES" }];
  const plan = samplePlan("fx1", state.playerClubId, usage);
  const next = setMatchPlan(state, "fx1", plan);
  assert.deepEqual(next.playerMatchDefaults.p1, { matchRole: "KEY_PLAYER", playingTimeIntention: "VERY_HIGH", phaseUsage: "BOTH_PHASES" });

  // A fixture-specific override for a DIFFERENT fixture: setMatchPlan (the pre-match write path) is what a real fixture-specific edit would still go through pre-match, so this proves the LATEST pre-match edit wins -- the separate live-coaching write path (matchPlanMidMatchChange.ts) never calls setMatchPlan at all, so it structurally cannot reach this store (verified by that module's own code never importing setMatchPlan).
  const overrideUsage: MatchPlan["playerUsage"] = [{ playerId: "p1", matchRole: "KEY_PLAYER", playingTimeIntention: "HIGH", phaseUsage: "ATTACK_ONLY" }];
  const overridePlan = samplePlan("fx2", state.playerClubId, overrideUsage);
  const next2 = setMatchPlan(next, "fx2", overridePlan);
  assert.deepEqual(next2.playerMatchDefaults.p1, { matchRole: "KEY_PLAYER", playingTimeIntention: "HIGH", phaseUsage: "ATTACK_ONLY" }, "the most recent pre-match edit is the new persistent default");
  assert.deepEqual(next2.matchPlans.fx1.playerUsage[0], { playerId: "p1", matchRole: "KEY_PLAYER", playingTimeIntention: "VERY_HIGH", phaseUsage: "BOTH_PHASES" }, "fixture fx1's own already-saved MatchPlan entry must not retroactively change");
});

test("HM-TACTICS-1.1: setMatchPlan for a second fixture never clobbers the first fixture's plan", () => {
  const state = createNewCareerState("matchplan-seed-4", TUMBA_CLUB_ID);
  const planA = samplePlan("fx_a", state.playerClubId);
  const planB = samplePlan("fx_b", state.playerClubId);
  const afterA = setMatchPlan(state, "fx_a", planA);
  const afterB = setMatchPlan(afterA, "fx_b", planB);
  assert.deepEqual(afterB.matchPlans, { fx_a: planA, fx_b: planB });
});

test("HM-TACTICS-1.1: setMatchPlan replaces an existing fixture's plan and does not mutate the original state object", () => {
  const state = createNewCareerState("matchplan-seed-5", TUMBA_CLUB_ID);
  const before = JSON.stringify(state.matchPlans);
  const afterA = setMatchPlan(state, "fx1", samplePlan("fx1", state.playerClubId));
  const revised = { ...samplePlan("fx1", state.playerClubId), attackPlan: { ...samplePlan("fx1", state.playerClubId).attackPlan, tempo: "FAST" as const } };
  const afterB = setMatchPlan(afterA, "fx1", revised);
  assert.equal(afterB.matchPlans.fx1.attackPlan.tempo, "FAST");
  assert.equal(JSON.stringify(state.matchPlans), before, "original state object must be untouched (immutable update)");
});
