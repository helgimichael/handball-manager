// HM-STAFF-1.0 Part 33: directional proofs for deterministic staff
// attribute + fictional-name generation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFictionalStaffName, generateStaffAttributeProfile } from "./staffAttributeGeneration";
import { STAFF_ATTRIBUTES, STAFF_ATTRIBUTE_MAX, STAFF_ATTRIBUTE_MIN } from "./types";

// (2) staff attributes bounded 1-20.
test("(2) every generated staff attribute is bounded [1, 20]", () => {
  const profile = generateStaffAttributeProfile("p1", ["HEAD_COACH"], "seed-2");
  for (const attr of STAFF_ATTRIBUTES) {
    const v = profile.attributes[attr].value;
    assert.ok(v >= STAFF_ATTRIBUTE_MIN && v <= STAFF_ATTRIBUTE_MAX, `${attr}=${v} out of bounds`);
  }
});

test("a generated profile is COMPLETE -- every canonical attribute present, never partial", () => {
  const profile = generateStaffAttributeProfile("p1", ["GOALKEEPER_COACH"], "seed-complete");
  assert.equal(Object.keys(profile.attributes).length, STAFF_ATTRIBUTES.length);
});

// (16) generated staff no exact clone audit.
test("(16)/(18) two different staff (different seed keys) in the SAME role are not exact clones", () => {
  const a = generateStaffAttributeProfile("p-a", ["ASSISTANT_COACH"], "seed-a:club1");
  const b = generateStaffAttributeProfile("p-b", ["ASSISTANT_COACH"], "seed-b:club1");
  assert.notDeepEqual(a.attributes, b.attributes);
});

// (19) generated profile role-shape plausible.
test("(4)/(19) a GK coach's generated profile has a higher GOALKEEPER_COACHING prior than an unrelated attribute like ANALYSIS", () => {
  const profile = generateStaffAttributeProfile("gk1", ["GOALKEEPER_COACH"], "seed-gk");
  assert.ok(profile.attributes.GOALKEEPER_COACHING.value > profile.attributes.ANALYSIS.value);
});

test("a physical coach's generated profile has a higher PHYSICAL_COACHING prior than GOALKEEPER_COACHING", () => {
  const profile = generateStaffAttributeProfile("phys1", ["PHYSICAL_COACH"], "seed-phys");
  assert.ok(profile.attributes.PHYSICAL_COACHING.value > profile.attributes.GOALKEEPER_COACHING.value);
});

// (17) generated staff profiles differentiated -- confirmed via role-shape above, and via (16).

// (21) unknown evidence stays generated/not falsely verified.
test("(21) every generated staff attribute is tagged GENERATED_PRIOR, never a stronger origin", () => {
  const profile = generateStaffAttributeProfile("p1", ["SCOUT"], "seed-scout");
  for (const attr of STAFF_ATTRIBUTES) {
    assert.equal(profile.attributes[attr].origin, "GENERATED_PRIOR");
  }
});

// (16) same inputs deterministic (also covered at integration level).
test("identical (personId, roles, seedKey) always reproduces an identical profile", () => {
  const a = generateStaffAttributeProfile("p1", ["HEAD_COACH"], "same-seed");
  const b = generateStaffAttributeProfile("p1", ["HEAD_COACH"], "same-seed");
  assert.deepEqual(a, b);
});

test("generateFictionalStaffName is deterministic and produces a plausible two-part name", () => {
  const a = generateFictionalStaffName("seed-name-1");
  const b = generateFictionalStaffName("seed-name-1");
  assert.equal(a, b);
  assert.match(a, /^[A-ZÅÄÖ][a-zåäö]+ [A-ZÅÄÖ][a-zåäö]+$/);
});

test("different seed keys produce different fictional names (not always the same clone)", () => {
  const names = new Set([1, 2, 3, 4, 5].map((i) => generateFictionalStaffName(`seed-name-diff-${i}`)));
  assert.ok(names.size > 1, `expected some variety, got ${JSON.stringify([...names])}`);
});
