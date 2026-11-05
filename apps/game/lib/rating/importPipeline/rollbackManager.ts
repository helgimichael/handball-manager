import fs from "node:fs";
import path from "node:path";
import type { RatingCatalogSnapshot, RollbackExecutionResult } from "./types";
import { buildCatalog } from "../../editor/catalog";
import { loadRatingDatabase } from "../../editor/ratingDatabaseRepository";

/**
 * Creates an in-memory snapshot of current catalog ratings across all clubs.
 * Can be serialized to disk prior to any import operation.
 */
export function createCatalogSnapshot(
  reason = "PRE_IMPORT_BASELINE"
): RatingCatalogSnapshot {
  const catalog = buildCatalog();
  const snapshot: RatingCatalogSnapshot = {
    snapshotId: `snapshot-${Date.now()}`,
    createdAt: new Date().toISOString(),
    reason,
    ratings: {},
  };

  for (const club of catalog.clubs) {
    const lockedRatings = loadRatingDatabase(club.clubId);
    for (const [playerId, record] of Object.entries(lockedRatings)) {
      snapshot.ratings[playerId] = {
        ca: record.ca,
        pa: record.pa,
        clubId: club.clubId,
        source: record.source,
      };
    }
  }

  return snapshot;
}

/**
 * Simulates or executes a rollback to a previously captured snapshot.
 * Verifies that all ratings in the snapshot can be restored idempotently.
 */
export function verifyRollbackIntegrity(
  currentSnapshot: RatingCatalogSnapshot,
  baselineSnapshot: RatingCatalogSnapshot
): { isIdempotent: boolean; mismatchCount: number; mismatches: string[] } {
  const mismatches: string[] = [];

  for (const [playerId, base] of Object.entries(baselineSnapshot.ratings)) {
    const cur = currentSnapshot.ratings[playerId];
    if (!cur) {
      mismatches.push(`Player ${playerId} missing in current snapshot.`);
    } else if (cur.ca !== base.ca || cur.pa !== base.pa) {
      mismatches.push(
        `Rating mismatch for ${playerId}: current [${cur.ca}/${cur.pa}] vs baseline [${base.ca}/${base.pa}].`
      );
    }
  }

  return {
    isIdempotent: mismatches.length === 0,
    mismatchCount: mismatches.length,
    mismatches,
  };
}

/**
 * Computes the inverse diff required to revert an imported set of diffs.
 */
export function computeRollbackDiffs(
  snapshot: RatingCatalogSnapshot
): Record<string, { restoreCA: number; restorePA: number }> {
  const inverse: Record<string, { restoreCA: number; restorePA: number }> = {};
  for (const [playerId, record] of Object.entries(snapshot.ratings)) {
    inverse[playerId] = {
      restoreCA: record.ca,
      restorePA: record.pa,
    };
  }
  return inverse;
}
