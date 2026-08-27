// HM-CONTRACTS-1.0/1.0A/HM-WAGE-MARKET-1.0: the ONE centralized,
// deterministic salary/market-value model. Both are PURE functions of
// already-persistent inputs (CA/PA from gameplayRatings, age from
// dateOfBirth+career gameDate, contract time remaining, league tier,
// position, squad role) -- never stored/cached, recomputed fresh on
// every read (same "derived, never a second source of truth" precedent
// as lib/career/standings.ts's getLiveStandings). This is what makes
// value genuinely DYNAMIC (Part: "Marknadsvärdet ska vara dynamiskt")
// and automatically reflects a developed player's new CA with zero
// extra bookkeeping.
//
// HM-CONTRACTS-1.0A: EUR is the canonical INTERNAL currency (per
// HANDBALL_MANAGER_CLUB_ECONOMY_COMMERCIAL_MODEL_v0.1's own economic
// scale). SEK (or any other display currency) is presentation-only,
// converted at the display boundary (lib/economy/currency.ts), never
// re-entering this module.
//
// HM-WAGE-MARKET-1.0: HM-ECONOMY-1.0's own calibration report proved
// the HM-CONTRACTS-1.0/1.0A-era SALARY_MIN/MAX_EUR_PER_MONTH bounds
// (500/13,000) were NOT compatible with the club purchasing power that
// milestone generates -- 9 of 14 real Handbollsligan clubs landed
// CRITICAL/SERIOUS financial pressure purely because typical squad wage
// bills (~€460k-800k/year) exceeded even a financially healthy club's
// own sustainable wage budget (revenue x TARGET_SQUAD_COST_RATIO x
// HM_SPORTING_CAPACITY_MULTIPLIER, lib/economy/clubEconomyCalibration.ts
// -- deliberately NOT touched here, per explicit instruction "Ändra
// inte Economy 1.0 i smyg"). SALARY_MIN/MAX_EUR_PER_MONTH and
// VALUE_MIN/MAX_EUR below are RE-CALIBRATED against that same
// club-economy population (see clubEconomyCalibrationReport.test.ts's
// own before/after tables) so a typical club can actually afford a
// typical squad, while richer bands (E3-E5) remain comfortably able to
// pay more and the weakest E7 clubs remain realistically pressured --
// financial variance across clubs is intentional, not eliminated.
// The CURVE SHAPE (exponents, age/role/tier/position multiplier
// tables) is UNCHANGED -- only the absolute EUR bounds moved, so every
// existing relative hierarchy (CA ordering, age curve, KEY_PLAYER >
// EMERGENCY, Handbollsligan > Allsvenskan) is preserved exactly,
// proportionally rescaled.
//
// Part: "handboll är INTE fotboll" -- bounded to a realistic Swedish
// handball scale, never football-scale numbers.
import type { MatchRole } from "../matchPlan/types";
import type { Position } from "../rating/types";
import { daysUntilContractEnd } from "./contractLifecycle";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// Shared curve helpers.
// ---------------------------------------------------------------------------

/** CA reference range this economy model scales against -- NOT the same as CA_MIN/CA_MAX's full 1-200 theoretical range (lib/rating/types.ts): those extremes are essentially never reached by generated players, so anchoring the economy curve to them would compress all real players into a tiny sliver near the floor. */
const CA_ECONOMY_FLOOR = 90;
const CA_ECONOMY_CEILING = 185;

function caProgress(ca: number): number {
  return clamp((ca - CA_ECONOMY_FLOOR) / (CA_ECONOMY_CEILING - CA_ECONOMY_FLOOR), 0, 1);
}

