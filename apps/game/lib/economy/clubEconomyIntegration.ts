// HM-ECONOMY-1.0: the ONLY module that reads/writes CareerState for club
// economy -- mirrors lib/economy/contractIntegration.ts's own "pure math
// below (clubEconomyGeneration.ts/staffCost.ts), CareerState glue here"
// split. newCareer.ts and saveMigration.ts call
// ensureCareerAllClubEconomies; every UI reader (Club/Finance workspace)
// calls getClubEconomySnapshot.
//
// PERSISTED vs DERIVED, same philosophy as PlayerContract/marketValue.ts:
// only the generated revenue/cash/owner-funding/academy/operating-cost
// BASELINE (ClubEconomyBaseline) is a genuinely sticky fact, persisted
// once. Actual player wage costs, staff costs, financial health and
// every manager-facing budget are DERIVED fresh from that baseline plus
// the club's own CURRENT contracts/staff roster every single read --
// never stored, so a squad change (new contract, CA growth) or a staff
// change is reflected automatically with zero extra bookkeeping, exactly
// like computePlayerMarketValueEur.
//
// SCOPE (Part: "minsta sammanhängande ekonomiska kärnan"): this is the
// foundation layer only -- Revenue Engine, Cost Engine, Financial
// Health, and Board Budget Engine (design doc Sections 3, 6, 7, 8).
// Deliberately NOT built here (see design doc Sections 4/5/9/10/13 for
// the full model): sponsor market/lifecycle, media contract renewal
// cycles, the full owner/investor dynamic layer (funding here is a
// static generated baseline, never injected/withdrawn), promotion/
// relegation structural lag, multi-season inflation/dynamic economy,
// and any transfer-market wiring (TransferRevenue/TransferCosts are
// left at 0 -- no transfer system exists yet). These are the documented
// "next layer" this foundation is built to support.
import { getClub, getClubsByCompetition, getCompetition } from "../game-data";
import { getCareerWorldCompetitionIds } from "../career/worldCompetitions";
import type { CareerState } from "../career/types";
import { ensureCareerGameplayRatings } from "../career/careerRatingNormalization";
import { ensureCareerPlayerContracts } from "./contractIntegration";
import { ensureCareerPlayerClubHistory } from "./clubHistoryIntegration";
import { generateClubEconomyBaseline } from "./clubEconomyGeneration";
import { estimateStaffMonthlyCostEur } from "./staffCost";
import {
  FINANCIAL_PRESSURE_BUDGET_FACTOR,
  HM_SPORTING_CAPACITY_MULTIPLIER,
  HM_TRANSFER_LIQUIDITY_MULTIPLIER,
  LIQUIDITY_HEALTH_THRESHOLDS_MONTHS,
  MINIMUM_CASH_RESERVE_MONTHS,
  STAFF_BUDGET_RATIO,
  STRUCTURAL_HEALTH_THRESHOLDS_RATIO,
  TARGET_SQUAD_COST_RATIO,
} from "./clubEconomyCalibration";
import type {
  ClubBudgets,
  ClubEconomyBaseline,
  ClubEconomySnapshot,
  ClubFinancialHealth,
  FinancialPressureLevel,
  LiquidityHealth,
  StructuralHealth,
} from "./clubEconomyTypes";

/**
 * Fills ONLY a missing club economy baseline for `clubId` -- mirrors
 * ensureCareerPlayerContracts's exact idempotency contract (never
 * touches an existing baseline, true no-op / same reference when
 * nothing missing). Also ensures the club's own gameplay ratings and
 * player contracts exist first, so `getClubEconomySnapshot`'s wage-cost
 * derivation has real data to sum for THIS club, not just the manager's
 * own -- Part: "Player wages ska faktiskt summeras till klubbens
 * spelaråtaganden" applies to every career club, not only the manager's.
 */
const DIVISION_1_COMPETITION_IDS = ["se_division1_norra", "se_division1_sodra"] as const;

/**
 * HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0 Part 14: Division 1's own
 * `Competition.tier` is nominally 2 -- the SAME value Allsvenskan uses,
 * deliberately (see competitions.ts's own doc: chosen purely to avoid
 * widening every `1 | 2`-typed economy signature this generator and its
 * callers share, back when Division 1 clubs never actually reached this
 * generator at all). Now that they do (Part 13: "Same engine... not
 * bespoke rules"), generating a Division 1 baseline at face-value tier-2
 * would hand every Division 1 club an Allsvenskan-sized budget -- Part
 * 14's own explicit "Division 1 should NOT afford HBL/Allsvenskan-level
 * salaries routinely". Rather than widen `generateClubEconomyBaseline`'s
 * shared type signature (a much larger, riskier change touching every
 * caller), this applies one conservative, clearly-labeled downward
 * multiplier to every money field on the generated baseline, Division-1
 * clubs only. Explicitly documented as a GAME CALIBRATION choice, not a
 * researched real-world financial fact (Part 14's own instruction).
 */
