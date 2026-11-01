// HM-ALPHA2-05A: CareerState glue for the two-stage negotiation -- the
// pure rules live in negotiation.ts, execution reuses
// transferIntegration.ts's own resolveTransferOffer (same guards, same
// window gating, same cash/contract/squad moves). Only the manager's
// PERMANENT signings go through here; CPU recruitment and loans keep
// the existing one-shot submitTransferOffer.
import type { CareerState } from "../career/types";
import { getCareerPlayer } from "../career/careerWorld";
import { getCareerPlayerRating } from "../career/careerRatingNormalization";
import { addDays, isBefore } from "../career/dateUtils";
import type { SquadStatusTier } from "../career/squadStatus";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getClubBudgets, getClubFinancialHealth } from "../economy/clubEconomyIntegration";
import { getPlayerContract, getPlayerContractStatus, getPlayerFairWageEurPerMonth } from "../economy/contractIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import { assessTransferAffordability } from "./affordability";
import {
  NEGOTIATION_COOLDOWN_DAYS,
  computePlayerWageDemand,
  evaluateClubFeeRound,
  evaluatePlayerTermsRound,
  expectedRoleFromSquadRank,
  type PlayerWageDemand,
} from "./negotiation";
import { competitionTierForClub } from "./transferExecution";
import { getActiveLoanForPlayer, getSellingClubAskingPriceEur, hasActivePendingTransfer, resolveTransferOffer } from "./transferIntegration";
import type { NegotiationRound, TransferNegotiation, TransferOffer } from "./types";

export type NegotiationActionResult =
  | { ok: true; state: CareerState; negotiation: TransferNegotiation; offer?: TransferOffer }
  | { ok: false; error: string };

const OPEN_STAGES = new Set<TransferNegotiation["stage"]>(["CLUB", "PLAYER"]);

export function getTransferNegotiations(state: CareerState): TransferNegotiation[] {
  return Object.values(state.transferNegotiations ?? {});
}

