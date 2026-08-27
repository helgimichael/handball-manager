// HM-ECONOMY-1.0: pure calibration constants for the Club Economy domain
// -- the ONE place every generated/derived economy number's ratios and
// bands live, mirroring marketValue.ts's own "pure math, tunable
// constants up top" precedent. Sourced from `HANDBALL MANAGER — CLUB
// ECONOMY & COMMERCIAL MODEL v0.1` (Section 11 "Economic Calibration
// Framework", Section 13 "HM Economy Gameplay Layer"). Bands E1-E7 are
// documented there as "generator contexts, not exact accounting
// classifications" -- treated the same way here, never as bookkeeping
// truth.
import type { EconomicBand } from "./clubEconomyTypes";

export const CLUB_ECONOMY_CALIBRATION_VERSION = "CLUB_ECONOMY_GENERIC_FOUNDATION_v0.1";

/**
 * Annual recurring-revenue generator range per band (EUR), Section 11.
 * E1's real-world range is open-ended ("€10m+") -- capped here at a
 * generator ceiling so the deterministic roll has a bounded interval;
 * this is a generator convenience, not a claim that €20m is a real cap.
 */
export const BAND_REVENUE_RANGE_EUR: Record<EconomicBand, readonly [number, number]> = {
  E1: [10_000_000, 20_000_000],
  E2: [6_000_000, 12_000_000],
  E3: [3_000_000, 7_000_000],
  E4: [1_500_000, 4_000_000],
  E5: [800_000, 2_000_000],
  E6: [350_000, 1_000_000],
  E7: [100_000, 500_000],
};

/**
 * Part: "Generera inte alla klubbar till samma ekonomi" -- deterministic
 * per-club band distribution, keyed by Competition.tier (the only real
 * structural signal available; no per-club reputation/finance field
 * exists in this project's data -- confirmed by audit). CALIBRATION
 * STATUS: Swedish handball has no researched revenue anchors in this
 * project's sources, so these weights are an HONEST, LOW-confidence
 * placeholder reflecting real-world knowledge that Swedish handball
 * operates at small-professional/semi-pro scale, never top European
 * scale -- see the module doc on clubEconomyGeneration.ts for exactly
 * what needs later regulatory/financial-report calibration.
 */
export const TIER_BAND_WEIGHTS: Record<1 | 2, readonly (readonly [EconomicBand, number])[]> = {
  1: [
    ["E4", 5],
    ["E5", 15],
    ["E6", 55],
    ["E7", 25],
  ],
  2: [
    ["E6", 15],
    ["E7", 85],
  ],
};

/** Revenue category split, Section 3 -- fixed weights (documented as calibration parameters, not researched per-club splits). Sums to 1. */
export const REVENUE_CATEGORY_WEIGHTS = {
  commercial: 0.3,
  media: 0.2,
  matchday: 0.3,
  sporting: 0.08,
  other: 0.12,
} as const;

/** Section 6: OperatingCosts as a share of recurring revenue. */
export const OPERATING_COST_RATIO = 0.18;
/** Section 8.4/12.2: AcademyBudget baseline as a share of recurring revenue -- club-strategic, never emptied into first-team wages (see clubEconomyIntegration.ts's budget derivation). */
export const ACADEMY_BUDGET_RATIO = 0.05;
/** Section 8.3: "WageBudget is the primary player-spending control" -- sustainable wage capacity as a share of recurring revenue, BEFORE the HM gameplay uplift. */
export const TARGET_SQUAD_COST_RATIO = 0.55;
/** Section 8.3: StaffBudget as a share of recurring revenue. */
export const STAFF_BUDGET_RATIO = 0.12;
/** Cash buffer range, in months of recurring operating cost, used to generate each club's baseline cash balance -- deliberately wide (0.5-4 months) so some clubs are cash-poor despite similar revenue (Part: "Financial Health ska kunna vara svag även om klubben har hög omsättning"). */
export const CASH_BUFFER_MONTHS_RANGE: readonly [number, number] = [0.5, 4.0];
/** Section 8.1: MinimumCashReserve, in months of recurring operating cost, protected before any transfer-budget surplus is computed. */
export const MINIMUM_CASH_RESERVE_MONTHS = 1.0;

/**
 * Section 13: "Reality sets the shape; Handball Manager adds
 * playability at the final sporting-capacity stage." Applied to the
 * SUSTAINABLE WAGE CAPACITY step, never to researched revenue/cash/debt
 * (Section 13.1/13.2 safeguards) -- see clubEconomyIntegration.ts's
 * `deriveClubBudgets`. Preliminary calibration parameters, not locked
 * constants (Part: user's own explicit instruction).
 */
export const HM_SPORTING_CAPACITY_MULTIPLIER = 1.25;
export const HM_TRANSFER_LIQUIDITY_MULTIPLIER = 1.35;

/** Section 7.1/8.5: FinancialPressure reduces discretionary budget allocation without ever erasing existing commitments (see deriveClubBudgets's own OVER_BUDGET note). */
export const FINANCIAL_PRESSURE_BUDGET_FACTOR: Record<import("./clubEconomyTypes").FinancialPressureLevel, number> = {
  NONE: 1.0,
  WATCH: 0.9,
  PRESSURED: 0.75,
  SERIOUS: 0.55,
  CRITICAL: 0.35,
};

/** Section 7 LiquidityHealth: months of cash coverage against recurring operating burn (descending -- first threshold met wins). */
export const LIQUIDITY_HEALTH_THRESHOLDS_MONTHS: readonly (readonly [number, import("./clubEconomyTypes").LiquidityHealth])[] = [
  [6, "STRONG"],
  [3, "STABLE"],
  [1, "WEAK"],
  [0, "CRITICAL"],
];

/** Section 7 StructuralHealth: structuralOperatingResult / recurringRevenue ratio (descending -- first threshold met wins). */
export const STRUCTURAL_HEALTH_THRESHOLDS_RATIO: readonly (readonly [number, import("./clubEconomyTypes").StructuralHealth])[] = [
  [0, "POSITIVE"],
  [-0.08, "BALANCED"],
  [-0.25, "NEGATIVE"],
  [-Infinity, "SEVERE"],
];
