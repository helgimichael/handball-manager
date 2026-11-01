// HM-ALPHA2-05A: CareerState glue for the two-stage negotiation -- the
// pure rules live in negotiation.ts, execution reuses
// transferIntegration.ts's own resolveTransferOffer (same guards, same
// window gating, same cash/contract/squad moves). Only the manager's
// PERMANENT signings go through here; CPU recruitment and loans keep
// the existing one-shot submitTransferOffer.
//
// HM-ALPHA2-05B: negotiations now run across career days. A manager
// action only records a PENDING offer with a response date; the daily
// tick (progressTransferNegotiations) answers it, judged against the
// world AS IT IS THAT DAY -- including rival CPU clubs found with the
// existing recruitment logic (assessPositionNeed + rankCandidates),
// which may sign the player first. Every answer opens a deadline for
// the manager's next move; missing it EXPIRES the negotiation.
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { rankCandidates } from "../career/cpuCandidateEvaluation";
import { cpuRecruiterClubIds } from "../career/cpuRecruitment";
import { assessPositionNeed } from "../career/cpuSquadNeeds";
import { addDays, isAfter, isBefore, isSameOrBefore } from "../career/dateUtils";
import type { SquadStatusTier } from "../career/squadStatus";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getClubBudgets, getClubFinancialHealth } from "../economy/clubEconomyIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerFairWageEurPerMonth } from "../economy/contractIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import { getClub } from "../game-data";
import { assessTransferAffordability } from "./affordability";
import {
  MAX_RIVALS,
  NEGOTIATION_COOLDOWN_DAYS,
  RESPONSE_WINDOW_DAYS,
  computePlayerWageDemand,
  evaluateClubFeeRound,
  evaluateLoanPlayerRound,
  evaluateLoanShareRound,
  evaluatePlayerTermsRound,
  expectedRoleFromSquadRank,
  packageRatio,
  responseDelayDays,
  rivalDecisionDelayDays,
  type PlayerWageDemand,
} from "./negotiation";
import { competitionTierForClub } from "./transferExecution";
import { activePendingTransferPlayerIds, getActiveLoanForPlayer, getRequiredLoanWageSharePct, getSellingClubAskingPriceEur, hasActivePendingTransfer, resolveTransferOffer } from "./transferIntegration";
import type { NegotiationRound, RivalInterest, TransferDealType, TransferNegotiation, TransferOffer } from "./types";

export type NegotiationActionResult =
  | { ok: true; state: CareerState; negotiation: TransferNegotiation; offer?: TransferOffer }
  | { ok: false; error: string };

const OPEN_STAGES = new Set<TransferNegotiation["stage"]>(["CLUB", "PLAYER"]);

export function isNegotiationOpen(negotiation: TransferNegotiation): boolean {
  return OPEN_STAGES.has(negotiation.stage);
}

export function getTransferNegotiations(state: CareerState): TransferNegotiation[] {
  return Object.values(state.transferNegotiations ?? {});
}

/** The one open (CLUB/PLAYER stage) negotiation for this player/buyer, if any. */
export function getOpenNegotiation(state: CareerState, playerId: string, toClubId: string): TransferNegotiation | undefined {
  return getTransferNegotiations(state).find((n) => n.playerId === playerId && n.toClubId === toClubId && isNegotiationOpen(n));
}

/** The latest negotiation (any stage) for this player/buyer -- what the UI shows. */
export function getLatestNegotiation(state: CareerState, playerId: string, toClubId: string): TransferNegotiation | undefined {
  const all = getTransferNegotiations(state).filter((n) => n.playerId === playerId && n.toClubId === toClubId);
  return all[all.length - 1];
}

function saveNegotiation(state: CareerState, negotiation: TransferNegotiation): CareerState {
  return { ...state, transferNegotiations: { ...(state.transferNegotiations ?? {}), [negotiation.id]: negotiation } };
}

function lastRound(negotiation: TransferNegotiation, party: NegotiationRound["party"]): NegotiationRound | undefined {
  const rounds = negotiation.rounds.filter((r) => r.party === party);
  return rounds[rounds.length - 1];
}

function roundCount(negotiation: TransferNegotiation, party: NegotiationRound["party"]): number {
  return negotiation.rounds.filter((r) => r.party === party).length;
}

function clubName(clubId: string): string {
  return getClub(clubId)?.name ?? clubId;
}

function playerName(state: CareerState, playerId: string): string {
  const player = getCareerPlayer(state, playerId);
  return player ? `${player.firstName} ${player.lastName}` : playerId;
}

/** Where the player's ability ranks in a club's squad, as the role they expect there. */
function expectedRoleAtClub(state: CareerState, playerId: string, clubId: string): SquadStatusTier {
  const player = getCareerPlayer(state, playerId)!;
  const ca = getCareerPlayerRating(state, playerId, player.clubId)?.ca ?? player.currentAbility;
  const rank = (state.gameplayRatings[clubId] ?? []).filter((r) => r.playerId !== playerId && r.ca > ca).length;
  return expectedRoleFromSquadRank(rank, playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate));
}

