// HM-UX-RATINGS-0.1 Part I: proves the normal Player Profile's new
// read path (HM-RATINGS-0.6's canonical gameplay snapshot) actually
// satisfies what the UI needs -- WITHOUT re-testing the whole
// HM-RATINGS-0.6 suite (see lib/gameWorld/gameplayRatingSnapshot.test.ts
// for the full population/determinism/anti-clone audit). This file
// only proves the UI-facing contract: complete profiles, exact
// evidence survival, and honest failure for an unknown case.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildCatalog } from "../editor/catalog";
import { GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES } from "../rating/types";
import { snapshotGameplayRatingsForClub } from "./gameplayRatingSnapshot";

function findByNameFragment(fragment: string) {
  const catalog = buildCatalog();
  for (const club of catalog.clubs) {
    const snapshot = snapshotGameplayRatingsForClub(club.clubId);
    const player = snapshot.players.find((p) => p.playerId.includes(fragment));
    if (player) return { player, clubName: snapshot.clubName };
  }
  return null;
}

test("HM-UX-RATINGS-0.1: a generated-prior player who previously had no CA/PA (Robin Järling) now resolves to a complete gameplay profile with numeric CA and PA", () => {
  const found = findByNameFragment("robin_jarling");
  assert.ok(found, "expected to find Robin Järling in the generated league");
  const { player } = found!;
  assert.ok(Number.isFinite(player.ca) && player.ca >= 1 && player.ca <= 200);
  assert.ok(Number.isFinite(player.pa) && player.pa >= 1 && player.pa <= 200);
  assert.ok(player.pa >= player.ca);
  const attrCount = Object.keys(player.branch.attributes).length;
  assert.equal(attrCount, player.branch.branch === "OUTCOURT" ? 56 : 21);
});

test("HM-UX-RATINGS-0.1: Robin Järling is matched to a HM-RATINGS-0.2 calibration entry (real PA band) whose CA was left unassessed -- the reported caSource must be GENERATED_GAME_PRIOR, not CALIBRATED, since the calibration match did not actually supply this CA value", () => {
  const found = findByNameFragment("robin_jarling");
  assert.ok(found);
  assert.equal(found!.player.caSource, "GENERATED_GAME_PRIOR", "matchedCalibration being true must not make an unrelated game-prior CA look calibrated");
});

test("HM-UX-RATINGS-0.1: calibrated player Gustav Davidsson's known evidence-backed values survive exactly on the gameplay read path", () => {
  const found = findByNameFragment("gustav_davidsson");
  assert.ok(found);
  const { player } = found!;
  assert.equal(player.caSource, "CALIBRATED");
  assert.equal(player.ca, 166);
  const attrs = player.branch.attributes as Record<string, { value: number; origin: string }>;
  assert.deepEqual(attrs.PASSING, { value: 20, origin: "EVIDENCE_BACKED" });
  assert.deepEqual(attrs.PLAYMAKING, { value: 20, origin: "EVIDENCE_BACKED" });
  assert.deepEqual(attrs.SHOOTING_PLACEMENT, { value: 15, origin: "EVIDENCE_BACKED" });
});

test("HM-UX-RATINGS-0.1: Andreas Nilsson's specialist asymmetry survives on the gameplay read path -- PIVOT_PLAY 20 / FINISHING 18 / DEFENSIVE_POSITIONING 8 never smoothed", () => {
  const found = findByNameFragment("andreas_nilsson");
  assert.ok(found);
  const attrs = found!.player.branch.attributes as Record<string, { value: number; origin: string }>;
  assert.equal(attrs.PIVOT_PLAY.value, 20);
  assert.equal(attrs.FINISHING.value, 18);
  assert.equal(attrs.DEFENSIVE_POSITIONING.value, 8);
});

test("HM-UX-RATINGS-0.1: a real goalkeeper's gameplay branch has exactly 21 goalkeeper attributes, never outcourt attributes", () => {
  const found = findByNameFragment("peter_johannesson");
  assert.ok(found);
  const { player } = found!;
  assert.equal(player.branch.branch, "GOALKEEPER");
  const keys = Object.keys(player.branch.attributes);
  assert.equal(keys.length, 21);
  for (const key of keys) assert.ok((GOALKEEPER_ATTRIBUTES as readonly string[]).includes(key));
  for (const key of keys) assert.ok(!(OUTCOURT_ATTRIBUTES as readonly string[]).includes(key));
});

test("HM-UX-RATINGS-0.1: an unknown clubId fails honestly (clubName null, empty players) -- the read path never fabricates a profile", () => {
  const snapshot = snapshotGameplayRatingsForClub("not_a_real_club_id");
  assert.equal(snapshot.clubName, null);
  assert.deepEqual(snapshot.players, []);
});

test("HM-UX-RATINGS-0.1: reading the gameplay snapshot never writes to source/evidence files -- purely a read path", () => {
  const catalog = buildCatalog();
  const hammarby = catalog.clubs.find((c) => c.clubId === "se_club_hammarby_if_hf")!;
  const playersFile = hammarby.playersFile;
  const before = fs.statSync(playersFile).mtimeMs;
  snapshotGameplayRatingsForClub(hammarby.clubId);
  snapshotGameplayRatingsForClub(hammarby.clubId);
  const after = fs.statSync(playersFile).mtimeMs;
  assert.equal(after, before);
});
