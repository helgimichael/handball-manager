// HM-ECONOMY-1.0: the Club Economy domain's own vocabulary. Sourced from
// `HANDBALL MANAGER — CLUB ECONOMY & COMMERCIAL MODEL v0.1`. Only the
// minimal, coherent core the design doc's own Section 1-2 architecture
// needs for a first playable pass (revenue, costs, cash, financial
// health, board budgets) -- sponsor market, media contract cycles,
// owner/investor dynamics, dynamic multi-season economy and transfers
// are deliberately out of scope (see clubEconomyIntegration.ts's own
// "next layer" doc note).

/** Section 11: generator contexts, not exact accounting classifications -- they intentionally overlap (doc's own words). */
export const ECONOMIC_BANDS = ["E1", "E2", "E3", "E4", "E5", "E6", "E7"] as const;
export type EconomicBand = (typeof ECONOMIC_BANDS)[number];

/**
 * Section 12.1 "Provenance modes" -- OBSERVED is never used in this
 * project (confirmed by audit: no real club financial data exists in
 * any source), so only the other two modes are reachable today.
 */
export const ECONOMIC_PROVENANCE_MODES = ["OBSERVED", "ANCHORED", "GENERATED"] as const;
export type EconomicProvenance = (typeof ECONOMIC_PROVENANCE_MODES)[number];

export type EconomicConfidence = "HIGH" | "MEDIUM" | "LOW";

/** Section 3: the recurring revenue categories this foundation pass models. TransferRevenue is deliberately excluded from the persisted baseline -- no transfer system exists yet (Part: "Bygg inte transfermarknaden ännu"), so it is always 0/non-recurring rather than a fabricated sticky number. */
export interface ClubRevenueBaselineEur {
  commercialRevenueEur: number;
  mediaRevenueEur: number;
  matchdayRevenueEur: number;
  sportingRevenueEur: number;
  otherRevenueEur: number;
}

/**
 * The ONE persisted, sticky fact set per club -- generated once, same
 * "genuinely sticky facts only" philosophy as PlayerContract
 * (contractEndDate/wageEurPerMonth persisted, market VALUE never
 * persisted). Everything else (actual player wage costs, staff costs,
 * financial health, budgets) is derived FRESH every read from this
 * baseline plus the club's own current CareerState data (contracts,
 * staff roster) -- see clubEconomyIntegration.ts.
 */
export interface ClubEconomyBaseline {
  clubId: string;
  band: EconomicBand;
  provenance: EconomicProvenance;
  confidence: EconomicConfidence;
  calibrationVersion: string;
  revenue: ClubRevenueBaselineEur;
  /** Section 8.1: the club's own generated starting cash/liquidity balance -- annual-recurring-revenue-scaled, NOT itself recurring revenue. */
  cashEur: number;
  /** Section 9: kept explicit and OUTSIDE operating revenue (Part: "Owner Wealth ≠ Club Money") -- mostly 0; a minority of clubs get a modest generated backing figure. Never dynamically simulated (no injections/withdrawals) in this foundation pass. */
  ownerFundingEur: number;
  /** Section 8.5: "AcademyBudget remains primarily club-strategic" -- a generated annual baseline, distinct from the derived wage/transfer/staff budgets below. */
  academyBudgetBaselineEur: number;
  /** Section 6: OperatingCosts baseline (admin/operations) -- generated once alongside revenue, not derived from any per-season simulation. */
  operatingCostsBaselineEur: number;
}

/** Section 7.1. */
export const FINANCIAL_PRESSURE_LEVELS = ["NONE", "WATCH", "PRESSURED", "SERIOUS", "CRITICAL"] as const;
export type FinancialPressureLevel = (typeof FINANCIAL_PRESSURE_LEVELS)[number];

export type LiquidityHealth = "STRONG" | "STABLE" | "WEAK" | "CRITICAL";
export type StructuralHealth = "POSITIVE" | "BALANCED" | "NEGATIVE" | "SEVERE";

/** Section 7: DERIVED every read from cash + current recurring revenue/costs -- never a random label, never persisted. */
export interface ClubFinancialHealth {
  liquidityHealth: LiquidityHealth;
  structuralHealth: StructuralHealth;
  pressure: FinancialPressureLevel;
  monthsOfCashCoverage: number;
  structuralOperatingResultEur: number;
}

/** Section 8.3/8.5: the four manager-facing budgets -- always separate from cash/revenue (Part: "CLUB CASH ≠ AVAILABLE LIQUIDITY ≠ SPORTING BUDGET ≠ TRANSFER BUDGET"). */
export interface ClubBudgets {
  wageBudgetEur: number;
  transferBudgetEur: number;
  staffBudgetEur: number;
  academyBudgetEur: number;
  /** Section 8.5: "A lowered WageBudget does not erase contracts; the club can become OVER_BUDGET." Never used to force anything -- purely informational. */
  wageOverBudget: boolean;
}

/** The full aggregate view a UI/report reads -- baseline + every derived figure, assembled by clubEconomyIntegration.ts's `getClubEconomySnapshot`. */
export interface ClubEconomySnapshot {
  clubId: string;
  band: EconomicBand;
  provenance: EconomicProvenance;
  confidence: EconomicConfidence;
  calibrationVersion: string;
  revenue: ClubRevenueBaselineEur;
  recurringRevenueEur: number;
  playerWageCostsEurAnnual: number;
  staffCostsEurAnnual: number;
  operatingCostsEurAnnual: number;
  recurringOperatingCostsEurAnnual: number;
  cashEur: number;
  ownerFundingEur: number;
  health: ClubFinancialHealth;
  budgets: ClubBudgets;
}
