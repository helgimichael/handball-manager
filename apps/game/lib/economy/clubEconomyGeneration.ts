// HM-ECONOMY-1.0: deterministic, one-time generation of a club's
// economic baseline (revenue composition, cash, owner funding, academy/
// operating-cost baselines). No real club financial data exists
// anywhere in this project's sources (confirmed by audit -- Club and
// Competition carry no reputation/finance field at all), so every
// output here is honestly GENERATED, LOW-confidence data, exactly like
// HM-CONTRACTS-1.0A's trainingCompensation.ts rule set -- never
// presented as researched fact. Deterministic via seededOffset (never
// Math.random), so the same club always gets the same baseline.
//
// CALIBRATION STATUS: `TIER_BAND_WEIGHTS` (clubEconomyCalibration.ts)
// reflects real-world knowledge that Swedish handball operates at
// small-professional/semi-pro scale, never top-European scale, but has
// NO researched per-club revenue figures behind it. Replace with real
// financial-report-anchored data (provenance "ANCHORED"/"OBSERVED") if
// and when it becomes available for specific clubs.
import { seededOffset } from "../rating/generation/deterministicVariation";
import {
  ACADEMY_BUDGET_RATIO,
  BAND_REVENUE_RANGE_EUR,
  CASH_BUFFER_MONTHS_RANGE,
  CLUB_ECONOMY_CALIBRATION_VERSION,
  OPERATING_COST_RATIO,
  REVENUE_CATEGORY_WEIGHTS,
  STAFF_BUDGET_RATIO,
  TARGET_SQUAD_COST_RATIO,
  TIER_BAND_WEIGHTS,
} from "./clubEconomyCalibration";
import { CLUB_ECONOMIC_SIGNAL, SIGNAL_BAND_WEIGHT_OVERRIDES } from "./clubEconomySignals";
import type { ClubEconomyBaseline, EconomicBand } from "./clubEconomyTypes";

function pickWeightedBand(clubId: string, tier: 1 | 2): EconomicBand {
  const signal = CLUB_ECONOMIC_SIGNAL[clubId];
  const weights = (signal && SIGNAL_BAND_WEIGHT_OVERRIDES[signal]) || TIER_BAND_WEIGHTS[tier];
  const totalWeight = weights.reduce((sum, [, w]) => sum + w, 0);
  const roll = Math.abs(seededOffset(`${clubId}:economy:band`, 1_000_000)) % totalWeight;
  let cursor = 0;
  for (const [band, weight] of weights) {
    cursor += weight;
    if (roll < cursor) return band;
  }
  return weights[weights.length - 1][0]; // unreachable in practice -- rounding-safety fallback only.
}

/** Deterministic value within [min, max], seeded by `seedKey`. */
function seededRange(seedKey: string, min: number, max: number): number {
  const t = (Math.abs(seededOffset(seedKey, 1_000_000)) % 1_000_000) / 1_000_000; // [0, 1)
  return min + t * (max - min);
}

/**
 * Part: "Generera inte alla klubbar till samma ekonomi" -- band picks a
 * revenue RANGE, then a per-club seeded roll within that range picks the
 * actual total, and a further seeded roll picks the cash buffer, owner
 * funding, and small variance -- no two clubs in the same band land on
 * identical numbers.
 */
export function generateClubEconomyBaseline(clubId: string, competitionTier: 1 | 2 | undefined): ClubEconomyBaseline {
  const tier: 1 | 2 = competitionTier ?? 2; // an unknown tier is treated as the more conservative (smaller-economy) tier, never the richer one.
  const band = pickWeightedBand(clubId, tier);
  const [min, max] = BAND_REVENUE_RANGE_EUR[band];
  const recurringRevenueEur = Math.round(seededRange(`${clubId}:economy:revenueTotal`, min, max) / 1_000) * 1_000;

  const revenue = {
    commercialRevenueEur: Math.round(recurringRevenueEur * REVENUE_CATEGORY_WEIGHTS.commercial),
    mediaRevenueEur: Math.round(recurringRevenueEur * REVENUE_CATEGORY_WEIGHTS.media),
    matchdayRevenueEur: Math.round(recurringRevenueEur * REVENUE_CATEGORY_WEIGHTS.matchday),
    sportingRevenueEur: Math.round(recurringRevenueEur * REVENUE_CATEGORY_WEIGHTS.sporting),
    otherRevenueEur: Math.round(recurringRevenueEur * REVENUE_CATEGORY_WEIGHTS.other),
  };

  const operatingCostsBaselineEur = Math.round(recurringRevenueEur * OPERATING_COST_RATIO);
  const academyBudgetBaselineEur = Math.round(recurringRevenueEur * ACADEMY_BUDGET_RATIO);

  // Section 8.1: cash is generated as a buffer against a PROXY for total
  // monthly operating burn (operating + wage + staff), since actual
  // roster wage/staff costs are a separate figure derived later from
  // real CareerState data (clubEconomyIntegration.ts) that this pure,
  // CareerState-free generator cannot see. The proxy uses the same
  // calibration ratios the live budget derivation uses, so the
  // generated cash buffer stays roughly consistent with the real burn a
  // similarly-sized club will actually show once contracts/staff exist.
  const estimatedMonthlyBurnEur = (recurringRevenueEur * (OPERATING_COST_RATIO + TARGET_SQUAD_COST_RATIO + STAFF_BUDGET_RATIO)) / 12;
  const [minBuffer, maxBuffer] = CASH_BUFFER_MONTHS_RANGE;
  const cashBufferMonths = seededRange(`${clubId}:economy:cashBufferMonths`, minBuffer, maxBuffer);
  const cashEur = Math.round((cashBufferMonths * estimatedMonthlyBurnEur) / 1_000) * 1_000;

  const ownerBackedRoll = Math.abs(seededOffset(`${clubId}:economy:ownerBacked`, 100));
  const isOwnerBacked = ownerBackedRoll < 30; // ~30% of clubs get explicit owner backing -- flavor variance, never dynamically simulated in this pass.
  const ownerFundingEur = isOwnerBacked ? Math.round((recurringRevenueEur * seededRange(`${clubId}:economy:ownerFundingFactor`, 0.05, 0.25)) / 1_000) * 1_000 : 0;

  // A club whose CLUB IDENTITY v0.1 profile carries an explicit
  // financial-posture claim (clubEconomySignals.ts) is "ANCHORED" to that
  // real qualitative signal rather than purely "GENERATED" -- still never
  // "OBSERVED" (no real financial figures exist), and the anchor only
  // ever biases which band the same seeded roll lands on, never the
  // revenue/cash formulas themselves.
  const hasSignal = Boolean(CLUB_ECONOMIC_SIGNAL[clubId]);

  return {
    clubId,
    band,
    provenance: hasSignal ? "ANCHORED" : "GENERATED",
    confidence: hasSignal ? "MEDIUM" : "LOW",
    calibrationVersion: CLUB_ECONOMY_CALIBRATION_VERSION,
    revenue,
    cashEur,
    ownerFundingEur,
    academyBudgetBaselineEur,
    operatingCostsBaselineEur,
  };
}
