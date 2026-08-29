// HM-TRANSFERS-1.0: the ONE module that reads/writes CareerState for
// transfers/loans -- mirrors contractIntegration.ts's "pure math below
// (clubDecision.ts/playerDecision.ts/affordability.ts/transferExecution.ts),
// CareerState glue here" split. `submitTransferOffer` is the single
// manager-facing entry point (Part: "en enkel Transfer/Recruitment-
// workspace... göra bud"); `progressDailyTransfers` is the daily-tick
// hook for window-gated completions and loan returns.
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { deriveDefaultSquadStatusTier, type SquadStatusTier } from "../career/squadStatus";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import { getClubFinancialHealth, adjustClubCash } from "../economy/clubEconomyIntegration";
import { isTransferWindowOpen, nextTransferWindowOpenDate } from "./transferWindow";
import { evaluateSellingClubDecision, evaluateLoanOutDecision } from "./clubDecision";
import { evaluatePlayerDecision } from "./playerDecision";
import { assessTransferAffordability } from "./affordability";
import { computeNewContractEndDate, loanPlayerOut, returnPlayerFromLoan, transferPlayerPermanently, competitionTierForClub } from "./transferExecution";
import { isSameOrBefore } from "../career/dateUtils";
import type { MatchRole } from "../matchPlan/types";
import type { LoanRecord, LoanTerms, TransferDealType, TransferOffer } from "./types";

// HM-CPU-SQUAD-BUILDING-1.0B Part 11: `playerMatchDefaults` is a
// manager-only, opt-in MatchPlan concept -- CPU clubs (and most human
// squad players who were never explicitly assigned a match role) never
// have an entry there, so the OLD unconditional `?? "ROTATION"` fallback
// silently treated every CPU-owned player, including genuine
// KEY_PLAYERs, as low-resistance ROTATION-tier for the selling-club
// decision. That's the confirmed root cause behind the 1.0A audit's
// "REJECTED_BY_CLUB = 0" finding: the 1.4x KEY_PLAYER sale-resistance
// multiplier in clubDecision.ts was never actually reached for CPU
// squads. Falls back to the player's own SquadStatusTier (the same
// signal cpuContractDecisions.ts and AI MatchPlan generation already use
// for a club with no explicit match-role assignment) instead of a flat
// guess -- a real, already-canonical signal, never invented data.
const TIER_TO_MATCH_ROLE: Record<SquadStatusTier, MatchRole> = {
  KEY_PLAYER: "KEY_PLAYER",
  FIRST_CHOICE: "STARTER",
  ROTATION: "ROTATION",
  SQUAD_PLAYER: "SPECIALIST",
  TALENT: "DEVELOPMENT",
};

function resolveMatchRoleForDecision(state: CareerState, playerId: string): MatchRole {
  const explicit = state.playerMatchDefaults[playerId]?.matchRole;
  if (explicit) return explicit;
  const player = getCareerPlayer(state, playerId);
  return player ? TIER_TO_MATCH_ROLE[deriveDefaultSquadStatusTier(player)] : "ROTATION";
}

/**
 * HM-CPU-SQUAD-BUILDING-1.0B Part 1: "A player must never have more than
 * one unresolved/pending transfer outcome that can later execute."
 * AGREED_AWAITING_WINDOW is the ONE status in this synchronous-resolution
 * model that can still execute later (every other terminal status is
 * already fully resolved) -- exported so callers that rank/filter
 * candidates BEFORE submitting an offer (e.g. cpuCandidateEvaluation.ts)
 * can avoid wasting a pursuit on a player who would just get blocked
 * here anyway, without this guard itself living only in that one caller.
 */
export function hasActivePendingTransfer(state: CareerState, playerId: string): boolean {
  return Object.values(state.transferOffers).some((o) => o.playerId === playerId && o.status === "AGREED_AWAITING_WINDOW");
}

/** Roughly: does this club already have >=2 OTHER players at the same position with comparable ability? A simple, honest squad-depth proxy -- not a full tactical-fit judgement. */
function hasAdequateReplacement(state: CareerState, clubId: string, playerId: string, position: string, ca: number): boolean {
  const squad = state.worldSquads[clubId] ?? [];
  const peers = squad.filter((p) => p.id !== playerId && p.position === position && p.currentAbility >= ca * 0.85);
  return peers.length >= 2;
}