/** The one open (CLUB/PLAYER stage) negotiation for this player/buyer, if any. */
export function getOpenNegotiation(state: CareerState, playerId: string, toClubId: string): TransferNegotiation | undefined {
  return getTransferNegotiations(state).find((n) => n.playerId === playerId && n.toClubId === toClubId && OPEN_STAGES.has(n.stage));
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

export function startTransferNegotiation(state: CareerState, playerId: string): NegotiationActionResult {
  const toClubId = state.playerClubId;
  const player = getCareerPlayer(state, playerId);
  const contract = getPlayerContract(state, playerId);
  if (!player || !contract) return { ok: false, error: "Spelaren kunde inte hittas." };
  if (contract.clubId === toClubId) return { ok: false, error: "Spelaren tillhör redan din klubb." };
  if (getActiveLoanForPlayer(state, playerId)) return { ok: false, error: "Spelaren är utlånad -- moderklubben förhandlar inte under låneperioden." };
  if (hasActivePendingTransfer(state, playerId)) return { ok: false, error: "Spelaren har redan en överenskommen affär som väntar på transferfönstret." };

  const existing = getOpenNegotiation(state, playerId, toClubId);
  if (existing) return { ok: true, state, negotiation: existing };

  const blocked = getTransferNegotiations(state).find((n) => n.playerId === playerId && n.toClubId === toClubId && n.closedUntil && isBefore(state.gameDate, n.closedUntil));
  if (blocked) return { ok: false, error: `Samtalen bröts nyligen. Ny kontakt tidigast ${blocked.closedUntil}.` };

  const isFreeAgent = getPlayerContractStatus(state, playerId) === "FREE_AGENT";
  const negotiation: TransferNegotiation = {
    id: `negotiation-${playerId}-${toClubId}-${state.gameDate}-${getTransferNegotiations(state).length}`,
    playerId,
    fromClubId: isFreeAgent ? "" : contract.clubId,
    toClubId,
    stage: isFreeAgent ? "PLAYER" : "CLUB",
    startedDate: state.gameDate,
    updatedDate: state.gameDate,
    ...(isFreeAgent ? { agreedFeeEur: 0 } : {}),
    rounds: [],
  };
  return { ok: true, state: saveNegotiation(state, negotiation), negotiation };
}

function getNegotiation(state: CareerState, negotiationId: string, stage: TransferNegotiation["stage"]): TransferNegotiation | string {
  const negotiation = state.transferNegotiations?.[negotiationId];
  if (!negotiation) return "Förhandlingen finns inte.";
  if (negotiation.stage !== stage) return "Förhandlingen är inte i det steget.";
  // The world may have moved on since the last round -- never negotiate for a player who already left the selling club.
  const contract = getPlayerContract(state, negotiation.playerId);
  if (!contract || (negotiation.fromClubId !== "" && contract.clubId !== negotiation.fromClubId)) return "Spelaren har bytt klubb sedan förhandlingen började.";
  return negotiation;
}

function trainingCompensationEur(state: CareerState, playerId: string): number {
  return getPlayerTrainingCompensation(state, playerId)?.totalEur ?? 0;
}

/** Stage 1: a fee bid to the selling club. */
export function submitNegotiationFeeOffer(state: CareerState, negotiationId: string, offeredFeeEur: number): NegotiationActionResult {
  const found = getNegotiation(state, negotiationId, "CLUB");
  if (typeof found === "string") return { ok: false, error: found };
  const negotiation = found;
  const fee = Math.max(0, Math.round(offeredFeeEur));

  // Only the transfer budget is checked here -- the wage is not on the table yet.
  const budgets = getClubBudgets(state, negotiation.toClubId);
  const totalCost = fee + trainingCompensationEur(state, negotiation.playerId);
  if (!budgets || totalCost > budgets.transferBudgetEur) {
    return { ok: false, error: `Total övergångskostnad (${totalCost} €) överstiger transferbudgeten (${Math.round(budgets?.transferBudgetEur ?? 0)} €).` };
  }

  const askingFeeEur = getSellingClubAskingPriceEur(state, negotiation.playerId) ?? 0;
  const result = evaluateClubFeeRound({ askingFeeEur, offeredFeeEur: fee, round: roundCount(negotiation, "CLUB") + 1, previousOfferEur: lastRound(negotiation, "CLUB")?.offeredFeeEur });
  const round: NegotiationRound = { date: state.gameDate, party: "CLUB", offeredFeeEur: fee, response: result.response, reason: result.reason, ...(result.counterFeeEur !== undefined ? { counterFeeEur: result.counterFeeEur } : {}) };

  const next: TransferNegotiation = { ...negotiation, updatedDate: state.gameDate, rounds: [...negotiation.rounds, round] };
  if (result.response === "ACCEPT") Object.assign(next, { stage: "PLAYER", agreedFeeEur: fee });
  if (result.response === "BREAK_OFF") Object.assign(next, { stage: "COLLAPSED", closedUntil: addDays(state.gameDate, NEGOTIATION_COOLDOWN_DAYS) });
  return { ok: true, state: saveNegotiation(state, next), negotiation: next };
}

/** Where the player's ability ranks in the buying club's squad, as the role they expect there. */
function expectedRoleAtBuyer(state: CareerState, playerId: string, toClubId: string): SquadStatusTier {
  const player = getCareerPlayer(state, playerId)!;
  const ca = getCareerPlayerRating(state, playerId, player.clubId)?.ca ?? player.currentAbility;
  const rank = (state.gameplayRatings[toClubId] ?? []).filter((r) => r.playerId !== playerId && r.ca > ca).length;
  return expectedRoleFromSquadRank(rank, playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate));
}

export interface PlayerTermsOffer {
  wageEurPerMonth: number;
  contractYears: number;
  promisedSquadRole: SquadStatusTier;
}

/** The player's demand for these exact terms -- what the next round will be judged against. */
export function computeNegotiationWageDemand(state: CareerState, negotiation: TransferNegotiation, terms: Pick<PlayerTermsOffer, "contractYears" | "promisedSquadRole">): PlayerWageDemand | undefined {
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
    newClubTier: competitionTierForClub(negotiation.toClubId),
    currentSquadStatus: player.squadStatus,
    currentClubPressure: isFreeAgent ? "NONE" : getClubFinancialHealth(state, negotiation.fromClubId)?.pressure ?? "NONE",
    expectedRole: expectedRoleAtBuyer(state, player.id, negotiation.toClubId),
    promisedRole: terms.promisedSquadRole,
    contractYears: terms.contractYears,
  });
}

/**
 * Stage 2: personal terms. Acceptance executes the deal through
 * resolveTransferOffer with the agreed fee -- immediately in an open
 * window, otherwise AGREED_AWAITING_WINDOW exactly like any other deal.
 */
