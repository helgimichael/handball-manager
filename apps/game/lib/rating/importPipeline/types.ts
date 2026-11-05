import type { CalibrationProposal } from "../offlineEngine/types";

/**
 * An individual staged rating change ready for audit, review, or controlled application.
 */
export interface CalibrationImportDiff {
  playerId: string;
  name: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  position: string;
  beforeCA: number;
  afterCA: number;
  caDelta: number;
  beforePA: number;
  afterPA: number;
  paDelta: number;
  isConflict: boolean;
  conflictMagnitude?: number;
  requiresHumanApproval: boolean;
  approvalStatus: "STAGED_AUTO_APPROVED" | "BLOCKED_PENDING_HUMAN_REVIEW" | "REJECTED";
  rejectionReason?: string;
  provenance: string;
  comparisonPlayer?: string;
  rationale: string;
  stagedAt: string;
}

/**
 * Summary of a staged import batch before application.
 */
export interface StagedImportSummary {
  totalProposalsEvaluated: number;
  autoApprovedCount: number;
  blockedConflictCount: number;
  rejectedCount: number;
  maxCADelta: number;
  averageCADelta: number;
  stagedDiffs: CalibrationImportDiff[];
}

/**
 * Pre-import rating backup snapshot for byte-for-byte rollback.
 */
export interface RatingCatalogSnapshot {
  snapshotId: string;
  createdAt: string;
  reason: string;
  ratings: Record<string, {
    ca: number;
    pa: number;
    clubId: string;
    source: string;
  }>;
}

/**
 * Result of executing a rollback operation.
 */
export interface RollbackExecutionResult {
  success: boolean;
  restoredPlayerCount: number;
  snapshotId: string;
  timestamp: string;
  errors: string[];
}
