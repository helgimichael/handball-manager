// HM-TRANSFERS-1.0: the ONE module that reads/writes CareerState for
// transfers/loans -- mirrors contractIntegration.ts's "pure math below
// (clubDecision.ts/playerDecision.ts/affordability.ts/transferExecution.ts),
// CareerState glue here" split. `submitTransferOffer` is the single
// manager-facing entry point (Part: "en enkel Transfer/Recruitment-
// workspace... göra bud"); `progressDailyTransfers` is the daily-tick
// hook for window-gated completions and loan returns.
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { deriveDefaultSquadStatusTier, updatePlayerSquadStatus, type SquadStatusTier } from "../career/squadStatus";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import { getClubFinancialHealth, adjustClubCash } from "../economy/clubEconomyIntegration";
import { isTransferWindowOpen, nextTransferWindowOpenDate } from "./transferWindow";
import { computeRequiredLoanWageSharePct, computeSellingClubAskingPriceEur, evaluateSellingClubDecision, evaluateLoanOutDecision, type SellingClubDecisionInputs } from "./clubDecision";
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
 *
 * HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0 performance fix: `state`
 * doesn't change within one caller's own loop (e.g. `rankCandidates`
 * evaluating many candidates against the SAME state), so a caller
 * checking many playerIds in a row may precompute
 * `activePendingTransferPlayerIds(state)` ONCE and pass it here instead
 * of this function rescanning the full, never-pruned `state.transferOffers`
 * map for every single playerId. Omitting `precomputed` is byte-identical
 * to before -- this must never become a second source of truth, only a
 * same-invocation memoization of the exact scan below.
 */
export function hasActivePendingTransfer(state: CareerState, playerId: string, precomputed?: ReadonlySet<string>): boolean {
  return (precomputed ?? activePendingTransferPlayerIds(state)).has(playerId);
}

/** The exact set of playerIds `hasActivePendingTransfer` would return `true` for right now -- the ONE place that scan is expressed, reused by both the default per-call path above and any caller precomputing it once for a loop. */
export function activePendingTransferPlayerIds(state: CareerState): Set<string> {
  const ids = new Set<string>();
  for (const offer of Object.values(state.transferOffers)) {
    if (offer.status === "AGREED_AWAITING_WINDOW") ids.add(offer.playerId);
  }
  return ids;
}

/** Roughly: does this club already have >=2 OTHER players at the same position with comparable ability? A simple, honest squad-depth proxy -- not a full tactical-fit judgement. */
function hasAdequateReplacement(state: CareerState, clubId: string, playerId: string, position: string, ca: number): boolean {
  const squad = state.worldSquads[clubId] ?? [];
  const ratingsById = new Map((state.gameplayRatings[clubId] ?? []).map((r) => [r.playerId, r.ca]));
  const targetCa = ratingsById.get(playerId) ?? ca;
  const peers = squad.filter((p) => p.id !== playerId && p.position === position && (ratingsById.get(p.id) ?? p.currentAbility) >= targetCa * 0.85);
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
  /** HM-ALPHA2-05A: negotiated PERMANENT deals only -- stored on the offer and applied to the manager's own squad status on arrival. */
  promisedSquadRole?: SquadStatusTier;
  /** HM-ALPHA2-05E: agent commission and signing bonus agreed in a negotiation -- charged to the buyer when the deal executes. */
  agentFeeEur?: number;
  signingBonusEur?: number;
}

/**
 * HM-ALPHA2-05A: an active loan means the contract's `clubId` points at
 * the BORROWING club while the PARENT club owns it -- the one place that
 * distinction is resolved for transfer purposes.
 */
export function getActiveLoanForPlayer(state: CareerState, playerId: string): LoanRecord | undefined {
  return Object.values(state.loans ?? {}).find((loan) => loan.active && loan.playerId === playerId);
}

/** The selling club's context for a permanent sale -- shared by the one-shot decision and the negotiation's asking price, so both always judge identically. */
function buildSellingClubContext(state: CareerState, playerId: string): Omit<SellingClubDecisionInputs, "offerTransferFeeEur"> | null {
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!player || !contract) return null;
  const health = getClubFinancialHealth(state, contract.clubId);
  return {
    marketValueEur: getPlayerMarketValueEur(state, playerId) ?? 0,
    contractStatus: getPlayerContractStatus(state, playerId) ?? "UNDER_CONTRACT",
    role: resolveMatchRoleForDecision(state, playerId),
    financialPressure: health?.pressure ?? "NONE",
    hasAdequateReplacement: hasAdequateReplacement(state, contract.clubId, playerId, player.position, player.currentAbility),
  };
}