export interface SubmitTransferOfferParams {
  dealType: TransferDealType;
  playerId: string;
  toClubId: string;
  /** The manager's own bid -- PERMANENT only; ignored (treated as 0) for LOAN, since a loan has no fee in this v1 model. */
  transferFeeEur: number;
  newWageEurPerMonth: number;
  /** PERMANENT only -- length of the fresh contract offered, default 3 seasons. */
  contractYears?: number;
  /** LOAN only. */
  loanTerms?: Pick<LoanTerms, "endDate" | "wageShareBorrowingPct">;
}

function nextOfferId(state: CareerState, playerId: string, toClubId: string): string {
  return `transfer-${playerId}-${toClubId}-${state.gameDate}-${Object.keys(state.transferOffers).length}`;
}

/**
 * Resolves the WHOLE negotiation synchronously in one call (Part:
 * "Ingen modern AI-agent" -- no multi-day back-and-forth): affordability
 * -> selling/parent club decision (skipped for a free agent) -> player
 * decision -> completion (immediate, or window-gated for a PERMANENT
 * deal). Every terminal TransferOfferStatus is reachable and stored,
 * with a human-readable reason, so the UI can show exactly why an offer
 * failed.
 */
export function submitTransferOffer(state: CareerState, params: SubmitTransferOfferParams): { state: CareerState; offer: TransferOffer } {
  const { dealType, playerId, toClubId } = params;
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  const offerId = nextOfferId(state, playerId, toClubId);
  const offeredDate = state.gameDate;

  if (!player || !contract) {
    const offer: TransferOffer = {
      id: offerId,
      dealType,
      playerId,
      fromClubId: contract?.clubId ?? "",
      toClubId,
      transferFeeEur: 0,
      trainingCompensationEur: 0,
      newWageEurPerMonth: params.newWageEurPerMonth,
      newContractEndDate: offeredDate,
      status: "BLOCKED_UNAFFORDABLE",
      offeredDate,
      clubDecisionReason: "Spelaren kunde inte hittas.",
      resolvedDate: offeredDate,
    };
    return { state: { ...state, transferOffers: { ...state.transferOffers, [offerId]: offer } }, offer };
  }

  const resolvedContract = contract; // narrowed alias -- TS doesn't propagate the `!contract` guard's narrowing into the `finalize` closure below.
  const fromClubId = resolvedContract.clubId;
  const contractStatus = getPlayerContractStatus(state, playerId);
  const isFreeAgent = contractStatus === "FREE_AGENT";

  const trainingComp = getPlayerTrainingCompensation(state, playerId);
  const trainingCompensationEur = dealType === "PERMANENT" ? (trainingComp?.totalEur ?? 0) : 0;
  // HM-PLAYER-CONTRACT-LIFECYCLE-1.0 Part 6: "Transfer fee: 0" for a free
  // agent -- forced here (the one canonical execution path both the
  // Transfers page and Recruitment Centre submit through), not just left
  // to each UI form's own default, since a free agent is now actually
  // reachable/biddable and a stray nonzero fee would otherwise be
  // deducted from the buyer at execution (below) with no seller to
  // receive it.
  const transferFeeEur = dealType === "PERMANENT" && !isFreeAgent ? Math.max(0, params.transferFeeEur) : 0;
  const wageShareBorrowingPct = dealType === "LOAN" ? (params.loanTerms?.wageShareBorrowingPct ?? 100) : 100;

  function finalize(status: TransferOffer["status"], patch: Partial<TransferOffer>, nextState: CareerState): { state: CareerState; offer: TransferOffer } {
    const loanTerms = dealType === "LOAN" && params.loanTerms ? { startDate: offeredDate, endDate: params.loanTerms.endDate, wageShareBorrowingPct } : undefined;
    const offer: TransferOffer = {
      id: offerId,
      dealType,
      playerId,
      fromClubId,
      toClubId,
      transferFeeEur,
      trainingCompensationEur,
      newWageEurPerMonth: params.newWageEurPerMonth,
      newContractEndDate: dealType === "PERMANENT" ? computeNewContractEndDate(playerId, offeredDate, params.contractYears ?? 3) : resolvedContract.contractEndDate,
      // `loanTerms` is a genuinely OPTIONAL field (`?:` on TransferOffer) --
      // spread it in only when it exists, rather than assigning an
      // explicit `undefined`, so a PERMANENT offer's JSON serialization
      // (localStorage save/reload) round-trips byte-for-byte instead of
      // silently dropping an explicit-undefined key JSON.stringify omits.
      ...(loanTerms ? { loanTerms } : {}),
      status,
      offeredDate,
      resolvedDate: offeredDate,
      ...patch,
    };
    return { state: { ...nextState, transferOffers: { ...nextState.transferOffers, [offerId]: offer } }, offer };
  }

  if (hasActivePendingTransfer(state, playerId)) {
    return finalize("BLOCKED_PENDING_TRANSFER", { clubDecisionReason: "Spelaren har redan en pågående affär som väntar på att slutföras." }, state);
  }

  const affordability = assessTransferAffordability(state, toClubId, transferFeeEur, trainingCompensationEur, params.newWageEurPerMonth, wageShareBorrowingPct);
  if (!affordability.affordable) {
    return finalize("BLOCKED_UNAFFORDABLE", { clubDecisionReason: affordability.reasons.join(" ") }, state);
  }

  if (!isFreeAgent) {
    const role = resolveMatchRoleForDecision(state, playerId);
    const health = getClubFinancialHealth(state, fromClubId);
    const replacement = hasAdequateReplacement(state, fromClubId, playerId, player.position, player.currentAbility);

    if (dealType === "PERMANENT") {
      const marketValueEur = getPlayerMarketValueEur(state, playerId) ?? 0;
      const decision = evaluateSellingClubDecision({
        marketValueEur,
        offerTransferFeeEur: transferFeeEur,
        contractStatus: contractStatus ?? "UNDER_CONTRACT",
        role,
        financialPressure: health?.pressure ?? "NONE",
        hasAdequateReplacement: replacement,
      });
      if (!decision.accept) return finalize("REJECTED_BY_CLUB", { clubDecisionReason: decision.reason }, state);
    } else {
      const decision = evaluateLoanOutDecision({ role, financialPressure: health?.pressure ?? "NONE", hasAdequateReplacement: replacement, wageShareBorrowingPct });
      if (!decision.accept) return finalize("REJECTED_BY_CLUB", { clubDecisionReason: decision.reason }, state);
    }
  }

  const playerDecision = evaluatePlayerDecision({
    playerId,
    currentWageEurPerMonth: resolvedContract.wageEurPerMonth,
    offeredWageEurPerMonth: params.newWageEurPerMonth,
    currentClubTier: competitionTierForClub(fromClubId),
    newClubTier: competitionTierForClub(toClubId),
    currentSquadStatus: player.squadStatus,
    currentClubPressure: getClubFinancialHealth(state, fromClubId)?.pressure ?? "NONE",
  });
  if (!playerDecision.accept) return finalize("REJECTED_BY_PLAYER", { playerDecisionReason: playerDecision.reason }, state);

  // Agreed -- execute (loans always immediate; permanent deals are window-gated).
  if (dealType === "LOAN" && params.loanTerms) {
    let next = loanPlayerOut(state, playerId, fromClubId, toClubId, wageShareBorrowingPct);
    const loan: LoanRecord = {
      id: offerId,
      playerId,
      parentClubId: fromClubId,
      borrowingClubId: toClubId,
      startDate: offeredDate,
      endDate: params.loanTerms.endDate,
      wageShareBorrowingPct,
      originalWageEurPerMonth: resolvedContract.wageEurPerMonth,
      active: true,
    };
    next = { ...next, loans: { ...next.loans, [loan.id]: loan } };
    return finalize("COMPLETED", { playerDecisionReason: playerDecision.reason }, next);
  }

  if (isTransferWindowOpen(offeredDate)) {
    let next = transferPlayerPermanently(state, playerId, fromClubId, toClubId, params.newWageEurPerMonth, computeNewContractEndDate(playerId, offeredDate, params.contractYears ?? 3));
    next = adjustClubCash(next, toClubId, -(transferFeeEur + trainingCompensationEur));
    if (!isFreeAgent) next = adjustClubCash(next, fromClubId, transferFeeEur);
    next = creditTrainingCompensationClubs(next, trainingComp);
    return finalize("COMPLETED", { playerDecisionReason: playerDecision.reason }, next);
  }

  return finalize("AGREED_AWAITING_WINDOW", { playerDecisionReason: playerDecision.reason, scheduledCompletionDate: nextTransferWindowOpenDate(offeredDate) }, state);
}