const DIVISION_1_ECONOMY_MULTIPLIER = 0.55;

function scaleClubEconomyBaseline(baseline: ClubEconomyBaseline, factor: number): ClubEconomyBaseline {
  return {
    ...baseline,
    revenue: {
      commercialRevenueEur: Math.round(baseline.revenue.commercialRevenueEur * factor),
      mediaRevenueEur: Math.round(baseline.revenue.mediaRevenueEur * factor),
      matchdayRevenueEur: Math.round(baseline.revenue.matchdayRevenueEur * factor),
      sportingRevenueEur: Math.round(baseline.revenue.sportingRevenueEur * factor),
      otherRevenueEur: Math.round(baseline.revenue.otherRevenueEur * factor),
    },
    cashEur: Math.round(baseline.cashEur * factor),
    ownerFundingEur: Math.round(baseline.ownerFundingEur * factor),
    academyBudgetBaselineEur: Math.round(baseline.academyBudgetBaselineEur * factor),
    operatingCostsBaselineEur: Math.round(baseline.operatingCostsBaselineEur * factor),
  };
}

export function ensureCareerClubEconomy(state: CareerState, clubId: string): CareerState {
  let next = ensureCareerGameplayRatings(state, clubId);
  next = ensureCareerPlayerContracts(next, clubId);
  // HM-TRANSFERS-1.0: also ensure THIS club's own players have a club/
  // youth history, so training compensation (lib/economy/trainingCompensation.ts)
  // is computable for a transfer target from ANY club, not only the
  // manager's own -- same idempotent fill-only pattern as the two calls
  // above, reusing the existing generator, never a parallel one.
  next = ensureCareerPlayerClubHistory(next, clubId);

  if (next.clubEconomies[clubId]) return next;

  const competitionId = getClub(clubId)?.competitionId ?? "";
  const tier = getCompetition(competitionId)?.tier;
  let baseline = generateClubEconomyBaseline(clubId, tier);
  if ((DIVISION_1_COMPETITION_IDS as readonly string[]).includes(competitionId)) {
    baseline = scaleClubEconomyBaseline(baseline, DIVISION_1_ECONOMY_MULTIPLIER);
  }
  return { ...next, clubEconomies: { ...next.clubEconomies, [clubId]: baseline } };
}

/**
 * HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: iterates every club across
 * every world-active Swedish competition (Handbollsligan, Allsvenskan,
 * Division 1 Norra/Södra -- Part: "Alla klubbar som finns i career world
 * ska få en persistent ekonomisk baseline"), never only the manager's
 * own competition. Before this milestone: scoped to
 * `getClubsByCompetition(state.competitionId)` only, so Division 1 never
 * got a real budget at all, and whichever Swedish tier ISN'T the
 * manager's own got none either.
 */
export function ensureCareerAllClubEconomies(state: CareerState): CareerState {
  const clubIds = getCareerWorldCompetitionIds(state).flatMap((competitionId) => getClubsByCompetition(competitionId)).map((c) => c.id);
  let next = state;
  for (const clubId of clubIds) {
    next = ensureCareerClubEconomy(next, clubId);
  }
  return next;
}

export function getClubEconomyBaseline(state: CareerState, clubId: string): ClubEconomyBaseline | undefined {
  return state.clubEconomies[clubId];
}

/**
 * HM-TRANSFERS-1.0: the ONE mutation path for a club's own generated
 * cash balance -- everything else in this module is derived/read-only.
 * Transfers are the first thing with a real cash EFFECT (a fee paid,
 * training compensation received); this does not retune Economy 1.0's
 * own GENERATION (bands/ratios/revenue), only lets a real transaction
 * move the sticky `cashEur` fact it already persists. Floored at 0 --
 * a simple floor, never real debt/overdraft modeling (Part: "no debt
 * restructuring" is out of scope). A club with no economy baseline is
 * left untouched (never invents one here).
 */
export function adjustClubCash(state: CareerState, clubId: string, deltaEur: number): CareerState {
  const baseline = state.clubEconomies[clubId];
  if (!baseline) return state;
  const nextCash = Math.max(0, baseline.cashEur + deltaEur);
  if (nextCash === baseline.cashEur) return state;
  return { ...state, clubEconomies: { ...state.clubEconomies, [clubId]: { ...baseline, cashEur: nextCash } } };
}

/**
 * Section 6 PlayerCosts, annualized -- every contract whose own `clubId`
 * matches, summed from `wageEurPerMonth`. HM-ALPHA2-05C: during an
 * active loan the contract stays with the owning club at the full wage;
 * the borrowing club carries `wageShareBorrowingPct` of it and the owner
 * the rest (a pre-05C loan contract, still under the borrower with the
 * share already applied, simply counts for the borrower as before).
 */