/** HM-ALPHA2-05A: the selling club's minimum fee right now (undefined for an unknown player). */
export function getSellingClubAskingPriceEur(state: CareerState, playerId: string): number | undefined {
  const context = buildSellingClubContext(state, playerId);
  return context ? computeSellingClubAskingPriceEur(context) : undefined;
}

/** HM-ALPHA2-05C: the smallest wage share the OWNING club accepts for a loan right now (null: will not lend; undefined: unknown player). Same role/depth/finance inputs as the one-shot loan decision. */
export function getRequiredLoanWageSharePct(state: CareerState, playerId: string): number | null | undefined {
  const context = buildSellingClubContext(state, playerId);
  return context ? computeRequiredLoanWageSharePct({ role: context.role, financialPressure: context.financialPressure, hasAdequateReplacement: context.hasAdequateReplacement }) : undefined;
}

/** Applies a negotiated squad-role promise once the player has actually joined the manager's club. */
function applyPromisedSquadRole(state: CareerState, offer: Pick<TransferOffer, "playerId" | "toClubId" | "promisedSquadRole" | "dealType">): CareerState {
  if (!offer.promisedSquadRole || offer.toClubId !== state.playerClubId) return state;
  let next = updatePlayerSquadStatus(state, offer.playerId, offer.promisedSquadRole);
  // HM-ALPHA2-05E: a permanent signing's promise travels with his new contract (a loanee's contract belongs to the owner).
  const contract = next.playerContracts[offer.playerId];
  if (offer.dealType === "PERMANENT" && contract && contract.clubId === offer.toClubId) {
    next = { ...next, playerContracts: { ...next.playerContracts, [offer.playerId]: { ...contract, promisedSquadRole: offer.promisedSquadRole } } };
  }
  return next;
}

/** HM-ALPHA2-05E: what the buyer pays beyond fee and training compensation (agent commission + signing bonus). */
function signingCostsEur(source: { agentFeeEur?: number; signingBonusEur?: number }): number {
  return Math.max(0, source.agentFeeEur ?? 0) + Math.max(0, source.signingBonusEur ?? 0);
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
  return resolveTransferOffer(state, params);
}

/**
 * HM-ALPHA2-05A: `agreement` is set only by negotiationIntegration.ts once
 * BOTH the selling club and the player have accepted -- the club/player
 * decision steps are then skipped (they already happened, round by
 * round), while every guard (pending deal, loan, affordability) and the
 * whole execution path stay exactly the same.
 */