/** Piecewise-linear interpolation between (age, multiplier) control points -- smooth, bounded, no cliffs (same "no sudden jump" discipline as lib/medical/injuryRisk.ts's ageRiskModifier). */
function interpolateAgeCurve(age: number | null, points: readonly [number, number][]): number {
  if (age === null) return points[Math.floor(points.length / 2)][1]; // unknown age -- a neutral mid-curve value, never a crash
  if (age <= points[0][0]) return points[0][1];
  if (age >= points[points.length - 1][0]) return points[points.length - 1][1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (age >= x0 && age <= x1) {
      const t = (age - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return points[points.length - 1][1];
}

/** Peak years ~24-29; a smooth, bounded rise from youth and decline past 30 -- never a cliff (Part: "äldre spelare... beter sig rimligt"). Shared by both value and salary (Part 47/first-pass note: a defensible simplification, not a claim wages and valuations age identically in reality). */
const AGE_MULTIPLIER_CURVE: readonly [number, number][] = [
  [17, 0.75],
  [24, 1.0],
  [29, 1.0],
  [33, 0.75],
  [37, 0.4],
  [40, 0.25],
];

function ageMultiplier(age: number | null): number {
  return interpolateAgeCurve(age, AGE_MULTIPLIER_CURVE);
}

const ROLE_MULTIPLIER: Record<MatchRole, number> = {
  KEY_PLAYER: 1.25,
  STARTER: 1.1,
  MAJOR_ROTATION: 1.0,
  ROTATION: 0.9,
  SPECIALIST: 0.95,
  DEVELOPMENT: 0.8,
  EMERGENCY: 0.65,
};

function leagueTierMultiplier(tier: 1 | 2 | undefined): number {
  if (tier === 1) return 1.15;
  if (tier === 2) return 0.85;
  return 1.0; // unknown/other -- neutral, never a penalty for missing data
}

function isGoalkeeper(position: Position): boolean {
  return position === "GK";
}

export interface EconomyProfileInputs {
  ca: number;
  pa: number;
  age: number | null;
  position: Position;
  role: MatchRole;
  competitionTier: 1 | 2 | undefined;
}

// ---------------------------------------------------------------------------
// Market value.
// ---------------------------------------------------------------------------

// HM-WAGE-MARKET-1.0: rescaled to ~0.4x the HM-CONTRACTS-1.0A bounds
// (1,500/550,000), the same proportion SALARY_MIN/MAX below were
// rescaled by, so VALUE and SALARY stay internally consistent (a
// player's transfer-value-to-annual-wage multiple is unchanged) while
// bringing typical values within reach of the transfer budgets
// clubEconomyIntegration.ts now derives (see clubEconomyCalibrationReport.test.ts's
// transfer-affordability table).
const VALUE_MIN_EUR = 600;
const VALUE_MAX_EUR = 220_000;
const VALUE_EXPONENT = 2.3;

function baseValueFromCA(ca: number): number {
  const t = caProgress(ca);
  return VALUE_MIN_EUR + (VALUE_MAX_EUR - VALUE_MIN_EUR) * Math.pow(t, VALUE_EXPONENT);
}

/** Part: young high-headroom players carry a "buy for potential" premium, fading out with age (a 34-year-old's remaining PA headroom is not realistically monetizable). Capped at +60%. */
function potentialMultiplier(ca: number, pa: number, age: number | null): number {
  const headroom = Math.max(0, pa - ca);
  const potentialBonus = clamp(headroom / 100, 0, 0.6);
  const youthFactor = age === null ? 0.5 : clamp(1 - (age - 23) / 15, 0, 1);
  return 1 + potentialBonus * youthFactor;
}

/** Part: an expiring contract discounts value (no transfer leverage; a free agent is signable without a fee). */
function contractTimeMultiplier(daysRemaining: number): number {
  if (daysRemaining <= 0) return 0.5;
  if (daysRemaining <= 180) return 0.65;
  if (daysRemaining <= 365) return 0.85;
  return 1.0;
}

/** Part: "GK fungerar utan separat ekonomimodell" -- ONE shared formula, position is just another bounded coefficient, never a parallel goalkeeper pricing pipeline. */
function positionValueMultiplier(position: Position): number {
  return isGoalkeeper(position) ? 0.9 : 1.0;
}

export function computePlayerMarketValueEur(inputs: EconomyProfileInputs, contractEndDate: string, asOfDate: string): number {
  const daysRemaining = daysUntilContractEnd(contractEndDate, asOfDate);
  const raw =
    baseValueFromCA(inputs.ca) *
    potentialMultiplier(inputs.ca, inputs.pa, inputs.age) *
    ageMultiplier(inputs.age) *
    contractTimeMultiplier(daysRemaining) *
    leagueTierMultiplier(inputs.competitionTier) *
    positionValueMultiplier(inputs.position) *
    ROLE_MULTIPLIER[inputs.role];
  // Rounded to the nearest 100 EUR -- a market value is always an estimate, never false precision.
  return Math.round(clamp(raw, VALUE_MIN_EUR, VALUE_MAX_EUR) / 100) * 100;
}

// ---------------------------------------------------------------------------
// Salary.
// ---------------------------------------------------------------------------

// HM-WAGE-MARKET-1.0: rescaled from the HM-CONTRACTS-1.0A bounds
// (500/13,000) to bring typical squad wage bills within reach of a
// financially healthy club's own sustainable wage budget -- verified
// against the full real Handbollsligan population + IFK Tumba (see
// clubEconomyCalibrationReport.test.ts): at these bounds, most clubs
// carry a real, affordable squad while the weakest-revenue clubs
// remain realistically pressured, instead of 9/14 clubs being
// CRITICAL/SERIOUS purely from wage-scale mismatch. The curve EXPONENT
// is unchanged (Part: preserve the existing CA-to-wage shape).
const SALARY_MIN_EUR_PER_MONTH = 200;
const SALARY_MAX_EUR_PER_MONTH = 5_000;
const SALARY_EXPONENT = 1.8; // less convex than value -- wages scale more linearly with ability than valuations do

function baseSalaryFromCA(ca: number): number {
  const t = caProgress(ca);
  return SALARY_MIN_EUR_PER_MONTH + (SALARY_MAX_EUR_PER_MONTH - SALARY_MIN_EUR_PER_MONTH) * Math.pow(t, SALARY_EXPONENT);
}

function positionSalaryMultiplier(position: Position): number {
  return isGoalkeeper(position) ? 0.95 : 1.0;
}

/** Part: salary is set once at signing (no negotiation yet) -- deliberately no contract-time-remaining or potential-headroom factor here (those move VALUE, not an already-fixed wage). */
export function computePlayerSalaryEurPerMonth(inputs: EconomyProfileInputs): number {
  const raw = baseSalaryFromCA(inputs.ca) * ageMultiplier(inputs.age) * leagueTierMultiplier(inputs.competitionTier) * positionSalaryMultiplier(inputs.position) * ROLE_MULTIPLIER[inputs.role];
  // Rounded to the nearest 50 EUR.
  return Math.round(clamp(raw, SALARY_MIN_EUR_PER_MONTH, SALARY_MAX_EUR_PER_MONTH) / 50) * 50;
}
