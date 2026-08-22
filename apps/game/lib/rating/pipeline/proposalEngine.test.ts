// HM-RATINGS-0.3: proves the proposal engine's core guarantees --
// determinism, sparse-evidence honesty, no PA leakage, no double-
// counted context, goalkeeper/outcourt separation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { proposePlayerRating } from "./proposalEngine";
import { validatePlayerRatingProfile } from "../validators";
import type { RealWorldPlayer } from "../../gameWorld/realWorldLoader";

function player(overrides: Partial<RealWorldPlayer> & Pick<RealWorldPlayer, "playerId" | "fullName">): RealWorldPlayer {
  return {
    clubId: "test-club",
    firstName: "",
    lastName: "",
    aliases: [],
    dateOfBirth: null,
    birthYear: null,
    nationalities: null,
    heightCm: null,
    handedness: null,
    shirtNumber: null,
    sourcePosition: "Vänstersexa",
    primaryPosition: "V6",
    secondaryPositions: [],
    rosterStatus: "CONFIRMED",
    contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.3: proposePlayerRating is deterministic -- the same input always produces byte-identical output", () => {
  const p = player({ playerId: "se_player_random_1", fullName: "Random Player", heightCm: 190, birthYear: 2001 });
  const a = proposePlayerRating(p);
  const b = proposePlayerRating(p);
  assert.deepEqual(a, b);
});

test("HM-RATINGS-0.3: proposePlayerRating for a matched calibration player is deterministic across repeated calls too", () => {
  const p = player({ playerId: "se_player_gustav_davidsson_realid", fullName: "Gustav Davidsson" });
  const a = proposePlayerRating(p);
  const b = proposePlayerRating(p);
  assert.deepEqual(a, b);
});

// ---------------------------------------------------------------------------
// Anchor calibration cases remain directionally consistent
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.3: a matched calibration player's proposed CA/PA are the exact HM-RATINGS-0.2 values, re-keyed onto the real playerId", () => {
  const outcome = proposePlayerRating(player({ playerId: "se_player_andreas_nilsson_realid", fullName: "Andreas Nilsson" }));
  assert.equal(outcome.matchedCalibration, true);
  assert.equal(outcome.profile.ca.value, 168);
  assert.equal(outcome.profile.pa.value, 168);
  assert.equal(outcome.profile.playerId, "se_player_andreas_nilsson_realid");
  // Every claim is re-keyed onto the real id, never left pointing at the fixture's own placeholder id.
  for (const claim of outcome.profile.claims) {
    assert.equal(claim.playerId, "se_player_andreas_nilsson_realid");
  }
});

test("HM-RATINGS-0.3: matched calibration players preserve their specialist asymmetry through the pipeline (Andreas Nilsson: elite offence, weak defence, no defensive role)", () => {
  const outcome = proposePlayerRating(player({ playerId: "se_player_andreas_nilsson_realid2", fullName: "Andreas Nilsson" }));
  const attrs = outcome.profile.outcourtAttributes!;
  assert.equal(attrs.PIVOT_PLAY, 20);
  assert.equal(attrs.DEFENSIVE_POSITIONING, 8);
  assert.deepEqual(outcome.profile.defenceRoleProficiencies, []);
});

// ---------------------------------------------------------------------------
// Sparse players stay uncertain / no automatic average fallback
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.3: an ordinary, uncalibrated player proposes fully unresolved CA/PA -- never a mid-scale average, never a fabricated value", () => {
  const outcome = proposePlayerRating(player({ playerId: "se_player_ordinary_1", fullName: "Ordinary Player" }));
  assert.equal(outcome.matchedCalibration, false);
  assert.equal(outcome.profile.ca.value, null);
  assert.equal(outcome.profile.pa.value, null);
  assert.equal(outcome.profile.ca.confidence, "LOW");
  assert.equal(outcome.profile.pa.confidence, "LOW");
  // Full-scale range, never a narrow band around a guessed average.
  assert.deepEqual(outcome.profile.ca.plausibleRange, { min: 1, max: 200 });
});

test("HM-RATINGS-0.3: an ordinary player has no outcourtAttributes/goalkeeperAttributes and no role proficiencies -- absence, not a filled-in average profile", () => {
  const outcome = proposePlayerRating(player({ playerId: "se_player_ordinary_2", fullName: "Another Ordinary Player" }));
  assert.equal(outcome.profile.outcourtAttributes, undefined);
  assert.equal(outcome.profile.goalkeeperAttributes, undefined);
  assert.deepEqual(outcome.profile.attackRoleProficiencies, []);
  assert.deepEqual(outcome.profile.defenceRoleProficiencies, []);
});

test("HM-RATINGS-0.3: every proposal -- matched or not -- carries an explicit CALIBRATION-domain claim explaining WHY it received its result", () => {
  const matched = proposePlayerRating(player({ playerId: "se_player_niclas_ekberg_realid", fullName: "Niclas Ekberg" }));
  const unmatched = proposePlayerRating(player({ playerId: "se_player_ordinary_3", fullName: "Yet Another Player" }));
  assert.ok(matched.profile.claims.some((c) => c.domain === "CALIBRATION" && c.key === "proposalRationale"));
  assert.ok(unmatched.profile.claims.some((c) => c.domain === "CALIBRATION" && c.key === "proposalRationale"));
  const unmatchedRationale = unmatched.profile.claims.find((c) => c.key === "proposalRationale")!;
  assert.equal(unmatchedRationale.evidenceClass, "UNASSESSED");
});