export function resolveTransferOffer(
  state: CareerState,
  params: SubmitTransferOfferParams,
  agreement?: { negotiationId: string; clubReason: string; playerReason: string },
): { state: CareerState; offer: TransferOffer } {
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
      ...(params.promisedSquadRole ? { promisedSquadRole: params.promisedSquadRole } : {}),
      ...(dealType === "PERMANENT" && params.agentFeeEur ? { agentFeeEur: params.agentFeeEur } : {}),
      ...(dealType === "PERMANENT" && params.signingBonusEur ? { signingBonusEur: params.signingBonusEur } : {}),
      ...(agreement ? { negotiationId: agreement.negotiationId } : {}),
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

  // HM-ALPHA2-05C: `fromClubId` above is the contract OWNER even during a
  // loan, so a permanent bid is always negotiated with (and paid to) the
  // owner. A player already on loan cannot be loaned a second time.
  const activeLoan = getActiveLoanForPlayer(state, playerId);
  if (activeLoan && dealType === "LOAN") {
    return finalize("BLOCKED_PENDING_TRANSFER", { clubDecisionReason: `Spelaren är redan utlånad till ${activeLoan.endDate}.` }, state);
  }

  if (dealType === "LOAN" && params.loanTerms && (params.loanTerms.endDate <= offeredDate || params.loanTerms.endDate > resolvedContract.contractEndDate)) {
    return finalize("REJECTED_BY_CLUB", { clubDecisionReason: `Lånet måste sluta efter dagens datum och senast när spelarens kontrakt löper ut (${resolvedContract.contractEndDate}).` }, state);
  }

  const extraSigningCostsEur = dealType === "PERMANENT" ? signingCostsEur(params) : 0;
  const affordability = assessTransferAffordability(state, toClubId, transferFeeEur, trainingCompensationEur + extraSigningCostsEur, params.newWageEurPerMonth, wageShareBorrowingPct);
  if (!affordability.affordable) {
    return finalize("BLOCKED_UNAFFORDABLE", { clubDecisionReason: affordability.reasons.join(" ") }, state);
  }

  if (!isFreeAgent && !agreement) {
    const role = resolveMatchRoleForDecision(state, playerId);
    const health = getClubFinancialHealth(state, fromClubId);
    const replacement = hasAdequateReplacement(state, fromClubId, playerId, player.position, player.currentAbility);

    if (dealType === "PERMANENT") {
      const decision = evaluateSellingClubDecision({ ...buildSellingClubContext(state, playerId)!, offerTransferFeeEur: transferFeeEur });
      if (!decision.accept) return finalize("REJECTED_BY_CLUB", { clubDecisionReason: decision.reason }, state);
    } else {
      const decision = evaluateLoanOutDecision({ role, financialPressure: health?.pressure ?? "NONE", hasAdequateReplacement: replacement, wageShareBorrowingPct });
      if (!decision.accept) return finalize("REJECTED_BY_CLUB", { clubDecisionReason: decision.reason }, state);
    }
  }

  const playerDecision = agreement ? { accept: true, reason: agreement.playerReason } : evaluatePlayerDecision({
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
    let next = loanPlayerOut(state, playerId, fromClubId, toClubId);
    if (next === state) return finalize("REJECTED_BY_CLUB", { clubDecisionReason: "Spelaren spelar inte för den klubb som äger kontraktet just nu och kan inte lånas ut." }, state);
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
    next = applyPromisedSquadRole(next, { playerId, toClubId, promisedSquadRole: params.promisedSquadRole, dealType });
    return finalize("COMPLETED", { playerDecisionReason: playerDecision.reason, ...(agreement ? { clubDecisionReason: agreement.clubReason } : {}) }, next);
  }

  // HM-ALPHA2-05C: a third club buying a player who is out on loan takes
  // him when the loan ends (first open window on or after the loan's end
  // date); the borrowing club buying him out ends the loan right away.
  if (activeLoan && toClubId !== activeLoan.borrowingClubId) {
    const completion = isTransferWindowOpen(activeLoan.endDate) ? activeLoan.endDate : nextTransferWindowOpenDate(activeLoan.endDate);
    return finalize("AGREED_AWAITING_WINDOW", { playerDecisionReason: `${playerDecision.reason} Övergången genomförs när lånet har gått ut.`, ...(agreement ? { clubDecisionReason: agreement.clubReason } : {}), scheduledCompletionDate: completion }, state);
  }

  if (isTransferWindowOpen(offeredDate)) {
    let next = transferPlayerPermanently(activeLoan ? endActiveLoan(state, activeLoan) : state, playerId, fromClubId, toClubId, params.newWageEurPerMonth, computeNewContractEndDate(playerId, offeredDate, params.contractYears ?? 3));
    next = payForSigning(next, toClubId, transferFeeEur, trainingCompensationEur, extraSigningCostsEur, playerId, offeredDate);
    if (!isFreeAgent) next = adjustClubCash(next, fromClubId, transferFeeEur, { category: "TRANSFER_FEES", label: transferLabel(next, playerId, "Försäljning"), date: offeredDate });
    next = creditTrainingCompensationClubs(next, trainingComp, offeredDate);
    next = applyPromisedSquadRole(next, { playerId, toClubId, promisedSquadRole: params.promisedSquadRole, dealType });
    return finalize("COMPLETED", { playerDecisionReason: playerDecision.reason, ...(agreement ? { clubDecisionReason: agreement.clubReason } : {}) }, next);
  }

  return finalize("AGREED_AWAITING_WINDOW", { playerDecisionReason: playerDecision.reason, ...(agreement ? { clubDecisionReason: agreement.clubReason } : {}), scheduledCompletionDate: nextTransferWindowOpenDate(offeredDate) }, state);
}

/** HM-ALPHA2-05C: ends a loan now -- the player returns to the owning club (same path as a natural expiry). */
function endActiveLoan(state: CareerState, loan: LoanRecord): CareerState {
  const returned = returnPlayerFromLoan(state, loan.playerId, loan.parentClubId, loan.borrowingClubId, loan.originalWageEurPerMonth);
  return { ...returned, loans: { ...returned.loans, [loan.id]: { ...loan, active: false } } };
}

/** Credits every trackable training-compensation recipient club's cash -- clubs outside this career's tracked economy are simply not credited (Part: avoid invented precision about untracked clubs' finances). */
function creditTrainingCompensationClubs(state: CareerState, trainingComp: ReturnType<typeof getPlayerTrainingCompensation>, date: string): CareerState {
  if (!trainingComp) return state;
  let next = state;
  for (const share of trainingComp.perClub) {
    next = adjustClubCash(next, share.clubId, share.amountEur, { category: "TRAINING_COMPENSATION", label: "Utbildningsersättning", date });
  }
  return next;
}

function transferLabel(state: CareerState, playerId: string, verb: string): string {
  const player = getCareerPlayer(state, playerId);
  return player ? `${verb}: ${player.firstName} ${player.lastName}` : verb;
}

/** HM-ALPHA3-M02: the buying club's payments, booked as separate ledger lines (fee, training compensation, agent fee and signing bonus). */
function payForSigning(state: CareerState, toClubId: string, feeEur: number, trainingCompensationEur: number, signingCostsEur: number, playerId: string, date: string): CareerState {
  let next = adjustClubCash(state, toClubId, -feeEur, { category: "TRANSFER_FEES", label: transferLabel(state, playerId, "Värvning"), date });
  next = adjustClubCash(next, toClubId, -trainingCompensationEur, { category: "TRAINING_COMPENSATION", label: "Utbildningsersättning", date });
  return adjustClubCash(next, toClubId, -signingCostsEur, { category: "SIGNING_COSTS", label: "Agentarvode och signeringsbonus", date });
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
    // HM-ALPHA2-05C: the owner sold a player who is (still) out on loan --
    // the loan ends now and he returns to the owner before moving on.
    const loanToEnd = getActiveLoanForPlayer(next, offer.playerId);
    if (loanToEnd && loanToEnd.parentClubId === offer.fromClubId) next = endActiveLoan(next, loanToEnd);

    const currentPlayer = getCareerPlayer(next, offer.playerId);
    if (!currentPlayer || currentPlayer.clubId !== offer.fromClubId) {
      next = { ...next, transferOffers: { ...next.transferOffers, [offer.id]: { ...offer, status: "CANCELLED_STALE", resolvedDate: date } } };
      continue;
    }

    let moved = transferPlayerPermanently(next, offer.playerId, offer.fromClubId, offer.toClubId, offer.newWageEurPerMonth, offer.newContractEndDate);
    moved = payForSigning(moved, offer.toClubId, offer.transferFeeEur, offer.trainingCompensationEur, signingCostsEur(offer), offer.playerId, date);
    moved = adjustClubCash(moved, offer.fromClubId, offer.transferFeeEur, { category: "TRANSFER_FEES", label: transferLabel(moved, offer.playerId, "Försäljning"), date });
    const player = getCareerPlayer(next, offer.playerId);
    const age = player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, date) : null;
    const trainingComp = age !== null ? getPlayerTrainingCompensation(moved, offer.playerId) : undefined;
    moved = creditTrainingCompensationClubs(moved, trainingComp, date);
    moved = applyPromisedSquadRole(moved, offer);
    next = { ...moved, transferOffers: { ...moved.transferOffers, [offer.id]: { ...offer, status: "COMPLETED", resolvedDate: date } } };
  }

  for (const loan of Object.values(next.loans)) {
    if (!loan.active) continue;
    if (!isSameOrBefore(loan.endDate, date)) continue;
    next = endActiveLoan(next, loan);
  }

  return next;
}

export function getTransferOffer(state: CareerState, offerId: string): TransferOffer | undefined {
  return state.transferOffers[offerId];
}

export function getActiveLoansForClub(state: CareerState, clubId: string): readonly LoanRecord[] {
  return Object.values(state.loans).filter((l) => l.active && (l.parentClubId === clubId || l.borrowingClubId === clubId));
}
