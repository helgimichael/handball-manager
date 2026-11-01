// HM-ALPHA2-05A/05B: the two-stage negotiation against a real generated
// Handbollsligan career -- offers are answered by the daily processor on
// their response dates, rivals compete, deadlines expire -- plus the
// loan-ownership guards it relies on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { getCareerPlayer } from "../career/careerWorld";
import { renewPlayerContract } from "../career/contractRenewal";
import { cpuRecruiterClubIds } from "../career/cpuRecruitment";
import { addDays } from "../career/dateUtils";
import { getClubsByCompetition } from "../game-data";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { getClubEconomySnapshot } from "../economy/clubEconomyIntegration";
import { getPlayerContract } from "../economy/contractIntegration";
import {
  computeNegotiationWageDemand,
  progressTransferNegotiations,
  startTransferNegotiation,
  submitNegotiationFeeOffer,
  submitNegotiationTerms,
  withdrawTransferNegotiation,
} from "./negotiationIntegration";
import { getSellingClubAskingPriceEur, progressDailyTransfers, submitTransferOffer } from "./transferIntegration";
import { roundAskingFeeEur } from "./negotiation";
import { assessTransferAffordability } from "./affordability";
import type { CareerState } from "../career/types";
import type { RivalInterest, TransferNegotiation } from "./types";

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

function negotiation(state: CareerState, id: string): TransferNegotiation {
  return state.transferNegotiations![id];
}

/** Replaces the negotiation's rivals -- isolates the manager-only flow, or injects a controlled rival. */
function setRivals(state: CareerState, id: string, rivals: RivalInterest[]): CareerState {
  return { ...state, transferNegotiations: { ...state.transferNegotiations, [id]: { ...negotiation(state, id), rivals } } };
}

/** Runs the daily processor on the pending offer's response date and moves the career clock there. */
function answer(state: CareerState, id: string): CareerState {
  const date = negotiation(state, id).pending!.responseDate;
  return { ...progressTransferNegotiations(state, date).state, gameDate: date };
}

function startIsolated(seed: string) {
  const state = richBuyerState(seed);
  const { sellerClubId, player } = pickTarget(state);
  const started = ok(startTransferNegotiation(state, player.id));
  return { state: setRivals(started.state, started.negotiation.id, []), id: started.negotiation.id, sellerClubId, player };
}

test("offers are answered on their response date, not instantly; a second offer waits for the first answer", () => {
  const { state, id, player } = startIsolated("nego-pending");
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  const submitted = ok(submitNegotiationFeeOffer(state, id, Math.round(asking * 0.8)));
  const pending = submitted.negotiation.pending!;
  assert.equal(pending.party, "CLUB");
  assert.ok(pending.responseDate > state.gameDate && pending.responseDate <= addDays(state.gameDate, 3));
  assert.equal(submitted.negotiation.rounds.length, 0);
  assert.equal(submitNegotiationFeeOffer(submitted.state, id, asking).ok, false);

  const dayBefore = progressTransferNegotiations(submitted.state, addDays(pending.responseDate, -1)).state;
  assert.equal(negotiation(dayBefore, id).rounds.length, 0);

  const answered = answer(submitted.state, id);
  const n = negotiation(answered, id);
  assert.equal(n.rounds[0].response, "COUNTER");
  assert.equal(n.pending, undefined);
  assert.ok(n.expiresDate);
});

test("full two-stage negotiation across days completes once, charges once, and applies the promised role", () => {
  const { state: initial, id, sellerClubId, player } = startIsolated("nego-flow");
  let state = initial;
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  const sellerCashBefore = getClubEconomySnapshot(state, sellerClubId)!.cashEur;

  state = answer(ok(submitNegotiationFeeOffer(state, id, Math.round(asking * 0.8))).state, id);
  assert.equal(negotiation(state, id).rounds[0].counterFeeEur, roundAskingFeeEur(asking));
  const agreedFee = negotiation(state, id).rounds[0].counterFeeEur!;
  state = answer(ok(submitNegotiationFeeOffer(state, id, agreedFee)).state, id);
  assert.equal(negotiation(state, id).stage, "PLAYER");
  assert.equal(negotiation(state, id).agreedFeeEur, agreedFee);

  const terms = { contractYears: 3, promisedSquadRole: "KEY_PLAYER" as const };
  const demand = computeNegotiationWageDemand(state, negotiation(state, id), terms)!.demandEurPerMonth;
  state = answer(ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: Math.round(demand * 0.9) })).state, id);
  assert.equal(negotiation(state, id).rounds.at(-1)!.response, "COUNTER");

  const responseDate = ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: demand })).negotiation.pending!.responseDate;
  state = ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: demand })).state;
  const once = progressTransferNegotiations(state, responseDate).state;
  const twice = progressTransferNegotiations(once, responseDate).state;
  const n = negotiation(twice, id);
  assert.equal(n.stage, "COMPLETED");
  let after = twice;
  const offer = after.transferOffers[n.offerId!];
  if (offer.status === "AGREED_AWAITING_WINDOW") after = progressDailyTransfers(after, offer.scheduledCompletionDate!);
  assert.equal(getCareerPlayer(after, player.id)?.clubId, BUYER);
  assert.equal(getPlayerContract(after, player.id)!.wageEurPerMonth, demand);
  assert.equal(after.playerSquadStatus[player.id], "KEY_PLAYER");
  assert.equal(getClubEconomySnapshot(after, sellerClubId)!.cashEur, sellerCashBefore + agreedFee);
  assert.equal(Object.values(after.transferOffers).filter((o) => o.negotiationId === id).length, 1);
});