/**
 * HM-ALPHA2-05B Part 4: competing CPU clubs, chosen exactly the way CPU
 * recruitment chooses its own targets -- a club with a MEDIUM/HIGH need
 * at the player's position whose own `rankCandidates` puts this player
 * in its top three affordable options. Their terms are the same
 * estimates rankCandidates uses for a real CPU offer.
 */
function findRivals(state: CareerState, playerId: string, negotiationId: string): RivalInterest[] {
  const player = getCareerPlayer(state, playerId);
  if (!player) return [];
  const found: { score: number; rival: RivalInterest }[] = [];
  for (const clubId of cpuRecruiterClubIds(state)) {
    if (clubId === player.clubId) continue;
    const need = assessPositionNeed(state, clubId, player.position, state.worldSquads[clubId] ?? []).level;
    if (need !== "MEDIUM" && need !== "HIGH") continue;
    const ranked = rankCandidates(state, clubId, player.position, state.gameDate).filter((c) => c.affordable);
    const index = ranked.findIndex((c) => c.playerId === playerId);
    if (index < 0 || index >= 3) continue;
    const candidate = ranked[index];
    found.push({
      score: candidate.score,
      rival: {
        clubId,
        feeEur: candidate.estimatedFeeEur,
        wageEurPerMonth: candidate.estimatedWageEurPerMonth,
        contractYears: 3,
        role: expectedRoleAtClub(state, playerId, clubId),
        decisionDate: addDays(state.gameDate, rivalDecisionDelayDays(`${negotiationId}:${clubId}`)),
        status: "ACTIVE",
      },
    });
  }
  return found.sort((a, b) => b.score - a.score || (a.rival.clubId < b.rival.clubId ? -1 : 1)).slice(0, MAX_RIVALS).map((f) => f.rival);
}

/**
 * HM-ALPHA2-05C: `dealType` LOAN opens a loan negotiation with the
 * OWNING club. A PERMANENT negotiation for a player who is out on loan is
 * allowed and is held with the owner too (the contract's club) -- the
 * deal then completes when the loan ends, or at once if the manager's
 * club is the borrower buying him out.
 */
export function startTransferNegotiation(state: CareerState, playerId: string, dealType: TransferDealType = "PERMANENT"): NegotiationActionResult {
  const toClubId = state.playerClubId;
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!player || !contract) return { ok: false, error: "Spelaren kunde inte hittas." };
  if (contract.clubId === toClubId) return { ok: false, error: "Spelaren tillhör redan din klubb." };
  if (hasActivePendingTransfer(state, playerId)) return { ok: false, error: "Spelaren har redan en överenskommen affär som väntar på transferfönstret." };
  const isLoan = dealType === "LOAN";
  if (isLoan) {
    if (getPlayerContractStatus(state, playerId) === "FREE_AGENT") return { ok: false, error: "En kontraktslös spelare kan inte lånas -- värva honom permanent." };
    if (getActiveLoanForPlayer(state, playerId)) return { ok: false, error: "Spelaren är redan utlånad." };
    if (player.clubId !== contract.clubId) return { ok: false, error: "Spelaren spelar inte för klubben som äger kontraktet just nu." };
  }

  const existing = getOpenNegotiation(state, playerId, toClubId);
  if (existing) return { ok: true, state, negotiation: existing };

  const blocked = getTransferNegotiations(state).find((n) => n.playerId === playerId && n.toClubId === toClubId && n.closedUntil && isBefore(state.gameDate, n.closedUntil));
  if (blocked) return { ok: false, error: `Samtalen bröts nyligen. Ny kontakt tidigast ${blocked.closedUntil}.` };

  const isFreeAgent = !isLoan && getPlayerContractStatus(state, playerId) === "FREE_AGENT";
  const id = `negotiation-${playerId}-${toClubId}-${state.gameDate}-${getTransferNegotiations(state).length}`;
  const negotiation: TransferNegotiation = {
    id,
    playerId,
    fromClubId: isFreeAgent ? "" : contract.clubId,
    toClubId,
    stage: isFreeAgent ? "PLAYER" : "CLUB",
    startedDate: state.gameDate,
    updatedDate: state.gameDate,
    ...(isFreeAgent ? { agreedFeeEur: 0 } : {}),
    ...(isLoan ? { dealType: "LOAN" as const } : {}),
    rounds: [],
    rivals: isLoan ? [] : findRivals(state, playerId, id),
  };
  return { ok: true, state: saveNegotiation(state, negotiation), negotiation };
}

