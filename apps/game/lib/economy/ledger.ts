// HM-ALPHA3-M02: the monthly club ledger.
//
// Every club with an economy baseline runs the same deterministic books:
// - The ledger starts lazily (activateClubFinances) on the first processed
//   day it is missing -- for a new career or an older save alike. The month
//   it starts in is never billed; the first statement is the first full
//   month after it. Nothing is ever charged retroactively.
// - On the 1st of each month, closeDueMonths closes every month that has
//   ended and not been closed: recurring income (sponsorship, media,
//   sporting, other, matchday from real home attendances) and recurring
//   costs (player wages incl. loan wage sharing, staff wages, operations),
//   plus the one-off transactions recorded since the previous close.
//   `lastClosedMonth` makes a close idempotent: the same month can never be
//   billed twice.
// - Cash may go negative. Below zero a club is in OVERDRAFT; below the
//   overdraft limit it is in CRISIS (budgets freeze, see
//   clubEconomyIntegration.getClubBudgets). Owner backing is drawn first;
//   CPU clubs get one emergency rescue per season so the simulated world
//   never collapses. The manager's club gets no free rescue.
//
// Calibration bridge (an explicit, documented assumption): the generated
// baselines leave most clubs with large structural surpluses and a few
// with deep deficits (e.g. +1.19 M€/yr vs -0.17 M€/yr at career start).
// Real Swedish clubs run close to break-even through costs and grants the
// baseline does not model (travel, halls, youth sections, municipal and
// association support). At activation each club receives one fixed annual
// line -- "Föreningsdrift & resor" (cost) or "Föreningsstöd & bidrag"
// (income) -- that brings its starting margin into ±6 % of revenue. It is
// never recomputed, so every later wage, transfer or result moves the books.
import { addDays } from "../career/dateUtils";
import { clubCompetitionId, clubCompetitionTier } from "../career/competitionMembership";
import type { CareerFixture, CareerState } from "../career/types";
import { getClub } from "../game-data";
import { computeCalibrationBridgeEur, getClubEconomyBaseline, getClubPlayerWageCostsEurAnnual, getClubStaffCostsEurAnnual, STARTING_MARGIN_BAND, tierRevenueFactor } from "./clubEconomyIntegration";
import type { ClubEconomyBaseline, EconomicBand } from "./clubEconomyTypes";
import { CPU_STATEMENT_HISTORY_MONTHS, type ClubFinanceState, type FinancialStatus, type HomeMatchRevenue, type LedgerLine, type MonthlyStatement } from "./ledgerTypes";

export { computeCalibrationBridgeEur, STARTING_MARGIN_BAND, tierRevenueFactor };
/** Overdraft facility as a share of annual recurring revenue. */
export const OVERDRAFT_LIMIT_SHARE = 0.15;
/** A CPU club this far below its overdraft limit (in multiples of it) receives the once-per-season emergency rescue. */
const CPU_RESCUE_TRIGGER_MULTIPLE = 1.5;

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

