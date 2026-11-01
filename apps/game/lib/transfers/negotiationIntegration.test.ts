// HM-ALPHA2-05A: the two-stage negotiation against a real generated
// Handbollsligan career, plus the loan-ownership guards it relies on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { getCareerPlayer } from "../career/careerWorld";
import { renewPlayerContract } from "../career/contractRenewal";
import { getClubsByCompetition } from "../game-data";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { getClubEconomySnapshot } from "../economy/clubEconomyIntegration";
import { getPlayerContract } from "../economy/contractIntegration";
import { computeNegotiationWageDemand, startTransferNegotiation, submitNegotiationFeeOffer, submitNegotiationTerms, withdrawTransferNegotiation } from "./negotiationIntegration";
import { getSellingClubAskingPriceEur, progressDailyTransfers, submitTransferOffer } from "./transferIntegration";
import { roundAskingFeeEur } from "./negotiation";
import type { CareerState } from "../career/types";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";
const BUYER = "se_club_ov_helsingborg";

function richBuyerState(seed: string): CareerState {
  return createNewCareerState(seed, BUYER, snapshotWorldSquads(HANDBOLLSLIGAN_ID), {}, snapshotGameplayRatings(HANDBOLLSLIGAN_ID));
}

function pickTarget(state: CareerState) {
  const sellerClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== BUYER && (state.worldSquads[c.id]?.length ?? 0) > 3)!.id;
  return { sellerClubId, player: state.worldSquads[sellerClubId][0] };
}

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.ok(result.ok, "error" in result ? String((result as { error?: string }).error) : "");
  return result as Extract<T, { ok: true }>;
}

test("full two-stage negotiation: counter, revised fee, player counter, revised wage, completed transfer with promised role", () => {
  let state = richBuyerState("nego-1");
  const { sellerClubId, player } = pickTarget(state);
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  const sellerCashBefore = getClubEconomySnapshot(state, sellerClubId)!.cashEur;

  const started = ok(startTransferNegotiation(state, player.id));
  assert.equal(started.negotiation.stage, "CLUB");
  state = started.state;
  const id = started.negotiation.id;

  const first = ok(submitNegotiationFeeOffer(state, id, Math.round(asking * 0.8)));
  assert.equal(first.negotiation.stage, "CLUB");
  assert.equal(first.negotiation.rounds[0].response, "COUNTER");
  assert.equal(first.negotiation.rounds[0].counterFeeEur, roundAskingFeeEur(asking));
  state = first.state;

  const agreedFee = first.negotiation.rounds[0].counterFeeEur!;
  const second = ok(submitNegotiationFeeOffer(state, id, agreedFee));
  assert.equal(second.negotiation.stage, "PLAYER");
  assert.equal(second.negotiation.agreedFeeEur, agreedFee);
  state = second.state;

  const terms = { contractYears: 3, promisedSquadRole: "KEY_PLAYER" as const };
  const demand = computeNegotiationWageDemand(state, second.negotiation, terms)!.demandEurPerMonth;
  const low = ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: Math.round(demand * 0.9) }));
  assert.equal(low.negotiation.rounds.at(-1)!.response, "COUNTER");
  assert.equal(low.negotiation.stage, "PLAYER");
  state = low.state;

  const done = ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: demand }));
  assert.equal(done.negotiation.stage, "COMPLETED");
  assert.ok(done.offer);
  let after = done.state;
  if (done.offer!.status === "AGREED_AWAITING_WINDOW") after = progressDailyTransfers(after, done.offer!.scheduledCompletionDate!);
  assert.equal(after.transferOffers[done.offer!.id].status === "COMPLETED" || done.offer!.status === "COMPLETED", true);
  assert.equal(getCareerPlayer(after, player.id)?.clubId, BUYER);
  assert.equal(getPlayerContract(after, player.id)!.wageEurPerMonth, demand);
  assert.equal(after.playerSquadStatus[player.id], "KEY_PLAYER");
  assert.equal(getClubEconomySnapshot(after, sellerClubId)!.cashEur, sellerCashBefore + agreedFee);
  assert.equal(after.transferOffers[done.offer!.id].negotiationId, id);
});