/** Has the player left the selling club (or agreed a deal with someone else) since talks began? */
function playerGoneElsewhere(state: CareerState, negotiation: TransferNegotiation, pendingIds: ReadonlySet<string>): string | null {
  const contract = getPlayerContract(state, negotiation.playerId);
  if (!contract) return "Spelaren finns inte längre på marknaden.";
  if (contract.clubId === negotiation.toClubId) return null;
  if (contract.clubId !== negotiation.fromClubId) return `Spelaren har skrivit på för ${clubName(contract.clubId)}.`;
  if (negotiation.dealType === "LOAN") {
    const loan = getActiveLoanForPlayer(state, negotiation.playerId);
    if (loan && loan.borrowingClubId !== negotiation.toClubId) return `Spelaren har lånats ut till ${clubName(loan.borrowingClubId)}.`;
  }
  if (pendingIds.has(negotiation.playerId)) {
    const agreed = Object.values(state.transferOffers).find((o) => o.playerId === negotiation.playerId && o.status === "AGREED_AWAITING_WINDOW");
    if (agreed && agreed.toClubId !== negotiation.toClubId) return `Spelaren har kommit överens med ${clubName(agreed.toClubId)}.`;
  }
  return null;
}

/** Validates a manager action: right stage, nothing already awaiting an answer, deadline not passed, player still available. */
function getActionableNegotiation(state: CareerState, negotiationId: string, stage: TransferNegotiation["stage"]): TransferNegotiation | string {
  const negotiation = state.transferNegotiations?.[negotiationId];
  if (!negotiation) return "Förhandlingen finns inte.";
  if (negotiation.stage !== stage) return "Förhandlingen är inte i det steget.";
  if (negotiation.pending) return `Ditt bud väntar på svar (senast ${negotiation.pending.responseDate}).`;
  if (negotiation.expiresDate && isAfter(state.gameDate, negotiation.expiresDate)) return "Tidsfristen har gått ut.";
  const gone = playerGoneElsewhere(state, negotiation, activePendingTransferPlayerIds(state));
  if (gone) return gone;
  return negotiation;
}

function trainingCompensationEur(state: CareerState, playerId: string): number {
  return getPlayerTrainingCompensation(state, playerId)?.totalEur ?? 0;
}

function pendingResponseDate(state: CareerState, negotiation: TransferNegotiation): string {
  return addDays(state.gameDate, responseDelayDays(`${negotiation.id}:${negotiation.rounds.length}`));
}

/** Stage 1: a fee bid to the selling club -- answered on its response date. */
export function submitNegotiationFeeOffer(state: CareerState, negotiationId: string, offeredFeeEur: number): NegotiationActionResult {
  const found = getActionableNegotiation(state, negotiationId, "CLUB");
  if (typeof found === "string") return { ok: false, error: found };
  const negotiation = found;
  if (negotiation.dealType === "LOAN") return { ok: false, error: "Ett lån förhandlas om lönebidrag, inte övergångssumma." };
  const fee = Math.max(0, Math.round(offeredFeeEur));

  // Only the transfer budget is checked here -- the wage is not on the table yet.
  const budgets = getClubBudgets(state, negotiation.toClubId);
  const totalCost = fee + trainingCompensationEur(state, negotiation.playerId);
  if (!budgets || totalCost > budgets.transferBudgetEur) {
    return { ok: false, error: `Total övergångskostnad (${totalCost} €) överstiger transferbudgeten (${Math.round(budgets?.transferBudgetEur ?? 0)} €).` };
  }

  const next: TransferNegotiation = {
    ...negotiation,
    updatedDate: state.gameDate,
    expiresDate: undefined,
    pending: { party: "CLUB", submittedDate: state.gameDate, responseDate: pendingResponseDate(state, negotiation), offeredFeeEur: fee },
  };
  return { ok: true, state: saveNegotiation(state, next), negotiation: next };
}

/** HM-ALPHA2-05C, loan stage 1: the share of the wage the borrowing club pays, and when the loan ends -- answered by the owning club. */
export function submitNegotiationLoanOffer(state: CareerState, negotiationId: string, offer: { wageSharePct: number; endDate: string }): NegotiationActionResult {
  const found = getActionableNegotiation(state, negotiationId, "CLUB");
  if (typeof found === "string") return { ok: false, error: found };
  const negotiation = found;
  if (negotiation.dealType !== "LOAN") return { ok: false, error: "Det här är ingen låneförhandling." };
  const share = Math.round(offer.wageSharePct);
  if (!Number.isFinite(share) || share < 0 || share > 100) return { ok: false, error: "Lönebidraget måste vara 0-100 %." };
  const contract = getPlayerContract(state, negotiation.playerId)!;
  if (offer.endDate <= state.gameDate || offer.endDate > contract.contractEndDate) return { ok: false, error: `Lånet måste sluta efter dagens datum och senast när kontraktet löper ut (${contract.contractEndDate}).` };
  const affordability = assessTransferAffordability(state, negotiation.toClubId, 0, 0, contract.wageEurPerMonth, share);
  if (!affordability.affordable) return { ok: false, error: affordability.reasons.join(" ") };

  const next: TransferNegotiation = {
    ...negotiation,
    updatedDate: state.gameDate,
    expiresDate: undefined,
    pending: { party: "CLUB", submittedDate: state.gameDate, responseDate: pendingResponseDate(state, negotiation), wageSharePct: share, loanEndDate: offer.endDate },
  };
  return { ok: true, state: saveNegotiation(state, next), negotiation: next };
}

