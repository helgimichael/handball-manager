// HM-ALPHA2-05C: loans separate contract OWNERSHIP (PlayerContract.clubId,
// unchanged for the whole loan) from the PLAYING club (squad membership,
// LoanRecord.borrowingClubId) -- proven against a real generated
// Handbollsligan career, through the negotiation and daily-tick paths.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { migrateCareerState } from "../career/saveMigration";
import { getCareerPlayer } from "../career/careerWorld";
import { renewPlayerContract } from "../career/contractRenewal";
import { progressCpuContractDecisions } from "../career/cpuContractDecisions";
import { addDays } from "../career/dateUtils";
import { getClubsByCompetition } from "../game-data";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { getClubEconomySnapshot, getClubPlayerWageCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { getPlayerContract } from "../economy/contractIntegration";
import { computeRequiredLoanWageSharePct, evaluateLoanOutDecision } from "./clubDecision";
import { evaluateLoanPlayerRound, evaluateLoanShareRound, roundAskingFeeEur } from "./negotiation";
import { computeNegotiationWageDemand, progressTransferNegotiations, startTransferNegotiation, submitNegotiationFeeOffer, submitNegotiationLoanOffer, submitNegotiationTerms } from "./negotiationIntegration";
import { getActiveLoanForPlayer, getRequiredLoanWageSharePct, getSellingClubAskingPriceEur, progressDailyTransfers, submitTransferOffer } from "./transferIntegration";
import { assessTransferAffordability } from "./affordability";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import { migrateLegacyLoanContracts } from "./transferExecution";
import type { CareerState } from "../career/types";
import type { LoanRecord } from "./types";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";
const MANAGER = "se_club_ov_helsingborg";

function careerState(seed: string): CareerState {
  return createNewCareerState(seed, MANAGER, snapshotWorldSquads(HANDBOLLSLIGAN_ID), {}, snapshotGameplayRatings(HANDBOLLSLIGAN_ID));
}

function otherClubs(state: CareerState): string[] {
  return getClubsByCompetition(HANDBOLLSLIGAN_ID).map((c) => c.id).filter((id) => id !== MANAGER && (state.worldSquads[id]?.length ?? 0) > 3);
}

/** A player whose owning club is willing to lend him (required share known), from a club other than the manager's. */
function lendablePlayer(state: CareerState) {
  for (const ownerClubId of otherClubs(state)) {
    for (const player of [...state.worldSquads[ownerClubId]].reverse()) {
      const required = getRequiredLoanWageSharePct(state, player.id);
      if (typeof required === "number" && getPlayerContract(state, player.id)!.contractEndDate > addDays(state.gameDate, 60)) return { ownerClubId, player, required };
    }
  }
  throw new Error("no lendable player in the generated world");
}

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.ok(result.ok, "error" in result ? String((result as { error?: string }).error) : "");
  return result as Extract<T, { ok: true }>;
}

function answer(state: CareerState, id: string): CareerState {
  const date = state.transferNegotiations![id].pending!.responseDate;
  return { ...progressTransferNegotiations(state, date).state, gameDate: date };
}

test("the required loan share is exactly evaluateLoanOutDecision's threshold", () => {
  for (const role of ["KEY_PLAYER", "STARTER", "ROTATION", "SPECIALIST", "DEVELOPMENT"] as const) {
    for (const financialPressure of ["NONE", "PRESSURED", "CRITICAL"] as const) {
      for (const hasAdequateReplacement of [false, true]) {
        const required = computeRequiredLoanWageSharePct({ role, financialPressure, hasAdequateReplacement });
        if (required === null) {
          assert.equal(evaluateLoanOutDecision({ role, financialPressure, hasAdequateReplacement, wageShareBorrowingPct: 100 }).accept, false);
          continue;
        }
        assert.equal(evaluateLoanOutDecision({ role, financialPressure, hasAdequateReplacement, wageShareBorrowingPct: required }).accept, true);
        if (required > 0) assert.equal(evaluateLoanOutDecision({ role, financialPressure, hasAdequateReplacement, wageShareBorrowingPct: required - 5 }).accept, false);
      }
    }
  }
});

