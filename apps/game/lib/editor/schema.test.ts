import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlayerEdit, validateRosterEdit } from "./schema";

function validPlayer(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Alpha",
    lastName: "Testsson",
    fullName: "Alpha Testsson",
    dateOfBirth: "2000-01-15",
    birthYear: 2000,
    nationalities: ["SE"],
    heightCm: 190,
    handedness: "RIGHT",
    recordConfidence: "VERIFIED",
    ...overrides,
  };
}

function validRoster(overrides: Record<string, unknown> = {}) {
  return {
    shirtNumber: 7,
    sourcePosition: "Höger back",
    primaryPosition: "H9",
    secondaryPositions: [],
    rosterStatus: "CONFIRMED",
    contract: { untilDate: null, untilSeason: "2099/00", optionUntilSeason: null },
    rosterConfidence: "VERIFIED",
    ...overrides,
  };
}

test("valid player edit is accepted", () => {
  const result = validatePlayerEdit(validPlayer());
  assert.equal(result.ok, true);
});

test("optional null fields are accepted on the player record", () => {
  const result = validatePlayerEdit(
    validPlayer({ dateOfBirth: null, birthYear: null, nationalities: null, heightCm: null, handedness: null }),
  );
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.dateOfBirth, null);
    assert.equal(result.value.heightCm, null);
  }
});

test("malformed date is rejected", () => {
  const result = validatePlayerEdit(validPlayer({ dateOfBirth: "15-01-2000" }));
  assert.equal(result.ok, false);
});

test("a real-looking but invalid calendar date is rejected (2000-02-31)", () => {
  const result = validatePlayerEdit(validPlayer({ dateOfBirth: "2000-02-31" }));
  assert.equal(result.ok, false);
});

test("invalid numeric type for heightCm is rejected", () => {
  const result = validatePlayerEdit(validPlayer({ heightCm: "190" }));
  assert.equal(result.ok, false);
});

test("heightCm out of plausible range is rejected", () => {
  const result = validatePlayerEdit(validPlayer({ heightCm: 999 }));
  assert.equal(result.ok, false);
});

test("nationalities must be 2-letter uppercase codes, duplicates rejected", () => {
  assert.equal(validatePlayerEdit(validPlayer({ nationalities: ["se"] })).ok, false);
  assert.equal(validatePlayerEdit(validPlayer({ nationalities: ["SWE"] })).ok, false);
  assert.equal(validatePlayerEdit(validPlayer({ nationalities: ["SE", "SE"] })).ok, false);
  assert.equal(validatePlayerEdit(validPlayer({ nationalities: ["SE", "NO"] })).ok, true);
});

test("empty required strings are rejected", () => {
  assert.equal(validatePlayerEdit(validPlayer({ firstName: "" })).ok, false);
  assert.equal(validatePlayerEdit(validPlayer({ firstName: "   " })).ok, false);
});

test("recordConfidence must be one of the canonical values", () => {
  assert.equal(validatePlayerEdit(validPlayer({ recordConfidence: "TOTALLY_SURE" })).ok, false);
});

test("valid roster edit is accepted", () => {
  const result = validateRosterEdit(validRoster());
  assert.equal(result.ok, true);
});

test("invalid primaryPosition is rejected", () => {
  const result = validateRosterEdit(validRoster({ primaryPosition: "GK" }));
  assert.equal(result.ok, false);
});

test("football-style position is rejected (not a canonical handball position)", () => {
  const result = validateRosterEdit(validRoster({ primaryPosition: "STRIKER" }));
  assert.equal(result.ok, false);
});

test("invalid secondaryPosition entry is rejected", () => {
  const result = validateRosterEdit(validRoster({ secondaryPositions: ["H9", "CB"] }));
  assert.equal(result.ok, false);
});

test("duplicate secondaryPositions entries are rejected", () => {
  const result = validateRosterEdit(validRoster({ secondaryPositions: ["H9", "H9"] }));
  assert.equal(result.ok, false);
});

test("valid secondaryPositions are accepted", () => {
  const result = validateRosterEdit(validRoster({ secondaryPositions: ["H6", "M9"] }));
  assert.equal(result.ok, true);
});

test("optional null contract fields are accepted", () => {
  const result = validateRosterEdit(validRoster({ contract: { untilDate: null, untilSeason: null, optionUntilSeason: null } }));
  assert.equal(result.ok, true);
});

test("shirtNumber must be an integer within range, or null", () => {
  assert.equal(validateRosterEdit(validRoster({ shirtNumber: null })).ok, true);
  assert.equal(validateRosterEdit(validRoster({ shirtNumber: 0 })).ok, false);
  assert.equal(validateRosterEdit(validRoster({ shirtNumber: 100 })).ok, false);
  assert.equal(validateRosterEdit(validRoster({ shirtNumber: 7.5 })).ok, false);
});

test("invalid rosterStatus is rejected", () => {
  const result = validateRosterEdit(validRoster({ rosterStatus: "TRANSFERRED" }));
  assert.equal(result.ok, false);
});
