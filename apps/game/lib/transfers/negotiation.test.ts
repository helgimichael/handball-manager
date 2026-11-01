// HM-ALPHA2-05A: pure negotiation rules -- every response is a threshold
// against a derived demand, never a probability.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computePlayerWageDemand, evaluateClubFeeRound, evaluatePlayerTermsRound, expectedRoleFromSquadRank, MAX_CLUB_ROUNDS, type PlayerWageDemandInputs } from "./negotiation";

test("club accepts a bid at or above its asking price", () => {
  assert.equal(evaluateClubFeeRound({ askingFeeEur: 10_000, offeredFeeEur: 10_000, round: 1 }).response, "ACCEPT");
});

test("club counters a serious bid with its rounded asking price", () => {
  const result = evaluateClubFeeRound({ askingFeeEur: 10_120, offeredFeeEur: 8_000, round: 1 });
  assert.equal(result.response, "COUNTER");
  assert.equal(result.counterFeeEur, 10_500);
  assert.equal(evaluateClubFeeRound({ askingFeeEur: 10_120, offeredFeeEur: result.counterFeeEur!, round: 2 }).response, "ACCEPT");
});

test("club plainly rejects a low bid and breaks off at an insulting one", () => {
  assert.equal(evaluateClubFeeRound({ askingFeeEur: 10_000, offeredFeeEur: 6_000, round: 1 }).response, "REJECT");
  assert.equal(evaluateClubFeeRound({ askingFeeEur: 10_000, offeredFeeEur: 4_000, round: 1 }).response, "BREAK_OFF");
});

test("club sees no movement in a repeated bid and loses patience after the last round", () => {
  assert.equal(evaluateClubFeeRound({ askingFeeEur: 10_000, offeredFeeEur: 8_000, round: 2, previousOfferEur: 8_000 }).response, "REJECT");
  assert.equal(evaluateClubFeeRound({ askingFeeEur: 10_000, offeredFeeEur: 9_000, round: MAX_CLUB_ROUNDS, previousOfferEur: 8_000 }).response, "BREAK_OFF");
});

const baseDemand: PlayerWageDemandInputs = {
  playerId: "p-negotiation-test",
  age: 26,
  isFreeAgent: false,
  currentWageEurPerMonth: 2_000,
  fairWageEurPerMonth: 2_000,
  currentClubTier: 1,
  newClubTier: 1,
  currentSquadStatus: "Förstaval",
  currentClubPressure: "NONE",
  expectedRole: "FIRST_CHOICE",
  promisedRole: "FIRST_CHOICE",
  contractYears: 3,
};

test("a player under contract wants a raise; moving down a league costs more", () => {
  const base = computePlayerWageDemand(baseDemand).demandEurPerMonth;
  assert.ok(base >= 2_000 * 1.1 * 0.95);
  assert.ok(computePlayerWageDemand({ ...baseDemand, newClubTier: 2 }).demandEurPerMonth > base);
});

test("a smaller promised role raises the demand; a far smaller one is refused outright", () => {
  const base = computePlayerWageDemand(baseDemand).demandEurPerMonth;
  assert.ok(computePlayerWageDemand({ ...baseDemand, promisedRole: "ROTATION" }).demandEurPerMonth > base);
  assert.ok(computePlayerWageDemand({ ...baseDemand, promisedRole: "KEY_PLAYER" }).demandEurPerMonth < base);
  const refused = computePlayerWageDemand({ ...baseDemand, expectedRole: "KEY_PLAYER", promisedRole: "SQUAD_PLAYER" });
  assert.equal(refused.refusesRole, true);
  assert.equal(evaluatePlayerTermsRound({ demand: refused, offeredWageEurPerMonth: 1_000_000, round: 1 }).response, "REJECT");
});

test("a veteran asks more for a one-year deal", () => {
  const vet = { ...baseDemand, age: 32 };
  assert.ok(computePlayerWageDemand({ ...vet, contractYears: 1 }).demandEurPerMonth > computePlayerWageDemand({ ...vet, contractYears: 3 }).demandEurPerMonth);
});

test("player accepts at the demand, counters near it, rejects far below it, breaks off after the last round", () => {
  const demand = computePlayerWageDemand(baseDemand);
  assert.equal(evaluatePlayerTermsRound({ demand, offeredWageEurPerMonth: demand.demandEurPerMonth, round: 1 }).response, "ACCEPT");
  const counter = evaluatePlayerTermsRound({ demand, offeredWageEurPerMonth: demand.demandEurPerMonth * 0.9, round: 1 });
  assert.equal(counter.response, "COUNTER");
  assert.equal(counter.counterWageEurPerMonth, demand.demandEurPerMonth);
  assert.equal(evaluatePlayerTermsRound({ demand, offeredWageEurPerMonth: demand.demandEurPerMonth * 0.5, round: 1 }).response, "REJECT");
  assert.equal(evaluatePlayerTermsRound({ demand, offeredWageEurPerMonth: demand.demandEurPerMonth * 0.9, round: 3 }).response, "BREAK_OFF");
});

test("expected role follows squad rank", () => {
  assert.equal(expectedRoleFromSquadRank(0, 25), "KEY_PLAYER");
  assert.equal(expectedRoleFromSquadRank(5, 25), "FIRST_CHOICE");
  assert.equal(expectedRoleFromSquadRank(9, 25), "ROTATION");
  assert.equal(expectedRoleFromSquadRank(15, 19), "TALENT");
  assert.equal(expectedRoleFromSquadRank(15, 28), "SQUAD_PLAYER");
});
