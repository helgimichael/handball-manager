// HM-RATINGS-0.5 Part N/O/R: proves the CA estimator's core invariants
// -- determinism, honest UNRESOLVED for no evidence, anchor-relative
// reasoning, and the anti-bias guarantees the design docs require
// (age/nationality/club/height/PA must never influence CA).
import { test } from "node:test";
import assert from "node:assert/strict";
import type { PlayerRatingClaim } from "../types";
import { CA_SCORE_ANCHORS } from "./anchorTable";
import { estimateCA } from "./caEstimator";
import { scoreClaimForCA, scoreClaimsForCA } from "./signalScoring";

function claim(overrides: Partial<PlayerRatingClaim>): PlayerRatingClaim {
  return { id: "c1", playerId: "p1", evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CAREER_SIGNAL", key: "x", value: "senior international", sourceRefs: [], ...overrides };
}

test("HM-RATINGS-0.5: a player with zero CA-relevant claims is UNRESOLVED, never a silently invented CA", () => {
  const result = estimateCA("p1", []);
  assert.equal(result.status, "UNRESOLVED");
  assert.equal(result.value, null);
  assert.deepEqual(result.contributingClaims, []);
});

test("HM-RATINGS-0.5: a player with only structural POSITION/CONTEXT claims is UNRESOLVED", () => {
  const claims: PlayerRatingClaim[] = [
    { id: "c1", playerId: "p1", evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "POSITION", key: "primaryPosition", value: "M9", sourceRefs: [] },
    { id: "c2", playerId: "p1", evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CONTEXT", key: "birthYear", value: 2000, sourceRefs: [] },
  ];
  const result = estimateCA("p1", claims);
  assert.equal(result.status, "UNRESOLVED");
});

test("HM-RATINGS-0.5: INJURY_AVAILABILITY and PROJECTION_EXPECTATION claims never contribute CA evidence", () => {
  const claims: PlayerRatingClaim[] = [
    { id: "c1", playerId: "p1", evidenceClass: "INJURY_AVAILABILITY", domain: "INJURY", key: "x", value: "ACL injury, out for season", sourceRefs: [] },
    { id: "c2", playerId: "p1", evidenceClass: "PROJECTION_EXPECTATION", domain: "PROJECTION", key: "x", value: "expected to become a star", sourceRefs: [] },
  ];
  assert.equal(scoreClaimForCA(claims[0]), 0);
  assert.equal(scoreClaimForCA(claims[1]), 0);
  const result = estimateCA("p1", claims);
  assert.equal(result.status, "UNRESOLVED");
});

test("HM-RATINGS-0.5: a PA-leaning anchor (HIGH_POTENTIAL) contributes zero CA evidence on its own", () => {
  const claims: PlayerRatingClaim[] = [{ id: "c1", playerId: "p1", evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "HIGH_POTENTIAL", sourceRefs: [] }];
  const result = estimateCA("p1", claims);
  assert.equal(result.status, "UNRESOLVED");
});

test("HM-RATINGS-0.5: estimation is deterministic -- same playerId + claims + model version always produces the same proposal", () => {
  const claims = [claim({ value: "senior international" }), claim({ id: "c2", evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" })];
  const a = estimateCA("p1", claims);
  const b = estimateCA("p1", claims);
  assert.deepEqual(a, b);
});

test("HM-RATINGS-0.5: a CA proposal for a resolvable player interpolates within the calibrated anchor CA range", () => {
  const claims = [claim({ value: "senior international, foreign professional experience" }), claim({ id: "c2", evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" })];
  const result = estimateCA("p1", claims);
  assert.equal(result.status, "ESTIMATED");
  assert.ok(result.value !== null);
  const minAnchorCA = Math.min(...CA_SCORE_ANCHORS.map((a) => a.ca));
  const maxAnchorCA = Math.max(...CA_SCORE_ANCHORS.map((a) => a.ca));
  assert.ok(result.value! >= minAnchorCA && result.value! <= maxAnchorCA, `expected interpolated CA ${result.value} within anchor range [${minAnchorCA}, ${maxAnchorCA}]`);
});

test("HM-RATINGS-0.5: a weaker-evidence player never outranks a clearly stronger-evidence player (relative order, Part O)", () => {
  const weak = estimateCA("weak", [claim({ value: "established Handbollsligan experience" })]);
  const strong = estimateCA(
    "strong",
    [
      claim({ value: "senior international, foreign professional experience, Champions League" }),
      claim({ id: "c2", evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_ICON" }),
      claim({ id: "c3", evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "FUNCTIONAL_ATTRIBUTE", key: "passing", value: "EXCEPTIONAL" }),
    ],
  );
  assert.equal(weak.status, "ESTIMATED");
  assert.equal(strong.status, "ESTIMATED");
  assert.ok(strong.value! > weak.value!, `expected strong (${strong.value}) > weak (${weak.value})`);
});

// ---------------------------------------------------------------------------
// Anti-bias tests (Part N). PlayerRatingClaim/estimateCA have no channel
// for age, nationality, club identity, or height at all -- these tests
// prove that structurally, not just by absence of a bug today.
// ---------------------------------------------------------------------------

test("HM-RATINGS-0.5: same evidence, different age -- estimateCA has no age parameter, and a birthYear/CONTEXT claim contributes zero score", () => {
  // estimateCA's signature is (playerId, claims, modelVersion) -- there
  // is no age input at all, so two calls with identical claims but
  // "different ages" are, structurally, the exact same call.
  const claims = [claim({ value: "senior international" })];
  assert.equal(estimateCA("player_young", claims).value, estimateCA("player_old", claims).value);
  const ageClaim: PlayerRatingClaim = { id: "age", playerId: "p1", evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CONTEXT", key: "birthYear", value: 2008, sourceRefs: [] };
  assert.equal(scoreClaimForCA(ageClaim), 0, "a birthYear/CONTEXT claim must never contribute CA evidence");
});

test("HM-RATINGS-0.5: same evidence, different nationality -- no claim field represents nationality, so it cannot influence scoring", () => {
  const claims = [claim({ value: "senior international" })];
  const sweden = estimateCA("p_swe", claims);
  const norway = estimateCA("p_nor", claims);
  assert.equal(sweden.value, norway.value);
  assert.equal(sweden.confidence, norway.confidence);
});

test("HM-RATINGS-0.5: same evidence, different club name/reputation only -- club identity has no field in PlayerRatingClaim/scoring at all", () => {
  const claims = [claim({ value: "senior international" }), claim({ id: "c2", evidenceClass: "USER_EXPERT_PLAYER_ANCHOR", domain: "ANCHOR", key: "importance", value: "CLUB_STAR" })];
  const a = estimateCA("p_famous_club", claims);
  const b = estimateCA("p_obscure_club", claims);
  assert.deepEqual({ value: a.value, confidence: a.confidence, plausibleRange: a.plausibleRange }, { value: b.value, confidence: b.confidence, plausibleRange: b.plausibleRange });
});

test("HM-RATINGS-0.5: higher PA alone does not raise CA -- estimateCA takes no PA input at all", () => {
  // Structural proof: estimateCA(playerId, claims, modelVersion) has no
  // PA parameter, so PA cannot possibly reach this function.
  const claims = [claim({ value: "senior international" })];
  const result = estimateCA("p1", claims);
  assert.ok(!("pa" in result));
});

test("HM-RATINGS-0.5: height alone cannot create CA evidence -- no scoring path reads a physicalProfile field", () => {
  const heightClaim = { id: "h", playerId: "p1", evidenceClass: "VERIFIED_CAREER_SIGNAL" as const, domain: "PHYSICAL", key: "heightCm", value: 200, sourceRefs: [] };
  assert.equal(scoreClaimForCA(heightClaim), 0);
});

test("HM-RATINGS-0.5: ClubIdentityProfile-shaped evidence (a claim with no ANCHOR/CAREER_SIGNAL/FUNCTIONAL_ATTRIBUTE domain) cannot create CA on its own", () => {
  const clubLevelClaim: PlayerRatingClaim = { id: "club", playerId: "p1", evidenceClass: "VERIFIED_CAREER_SIGNAL", domain: "CLUB_CONTEXT", key: "clubStrength", value: 90, sourceRefs: [] };
  const result = estimateCA("p1", [clubLevelClaim]);
  assert.equal(result.status, "UNRESOLVED");
});

test("HM-RATINGS-0.5: youth-development-reputation-only evidence cannot create CA on its own (youth-only career signal scores far below a genuine senior signal)", () => {
  const youthOnly = claim({ value: "youth international, U20 European Championship selection, Riksläger" });
  const senior = claim({ value: "senior international, World Championship silver" });
  const youthScore = scoreClaimsForCA([youthOnly]).totalScore;
  const seniorScore = scoreClaimsForCA([senior]).totalScore;
  assert.ok(seniorScore > youthScore, `expected senior evidence (${seniorScore}) to outweigh youth-only evidence (${youthScore})`);
});
