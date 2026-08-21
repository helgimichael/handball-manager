import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ATI001_USAGE_TENDENCY_VALUES,
  H2_RESPONSE_PREFERENCE_VALUES,
  PROVISIONAL_NEUTRAL_CAPABILITY,
  TACTICAL_FAMILIARITY_VALUES,
  capabilityLevelLabel,
  defaultTeamTacticalProfile,
  h2ResponseLabel,
} from "./teamTacticalProfile";

test("defaultTeamTacticalProfile is deterministic (same call, same result every time)", () => {
  const a = defaultTeamTacticalProfile();
  const b = defaultTeamTacticalProfile();
  assert.deepEqual(a, b);
});

test("default profile uses only approved vocabulary values", () => {
  const profile = defaultTeamTacticalProfile();
  assert.ok(ATI001_USAGE_TENDENCY_VALUES.includes(profile.ati001UsageTendency));
  assert.ok(H2_RESPONSE_PREFERENCE_VALUES.includes(profile.h2ResponsePreference));
  assert.ok(TACTICAL_FAMILIARITY_VALUES.includes(profile.tacticalFamiliarity));
});

test("default profile's h2ResponsePreference is TI-001's own central Working Rule response (H2_STEPS), not an arbitrary pick", () => {
  assert.equal(defaultTeamTacticalProfile().h2ResponsePreference, "H2_STEPS");
});

test("PROVISIONAL_NEUTRAL_CAPABILITY is MEDIUM -- the same 'no modifier' value tactical-domain's own calibration treats as a no-op", () => {
  assert.equal(PROVISIONAL_NEUTRAL_CAPABILITY, "MEDIUM");
});

test("every vocabulary value has a distinct Swedish display label", () => {
  const capabilityLabels = TACTICAL_FAMILIARITY_VALUES.map(capabilityLevelLabel);
  assert.equal(new Set(capabilityLabels).size, TACTICAL_FAMILIARITY_VALUES.length);

  const h2Labels = H2_RESPONSE_PREFERENCE_VALUES.map(h2ResponseLabel);
  assert.equal(new Set(h2Labels).size, H2_RESPONSE_PREFERENCE_VALUES.length);
});

test("ATI-001 usage tendency and tactical familiarity share the exact LOW/MEDIUM/HIGH vocabulary (Spec)", () => {
  assert.deepEqual(ATI001_USAGE_TENDENCY_VALUES, ["LOW", "MEDIUM", "HIGH"]);
  assert.deepEqual(TACTICAL_FAMILIARITY_VALUES, ["LOW", "MEDIUM", "HIGH"]);
});

test("H2 response preference reuses tactical-domain's exact H2Response vocabulary, all five values", () => {
  assert.deepEqual(H2_RESPONSE_PREFERENCE_VALUES, ["H2_HOLDS", "H2_DELAYS", "H2_STEERS", "H2_STEPS", "H2_STOPS"]);
});
