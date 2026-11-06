import fs from "node:fs";
import path from "node:path";
import type { CalibrationImportDiff } from "./types";
import { buildCatalog, findClubById } from "../../editor/catalog";
import { loadRealWorldClubSquad } from "../../gameWorld/realWorldLoader";
import {
  loadRatingDatabase,
  lockPlayerRating,
  type LockedPlayerRating,
} from "../../editor/ratingDatabaseRepository";
import { setRatingOverride } from "../../editor/ratingOverrideRepository";
import { setReviewStatus, loadRatingReviewState } from "../../editor/ratingReviewRepository";
import { proposePlayerRating } from "../pipeline/proposalEngine";
import { applyCAEstimation } from "../caEstimation/applyCAEstimation";
import { applyGamePrior } from "../gamePrior/applyGamePrior";
import { generatePlayerRatingProfile } from "../generation/generationEngine";
import { GENERATION_MODEL_VERSION } from "../generation/types";
import { GAME_PRIOR_MODEL_VERSION } from "../gamePrior/types";
import { snapshotGameplayRatingsForClub } from "../../gameWorld/gameplayRatingSnapshot";

export interface ImportExecutionReport {
  appliedCount: number;
  appliedPlayerIds: string[];
  blockedCount: number;
  blockedPlayerIds: string[];
  errors: string[];
  timestamp: string;
}

/**
 * Executes a controlled, validated rating import for a pre-screened list of eligible diffs.
 * Strictly guarantees:
 * 1. Only CA is updated; PA remains strictly unchanged.
 * 2. Proposed CA <= Current PA.
 * 3. Provenance and previous locked notes are preserved.
 * 4. Club overrides and review files are kept in sync.
 */
export function executeControlledImport(
  eligibleDiffs: CalibrationImportDiff[],
  executionTimestamp = new Date().toISOString()
): ImportExecutionReport {
  const appliedPlayerIds: string[] = [];
  const errors: string[] = [];

  for (const diff of eligibleDiffs) {
    // Safety assertions
    if (diff.caDelta <= 0) {
      errors.push(`Player ${diff.playerId} (${diff.name}) has non-positive CA delta (${diff.caDelta}); rejected.`);
      continue;
    }
    if (diff.afterCA > diff.beforePA) {
      errors.push(
        `Safety invariant violated: player ${diff.playerId} proposed CA (${diff.afterCA}) exceeds PA (${diff.beforePA}); rejected.`
      );
      continue;
    }
    if (diff.afterPA !== diff.beforePA) {
      errors.push(
        `PA modification detected for ${diff.playerId}: beforePA ${diff.beforePA} !== afterPA ${diff.afterPA}; rejected.`
      );
      continue;
    }

    const clubId = diff.clubId;
    const playerId = diff.playerId;

    const currentLocked = loadRatingDatabase(clubId);
    const existing = currentLocked[playerId];
    const squad = loadRealWorldClubSquad(clubId);

    if (!squad) {
      errors.push(`Could not load real-world squad for club "${clubId}".`);
      continue;
    }

    const squadPlayer = squad.players.find((p) => p.playerId === playerId);
    if (!squadPlayer) {
      errors.push(`Player "${playerId}" not found on active squad of club "${clubId}".`);
      continue;
    }

    const oldCA = existing ? existing.ca.value : diff.beforeCA;
    const oldPA = existing ? (existing.pa?.value ?? existing.ca.value) : diff.beforePA;
    const oldNote = existing?.lockedNote || "None";

    const note = `HM-MILESTONE-6 (${executionTimestamp.slice(0, 10)}): calibrated CA ${oldCA}->${diff.afterCA}, PA ${oldPA}->${diff.afterPA} (unchanged). Previous note: ${oldNote}. Rationale: ${diff.rationale}`;

    // Build PlayerRatingProfile for deterministic generation of attributes
    let profile: any;
    if (squadPlayer) {
      const { profile: proposed, matchedCalibration } = proposePlayerRating(squadPlayer);
      const { profile: estimated } = applyCAEstimation(proposed, squadPlayer.fullName, matchedCalibration);
      const { profile: final } = applyGamePrior(
        estimated,
        clubId,
        GAME_PRIOR_MODEL_VERSION,
        squadPlayer.worldPoolMetadata
      );
      profile = final;
    } else {
      profile = {
        playerId,
        position: diff.position,
        attackRoleProficiencies: existing?.attackRoleProficiencies || [],
        defenceRoleProficiencies: existing?.defenceRoleProficiencies || [],
        outcourtAttributes: existing?.branch.branch === "OUTCOURT" ? existing.branch.attributes : {},
        goalkeeperAttributes: existing?.branch.branch === "GOALKEEPER" ? existing.branch.attributes : {},
      };
    }

    // Set CA to calibrated value, keep PA strictly unchanged
    profile.ca = {
      value: diff.afterCA,
      confidence: "HIGH" as const,
      plausibleRange: { min: diff.afterCA, max: diff.afterCA },
      source: "EDITOR_OVERRIDE" as const,
    };
    profile.pa = {
      value: diff.beforePA,
      confidence: (existing?.pa?.confidence as any) ?? ("HIGH" as const),
      plausibleRange: existing?.pa?.plausibleRange ?? { min: diff.beforePA, max: diff.beforePA },
      source: "EDITOR_OVERRIDE" as const,
    };

    const generation = generatePlayerRatingProfile(profile);
    const branch = generation.status === "OK" ? generation.profile.branch : (existing?.branch as any);

    const normPos = diff.position === "MV" ? "GK" : diff.position;

    const updatedRecord: LockedPlayerRating = {
      playerId,
      clubId,
      position: normPos as any,
      ca: {
        value: diff.afterCA,
        confidence: "HIGH" as const,
        plausibleRange: { min: diff.afterCA, max: diff.afterCA },
        source: "EDITOR_OVERRIDE",
      },
      pa: {
        value: diff.beforePA,
        confidence: (existing?.pa?.confidence as any) ?? "HIGH",
        plausibleRange: existing?.pa?.plausibleRange ?? { min: diff.beforePA, max: diff.beforePA },
        source: "EDITOR_OVERRIDE",
      },
      branch,
      attackRoleProficiencies: profile.attackRoleProficiencies || [],
      defenceRoleProficiencies: profile.defenceRoleProficiencies || [],
      caEstimationModelVersion: existing?.caEstimationModelVersion || null,
      attributeGenerationModelVersion: GENERATION_MODEL_VERSION,
      lockedAt: executionTimestamp,
      lockedNote: note,
    };

    const lockResult = lockPlayerRating(clubId, updatedRecord);
    if (!lockResult.ok) {
      errors.push(`Failed to lock rating for ${diff.name} (${playerId}): ${lockResult.errors.join(", ")}`);
      continue;
    }

    setRatingOverride({
      clubId,
      playerId,
      position: normPos as any,
      ca: diff.afterCA,
      pa: diff.beforePA,
    });

    // Preserve previous review status provenance note
    const currentReview = loadRatingReviewState(clubId);
    const oldReviewNote = currentReview[playerId]?.note;
    const reviewNote = oldReviewNote
      ? `${oldReviewNote} | HM-MILESTONE-6: calibrated CA ${oldCA}->${diff.afterCA}, PA ${oldPA}->${diff.afterPA}. ${diff.rationale}`
      : `HM-MILESTONE-6: calibrated CA ${oldCA}->${diff.afterCA}, PA ${oldPA}->${diff.afterPA}. ${diff.rationale}`;

    setReviewStatus(clubId, playerId, "LOCKED", reviewNote);

    appliedPlayerIds.push(playerId);
  }

  return {
    appliedCount: appliedPlayerIds.length,
    appliedPlayerIds,
    blockedCount: errors.length,
    blockedPlayerIds: [],
    errors,
    timestamp: executionTimestamp,
  };
}

