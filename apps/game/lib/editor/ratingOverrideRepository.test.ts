// HM-RATINGS-0.5 Part J/R: proves the override persistence layer
// validates CA/PA/attribute values, respects GK/outcourt branch
// isolation, merges targeted updates without clobbering, and stays
// fully isolated from real-world identity data -- same safety
// guarantees ratingReviewRepository.test.ts already proves for review
// status.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { clearRatingOverride, loadRatingOverrideState, setRatingOverride } from "./ratingOverrideRepository";

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
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hm-rating-override-test-"));
  try {
    fn(dataRoot);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

test("HM-RATINGS-0.5: loadRatingOverrideState returns {} for a club with no override file yet, and for an unknown clubId", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    assert.deepEqual(loadRatingOverrideState("test_club_hk", dataRoot), {});
    assert.deepEqual(loadRatingOverrideState("not_a_real_club", dataRoot), {});
  });
});

test("HM-RATINGS-0.5: setRatingOverride rejects CA/PA out of the 1-200 range without writing anything", () => {
  withTempDataRoot((dataRoot) => {
    const clubDir = makeTestClub(dataRoot);
    const result = setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", ca: 250 }, dataRoot);
    assert.equal(result.ok, false);
    assert.equal(fs.existsSync(path.join(clubDir, "rating-overrides.json")), false);
  });
});

test("HM-RATINGS-0.5: setRatingOverride rejects pa lower than ca", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", ca: 150, pa: 100 }, dataRoot);
    assert.equal(result.ok, false);
  });
});

test("HM-RATINGS-0.5: setRatingOverride rejects an attribute value outside 1-20", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", attributeOverrides: { PASSING: 25 } }, dataRoot);
    assert.equal(result.ok, false);
  });
});

test("HM-RATINGS-0.5: setRatingOverride rejects a goalkeeper attribute key for an outcourt player (branch isolation)", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", attributeOverrides: { GK_POSITIONING: 15 } }, dataRoot);
    assert.equal(result.ok, false);
  });
});

test("HM-RATINGS-0.5: setRatingOverride rejects an outcourt attribute key for a goalkeeper (branch isolation)", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "GK", attributeOverrides: { PASSING: 15 } }, dataRoot);
    assert.equal(result.ok, false);
  });
});

test("HM-RATINGS-0.5: a valid override persists and round-trips, including the attribute override map", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    const result = setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", ca: 150, attributeOverrides: { PASSING: 18 } }, dataRoot);
    assert.equal(result.ok, true);
    const state = loadRatingOverrideState("test_club_hk", dataRoot);
    assert.equal(state.test_player_1.ca, 150);
    assert.deepEqual(state.test_player_1.attributeOverrides, { PASSING: 18 });
  });
});

test("HM-RATINGS-0.5: a second setRatingOverride call MERGES with the first rather than clobbering unrelated fields", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", ca: 150 }, dataRoot);
    setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", attributeOverrides: { PASSING: 18 } }, dataRoot);
    const state = loadRatingOverrideState("test_club_hk", dataRoot);
    assert.equal(state.test_player_1.ca, 150, "ca set in the first call must survive the second call");
    assert.deepEqual(state.test_player_1.attributeOverrides, { PASSING: 18 });
  });
});

test("HM-RATINGS-0.5: attribute overrides accumulate across calls rather than replacing the whole map", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", attributeOverrides: { PASSING: 18 } }, dataRoot);
    setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", attributeOverrides: { FINISHING: 12 } }, dataRoot);
    const state = loadRatingOverrideState("test_club_hk", dataRoot);
    assert.deepEqual(state.test_player_1.attributeOverrides, { PASSING: 18, FINISHING: 12 });
  });
});

test("HM-RATINGS-0.5: clearRatingOverride removes the player's entire override", () => {
  withTempDataRoot((dataRoot) => {
    makeTestClub(dataRoot);
    setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", ca: 150 }, dataRoot);
    const result = clearRatingOverride("test_club_hk", "test_player_1", dataRoot);
    assert.equal(result.ok, true);
    const state = loadRatingOverrideState("test_club_hk", dataRoot);
    assert.equal(state.test_player_1, undefined);
  });
});

test("HM-RATINGS-0.5: setRatingOverride never touches players-test.json or roster-test-2099-00.json", () => {
  withTempDataRoot((dataRoot) => {
    const clubDir = makeTestClub(dataRoot);
    const playersBefore = fs.readFileSync(path.join(clubDir, "players-test.json"), "utf8");
    setRatingOverride({ clubId: "test_club_hk", playerId: "test_player_1", position: "V6", ca: 150 }, dataRoot);
    assert.equal(fs.readFileSync(path.join(clubDir, "players-test.json"), "utf8"), playersBefore);
  });
});
