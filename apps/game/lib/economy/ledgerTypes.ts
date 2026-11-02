// HM-ALPHA3-M02: the club ledger's vocabulary and the one low-level write
// (recordClubTransaction). Kept free of other economy imports so
// clubEconomyIntegration.ts's adjustClubCash can record into it without an
// import cycle; the monthly engine itself lives in ledger.ts.
import type { CareerState } from "../career/types";

/** Recurring lines, posted once per closed month. */
export const RECURRING_INCOME_CATEGORIES = ["SPONSORSHIP", "MEDIA", "MATCHDAY", "SPORTING", "OTHER_INCOME", "ASSOCIATION_SUPPORT"] as const;
export const RECURRING_EXPENSE_CATEGORIES = ["PLAYER_WAGES", "STAFF_WAGES", "OPERATIONS", "CLUB_OPERATIONS"] as const;
/** One-off movements, recorded the day they happen. */
export const ONE_OFF_CATEGORIES = ["TRANSFER_FEES", "TRAINING_COMPENSATION", "SIGNING_COSTS", "PARTNERSHIPS", "PRIZE_MONEY", "OWNER_INJECTION", "STAFF_COMPENSATION", "PLAYER_RELEASE", "OTHER_ONE_OFF"] as const;

export type RecurringIncomeCategory = (typeof RECURRING_INCOME_CATEGORIES)[number];
export type RecurringExpenseCategory = (typeof RECURRING_EXPENSE_CATEGORIES)[number];
export type OneOffCategory = (typeof ONE_OFF_CATEGORIES)[number];
export type LedgerCategory = RecurringIncomeCategory | RecurringExpenseCategory | OneOffCategory;

/** A signed movement: positive = money in, negative = money out. */
export interface LedgerLine {
  category: LedgerCategory;
  amountEur: number;
}

export interface ClubTransaction extends LedgerLine {
  date: string;
  label: string;
}

export interface HomeMatchRevenue {
  fixtureId: string;
  date: string;
  opponentClubId: string;
  attendance: number;
  capacity: number;
  revenueEur: number;
}

/** One closed month: what came in, what went out, and the cash it left. `closingCashEur === openingCashEur + Σ lines + Σ transactions`, exactly. */
export interface MonthlyStatement {
  month: string; // YYYY-MM
  closedOn: string;
  openingCashEur: number;
  closingCashEur: number;
  /** Recurring lines posted at the close. */
  lines: LedgerLine[];
  /** One-off movements dated within (or since the previous close up to) this month. */
  transactions: ClubTransaction[];
  homeMatches: HomeMatchRevenue[];
}

export type FinancialStatus = "HEALTHY" | "OVERDRAFT" | "CRISIS";

export interface ClubFinanceState {
  /** The day the ledger started for this club. Months before the first full month after it are never billed (no retroactive charges). */
  activatedOn: string;
  /** First month the close will bill. */
  firstBillableMonth: string;
  lastClosedMonth: string | null;
  /** Cash right after the previous close (or at activation) -- the next statement's opening balance. */
  cashAtLastCloseEur: number;
  /**
   * Calibration bridge, fixed at activation (see ledger.ts): positive = an
   * annual "club operations" cost the generated baseline does not model;
   * negative = annual association support/grants. Brings each club's
   * starting margin into a believable band; never recomputed, so the
   * manager's later decisions carry their full consequence.
   */
  bridgeEurAnnual: number;
  statements: MonthlyStatement[];
  pendingTransactions: ClubTransaction[];
  status: FinancialStatus;
  statusSince: string;
  /** Season ids in which an emergency rescue was already granted (CPU safety net, at most once per season). */
  rescuedSeasons: string[];
}

/** The manager's adjustment to the board's budget for one season: positive moves wage budget into transfer budget. */
export interface BudgetPlan {
  seasonId: string;
  wageToTransferEur: number;
  approvedOn: string;
}

/** Statements kept per CPU club (the manager's club keeps its full history). */
export const CPU_STATEMENT_HISTORY_MONTHS = 12;

/** Appends a dated one-off movement to the club's pending transactions. A club whose ledger has not started yet only has its cash moved (its first statement opens from the cash at activation). */
export function recordClubTransaction(state: CareerState, clubId: string, transaction: ClubTransaction): CareerState {
  const finance = state.clubFinances?.[clubId];
  if (!finance) return state;
  return { ...state, clubFinances: { ...state.clubFinances, [clubId]: { ...finance, pendingTransactions: [...finance.pendingTransactions, transaction] } } };
}