/**
 * Validates post-import integrity:
 * 1. Exactly the expected players changed.
 * 2. Only CA changed, PA is identical to baseline.
 * 3. Invariant CA <= PA holds for all players.
 * 4. All other players in the catalog remain completely untouched.
 */
export function verifyImportIntegrity(
  appliedDiffs: CalibrationImportDiff[],
  preImportSnapshotRatings: Record<string, { ca: number; pa: number; clubId: string }>
): {
  isIntegrityValid: boolean;
  mismatches: string[];
  appliedVerifications: Array<{
    playerId: string;
    name: string;
    beforeCA: number;
    afterCA: number;
    currentCA: number;
    beforePA: number;
    afterPA: number;
    currentPA: number;
    valid: boolean;
  }>;
} {
  const mismatches: string[] = [];
  const appliedSet = new Set(appliedDiffs.map((d) => d.playerId));
  const appliedVerifications: any[] = [];

  // Check applied players
  for (const diff of appliedDiffs) {
    const snap = snapshotGameplayRatingsForClub(diff.clubId);
    const p = snap.players.find((x) => x.playerId === diff.playerId);

    if (!p) {
      mismatches.push(`Applied player ${diff.playerId} (${diff.name}) not found in club snapshot.`);
      continue;
    }

    const caValid = p.ca === diff.afterCA;
    const paValid = p.pa === diff.beforePA;
    const invariantValid = p.ca <= p.pa;

    if (!caValid) {
      mismatches.push(`CA mismatch for ${diff.name}: expected ${diff.afterCA}, got ${p.ca}.`);
    }
    if (!paValid) {
      mismatches.push(`PA drift for ${diff.name}: expected ${diff.beforePA}, got ${p.pa}.`);
    }
    if (!invariantValid) {
      mismatches.push(`Invariant CA <= PA violated for ${diff.name}: CA ${p.ca} > PA ${p.pa}.`);
    }

    appliedVerifications.push({
      playerId: diff.playerId,
      name: diff.name,
      beforeCA: diff.beforeCA,
      afterCA: diff.afterCA,
      currentCA: p.ca,
      beforePA: diff.beforePA,
      afterPA: diff.afterPA,
      currentPA: p.pa,
      valid: caValid && paValid && invariantValid,
    });
  }

  // Check that NO player outside appliedSet changed
  for (const [playerId, pre] of Object.entries(preImportSnapshotRatings)) {
    if (appliedSet.has(playerId)) continue;
    const snap = snapshotGameplayRatingsForClub(pre.clubId);
    const p = snap.players.find((x) => x.playerId === playerId);
    if (p) {
      if (p.ca !== pre.ca) {
        mismatches.push(
          `Unintended CA mutation for unselected player ${playerId}: was ${pre.ca}, now ${p.ca}.`
        );
      }
      if (p.pa !== pre.pa) {
        mismatches.push(
          `Unintended PA mutation for unselected player ${playerId}: was ${pre.pa}, now ${p.pa}.`
        );
      }
    }
  }

  return {
    isIntegrityValid: mismatches.length === 0,
    mismatches,
    appliedVerifications,
  };
}