export function getClubPlayerWageCostsEurAnnual(state: CareerState, clubId: string): number {
  const activeLoans = new Map(Object.values(state.loans ?? {}).filter((l) => l.active).map((l) => [l.playerId, l]));
  let total = 0;
  for (const c of Object.values(state.playerContracts)) {
    const loan = activeLoans.get(c.playerId);
    if (loan && c.clubId === loan.parentClubId) {
      const borrowingShare = loan.wageShareBorrowingPct / 100;
      if (clubId === loan.parentClubId) total += c.wageEurPerMonth * (1 - borrowingShare) * 12;
      else if (clubId === loan.borrowingClubId) total += c.wageEurPerMonth * borrowingShare * 12;
      continue;
    }
    if (c.clubId === clubId) total += c.wageEurPerMonth * 12;
  }
  return total;
}

/**
 * Section 6 StaffCosts, annualized. HM-STAFF-CAREER-1.0: prefers each
 * member's own persisted `staffEmployment[member.id].wageEurPerMonth`
 * (the real, sticky contract figure -- set at career creation and only
 * ever changed by a real recruitment negotiation) and falls back to the
 * derived staffCost.ts estimate only for a member with no employment
 * record at all (defensive -- should not happen post-migration). Clubs
 * with no staffRoster entry (every club before this milestone snapshotted
 * one for them -- see lib/staff/types.ts's own scope note) simply cost
 * 0, an honest "no staff data available" rather than an invented number.
 */
export function getClubStaffCostsEurAnnual(state: CareerState, clubId: string): number {
  const baseline = getClubEconomyBaseline(state, clubId);
  if (!baseline) return 0;
  const roster = state.staffRoster[clubId] ?? [];
  return roster.reduce((sum, member) => sum + (state.staffEmployment[member.id]?.wageEurPerMonth ?? estimateStaffMonthlyCostEur(member, baseline.band)) * 12, 0);
}

function bucketByDescendingThreshold<T extends string>(value: number, thresholds: readonly (readonly [number, T])[]): T {
  for (const [min, label] of thresholds) {
    if (value >= min) return label;
  }
  return thresholds[thresholds.length - 1][1];
}

const LIQUIDITY_RANK: Record<LiquidityHealth, number> = { STRONG: 0, STABLE: 1, WEAK: 2, CRITICAL: 3 };
const STRUCTURAL_RANK: Record<StructuralHealth, number> = { POSITIVE: 0, BALANCED: 1, NEGATIVE: 2, SEVERE: 3 };

/** Section 7.1: combines LiquidityHealth + StructuralHealth into one FinancialPressure scale -- deterministic rank-sum, never a random label (Part: acceptance criterion "financial health är derived, inte bara ett random label"). */
function derivePressure(liquidityHealth: LiquidityHealth, structuralHealth: StructuralHealth): FinancialPressureLevel {
  const score = LIQUIDITY_RANK[liquidityHealth] + STRUCTURAL_RANK[structuralHealth]; // 0..6
  if (score <= 1) return "NONE";
  if (score === 2) return "WATCH";
  if (score === 3) return "PRESSURED";
  if (score === 4) return "SERIOUS";
  return "CRITICAL";
}

/**
 * Section 7: "A club can therefore report a positive annual result while
 * remaining structurally unhealthy" -- derived fresh from the baseline's
 * generated cash/revenue plus the club's CURRENT real wage/staff costs,
 * never a stored or random label.
 */
export function getClubFinancialHealth(state: CareerState, clubId: string): ClubFinancialHealth | undefined {
  const baseline = getClubEconomyBaseline(state, clubId);
  if (!baseline) return undefined;

  const recurringRevenueEur = sumRevenue(baseline);
  const recurringOperatingCostsEurAnnual = getClubRecurringOperatingCostsEurAnnual(state, clubId, baseline);
  const structuralOperatingResultEur = recurringRevenueEur - recurringOperatingCostsEurAnnual;

  const monthlyBurn = recurringOperatingCostsEurAnnual / 12;
  const monthsOfCashCoverage = monthlyBurn > 0 ? baseline.cashEur / monthlyBurn : Infinity;
  const liquidityHealth = bucketByDescendingThreshold(monthsOfCashCoverage, LIQUIDITY_HEALTH_THRESHOLDS_MONTHS);

  const structuralRatio = recurringRevenueEur > 0 ? structuralOperatingResultEur / recurringRevenueEur : 0;
  const structuralHealth = bucketByDescendingThreshold(structuralRatio, STRUCTURAL_HEALTH_THRESHOLDS_RATIO);

  return {
    liquidityHealth,
    structuralHealth,
    pressure: derivePressure(liquidityHealth, structuralHealth),
    monthsOfCashCoverage,
    structuralOperatingResultEur,
  };
}