test("an insulting bid collapses talks and blocks a fresh approach for the cooldown", () => {
  let state = richBuyerState("nego-2");
  const { player } = pickTarget(state);
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  const started = ok(startTransferNegotiation(state, player.id));
  const result = ok(submitNegotiationFeeOffer(started.state, started.negotiation.id, Math.round(asking * 0.3)));
  assert.equal(result.negotiation.stage, "COLLAPSED");
  state = result.state;
  const retry = startTransferNegotiation(state, player.id);
  assert.equal(retry.ok, false);
});

test("a fee beyond the transfer budget is refused without using a round", () => {
  const state = richBuyerState("nego-3");
  const { player } = pickTarget(state);
  const started = ok(startTransferNegotiation(state, player.id));
  const result = submitNegotiationFeeOffer(started.state, started.negotiation.id, 1_000_000_000);
  assert.equal(result.ok, false);
});

test("withdrawing closes the negotiation without a cooldown", () => {
  const state = richBuyerState("nego-4");
  const { player } = pickTarget(state);
  const started = ok(startTransferNegotiation(state, player.id));
  const withdrawn = ok(withdrawTransferNegotiation(started.state, started.negotiation.id));
  assert.equal(withdrawn.negotiation.stage, "WITHDRAWN");
  assert.equal(startTransferNegotiation(withdrawn.state, player.id).ok, true);
});

test("a pre-05A save without transferNegotiations still starts a negotiation", () => {
  const state = richBuyerState("nego-5");
  const { player } = pickTarget(state);
  const legacy = { ...state } as CareerState;
  delete legacy.transferNegotiations;
  assert.equal(startTransferNegotiation(legacy, player.id).ok, true);
});

test("loans: a loaned player cannot be bid for, renewed by the borrower, or loaned past contract end; return keeps the agreed-wage flag", () => {
  const state = richBuyerState("nego-loan");
  const { sellerClubId } = pickTarget(state);
  // A depth player the parent club is willing to loan out.
  const player = [...state.worldSquads[sellerClubId]].reverse().find((p) => {
    const c = getPlayerContract(state, p.id);
    return c && submitTransferOffer(state, { dealType: "LOAN", playerId: p.id, toClubId: BUYER, transferFeeEur: 0, newWageEurPerMonth: c.wageEurPerMonth, loanTerms: { endDate: c.contractEndDate, wageShareBorrowingPct: 100 } }).offer.status === "COMPLETED";
  })!;
  assert.ok(player, "no loanable depth player found");
  const contract = getPlayerContract(state, player.id)!;
  const pastContract = submitTransferOffer(state, { dealType: "LOAN", playerId: player.id, toClubId: BUYER, transferFeeEur: 0, newWageEurPerMonth: contract.wageEurPerMonth, loanTerms: { endDate: "2099-01-01", wageShareBorrowingPct: 100 } });
  assert.equal(pastContract.offer.status, "REJECTED_BY_CLUB");

  // Force a loan through the execution layer to test the guards around it.
  const loanedState: CareerState = { ...state, playerContracts: { ...state.playerContracts, [player.id]: { ...contract, wageAgreed: true } } };
  const endDate = contract.contractEndDate < "2026-12-31" ? contract.contractEndDate : "2026-12-31";
  const loan = submitTransferOffer(loanedState, { dealType: "LOAN", playerId: player.id, toClubId: BUYER, transferFeeEur: 0, newWageEurPerMonth: contract.wageEurPerMonth, loanTerms: { endDate, wageShareBorrowingPct: 100 } });
  assert.equal(loan.offer.status, "COMPLETED", loan.offer.clubDecisionReason ?? loan.offer.playerDecisionReason);

  assert.equal(startTransferNegotiation(loan.state, player.id).ok, false);
  assert.equal(submitTransferOffer(loan.state, { dealType: "PERMANENT", playerId: player.id, toClubId: BUYER, transferFeeEur: 1e6, newWageEurPerMonth: 1 }).offer.status, "BLOCKED_PENDING_TRANSFER");
  assert.throws(() => renewPlayerContract(loan.state, player.id, 3, contract.wageEurPerMonth));

  const returned = progressDailyTransfers(loan.state, endDate);
  const restored = getPlayerContract(returned, player.id)!;
  assert.equal(restored.clubId, sellerClubId);
  assert.equal(restored.wageAgreed, true);
});
