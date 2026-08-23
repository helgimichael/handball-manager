// HM-TACTICS-1.1 Part R: proves the exact chain the Tactics page's own
// effect runs when a fixture has no saved MatchPlan yet -- buildInitialMatchSquad
// -> buildDefaultMatchPlan -> setMatchPlan -- end to end against a real
// CareerState, and that the resulting plan round-trips through
// CareerState correctly and is immediately valid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "../career/newCareer";
import { setMatchPlan } from "../career/matchPlanActions";
import { getCareerSquad } from "../career/careerWorld";
import { buildInitialMatchSquad } from "./careerSquadBridge";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { validateMatchPlan } from "./matchPlan";

test("HM-TACTICS-1.1: a fixture with no saved MatchPlan gets a deterministic, valid default built from the real club squad and it round-trips through CareerState", () => {
  const state = createNewCareerState("tactics-workspace-seed-1", TUMBA_CLUB_ID);
  assert.deepEqual(state.matchPlans, {}, "a fresh career has no saved plans yet");

  const fixtureId = "integration-test-fixture";
  const squad = getCareerSquad(state);
  const initialSquad = buildInitialMatchSquad(squad, fixtureId, state.playerClubId);
  const result = buildDefaultMatchPlan(initialSquad);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.ok(result.plan);

  const validation = validateMatchPlan(result.plan!, squad.map((p) => p.id));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));

  const persisted = setMatchPlan(state, fixtureId, result.plan!);
  assert.deepEqual(persisted.matchPlans[fixtureId], result.plan);
  // Untouched club identity, exactly as Part N requires.
  assert.equal(persisted.tacticalProfile, state.tacticalProfile);
});

test("HM-TACTICS-1.1: buildInitialMatchSquad + buildDefaultMatchPlan is deterministic across two independent runs against the same real squad", () => {
  const state = createNewCareerState("tactics-workspace-seed-2", TUMBA_CLUB_ID);
  const squad = getCareerSquad(state);
  const a = buildDefaultMatchPlan(buildInitialMatchSquad(squad, "fx", state.playerClubId));
  const b = buildDefaultMatchPlan(buildInitialMatchSquad(squad, "fx", state.playerClubId));
  assert.deepEqual(a, b);
});
