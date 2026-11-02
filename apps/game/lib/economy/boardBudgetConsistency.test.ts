// HM-ALPHA3 economy release blocker: board budgets and financial health
// read the same recurring revenue and costs the monthly ledger books, so a
// club whose books balance is not frozen by its own contracts -- while a
// wage bill beyond the balanced line, and a club in crisis, stay blocked.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import type { CareerState } from "../career/types";
import { assessTransferAffordability } from "../transfers/affordability";
import { getClubBudgets, getClubEconomyBaseline, getClubFinancialHealth, getClubPlayerWageCostsEurAnnual, ledgerRecurringInputs } from "./clubEconomyIntegration";
import { ensureClubFinances, recurringLinesForMonth } from "./ledger";

const SKOVDE = "se_club_ifk_skovde_hk";
function career(): CareerState {
  const squads = { ...snapshotWorldSquads("se_handbollsligan_herr"), ...snapshotWorldSquads("swe-2") };
  const ratings = { ...snapshotGameplayRatings("se_handbollsligan_herr"), ...snapshotGameplayRatings("swe-2") };
  return createNewCareerState("budget-consistency", SKOVDE, squads, undefined, ratings);
}

test("budgets read the ledger's recurring revenue: support income and club-operations cost are both counted", () => {
  const state = ensureClubFinances(career(), "2026-08-19");
  for (const clubId of Object.keys(state.clubEconomies)) {
    const baseline = getClubEconomyBaseline(state, clubId);
    if (!baseline) continue;
    const { lines } = recurringLinesForMonth(state, clubId, "2026-09");
    const ledgerIncomeExMatchday = lines.filter((l) => l.amountEur > 0 && l.category !== "MATCHDAY").reduce((s, l) => s + l.amountEur, 0) * 12;
    const inputs = ledgerRecurringInputs(state, clubId, baseline);
    const expected = inputs.revenueEur - baseline.revenue.matchdayRevenueEur;
    assert.ok(Math.abs(ledgerIncomeExMatchday - expected) <= 12 * 6, `${clubId}: ledger ${ledgerIncomeExMatchday} vs budget input ${expected}`);
  }
});

test("budgets do not jump when the ledger activates on the first processed day", () => {
  const before = career();
  const after = ensureClubFinances(before, "2026-08-19");
  for (const clubId of Object.keys(before.clubEconomies)) assert.deepEqual(getClubBudgets(after, clubId), getClubBudgets(before, clubId), clubId);
});

test("a club whose books balance through association support can still sign a minimal contract, but not an unaffordable wage bill", () => {
  const state = ensureClubFinances(career(), "2026-08-19");
  assert.ok(state.clubFinances![SKOVDE]!.bridgeEurAnnual < 0, "Skövde's books balance through association support");
  const budgets = getClubBudgets(state, SKOVDE)!;
  assert.equal(budgets.wageOverBudget, false);
  assert.ok(getClubFinancialHealth(state, SKOVDE)!.structuralHealth !== "SEVERE");
  assert.equal(assessTransferAffordability(state, SKOVDE, 0, 0, 500).affordable, true, "room for a minimal contract");
  const beyondBalanced = (budgets.wageBudgetEur - getClubPlayerWageCostsEurAnnual(state, SKOVDE)) / 12 + 1000;
  assert.equal(assessTransferAffordability(state, SKOVDE, 0, 0, beyondBalanced).affordable, false, "the balanced line is still a real limit");
});

test("no club starts above its board wage budget, and crisis still freezes wages", () => {
  const state = ensureClubFinances(career(), "2026-08-19");
  const over = Object.keys(state.clubEconomies).filter((id) => getClubBudgets(state, id)?.wageOverBudget);
  assert.deepEqual(over, []);
  const crisis: CareerState = { ...state, clubFinances: { ...state.clubFinances, [SKOVDE]: { ...state.clubFinances![SKOVDE]!, status: "CRISIS" } } };
  const frozen = getClubBudgets(crisis, SKOVDE)!;
  assert.equal(frozen.transferBudgetEur, 0);
  assert.ok(frozen.wageBudgetEur <= getClubPlayerWageCostsEurAnnual(crisis, SKOVDE));
});
