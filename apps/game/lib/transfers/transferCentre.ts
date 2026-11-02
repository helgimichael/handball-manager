// HM-ALPHA2-05E: read-only view models for the Transfer Centre, the
// Negotiation Room, Deal Completion and the player-profile transfer card.
// Everything here is DERIVED from canonical career state (negotiations,
// offers, loans, contracts, economy, squad needs) -- nothing is stored,
// so every screen shows the same truth after a save/reload.
import type { CareerState } from "../career/types";
import { getCareerClubSquad, getCareerPlayer, getExternalCandidateClubs } from "../career/careerWorld";
import { getFreeAgents } from "../career/contractExpiry";
import { assessPositionNeed, CPU_TRACKED_POSITIONS, type NeedLevel } from "../career/cpuSquadNeeds";
import { getPlayerSquadStatus, SQUAD_STATUS_TIERS, type SquadStatusTier } from "../career/squadStatus";
import { getClubBudgets, getClubEconomySnapshot } from "../economy/clubEconomyIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "../economy/contractIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import type { ContractStatus } from "../economy/types";
import type { HandballPosition, PlayerMock } from "../game-data";
import { getTransferNegotiations, isNegotiationOpen } from "./negotiationIntegration";
import { estimatedMarketValueEur } from "../knowledge/scoutReportVisibility";
import { getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { getActiveLoanForPlayer } from "./transferIntegration";
import type { LoanRecord, NegotiationRound, RivalInterest, TransferNegotiation, TransferOffer } from "./types";

export interface PositionNeedView {
  position: HandballPosition;
  level: NeedLevel;
  projectedDepth: number;
  reason: string;
}

/** The manager's own squad needs, position by position -- the same assessment CPU clubs recruit from. */
export function getManagerRecruitmentNeeds(state: CareerState): PositionNeedView[] {
  const squad = getCareerClubSquad(state, state.playerClubId);
  return CPU_TRACKED_POSITIONS.map((position) => {
    const need = assessPositionNeed(state, state.playerClubId, position, squad);
    return { position, level: need.level, projectedDepth: need.projectedDepth, reason: need.reason };
  });
}

export interface FinanceView {
  cashEur: number;
  transferBudgetEur: number;
  wageRoomEurPerMonth: number;
  /** Fees + training compensation + agent fees + bonuses already committed to deals waiting for the window. */
  committedEur: number;
}

export function getTransferFinance(state: CareerState): FinanceView | undefined {
  const economy = getClubEconomySnapshot(state, state.playerClubId);
  const budgets = getClubBudgets(state, state.playerClubId);
  if (!economy || !budgets) return undefined;
  const committedEur = Object.values(state.transferOffers)
    .filter((o) => o.toClubId === state.playerClubId && o.status === "AGREED_AWAITING_WINDOW")
    .reduce((sum, o) => sum + o.transferFeeEur + o.trainingCompensationEur + (o.agentFeeEur ?? 0) + (o.signingBonusEur ?? 0), 0);
  return { cashEur: economy.cashEur, transferBudgetEur: budgets.transferBudgetEur, wageRoomEurPerMonth: (budgets.wageBudgetEur - economy.playerWageCostsEurAnnual) / 12, committedEur };
}

export interface OpportunityView {
  player: PlayerMock;
  clubId: string;
  contractStatus: ContractStatus | undefined;
  marketValueEur: number;
  needLevel: NeedLevel;
  why: string;
}

const NEED_WEIGHT: Record<NeedLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

/**
 * Relevant opportunities: players at positions the manager actually
 * needs whose contract situation makes a deal realistic (free, or with a
 * year or less left), within reach of the transfer budget. Ordered by
 * need, then by value -- never by hidden ability.
 */
export function getTransferOpportunities(state: CareerState, limit = 8): OpportunityView[] {
  const needs = new Map(getManagerRecruitmentNeeds(state).map((n) => [n.position, n.level]));
  const budget = getClubBudgets(state, state.playerClubId)?.transferBudgetEur ?? 0;
  const pool: { player: PlayerMock; clubId: string }[] = [
    ...getExternalCandidateClubs(state).flatMap((club) => getCareerClubSquad(state, club.id).map((player) => ({ player, clubId: club.id }))),
    ...getFreeAgents(state).map((player) => ({ player, clubId: "" })),
  ];
  const result: OpportunityView[] = [];
  for (const { player, clubId } of pool) {
    const needLevel = needs.get(player.position) ?? "NONE";
    if (needLevel !== "HIGH" && needLevel !== "MEDIUM") continue;
    if (getActiveLoanForPlayer(state, player.id)) continue;
    const contractStatus = getPlayerContractStatus(state, player.id);
    if (contractStatus !== "FREE_AGENT" && contractStatus !== "EXPIRING" && contractStatus !== "EXPIRING_SOON") continue;
    // HM-ALPHA3-M06: the club's knowledge-gated ESTIMATE -- never the true value -- decides budget fit and order.
    const marketValueEur = Math.round(estimatedMarketValueEur(getPlayerMarketValueEur(state, player.id) ?? 0, getPlayerKnowledgePct(state, player.id, clubId), player.id));
    // HM-ALPHA2-05F: "within budget" means the real up-front cost -- market value as the fee estimate plus training compensation (a free agent has no fee).
    const upFrontEur = (contractStatus === "FREE_AGENT" ? 0 : marketValueEur) + (getPlayerTrainingCompensation(state, player.id)?.totalEur ?? 0);
    if (upFrontEur > budget) continue;
    const why = contractStatus === "FREE_AGENT" ? "Kontraktslös -- ingen övergångssumma" : contractStatus === "EXPIRING" ? "Kontraktet går ut inom ett halvår" : "Kontraktet går ut inom ett år";
    result.push({ player, clubId, contractStatus, marketValueEur, needLevel, why });
  }
  return result.sort((a, b) => NEED_WEIGHT[b.needLevel] - NEED_WEIGHT[a.needLevel] || b.marketValueEur - a.marketValueEur).slice(0, limit);
}

export type NegotiationNextStep = "WAITING" | "YOUR_MOVE" | "COMPLETED" | "CLOSED";

export interface NegotiationSummary {
  negotiation: TransferNegotiation;
  nextStep: NegotiationNextStep;
  /** WAITING: the answer date. YOUR_MOVE: the manager's deadline. */
  date?: string;
  latest?: NegotiationRound;
  activeRivals: RivalInterest[];
}

export function summarizeNegotiation(negotiation: TransferNegotiation): NegotiationSummary {
  const latest = negotiation.rounds[negotiation.rounds.length - 1];
  const activeRivals = (negotiation.rivals ?? []).filter((r) => r.status === "ACTIVE");
  if (negotiation.stage === "COMPLETED") return { negotiation, nextStep: "COMPLETED", latest, activeRivals };
  if (!isNegotiationOpen(negotiation)) return { negotiation, nextStep: "CLOSED", latest, activeRivals };
  if (negotiation.pending) return { negotiation, nextStep: "WAITING", date: negotiation.pending.responseDate, latest, activeRivals };
  return { negotiation, nextStep: "YOUR_MOVE", date: negotiation.expiresDate, latest, activeRivals };
}

/** The manager's open negotiations, the ones needing a move first, then by date. */
export function getOpenNegotiationSummaries(state: CareerState): NegotiationSummary[] {
  return getTransferNegotiations(state)
    .filter((n) => n.toClubId === state.playerClubId && isNegotiationOpen(n))
    .map(summarizeNegotiation)
    .sort((a, b) => (a.nextStep === b.nextStep ? (a.date ?? "9999") < (b.date ?? "9999") ? -1 : 1 : a.nextStep === "YOUR_MOVE" ? -1 : 1));
}

/** Answers that arrived in the last `days` days -- the "incoming responses" feed. */
export function getRecentResponses(state: CareerState, days = 14): { negotiation: TransferNegotiation; round: NegotiationRound }[] {
  const since = new Date(Date.parse(state.gameDate) - days * 86_400_000).toISOString().slice(0, 10);
  return getTransferNegotiations(state)
    .filter((n) => n.toClubId === state.playerClubId)
    .flatMap((negotiation) => negotiation.rounds.filter((round) => round.date >= since && round.date <= state.gameDate).map((round) => ({ negotiation, round })))
    .sort((a, b) => (a.round.date < b.round.date ? 1 : -1));
}

export interface DealSummary {
  offer: TransferOffer;
  isLoan: boolean;
  feeEur: number;
  trainingCompensationEur: number;
  agentFeeEur: number;
  signingBonusEur: number;
  upfrontEur: number;
  /** What the buying club pays in wages per month (the loan share for a loan). */
  monthlyWageCostEur: number;
  contractEndDate?: string;
  promisedSquadRole?: SquadStatusTier;
  loan?: LoanRecord;
  arrival: "ARRIVED" | "SCHEDULED" | "NOT_EXECUTED";
  arrivalDate?: string;
}

export function getDealSummary(state: CareerState, offer: TransferOffer): DealSummary {
  const isLoan = offer.dealType === "LOAN";
  const loan = isLoan ? state.loans[offer.id] : undefined;
  const agentFeeEur = offer.agentFeeEur ?? 0;
  const signingBonusEur = offer.signingBonusEur ?? 0;
  const share = isLoan ? (offer.loanTerms?.wageShareBorrowingPct ?? 100) / 100 : 1;
  return {
    offer,
    isLoan,
    feeEur: offer.transferFeeEur,
    trainingCompensationEur: offer.trainingCompensationEur,
    agentFeeEur,
    signingBonusEur,
    upfrontEur: offer.transferFeeEur + offer.trainingCompensationEur + agentFeeEur + signingBonusEur,
    monthlyWageCostEur: Math.round(offer.newWageEurPerMonth * share),
    contractEndDate: isLoan ? undefined : offer.newContractEndDate,
    promisedSquadRole: offer.promisedSquadRole,
    loan,
    arrival: offer.status === "COMPLETED" ? "ARRIVED" : offer.status === "AGREED_AWAITING_WINDOW" ? "SCHEDULED" : "NOT_EXECUTED",
    arrivalDate: offer.status === "AGREED_AWAITING_WINDOW" ? offer.scheduledCompletionDate : offer.resolvedDate,
  };
}

export interface PlayerTransferStatus {
  ownerClubId: string;
  playingClubId: string;
  loan?: LoanRecord;
  contractEndDate?: string;
  wageEurPerMonth?: number;
  contractStatus?: ContractStatus;
  /** Owned by the manager's club with a recorded promise: is the current squad status at least the promised one? */
  promise?: { role: SquadStatusTier; kept: boolean };
  managerNegotiation?: NegotiationSummary;
  /** Other clubs known to be pursuing him (rivals in the manager's own negotiations). */
  interestedClubIds: string[];
  isOwnPlayer: boolean;
  /** The manager's club plays him on loan. */
  isLoanedIn: boolean;
}

export function getPlayerTransferStatus(state: CareerState, playerId: string): PlayerTransferStatus | undefined {
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!player) return undefined;
  const loan = getActiveLoanForPlayer(state, playerId);
  const ownerClubId = contract?.clubId ?? player.clubId;
  const negotiations = getTransferNegotiations(state).filter((n) => n.playerId === playerId && n.toClubId === state.playerClubId);
  const latest = negotiations[negotiations.length - 1];
  const interested = new Set(negotiations.flatMap((n) => (n.rivals ?? []).filter((r) => r.status === "ACTIVE").map((r) => r.clubId)));
  let promise: PlayerTransferStatus["promise"];
  if (contract?.promisedSquadRole && ownerClubId === state.playerClubId) {
    const current = getPlayerSquadStatus(state, playerId);
    const rank = (t: SquadStatusTier) => SQUAD_STATUS_TIERS.indexOf(t);
    promise = { role: contract.promisedSquadRole, kept: current !== undefined && rank(current) <= rank(contract.promisedSquadRole) };
  }
  return {
    ownerClubId,
    playingClubId: player.clubId,
    loan,
    contractEndDate: contract?.contractEndDate,
    wageEurPerMonth: contract?.wageEurPerMonth,
    contractStatus: getPlayerContractStatus(state, playerId),
    promise,
    managerNegotiation: latest ? summarizeNegotiation(latest) : undefined,
    interestedClubIds: [...interested],
    isOwnPlayer: ownerClubId === state.playerClubId,
    isLoanedIn: !!loan && loan.borrowingClubId === state.playerClubId,
  };
}