test("loan rounds: owner accepts at its required share, counters below it, refuses a player it needs; player wants a fair role", () => {
  assert.equal(evaluateLoanShareRound({ requiredSharePct: 40, offeredSharePct: 40, round: 1 }).response, "ACCEPT");
  assert.equal(evaluateLoanShareRound({ requiredSharePct: 40, offeredSharePct: 20, round: 1 }).response, "COUNTER");
  assert.equal(evaluateLoanShareRound({ requiredSharePct: null, offeredSharePct: 100, round: 1 }).response, "BREAK_OFF");
  assert.equal(evaluateLoanPlayerRound({ expectedRole: "FIRST_CHOICE", promisedRole: "ROTATION", round: 1 }).response, "ACCEPT");
  assert.equal(evaluateLoanPlayerRound({ expectedRole: "FIRST_CHOICE", promisedRole: "SQUAD_PLAYER", round: 1 }).response, "COUNTER");
  assert.equal(evaluateLoanPlayerRound({ expectedRole: "KEY_PLAYER", promisedRole: "TALENT", round: 1 }).response, "REJECT");
});

test("complete loan lifecycle: negotiated agreement -> plays for the borrower while the owner keeps the contract -> expiry -> returns to the owner", () => {
  let state = careerState("loan-lifecycle");
  const { ownerClubId, player, required } = lendablePlayer(state);
  const contractBefore = getPlayerContract(state, player.id)!;
  const managerWagesBefore = getClubPlayerWageCostsEurAnnual(state, MANAGER);
  const ownerWagesBefore = getClubPlayerWageCostsEurAnnual(state, ownerClubId);
  const endDate = [contractBefore.contractEndDate, addDays(state.gameDate, 120)].sort()[0];

  // Agreement: owner first (a low share gets its required share as counter), then the player.
  const started = ok(startTransferNegotiation(state, player.id, "LOAN"));
  const id = started.negotiation.id;
  assert.equal(started.negotiation.fromClubId, ownerClubId);
  assert.deepEqual(started.negotiation.rivals, []);
  state = started.state;
  if (required > 0) {
    state = answer(ok(submitNegotiationLoanOffer(state, id, { wageSharePct: Math.max(0, required - 5), endDate })).state, id);
    assert.equal(state.transferNegotiations![id].rounds.at(-1)!.response, "COUNTER");
    assert.equal(state.transferNegotiations![id].rounds.at(-1)!.counterWageSharePct, required);
  }
  state = answer(ok(submitNegotiationLoanOffer(state, id, { wageSharePct: required, endDate })).state, id);
  assert.equal(state.transferNegotiations![id].stage, "PLAYER");
  state = answer(ok(submitNegotiationTerms(state, id, { wageEurPerMonth: 0, contractYears: 1, promisedSquadRole: "KEY_PLAYER" })).state, id);
  const negotiation = state.transferNegotiations![id];
  assert.equal(negotiation.stage, "COMPLETED");

  // During the loan: playing club = borrower, owner = contract club, wage split by the share.
  assert.equal(getCareerPlayer(state, player.id)?.clubId, MANAGER);
  assert.deepEqual(getPlayerContract(state, player.id), contractBefore);
  const loan = getActiveLoanForPlayer(state, player.id)!;
  assert.equal(loan.parentClubId, ownerClubId);
  assert.equal(loan.borrowingClubId, MANAGER);
  assert.equal(loan.endDate, endDate);
  assert.equal(loan.wageShareBorrowingPct, required);
  const annualWage = contractBefore.wageEurPerMonth * 12;
  assert.ok(Math.abs(getClubPlayerWageCostsEurAnnual(state, MANAGER) - managerWagesBefore - annualWage * (required / 100)) < 1e-6);
  assert.ok(Math.abs(ownerWagesBefore - getClubPlayerWageCostsEurAnnual(state, ownerClubId) - annualWage * (required / 100)) < 1e-6);
  assert.equal(state.playerSquadStatus[player.id], "KEY_PLAYER");
  assert.throws(() => renewPlayerContract(state, player.id, 3), /inlånad/);

  // Day before expiry nothing changes; on the end date he returns to the owner.
  assert.equal(getCareerPlayer(progressDailyTransfers(state, addDays(endDate, -1)), player.id)?.clubId, MANAGER);
  const returned = progressDailyTransfers(state, endDate);
  assert.equal(getCareerPlayer(returned, player.id)?.clubId, ownerClubId);
  assert.deepEqual(getPlayerContract(returned, player.id), contractBefore);
  assert.equal(getActiveLoanForPlayer(returned, player.id), undefined);
  assert.equal(getClubPlayerWageCostsEurAnnual(returned, MANAGER), managerWagesBefore);
  assert.equal(getClubPlayerWageCostsEurAnnual(returned, ownerClubId), ownerWagesBefore);
});

