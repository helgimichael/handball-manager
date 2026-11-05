import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  evaluatePlayerRules,
  isDefensiveSpecialist,
  evaluateCrossLeagueTransition,
  evaluateDomesticOutfieldPerformance,
  evaluateSwe2Standouts,
  evaluateGoalkeeperCalibration,
} from "./rules";
import type { OfflinePlayerContext } from "./types";
import type { PlayerEvidenceRecord } from "../evidencePipeline/schema";

function createMockContext(overrides: Partial<OfflinePlayerContext> = {}): OfflinePlayerContext {
  return {
    playerId: "player_unseen_synthetic_01",
    name: "Synthetic Unseen Player",
    firstName: "Synthetic",
    lastName: "Player",
    clubId: "se_club_synthetic_hk",
    clubName: "Synthetic HK",
    competitionId: "se_handbollsligan_herr",
    primaryPosition: "M9",
    secondaryPositions: [],
    shirtNumber: 10,
    dateOfBirth: "2000-01-01",
    birthYear: 2000,
    age: 26,
    ageGroup: "24-27",
    nationality: "SWE",
    heightCm: 190,
    handedness: "RIGHT",
    onActiveRoster: true,
    isLocked: true,
    storedCA: 130,
    storedPA: 145,
    runtimeCA: 130,
    runtimePA: 145,
    caSource: "RESEARCHED_BASELINE",
    confidence: "HIGH",
    status: "RESEARCHED",
    lockedDate: "2026-11-01",
    lockedNote: "Synthetic test player",
    outlierFlags: [],
    ...overrides,
  };
}

function createMockEvidence(
  facts: Partial<PlayerEvidenceRecord["verifiedFacts"]> = {},
  overrides: Partial<PlayerEvidenceRecord> = {}
): PlayerEvidenceRecord {
  return {
    playerId: "player_unseen_synthetic_01",
    name: "Synthetic Unseen Player",
    clubId: "se_club_synthetic_hk",
    clubName: "Synthetic HK",
    competitionId: "se_handbollsligan_herr",
    position: "M9",
    sourceId: "synthetic:test",
    sourceUrl: null,
    sourceDate: "2026-11-05",
    sourceQuality: "OFFICIAL_LEAGUE_STATS",
    completenessScore: 0.9,
    verifiedFacts: {
      competition: "se_handbollsligan_herr",
      season: "2025-26",
      appearances: 24,
      goals: 100,
      assists: 50,
      technicalErrors: 30,
      suspensions: 2,
      shotsFaced: null,
      saves: null,
      savePercentage: null,
      sevenMetreSaves: null,
      sevenMetresFaced: null,
      internationalCaps: null,
      internationalLevel: "NONE",
      honors: [],
      ...facts,
    },
    unverifiedClaims: [],
    careerProgression: {
      previousClubs: [],
      previousTiers: [],
      isCrossLeagueMover: false,
      transitionContext: null,
    },
    ...overrides,
  };
}

