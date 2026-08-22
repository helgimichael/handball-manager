// HM-UX-0.3: proves the shared rating-proposal snapshot -- the ONE
// mapping both the normal Player Profile's API route and the Editor's
// Rating Review API route consume -- is correct and safe.
import { test } from "node:test";
import assert from "node:assert/strict";
import { snapshotClubRatingProposals } from "./ratingProposalSnapshot";

test("HM-UX-0.3: snapshotClubRatingProposals returns clubName null (never throws) for an unknown clubId", () => {
  const snapshot = snapshotClubRatingProposals("not_a_real_club_id");
  assert.equal(snapshot.clubName, null);
  assert.deepEqual(snapshot.players, []);
});

test("HM-UX-0.3: snapshotClubRatingProposals marks Gustav Davidsson's real roster entry as matchedCalibration with the exact HM-RATINGS-0.2 CA/PA", () => {
  const snapshot = snapshotClubRatingProposals("se_club_hammarby_if_hf");
  assert.ok(snapshot.clubName);
  const row = snapshot.players.find((r) => r.profile.playerId.startsWith("se_player_gustav_davidsson"));
  assert.ok(row, "expected to find Gustav Davidsson in Hammarby's real roster");
  assert.equal(row!.matchedCalibration, true);
  assert.equal(row!.profile.ca.value, 166);
  assert.equal(row!.profile.pa.value, 170);
});

test("HM-UX-0.3: snapshotClubRatingProposals leaves an ordinary (uncalibrated) player fully unresolved -- never a fabricated average", () => {
  const snapshot = snapshotClubRatingProposals("se_club_hammarby_if_hf");
  const unmatched = snapshot.players.find((r) => !r.matchedCalibration);
  assert.ok(unmatched, "expected at least one uncalibrated player at Hammarby");
  assert.equal(unmatched!.profile.ca.value, null);
  assert.equal(unmatched!.profile.pa.value, null);
});

test("HM-UX-0.3: snapshotClubRatingProposals is deterministic -- calling it twice for the same club produces byte-identical output", () => {
  const a = snapshotClubRatingProposals("se_club_ystads_if_hf");
  const b = snapshotClubRatingProposals("se_club_ystads_if_hf");
  assert.deepEqual(a, b);
});

test("HM-UX-0.3: every player in the snapshot carries the matchedCalibration flag alongside its full profile (the same shape both consuming API routes rely on)", () => {
  const snapshot = snapshotClubRatingProposals("se_club_ik_savehof");
  for (const row of snapshot.players) {
    assert.equal(typeof row.matchedCalibration, "boolean");
    assert.equal(typeof row.profile.playerId, "string");
  }
});