function sumRevenue(baseline: ClubEconomyBaseline): number {
  return baseline.revenue.commercialRevenueEur + baseline.revenue.mediaRevenueEur + baseline.revenue.matchdayRevenueEur + baseline.revenue.sportingRevenueEur + baseline.revenue.otherRevenueEur;
}

function getClubRecurringOperatingCostsEurAnnual(state: CareerState, clubId: string, baseline: ClubEconomyBaseline): number {
  return getClubPlayerWageCostsEurAnnual(state, clubId) + getClubStaffCostsEurAnnual(state, clubId) + baseline.operatingCostsBaselineEur;
}

/**
 * Section 8: "The board does not hand the manager the club's cash."
 * WageBudget/StaffBudget/AcademyBudget derive from SUSTAINABLE recurring
 * revenue capacity (never directly from cash); TransferBudget derives
 * from cash/liquidity surplus instead (Section 8.3/Invariant 1: "Never
 * derive TransferBudget directly from RevenueBand"). The HM gameplay
 * uplift (Section 13) is applied to the sustainable-capacity step,
 * BEFORE financial-pressure restriction -- Safeguard 1's own ordering
 * ("Realistic Sustainable Capacity -> HM Gameplay Uplift -> ... ->
 * Financial Health -> Board Restrictions -> ACTUAL MANAGER BUDGET").
 * Owner funding is added AFTER the uplift, unmultiplied (Safeguard 2).
 */
export function getClubBudgets(state: CareerState, clubId: string): ClubBudgets | undefined {
  const baseline = getClubEconomyBaseline(state, clubId);
  const health = getClubFinancialHealth(state, clubId);
  if (!baseline || !health) return undefined;

  const recurringRevenueEur = sumRevenue(baseline);
  const pressureFactor = FINANCIAL_PRESSURE_BUDGET_FACTOR[health.pressure];

  const sustainableWageCapacityEur = recurringRevenueEur * TARGET_SQUAD_COST_RATIO * HM_SPORTING_CAPACITY_MULTIPLIER;
  const wageBudgetEur = Math.round(sustainableWageCapacityEur * pressureFactor);

  const staffBudgetEur = Math.round(recurringRevenueEur * STAFF_BUDGET_RATIO * HM_SPORTING_CAPACITY_MULTIPLIER * pressureFactor);

  // Academy budget is protected relative to wage/staff/transfer -- only reduced under real SERIOUS/CRITICAL pressure, never by the routine WATCH/PRESSURED factor (Section 8.5: "cannot simply be emptied into first-team wages").
  const academyPressureFactor = health.pressure === "SERIOUS" ? 0.75 : health.pressure === "CRITICAL" ? 0.5 : 1.0;
  const academyBudgetEur = Math.round(baseline.academyBudgetBaselineEur * academyPressureFactor);

  const minimumCashReserveEur = (getClubRecurringOperatingCostsEurAnnual(state, clubId, baseline) / 12) * MINIMUM_CASH_RESERVE_MONTHS;
  const liquiditySurplusEur = Math.max(0, baseline.cashEur - minimumCashReserveEur);
  const transferBudgetEur = Math.round(liquiditySurplusEur * HM_TRANSFER_LIQUIDITY_MULTIPLIER * pressureFactor);

  const wageOverBudget = getClubPlayerWageCostsEurAnnual(state, clubId) > wageBudgetEur;

  return { wageBudgetEur, transferBudgetEur, staffBudgetEur, academyBudgetEur, wageOverBudget };
}

/** The full aggregate a UI/report reads -- one call, every derived number assembled consistently. */
export function getClubEconomySnapshot(state: CareerState, clubId: string): ClubEconomySnapshot | undefined {
  const baseline = getClubEconomyBaseline(state, clubId);
  const health = getClubFinancialHealth(state, clubId);
  const budgets = getClubBudgets(state, clubId);
  if (!baseline || !health || !budgets) return undefined;

  const playerWageCostsEurAnnual = getClubPlayerWageCostsEurAnnual(state, clubId);
  const staffCostsEurAnnual = getClubStaffCostsEurAnnual(state, clubId);

  return {
    clubId,
    band: baseline.band,
    provenance: baseline.provenance,
    confidence: baseline.confidence,
    calibrationVersion: baseline.calibrationVersion,
    revenue: baseline.revenue,
    recurringRevenueEur: sumRevenue(baseline),
    playerWageCostsEurAnnual,
    staffCostsEurAnnual,
    operatingCostsEurAnnual: baseline.operatingCostsBaselineEur,
    recurringOperatingCostsEurAnnual: playerWageCostsEurAnnual + staffCostsEurAnnual + baseline.operatingCostsBaselineEur,
    cashEur: baseline.cashEur,
    ownerFundingEur: baseline.ownerFundingEur,
    health,
    budgets,
  };
}
