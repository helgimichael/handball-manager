import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluatePlayer, runOfflineCalibration } from "./engine";
import { REGRESSION_FIXTURES } from "./fixtures";
import type { OfflinePlayerContext } from "./types";

function mockContext(overrides: Partial<OfflinePlayerContext>): OfflinePlayerContext {
  return {
    playerId: "player_test_01",
    name: "Test Player",
    firstName: "Test",
    lastName: "Player",
    clubId: "se_club_test",
    clubName: "Test Club",
    competitionId: "se_handbollsligan_herr",
    primaryPosition: "M9",
    secondaryPositions: [],
    shirtNumber: 10,
    dateOfBirth: "2002-05-15",
    birthYear: 2002,
    age: 24,
    ageGroup: "24-27",
    nationality: "SWE",
    heightCm: 190,
    handedness: "RIGHT",
    onActiveRoster: true,
    isLocked: true,
    storedCA: 130,
    storedPA: 140,
    runtimeCA: 130,
    runtimePA: 140,
    caSource: "EDITOR_OVERRIDE",
    confidence: "HIGH",
    status: "RESEARCHED",
    lockedDate: "2026-08-30T10:00:00.000Z",
    lockedNote: "Test research note",
    outlierFlags: [],
    ...overrides,
  };
}

describe("Offline Calibration Engine", () => {
  it("enforces CA <= PA mathematical invariant across arbitrary inputs", () => {
    const invalidContext = mockContext({
      runtimeCA: 150,
      runtimePA: 120, // raw CA > PA
    });

    const proposal = evaluatePlayer(invalidContext);
    assert.ok(
      proposal.proposedCA <= proposal.proposedPA,
      `Invariant violated: proposedCA (${proposal.proposedCA}) > proposedPA (${proposal.proposedPA})`
    );
  });

  it("handles Markus Stegefelt as retired/excluded with preserved rating", () => {
    const stegefeltContext = mockContext({
      playerId: "player_markus_stegefelt_8aedec38",
      name: "Markus Stegefelt",
      clubId: "se_club_rp_if_linkoping",
      competitionId: "se_division1_norra",
      primaryPosition: "V9",
      age: 32,
      runtimeCA: 146,
      runtimePA: 146,
      isRetired: true,
    });

    const proposal = evaluatePlayer(stegefeltContext);
    assert.equal(proposal.decision, "KEEP");
    assert.equal(proposal.proposedCA, 146);
    assert.equal(proposal.proposedPA, 146);
    assert.equal(proposal.caDelta, 0);
    assert.equal(proposal.paDelta, 0);
    assert.ok(proposal.reviewFlags.includes("RETIRED_EXCLUDED"));
  });

  it("assigns PROVISIONAL status and band to unresearched profiles", () => {
    const unresearchedContext = mockContext({
      playerId: "player_unresearched_01",
      isLocked: false,
      status: "PROVISIONAL",
      runtimeCA: 100,
      runtimePA: 100,
      age: 18,
    });

    const proposal = evaluatePlayer(unresearchedContext);
    assert.equal(proposal.decision, "PROVISIONAL");
    assert.equal(proposal.confidence, "PROVISIONAL");
    assert.ok(proposal.provisionalBand);
    assert.ok(proposal.provisionalBand.paMax >= proposal.provisionalBand.paMin);
  });

  it("flags players with missing birth year and DOB for REVIEW_REQUIRED", () => {
    const missingDobContext = mockContext({
      playerId: "player_missing_dob_01",
      dateOfBirth: null,
      birthYear: null,
      age: null,
    });

    const proposal = evaluatePlayer(missingDobContext);
    assert.equal(proposal.decision, "REVIEW_REQUIRED");
    assert.ok(proposal.reviewFlags.includes("MISSING_BIRTH_YEAR_AND_DOB"));
  });

  it("correctly reproduces all regression fixtures", () => {
    const contexts = REGRESSION_FIXTURES.map((f) =>
      mockContext({
        playerId: f.playerId,
        name: f.name,
        runtimeCA: f.expectedCA,
        runtimePA: f.expectedPA,
      })
    );

    const result = runOfflineCalibration(contexts);
    assert.equal(result.regressionCheck.passed, true, `Regression check failed: ${result.regressionCheck.failures.join("; ")}`);
    assert.equal(result.regressionCheck.totalFixtures, REGRESSION_FIXTURES.length);
  });
});
