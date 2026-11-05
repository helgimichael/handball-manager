import type {
  CalibrationBatchResult,
  CalibrationBatchSummary,
  CalibrationProposal,
  ConfidenceLevel,
  OfflinePlayerContext,
} from "./types";
import { evaluatePlayerRules } from "./rules";
import { verifyRegressionFixtures } from "./fixtures";

/**
 * Evaluates a single player context and strictly enforces decoupled rating invariants.
 */
export function evaluatePlayer(context: OfflinePlayerContext): CalibrationProposal {
  const proposal = evaluatePlayerRules(context);

  // Invariant Guard 1: Numerical clamping [1, 200]
  proposal.proposedCA = Math.max(1, Math.min(200, Math.round(proposal.proposedCA)));
  proposal.proposedPA = Math.max(1, Math.min(200, Math.round(proposal.proposedPA)));

  // Invariant Guard 2: CA/PA Decoupling & Conflict Detection
  // Milestone 4: CA changes must not automatically increase PA.
  // If proposed CA exceeds current PA, explicitly flag the conflict rather than silently inflating PA.
  if (proposal.proposedCA > proposal.currentPA) {
    proposal.isCaPaConflict = true;
    proposal.conflictMagnitude = proposal.proposedCA - proposal.currentPA;
    if (!proposal.reviewFlags.includes("CA_EXCEEDS_PA_CONFLICT")) {
      proposal.reviewFlags.push("CA_EXCEEDS_PA_CONFLICT");
    }
  }

  // Recalculate deltas
  proposal.caDelta = proposal.proposedCA - proposal.currentCA;
  proposal.paDelta = proposal.proposedPA - proposal.currentPA;

  return proposal;
}

/**
 * Runs the offline calibration engine across a batch of players.
 */
export function runOfflineCalibration(players: OfflinePlayerContext[]): CalibrationBatchResult {
  const proposals: CalibrationProposal[] = [];
  const proposalsMap = new Map<string, CalibrationProposal>();

  let keepCount = 0;
  let proposeCount = 0;
  let provisionalCount = 0;
  let reviewRequiredCount = 0;
  let totalCADelta = 0;
  let totalPADelta = 0;
  let maxCADelta = 0;
  let maxPADelta = 0;
  let caIncreasesCount = 0;
  let caDecreasesCount = 0;
  let paIndependentChangesCount = 0;
  let caPaConflictsCount = 0;
  let mathematicalInvariantViolations = 0;

  const byCompetition: CalibrationBatchSummary["byCompetition"] = {};
  const byPosition: CalibrationBatchSummary["byPosition"] = {};
  const byConfidence: Record<ConfidenceLevel, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    PROVISIONAL: 0,
  };

  for (const player of players) {
    const proposal = evaluatePlayer(player);
    proposals.push(proposal);
    proposalsMap.set(proposal.playerId, proposal);

    // Track decision counts
    switch (proposal.decision) {
      case "KEEP":
        keepCount++;
        break;
      case "PROPOSE":
        proposeCount++;
        break;
      case "PROVISIONAL":
        provisionalCount++;
        break;
      case "REVIEW_REQUIRED":
        reviewRequiredCount++;
        break;
    }

    // Track confidence
    byConfidence[proposal.confidence] = (byConfidence[proposal.confidence] || 0) + 1;

    // Track deltas and directions
    totalCADelta += Math.abs(proposal.caDelta);
    totalPADelta += Math.abs(proposal.paDelta);
    if (Math.abs(proposal.caDelta) > maxCADelta) maxCADelta = Math.abs(proposal.caDelta);
    if (Math.abs(proposal.paDelta) > maxPADelta) maxPADelta = Math.abs(proposal.paDelta);

    if (proposal.decision === "PROPOSE") {
      if (proposal.caDelta > 0) caIncreasesCount++;
      else if (proposal.caDelta < 0) caDecreasesCount++;

      if (proposal.paDelta !== 0) {
        paIndependentChangesCount++;
      }
    }

    // Track decoupled CA/PA conflicts
    if (proposal.isCaPaConflict || proposal.reviewFlags.includes("CA_EXCEEDS_PA_CONFLICT")) {
      caPaConflictsCount++;
    }

    // Track unflagged invariant violations (bugs/unhandled leaks)
    if (
      proposal.proposedCA > proposal.proposedPA &&
      !proposal.isCaPaConflict &&
      !proposal.reviewFlags.includes("CA_EXCEEDS_PA_CONFLICT")
    ) {
      mathematicalInvariantViolations++;
    }

    // Breakdown by competition
    const comp = proposal.competitionId || "unknown";
    if (!byCompetition[comp]) {
      byCompetition[comp] = { total: 0, keep: 0, propose: 0, provisional: 0, reviewRequired: 0 };
    }
    byCompetition[comp].total++;
    if (proposal.decision === "KEEP") byCompetition[comp].keep++;
    if (proposal.decision === "PROPOSE") byCompetition[comp].propose++;
    if (proposal.decision === "PROVISIONAL") byCompetition[comp].provisional++;
    if (proposal.decision === "REVIEW_REQUIRED") byCompetition[comp].reviewRequired++;

    // Breakdown by position
    const pos = proposal.position || "unknown";
    if (!byPosition[pos]) {
      byPosition[pos] = { total: 0, keep: 0, propose: 0, provisional: 0, reviewRequired: 0 };
    }
    byPosition[pos].total++;
    if (proposal.decision === "KEEP") byPosition[pos].keep++;
    if (proposal.decision === "PROPOSE") byPosition[pos].propose++;
    if (proposal.decision === "PROVISIONAL") byPosition[pos].provisional++;
    if (proposal.decision === "REVIEW_REQUIRED") byPosition[pos].reviewRequired++;
  }

  const regressionCheck = verifyRegressionFixtures(proposalsMap);

  const summary: CalibrationBatchSummary = {
    totalPlayers: players.length,
    keepCount,
    proposeCount,
    provisionalCount,
    reviewRequiredCount,
    averageCADelta: Number((totalCADelta / (players.length || 1)).toFixed(2)),
    averagePADelta: Number((totalPADelta / (players.length || 1)).toFixed(2)),
    maxCADelta,
    maxPADelta,
    caIncreasesCount,
    caDecreasesCount,
    paIndependentChangesCount,
    caPaConflictsCount,
    mathematicalInvariantViolations,
    byCompetition,
    byPosition,
    byConfidence,
  };

  return {
    proposals,
    summary,
    regressionCheck,
  };
}
