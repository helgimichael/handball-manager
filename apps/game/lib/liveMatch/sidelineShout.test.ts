import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTeamTacticalProfile } from "../career/teamTacticalProfile";
import {
  SHOUT_ACTIVE_DURATION_MINUTES,
  SHOUT_DELIVERY_DELAY_MINUTES,
  SHOUT_TYPES,
  applyShoutOverride,
  resolveShoutStatus,
  shoutDeliveryMinute,
  shoutExpiryMinute,
  type Shout,
} from "./sidelineShout";

function shoutAt(issuedMinute: number, type: Shout["type"] = "SOK_M6"): Shout {
  return { type, issuedMinute };
}

test("timing: PENDING before delivery, ACTIVE between delivery and expiry, EXPIRED from expiry onward", () => {
  const shout = shoutAt(10);
  const delivery = shoutDeliveryMinute(shout);
  const expiry = shoutExpiryMinute(shout);
  assert.equal(delivery, 10 + SHOUT_DELIVERY_DELAY_MINUTES);
  assert.equal(expiry, delivery + SHOUT_ACTIVE_DURATION_MINUTES);

  assert.equal(resolveShoutStatus(shout, 10), "PENDING");
  assert.equal(resolveShoutStatus(shout, delivery - 1), "PENDING");
  assert.equal(resolveShoutStatus(shout, delivery), "ACTIVE");
  assert.equal(resolveShoutStatus(shout, expiry - 1), "ACTIVE");
  assert.equal(resolveShoutStatus(shout, expiry), "EXPIRED");
  assert.equal(resolveShoutStatus(shout, expiry + 10), "EXPIRED");
});

test("determinism: identical inputs always resolve identically", () => {
  const a = shoutAt(23, "STA_KOMPAKT");
  const b = shoutAt(23, "STA_KOMPAKT");
  assert.equal(shoutDeliveryMinute(a), shoutDeliveryMinute(b));
  assert.equal(shoutExpiryMinute(a), shoutExpiryMinute(b));
  assert.equal(resolveShoutStatus(a, 27), resolveShoutStatus(b, 27));
});

test("delivery/expiry minutes never exceed 60 (full time), even for a very late shout", () => {
  const shout = shoutAt(59);
  assert.equal(shoutDeliveryMinute(shout), 60);
  assert.equal(shoutExpiryMinute(shout), 60);
  assert.equal(resolveShoutStatus(shout, 60), "EXPIRED");
});

test("pause/speed independence: status is a pure function of clockMinute only", () => {
  const shout = shoutAt(15);
  const delivery = shoutDeliveryMinute(shout);
  assert.equal(resolveShoutStatus(shout, delivery), "ACTIVE");
  assert.equal(resolveShoutStatus(shout, delivery), "ACTIVE");
});

test("SOK_M6 temporarily overrides only ati001UsageTendency, to HIGH", () => {
  const base = { ...defaultTeamTacticalProfile(), ati001UsageTendency: "LOW" as const };
  const overridden = applyShoutOverride(base, "SOK_M6");
  assert.equal(overridden.ati001UsageTendency, "HIGH");
  assert.equal(overridden.h2ResponsePreference, base.h2ResponsePreference);
  assert.equal(overridden.tacticalFamiliarity, base.tacticalFamiliarity);
});

test("STA_KOMPAKT temporarily overrides only h2ResponsePreference, to H2_HOLDS", () => {
  const base = { ...defaultTeamTacticalProfile(), h2ResponsePreference: "H2_STOPS" as const };
  const overridden = applyShoutOverride(base, "STA_KOMPAKT");
  assert.equal(overridden.h2ResponsePreference, "H2_HOLDS");
  assert.equal(overridden.ati001UsageTendency, base.ati001UsageTendency);
});

test("VAR_MER_AGGRESSIVA temporarily overrides only h2ResponsePreference, to H2_STOPS", () => {
  const base = { ...defaultTeamTacticalProfile(), h2ResponsePreference: "H2_HOLDS" as const };
  const overridden = applyShoutOverride(base, "VAR_MER_AGGRESSIVA");
  assert.equal(overridden.h2ResponsePreference, "H2_STOPS");
  assert.equal(overridden.ati001UsageTendency, base.ati001UsageTendency);
});

test("anti-stacking: reapplying the same shout override on top of itself is a no-op, never a bigger effect (enum ceiling, not an accumulator)", () => {
  const base = defaultTeamTacticalProfile();
  const once = applyShoutOverride(base, "SOK_M6");
  const twice = applyShoutOverride(once, "SOK_M6");
  assert.deepEqual(once, twice);
});

test("exactly 3 shout types are supported (Spec: max 3-4, only defensible mappings)", () => {
  assert.equal(SHOUT_TYPES.length, 3);
  assert.deepEqual([...SHOUT_TYPES].sort(), ["SOK_M6", "STA_KOMPAKT", "VAR_MER_AGGRESSIVA"]);
});