test("the owning club may renew a player it has loaned out; a CPU borrower never renews a loaned-in contract", () => {
  const state = careerState("loan-owner-renew");
  const borrower = otherClubs(state)[0];
  const own = state.worldSquads[MANAGER] ?? [];
  const loanedOut = own.map((p) => {
    const c = getPlayerContract(state, p.id)!;
    return { p, result: submitTransferOffer(state, { dealType: "LOAN", playerId: p.id, toClubId: borrower, transferFeeEur: 0, newWageEurPerMonth: c.wageEurPerMonth, loanTerms: { endDate: c.contractEndDate, wageShareBorrowingPct: 100 } }) };
  }).find((x) => x.result.offer.status === "COMPLETED");
  assert.ok(loanedOut, "no manager player could be loaned out");
  const { p, result } = loanedOut;
  assert.equal(getCareerPlayer(result.state, p.id)?.clubId, borrower);
  assert.equal(getPlayerContract(result.state, p.id)!.clubId, MANAGER);

  const renewed = renewPlayerContract(result.state, p.id, 3);
  assert.ok(getPlayerContract(renewed, p.id)!.contractEndDate > getPlayerContract(result.state, p.id)!.contractEndDate);
  assert.equal(getPlayerContract(renewed, p.id)!.clubId, MANAGER);

  // Expiring contract, player at the CPU borrower: the borrower's contract decisions skip him.
  const expiringDate = addDays(result.state.gameDate, 100);
  const expiring = { ...result.state, playerContracts: { ...result.state.playerContracts, [p.id]: { ...getPlayerContract(result.state, p.id)!, contractEndDate: expiringDate } } };
  const after = progressCpuContractDecisions(expiring, expiring.gameDate, [borrower]).state;
  assert.deepEqual(getPlayerContract(after, p.id), getPlayerContract(expiring, p.id));
});

/** Loans a lendable player to the manager through the (deterministic) loan negotiation. */
function loanToManager(seed: string) {
  let state = careerState(seed);
  const { ownerClubId, player, required } = lendablePlayer(state);
  const contract = getPlayerContract(state, player.id)!;
  const endDate = [contract.contractEndDate, addDays(state.gameDate, 90)].sort()[0];
  const started = ok(startTransferNegotiation(state, player.id, "LOAN"));
  const id = started.negotiation.id;
  state = answer(ok(submitNegotiationLoanOffer(started.state, id, { wageSharePct: required, endDate })).state, id);
  state = answer(ok(submitNegotiationTerms(state, id, { wageEurPerMonth: 0, contractYears: 1, promisedSquadRole: "KEY_PLAYER" })).state, id);
  assert.equal(state.transferNegotiations![id].stage, "COMPLETED");
  return { state, ownerClubId, player, endDate };
}

test("a permanent bid for a loaned player is made to the OWNER; a third club takes him when the loan ends", () => {
  const { state, ownerClubId, player, endDate } = loanToManager("loan-third-party");
  const fee = Math.ceil((getSellingClubAskingPriceEur(state, player.id) ?? 0) * 1.5);
  const wage = getPlayerContract(state, player.id)!.wageEurPerMonth * 2;
  const buyer = otherClubs(state).find((c) => c !== ownerClubId && assessTransferAffordability(state, c, fee, getPlayerTrainingCompensation(state, player.id)?.totalEur ?? 0, wage).affordable)!;
  assert.ok(buyer, "no CPU club can afford the test bid");
  const ownerCash = getClubEconomySnapshot(state, ownerClubId)!.cashEur;
  const sale = submitTransferOffer(state, { dealType: "PERMANENT", playerId: player.id, toClubId: buyer, transferFeeEur: fee, newWageEurPerMonth: wage, contractYears: 3 });
  assert.equal(sale.offer.fromClubId, ownerClubId);
  assert.equal(sale.offer.status, "AGREED_AWAITING_WINDOW");
  assert.ok(sale.offer.scheduledCompletionDate! >= endDate);
  assert.equal(getCareerPlayer(sale.state, player.id)?.clubId, MANAGER, "he keeps playing for the borrower until the loan ends");

  const done = progressDailyTransfers(sale.state, sale.offer.scheduledCompletionDate!);
  assert.equal(done.transferOffers[sale.offer.id].status, "COMPLETED");
  assert.equal(getCareerPlayer(done, player.id)?.clubId, buyer);
  assert.equal(getPlayerContract(done, player.id)!.clubId, buyer);
  assert.equal(getActiveLoanForPlayer(done, player.id), undefined);
  assert.ok(getClubEconomySnapshot(done, ownerClubId)!.cashEur > ownerCash, "the fee is paid to the owner, not the borrower");
});

