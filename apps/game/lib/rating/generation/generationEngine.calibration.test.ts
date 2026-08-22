// HM-RATINGS-0.4 Part F: calibration proof. Runs the generation engine
// against the real HM-RATINGS-0.2 calibrated players -- NOT a claim
// that generated attributes are real-world truth, but a check that the
// GAME REPRESENTATION the engine produces is coherent: evidence
// survives untouched, specialist asymmetry survives, and each position/
// role archetype (playmaker, wing, pivot, goalkeeper, high-potential,
// defensive specialist) produces a distinguishable, sane profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SWEDEN_CALIBRATION_V2_PROFILES } from "../swedenCalibrationV2";
import { generatePlayerRatingProfile } from "./generationEngine";
import { getAttributeLabel } from "../attributeVocabulary";

const CALIBRATION_PLAYER_IDS = [
  "se_player_gustav_davidsson", // M9 playmaker
  "se_player_andreas_nilsson", // M6 pivot
  "se_player_niclas_ekberg", // H6 wing
  "se_player_peter_johannesson", // GK
  "se_player_liam_hultberg", // M6, high-potential (no attribute evidence)
  "se_player_anders_wik_rydberg", // M6 defensive specialist
  "se_player_baldur_fritz_bjarnason", // V9
];

function findProfile(playerId: string) {
  const found = SWEDEN_CALIBRATION_V2_PROFILES.find((p) => p.playerId === playerId);
  assert.ok(found, `expected a calibrated fixture for ${playerId}`);
  return found!;
}

test("HM-RATINGS-0.4 calibration audit: all 7 named players generate a complete, coherent profile with resolved CA", () => {
  for (const playerId of CALIBRATION_PLAYER_IDS) {
    const profile = findProfile(playerId);
    const result = generatePlayerRatingProfile(profile);
    assert.equal(result.status, "OK", `${playerId} should generate successfully (CA is resolved for all 7)`);
    if (result.status !== "OK") continue;

    const expectedCount = result.profile.branch.branch === "GOALKEEPER" ? 21 : 56;
    assert.equal(Object.keys(result.profile.branch.attributes).length, expectedCount);

    // Audit line -- kept intentionally in the test output for the
    // HM-RATINGS-0.4 report's calibration section.
    const attrs = Object.entries(result.profile.branch.attributes);
    const topFive = [...attrs].sort((a, b) => b[1].value - a[1].value).slice(0, 5);
    console.log(
      `[HM-RATINGS-0.4 audit] ${playerId} | position=${profile.position} | CA=${result.profile.ca} | origin={E:${result.profile.originCounts.EVIDENCE_BACKED},D:${result.profile.originCounts.DERIVED},G:${result.profile.originCounts.GENERATED_PRIOR}} | top5=${topFive.map(([k, v]) => `${getAttributeLabel(k as never)}=${v.value}(${v.origin[0]})`).join(", ")}`,
    );
  }
});

test("HM-RATINGS-0.4 calibration audit: Gustav Davidsson's evidence (PASSING 20, PLAYMAKING 20, SHOOTING_PLACEMENT 15) survives generation exactly", () => {
  const result = generatePlayerRatingProfile(findProfile("se_player_gustav_davidsson"));
  assert.equal(result.status, "OK");
  if (result.status !== "OK" || result.profile.branch.branch !== "OUTCOURT") return;
  assert.equal(result.profile.branch.attributes.PASSING.value, 20);
  assert.equal(result.profile.branch.attributes.PLAYMAKING.value, 20);
  assert.equal(result.profile.branch.attributes.SHOOTING_PLACEMENT.value, 15);
  assert.equal(result.profile.branch.attributes.PASSING.origin, "EVIDENCE_BACKED");
});

test("HM-RATINGS-0.4 calibration audit: Andreas Nilsson's specialist asymmetry (PIVOT_PLAY 20 vs DEFENSIVE_POSITIONING 8) survives generation", () => {
  const result = generatePlayerRatingProfile(findProfile("se_player_andreas_nilsson"));
  assert.equal(result.status, "OK");
  if (result.status !== "OK" || result.profile.branch.branch !== "OUTCOURT") return;
  assert.equal(result.profile.branch.attributes.PIVOT_PLAY.value, 20);
  assert.equal(result.profile.branch.attributes.DEFENSIVE_POSITIONING.value, 8);
});

test("HM-RATINGS-0.4 calibration audit: Peter Johannesson (goalkeeper) generates the goalkeeper branch only, with his evidenced GK_POSITIONING preserved", () => {
  const result = generatePlayerRatingProfile(findProfile("se_player_peter_johannesson"));
  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.equal(result.profile.branch.branch, "GOALKEEPER");
  if (result.profile.branch.branch !== "GOALKEEPER") return;
  assert.equal(result.profile.branch.attributes.GK_POSITIONING.value, 18);
  assert.equal(result.profile.branch.attributes.GK_POSITIONING.origin, "EVIDENCE_BACKED");
});

test("HM-RATINGS-0.4 calibration audit: Liam Hultberg (high-potential, no attribute evidence) generates a fully-covered profile with zero EVIDENCE_BACKED attributes", () => {
  const result = generatePlayerRatingProfile(findProfile("se_player_liam_hultberg"));
  assert.equal(result.status, "OK");
  if (result.status !== "OK") return;
  assert.equal(result.profile.originCounts.EVIDENCE_BACKED, 0);
  const total = result.profile.originCounts.EVIDENCE_BACKED + result.profile.originCounts.DERIVED + result.profile.originCounts.GENERATED_PRIOR;
  assert.equal(total, result.profile.branch.branch === "GOALKEEPER" ? 21 : 56);
});
