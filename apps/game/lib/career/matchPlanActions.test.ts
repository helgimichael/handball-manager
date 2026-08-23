// HM-TACTICS-1.1: proves setMatchPlan is a targeted, pure update --
// exactly one fixture's entry changes, everything else (including
// tacticalProfile) is untouched. Mirrors tacticalProfileActions.test.ts's
// exact pattern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { setMatchPlan } from "./matchPlanActions";
import type { MatchPlan } from "../matchPlan/types";

function samplePlan(fixtureId: string, clubId: string): MatchPlan {
  return {
    fixtureId,
    clubId,
    squad: { fixtureId, clubId, players: [{ playerId: "gk1", position: "GK" }] },
    attackStartingUnit: { formation: "NORMAL", slots: [] },
    defenceStartingUnit: { courtSlots: [], goalkeeperId: "gk1" },
    playerUsage: [],
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

test("HM-TACTICS-1.1: setMatchPlan changes only matchPlans -- every other CareerState field is untouched", () => {
  const state = createNewCareerState("matchplan-seed-3", TUMBA_CLUB_ID);
  const next = setMatchPlan(state, "fx1", samplePlan("fx1", state.playerClubId));
  const nextRest: Partial<typeof next> = { ...next };
  delete nextRest.matchPlans;
  const stateRest: Partial<typeof state> = { ...state };
  delete stateRest.matchPlans;
  assert.deepEqual(nextRest, stateRest);
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
