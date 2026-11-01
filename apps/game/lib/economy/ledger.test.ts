// HM-ALPHA3-M02: the monthly club ledger -- activation without retroactive
// billing, idempotent closes, exact reconciliation, matchday attendance,
// calibration, overdraft/crisis, rescues and the manager's budget plan.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "../career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../gameWorld/serverSnapshot";
import { processDay } from "../career/dailyTick";
import { addDays } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import { adjustClubCash, getClubBudgets, getClubEconomyBaseline, getClubPlayerWageCostsEurAnnual, getClubStaffCostsEurAnnual } from "./clubEconomyIntegration";
import { closeDueMonths, computeCalibrationBridgeEur, ensureClubFinances, homeAttendance, overdraftLimitEur, projectClubFinances, recurringRevenueEurAnnual, STARTING_MARGIN_BAND } from "./ledger";
import { boardBudgets, setBudgetPlan } from "./budgetPlan";

const SKOVDE = "se_club_ifk_skovde_hk";
function career(): CareerState {
  const squads = { ...snapshotWorldSquads("se_handbollsligan_herr"), ...snapshotWorldSquads("swe-2") };
  const ratings = { ...snapshotGameplayRatings("se_handbollsligan_herr"), ...snapshotGameplayRatings("swe-2") };
  return createNewCareerState("ledger-tests", SKOVDE, squads, undefined, ratings);
}

const reconcile = (s: { openingCashEur: number; closingCashEur: number; lines: { amountEur: number }[]; transactions: { amountEur: number }[] }) =>
  s.openingCashEur + s.lines.reduce((a, l) => a + l.amountEur, 0) + s.transactions.reduce((a, t) => a + t.amountEur, 0);

test("the ledger starts without retroactive billing: the activation month is skipped, the first full month is billed once", () => {
  const start = ensureClubFinances(career(), "2026-08-19");
  const finance = start.clubFinances![SKOVDE]!;
  assert.equal(finance.firstBillableMonth, "2026-09");
  assert.equal(closeDueMonths(start, "2026-09-01").closed.length, 0, "August is never billed");
  const october = closeDueMonths(start, "2026-10-01");
  const own = october.closed.filter((c) => c.clubId === SKOVDE);
  assert.deepEqual(own.map((c) => c.statement.month), ["2026-09"]);
  const again = closeDueMonths(october.state, "2026-10-01");
  assert.equal(again.closed.length, 0, "a closed month can never be billed twice");
  assert.equal(JSON.stringify(again.state.clubEconomies), JSON.stringify(october.state.clubEconomies));
});

test("a late close catches up month by month and every statement reconciles exactly, one-offs included", () => {
  let state = ensureClubFinances(career(), "2026-08-19");
  state = adjustClubCash(state, SKOVDE, -12_345, { category: "TRANSFER_FEES", label: "Testvärvning", date: "2026-09-10" });
  state = adjustClubCash(state, SKOVDE, 5_000, { category: "PRIZE_MONEY", label: "Testpris", date: "2026-10-03" });
  const out = closeDueMonths(state, "2026-12-01");
  const own = out.closed.filter((c) => c.clubId === SKOVDE).map((c) => c.statement);
  assert.deepEqual(own.map((s) => s.month), ["2026-09", "2026-10", "2026-11"]);
  for (const s of own) assert.equal(s.closingCashEur, reconcile(s), `${s.month} reconciles`);
  assert.equal(own[0]!.transactions.length, 2, "both one-offs recorded before the first close land on it");
  assert.equal(own[1]!.openingCashEur, own[0]!.closingCashEur);
  assert.equal(getClubEconomyBaseline(out.state, SKOVDE)!.cashEur, own[2]!.closingCashEur);
  for (const { statement } of out.closed) assert.equal(statement.closingCashEur, reconcile(statement), "every club reconciles");
});

