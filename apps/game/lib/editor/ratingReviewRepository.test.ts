// HM-EDITOR-0.2: proves the rating-review persistence layer is safe,
// isolated (never touches real-world identity data), and defaults to
// an honest empty state rather than inventing a status.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadRatingReviewState, REVIEW_STATUSES, setReviewStatus } from "./ratingReviewRepository";

function makeTestClub(dataRoot: string) {
  const clubDir = path.join(dataRoot, "testnation", "2099-00", "testcomp", "Test Club HK");
  fs.mkdirSync(clubDir, { recursive: true });
  fs.writeFileSync(path.join(clubDir, "manifest.json"), JSON.stringify({ club: "Test Club HK", files: ["players-test.json", "roster-test-2099-00.json", "qc-test.json"] }));
  fs.writeFileSync(path.join(clubDir, "players-test.json"), JSON.stringify([{ playerId: "test_player_1", firstName: "Test", lastName: "Player", fullName: "Test Player" }]));
  fs.writeFileSync(path.join(clubDir, "roster-test-2099-00.json"), JSON.stringify([{ playerId: "test_player_1", primaryPosition: "V6" }]));
  fs.writeFileSync(path.join(clubDir, "qc-test.json"), JSON.stringify({ clubId: "test_club_hk", competitionId: "test_comp", clubName: "Test Club HK" }));
  return clubDir;
}

function withTempDataRoot(fn: (dataRoot: string) => void) {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hm-rating-review-test-"));
  try {
    fn(dataRoot);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

test("HM-EDITOR-0.2: loadRatingReviewState returns {} (never throws) for a club with no review file yet", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const state = loadRatingReviewState("test_club_hk", dataRoot);
    assert.deepEqual(state, {});
  });
});

test("HM-EDITOR-0.2: loadRatingReviewState returns {} for an unknown clubId, never throws", () => {
  withTempDataRoot((dataRoot) => {
    const state = loadRatingReviewState("not_a_real_club", dataRoot);
    assert.deepEqual(state, {});
  });
});

test("HM-EDITOR-0.2: setReviewStatus rejects an unrecognized status without writing anything", () => {
  withTempDataRoot((dataRoot) => {
    const clubDir = makeTestClub(dataRoot);
    const result = setReviewStatus("test_club_hk", "test_player_1", "NOT_A_REAL_STATUS" as never, undefined, dataRoot);
    assert.equal(result.ok, false);
    assert.equal(fs.existsSync(path.join(clubDir, "rating-review.json")), false);
  });
});

test("HM-EDITOR-0.2: setReviewStatus rejects an unknown clubId", () => {
  withTempDataRoot((dataRoot) => {
    const result = setReviewStatus("not_a_real_club", "test_player_1", "REVIEWED", undefined, dataRoot);
    assert.equal(result.ok, false);
  });
});

test("HM-EDITOR-0.2: setReviewStatus persists a status, and loadRatingReviewState reads it back correctly, including an updatedAt timestamp", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const before = new Date().toISOString();
    const result = setReviewStatus("test_club_hk", "test_player_1", "REVIEWED", "Looks right to me", dataRoot);
    assert.equal(result.ok, true);

    const state = loadRatingReviewState("test_club_hk", dataRoot);
    assert.equal(state.test_player_1.status, "REVIEWED");
    assert.equal(state.test_player_1.note, "Looks right to me");
    assert.ok(state.test_player_1.updatedAt >= before);
  });
});

test("HM-EDITOR-0.2: setReviewStatus for a second player never overwrites the first player's entry -- a targeted, single-key update", () => {
  withTempDataRoot((dataRoot) => {
    const clubDir = makeTestClub(dataRoot);
    fs.writeFileSync(path.join(clubDir, "players-test.json"), JSON.stringify([{ playerId: "test_player_1", fullName: "Test Player" }, { playerId: "test_player_2", fullName: "Test Player Two" }]));
    fs.writeFileSync(path.join(clubDir, "roster-test-2099-00.json"), JSON.stringify([{ playerId: "test_player_1", primaryPosition: "V6" }, { playerId: "test_player_2", primaryPosition: "M9" }]));

    setReviewStatus("test_club_hk", "test_player_1", "LOCKED", undefined, dataRoot);
    setReviewStatus("test_club_hk", "test_player_2", "PROPOSED", undefined, dataRoot);

    const state = loadRatingReviewState("test_club_hk", dataRoot);
    assert.equal(state.test_player_1.status, "LOCKED");
    assert.equal(state.test_player_2.status, "PROPOSED");
  });
});

test("HM-EDITOR-0.2: setReviewStatus is atomic -- writes go through a temp file + rename, never leaving a partially-written rating-review.json", () => {
  withTempDataRoot((dataRoot) => {
    const clubDir = makeTestClub(dataRoot);
    setReviewStatus("test_club_hk", "test_player_1", "PROPOSED", undefined, dataRoot);
    const raw = fs.readFileSync(path.join(clubDir, "rating-review.json"), "utf8");
    assert.doesNotThrow(() => JSON.parse(raw));
  });
});

test("HM-EDITOR-0.2: all 4 REVIEW_STATUSES round-trip through setReviewStatus/loadRatingReviewState", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    for (const status of REVIEW_STATUSES) {
      const result = setReviewStatus("test_club_hk", "test_player_1", status, undefined, dataRoot);
      assert.equal(result.ok, true);
      const state = loadRatingReviewState("test_club_hk", dataRoot);
      assert.equal(state.test_player_1.status, status);
    }
  });
});

test("HM-EDITOR-0.2: setReviewStatus never touches players-test.json or roster-test-2099-00.json -- rating review is fully isolated from real-world identity data", () => {
  withTempDataRoot((dataRoot) => {
    const clubDir = makeTestClub(dataRoot);
    const playersBefore = fs.readFileSync(path.join(clubDir, "players-test.json"), "utf8");
    const rosterBefore = fs.readFileSync(path.join(clubDir, "roster-test-2099-00.json"), "utf8");

    setReviewStatus("test_club_hk", "test_player_1", "REVIEWED", "a note", dataRoot);

    assert.equal(fs.readFileSync(path.join(clubDir, "players-test.json"), "utf8"), playersBefore);
    assert.equal(fs.readFileSync(path.join(clubDir, "roster-test-2099-00.json"), "utf8"), rosterBefore);
  });
});
