import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateStagedImportDiffs,
  formatDiffsAsCsv,
} from "./diffGenerator";
import {
  createCatalogSnapshot,
  verifyRollbackIntegrity,
  computeRollbackDiffs,
} from "./rollbackManager";
import {
  getSaveProtectionGuarantee,
  verifySaveStateIsolation,
} from "./saveProtection";
import type { CalibrationProposal } from "../offlineEngine/types";

describe("Controlled Import Readiness Pipeline", () => {
  it("generates staged import diffs with auto-approval for safe changes and blocks CA > PA conflicts", () => {
    const mockProposals: CalibrationProposal[] = [
      // Safe proposal: CA 120 -> 128, PA 140
      {
        playerId: "player_safe_1",
        name: "Safe Scorer",
        firstName: "Safe",
        lastName: "Scorer",
        clubId: "club_1",
        clubName: "Club One",
        competitionId: "se_handbollsligan_herr",
        position: "V9",
        age: 24,
        currentCA: 120,
        currentPA: 140,
        proposedCA: 128,
        proposedPA: 140,
        caDelta: 8,
        paDelta: 0,
        decision: "PROPOSE",
        confidence: "HIGH",
        reviewFlags: ["DOCUMENTED_CROSS_LEAGUE_MOVER"],
        rationale: "Solid production in tier 2.",
        provenance: "DOCUMENTED_PERFORMANCE_EVIDENCE",
      },
      // Conflicting proposal: CA 145 -> 150, PA 145 (CA exceeds PA by 5)
      {
        playerId: "player_conflict_1",
        name: "Conflicted Star",
        firstName: "Conflicted",
        lastName: "Star",
        clubId: "club_2",
        clubName: "Club Two",
        competitionId: "se_handbollsligan_herr",
        position: "H9",
        age: 28,
        currentCA: 145,
        currentPA: 145,
        proposedCA: 150,
        proposedPA: 145,
        caDelta: 5,
        paDelta: 0,
        decision: "PROPOSE",
        confidence: "HIGH",
        reviewFlags: ["CA_EXCEEDS_PA_CONFLICT"],
        rationale: "Offensive production warrants CA 150. PA decoupled.",
        provenance: "DOCUMENTED_PERFORMANCE_EVIDENCE",
        isCaPaConflict: true,
        conflictMagnitude: 5,
      },
      // Large delta proposal: CA 100 -> 120 (delta 20 > 15 max)
      {
        playerId: "player_large_delta",
        name: "Rocket Mover",
        firstName: "Rocket",
        lastName: "Mover",
        clubId: "club_3",
        clubName: "Club Three",
        competitionId: "swe-2",
        position: "M9",
        age: 21,
        currentCA: 100,
        currentPA: 150,
        proposedCA: 120,
        proposedPA: 150,
        caDelta: 20,
        paDelta: 0,
        decision: "PROPOSE",
        confidence: "HIGH",
        reviewFlags: ["ALLSVENSKAN_HIGH_VOLUME_SCORER"],
        rationale: "Massive goal haul.",
        provenance: "DOCUMENTED_PERFORMANCE_EVIDENCE",
      },
    ];

    const staged = generateStagedImportDiffs(mockProposals, "2026-11-06T00:00:00Z");
    assert.equal(staged.totalProposalsEvaluated, 3);
    assert.equal(staged.autoApprovedCount, 1);
    assert.equal(staged.blockedConflictCount, 2);
    assert.equal(staged.rejectedCount, 0);

    const safeDiff = staged.stagedDiffs.find((d) => d.playerId === "player_safe_1")!;
    assert.equal(safeDiff.approvalStatus, "STAGED_AUTO_APPROVED");
    assert.equal(safeDiff.requiresHumanApproval, false);

    const conflictDiff = staged.stagedDiffs.find((d) => d.playerId === "player_conflict_1")!;
    assert.equal(conflictDiff.approvalStatus, "BLOCKED_PENDING_HUMAN_REVIEW");
    assert.equal(conflictDiff.requiresHumanApproval, true);
    assert.equal(conflictDiff.isConflict, true);
    assert.equal(conflictDiff.conflictMagnitude, 5);

    const largeDiff = staged.stagedDiffs.find((d) => d.playerId === "player_large_delta")!;
    assert.equal(largeDiff.approvalStatus, "BLOCKED_PENDING_HUMAN_REVIEW");
    assert.equal(largeDiff.requiresHumanApproval, true);

    // CSV formatting test
    const csv = formatDiffsAsCsv(staged.stagedDiffs);
    assert.ok(csv.includes("player_safe_1"));
    assert.ok(csv.includes("STAGED_AUTO_APPROVED"));
    assert.ok(csv.includes("BLOCKED_PENDING_HUMAN_REVIEW"));
  });

  it("creates pre-import rating catalog snapshots and validates rollback integrity", () => {
    const snapshot = createCatalogSnapshot("TEST_SNAPSHOT");
    assert.ok(snapshot.snapshotId.startsWith("snapshot-"));
    assert.ok(Object.keys(snapshot.ratings).length > 1000);

    // Snapshot integrity check
    const check = verifyRollbackIntegrity(snapshot, snapshot);
    assert.equal(check.isIdempotent, true);
    assert.equal(check.mismatchCount, 0);

    // Test reverse diff computation
    const reverseDiffs = computeRollbackDiffs(snapshot);
    const sampleId = Object.keys(snapshot.ratings)[0];
    assert.equal(reverseDiffs[sampleId].restoreCA, snapshot.ratings[sampleId].ca);
    assert.equal(reverseDiffs[sampleId].restorePA, snapshot.ratings[sampleId].pa);
  });

  it("guarantees complete isolation of active career saves from catalog updates", () => {
    const guarantee = getSaveProtectionGuarantee();
    assert.equal(guarantee.saveIsolationGuaranteed, true);
    assert.equal(guarantee.catalogMutationImpact, "NEW_CAREERS_ONLY");

    const mockSaveState = {
      playerId: "player_test_career",
      currentAbility: 135,
      potentialAbility: 155,
    };
    const mockCatalog = {
      playerId: "player_test_career",
      ca: 135,
      pa: 155,
    };

    const verification = verifySaveStateIsolation(mockSaveState, mockCatalog);
    assert.equal(verification.isIsolated, true);
  });
});
