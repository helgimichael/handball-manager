// HM-RATINGS-0.5 Part K/L/R: proves the locked-rating database
// round-trips correctly, lives OUTSIDE the club's own source data
// directory, supports unlock, and never touches source files.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadLockedPlayerRating, loadRatingDatabase, lockPlayerRating, unlockPlayerRating, type LockedPlayerRating } from "./ratingDatabaseRepository";

function makeTestClub(dataRoot: string) {
  const clubDir = path.join(dataRoot, "testnation", "2099-00", "testcomp", "Test Club HK");
  fs.mkdirSync(clubDir, { recursive: true });
  fs.writeFileSync(path.join(clubDir, "manifest.json"), JSON.stringify({ club: "Test Club HK", files: ["players-test.json", "roster-test-2099-00.json", "qc-test.json"] }));
  fs.writeFileSync(path.join(clubDir, "players-test.json"), JSON.stringify([{ playerId: "test_player_1", fullName: "Test Player" }]));
  fs.writeFileSync(path.join(clubDir, "roster-test-2099-00.json"), JSON.stringify([{ playerId: "test_player_1", primaryPosition: "V6" }]));
  fs.writeFileSync(path.join(clubDir, "qc-test.json"), JSON.stringify({ clubId: "test_club_hk", competitionId: "test_comp", clubName: "Test Club HK" }));
  return clubDir;
}

function withTempDataRoot(fn: (dataRoot: string) => void) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hm-rating-db-test-"));
  try {
    fn(dataRoot);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

function sampleRecord(overrides: Partial<LockedPlayerRating> = {}): LockedPlayerRating {
  return {
    playerId: "test_player_1",
    clubId: "test_club_hk",
    position: "V6",
    ca: { value: 150, confidence: "MEDIUM", plausibleRange: { min: 135, max: 165 }, source: "MODEL_ESTIMATE" },
    pa: null,
    branch: {
      branch: "OUTCOURT",
      attributes: Object.fromEntries(Array.from({ length: 56 }, (_, i) => [`ATTR_${i}`, { value: 10, origin: "GENERATED_PRIOR" }])) as never,
    },
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    caEstimationModelVersion: "HM-RATINGS-0.5-v1",
    attributeGenerationModelVersion: "HM-RATINGS-0.4-v1",
    lockedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("HM-RATINGS-0.5: loadRatingDatabase returns {} for a club with no locked players yet, and for an unknown clubId", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    assert.deepEqual(loadRatingDatabase("test_club_hk", dataRoot), {});
    assert.deepEqual(loadRatingDatabase("not_a_real_club", dataRoot), {});
  });
});

test("HM-RATINGS-0.5: lockPlayerRating persists a record and it round-trips byte-for-byte through loadLockedPlayerRating", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const record = sampleRecord();
    const result = lockPlayerRating("test_club_hk", record, dataRoot);
    assert.equal(result.ok, true);
    const loaded = loadLockedPlayerRating("test_club_hk", "test_player_1", dataRoot);
    assert.deepEqual(loaded, record);
  });
});

test("HM-RATINGS-0.5: the ratings database file lives OUTSIDE the club's own source data directory", () => {
  withTempDataRoot((dataRoot) => {
    const clubDir = makeTestClub(dataRoot);
    lockPlayerRating("test_club_hk", sampleRecord(), dataRoot);
    const ratingsDir = path.join(path.dirname(clubDir), "ratings");
    assert.ok(fs.existsSync(path.join(ratingsDir, "test_club_hk.json")));
    // And the club's own directory gained no new rating-shaped file.
    const clubDirFiles = fs.readdirSync(clubDir);
    assert.ok(!clubDirFiles.includes("test_club_hk.json"));
  });
});

test("HM-RATINGS-0.5: unlockPlayerRating removes exactly one player's locked record, leaving others intact", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    lockPlayerRating("test_club_hk", sampleRecord({ playerId: "test_player_1" }), dataRoot);
    lockPlayerRating("test_club_hk", sampleRecord({ playerId: "test_player_2" }), dataRoot);
    const result = unlockPlayerRating("test_club_hk", "test_player_1", dataRoot);
    assert.equal(result.ok, true);
    assert.equal(loadLockedPlayerRating("test_club_hk", "test_player_1", dataRoot), null);
    assert.ok(loadLockedPlayerRating("test_club_hk", "test_player_2", dataRoot) !== null);
  });
});

test("HM-RATINGS-0.5: unlocking an already-unlocked player is a safe no-op", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = unlockPlayerRating("test_club_hk", "never_locked", dataRoot);
    assert.equal(result.ok, true);
  });
});

test("HM-RATINGS-0.5: lockPlayerRating never touches players-test.json or roster-test-2099-00.json", () => {
  withTempDataRoot((dataRoot) => {
    const clubDir = makeTestClub(dataRoot);
    const playersBefore = fs.readFileSync(path.join(clubDir, "players-test.json"), "utf8");
    lockPlayerRating("test_club_hk", sampleRecord(), dataRoot);
    assert.equal(fs.readFileSync(path.join(clubDir, "players-test.json"), "utf8"), playersBefore);
  });
});

test("HM-RATINGS-0.5: locking a second, different player does not disturb the first player's locked record", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    lockPlayerRating("test_club_hk", sampleRecord({ playerId: "test_player_1", ca: { value: 150, confidence: "MEDIUM", plausibleRange: { min: 135, max: 165 }, source: "MODEL_ESTIMATE" } }), dataRoot);
    lockPlayerRating("test_club_hk", sampleRecord({ playerId: "test_player_2", ca: { value: 170, confidence: "HIGH", plausibleRange: { min: 164, max: 176 }, source: "CALIBRATED" } }), dataRoot);
    assert.equal(loadLockedPlayerRating("test_club_hk", "test_player_1", dataRoot)?.ca.value, 150);
    assert.equal(loadLockedPlayerRating("test_club_hk", "test_player_2", dataRoot)?.ca.value, 170);
  });
});