export function submitNegotiationTerms(state: CareerState, negotiationId: string, terms: PlayerTermsOffer): NegotiationActionResult {
  const found = getNegotiation(state, negotiationId, "PLAYER");
  if (typeof found === "string") return { ok: false, error: found };
  const negotiation = found;
  if (!Number.isInteger(terms.contractYears) || terms.contractYears < 1 || terms.contractYears > 5) return { ok: false, error: "Välj en kontraktslängd på 1-5 år." };
  const wage = Math.max(0, Math.round(terms.wageEurPerMonth));
  const fee = negotiation.agreedFeeEur ?? 0;

  const affordability = assessTransferAffordability(state, negotiation.toClubId, fee, trainingCompensationEur(state, negotiation.playerId), wage);
  if (!affordability.affordable) return { ok: false, error: affordability.reasons.join(" ") };

  const demand = computeNegotiationWageDemand(state, negotiation, terms);
  if (!demand) return { ok: false, error: "Spelaren kunde inte hittas." };
  const result = evaluatePlayerTermsRound({ demand, offeredWageEurPerMonth: wage, round: roundCount(negotiation, "PLAYER") + 1 });
  const round: NegotiationRound = {
    date: state.gameDate,
    party: "PLAYER",
    offeredWageEurPerMonth: wage,
    contractYears: terms.contractYears,
    promisedSquadRole: terms.promisedSquadRole,
    response: result.response,
    reason: [result.reason, ...demand.factors].join(" "),
    ...(result.counterWageEurPerMonth !== undefined ? { counterWageEurPerMonth: result.counterWageEurPerMonth } : {}),
  };
  let next: TransferNegotiation = { ...negotiation, updatedDate: state.gameDate, rounds: [...negotiation.rounds, round] };

  if (result.response === "BREAK_OFF") {
    // The club's fee agreement lapses with the player's interest.
    next = { ...next, stage: "COLLAPSED", closedUntil: addDays(state.gameDate, NEGOTIATION_COOLDOWN_DAYS) };
    return { ok: true, state: saveNegotiation(state, next), negotiation: next };
  }
  if (result.response !== "ACCEPT") return { ok: true, state: saveNegotiation(state, next), negotiation: next };

  const clubRound = lastRound(negotiation, "CLUB");
  const resolved = resolveTransferOffer(
    state,
    { dealType: "PERMANENT", playerId: negotiation.playerId, toClubId: negotiation.toClubId, transferFeeEur: fee, newWageEurPerMonth: wage, contractYears: terms.contractYears, promisedSquadRole: terms.promisedSquadRole },
    { negotiationId: negotiation.id, clubReason: clubRound?.reason ?? "Kontraktslös spelare -- ingen klubb att förhandla med.", playerReason: result.reason },
  );
  const executed = resolved.offer.status === "COMPLETED" || resolved.offer.status === "AGREED_AWAITING_WINDOW";
  next = executed
    ? { ...next, stage: "COMPLETED", offerId: resolved.offer.id }
    : { ...next, stage: "COLLAPSED", offerId: resolved.offer.id, rounds: [...next.rounds.slice(0, -1), { ...round, reason: `${round.reason} Affären kunde ändå inte genomföras: ${resolved.offer.clubDecisionReason ?? ""}`.trim() }] };
  return { ok: true, state: saveNegotiation(resolved.state, next), negotiation: next, offer: resolved.offer };
}

/** One dispatch point for the UI's CareerContext action. */
export type NegotiationAction =
  | { kind: "START"; playerId: string }
  | { kind: "FEE"; negotiationId: string; feeEur: number }
  | { kind: "TERMS"; negotiationId: string; terms: PlayerTermsOffer }
  | { kind: "WITHDRAW"; negotiationId: string };

export function runNegotiationAction(state: CareerState, action: NegotiationAction): NegotiationActionResult {
  switch (action.kind) {
    case "START":
      return startTransferNegotiation(state, action.playerId);
    case "FEE":
      return submitNegotiationFeeOffer(state, action.negotiationId, action.feeEur);
    case "TERMS":
      return submitNegotiationTerms(state, action.negotiationId, action.terms);
    case "WITHDRAW":
      return withdrawTransferNegotiation(state, action.negotiationId);
  }
}

/** The manager walks away -- no cooldown, but any agreed fee is lost. */
export function withdrawTransferNegotiation(state: CareerState, negotiationId: string): NegotiationActionResult {
  const negotiation = state.transferNegotiations?.[negotiationId];
  if (!negotiation || !OPEN_STAGES.has(negotiation.stage)) return { ok: false, error: "Förhandlingen är redan avslutad." };
  const next: TransferNegotiation = { ...negotiation, stage: "WITHDRAWN", updatedDate: state.gameDate };
  return { ok: true, state: saveNegotiation(state, next), negotiation: next };
}