export interface PlayerTermsOffer {
  wageEurPerMonth: number;
  contractYears: number;
  promisedSquadRole: SquadStatusTier;
}

/** The player's demand for these exact terms at `clubId` -- the buying club's tier, finances and squad decide it. */
function computeWageDemandAt(state: CareerState, negotiation: TransferNegotiation, clubId: string, terms: Pick<PlayerTermsOffer, "contractYears" | "promisedSquadRole">): PlayerWageDemand | undefined {
  const player = getCareerPlayer(state, negotiation.playerId);
  const contract = getPlayerContract(state, negotiation.playerId);
  if (!player || !contract) return undefined;
  const isFreeAgent = negotiation.fromClubId === "";
  return computePlayerWageDemand({
    playerId: player.id,
    age: playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate),
    isFreeAgent,
    currentWageEurPerMonth: contract.wageEurPerMonth,
    fairWageEurPerMonth: getPlayerFairWageEurPerMonth(state, player.id) ?? contract.wageEurPerMonth,
    currentClubTier: isFreeAgent ? undefined : competitionTierForClub(negotiation.fromClubId),
    newClubTier: competitionTierForClub(clubId),
    currentSquadStatus: player.squadStatus,
    currentClubPressure: isFreeAgent ? "NONE" : getClubFinancialHealth(state, negotiation.fromClubId)?.pressure ?? "NONE",
    newClubPressure: getClubFinancialHealth(state, clubId)?.pressure ?? "NONE",
    expectedRole: expectedRoleAtClub(state, player.id, clubId),
    promisedRole: terms.promisedSquadRole,
    contractYears: terms.contractYears,
  });
}

/** The player's demand for these exact terms at the manager's club -- what the next round will be judged against. */
export function computeNegotiationWageDemand(state: CareerState, negotiation: TransferNegotiation, terms: Pick<PlayerTermsOffer, "contractYears" | "promisedSquadRole">): PlayerWageDemand | undefined {
  return computeWageDemandAt(state, negotiation, negotiation.toClubId, terms);
}

/** Stage 2: personal terms -- answered on the player's response date. */
export function submitNegotiationTerms(state: CareerState, negotiationId: string, terms: PlayerTermsOffer): NegotiationActionResult {
  const found = getActionableNegotiation(state, negotiationId, "PLAYER");
  if (typeof found === "string") return { ok: false, error: found };
  const negotiation = found;
  if (negotiation.dealType === "LOAN") {
    // A loaned player keeps his contract and wage -- only the playing role is on the table.
    const next: TransferNegotiation = {
      ...negotiation,
      updatedDate: state.gameDate,
      expiresDate: undefined,
      pending: { party: "PLAYER", submittedDate: state.gameDate, responseDate: pendingResponseDate(state, negotiation), promisedSquadRole: terms.promisedSquadRole },
    };
    return { ok: true, state: saveNegotiation(state, next), negotiation: next };
  }
  if (!Number.isInteger(terms.contractYears) || terms.contractYears < 1 || terms.contractYears > 5) return { ok: false, error: "Välj en kontraktslängd på 1-5 år." };
  const wage = Math.max(0, Math.round(terms.wageEurPerMonth));

  const affordability = assessTransferAffordability(state, negotiation.toClubId, negotiation.agreedFeeEur ?? 0, trainingCompensationEur(state, negotiation.playerId), wage);
  if (!affordability.affordable) return { ok: false, error: affordability.reasons.join(" ") };

  const next: TransferNegotiation = {
    ...negotiation,
    updatedDate: state.gameDate,
    expiresDate: undefined,
    pending: { party: "PLAYER", submittedDate: state.gameDate, responseDate: pendingResponseDate(state, negotiation), offeredWageEurPerMonth: wage, contractYears: terms.contractYears, promisedSquadRole: terms.promisedSquadRole },
  };
  return { ok: true, state: saveNegotiation(state, next), negotiation: next };
}

/** One dispatch point for the UI's CareerContext action. */
export type NegotiationAction =
  | { kind: "START"; playerId: string; dealType?: TransferDealType }
  | { kind: "FEE"; negotiationId: string; feeEur: number }
  | { kind: "LOAN_TERMS"; negotiationId: string; wageSharePct: number; endDate: string }
  | { kind: "TERMS"; negotiationId: string; terms: PlayerTermsOffer }
  | { kind: "WITHDRAW"; negotiationId: string };

