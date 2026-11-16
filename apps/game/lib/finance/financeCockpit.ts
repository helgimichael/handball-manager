// Arena Nights -- Finance Cockpit (CLB-06 A) view models: three KPIs, warnings that each end in one verb
// (CLB-06a A), the wage<->transfer reallocation with its board frame and preview (CLB-06c A), the home-match
// fill strip (CLB-06b A), ledger months (CLB-06d A) and the projection band (CLB-06f B).
// Read-only: every figure comes from lib/economy (ledger, budgets, projection); no economy rule lives here.
import type { CareerState } from "../career/types";
import { clampBudgetShift, getClubBudgets, getClubEconomyBaseline, getClubPlayerWageCostsEurAnnual, MAX_BUDGET_SHIFT_SHARE } from "../economy/clubEconomyIntegration";
import { overdraftLimitEur, type ProjectionMonth } from "../economy/ledger";
import { boardBudgets } from "../economy/budgetPlan";
import { monthLabelSv } from "../economy/financeTick";
import type { MonthlyStatement } from "../economy/ledgerTypes";
import { rivalryBetween } from "../media/people";

export type FinanceTone = "good" | "warn" | "bad" | "neutral";

export const seasonEndMonth = (seasonId: string) => `${Number(seasonId.slice(0, 4)) + 1}-05`;

export interface FinanceKpis {
  cashEur: number;
  /** Last closed month's result (closing - opening); null before the first close. */
  lastMonthEur: number | null;
  lastMonth: string | null;
  /** Wage budget minus the current player wage bill, per year. Negative = over budget. */
  wageRoomEur: number;
  wageUse: number;
  seasonEndEur: number | null;
  seasonEndDeltaEur: number | null;
  floorEur: number;
  floorBreach: { month: string } | null;
}

export function financeKpis(state: CareerState, clubId: string, projection: readonly ProjectionMonth[]): FinanceKpis | null {
  const baseline = getClubEconomyBaseline(state, clubId);
  const budgets = getClubBudgets(state, clubId);
  if (!baseline || !budgets) return null;
  const last = state.clubFinances?.[clubId]?.statements.at(-1);
  const wages = getClubPlayerWageCostsEurAnnual(state, clubId);
  const end = projection.filter((p) => p.month <= seasonEndMonth(state.seasonId)).at(-1);
  const floor = -overdraftLimitEur(baseline);
  const breach = projection.find((p) => p.closingCashEur < floor);
  return {
    cashEur: baseline.cashEur,
    lastMonthEur: last ? last.closingCashEur - last.openingCashEur : null,
    lastMonth: last?.month ?? null,
    wageRoomEur: budgets.wageBudgetEur - wages,
    wageUse: budgets.wageBudgetEur > 0 ? wages / budgets.wageBudgetEur : 1,
    seasonEndEur: end ? end.closingCashEur : null,
    seasonEndDeltaEur: end ? end.closingCashEur - baseline.cashEur : null,
    floorEur: floor,
    floorBreach: breach ? { month: breach.month } : null,
  };
}

export interface FinanceAction { id: string; tone: FinanceTone; eyebrow: string; title: string; consequence: string; verb: string; href: string }

/** Every warning ends in exactly one verb that leads to the fix. */
export function financeActions(state: CareerState, clubId: string, projection: readonly ProjectionMonth[]): FinanceAction[] {
  const out: FinanceAction[] = [];
  const status = state.clubFinances?.[clubId]?.status;
  const budgets = getClubBudgets(state, clubId);
  if (!budgets) return out;
  if (status === "CRISIS") out.push({ id: "crisis", tone: "bad", eyebrow: "Kris", title: "Budgetarna är frysta", consequence: "Kassan ligger under kreditgränsen. Transferbudgeten är noll och lönerna frysta tills kassan är över krediten igen.", verb: "Sälj eller låna ut spelare", href: "/career/transfers" });
  else if (status === "OVERDRAFT") out.push({ id: "overdraft", tone: "warn", eyebrow: "Övertrassering", title: "Kassan är negativ", consequence: "Transferbudgeten är stängd tills kassan är positiv. Under kreditgränsen blir det kris med frysta löner.", verb: "Sälj eller låna ut spelare", href: "/career/transfers" });
  const low = projection.find((p) => p.closingCashEur < 0);
  if (low && status === "HEALTHY") out.push({ id: "forecast", tone: "warn", eyebrow: "Prognos", title: `Minus i ${monthLabelSv(low.month)}`, consequence: "Med nuvarande löner och uppskattade matchintäkter går kassan under noll och transferbudgeten stängs.", verb: "Öppna prognosen", href: "/career/finance?section=forecast" });
  if (budgets.wageOverBudget) {
    const wages = getClubPlayerWageCostsEurAnnual(state, clubId);
    const pct = budgets.wageBudgetEur > 0 ? Math.round(((wages - budgets.wageBudgetEur) / budgets.wageBudgetEur) * 100) : null;
    out.push({ id: "wages", tone: "bad", eyebrow: "Löner", title: pct !== null ? `Lönerna ${pct} % över budget` : "Lönerna överskrider budgeten", consequence: "Nya kontrakt och löneförhöjningar stoppas tills avtal går ut eller budgeten flyttas från transfers.", verb: "Se kontrakten", href: "/career/contracts" });
  }
  const plan = state.budgetPlans?.[clubId];
  if (status !== "CRISIS" && (!plan || plan.seasonId !== state.seasonId)) out.push({ id: "budget", tone: "neutral", eyebrow: "Budget", title: "Säsongens budget är inte fördelad", consequence: `Styrelsen låter dig flytta upp till ${Math.round(MAX_BUDGET_SHIFT_SHARE * 100)} % av lönebudgeten till transfers, eller tillbaka.`, verb: "Fördela budgeten", href: "/career/finance?section=budget" });
  return out;
}

