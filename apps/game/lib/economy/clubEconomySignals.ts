// HM-DATA-ALLSVENSKAN-1.0: a lightweight, additive per-club economic
// SIGNAL that nudges which band clubEconomyGeneration.ts's own weighted
// roll tends to land on -- it never overrides Economy 1.0's own
// generation formula, revenue ranges, or ratios (Part: "skriv inte över
// canonical economy med godtyckliga exakta siffror från kvalitativa
// labels"). Every entry here mirrors a CLUB IDENTITY v0.1 source
// profile's own EXPLICIT, unambiguous financialStrategicIdentity claim
// -- a club whose profile leaves financial strength UNKNOWN (most of
// them) simply has no entry here and generates under its tier's plain
// default distribution, exactly as before this milestone (Part:
// "UNKNOWN ska få fortsätta vara unknown").
import type { EconomicBand } from "./clubEconomyTypes";

export const ECONOMIC_SIGNAL_STRENGTHS = ["VERY_STRONG", "STRONG", "BALANCED", "WEAK", "SEVERE_PRESSURE"] as const;
export type EconomicSignalStrength = (typeof ECONOMIC_SIGNAL_STRENGTHS)[number];

/**
 * clubId -> the club's own explicit qualitative financial-posture claim,
 * sourced directly from its CLUB IDENTITY v0.1 profile
 * (financialStrategicIdentity domain). See
 * data/real-world/sweden/2026-27/allsvenskan/identity/club/<clubId>.json
 * for the exact claim each entry reflects.
 */
export const CLUB_ECONOMIC_SIGNAL: Partial<Record<string, EconomicSignalStrength>> = {
  "swe2-varberg": "VERY_STRONG", // "financially very strong by Herrallsvenskan standards, approximately comparable to a mid-table Handbollsligan club"
  "swe2-kungalv": "BALANCED", // "neither a financially powerful Allsvenskan club nor in acute financial distress" -- the source's own explicit calibration baseline
  "swe2-h43lund": "BALANCED", // recent liquidity stress, publicly stabilized -- back to a normal baseline, not currently in crisis
  "swe2-drott": "WEAK", // "operated under difficult economic conditions for roughly a decade"
  "swe2-tyreso": "WEAK", // "low resources... but financially disciplined" -- low spending power, not instability
  "swe2-tumba": "WEAK", // explicit "svag ekonomi"
  "swe2-ystad2": "WEAK", // "underlying finances remain constrained" -- the Gottfridsson contract is explicitly ring-fenced/external, never inherited by the club's own recurring economy
  "swe2-guif": "SEVERE_PRESSURE", // "severe financial pressure... 2026 rebuild/restart after previous economic turbulence"
};

/** Section-11-style override tables, same shape as TIER_BAND_WEIGHTS -- only for signals that actually shift the distribution (BALANCED/WEAK deliberately use the club's own tier default unchanged, since that default already represents a normal-to-struggling Allsvenskan club). */
export const SIGNAL_BAND_WEIGHT_OVERRIDES: Partial<Record<EconomicSignalStrength, readonly (readonly [EconomicBand, number])[]>> = {
  // Borrows tier-1's own richer distribution wholesale -- lets a specific tier-2 club with a documented strong economy reach E4/E5 territory its own league tier would otherwise never allow.
  VERY_STRONG: [
    ["E4", 5],
    ["E5", 15],
    ["E6", 55],
    ["E7", 25],
  ],
  STRONG: [
    ["E5", 20],
    ["E6", 55],
    ["E7", 25],
  ],
  // Forces the poorest band deterministically -- a club in explicit severe financial pressure should never generate as merely "small semi-pro", it should generate as the smallest tier this model has.
  SEVERE_PRESSURE: [["E7", 100]],
};
