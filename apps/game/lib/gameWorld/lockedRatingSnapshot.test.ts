// HM-RATINGS-0.5 Part M/R: proves the game-loading boundary for locked
// ratings round-trips correctly and is safe for unknown clubs/players.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { lockPlayerRating, type LockedPlayerRating } from "../editor/ratingDatabaseRepository";
import { snapshotLockedRatingForPlayer, snapshotLockedRatingsForClub } from "./lockedRatingSnapshot";

function makeTestClub(dataRoot: string) {
  const clubDir = path.join(dataRoot, "testnation", "2099-00", "testcomp", "Test Club HK");
  fs.mkdirSync(clubDir, { recursive: true });
  fs.writeFileSync(path.join(clubDir, "manifest.json"), JSON.stringify({ club: "Test Club HK", files: ["players-test.json", "roster-test-2099-00.json", "qc-test.json"] }));
  fs.writeFileSync(
    path.join(clubDir, "players-test.json"),
    JSON.stringify([{ playerId: "test_player_1", firstName: "Test", lastName: "Player", fullName: "Test Player", primaryPosition: "V6", secondaryPositions: [], nationalities: [], contract: {} }]),
  );
  fs.writeFileSync(path.join(clubDir, "roster-test-2099-00.json"), JSON.stringify([{ playerId: "test_player_1", primaryPosition: "V6", competitionId: "test_comp" }]));
  fs.writeFileSync(path.join(clubDir, "qc-test.json"), JSON.stringify({ clubId: "test_club_hk", competitionId: "test_comp", clubName: "Test Club HK" }));
  return clubDir;
}

function withTempDataRoot(fn: (dataRoot: string) => void) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hm-locked-rating-snapshot-test-"));
  try {
    fn(dataRoot);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

function sampleRecord(): LockedPlayerRating {
  return {
    playerId: "test_player_1",
    clubId: "test_club_hk",
    position: "V6",
    ca: { value: 150, confidence: "MEDIUM", plausibleRange: { min: 135, max: 165 }, source: "MODEL_ESTIMATE" },
    pa: null,
    branch: { branch: "OUTCOURT", attributes: {} as never },
    attackRoleProficiencies: [],
    defenceRoleProficiencies: [],
    caEstimationModelVersion: "HM-RATINGS-0.5-v1",
    attributeGenerationModelVersion: "HM-RATINGS-0.4-v1",
    lockedAt: new Date().toISOString(),
  };
}

test("HM-RATINGS-0.5: snapshotLockedRatingsForClub returns clubName null (never throws) for an unknown clubId", () => {
  withTempDataRoot((dataRoot) => {
    const snapshot = snapshotLockedRatingsForClub("not_a_real_club", dataRoot);
    assert.equal(snapshot.clubName, null);
    assert.deepEqual(snapshot.lockedPlayers, []);
  });
});

test("HM-RATINGS-0.5: a real club with zero locked players returns an empty array, not an error", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const snapshot = snapshotLockedRatingsForClub("test_club_hk", dataRoot);
    assert.equal(snapshot.clubName, "Test Club HK");
    assert.deepEqual(snapshot.lockedPlayers, []);
  });
});

test("HM-RATINGS-0.5: a locked player round-trips through the game-loading snapshot exactly as written", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const record = sampleRecord();
    lockPlayerRating("test_club_hk", record, dataRoot);

    const snapshot = snapshotLockedRatingsForClub("test_club_hk", dataRoot);
    assert.equal(snapshot.lockedPlayers.length, 1);
    assert.deepEqual(snapshot.lockedPlayers[0], record);

    const single = snapshotLockedRatingForPlayer("test_club_hk", "test_player_1", dataRoot);
    assert.deepEqual(single, record);
  });
});

test("HM-RATINGS-0.5: snapshotLockedRatingForPlayer returns null for an unlocked (or unknown) player, never throws", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    assert.equal(snapshotLockedRatingForPlayer("test_club_hk", "nobody", dataRoot), null);
  });
});
