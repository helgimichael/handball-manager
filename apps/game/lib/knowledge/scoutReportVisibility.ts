// HM-SCOUTING-1.0: the scout-REPORT-specific extension of this package's
// own TRUE WORLD STATE -> MANAGER KNOWLEDGE -> PLAYER-FACING VIEW
// architecture (see types.ts's header). playerVisibility.ts's
// resolvePlayerVisibility already resolves ability/potential/strengths/
// weaknesses -- this module composes that verbatim (never re-derives it)
// with two report-specific extras a scout report also needs: a
// knowledge-gated MARKET VALUE estimate (a range, not the exact figure,
// at anything below HIGH knowledge) and a short deterministic Swedish
// recommendation. Still fully pure -- no CareerState, no randomness, so
// the exact same inputs always produce the exact same report (Part 5:
// "samma scout + samma knowledge state ska inte rerolla slumpmässigt").
import { knowledgeTier, type KnowledgeTier } from "./types";
import { resolvePlayerVisibility, type KnowledgeRatingInput, type PlayerVisibleView } from "./playerVisibility";

export interface MarketValueRange {
  min: number;
  max: number;
}

/** Relative uncertainty band width around the true canonical market value, by knowledge tier -- wide at MINIMAL (the figure could genuinely be way off), tight at HIGH (close to the real number, never claimed exact). */
const MARKET_VALUE_UNCERTAINTY_BY_TIER: Record<KnowledgeTier, number> = {
  MINIMAL: 0.5,
  LOW: 0.35,
  MEDIUM: 0.2,
  HIGH: 0.08,
};

/**
 * True canonical market value (e.g. from economy/contractIntegration.ts's
 * getPlayerMarketValueEur) -> a knowledge-gated ESTIMATE range. Never
 * hidden entirely, even at MINIMAL knowledge -- Part 9: a manager can
 * still bid on an unscouted player, market value is information, not a
 * gate on the transfer action itself.
 */
export function resolveMarketValueRange(trueValueEur: number, knowledgePct: number, key?: string): MarketValueRange {
  const spread = MARKET_VALUE_UNCERTAINTY_BY_TIER[knowledgeTier(knowledgePct)];
  const estimate = estimatedMarketValueEur(trueValueEur, knowledgePct, key);
  return {
    min: Math.max(0, Math.round(estimate * (1 - spread))),
    max: Math.round(estimate * (1 + spread)),
  };
}

/**
 * HM-ALPHA3-M06 (critical information rule): the club's own estimate of a
 * player's value -- off by up to 60 % of the tier's uncertainty, stable per
 * player, so the shown range is not centred on the true value (which stays
 * inside it). Ranking and filtering of external players use this, never the
 * true value.
 */
export function estimatedMarketValueEur(trueValueEur: number, knowledgePct: number, key?: string): number {
  const spread = MARKET_VALUE_UNCERTAINTY_BY_TIER[knowledgeTier(knowledgePct)];
  const k = key ?? String(Math.round(trueValueEur));
  let h = 2166136261;
  for (let i = 0; i < k.length; i++) { h ^= k.charCodeAt(i); h = Math.imul(h, 16777619); }
  const unit = (h >>> 0) / 4294967295; // 0..1
  return Math.max(0, trueValueEur * (1 + (unit * 2 - 1) * spread * 0.6));
}

export interface ScoutReportView {
  tier: KnowledgeTier;
  visibility: PlayerVisibleView;
  /** null only when no canonical market value could be resolved at all (e.g. no contract) -- never omitted merely for low knowledge. */
  marketValueRange: MarketValueRange | null;
  /** 0-100 -- how much the manager should trust THIS report's estimate. Derived from knowledge level and the filing scout's own suitability; never a raw 1-20 staff attribute shown directly (Part 6: "Ingen raw machine enum i normal UI"). */
  confidencePct: number;
  recommendation: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const RECOMMENDATION_UNKNOWN = "Otillräcklig kännedom för en rekommendation ännu.";

/**
 * Composes the full report view. `scoutSuitability1to20` is null when no
 * report has been filed yet (e.g. Transfers browsing an unscouted
 * player) -- confidence then falls back to a neutral assumption, never a
 * crash or an invented elite/poor scout.
 */
export function buildScoutReportView(
  rating: KnowledgeRatingInput,
  knowledgePct: number,
  trueMarketValueEur: number | undefined,
  scoutSuitability1to20: number | null,
): ScoutReportView {
  const tier = knowledgeTier(knowledgePct);
  const visibility = resolvePlayerVisibility(rating, knowledgePct, scoutSuitability1to20 ?? undefined);
  const marketValueRange = trueMarketValueEur !== undefined ? resolveMarketValueRange(trueMarketValueEur, knowledgePct, rating.playerId) : null;

  const suitabilityFactor = scoutSuitability1to20 !== null ? clamp(scoutSuitability1to20 / 20, 0, 1) : 0.5;
  const confidencePct = Math.round(clamp(knowledgePct * (0.5 + suitabilityFactor * 0.5), 0, 100));

  let recommendation = RECOMMENDATION_UNKNOWN;
  if (tier !== "MINIMAL") {
    const strong = visibility.abilityRange.min >= 4;
    const weak = visibility.abilityRange.max <= 2;
    const highPotential = visibility.potentialRange !== null && visibility.potentialRange.max >= 5;
    if (strong && (highPotential || tier === "HIGH")) recommendation = "Rekommenderas starkt för värvning.";
    else if (strong) recommendation = "Rekommenderas för värvning.";
    else if (highPotential) recommendation = "Ung spelare med god utvecklingspotential -- fortsatt bevakning rekommenderas.";
    else if (weak) recommendation = "Bedöms inte hålla den nivå klubben behöver just nu.";
    else recommendation = "Fortsatt bevakning rekommenderas innan ett slutgiltigt beslut.";
  }

  return { tier, visibility, marketValueRange, confidencePct, recommendation };
}
