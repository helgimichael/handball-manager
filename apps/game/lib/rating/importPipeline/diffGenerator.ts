import type { CalibrationProposal } from "../offlineEngine/types";
import type { CalibrationImportDiff, StagedImportSummary } from "./types";

/**
 * Maximum CA delta allowed for automated batch staging without explicit human confirmation.
 */
export const MAX_AUTO_APPROVE_CA_DELTA = 15;

/**
 * Generates audit-ready staged import diffs from calibration proposals.
 * Segregates proposals requiring human approval (e.g. CA > PA conflicts or large deltas)
 * from safe auto-approvable candidates.
 */
export function generateStagedImportDiffs(
  proposals: CalibrationProposal[],
  stagedAt = new Date().toISOString()
): StagedImportSummary {
  const proposedOnly = proposals.filter((p) => p.decision === "PROPOSE");
  const stagedDiffs: CalibrationImportDiff[] = [];

  let autoApprovedCount = 0;
  let blockedConflictCount = 0;
  let rejectedCount = 0;
  let totalDeltaSum = 0;
  let maxCADelta = 0;

  for (const p of proposedOnly) {
    const isConflict = !!p.isCaPaConflict || p.proposedCA > p.currentPA;
    const absCADelta = Math.abs(p.caDelta);
    if (absCADelta > maxCADelta) maxCADelta = absCADelta;
    totalDeltaSum += p.caDelta;

    // Hard boundary verification: ratings must be within [1, 200]
    if (p.proposedCA < 1 || p.proposedCA > 200 || p.proposedPA < 1 || p.proposedPA > 200) {
      rejectedCount++;
      stagedDiffs.push({
        playerId: p.playerId,
        name: p.name,
        clubId: p.clubId,
        clubName: p.clubName,
        competitionId: p.competitionId,
        position: p.position,
        beforeCA: p.currentCA,
        afterCA: p.proposedCA,
        caDelta: p.caDelta,
        beforePA: p.currentPA,
        afterPA: p.proposedPA,
        paDelta: p.paDelta,
        isConflict,
        conflictMagnitude: p.conflictMagnitude,
        requiresHumanApproval: true,
        approvalStatus: "REJECTED",
        rejectionReason: `Proposed ratings [CA: ${p.proposedCA}, PA: ${p.proposedPA}] exceed canonical boundary [1, 200].`,
        provenance: p.provenance,
        comparisonPlayer: p.comparisonPlayer,
        rationale: p.rationale,
        stagedAt,
      });
      continue;
    }

    // Segregate conflicts or large jumps
    if (isConflict) {
      blockedConflictCount++;
      stagedDiffs.push({
        playerId: p.playerId,
        name: p.name,
        clubId: p.clubId,
        clubName: p.clubName,
        competitionId: p.competitionId,
        position: p.position,
        beforeCA: p.currentCA,
        afterCA: p.proposedCA,
        caDelta: p.caDelta,
        beforePA: p.currentPA,
        afterPA: p.proposedPA,
        paDelta: p.paDelta,
        isConflict: true,
        conflictMagnitude: p.conflictMagnitude ?? p.proposedCA - p.currentPA,
        requiresHumanApproval: true,
        approvalStatus: "BLOCKED_PENDING_HUMAN_REVIEW",
        rejectionReason: `Proposed CA (${p.proposedCA}) exceeds current PA (${p.currentPA}) by ${
          (p.conflictMagnitude ?? p.proposedCA - p.currentPA)
        } pts. PA decoupled; requires human decision to raise PA or cap CA.`,
        provenance: p.provenance,
        comparisonPlayer: p.comparisonPlayer,
        rationale: p.rationale,
        stagedAt,
      });
    } else if (absCADelta > MAX_AUTO_APPROVE_CA_DELTA) {
      blockedConflictCount++;
      stagedDiffs.push({
        playerId: p.playerId,
        name: p.name,
        clubId: p.clubId,
        clubName: p.clubName,
        competitionId: p.competitionId,
        position: p.position,
        beforeCA: p.currentCA,
        afterCA: p.proposedCA,
        caDelta: p.caDelta,
        beforePA: p.currentPA,
        afterPA: p.proposedPA,
        paDelta: p.paDelta,
        isConflict: false,
        requiresHumanApproval: true,
        approvalStatus: "BLOCKED_PENDING_HUMAN_REVIEW",
        rejectionReason: `CA delta of ${p.caDelta} exceeds maximum automated delta threshold (${MAX_AUTO_APPROVE_CA_DELTA}). Requires manual review.`,
        provenance: p.provenance,
        comparisonPlayer: p.comparisonPlayer,
        rationale: p.rationale,
        stagedAt,
      });
    } else {
      autoApprovedCount++;
      stagedDiffs.push({
        playerId: p.playerId,
        name: p.name,
        clubId: p.clubId,
        clubName: p.clubName,
        competitionId: p.competitionId,
        position: p.position,
        beforeCA: p.currentCA,
        afterCA: p.proposedCA,
        caDelta: p.caDelta,
        beforePA: p.currentPA,
        afterPA: p.proposedPA,
        paDelta: p.paDelta,
        isConflict: false,
        requiresHumanApproval: false,
        approvalStatus: "STAGED_AUTO_APPROVED",
        provenance: p.provenance,
        comparisonPlayer: p.comparisonPlayer,
        rationale: p.rationale,
        stagedAt,
      });
    }
  }

  const averageCADelta =
    proposedOnly.length > 0 ? Number((totalDeltaSum / proposedOnly.length).toFixed(2)) : 0;

  return {
    totalProposalsEvaluated: proposedOnly.length,
    autoApprovedCount,
    blockedConflictCount,
    rejectedCount,
    maxCADelta,
    averageCADelta,
    stagedDiffs,
  };
}

/**
 * Formats staged diffs into CSV text.
 */
export function formatDiffsAsCsv(diffs: CalibrationImportDiff[]): string {
  const headers = [
    "playerId",
    "name",
    "clubId",
    "clubName",
    "competitionId",
    "position",
    "beforeCA",
    "afterCA",
    "caDelta",
    "beforePA",
    "afterPA",
    "paDelta",
    "isConflict",
    "conflictMagnitude",
    "requiresHumanApproval",
    "approvalStatus",
    "rejectionReason",
    "comparisonPlayer",
    "provenance",
    "rationale",
    "stagedAt",
  ];

  const lines = [headers.join(",")];

  for (const d of diffs) {
    const row = [
      d.playerId,
      escapeCsv(d.name),
      d.clubId,
      escapeCsv(d.clubName),
      d.competitionId,
      d.position,
      d.beforeCA,
      d.afterCA,
      d.caDelta,
      d.beforePA,
      d.afterPA,
      d.paDelta,
      d.isConflict,
      d.conflictMagnitude ?? "",
      d.requiresHumanApproval,
      d.approvalStatus,
      escapeCsv(d.rejectionReason ?? ""),
      escapeCsv(d.comparisonPlayer ?? ""),
      d.provenance,
      escapeCsv(d.rationale),
      d.stagedAt,
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes(";")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