describe("Generalized Offline Engine — Unseen Synthetic Player Verification", () => {
  it("calibrates synthetic unseen cross-league scorer transitioning from tier 2 to premier league", () => {
    const ctx = createMockContext({
      playerId: "player_unseen_cross_league_star",
      competitionId: "se_handbollsligan_herr",
      primaryPosition: "V9",
      runtimeCA: 120,
      runtimePA: 140,
    });
    ctx.evidence = createMockEvidence({
      competition: "swe-2",
      appearances: 24,
      goals: 182, // 7.58 gpg
    });

    const proposal = evaluatePlayerRules(ctx);
    assert.equal(proposal.decision, "PROPOSE");
    assert.equal(proposal.proposedCA, 134);
    assert.equal(proposal.proposedPA, 140); // Strict PA decoupling
    assert.equal(proposal.caDelta, 14);
    assert.ok(proposal.reviewFlags.includes("DOCUMENTED_CROSS_LEAGUE_MOVER"));
    assert.equal(proposal.isCaPaConflict, false);
  });

  it("calibrates synthetic unseen domestic offensive engine (>250 involvements)", () => {
    const ctx = createMockContext({
      playerId: "player_unseen_mvp_playmaker",
      competitionId: "se_handbollsligan_herr",
      primaryPosition: "M9",
      runtimeCA: 140,
      runtimePA: 155,
    });
    ctx.evidence = createMockEvidence({
      competition: "se_handbollsligan_herr",
      appearances: 26,
      goals: 130,
      assists: 135, // 265 total involvements (10.2 per game)
    });

    const proposal = evaluatePlayerRules(ctx);
    assert.equal(proposal.decision, "PROPOSE");
    assert.equal(proposal.proposedCA, 149);
    assert.equal(proposal.proposedPA, 155);
    assert.equal(proposal.caDelta, 9);
    assert.ok(proposal.reviewFlags.includes("HIGH_VOLUME_OFFENSIVE_ENGINE"));
  });

  it("strictly decouples CA and PA, flagging CA > PA conflict without inflating PA", () => {
    const ctx = createMockContext({
      playerId: "player_unseen_conflict_candidate",
      competitionId: "se_handbollsligan_herr",
      primaryPosition: "M9",
      runtimeCA: 144,
      runtimePA: 146, // Current PA is lower than proposed CA (149)
    });
    ctx.evidence = createMockEvidence({
      competition: "se_handbollsligan_herr",
      appearances: 25,
      goals: 125,
      assists: 130, // 255 total involvements
    });

    const proposal = evaluatePlayerRules(ctx);
    assert.equal(proposal.decision, "PROPOSE");
    assert.equal(proposal.proposedCA, 149);
    assert.equal(proposal.proposedPA, 146); // PA NOT silently inflated!
    assert.equal(proposal.isCaPaConflict, true);
    assert.equal(proposal.conflictMagnitude, 3);
    assert.ok(proposal.reviewFlags.includes("CA_EXCEEDS_PA_CONFLICT"));
  });

  it("protects defensive specialists from false downgrades despite very low goal scoring", () => {
    const ctx = createMockContext({
      playerId: "player_unseen_defense_rock",
      competitionId: "se_handbollsligan_herr",
      primaryPosition: "M6",
      runtimeCA: 135,
      runtimePA: 138,
      dataNotes: "Key defensive anchor and 2-way center defender",
    });
    ctx.evidence = createMockEvidence({
      competition: "se_handbollsligan_herr",
      appearances: 26,
      goals: 8, // Very low scoring
      assists: 5,
      suspensions: 16, // High disciplinary workload
    });

    assert.equal(isDefensiveSpecialist(ctx, ctx.evidence.verifiedFacts), true);

    const proposal = evaluatePlayerRules(ctx);
    assert.equal(proposal.decision, "KEEP");
    assert.equal(proposal.proposedCA, 135);
    assert.ok(proposal.reviewFlags.includes("DEFENSIVE_SPECIALIST_PROTECTED"));
  });

  it("calibrates overvalued starting goalkeepers downward only when backed by large shot sample", () => {
    // 1. Large sample with sub-par efficiency: MUST propose calibrated downward CA
    const heavyWkldCtx = createMockContext({
      playerId: "player_unseen_struggling_gk",
      competitionId: "se_handbollsligan_herr",
      primaryPosition: "MV",
      runtimeCA: 148,
      runtimePA: 150,
    });
    heavyWkldCtx.evidence = createMockEvidence({
      competition: "se_handbollsligan_herr",
      appearances: 26,
      shotsFaced: 850,
      saves: 225,
      savePercentage: 26.5, // < 27.5% over 850 shots
    });

    const proposal1 = evaluatePlayerRules(heavyWkldCtx);
    assert.equal(proposal1.decision, "PROPOSE");
    assert.equal(proposal1.proposedCA, 142);
    assert.equal(proposal1.caDelta, -6);
    assert.ok(proposal1.reviewFlags.includes("GK_SAVE_PERCENTAGE_OVERRATED"));

    // 2. Small sample with low save percentage: MUST be protected from downgrade!
    const smallSampleCtx = createMockContext({
      playerId: "player_unseen_small_sample_gk",
      competitionId: "se_handbollsligan_herr",
      primaryPosition: "MV",
      runtimeCA: 140,
      runtimePA: 150,
    });
    smallSampleCtx.evidence = createMockEvidence({
      competition: "se_handbollsligan_herr",
      appearances: 8,
      shotsFaced: 180, // < 500 shots!
      saves: 40,
      savePercentage: 22.2, // Small sample anomaly
    });

    const proposal2 = evaluatePlayerRules(smallSampleCtx);
    assert.equal(proposal2.decision, "KEEP");
    assert.equal(proposal2.proposedCA, 140); // Preserved!
  });

  it("calibrates summit overvalued goalkeeper downward to elite anchor benchmark", () => {
    const summitCtx = createMockContext({
      playerId: "player_unseen_summit_gk",
      competitionId: "se_handbollsligan_herr",
      primaryPosition: "MV",
      runtimeCA: 154, // Above Niklas Kraft (150)
      runtimePA: 156,
    });
    summitCtx.evidence = createMockEvidence({
      competition: "se_handbollsligan_herr",
      appearances: 26,
      shotsFaced: 800,
      saves: 230,
      savePercentage: 28.7, // < 30.0%
    });

    const proposal = evaluatePlayerRules(summitCtx);
    assert.equal(proposal.decision, "PROPOSE");
    assert.equal(proposal.proposedCA, 148);
    assert.equal(proposal.caDelta, -6);
    assert.ok(proposal.reviewFlags.includes("GK_SUMMIT_RATING_OVERVALUED"));
  });

  it("handles youth players with large formula gaps by assigning 4-pillar provisional band", () => {
    const youthCtx = createMockContext({
      playerId: "player_unseen_youth_prospect",
      age: 18,
      primaryPosition: "V9",
      runtimeCA: 95,
      runtimePA: 150, // Gap = 55
      status: "RESEARCHED",
      isLocked: true,
    });

    const proposal = evaluatePlayerRules(youthCtx);
    assert.equal(proposal.decision, "PROVISIONAL");
    assert.ok(proposal.provisionalBand);
    assert.ok(proposal.provisionalBand.uncertaintyBandWidth >= 16);
    assert.ok(proposal.reviewFlags.includes("YOUTH_DEVELOPMENTAL_BAND"));
  });

  it("flags synthetic players with missing vital data for human review", () => {
    const missingCtx = createMockContext({
      playerId: "player_unseen_missing_dob",
      dateOfBirth: null,
      birthYear: null,
      age: null,
    });

    const proposal = evaluatePlayerRules(missingCtx);
    assert.equal(proposal.decision, "REVIEW_REQUIRED");
    assert.ok(proposal.reviewFlags.includes("MISSING_BIRTH_YEAR_AND_DOB"));
  });
});