export function runNegotiationAction(state: CareerState, action: NegotiationAction): NegotiationActionResult {
  switch (action.kind) {
    case "START":
      return startTransferNegotiation(state, action.playerId, action.dealType);
    case "FEE":
      return submitNegotiationFeeOffer(state, action.negotiationId, action.feeEur);
    case "LOAN_TERMS":
      return submitNegotiationLoanOffer(state, action.negotiationId, { wageSharePct: action.wageSharePct, endDate: action.endDate });
    case "TERMS":
      return submitNegotiationTerms(state, action.negotiationId, action.terms);
    case "WITHDRAW":
      return withdrawTransferNegotiation(state, action.negotiationId);
  }
}

/** The manager walks away -- no cooldown, but any agreed fee (and any offer awaiting an answer) is lost. */
export function withdrawTransferNegotiation(state: CareerState, negotiationId: string): NegotiationActionResult {
  const negotiation = state.transferNegotiations?.[negotiationId];
  if (!negotiation || !isNegotiationOpen(negotiation)) return { ok: false, error: "Förhandlingen är redan avslutad." };
  const next: TransferNegotiation = { ...negotiation, stage: "WITHDRAWN", updatedDate: state.gameDate, pending: undefined, expiresDate: undefined };
  return { ok: true, state: saveNegotiation(state, next), negotiation: next };
}

// ---------------------------------------------------------------------------
// HM-ALPHA2-05B: daily processing.
// ---------------------------------------------------------------------------

/** One inbox-worthy change, emitted by dailyTick.ts as a CLUB_NEWS event. */
export interface NegotiationNotice {
  id: string;
  subject: string;
  summary: string;
}

function activeRivals(negotiation: TransferNegotiation): RivalInterest[] {
  return (negotiation.rivals ?? []).filter((r) => r.status === "ACTIVE");
}

/** The highest fee an active rival has on the table. */
function bestRivalFee(negotiation: TransferNegotiation): { clubName: string; feeEur: number } | undefined {
  const best = activeRivals(negotiation).sort((a, b) => b.feeEur - a.feeEur)[0];
  return best ? { clubName: clubName(best.clubId), feeEur: best.feeEur } : undefined;
}

/** How attractive a rival's package is to the player: its wage over what they would demand there. */
function rivalPackageRatio(state: CareerState, negotiation: TransferNegotiation, rival: RivalInterest): number {
  const demand = computeWageDemandAt(state, negotiation, rival.clubId, { contractYears: rival.contractYears, promisedSquadRole: rival.role });
  return demand ? packageRatio(rival.wageEurPerMonth, demand) : 0;
}

function bestRivalPackage(state: CareerState, negotiation: TransferNegotiation): { clubName: string; packageRatio: number } | undefined {
  let best: { clubName: string; packageRatio: number } | undefined;
  for (const rival of activeRivals(negotiation)) {
    const ratio = rivalPackageRatio(state, negotiation, rival);
    if (!best || ratio > best.packageRatio) best = { clubName: clubName(rival.clubId), packageRatio: ratio };
  }
  return best;
}

/** The manager's most recent personal-terms package, scored the same way as a rival's (0 before any terms were offered). */
function managerPackageRatio(state: CareerState, negotiation: TransferNegotiation): number {
  const source = negotiation.pending?.party === "PLAYER" ? negotiation.pending : lastRound(negotiation, "PLAYER");
  if (!source?.offeredWageEurPerMonth || !source.contractYears || !source.promisedSquadRole) return 0;
  const demand = computeNegotiationWageDemand(state, negotiation, { contractYears: source.contractYears, promisedSquadRole: source.promisedSquadRole });
  return demand ? packageRatio(source.offeredWageEurPerMonth, demand) : 0;
}

function closeNegotiation(negotiation: TransferNegotiation, stage: TransferNegotiation["stage"], date: string, extra: Partial<TransferNegotiation> = {}): TransferNegotiation {
  const rivals = negotiation.rivals?.map((r) => (r.status === "ACTIVE" ? { ...r, status: "WITHDRAWN" as const } : r));
  return { ...negotiation, ...extra, stage, updatedDate: date, pending: undefined, expiresDate: undefined, ...(rivals ? { rivals } : {}) };
}

function marketRound(date: string, response: NegotiationRound["response"], reason: string): NegotiationRound {
  return { date, party: "MARKET", response, reason };
}

/** HM-ALPHA2-05C: the owning club answers a loan offer against its required wage share today. */
function resolveLoanClubResponse(state: CareerState, negotiation: TransferNegotiation, date: string): TransferNegotiation {
  const pending = negotiation.pending!;
  const required = getRequiredLoanWageSharePct(state, negotiation.playerId) ?? null;
  const previous = lastRound(negotiation, "CLUB")?.offeredWageSharePct;
  const result = evaluateLoanShareRound({ requiredSharePct: required, offeredSharePct: pending.wageSharePct ?? 0, round: roundCount(negotiation, "CLUB") + 1, previousOfferPct: previous });
  const round: NegotiationRound = {
    date,
    party: "CLUB",
    offeredWageSharePct: pending.wageSharePct,
    loanEndDate: pending.loanEndDate,
    response: result.response,
    reason: result.reason,
    ...(result.response === "COUNTER" && required !== null ? { counterWageSharePct: required } : {}),
  };
  const next: TransferNegotiation = { ...negotiation, updatedDate: date, pending: undefined, rounds: [...negotiation.rounds, round], expiresDate: addDays(date, RESPONSE_WINDOW_DAYS) };
  if (result.response === "ACCEPT") return { ...next, stage: "PLAYER", agreedWageSharePct: pending.wageSharePct ?? 0, loanEndDate: pending.loanEndDate };
  if (result.response === "BREAK_OFF") return closeNegotiation(next, "COLLAPSED", date, { closedUntil: addDays(date, NEGOTIATION_COOLDOWN_DAYS) });
  return next;
}