test("an unanswered counter expires after its deadline, and an expired offer can no longer be acted on", () => {
  const { state: initial, id, player } = startIsolated("nego-expiry");
  let state = initial;
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  state = answer(ok(submitNegotiationFeeOffer(state, id, Math.round(asking * 0.8))).state, id);
  const expiresDate = negotiation(state, id).expiresDate!;

  const late = { ...state, gameDate: addDays(expiresDate, 1) };
  assert.equal(submitNegotiationFeeOffer(late, id, asking * 2).ok, false);

  const onDeadline = progressTransferNegotiations(state, expiresDate).state;
  assert.equal(negotiation(onDeadline, id).stage, "CLUB");
  const expired = progressTransferNegotiations(state, addDays(expiresDate, 1));
  assert.equal(negotiation(expired.state, id).stage, "EXPIRED");
  assert.ok(expired.notices.some((n) => n.id.endsWith(":expired")));
});

function rivalClubId(state: CareerState, sellerClubId: string): string {
  return cpuRecruiterClubIds(state).find((id) => id !== sellerClubId && id !== BUYER)!;
}

test("a rival's higher fee raises the selling club's floor", () => {
  const { state: initial, id, sellerClubId, player } = startIsolated("nego-rival-fee");
  let state = initial;
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  const rivalFee = Math.round(asking * 1.3);
  state = setRivals(state, id, [{ clubId: rivalClubId(state, sellerClubId), feeEur: rivalFee, wageEurPerMonth: 1, contractYears: 3, role: "ROTATION", decisionDate: "2099-01-01", status: "ACTIVE" }]);
  state = answer(ok(submitNegotiationFeeOffer(state, id, Math.ceil(asking))).state, id);
  const round = negotiation(state, id).rounds[0];
  assert.equal(round.response, "COUNTER");
  assert.equal(round.counterFeeEur, roundAskingFeeEur(rivalFee));
});

test("a rival's better package raises the player's demand", () => {
  const { state: initial, id, sellerClubId, player } = startIsolated("nego-rival-wage");
  let state = initial;
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  state = answer(ok(submitNegotiationFeeOffer(state, id, Math.ceil(roundAskingFeeEur(asking)))).state, id);
  assert.equal(negotiation(state, id).stage, "PLAYER");
  const terms = { contractYears: 3, promisedSquadRole: "FIRST_CHOICE" as const };
  const demand = computeNegotiationWageDemand(state, negotiation(state, id), terms)!.demandEurPerMonth;
  // Rival offers a big wage but cannot meet the fee, so it never signs -- it only competes.
  state = setRivals(state, id, [{ clubId: rivalClubId(state, sellerClubId), feeEur: 0, wageEurPerMonth: demand * 3, contractYears: 3, role: "KEY_PLAYER", decisionDate: "2099-01-01", status: "ACTIVE" }]);
  state = answer(ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: demand })).state, id);
  const round = negotiation(state, id).rounds.at(-1)!;
  assert.notEqual(round.response, "ACCEPT");
  assert.equal(negotiation(state, id).stage, "PLAYER");
});

test("a rival can sign the player while talks are ongoing -- the negotiation is LOST and the manager pays nothing", () => {
  const { state: initial, id, sellerClubId, player } = startIsolated("nego-rival-sign");
  let state = initial;
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  const wage = getPlayerContract(state, player.id)!.wageEurPerMonth * 2;
  // Like a real rival (rankCandidates only returns affordable ones), it must be able to pay.
  const rival = cpuRecruiterClubIds(state).find((c) => c !== sellerClubId && assessTransferAffordability(state, c, Math.ceil(asking), 0, wage).affordable)!;
  assert.ok(rival, "no CPU club can afford the test rival package");
  const decisionDate = addDays(state.gameDate, 1);
  state = setRivals(state, id, [{ clubId: rival, feeEur: Math.ceil(asking), wageEurPerMonth: wage, contractYears: 3, role: "KEY_PLAYER", decisionDate, status: "ACTIVE" }]);
  const buyerCash = getClubEconomySnapshot(state, BUYER)!.cashEur;
  const result = progressTransferNegotiations(state, decisionDate);
  const n = negotiation(result.state, id);
  assert.equal(n.stage, "LOST");
  assert.equal(n.rivals![0].status, "SIGNED");
  const contract = getPlayerContract(result.state, player.id)!;
  assert.equal(contract.clubId, rival);
  assert.equal(getClubEconomySnapshot(result.state, BUYER)!.cashEur, buyerCash);
  assert.equal(startTransferNegotiation(result.state, player.id).ok, true); // a fresh approach would now be to the rival club
});

