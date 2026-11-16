// HM-ALPHA2-05A: pure negotiation rules -- every response is a threshold
// against a derived demand, never a probability.
import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateClubFeeRound, evaluatePlayerTermsRound, expectedRoleFromSquadRank, MAX_CLUB_ROUNDS, responseDelayDays, rivalDecisionDelayDays, type PlayerWageDemand } from "./negotiation";

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

// HM-TRANSFER-REALISM-1.0: the demand itself now comes from the shared PCDM
// (lib/transfers/careerDecision, tested there); these rounds only judge an
// offer against a given demand.
const demand: PlayerWageDemand = { demandEurPerMonth: 2_310, refusesRole: false, factors: [] };

test("a demand the player refuses (role, sporting level) is rejected at any wage", () => {
  assert.equal(evaluatePlayerTermsRound({ demand: { ...demand, refusesRole: true }, offeredWageEurPerMonth: 1_000_000, round: 1 }).response, "REJECT");
});

test("player accepts at the demand, counters near it, rejects far below it, breaks off after the last round", () => {
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

// --- HM-ALPHA2-05B ---

test("a rival's higher fee becomes the club's floor; a lower one changes nothing", () => {
  const withRival = evaluateClubFeeRound({ askingFeeEur: 10_000, offeredFeeEur: 10_000, round: 1, rival: { clubName: "Rival", feeEur: 13_000 } });
  assert.equal(withRival.response, "COUNTER");
  assert.equal(withRival.counterFeeEur, 13_000);
  assert.equal(evaluateClubFeeRound({ askingFeeEur: 10_000, offeredFeeEur: 13_000, round: 2, rival: { clubName: "Rival", feeEur: 13_000 } }).response, "ACCEPT");
  assert.equal(evaluateClubFeeRound({ askingFeeEur: 10_000, offeredFeeEur: 10_000, round: 1, rival: { clubName: "Rival", feeEur: 8_000 } }).response, "ACCEPT");
});

test("a counter names the rival when a rival package raised the demand", () => {
  const withRival: PlayerWageDemand = { ...demand, factors: ["Har ett bättre erbjudande från Rival."] };
  const counter = evaluatePlayerTermsRound({ demand: withRival, offeredWageEurPerMonth: demand.demandEurPerMonth * 0.9, round: 1 });
  assert.equal(counter.response, "COUNTER");
  assert.match(counter.reason, /framför Rival/);
});

test("response and rival delays are fixed per seed and bounded", () => {
  for (const seed of ["a", "b", "c", "d", "e"]) {
    const d = responseDelayDays(seed);
    assert.ok(d >= 1 && d <= 3);
    assert.equal(responseDelayDays(seed), d);
    const r = rivalDecisionDelayDays(seed);
    assert.ok(r >= 3 && r <= 9);
  }
});