/** HM-ALPHA2-05C: the player answers the promised role; acceptance starts the loan once, through resolveTransferOffer. */
function resolveLoanPlayerResponse(state: CareerState, negotiation: TransferNegotiation, date: string): { state: CareerState; negotiation: TransferNegotiation } {
  const pending = negotiation.pending!;
  const promisedRole = pending.promisedSquadRole ?? "ROTATION";
  const result = evaluateLoanPlayerRound({ expectedRole: expectedRoleAtClub(state, negotiation.playerId, negotiation.toClubId), promisedRole, round: roundCount(negotiation, "PLAYER") + 1 });
  const round: NegotiationRound = { date, party: "PLAYER", promisedSquadRole: promisedRole, response: result.response, reason: result.reason };
  const withRound: TransferNegotiation = { ...negotiation, updatedDate: date, pending: undefined, rounds: [...negotiation.rounds, round] };
  if (result.response === "BREAK_OFF") return { state, negotiation: closeNegotiation(withRound, "COLLAPSED", date, { closedUntil: addDays(date, NEGOTIATION_COOLDOWN_DAYS) }) };
  if (result.response !== "ACCEPT") return { state, negotiation: { ...withRound, expiresDate: addDays(date, RESPONSE_WINDOW_DAYS) } };

  const contract = getPlayerContract(state, negotiation.playerId)!;
  const resolved = resolveTransferOffer(
    { ...state, gameDate: date },
    {
      dealType: "LOAN",
      playerId: negotiation.playerId,
      toClubId: negotiation.toClubId,
      transferFeeEur: 0,
      newWageEurPerMonth: contract.wageEurPerMonth,
      loanTerms: { endDate: negotiation.loanEndDate!, wageShareBorrowingPct: negotiation.agreedWageSharePct ?? 100 },
      promisedSquadRole: promisedRole,
    },
    { negotiationId: negotiation.id, clubReason: lastRound(negotiation, "CLUB")?.reason ?? "", playerReason: result.reason },
  );
  const nextState = { ...resolved.state, gameDate: state.gameDate };
  if (resolved.offer.status === "COMPLETED") return { state: nextState, negotiation: closeNegotiation(withRound, "COMPLETED", date, { offerId: resolved.offer.id }) };
  const failed = { ...round, reason: `${round.reason} Lånet kunde ändå inte genomföras: ${resolved.offer.clubDecisionReason ?? ""}`.trim() };
  return { state: nextState, negotiation: closeNegotiation({ ...withRound, rounds: [...negotiation.rounds, failed] }, "COLLAPSED", date, { offerId: resolved.offer.id }) };
}

/** Answers a pending fee bid against today's asking price and today's rival bids. */
function resolveClubResponse(state: CareerState, negotiation: TransferNegotiation, date: string): TransferNegotiation {
  if (negotiation.dealType === "LOAN") return resolveLoanClubResponse(state, negotiation, date);
  const pending = negotiation.pending!;
  const askingFeeEur = getSellingClubAskingPriceEur(state, negotiation.playerId) ?? 0;
  const result = evaluateClubFeeRound({
    askingFeeEur,
    offeredFeeEur: pending.offeredFeeEur ?? 0,
    round: roundCount(negotiation, "CLUB") + 1,
    previousOfferEur: lastRound(negotiation, "CLUB")?.offeredFeeEur,
    rival: bestRivalFee(negotiation),
  });
  const round: NegotiationRound = { date, party: "CLUB", offeredFeeEur: pending.offeredFeeEur, response: result.response, reason: result.reason, ...(result.counterFeeEur !== undefined ? { counterFeeEur: result.counterFeeEur } : {}) };
  const next: TransferNegotiation = { ...negotiation, updatedDate: date, pending: undefined, rounds: [...negotiation.rounds, round], expiresDate: addDays(date, RESPONSE_WINDOW_DAYS) };
  if (result.response === "ACCEPT") return { ...next, stage: "PLAYER", agreedFeeEur: pending.offeredFeeEur ?? 0 };
  if (result.response === "BREAK_OFF") return closeNegotiation(next, "COLLAPSED", date, { closedUntil: addDays(date, NEGOTIATION_COOLDOWN_DAYS) });
  return next;
}

