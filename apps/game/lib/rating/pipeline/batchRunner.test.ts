// HM-RATINGS-0.3: proves the batch runner handles all 14 real
// Handbollsligan clubs safely and produces a coherent, honest audit
// summary -- run against real roster data, not synthetic fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuditSummary, handbollsliganClubIds, runRatingPipelineForClub, runRatingPipelineForLeague } from "./batchRunner";
import { validatePlayerRatingProfile } from "../validators";

test("HM-RATINGS-0.3: handbollsliganClubIds returns exactly the 14 current REAL_WORLD Handbollsligan clubs", () => {
  const ids = handbollsliganClubIds();
  assert.equal(ids.length, 14);
  assert.equal(new Set(ids).size, 14);
});

test("HM-RATINGS-0.3: the batch handles all 14 clubs safely -- every club produces a non-empty roster with zero invalid profiles and zero unresolved positions", () => {
  const { clubResults } = runRatingPipelineForLeague();
  assert.equal(clubResults.length, 14);
  for (const r of clubResults) {
    assert.ok(r.profiles.length > 0, `${r.clubId} produced no players`);
    assert.equal(r.invalidProfileCount, 0, `${r.clubId} has invalid profiles`);
    assert.equal(r.unresolvedPositionCount, 0, `${r.clubId} has unresolved-position players`);
  }
});

test("HM-RATINGS-0.3: an unknown clubId is a safe no-op (empty result), never a thrown error", () => {
  const result = runRatingPipelineForClub("not_a_real_club_id");
  assert.deepEqual(result.profiles, []);
  assert.equal(result.clubName, null);
});

test("HM-RATINGS-0.3: running the full league pipeline twice produces byte-identical results -- deterministic at batch scale, not just per-player", () => {
  const a = runRatingPipelineForLeague();
  const b = runRatingPipelineForLeague();
  assert.deepEqual(a, b);
});

test("HM-RATINGS-0.3: every real profile in the league batch validates against the domain's own invariants (goalkeeper/outcourt separation, role/attack-defence separation, CA-PA ceiling, etc.)", () => {
  const { clubResults } = runRatingPipelineForLeague();
  for (const r of clubResults) {
    for (const profile of r.profiles) {
      const result = validatePlayerRatingProfile(profile);
      assert.equal(result.ok, true, result.ok ? "" : `${r.clubId}/${profile.playerId}: ${JSON.stringify(result.errors)}`);
    }
  }
});

test("HM-RATINGS-0.3: all 12 HM-RATINGS-0.2 calibration players are found somewhere in the real 14-club roster", () => {
  const { clubResults } = runRatingPipelineForLeague();
  const totalMatched = clubResults.reduce((sum, r) => sum + r.matchedCalibrationCount, 0);
  assert.equal(totalMatched, 12);
});

test("HM-RATINGS-0.3: the audit summary's counts are internally consistent -- proposed + unresolved always equals totalPlayers for both CA and PA", () => {
  const { auditSummary } = runRatingPipelineForLeague();
  assert.equal(auditSummary.caProposedCount + auditSummary.caUnresolvedCount, auditSummary.totalPlayers);
  assert.equal(auditSummary.paProposedCount + auditSummary.paUnresolvedCount, auditSummary.totalPlayers);
});

test("HM-RATINGS-0.3: the vast majority of the real roster is honestly left CA-unresolved -- the pipeline never mass-guesses ratings for uncalibrated players", () => {
  const { auditSummary } = runRatingPipelineForLeague();
  assert.ok(auditSummary.totalPlayers > 200, "sanity: the real roster should have well over 200 players across 14 clubs");
  assert.ok(auditSummary.caUnresolvedCount / auditSummary.totalPlayers > 0.9, "over 90% of the real roster must remain CA-unresolved in this milestone");
  assert.equal(auditSummary.caProposedCount, 10, "exactly the matched-calibration players with a resolved CA point value should be numerically proposed");
});

test("HM-RATINGS-0.3: confidence distributions sum to totalPlayers for both CA and PA", () => {
  const { auditSummary } = runRatingPipelineForLeague();
  const caSum = auditSummary.caConfidenceDistribution.LOW + auditSummary.caConfidenceDistribution.MEDIUM + auditSummary.caConfidenceDistribution.HIGH;
  const paSum = auditSummary.paConfidenceDistribution.LOW + auditSummary.paConfidenceDistribution.MEDIUM + auditSummary.paConfidenceDistribution.HIGH;
  assert.equal(caSum, auditSummary.totalPlayers);
  assert.equal(paSum, auditSummary.totalPlayers);
});

test("HM-RATINGS-0.3: clubsWithWeakEvidenceCoverage lists exactly the clubs with zero matched calibration players, and is a strict subset of all 14 clubs", () => {
  const { clubResults, auditSummary } = runRatingPipelineForLeague();
  const expectedWeak = clubResults.filter((r) => r.matchedCalibrationCount === 0).map((r) => r.clubId);
  assert.deepEqual(new Set(auditSummary.clubsWithWeakEvidenceCoverage), new Set(expectedWeak));
  assert.ok(auditSummary.clubsWithWeakEvidenceCoverage.length < 14, "at least one club must have real calibration coverage");
  assert.ok(auditSummary.clubsWithWeakEvidenceCoverage.length > 0, "most clubs in this milestone still have zero calibrated evidence -- an honest, expected finding");
});

test("HM-RATINGS-0.3: outliers only ever flag the documented, legitimate patterns (LOW-confidence resolved CA, or resolved PA with unresolved CA) -- never an arbitrary judgement about whether a number is 'right'", () => {
  const { auditSummary } = runRatingPipelineForLeague();
  for (const outlier of auditSummary.outliers) {
    assert.ok(
      outlier.reason.includes("LOW confidence") || outlier.reason.includes("ca remains fully unassessed"),
      `unexpected outlier reason: ${outlier.reason}`,
    );
  }
});

test("HM-RATINGS-0.3: buildAuditSummary is a pure function of its clubResults input -- calling it twice on the same data produces identical output", () => {
  const { clubResults } = runRatingPipelineForLeague();
  const a = buildAuditSummary(clubResults);
  const b = buildAuditSummary(clubResults);
  assert.deepEqual(a, b);
});

test("HM-RATINGS-0.3: running the pipeline for a subset of clubs (e.g. just the clubs with calibrated players) never affects results for other clubs -- no shared mutable state across calls", () => {
  const subsetA = runRatingPipelineForClub("se_club_hammarby_if_hf");
  const subsetB = runRatingPipelineForClub("se_club_ystads_if_hf");
  const full = runRatingPipelineForLeague();
  const hammarbyFromFull = full.clubResults.find((r) => r.clubId === "se_club_hammarby_if_hf")!;
  const ystadFromFull = full.clubResults.find((r) => r.clubId === "se_club_ystads_if_hf")!;
  assert.deepEqual(subsetA.profiles, hammarbyFromFull.profiles);
  assert.deepEqual(subsetB.profiles, ystadFromFull.profiles);
});