test("a player who signs elsewhere through the normal market ends the negotiation as LOST", () => {
  const { state: initial, id, sellerClubId, player } = startIsolated("nego-market");
  let state = initial;
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  const wage = getPlayerContract(state, player.id)!.wageEurPerMonth * 2;
  const rival = cpuRecruiterClubIds(state).find((c) => c !== sellerClubId && assessTransferAffordability(state, c, Math.ceil(asking * 2), 0, wage).affordable)!;
  const moved = submitTransferOffer(state, { dealType: "PERMANENT", playerId: player.id, toClubId: rival, transferFeeEur: Math.ceil(asking * 2), newWageEurPerMonth: wage, contractYears: 3 });
  assert.ok(moved.offer.status === "COMPLETED" || moved.offer.status === "AGREED_AWAITING_WINDOW", moved.offer.clubDecisionReason ?? moved.offer.playerDecisionReason);
  state = moved.state;
  const result = progressTransferNegotiations(state, addDays(state.gameDate, 1));
  assert.equal(negotiation(result.state, id).stage, "LOST");
});

test("rivals are found deterministically from the existing CPU recruitment logic", () => {
  const state = richBuyerState("nego-rivals");
  const sellerClubId = pickTarget(state).sellerClubId;
  const cpuClubs = new Set(cpuRecruiterClubIds(state));
  let found = 0;
  for (const player of state.worldSquads[sellerClubId]) {
    const a = ok(startTransferNegotiation(state, player.id)).negotiation.rivals!;
    const b = ok(startTransferNegotiation(state, player.id)).negotiation.rivals!;
    assert.deepEqual(a, b);
    for (const rival of a) {
      assert.ok(cpuClubs.has(rival.clubId) && rival.clubId !== sellerClubId);
      assert.ok(rival.decisionDate > state.gameDate);
    }
    found += a.length;
  }
  assert.ok(found > 0, "no CPU club showed interest in any player of the selling squad");
});

test("an insulting bid collapses talks and blocks a fresh approach for the cooldown", () => {
  const { state: initial, id, player } = startIsolated("nego-insult");
  let state = initial;
  const asking = getSellingClubAskingPriceEur(state, player.id)!;
  state = answer(ok(submitNegotiationFeeOffer(state, id, Math.round(asking * 0.3))).state, id);
  assert.equal(negotiation(state, id).stage, "COLLAPSED");
  assert.equal(startTransferNegotiation(state, player.id).ok, false);
});

test("a fee beyond the transfer budget is refused without becoming a pending offer", () => {
  const { state, id } = startIsolated("nego-budget");
  assert.equal(submitNegotiationFeeOffer(state, id, 1_000_000_000).ok, false);
});

test("withdrawing closes the negotiation (even with an offer pending) without a cooldown", () => {
  const { state, id, player } = startIsolated("nego-withdraw");
  const pending = ok(submitNegotiationFeeOffer(state, id, 1000)).state;
  const withdrawn = ok(withdrawTransferNegotiation(pending, id));
  assert.equal(withdrawn.negotiation.stage, "WITHDRAWN");
  assert.equal(withdrawn.negotiation.pending, undefined);
  assert.equal(negotiation(progressTransferNegotiations(withdrawn.state, "2099-01-01").state, id).stage, "WITHDRAWN");
  assert.equal(startTransferNegotiation(withdrawn.state, player.id).ok, true);
});

test("a pre-05A save without transferNegotiations still starts a negotiation, and a 05A negotiation without the new fields still progresses", () => {
  const state = richBuyerState("nego-legacy");
  const { player } = pickTarget(state);
  const legacy = { ...state } as CareerState;
  delete legacy.transferNegotiations;
  assert.equal(startTransferNegotiation(legacy, player.id).ok, true);
  assert.equal(progressTransferNegotiations(legacy, "2026-09-01").notices.length, 0);

  const started = ok(startTransferNegotiation(state, player.id));
  const { rivals: _rivals, ...old05a } = started.negotiation;
  void _rivals;
  const oldState = { ...started.state, transferNegotiations: { [old05a.id]: old05a } };
  assert.equal(ok(submitNegotiationFeeOffer(oldState, old05a.id, 1000)).negotiation.pending?.party, "CLUB");
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
