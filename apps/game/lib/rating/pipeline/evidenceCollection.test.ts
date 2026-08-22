// HM-RATINGS-0.3: proves the evidence-collection layer's position
// mapping and calibration-matching are correct and safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mapPrimaryPosition, mapSecondaryPositions, matchCalibrationReference } from "./evidenceCollection";
import type { RealWorldPlayer } from "../../gameWorld/realWorldLoader";
import { SWEDEN_CALIBRATION_V2_PROFILES } from "../swedenCalibrationV2";

function player(overrides: Partial<RealWorldPlayer> & Pick<RealWorldPlayer, "fullName">): RealWorldPlayer {
  return {
    playerId: "test-player",
    clubId: "test-club",
    firstName: "",
    lastName: "",
    aliases: [],
    dateOfBirth: null,
    birthYear: null,
    nationalities: null,
    heightCm: null,
    handedness: null,
    shirtNumber: null,
    sourcePosition: "",
    primaryPosition: "V6",
    secondaryPositions: [],
    rosterStatus: "CONFIRMED",
    contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
    ...overrides,
  };
}

test("HM-RATINGS-0.3: mapPrimaryPosition maps the goalkeeper code MV to GK, and every other canonical code 1:1", () => {
  assert.equal(mapPrimaryPosition("MV"), "GK");
  assert.equal(mapPrimaryPosition("V6"), "V6");
  assert.equal(mapPrimaryPosition("V9"), "V9");
  assert.equal(mapPrimaryPosition("M9"), "M9");
  assert.equal(mapPrimaryPosition("M6"), "M6");
  assert.equal(mapPrimaryPosition("H9"), "H9");
  assert.equal(mapPrimaryPosition("H6"), "H6");
});

test("HM-RATINGS-0.3: mapPrimaryPosition returns null (never invents a position) for an unrecognized code", () => {
  assert.equal(mapPrimaryPosition("NOT_A_REAL_CODE"), null);
});

test("HM-RATINGS-0.3: mapSecondaryPositions silently drops unrecognized codes rather than throwing", () => {
  assert.deepEqual(mapSecondaryPositions(["V9", "BOGUS", "M6"]), ["V9", "M6"]);
});

test("HM-RATINGS-0.3: matchCalibrationReference matches all 12 calibration players by exact full name", () => {
  const names = ["Gustav Davidsson", "Niclas Ekberg", "Andreas Nilsson", "Peter Johannesson", "Liam Hultberg", "Alexander Morsten", "Anders Wik Rydberg", "Leonard Gegaj", "Albert Månsson", "Baldur Fritz Bjarnason", "Malte Haglund", "Robin Järling"];
  assert.equal(names.length, 12);
  for (const name of names) {
    const match = matchCalibrationReference(player({ fullName: name }));
    assert.ok(match, `expected a calibration match for "${name}"`);
  }
  assert.equal(new Set(SWEDEN_CALIBRATION_V2_PROFILES.map((p) => p.playerId)).size, 12);
});

test("HM-RATINGS-0.3: matchCalibrationReference matches by alias when the roster full name differs from the calibrated player's name (e.g. 'Robin Järling' alias vs verified full name 'Robin Järling Sanderhem')", () => {
  const match = matchCalibrationReference(player({ fullName: "Robin Järling Sanderhem", aliases: ["Robin Järling"] }));
  assert.ok(match);
  assert.equal(match!.playerId, "se_player_robin_jarling");
});

test("HM-RATINGS-0.3: matchCalibrationReference is case- and diacritic-insensitive", () => {
  assert.ok(matchCalibrationReference(player({ fullName: "gustav davidsson" })));
  assert.ok(matchCalibrationReference(player({ fullName: "MALTE HAGLUND" })));
  assert.ok(matchCalibrationReference(player({ fullName: "albert mansson" }))); // 'å' stripped to 'a'
});

test("HM-RATINGS-0.3: matchCalibrationReference returns null for an ordinary, uncalibrated player name -- this is the expected common case, not an error", () => {
  assert.equal(matchCalibrationReference(player({ fullName: "Some Random Player" })), null);
});
