// HM-RATINGS-0.6 Part B/C/H: the game-prior CA/PA population model.
// Pure, fs-free, deterministic -- reuses HM-RATINGS-0.4's own seeded-
// variation primitive (Part A: reuse what exists) rather than a new
// randomness mechanism.
//
// Baseline band derived from the Player Rating Model design doc's own
// CA population table (§18 appendix): 116-130 "good Allsvenskan/fringe
// Handbollsligan", 131-150 "functioning/good Handbollsligan". A
// contracted top-two-tier Swedish squad player sits AT LEAST in the
// "good Allsvenskan/fringe Handbollsligan" band; the game-prior
// baseline (122) is centered inside that same band -- high enough to
// represent a real top-flight-or-Allsvenskan squad player, but
// deliberately capped well below the 151+ "very good to top
// Handbollsligan" bands real evidence/calibration already owns (Part L:
// real anchors must remain anchors). HM-DATA-ALLSVENSKAN-1.1: this one
// population model/baseline is now shared, unmodified, across BOTH
// tiers (reuse, not a new system, per that milestone's own scope) --
// see its report for whether the resulting Allsvenskan CA distribution
// should get its own, lower baseline in a future calibration pass.
import { seededOffset } from "../generation/deterministicVariation";
import { CA_MAX, CA_MIN } from "../types";

const BASELINE_CA = 122;
const CA_SPREAD = 22; // deterministic per-player jitter, +/- this many points
const CA_CEILING = 148; // stays below the real evidenced-anchor band (min real anchor CA is 130; several sit at 153-168)
const CA_FLOOR = 96;

const PA_MIN_BONUS = 0;
const PA_MAX_BONUS = 16;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Deterministic game-prior CA for a player with no calibration and no
 * resolved estimate. `clubShift` (from clubContextTier.ts) nudges the
 * baseline -- never a flat per-club bonus, just a shift to the same
 * bounded distribution every club draws from.
 */
export function generateGamePriorCA(playerId: string, clubShift: number, modelVersion: string): number {
  const jitter = seededOffset(`${playerId}:GAME_PRIOR_CA:${modelVersion}`, CA_SPREAD);
  const value = BASELINE_CA + clubShift + jitter;
  return Math.round(clamp(value, Math.max(CA_MIN, CA_FLOOR), Math.min(CA_MAX, CA_CEILING)));
}

/**
 * Deterministic game-prior PA: CA plus a small, non-negative, bounded
 * offset -- structurally can never be below CA (Part I), no age/
 * nationality input, no "wonderkid" inflation (the bonus is capped
 * small).
 */
export function generateGamePriorPA(playerId: string, ca: number, modelVersion: string): number {
  const rawOffset = seededOffset(`${playerId}:GAME_PRIOR_PA:${modelVersion}`, PA_MAX_BONUS);
  const bonus = clamp(Math.abs(rawOffset), PA_MIN_BONUS, PA_MAX_BONUS);
  return Math.min(CA_MAX, ca + bonus);
}
