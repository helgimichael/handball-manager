// HM-RATINGS-0.4 Part H: proves the ONE canonical player-facing
// attribute vocabulary is complete and never leaks a raw machine key.
import { test } from "node:test";
import assert from "node:assert/strict";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES } from "./types";
import { getAttributeFamily, getAttributeFamilyLabel, getAttributeLabel } from "./attributeVocabulary";

test("HM-RATINGS-0.4: every one of the 56 outcourt attributes has a non-empty Swedish label", () => {
  assert.equal(OUTCOURT_ATTRIBUTES.length, 56);
  for (const attribute of OUTCOURT_ATTRIBUTES) {
    const label = getAttributeLabel(attribute);
    assert.ok(label && label.length > 0, `missing label for ${attribute}`);
  }
});

test("HM-RATINGS-0.4: every one of the 21 goalkeeper attributes has a non-empty Swedish label", () => {
  assert.equal(GOALKEEPER_ATTRIBUTES.length, 21);
  for (const attribute of GOALKEEPER_ATTRIBUTES) {
    const label = getAttributeLabel(attribute);
    assert.ok(label && label.length > 0, `missing label for ${attribute}`);
  }
});

test("HM-RATINGS-0.4: no attribute's Swedish label is just the raw enum key (no blind title-casing of a multi-word key)", () => {
  for (const attribute of [...OUTCOURT_ATTRIBUTES, ...GOALKEEPER_ATTRIBUTES]) {
    const label = getAttributeLabel(attribute);
    assert.notEqual(label, attribute);
    // A multi-word key (contains "_") must never survive as a literal
    // space-joined title-case of itself (e.g. DEFENSIVE_POSITIONING ->
    // "Defensive Positioning" would be blind title-casing, not a real
    // translation). Single-word keys that happen to already be a valid
    // Swedish loanword (e.g. TIMING -> "Timing") are legitimate.
    if (attribute.includes("_")) {
      const titleCased = attribute
        .split("_")
        .map((w) => w[0] + w.slice(1).toLowerCase())
        .join(" ");
      assert.notEqual(label, titleCased);
    }
  }
});

test("HM-RATINGS-0.4: every attribute resolves to a family with a non-empty family label", () => {
  for (const attribute of [...OUTCOURT_ATTRIBUTES, ...GOALKEEPER_ATTRIBUTES]) {
    const family = getAttributeFamily(attribute);
    const familyLabel = getAttributeFamilyLabel(family);
    assert.ok(familyLabel && familyLabel.length > 0, `missing family label for ${family}`);
  }
});

test("HM-RATINGS-0.4: attribute labels are unique within each branch (no accidental collisions hiding two different attributes)", () => {
  const outcourtLabels = OUTCOURT_ATTRIBUTES.map((a) => getAttributeLabel(a));
  assert.equal(new Set(outcourtLabels).size, outcourtLabels.length);
  const gkLabels = GOALKEEPER_ATTRIBUTES.map((a) => getAttributeLabel(a));
  assert.equal(new Set(gkLabels).size, gkLabels.length);
});