function lastDayOfMonth(month: string): string {
  return addDays(`${nextMonth(month)}-01`, -1);
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function recurringRevenueEurAnnual(baseline: ClubEconomyBaseline): number {
  const r = baseline.revenue;
  return r.commercialRevenueEur + r.mediaRevenueEur + r.matchdayRevenueEur + r.sportingRevenueEur + r.otherRevenueEur;
}

export function overdraftLimitEur(baseline: ClubEconomyBaseline): number {
  return Math.round(recurringRevenueEurAnnual(baseline) * OVERDRAFT_LIMIT_SHARE);
}

export function financialStatusFor(cashEur: number, baseline: ClubEconomyBaseline): FinancialStatus {
  if (cashEur >= 0) return "HEALTHY";
  return cashEur >= -overdraftLimitEur(baseline) ? "OVERDRAFT" : "CRISIS";
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export function activateClubFinances(state: CareerState, clubId: string, date: string): CareerState {
  if (state.clubFinances?.[clubId]) return state;
  const baseline = getClubEconomyBaseline(state, clubId);
  if (!baseline) return state;
  const finance: ClubFinanceState = {
    activatedOn: date,
    firstBillableMonth: nextMonth(monthOf(date)),
    lastClosedMonth: null,
    cashAtLastCloseEur: baseline.cashEur,
    bridgeEurAnnual: computeCalibrationBridgeEur(state, clubId, baseline),
    statements: [],
    pendingTransactions: [],
    status: financialStatusFor(baseline.cashEur, baseline),
    statusSince: date,
    rescuedSeasons: [],
  };
  return { ...state, clubFinances: { ...state.clubFinances, [clubId]: finance } };
}

/** Starts the ledger for every club with an economy baseline that does not have one yet. */
export function ensureClubFinances(state: CareerState, date: string): CareerState {
  let next = state;
  for (const clubId of Object.keys(state.clubEconomies)) {
    if (!next.clubFinances?.[clubId]) next = activateClubFinances(next, clubId, date);
  }
  return next;
}

// ---------------------------------------------------------------------------
// Matchday: attendance and revenue
// ---------------------------------------------------------------------------

const CAPACITY_BY_TIER_AND_BAND: Record<number, Partial<Record<EconomicBand, number>>> = {
  1: { E1: 6000, E2: 5500, E3: 5000, E4: 4200, E5: 3500, E6: 2800, E7: 2200 },
  2: { E1: 3000, E2: 2600, E3: 2300, E4: 2000, E5: 1800, E6: 1400, E7: 900 },
};
const BASE_FILL = 0.55;

/** Hall capacity: the club's recorded capacity would win once identity data carries one; until then a band/tier estimate. */
export function venueCapacity(state: CareerState, clubId: string, baseline: ClubEconomyBaseline): number {
  const tier = clubCompetitionTier(state, clubId) ?? 2;
  return CAPACITY_BY_TIER_AND_BAND[tier]?.[baseline.band] ?? (tier === 1 ? 2500 : 1000);
}

function pointsPerGameBefore(state: CareerState, clubId: string, date: string): number | null {
  let points = 0;
  let games = 0;
  for (const f of state.fixtures) {
    if (f.type !== "LEAGUE" || f.date >= date || (f.homeClubId !== clubId && f.awayClubId !== clubId)) continue;
    const r = state.results[f.id];
    if (!r) continue;
    const own = f.homeClubId === clubId ? r.homeGoals : r.awayGoals;
    const opp = f.homeClubId === clubId ? r.awayGoals : r.homeGoals;
    points += own > opp ? 2 : own === opp ? 1 : 0;
    games++;
  }
  return games ? points / games : null;
}

/** Home league fixtures this club has in the current calendar -- the denominator that spreads the baseline matchday revenue over a season. */
function seasonHomeLeagueFixtures(state: CareerState, clubId: string): CareerFixture[] {
  return state.fixtures.filter((f) => f.type === "LEAGUE" && f.homeClubId === clubId);
}

const FIXTURE_IMPORTANCE: Partial<Record<CareerFixture["type"], number>> = { LEAGUE: 0, CUP: 0.05, FRIENDLY: -0.3 };

/** Deterministic attendance for one played home fixture: form, opponent pull, derby, stage and a small fixed per-fixture variation. */
export function homeAttendance(state: CareerState, fixture: CareerFixture, baseline: ClubEconomyBaseline): { attendance: number; capacity: number } {
  const capacity = venueCapacity(state, fixture.homeClubId, baseline);
  const homePpg = pointsPerGameBefore(state, fixture.homeClubId, fixture.date);
  const awayPpg = pointsPerGameBefore(state, fixture.awayClubId, fixture.date);
  const home = getClub(fixture.homeClubId);
  const away = getClub(fixture.awayClubId);
  let fill = BASE_FILL;
  if (homePpg !== null) fill += 0.18 * (homePpg - 1); // -0.18 (losing every game) .. +0.18 (winning every game)
  if (awayPpg !== null) fill += 0.08 * (awayPpg - 1); // a strong visitor draws a crowd
  if (home?.city && away?.city && home.city === away.city) fill += 0.14; // derby
  fill += FIXTURE_IMPORTANCE[fixture.type] ?? 0;
  if (fixture.stage) fill += 0.25; // knockout and qualification ties (M03)
  fill += (hash(`${state.saveSeed}:${fixture.id}:attendance`) - 0.5) * 0.1;
  fill = Math.max(0.2, Math.min(1, fill));
  return { attendance: Math.round(capacity * fill), capacity };
}

/** Revenue for one home fixture, calibrated so an ordinary season of league home games ≈ the baseline matchday revenue. */
export function homeMatchRevenue(state: CareerState, fixture: CareerFixture, baseline: ClubEconomyBaseline): HomeMatchRevenue {
  const { attendance, capacity } = homeAttendance(state, fixture, baseline);
  const homeGames = Math.max(1, seasonHomeLeagueFixtures(state, fixture.homeClubId).length);
  const perAverageGame = baseline.revenue.matchdayRevenueEur / homeGames;
  const revenueEur = Math.round(perAverageGame * (attendance / (capacity * BASE_FILL)) * (fixture.type === "FRIENDLY" ? 0.25 : 1));
  return { fixtureId: fixture.id, date: fixture.date, opponentClubId: fixture.awayClubId, attendance, capacity, revenueEur };
}

// ---------------------------------------------------------------------------
// Monthly close
// ---------------------------------------------------------------------------

/** The recurring lines a club books for `month` (signed: income positive, costs negative) and the home matches behind its matchday line. */
export function recurringLinesForMonth(state: CareerState, clubId: string, month: string): { lines: LedgerLine[]; homeMatches: HomeMatchRevenue[] } {
  const baseline = getClubEconomyBaseline(state, clubId)!;
  const finance = state.clubFinances?.[clubId];
  const tierFactor = tierRevenueFactor(state, clubId);
  const monthly = (annual: number) => Math.round((annual * tierFactor) / 12);

  const hasCalendar = state.fixtures.some((f) => f.type === "LEAGUE" && (f.homeClubId === clubId || f.awayClubId === clubId));
  const homeMatches = hasCalendar
    ? state.fixtures.filter((f) => f.homeClubId === clubId && monthOf(f.date) === month && state.results[f.id]).map((f) => homeMatchRevenue(state, f, baseline))
    : [];
  const matchday = hasCalendar ? Math.round(homeMatches.reduce((s, m) => s + m.revenueEur, 0) * tierFactor) : monthly(baseline.revenue.matchdayRevenueEur);

  const bridge = finance?.bridgeEurAnnual ?? 0;
  const lines: LedgerLine[] = [
    { category: "SPONSORSHIP", amountEur: monthly(baseline.revenue.commercialRevenueEur) },
    { category: "MEDIA", amountEur: monthly(baseline.revenue.mediaRevenueEur) },
    { category: "MATCHDAY", amountEur: matchday },
    { category: "SPORTING", amountEur: monthly(baseline.revenue.sportingRevenueEur) },
    { category: "OTHER_INCOME", amountEur: monthly(baseline.revenue.otherRevenueEur) },
    ...(bridge < 0 ? [{ category: "ASSOCIATION_SUPPORT" as const, amountEur: Math.round(-bridge / 12) }] : []),
    { category: "PLAYER_WAGES", amountEur: -Math.round(getClubPlayerWageCostsEurAnnual(state, clubId) / 12) },
    { category: "STAFF_WAGES", amountEur: -Math.round(getClubStaffCostsEurAnnual(state, clubId) / 12) },
    { category: "OPERATIONS", amountEur: -Math.round(baseline.operatingCostsBaselineEur / 12) },
    ...(bridge > 0 ? [{ category: "CLUB_OPERATIONS" as const, amountEur: -Math.round(bridge / 12) }] : []),
  ];
  return { lines: lines.filter((l) => l.amountEur !== 0), homeMatches };
}

export interface MonthCloseOutcome {
  state: CareerState;
  /** Clubs whose financial status changed at this close (for the manager's notifications). */
  statusChanges: { clubId: string; from: FinancialStatus; to: FinancialStatus; month: string }[];
  closed: { clubId: string; statement: MonthlyStatement }[];
}

function closeMonthForClub(state: CareerState, clubId: string, month: string, closedOn: string, outcome: MonthCloseOutcome): CareerState {
  const finance = state.clubFinances![clubId]!;
  const { lines, homeMatches } = recurringLinesForMonth(state, clubId, month);
  const recurringTotal = lines.reduce((s, l) => s + l.amountEur, 0);
  // Recurring lines are booked on the statement itself, so cash moves directly (adjustClubCash would also record a one-off).
  const before = getClubEconomyBaseline(state, clubId)!;
  let next: CareerState = { ...state, clubEconomies: { ...state.clubEconomies, [clubId]: { ...before, cashEur: before.cashEur + recurringTotal } } };
  let baseline = getClubEconomyBaseline(next, clubId)!;
  let cash = baseline.cashEur;
  let transactions = next.clubFinances![clubId]!.pendingTransactions;

  // Crisis handling: owner backing first; a CPU club deep in crisis receives one rescue per season.
  if (financialStatusFor(cash, baseline) === "CRISIS") {
    const limit = overdraftLimitEur(baseline);
    if (baseline.ownerFundingEur > 0) {
      const injection = Math.min(baseline.ownerFundingEur, -cash);
      next = { ...next, clubEconomies: { ...next.clubEconomies, [clubId]: { ...baseline, ownerFundingEur: baseline.ownerFundingEur - injection, cashEur: cash + injection } } };
      transactions = [...transactions, { date: closedOn, category: "OWNER_INJECTION", label: "Ägartillskott för att täcka underskottet", amountEur: injection }];
    } else if (clubId !== state.playerClubId && cash < -limit * CPU_RESCUE_TRIGGER_MULTIPLE && !finance.rescuedSeasons.includes(state.seasonId)) {
      const injection = -cash - limit;
      next = { ...next, clubEconomies: { ...next.clubEconomies, [clubId]: { ...baseline, cashEur: cash + injection } } };
      transactions = [...transactions, { date: closedOn, category: "OWNER_INJECTION", label: "Krisstöd från sponsorer och kommun", amountEur: injection }];
      next = { ...next, clubFinances: { ...next.clubFinances, [clubId]: { ...next.clubFinances![clubId]!, rescuedSeasons: [...finance.rescuedSeasons, state.seasonId] } } };
    }
    baseline = getClubEconomyBaseline(next, clubId)!;
    cash = baseline.cashEur;
  }

  const statement: MonthlyStatement = { month, closedOn, openingCashEur: finance.cashAtLastCloseEur, closingCashEur: cash, lines, transactions, homeMatches };
  const status = financialStatusFor(cash, baseline);
  const keep = clubId === state.playerClubId ? Infinity : CPU_STATEMENT_HISTORY_MONTHS;
  const statements = [...finance.statements, statement].slice(-keep);
  const current = next.clubFinances![clubId]!;
  next = {
    ...next,
    clubFinances: {
      ...next.clubFinances,
      [clubId]: { ...current, statements, pendingTransactions: [], lastClosedMonth: month, cashAtLastCloseEur: cash, status, statusSince: status === finance.status ? finance.statusSince : closedOn },
    },
  };
  if (status !== finance.status) outcome.statusChanges.push({ clubId, from: finance.status, to: status, month });
  outcome.closed.push({ clubId, statement });
  return next;
}

/** Closes every ended, unclosed, billable month for every club (idempotent). Called by the daily tick; `date` is the day being processed. */
export function closeDueMonths(state: CareerState, date: string): MonthCloseOutcome {
  const outcome: MonthCloseOutcome = { state, statusChanges: [], closed: [] };
  const currentMonth = monthOf(date);
  let next = state;
  for (const clubId of Object.keys(next.clubFinances ?? {})) {
    let finance = next.clubFinances![clubId]!;
    let month = finance.lastClosedMonth ? nextMonth(finance.lastClosedMonth) : finance.firstBillableMonth;
    while (month < currentMonth) {
      next = closeMonthForClub(next, clubId, month, lastDayOfMonth(month) < date ? addDays(lastDayOfMonth(month), 1) : date, outcome);
      finance = next.clubFinances![clubId]!;
      month = nextMonth(month);
    }
  }
  outcome.state = next;
  return outcome;
}

// ---------------------------------------------------------------------------
// Read models for the Financial Centre
// ---------------------------------------------------------------------------

export function sumLines(lines: readonly LedgerLine[], sign: "in" | "out"): number {
  return lines.reduce((s, l) => s + (sign === "in" ? Math.max(0, l.amountEur) : Math.min(0, l.amountEur)), 0);
}

/** Statements of the current season (from 1 July of the season's first year). */
export function seasonStatements(state: CareerState, clubId: string): MonthlyStatement[] {
  const startYear = Number(state.seasonId.slice(0, 4));
  const from = `${startYear}-07`;
  return (state.clubFinances?.[clubId]?.statements ?? []).filter((s) => s.month >= from);
}

export interface ProjectionMonth {
  month: string;
  incomeEur: number;
  expensesEur: number;
  closingCashEur: number;
  /** The parts behind the totals, for the Financial Centre: contracted/recurring income vs the matchday estimate, and each cost line. */
  breakdown: { recurringIncomeEur: number; matchdayEstimateEur: number; homeLeagueGames: number; associationSupportEur: number; playerWagesEur: number; staffWagesEur: number; operationsEur: number; clubOperationsEur: number };
}

/** Contract-aware monthly projection from the current cash to the end of the season (31 May) or `months` ahead, whichever is later. */
export function projectClubFinances(state: CareerState, clubId: string, minMonths = 6): ProjectionMonth[] {
  const baseline = getClubEconomyBaseline(state, clubId);
  const finance = state.clubFinances?.[clubId];
  if (!baseline || !finance) return [];
  const seasonEnd = `${Number(state.seasonId.slice(0, 4)) + 1}-05`;
  const start = finance.lastClosedMonth ? nextMonth(finance.lastClosedMonth) : finance.firstBillableMonth;
  const tierFactor = tierRevenueFactor(state, clubId);
  const homeGames = Math.max(1, seasonHomeLeagueFixtures(state, clubId).length);
  const hasCalendar = homeGames > 0 && state.fixtures.some((f) => f.homeClubId === clubId);
  const staffMonthly = getClubStaffCostsEurAnnual(state, clubId) / 12;
  const out: ProjectionMonth[] = [];
  let cash = baseline.cashEur; // pending one-offs have already moved cash
  let month = start;
  for (let i = 0; i < 24 && (month <= seasonEnd || out.length < minMonths); i++) {
    const monthEnd = lastDayOfMonth(month);
    const r = baseline.revenue;
    const baseIncome = ((r.commercialRevenueEur + r.mediaRevenueEur + r.sportingRevenueEur + r.otherRevenueEur) * tierFactor) / 12;
    const homeThisMonth = state.fixtures.filter((f) => f.type === "LEAGUE" && f.homeClubId === clubId && monthOf(f.date) === month).length;
    const matchday = hasCalendar ? (homeThisMonth * baseline.revenue.matchdayRevenueEur * tierFactor) / homeGames : (baseline.revenue.matchdayRevenueEur * tierFactor) / 12;
    const support = finance.bridgeEurAnnual < 0 ? -finance.bridgeEurAnnual / 12 : 0;
    const wages = contractWagesForMonth(state, clubId, monthEnd);
    const expenses = wages + staffMonthly + baseline.operatingCostsBaselineEur / 12 + Math.max(0, finance.bridgeEurAnnual) / 12;
    const income = baseIncome + matchday + support;
    cash += income - expenses;
    out.push({
      month, incomeEur: Math.round(income), expensesEur: Math.round(expenses), closingCashEur: Math.round(cash),
      breakdown: { recurringIncomeEur: Math.round(baseIncome), matchdayEstimateEur: Math.round(matchday), homeLeagueGames: homeThisMonth, associationSupportEur: Math.round(support), playerWagesEur: Math.round(wages), staffWagesEur: Math.round(staffMonthly), operationsEur: Math.round(baseline.operatingCostsBaselineEur / 12), clubOperationsEur: Math.round(Math.max(0, finance.bridgeEurAnnual) / 12) },
    });
    month = nextMonth(month);
  }
  return out;
}

/** Monthly player-wage cost for contracts still running at `onDate` (loan shares applied as in the ledger). */
export function contractWagesForMonth(state: CareerState, clubId: string, onDate: string): number {
  const loans = new Map(Object.values(state.loans ?? {}).filter((l) => l.active).map((l) => [l.playerId, l]));
  let total = 0;
  for (const c of Object.values(state.playerContracts)) {
    if (c.contractEndDate < onDate) continue;
    const loan = loans.get(c.playerId);
    if (loan && c.clubId === loan.parentClubId) {
      const share = loan.wageShareBorrowingPct / 100;
      if (clubId === loan.parentClubId && loan.endDate >= onDate) total += c.wageEurPerMonth * (1 - share);
      else if (clubId === loan.parentClubId) total += c.wageEurPerMonth;
      else if (clubId === loan.borrowingClubId && loan.endDate >= onDate) total += c.wageEurPerMonth * share;
      continue;
    }
    if (c.clubId === clubId) total += c.wageEurPerMonth;
  }
  return total;
}

export { clubCompetitionId };
