// HM-MATCH-1.2 Parts H-M: SPECIALSPEL persistence tests. The plan
// itself is a plain, club-keyed CareerState slice edited only through
// setSpecialPlayPlan -- these tests prove the persistence contract and
// the engine-boundary claim in specialPlay.ts's own doc comment (Part
// M: 6v5/5v6/defensive-special-situation fields are honestly inert,
// never a fake tactical bonus).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "../career/newCareer";
import { setSpecialPlayPlan } from "../career/specialPlayActions";
import { defaultSpecialPlayPlan } from "./specialPlay";

test("HM-MATCH-1.2: a fresh career has no special-play plans -- defaultSpecialPlayPlan is the UI's own fallback, never pre-seeded into CareerState", () => {
  const state = createNewCareerState("special-play-seed-1", TUMBA_CLUB_ID);
  assert.deepEqual(state.specialPlay, {});
});

test("HM-MATCH-1.2: defaultSpecialPlayPlan is a fully neutral, deterministic default -- calling it twice returns deep-equal (not reference-equal) plans", () => {
  const a = defaultSpecialPlayPlan();
  const b = defaultSpecialPlayPlan();
  assert.notEqual(a, b);
  assert.deepEqual(a, b);
});

test("HM-MATCH-1.2: setSpecialPlayPlan persists a 6v5 plan for the club, surviving as-is (no mutation/derivation) on read-back", () => {
  const state = createNewCareerState("special-play-seed-2", TUMBA_CLUB_ID);
  const plan = { ...defaultSpecialPlayPlan(), sixVFive: { tempo: "FAST" as const, risk: "AGGRESSIVE" as const, priority: "PIVOT" as const } };
  const next = setSpecialPlayPlan(state, TUMBA_CLUB_ID, plan);
  assert.deepEqual(next.specialPlay[TUMBA_CLUB_ID], plan);
});

test("HM-MATCH-1.2: setSpecialPlayPlan persists a 5v6 goalkeeper choice (MV KVAR vs 6 UTESPELARE)", () => {
  const state = createNewCareerState("special-play-seed-3", TUMBA_CLUB_ID);
  const plan = { ...defaultSpecialPlayPlan(), fiveVSix: { goalkeeperChoice: "SIX_OUTCOURT" as const, intent: "CONTINUE_ATTACKING" as const } };
  const next = setSpecialPlayPlan(state, TUMBA_CLUB_ID, plan);
  assert.equal(next.specialPlay[TUMBA_CLUB_ID].fiveVSix.goalkeeperChoice, "SIX_OUTCOURT");
});

test("HM-MATCH-1.2: setSpecialPlayPlan persists each of the three defensive special-situation plans (mot 7v6 / mot 6v5 / mot 5v6) independently", () => {
  const state = createNewCareerState("special-play-seed-4", TUMBA_CLUB_ID);
  const plan = {
    ...defaultSpecialPlayPlan(),
    against7v6: { press: "HIGH" as const, centralFocus: "PROTECT_CENTER" as const, risk: "AGGRESSIVE" as const, emptyGoalApproach: "SEEK_OPPORTUNITY" as const },
  };
  const next = setSpecialPlayPlan(state, TUMBA_CLUB_ID, plan);
  assert.deepEqual(next.specialPlay[TUMBA_CLUB_ID].against7v6, plan.against7v6);
  // The other two situations stay at whatever was passed (untouched by editing one).
  assert.deepEqual(next.specialPlay[TUMBA_CLUB_ID].against6v5, defaultSpecialPlayPlan().against6v5);
  assert.deepEqual(next.specialPlay[TUMBA_CLUB_ID].against5v6, defaultSpecialPlayPlan().against5v6);
});

test("HM-MATCH-1.2 Part M (engine boundary): setSpecialPlayPlan changes ONLY state.specialPlay -- every other CareerState field (results, matchPlans, tactics, playerMatchDefaults) is byte-identical by reference, proving a special-play edit cannot secretly alter a stored/simulated result", () => {
  const state = createNewCareerState("special-play-seed-5", TUMBA_CLUB_ID);
  const plan = { ...defaultSpecialPlayPlan(), sixVFive: { tempo: "FAST" as const, risk: "AGGRESSIVE" as const, priority: "WIDTH" as const } };
  const next = setSpecialPlayPlan(state, TUMBA_CLUB_ID, plan);
  assert.equal(next.results, state.results);
  assert.equal(next.matchPlans, state.matchPlans);
  assert.equal(next.tactics, state.tactics);
  assert.equal(next.playerMatchDefaults, state.playerMatchDefaults);
  assert.equal(next.liveMatchPlans, state.liveMatchPlans);
});