/** Credits every trackable training-compensation recipient club's cash -- clubs outside this career's tracked economy are simply not credited (Part: avoid invented precision about untracked clubs' finances). */
function creditTrainingCompensationClubs(state: CareerState, trainingComp: ReturnType<typeof getPlayerTrainingCompensation>): CareerState {
  if (!trainingComp) return state;
  let next = state;
  for (const share of trainingComp.perClub) {
    next = adjustClubCash(next, share.clubId, share.amountEur);
  }
  return next;
}

/**
 * Daily-tick hook (Part: "det ska gå att skilja på deal agreed / transfer
 * completed"). Completes any AGREED_AWAITING_WINDOW offer whose window
 * has now opened, and returns any loan whose endDate has been reached --
 * mirrors dailyTick.ts's own player-availability-return idiom (iterate,
 * compare a stored date via isSameOrBefore, mutate once, never
 * reprocess an already-resolved entry).
 */
export function progressDailyTransfers(state: CareerState, date: string): CareerState {
  let next = state;

  for (const offer of Object.values(next.transferOffers)) {
    if (offer.status !== "AGREED_AWAITING_WINDOW" || !offer.scheduledCompletionDate) continue;
    if (!isSameOrBefore(offer.scheduledCompletionDate, date)) continue;
    const contract = getPlayerContract(next, offer.playerId);
    if (!contract) continue;

    // HM-CPU-SQUAD-BUILDING-1.0B Part 2: never trust the offer's own
    // stored `fromClubId` blindly -- verify the player still canonically
    // belongs there right now. The BLOCKED_PENDING_TRANSFER guard in
    // submitTransferOffer should make this rare going forward, but a
    // pre-1.0B save can still carry overlapping AGREED_AWAITING_WINDOW
    // offers from before the fix. A mismatch here means the player moved
    // via a different deal in the meantime -- never execute a stale
    // move; cancel this offer safely instead.
    const currentPlayer = getCareerPlayer(next, offer.playerId);
    if (!currentPlayer || currentPlayer.clubId !== offer.fromClubId) {
      next = { ...next, transferOffers: { ...next.transferOffers, [offer.id]: { ...offer, status: "CANCELLED_STALE", resolvedDate: date } } };
      continue;
    }

    let moved = transferPlayerPermanently(next, offer.playerId, offer.fromClubId, offer.toClubId, offer.newWageEurPerMonth, offer.newContractEndDate);
    moved = adjustClubCash(moved, offer.toClubId, -(offer.transferFeeEur + offer.trainingCompensationEur));
    moved = adjustClubCash(moved, offer.fromClubId, offer.transferFeeEur);
    const player = getCareerPlayer(next, offer.playerId);
    const age = player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, date) : null;
    const trainingComp = age !== null ? getPlayerTrainingCompensation(moved, offer.playerId) : undefined;
    moved = creditTrainingCompensationClubs(moved, trainingComp);
    next = { ...moved, transferOffers: { ...moved.transferOffers, [offer.id]: { ...offer, status: "COMPLETED", resolvedDate: date } } };
  }

  for (const loan of Object.values(next.loans)) {
    if (!loan.active) continue;
    if (!isSameOrBefore(loan.endDate, date)) continue;
    const returned = returnPlayerFromLoan(next, loan.playerId, loan.parentClubId, loan.borrowingClubId, loan.originalWageEurPerMonth, getPlayerContract(next, loan.playerId)?.contractEndDate ?? date);
    next = { ...returned, loans: { ...returned.loans, [loan.id]: { ...loan, active: false } } };
  }

  return next;
}

export function getTransferOffer(state: CareerState, offerId: string): TransferOffer | undefined {
  return state.transferOffers[offerId];
}

export function getActiveLoansForClub(state: CareerState, clubId: string): readonly LoanRecord[] {
  return Object.values(state.loans).filter((l) => l.active && (l.parentClubId === clubId || l.borrowingClubId === clubId));
}