test("the borrowing manager can negotiate a permanent move with the owner; agreement ends the loan and makes the manager the owner", () => {
  const { state: loanedState, ownerClubId, player } = loanToManager("loan-buyout");
  const ownerCash = getClubEconomySnapshot(loanedState, ownerClubId)!.cashEur;
  const started = ok(startTransferNegotiation(loanedState, player.id));
  assert.equal(started.negotiation.fromClubId, ownerClubId, "a permanent deal is held with the contract owner, not the playing club");
  const id = started.negotiation.id;
  let state: CareerState = { ...started.state, transferNegotiations: { ...started.state.transferNegotiations, [id]: { ...started.negotiation, rivals: [] } } };

  const fee = roundAskingFeeEur(getSellingClubAskingPriceEur(state, player.id)!);
  state = answer(ok(submitNegotiationFeeOffer(state, id, fee)).state, id);
  assert.equal(state.transferNegotiations![id].stage, "PLAYER");
  const terms = { contractYears: 3, promisedSquadRole: "KEY_PLAYER" as const };
  const demand = computeNegotiationWageDemand(state, state.transferNegotiations![id], terms)!.demandEurPerMonth;
  state = answer(ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: demand })).state, id);
  assert.equal(state.transferNegotiations![id].stage, "COMPLETED");
  const offer = state.transferOffers[state.transferNegotiations![id].offerId!];
  if (offer.status === "AGREED_AWAITING_WINDOW") state = progressDailyTransfers(state, offer.scheduledCompletionDate!);

  assert.equal(getActiveLoanForPlayer(state, player.id), undefined, "buying him out ends the loan");
  assert.equal(getPlayerContract(state, player.id)!.clubId, MANAGER);
  assert.equal(getPlayerContract(state, player.id)!.wageEurPerMonth, demand);
  assert.equal(getCareerPlayer(state, player.id)?.clubId, MANAGER);
  assert.equal(getClubEconomySnapshot(state, ownerClubId)!.cashEur, ownerCash + fee, "the fee goes to the owner");
});

test("a loan negotiation cannot be opened for a player already on loan, and an owner who needs the player breaks off", () => {
  const { state, player } = loanToManager("loan-guards");
  assert.equal(startTransferNegotiation(state, player.id, "LOAN").ok, false);
  const clean = careerState("loan-key");
  const key = otherClubs(clean).flatMap((c) => clean.worldSquads[c]).find((p) => getRequiredLoanWageSharePct(clean, p.id) === null);
  assert.ok(key, "no indispensable player found");
  const started = ok(startTransferNegotiation(clean, key.id, "LOAN"));
  const contract = getPlayerContract(clean, key.id)!;
  const endDate = [contract.contractEndDate, addDays(clean.gameDate, 60)].sort()[0];
  const answered = answer(ok(submitNegotiationLoanOffer(started.state, started.negotiation.id, { wageSharePct: 100, endDate })).state, started.negotiation.id);
  assert.equal(answered.transferNegotiations![started.negotiation.id].stage, "COLLAPSED");
});

test("an old save with a pre-05C loan contract (borrower club + wage share) migrates to owner + full wage, idempotently", () => {
  const { state, ownerClubId, player } = loanToManager("loan-legacy");
  const loan = getActiveLoanForPlayer(state, player.id)! as LoanRecord;
  const fullContract = getPlayerContract(state, player.id)!;
  const legacy: CareerState = { ...state, playerContracts: { ...state.playerContracts, [player.id]: { ...fullContract, clubId: MANAGER, wageEurPerMonth: Math.round(fullContract.wageEurPerMonth * loan.wageShareBorrowingPct / 100) } } };
  const legacyBorrowerCost = getClubPlayerWageCostsEurAnnual(legacy, MANAGER);

  const migrated = migrateCareerState(JSON.parse(JSON.stringify(legacy)));
  assert.equal(getPlayerContract(migrated, player.id)!.clubId, ownerClubId);
  assert.equal(getPlayerContract(migrated, player.id)!.wageEurPerMonth, loan.originalWageEurPerMonth);
  assert.ok(Math.abs(getClubPlayerWageCostsEurAnnual(migrated, MANAGER) - legacyBorrowerCost) < 12, "the borrower's wage cost is unchanged by the migration");
  assert.equal(migrateLegacyLoanContracts(migrated), migrated);

  const returned = progressDailyTransfers(migrated, loan.endDate);
  assert.equal(getCareerPlayer(returned, player.id)?.clubId, ownerClubId);
  assert.equal(getPlayerContract(returned, player.id)!.wageEurPerMonth, loan.originalWageEurPerMonth);
});
