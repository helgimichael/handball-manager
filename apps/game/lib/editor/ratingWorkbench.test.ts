// HM-UX-RATINGS-0.1: regression test for a bug found during this
// milestone's browser QA -- Robin Järling is matched to a real
// HM-RATINGS-0.2 calibration entry (matchedCalibration: true), but
// that entry's CA is `unassessedAbilityRating()` and its PA is seeded
// from `paRatingFromPotentialAnchor("HIGH_POTENTIAL")`, which by
// HM-RATINGS-0.1 design ALWAYS returns `value: null` -- "a RANGE from
// a qualitative anchor, never a point value" (validators.ts). So
// neither of Robin's numbers actually came from calibration; both fell
// through to HM-RATINGS-0.6's game prior. The bug: `caSource`/
// `paSource` were derived as "matchedCalibration ? CALIBRATED : ...",
// so both incorrectly showed CALIBRATED in the UI even though the
// calibration match didn't supply either value.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRatingWorkbenchForClub } from "./ratingWorkbench";

test("HM-UX-RATINGS-0.1: Robin Järling's caSource and paSource are both GENERATED_GAME_PRIOR -- matchedCalibration alone must not paint a value CALIBRATED when the calibration entry left it unresolved", () => {
  const workbench = buildRatingWorkbenchForClub("se_club_hammarby_if_hf");
  assert.ok(workbench);
  const row = workbench!.rows.find((r) => r.profile.playerId.includes("robin_jarling"));
  assert.ok(row, "expected to find Robin Järling in Hammarby's roster");
  assert.equal(row!.matchedCalibration, true);
  assert.equal(row!.caSource, "GENERATED_GAME_PRIOR");
  assert.equal(row!.paSource, "GENERATED_GAME_PRIOR");
  assert.ok(row!.profile.ca.value !== null);
  assert.ok(row!.profile.pa.value !== null);
});

test("HM-UX-RATINGS-0.1: a fully-calibrated player (Gustav Davidsson) reports CALIBRATED for both caSource and paSource", () => {
  const workbench = buildRatingWorkbenchForClub("se_club_hammarby_if_hf");
  assert.ok(workbench);
  const row = workbench!.rows.find((r) => r.profile.playerId.includes("gustav_davidsson"));
  assert.ok(row);
  assert.equal(row!.caSource, "CALIBRATED");
  assert.equal(row!.paSource, "CALIBRATED");
});
