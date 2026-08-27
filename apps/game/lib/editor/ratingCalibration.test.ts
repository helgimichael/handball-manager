// HM-PLAYER-DATA-EDITOR-1.0: proves calibratePlayerRating actually
// closes the "draft override alone never reaches gameplay" gap --
// after a call, the player's CA/PA is LOCKED (not just drafted), and a
// fresh read of the same resolver a career would use reflects it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { calibratePlayerRating, toRatingPosition } from "./ratingCalibration";
import { loadRatingDatabase } from "./ratingDatabaseRepository";
import { buildRatingWorkbenchRowForPlayer } from "./ratingWorkbench";
import { listAllPlayersFull } from "./playerRepository";
import { buildCatalog } from "./catalog";

function makeTestClub(dataRoot: string) {
  const clubDir = path.join(dataRoot, "testnation", "2099-00", "testcomp", "Test Club HK");
  fs.mkdirSync(clubDir, { recursive: true });
  fs.writeFileSync(path.join(clubDir, "manifest.json"), JSON.stringify({ club: "Test Club HK", files: ["players-test.json", "roster-test-2099-00.json", "qc-test.json"] }));
  fs.writeFileSync(
    path.join(clubDir, "players-test.json"),
    JSON.stringify([
      { playerId: "test_player_1", firstName: "Test", lastName: "Playersson", fullName: "Test Playersson", dateOfBirth: "2000-01-15", birthYear: 2000, nationalities: ["SE"], heightCm: 190, handedness: "RIGHT", recordConfidence: "VERIFIED", aliases: [], dataNotes: [] },
    ]),
  );
  fs.writeFileSync(
    path.join(clubDir, "roster-test-2099-00.json"),
    JSON.stringify([
      {
        rosterEntryId: "r1",
        playerId: "test_player_1",
        clubId: "test_club_hk",
        competitionId: "test_comp",
        season: "2099/00",
        snapshotDate: "2099-01-01",
        shirtNumber: 7,
        sourcePosition: "Vänstersexa",
        primaryPosition: "V6",
        secondaryPositions: [],
        rosterStatus: "CONFIRMED",
        contract: { untilDate: null, untilSeason: "2099/00", optionUntilSeason: null },
        rosterConfidence: "VERIFIED",
        defaultSquadStatus: null,
        specialTags: [],
      },
    ]),
  );
  fs.writeFileSync(path.join(clubDir, "qc-test.json"), JSON.stringify({ clubId: "test_club_hk", competitionId: "test_comp", clubName: "Test Club HK" }));
  return clubDir;
}

function withTempDataRoot(fn: (dataRoot: string) => void) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hm-rating-calibration-test-"));
  try {
    fn(dataRoot);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

test("(1) toRatingPosition maps the roster schema's MV to the rating domain's GK, and passes every other code through unchanged", () => {
  assert.equal(toRatingPosition("MV"), "GK");
  for (const p of ["V6", "V9", "M9", "M6", "H9", "H6"] as const) {
    assert.equal(toRatingPosition(p), p);
  }
});

test("(2) calibratePlayerRating with both ca and pa actually LOCKS the player -- not just a draft override", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = calibratePlayerRating("test_club_hk", "test_player_1", "V6", 140, 160, "test note", dataRoot);
    assert.equal(result.ok, true);
    assert.ok(result.record);
    assert.equal(result.record!.ca.value, 140);
    assert.equal(result.record!.ca.source, "EDITOR_OVERRIDE");
    assert.equal(result.record!.pa!.value, 160);

    const locked = loadRatingDatabase("test_club_hk", dataRoot);
    assert.ok(locked.test_player_1, "expected the player to actually be present in the LOCKED database, not just a draft override");
    assert.equal(locked.test_player_1.ca.value, 140);
  });
});

test("(3) after calibration, a fresh resolve of the SAME workbench a career reads reflects the new CA/PA", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    calibratePlayerRating("test_club_hk", "test_player_1", "V6", 155, 175, undefined, dataRoot);
    const row = buildRatingWorkbenchRowForPlayer("test_club_hk", "test_player_1", dataRoot);
    assert.equal(row?.profile.ca.value, 155);
    assert.equal(row?.profile.pa.value, 175);
    assert.notEqual(row?.locked, null);
  });
});

test("(4) calibrating only CA (pa omitted) leaves any existing PA untouched -- a targeted merge, never a clobber", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    calibratePlayerRating("test_club_hk", "test_player_1", "V6", 130, 150, undefined, dataRoot);
    const second = calibratePlayerRating("test_club_hk", "test_player_1", "V6", 135, undefined, undefined, dataRoot);
    assert.equal(second.ok, true);
    assert.equal(second.record!.ca.value, 135);
    assert.equal(second.record!.pa!.value, 150, "PA should still be the first call's value, not reset");
  });
});

test("(5) a pa lower than ca is rejected before anything is written -- the same validation setRatingOverride already enforces", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = calibratePlayerRating("test_club_hk", "test_player_1", "V6", 150, 100, undefined, dataRoot);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("pa")));
    const locked = loadRatingDatabase("test_club_hk", dataRoot);
    assert.deepEqual(locked, {}, "a rejected calibration must never partially write anything");
  });
});

test("(6) an out-of-range ca (outside 1-200) is rejected", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = calibratePlayerRating("test_club_hk", "test_player_1", "V6", 999, undefined, undefined, dataRoot);
    assert.equal(result.ok, false);
  });
});

test("(7) calling with an unknown playerId fails cleanly, never crashes", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = calibratePlayerRating("test_club_hk", "does-not-exist", "V6", 140, 160, undefined, dataRoot);
    assert.equal(result.ok, false);
  });
});

test("(8) listAllPlayersFull returns every player across every discovered club, with the new defaultSquadStatus/specialTags fields defaulted honestly", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const catalog = buildCatalog(dataRoot);
    const records = listAllPlayersFull(catalog);
    assert.equal(records.length, 1);
    assert.equal(records[0].playerId, "test_player_1");
    assert.equal(records[0].roster.defaultSquadStatus, null);
    assert.deepEqual(records[0].roster.specialTags, []);
  });
});

test("(9) listAllPlayersFull can be narrowed to specific competitionSlugs", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const catalog = buildCatalog(dataRoot);
    assert.equal(listAllPlayersFull(catalog, ["testcomp"]).length, 1);
    assert.equal(listAllPlayersFull(catalog, ["some-other-competition"]).length, 0);
  });
});
