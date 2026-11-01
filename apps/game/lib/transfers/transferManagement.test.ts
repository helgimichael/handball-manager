// HM-ALPHA2-05E: Transfer Management 1.0 -- agent commission, signing
// bonus, sporting ambition, explained demands, contract promises, CPU
// owner renewal of loanees, and save/reload consistency of negotiations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { migrateCareerState } from "../career/saveMigration";
import { getCareerPlayer } from "../career/careerWorld";
import { progressCpuContractDecisions } from "../career/cpuContractDecisions";
import { addDays } from "../career/dateUtils";
import { getClubsByCompetition } from "../game-data";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { getClubEconomySnapshot } from "../economy/clubEconomyIntegration";
import { getPlayerContract } from "../economy/contractIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import { computeAgentFeeEur, computePlayerWageDemand, effectiveMonthlyWage, roundAskingFeeEur, type PlayerWageDemandInputs } from "./negotiation";
import {
  computeNegotiationWageDemand,
  getNegotiationAgentFeeEur,
  progressTransferNegotiations,
  startTransferNegotiation,
  submitNegotiationFeeOffer,
  submitNegotiationLoanOffer,
  submitNegotiationTerms,
} from "./negotiationIntegration";
import { getActiveLoanForPlayer, getRequiredLoanWageSharePct, getSellingClubAskingPriceEur } from "./transferIntegration";
import type { CareerState } from "../career/types";

const HANDBOLLSLIGAN_ID = "se_handbollsligan_herr";
const MANAGER = "se_club_ov_helsingborg";

function careerState(seed: string): CareerState {
  return createNewCareerState(seed, MANAGER, snapshotWorldSquads(HANDBOLLSLIGAN_ID), {}, snapshotGameplayRatings(HANDBOLLSLIGAN_ID));
}

function ok<T extends { ok: boolean }>(result: T): Extract<T, { ok: true }> {
  assert.ok(result.ok, "error" in result ? String((result as { error?: string }).error) : "");
  return result as Extract<T, { ok: true }>;
}

function answer(state: CareerState, id: string): CareerState {
  const date = state.transferNegotiations![id].pending!.responseDate;
  return { ...progressTransferNegotiations(state, date).state, gameDate: date };
}

const baseDemand: PlayerWageDemandInputs = {
  playerId: "p-tm",
  age: 21,
  isFreeAgent: false,
  currentWageEurPerMonth: 2_000,
  fairWageEurPerMonth: 2_000,
  currentClubTier: 1,
  newClubTier: 1,
  currentSquadStatus: "Förstaval",
  currentClubPressure: "NONE",
  expectedRole: "FIRST_CHOICE",
  promisedRole: "ROTATION",
  contractYears: 3,
};

test("every demand factor is explained with its effect, and the explained factors reproduce the demand", () => {
  const demand = computePlayerWageDemand({ ...baseDemand, newClubTier: 2, newClubPressure: "CRITICAL" });
  const product = (demand.breakdown ?? []).reduce((acc, f) => acc * (1 + f.effectPct / 100), demand.baseEurPerMonth!);
  assert.ok(Math.abs(product - demand.demandEurPerMonth) <= demand.demandEurPerMonth * 0.02 + 10, `${product} vs ${demand.demandEurPerMonth}`);
  assert.ok(demand.breakdown!.some((f) => f.effectPct === 15));
});

test("an ambitious talent weighs a smaller role more heavily; a weaker squad is a sporting step down, a stronger one attracts", () => {
  const settled = computePlayerWageDemand({ ...baseDemand, potentialGap: 2 }).demandEurPerMonth;
  const ambitious = computePlayerWageDemand({ ...baseDemand, potentialGap: 25 }).demandEurPerMonth;
  assert.ok(ambitious > settled);
  const neutral = computePlayerWageDemand({ ...baseDemand, promisedRole: "FIRST_CHOICE" }).demandEurPerMonth;
  assert.ok(computePlayerWageDemand({ ...baseDemand, promisedRole: "FIRST_CHOICE", sportingLevel: { playerCa: 120, buyingSquadLevel: 100 } }).demandEurPerMonth > neutral);
  assert.ok(computePlayerWageDemand({ ...baseDemand, promisedRole: "FIRST_CHOICE", sportingLevel: { playerCa: 100, buyingSquadLevel: 115 } }).demandEurPerMonth < neutral);
});