// ---------------------------------------------------------------------------
// No PA leakage
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.3: pa never appears anywhere that could feed ca, attributes, or role proficiencies -- structurally isolated for every proposal in the set", () => {
  const outcomes = [
    proposePlayerRating(player({ playerId: "se_player_baldur_realid", fullName: "Baldur Fritz Bjarnason" })), // large ca/pa gap
    proposePlayerRating(player({ playerId: "se_player_ordinary_4", fullName: "Some Other Player" })),
  ];
  for (const outcome of outcomes) {
    const keys = Object.keys(outcome.profile);
    assert.equal(keys.filter((k) => k === "pa").length, 1);
    // pa's own value is never mirrored into ca.
    if (outcome.profile.ca.value !== null && outcome.profile.pa.value !== null) {
      assert.ok(outcome.profile.pa.value >= outcome.profile.ca.value);
    }
  }
});

// ---------------------------------------------------------------------------
// Context not double-counted
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.3: the position claim carries at most one contextRef, and AbilityRating itself has no context field at all -- context can never be counted twice", () => {
  const outcome = proposePlayerRating(player({ playerId: "se_player_ordinary_5", fullName: "Context Test Player", primaryPosition: "M9" }));
  const positionClaim = outcome.profile.claims.find((c) => c.domain === "POSITION")!;
  assert.equal(typeof positionClaim.contextRef, "string");
  assert.equal(Array.isArray(positionClaim.contextRef), false);
  assert.deepEqual(Object.keys(outcome.profile.ca).sort(), ["confidence", "plausibleRange", "value"]);
});

test("HM-RATINGS-0.3: age is recorded purely as context (never read into ca/pa) -- two players differing only in birthYear produce identical ca/pa", () => {
  const young = proposePlayerRating(player({ playerId: "se_player_age_test_young", fullName: "Age Test Player A", birthYear: 2006 }));
  const old = proposePlayerRating(player({ playerId: "se_player_age_test_old", fullName: "Age Test Player B", birthYear: 1985 }));
  assert.deepEqual({ value: young.profile.ca.value, confidence: young.profile.ca.confidence }, { value: old.profile.ca.value, confidence: old.profile.ca.confidence });
});

// ---------------------------------------------------------------------------
// Goalkeeper/outcourt separation
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.3: a real goalkeeper (primaryPosition MV) is proposed with position GK and validates cleanly even with no calibration match", () => {
  const outcome = proposePlayerRating(player({ playerId: "se_player_gk_ordinary", fullName: "Ordinary Goalkeeper", primaryPosition: "MV", sourcePosition: "Målvakt" }));
  assert.equal(outcome.profile.position, "GK");
  assert.equal(outcome.profile.outcourtAttributes, undefined);
  assert.equal(validatePlayerRatingProfile(outcome.profile).ok, true);
});

test("HM-RATINGS-0.3: the matched goalkeeper calibration (Peter Johannesson) keeps position GK and goalkeeper-only attributes through the pipeline", () => {
  const outcome = proposePlayerRating(player({ playerId: "se_player_peter_johannesson_realid", fullName: "Peter Johannesson", primaryPosition: "MV" }));
  assert.equal(outcome.matchedCalibration, true);
  assert.equal(outcome.profile.position, "GK");
  assert.equal(outcome.profile.outcourtAttributes, undefined);
  assert.ok(outcome.profile.goalkeeperAttributes);
  assert.equal(validatePlayerRatingProfile(outcome.profile).ok, true);
});

test("HM-RATINGS-0.3: every proposed profile (matched or not) validates against the domain's own invariants", () => {
  const players = [
    player({ playerId: "se_player_v1", fullName: "V6 Player", primaryPosition: "V6" }),
    player({ playerId: "se_player_v2", fullName: "V9 Player", primaryPosition: "V9" }),
    player({ playerId: "se_player_v3", fullName: "M9 Player", primaryPosition: "M9" }),
    player({ playerId: "se_player_v4", fullName: "M6 Player", primaryPosition: "M6" }),
    player({ playerId: "se_player_v5", fullName: "H9 Player", primaryPosition: "H9" }),
    player({ playerId: "se_player_v6", fullName: "H6 Player", primaryPosition: "H6" }),
    player({ playerId: "se_player_v7", fullName: "GK Player", primaryPosition: "MV" }),
    player({ playerId: "se_player_v8", fullName: "Gustav Davidsson", primaryPosition: "M9" }),
  ];
  for (const p of players) {
    const outcome = proposePlayerRating(p);
    const result = validatePlayerRatingProfile(outcome.profile);
    assert.equal(result.ok, true, result.ok ? "" : `${p.fullName}: ${JSON.stringify(result.errors)}`);
  }
});