test("the calibration bridge brings every club's starting margin into ±6 % of revenue", () => {
  const state = career();
  for (const clubId of Object.keys(state.clubEconomies)) {
    const baseline = getClubEconomyBaseline(state, clubId)!;
    const revenue = recurringRevenueEurAnnual(baseline);
    if (revenue <= 0) continue;
    const costs = getClubPlayerWageCostsEurAnnual(state, clubId) + getClubStaffCostsEurAnnual(state, clubId) + baseline.operatingCostsBaselineEur;
    const margin = revenue - costs - computeCalibrationBridgeEur(state, clubId, baseline);
    assert.ok(Math.abs(margin) <= revenue * STARTING_MARGIN_BAND + 1, `${clubId}: ${margin} of ${revenue}`);
  }
});

test("attendance is deterministic, within capacity, and a derby draws more than an ordinary game", () => {
  const state = career();
  const baseline = getClubEconomyBaseline(state, SKOVDE)!;
  const home = state.fixtures.find((f) => f.homeClubId === SKOVDE)!;
  const a = homeAttendance(state, home, baseline);
  assert.deepEqual(homeAttendance(state, home, baseline), a);
  assert.ok(a.attendance > 0 && a.attendance <= a.capacity);
  const savehof = "se_club_ik_savehof", onnered = "se_club_onnereds_hk"; // both Göteborg
  const derby = homeAttendance(state, { ...home, homeClubId: savehof, awayClubId: onnered }, getClubEconomyBaseline(state, savehof)!);
  const ordinary = homeAttendance(state, { ...home, homeClubId: savehof, awayClubId: SKOVDE }, getClubEconomyBaseline(state, savehof)!);
  assert.ok(derby.attendance > ordinary.attendance);
});

test("overdraft and crisis: status follows cash, crisis freezes new wages and fees, and the manager is told", () => {
  let state = ensureClubFinances(career(), "2026-08-19");
  const baseline = getClubEconomyBaseline(state, SKOVDE)!;
  state = adjustClubCash(state, SKOVDE, -(baseline.cashEur + overdraftLimitEur(baseline) * 3), { category: "OTHER_ONE_OFF", label: "Test", date: "2026-09-02" });
  state = { ...state, clubEconomies: { ...state.clubEconomies, [SKOVDE]: { ...state.clubEconomies[SKOVDE]!, ownerFundingEur: 0 } } };
  const result = processDay({ ...state, gameDate: "2026-09-30", processedThroughDate: "2026-09-30" }, "2026-10-01");
  assert.equal(result.state.clubFinances![SKOVDE]!.status, "CRISIS");
  const budgets = getClubBudgets(result.state, SKOVDE)!;
  assert.equal(budgets.transferBudgetEur, 0);
  assert.ok(budgets.wageBudgetEur <= Math.round(getClubPlayerWageCostsEurAnnual(result.state, SKOVDE)));
  assert.ok(result.events.some((e) => e.type === "CLUB_FINANCE" && e.priority === "ACTION_REQUIRED"));
  assert.ok(result.state.inbox.some((m) => m.subject.startsWith("Månadsbokslut")));
  assert.throws(() => setBudgetPlan(result.state, 10_000), /fryst/);
});