test("an agent with a client who has leverage asks more; a signing bonus counts as wage over the contract", () => {
  assert.ok(computeAgentFeeEur(2000, "FREE_AGENT") > computeAgentFeeEur(2000, "EXPIRING"));
  assert.ok(computeAgentFeeEur(2000, "EXPIRING") > computeAgentFeeEur(2000, "EXPIRING_SOON"));
  assert.ok(computeAgentFeeEur(2000, "EXPIRING_SOON") > computeAgentFeeEur(2000, "UNDER_CONTRACT"));
  assert.equal(effectiveMonthlyWage(1000, 36_000, 3), 2000);
});

function startPermanent(seed: string) {
  let state = careerState(seed);
  const sellerClubId = getClubsByCompetition(HANDBOLLSLIGAN_ID).find((c) => c.id !== MANAGER && (state.worldSquads[c.id]?.length ?? 0) > 3)!.id;
  const player = state.worldSquads[sellerClubId][0];
  const started = ok(startTransferNegotiation(state, player.id));
  const id = started.negotiation.id;
  state = { ...started.state, transferNegotiations: { ...started.state.transferNegotiations, [id]: { ...started.negotiation, rivals: [] } } };
  const fee = roundAskingFeeEur(getSellingClubAskingPriceEur(state, player.id)!);
  state = answer(ok(submitNegotiationFeeOffer(state, id, fee)).state, id);
  assert.equal(state.transferNegotiations![id].stage, "PLAYER");
  return { state, id, player, sellerClubId, fee };
}

test("a signing bonus closes the gap on a lower wage; buyer pays fee + training compensation + agent + bonus exactly once; the promise is on the contract", () => {
  const { state: atTerms, id, player, fee } = startPermanent("tm-bonus");
  let state = atTerms;
  const terms = { contractYears: 3, promisedSquadRole: "FIRST_CHOICE" as const };
  const demand = computeNegotiationWageDemand(state, state.transferNegotiations![id], terms)!.demandEurPerMonth;
  const agentFee = getNegotiationAgentFeeEur(state, state.transferNegotiations![id]);
  assert.ok(agentFee > 0);
  const wage = Math.round(demand * 0.85);
  const bonus = Math.ceil((demand - wage) * 36 / 100) * 100;
  const buyerCash = getClubEconomySnapshot(state, MANAGER)!.cashEur;
  const trainingComp = getPlayerTrainingCompensation(state, player.id)?.totalEur ?? 0;

  const responseDate = ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: wage, signingBonusEur: bonus })).negotiation.pending!.responseDate;
  state = ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: wage, signingBonusEur: bonus })).state;
  const once = progressTransferNegotiations(state, responseDate).state;
  const twice = progressTransferNegotiations(once, responseDate).state;
  const negotiation = twice.transferNegotiations![id];
  assert.equal(negotiation.stage, "COMPLETED", negotiation.rounds.at(-1)?.reason);
  const offer = twice.transferOffers[negotiation.offerId!];
  assert.equal(offer.agentFeeEur, agentFee);
  assert.equal(offer.signingBonusEur, bonus);
  assert.equal(offer.status, "COMPLETED", "a new career starts inside the summer window");
  assert.equal(getClubEconomySnapshot(twice, MANAGER)!.cashEur, Math.max(0, buyerCash - (fee + trainingComp + agentFee + bonus)));
  assert.equal(getPlayerContract(twice, player.id)!.wageEurPerMonth, wage);
  assert.equal(getPlayerContract(twice, player.id)!.promisedSquadRole, "FIRST_CHOICE");
  assert.ok(negotiation.rounds.at(-1)!.demandBreakdown, "the player's answer carries its reasons");
});