export interface BudgetSlider {
  boardWageEur: number;
  boardTransferEur: number;
  activeShiftEur: number;
  /** Slider bounds: -maxInEur (more to wages) .. +maxOutEur (more to transfers). */
  maxOutEur: number;
  maxInEur: number;
  step: number;
  shiftEur: number;
  wageEur: number;
  transferEur: number;
  /** Share of the ±15 % frame used, 0..1. */
  marginUsed: number;
  /** Months of an average squad contract the shift buys (positive) or frees (negative); null without contracts. */
  averageWageEurPerMonth: number | null;
  contractMonths: number | null;
  locked: boolean;
}

/** CLB-06c: the one reallocation the board allows (wages <-> transfers, 1:1, ±15 %), clamped exactly as setBudgetPlan does. */
export function budgetSlider(state: CareerState, clubId: string, draftEur: number): BudgetSlider | null {
  const board = boardBudgets(state, clubId);
  if (!board) return null;
  const plan = state.budgetPlans?.[clubId];
  const activeShiftEur = plan?.seasonId === state.seasonId ? plan.wageToTransferEur : 0;
  const maxOutEur = Math.round(board.wageBudgetEur * MAX_BUDGET_SHIFT_SHARE);
  const maxInEur = Math.round(Math.min(board.transferBudgetEur, board.wageBudgetEur * MAX_BUDGET_SHIFT_SHARE));
  const shiftEur = clampBudgetShift(draftEur, board.wageBudgetEur, board.transferBudgetEur);
  const contracts = Object.values(state.playerContracts ?? {}).filter((c) => c.clubId === clubId && c.wageEurPerMonth > 0);
  const avg = contracts.length ? Math.round(contracts.reduce((n, c) => n + c.wageEurPerMonth, 0) / contracts.length) : null;
  return {
    boardWageEur: board.wageBudgetEur, boardTransferEur: board.transferBudgetEur, activeShiftEur, maxOutEur, maxInEur,
    step: Math.max(1, Math.round(maxOutEur / 30)),
    shiftEur, wageEur: board.wageBudgetEur - shiftEur, transferEur: board.transferBudgetEur + shiftEur,
    marginUsed: shiftEur >= 0 ? (maxOutEur ? shiftEur / maxOutEur : 0) : (maxInEur ? -shiftEur / maxInEur : 0),
    averageWageEurPerMonth: avg,
    contractMonths: avg ? Math.round((-shiftEur / avg) * 10) / 10 : null,
    locked: state.clubFinances?.[clubId]?.status === "CRISIS",
  };
}

export interface HomeGauge { fixtureId: string; date: string; opponentId: string; attendance: number; capacity: number; fill: number; revenueEur: number; derby: boolean }
export function homeGauges(state: CareerState, clubId: string, statements: readonly MonthlyStatement[]): HomeGauge[] {
  return statements.flatMap((s) => s.homeMatches).sort((a, b) => a.date.localeCompare(b.date)).map((m) => ({
    fixtureId: m.fixtureId, date: m.date, opponentId: m.opponentClubId, attendance: m.attendance, capacity: m.capacity,
    fill: m.capacity > 0 ? Math.min(1, m.attendance / m.capacity) : 0, revenueEur: m.revenueEur,
    derby: rivalryBetween(state, clubId, m.opponentClubId).score >= 20,
  }));
}

export interface LedgerMonth { month: string; label: string; netEur: number; closingEur: number; spark: number[]; statement: MonthlyStatement }
/** CLB-06d: newest month first, with the closing-cash path of up to six months ending at that month. */
export function ledgerMonths(statements: readonly MonthlyStatement[]): LedgerMonth[] {
  return statements.map((s, i) => ({
    month: s.month, label: monthLabelSv(s.month), netEur: s.closingCashEur - s.openingCashEur, closingEur: s.closingCashEur,
    spark: [statements[Math.max(0, i - 5)]!.openingCashEur, ...statements.slice(Math.max(0, i - 5), i + 1).map((x) => x.closingCashEur)],
    statement: s,
  })).reverse();
}

/** CLB-06f: the projection as a band -- the upper edge with the estimated matchday income, the lower without it (contracted money only). */
export function projectionBand(projection: readonly ProjectionMonth[]): { month: string; high: number; low: number }[] {
  let estimate = 0;
  return projection.map((p) => { estimate += p.breakdown.matchdayEstimateEur; return { month: p.month, high: p.closingCashEur, low: p.closingCashEur - estimate }; });
}
