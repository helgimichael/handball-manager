import { test } from "node:test";
import assert from "node:assert/strict";
import { TUMBA_CLUB_ID } from "../game-data";
import { createNewCareerState } from "./newCareer";
import { updateTacticalProfile } from "./tacticalProfileActions";

test("updateTacticalProfile changes only the requested field(s), leaving the rest of the profile untouched", () => {
  const state = createNewCareerState("tactical-profile-seed-1", TUMBA_CLUB_ID);
  const next = updateTacticalProfile(state, { ati001UsageTendency: "HIGH" });
  assert.equal(next.tacticalProfile.ati001UsageTendency, "HIGH");
  assert.equal(next.tacticalProfile.h2ResponsePreference, state.tacticalProfile.h2ResponsePreference);
  assert.equal(next.tacticalProfile.tacticalFamiliarity, state.tacticalProfile.tacticalFamiliarity);
});

test("updateTacticalProfile changes only tacticalProfile -- every other CareerState field is untouched", () => {
  const state = createNewCareerState("tactical-profile-seed-2", TUMBA_CLUB_ID);
  const next = updateTacticalProfile(state, { h2ResponsePreference: "H2_STOPS" });
  const nextRest: Partial<typeof next> = { ...next };
  delete nextRest.tacticalProfile;
  const stateRest: Partial<typeof state> = { ...state };
  delete stateRest.tacticalProfile;
  assert.deepEqual(nextRest, stateRest);
});

test("updateTacticalProfile supports partial multi-field updates in one call", () => {
  const state = createNewCareerState("tactical-profile-seed-3", TUMBA_CLUB_ID);
  const next = updateTacticalProfile(state, { ati001UsageTendency: "LOW", tacticalFamiliarity: "HIGH" });
  assert.equal(next.tacticalProfile.ati001UsageTendency, "LOW");
  assert.equal(next.tacticalProfile.tacticalFamiliarity, "HIGH");
  assert.equal(next.tacticalProfile.h2ResponsePreference, state.tacticalProfile.h2ResponsePreference);
});

test("updateTacticalProfile does not mutate the original state object (immutable update)", () => {
  const state = createNewCareerState("tactical-profile-seed-4", TUMBA_CLUB_ID);
  const before = JSON.stringify(state.tacticalProfile);
  updateTacticalProfile(state, { ati001UsageTendency: "HIGH" });
  assert.equal(JSON.stringify(state.tacticalProfile), before);
});