test("save/reload mid-negotiation: a JSON round-trip + migration continues to the identical outcome", () => {
  const { state, id } = startPermanent("tm-reload");
  const terms = { contractYears: 3, promisedSquadRole: "FIRST_CHOICE" as const };
  const demand = computeNegotiationWageDemand(state, state.transferNegotiations![id], terms)!.demandEurPerMonth;
  const pending = ok(submitNegotiationTerms(state, id, { ...terms, wageEurPerMonth: Math.round(demand * 0.9) })).state;
  const reloaded = migrateCareerState(JSON.parse(JSON.stringify(pending)));
  assert.deepEqual(reloaded.transferNegotiations![id], pending.transferNegotiations![id]);
  const date = pending.transferNegotiations![id].pending!.responseDate;
  const a = progressTransferNegotiations(pending, date);
  const b = progressTransferNegotiations(reloaded, date);
  assert.deepEqual(b.state.transferNegotiations![id], a.state.transferNegotiations![id]);
  assert.deepEqual(b.notices, a.notices);
});

test("a negotiated loan registers once (ticked twice), and a CPU owner renews his loaned-out player when it decides to", () => {
  const base = careerState("tm-loan");
  let renewedSomewhere = false;
  for (const ownerClubId of getClubsByCompetition(HANDBOLLSLIGAN_ID).map((c) => c.id).filter((c) => c !== MANAGER)) {
    for (const player of base.worldSquads[ownerClubId] ?? []) {
      const required = getRequiredLoanWageSharePct(base, player.id);
      const contract = getPlayerContract(base, player.id);
      if (typeof required !== "number" || !contract || contract.contractEndDate <= addDays(base.gameDate, 200)) continue;
      const started = ok(startTransferNegotiation(base, player.id, "LOAN"));
      const id = started.negotiation.id;
      let state = answer(ok(submitNegotiationLoanOffer(started.state, id, { wageSharePct: required, endDate: addDays(base.gameDate, 90) })).state, id);
      const roleDate = ok(submitNegotiationTerms(state, id, { wageEurPerMonth: 0, contractYears: 1, promisedSquadRole: "KEY_PLAYER" })).negotiation.pending!.responseDate;
      state = ok(submitNegotiationTerms(state, id, { wageEurPerMonth: 0, contractYears: 1, promisedSquadRole: "KEY_PLAYER" })).state;
      state = progressTransferNegotiations(progressTransferNegotiations(state, roleDate).state, roleDate).state;
      assert.equal(Object.values(state.loans).filter((l) => l.playerId === player.id).length, 1, "one loan, never two");
      assert.equal(Object.values(state.transferOffers).filter((o) => o.negotiationId === id).length, 1);
      assert.equal(getCareerPlayer(state, player.id)?.clubId, MANAGER);

      // His contract now runs out soon after the loan: the owner reviews him like its own squad.
      const expiring = { ...state, playerContracts: { ...state.playerContracts, [player.id]: { ...getPlayerContract(state, player.id)!, contractEndDate: addDays(base.gameDate, 150) } } };
      const after = progressCpuContractDecisions(expiring, base.gameDate, [ownerClubId]).state;
      const renewed = getPlayerContract(after, player.id)!;
      if (renewed.contractEndDate > addDays(base.gameDate, 150)) {
        assert.equal(renewed.clubId, ownerClubId, "the owner renews -- ownership never moves");
        assert.ok(getActiveLoanForPlayer(after, player.id), "the loan continues");
        renewedSomewhere = true;
        break;
      }
    }
    if (renewedSomewhere) break;
  }
  assert.ok(renewedSomewhere, "no CPU owner renewed any loaned-out player");
});