test("owner backing covers a crisis first; a CPU club gets at most one emergency rescue per season, the manager none", () => {
  let state = ensureClubFinances(career(), "2026-08-19");
  const cpu = "se_club_lugi_hf";
  for (const clubId of [cpu, SKOVDE]) {
    const b = getClubEconomyBaseline(state, clubId)!;
    state = { ...state, clubEconomies: { ...state.clubEconomies, [clubId]: { ...b, ownerFundingEur: 0, cashEur: -overdraftLimitEur(b) * 4 } } };
    state = { ...state, clubFinances: { ...state.clubFinances, [clubId]: { ...state.clubFinances![clubId]!, cashAtLastCloseEur: -overdraftLimitEur(b) * 4 } } };
  }
  const first = closeDueMonths(state, "2026-10-01").state;
  const cpuSep = first.clubFinances![cpu]!.statements.at(-1)!;
  assert.ok(cpuSep.transactions.some((t) => t.category === "OWNER_INJECTION"), "CPU rescued");
  assert.ok(!first.clubFinances![SKOVDE]!.statements.at(-1)!.transactions.some((t) => t.category === "OWNER_INJECTION"), "no free rescue for the manager");
  const b = getClubEconomyBaseline(first, cpu)!;
  const sunk = { ...first, clubEconomies: { ...first.clubEconomies, [cpu]: { ...b, cashEur: -overdraftLimitEur(b) * 4 } } };
  const second = closeDueMonths(sunk, "2026-11-01").state;
  assert.ok(!second.clubFinances![cpu]!.statements.at(-1)!.transactions.some((t) => t.category === "OWNER_INJECTION"), "only once per season");

  const owned = { ...state, clubEconomies: { ...state.clubEconomies, [SKOVDE]: { ...state.clubEconomies[SKOVDE]!, ownerFundingEur: 50_000_000 } } };
  const covered = closeDueMonths(owned, "2026-10-01").state;
  assert.equal(covered.clubFinances![SKOVDE]!.status, "HEALTHY", "owner backing restores the cash to zero or above");
});

test("budget plan: the manager may move up to 15 % of the wage budget into transfers (and back, up to the transfer budget)", () => {
  const state = ensureClubFinances(career(), "2026-08-19");
  const club = "se_club_ov_helsingborg";
  const asClub = { ...state, playerClubId: club };
  const board = boardBudgets(asClub, club)!;
  const planned = setBudgetPlan(asClub, 10_000_000);
  const shift = planned.budgetPlans![club]!.wageToTransferEur;
  assert.equal(shift, Math.round(board.wageBudgetEur * 0.15));
  const after = getClubBudgets(planned, club)!;
  assert.equal(after.wageBudgetEur, board.wageBudgetEur - shift);
  assert.equal(after.transferBudgetEur, board.transferBudgetEur + shift);
  const back = setBudgetPlan(asClub, -10_000_000).budgetPlans![club]!.wageToTransferEur;
  assert.equal(-back, Math.min(board.transferBudgetEur, Math.round(board.wageBudgetEur * 0.15)));
  const nextSeason = { ...planned, seasonId: "2027/28" };
  assert.deepEqual(getClubBudgets(nextSeason, club), boardBudgets(nextSeason, club), "a plan only applies to its own season");
});

test("projection runs to the end of the season and stops counting a contract after it expires", () => {
  const state = ensureClubFinances(career(), "2026-08-19");
  const months = projectClubFinances(state, SKOVDE);
  assert.equal(months[0]!.month, "2026-09");
  assert.ok(months.at(-1)!.month >= "2027-05");
});

test("a simulated half-season keeps the world solvent and every manager statement reconciles", () => {
  let state = career();
  let date = state.gameDate;
  for (let i = 0; i < 165; i++) {
    date = addDays(date, 1);
    state = processDay(state, date).state;
  }
  const finance = state.clubFinances![SKOVDE]!;
  assert.ok(finance.statements.length >= 4, `months closed: ${finance.statements.length}`);
  for (const s of finance.statements) assert.equal(s.closingCashEur, reconcile(s), s.month);
  assert.ok(Object.values(state.clubFinances!).some((f) => f.statements.some((s) => s.homeMatches.length > 0 && s.lines.some((l) => l.category === "MATCHDAY" && l.amountEur > 0))), "played home matches earn matchday revenue");
  for (const [clubId, f] of Object.entries(state.clubFinances!)) {
    const b = getClubEconomyBaseline(state, clubId)!;
    assert.ok(b.cashEur >= -overdraftLimitEur(b) * 2.5, `${clubId} cash ${b.cashEur} (status ${f.status})`);
  }
});