/** Answers pending personal terms; an acceptance executes the deal once, through resolveTransferOffer. */
function resolvePlayerResponse(state: CareerState, negotiation: TransferNegotiation, date: string): { state: CareerState; negotiation: TransferNegotiation } {
  if (negotiation.dealType === "LOAN") return resolveLoanPlayerResponse(state, negotiation, date);
  const pending = negotiation.pending!;
  const terms = { contractYears: pending.contractYears ?? 3, promisedSquadRole: pending.promisedSquadRole ?? "ROTATION" };
  const wage = pending.offeredWageEurPerMonth ?? 0;
  const fee = negotiation.agreedFeeEur ?? 0;
  const base = { ...negotiation, updatedDate: date, pending: undefined };
  const roundOf = (response: NegotiationRound["response"], reason: string, counter?: number): NegotiationRound => ({
    date,
    party: "PLAYER",
    offeredWageEurPerMonth: wage,
    contractYears: terms.contractYears,
    promisedSquadRole: terms.promisedSquadRole,
    response,
    reason,
    ...(counter !== undefined ? { counterWageEurPerMonth: counter } : {}),
  });

  // The club's finances may have changed since the offer was made -- never let a player accept terms the club can no longer carry.
  const affordability = assessTransferAffordability(state, negotiation.toClubId, fee, trainingCompensationEur(state, negotiation.playerId), wage);
  if (!affordability.affordable) {
    const round = roundOf("REJECT", `Erbjudandet drogs tillbaka: ${affordability.reasons.join(" ")}`);
    return { state, negotiation: { ...base, rounds: [...negotiation.rounds, round], expiresDate: addDays(date, RESPONSE_WINDOW_DAYS) } };
  }

  const demand = computeNegotiationWageDemand(state, negotiation, terms);
  if (!demand) return { state, negotiation: closeNegotiation(base, "COLLAPSED", date) };
  const result = evaluatePlayerTermsRound({ demand, offeredWageEurPerMonth: wage, round: roundCount(negotiation, "PLAYER") + 1, rival: bestRivalPackage(state, negotiation) });
  const round = roundOf(result.response, [result.reason, ...demand.factors].join(" "), result.counterWageEurPerMonth);
  const withRound: TransferNegotiation = { ...base, rounds: [...negotiation.rounds, round] };

  if (result.response === "BREAK_OFF") return { state, negotiation: closeNegotiation(withRound, "COLLAPSED", date, { closedUntil: addDays(date, NEGOTIATION_COOLDOWN_DAYS) }) };
  if (result.response !== "ACCEPT") return { state, negotiation: { ...withRound, expiresDate: addDays(date, RESPONSE_WINDOW_DAYS) } };

  const clubRound = lastRound(negotiation, "CLUB");
  const resolved = resolveTransferOffer(
    { ...state, gameDate: date },
    { dealType: "PERMANENT", playerId: negotiation.playerId, toClubId: negotiation.toClubId, transferFeeEur: fee, newWageEurPerMonth: wage, contractYears: terms.contractYears, promisedSquadRole: terms.promisedSquadRole },
    { negotiationId: negotiation.id, clubReason: clubRound?.reason ?? "Kontraktslös spelare -- ingen klubb att förhandla med.", playerReason: result.reason },
  );
  const executed = resolved.offer.status === "COMPLETED" || resolved.offer.status === "AGREED_AWAITING_WINDOW";
  const nextState = { ...resolved.state, gameDate: state.gameDate };
  if (executed) return { state: nextState, negotiation: closeNegotiation(withRound, "COMPLETED", date, { offerId: resolved.offer.id }) };
  const failed = { ...round, reason: `${round.reason} Affären kunde ändå inte genomföras: ${resolved.offer.clubDecisionReason ?? ""}`.trim() };
  return { state: nextState, negotiation: closeNegotiation({ ...withRound, rounds: [...negotiation.rounds, failed] }, "COLLAPSED", date, { offerId: resolved.offer.id }) };
}

/**
 * A rival's decision day: it signs if the selling club takes its fee
 * AND the player prefers its package to the manager's latest one (a
 * tie stays with the manager); otherwise it drops out. Executed through
 * the same resolveTransferOffer as every other deal.
 */
