// Arena Nights -- SQD-02l "tightening range bars" (shared with SQD-03, SQD-04, SQD-02m).
// Pure geometry over ALREADY knowledge-gated ranges (PlayerVisibleView.abilityRange / potentialRange,
// resolveMarketValueRange). It never sees or derives a true CA/PA -- it only places a given range on a scale.
import type { KnowledgeTier } from "../knowledge/types";

export interface RangeBarGeometry {
  /** Left edge of the band, 0-100 % of the track. */
  left: number;
  /** Band width, 0-100 % of the track (a point estimate gets a minimum visible width). */
  width: number;
  /** Midpoint of the band on the original scale (for sorting by band midpoint). */
  mid: number;
  /** True when the range has collapsed to one value. */
  exact: boolean;
}

const MIN_WIDTH_PCT = 4;

/** Places [min, max] on a [scaleMin, scaleMax] track. Values outside the scale are clamped. */
export function rangeBarGeometry(range: { min: number; max: number }, scaleMin = 1, scaleMax = 5): RangeBarGeometry {
  const span = Math.max(1e-9, scaleMax - scaleMin);
  const lo = Math.max(scaleMin, Math.min(scaleMax, Math.min(range.min, range.max)));
  const hi = Math.max(scaleMin, Math.min(scaleMax, Math.max(range.min, range.max)));
  const exact = lo === hi;
  // Continuous placement: on a 1-5 scale, 2-4 spans 25 %-75 % of the track.
  let left = ((lo - scaleMin) / span) * 100;
  let width = ((hi - lo) / span) * 100;
  if (width < MIN_WIDTH_PCT) { left = Math.max(0, Math.min(100 - MIN_WIDTH_PCT, left - (MIN_WIDTH_PCT - width) / 2)); width = MIN_WIDTH_PCT; }
  return { left: round1(left), width: round1(width), mid: (lo + hi) / 2, exact };
}

/** Star buckets: a 1-5 star range drawn as five equal cells, [min..max] lit. */
export function starRangeCells(range: { min: number; max: number }): boolean[] {
  return [1, 2, 3, 4, 5].map((s) => s >= Math.min(range.min, range.max) && s <= Math.max(range.min, range.max));
}

/** Plain-language uncertainty for a knowledge tier (Swedish UI copy). */
export const RANGE_TIER_HINT_SV: Record<KnowledgeTier, string> = {
  MINIMAL: "Grov uppskattning -- scouta för att smalna av intervallet.",
  LOW: "Osäker bedömning -- intervallet smalnar av med mer scouting.",
  MEDIUM: "Rimlig bedömning -- ytterligare scouting ger en säkrare bild.",
  HIGH: "Säker bedömning från scoutingen.",
};

function round1(n: number): number { return Math.round(n * 10) / 10; }
