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

test("HM-UX-RATINGS-0.1: Robin Järling was later given a final individually-researched HBL v2.13 CA/PA -- both sources are now EDITOR_OVERRIDE (a real locked value), not the old GENERATED_GAME_PRIOR fallback", () => {
  const workbench = buildRatingWorkbenchForClub("se_club_hammarby_if_hf");
  assert.ok(workbench);
  const row = workbench!.rows.find((r) => r.profile.playerId.includes("robin_jarling"));
  assert.ok(row, "expected to find Robin Järling in Hammarby's roster");
  // HBL_rating_import_candidates_v2.13 (268/268 individually researched,
  // 0 REVIEW) locks a real researched CA/PA for this player, superseding
  // the prior game-prior fallback documented above.
  assert.equal(row!.caSource, "EDITOR_OVERRIDE");
  assert.equal(row!.paSource, "EDITOR_OVERRIDE");
  assert.ok(row!.profile.ca.value !== null);
  assert.ok(row!.profile.pa.value !== null);
});

test("HM-UX-RATINGS-0.1: a fully-calibrated player (Gustav Davidsson) reports EDITOR_OVERRIDE for both caSource and paSource after the HBL v2.13 research import", () => {
  const workbench = buildRatingWorkbenchForClub("se_club_hammarby_if_hf");
  assert.ok(workbench);
  const row = workbench!.rows.find((r) => r.profile.playerId.includes("gustav_davidsson"));
  assert.ok(row);
  assert.equal(row!.caSource, "EDITOR_OVERRIDE");
  assert.equal(row!.paSource, "EDITOR_OVERRIDE");
});