function resolveRivalDecision(state: CareerState, negotiation: TransferNegotiation, rival: RivalInterest, date: string): { state: CareerState; negotiation: TransferNegotiation; signed: boolean } {
  const name = clubName(rival.clubId);
  const setRival = (status: RivalInterest["status"]) => (negotiation.rivals ?? []).map((r) => (r.clubId === rival.clubId ? { ...r, status } : r));
  const isFreeAgent = negotiation.fromClubId === "";
  const asking = getSellingClubAskingPriceEur(state, negotiation.playerId) ?? 0;
  const clubTakesFee = isFreeAgent || rival.feeEur >= asking;
  const rivalRatio = rivalPackageRatio(state, negotiation, rival);
  const playerPrefersRival = rivalRatio >= 1 && rivalRatio > managerPackageRatio(state, negotiation);

  if (clubTakesFee && playerPrefersRival) {
    const resolved = resolveTransferOffer(
      { ...state, gameDate: date },
      { dealType: "PERMANENT", playerId: negotiation.playerId, toClubId: rival.clubId, transferFeeEur: rival.feeEur, newWageEurPerMonth: rival.wageEurPerMonth, contractYears: rival.contractYears },
      { negotiationId: `${negotiation.id}:rival:${rival.clubId}`, clubReason: `Klubben accepterade ${name}s bud.`, playerReason: `Spelaren valde ${name}.` },
    );
    if (resolved.offer.status === "COMPLETED" || resolved.offer.status === "AGREED_AWAITING_WINDOW") {
      const withRival = { ...negotiation, rivals: setRival("SIGNED") };
      const lost = closeNegotiation({ ...withRival, rounds: [...negotiation.rounds, marketRound(date, "ACCEPT", `Spelaren valde ${name} framför er.`)] }, "LOST", date);
      return { state: { ...resolved.state, gameDate: state.gameDate }, negotiation: lost, signed: true };
    }
  }
  const why = !clubTakesFee ? `${name}s bud räckte inte för klubben` : `spelaren föredrog ert erbjudande eller ville ha mer`;
  return { state, negotiation: { ...negotiation, updatedDate: date, rivals: setRival("WITHDRAWN"), rounds: [...negotiation.rounds, marketRound(date, "REJECT", `${name} drog sig ur -- ${why}.`)] }, signed: false };
}

/**
 * HM-ALPHA2-05B: the daily-tick hook (dailyTick.ts, right after
 * progressDailyTransfers). Per open negotiation, in a fixed order:
 * (1) the player left or agreed elsewhere -> LOST; (2) a due manager
 * offer is answered; (3) due rival decisions; (4) a passed deadline ->
 * EXPIRED. Idempotent for a date: an answered offer is cleared, a
 * closed negotiation is skipped, so a deal can never execute or be
 * charged twice.
 */
export function progressTransferNegotiations(state: CareerState, date: string): { state: CareerState; notices: NegotiationNotice[] } {
  let next = state;
  const notices: NegotiationNotice[] = [];
  const open = getTransferNegotiations(state).filter(isNegotiationOpen).sort((a, b) => (a.id < b.id ? -1 : 1));

  for (const original of open) {
    let negotiation = next.transferNegotiations![original.id];
    const name = playerName(next, negotiation.playerId);
    const notice = (suffix: string, subject: string, summary: string) => notices.push({ id: `${negotiation.id}:${suffix}`, subject, summary });

    const gone = playerGoneElsewhere(next, negotiation, activePendingTransferPlayerIds(next));
    if (gone) {
      negotiation = closeNegotiation({ ...negotiation, rounds: [...negotiation.rounds, marketRound(date, "BREAK_OFF", gone)] }, "LOST", date);
      next = saveNegotiation(next, negotiation);
      notice("lost", `Förhandling avslutad: ${name}`, gone);
      continue;
    }

    if (negotiation.pending && isSameOrBefore(negotiation.pending.responseDate, date)) {
      const party = negotiation.pending.party;
      if (party === "CLUB") {
        negotiation = resolveClubResponse(next, negotiation, date);
      } else {
        const resolved = resolvePlayerResponse(next, negotiation, date);
        next = resolved.state;
        negotiation = resolved.negotiation;
      }
      next = saveNegotiation(next, negotiation);
      const answer = negotiation.rounds[negotiation.rounds.length - 1];
      notice(`round-${negotiation.rounds.length}`, `${party === "CLUB" ? "Klubben" : name} har svarat`, `${answer.reason}${negotiation.expiresDate ? ` Svara senast ${negotiation.expiresDate}.` : ""}`);
      if (!isNegotiationOpen(negotiation)) continue;
    }

    for (const rival of activeRivals(negotiation)) {
      if (!isSameOrBefore(rival.decisionDate, date)) continue;
      const resolved = resolveRivalDecision(next, negotiation, rival, date);
      next = resolved.state;
      negotiation = resolved.negotiation;
      next = saveNegotiation(next, negotiation);
      if (resolved.signed) {
        notice("lost", `${name} valde en annan klubb`, `${clubName(rival.clubId)} vann kampen om ${name}.`);
        break;
      }
    }
    if (!isNegotiationOpen(negotiation)) continue;

    if (!negotiation.pending && negotiation.expiresDate && isAfter(date, negotiation.expiresDate)) {
      negotiation = closeNegotiation({ ...negotiation, rounds: [...negotiation.rounds, marketRound(date, "BREAK_OFF", "Tidsfristen gick ut utan nytt bud.")] }, "EXPIRED", date);
      next = saveNegotiation(next, negotiation);
      notice("expired", `Förhandling avslutad: ${name}`, "Tidsfristen gick ut utan nytt bud -- eventuell överenskommelse har förfallit.");
    }
  }

  return { state: next, notices };
}
