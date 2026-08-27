// HM-TRANSFERS-1.0: affordability tests, built against real generated
// club economies (createNewCareerState + Economy 1.0), never a mocked
// budget -- Part: "Återanvänd Economy 1.0 affordability-principer".
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { TUMBA_CLUB_ID } from "../game-data";
import { assessTransferAffordability } from "./affordability";
import { getClubBudgets } from "../economy/clubEconomyIntegration";

function freshTumba(seed: string) {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

test("(1) a deal well within both budgets is affordable", () => {
  const state = freshTumba("afford-1");
  const budgets = getClubBudgets(state, TUMBA_CLUB_ID)!;
  const result = assessTransferAffordability(state, TUMBA_CLUB_ID, Math.round(budgets.transferBudgetEur * 0.1), 0, 100);
  assert.ok(result.affordable, JSON.stringify(result.reasons));
});

test("(2) a transfer fee exceeding the transfer budget is blocked with a specific reason", () => {
  const state = freshTumba("afford-2");
  const budgets = getClubBudgets(state, TUMBA_CLUB_ID)!;
  const result = assessTransferAffordability(state, TUMBA_CLUB_ID, budgets.transferBudgetEur * 5, 0, 100);
  assert.ok(!result.affordable);
  assert.ok(result.reasons.some((r) => r.includes("transferbudgeten")));
});

test("(3) a wage that would push total wage costs over the wage budget is blocked, even with a €0 fee", () => {
  const state = freshTumba("afford-3");
  const budgets = getClubBudgets(state, TUMBA_CLUB_ID)!;
  const hugeMonthlyWage = budgets.wageBudgetEur; // a single player's wage alone exceeding the whole club's annual wage budget in monthly terms
  const result = assessTransferAffordability(state, TUMBA_CLUB_ID, 0, 0, hugeMonthlyWage);
  assert.ok(!result.affordable);
  assert.ok(result.reasons.some((r) => r.includes("lönebudgeten")));
});

test("(4) training compensation is added to the fee for the transfer-budget check -- a fee alone within budget can still be blocked once training compensation is included", () => {
  const state = freshTumba("afford-4");
  const budgets = getClubBudgets(state, TUMBA_CLUB_ID)!;
  const feeAlone = Math.round(budgets.transferBudgetEur * 0.6);
  const trainingComp = Math.round(budgets.transferBudgetEur * 0.6);
  const withoutTrainingComp = assessTransferAffordability(state, TUMBA_CLUB_ID, feeAlone, 0, 100);
  const withTrainingComp = assessTransferAffordability(state, TUMBA_CLUB_ID, feeAlone, trainingComp, 100);
  assert.ok(withoutTrainingComp.affordable);
  assert.ok(!withTrainingComp.affordable);
});

test("(5) a loan's wage-share reduces the effective wage cost checked, so a share below 100% can be affordable when the full wage would not be", () => {
  const state = freshTumba("afford-5");
  const budgets = getClubBudgets(state, TUMBA_CLUB_ID)!;
  const monthlyWage = Math.round((budgets.wageBudgetEur / 12) * 1.5); // would exceed the budget at 100% share
  const fullShare = assessTransferAffordability(state, TUMBA_CLUB_ID, 0, 0, monthlyWage, 100);
  const halfShare = assessTransferAffordability(state, TUMBA_CLUB_ID, 0, 0, monthlyWage, 20);
  assert.ok(!fullShare.affordable);
  assert.ok(halfShare.affordable);
});

test("(6) an unknown club (no economy data) is never affordable, with a clear reason", () => {
  const state = freshTumba("afford-6");
  const result = assessTransferAffordability(state, "not-a-real-club", 0, 0, 100);
  assert.ok(!result.affordable);
  assert.ok(result.reasons.length > 0);
});
