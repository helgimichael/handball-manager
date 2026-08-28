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

// HM-DATA-DIV1-1.0: a SEPARATE, lower population baseline for Division 1
// -- a real tier below Allsvenskan, with almost no calibration/estimate
// coverage, so this baseline (not the shared STANDARD one above) will
// end up shaping most of that tier's CA distribution. Reuses the exact
// same seeded-jitter/clamp mechanism, just centered lower and with a
// wider spread: "not all Division 1 players should be bad" (a genuine
// standout individual can reach CEILING, into solid-Allsvenskan
// territory) while the average sits clearly below both Handbollsligan
// and Allsvenskan's shared STANDARD baseline (122). The PA bonus is
// also widened, so a young high-PA prospect is a real, recurring
// possibility, not a rare edge case -- matching the milestone's own
// "det ska kunna finnas unga spelare med hög PA" requirement. Selecting
// this tier NEVER changes STANDARD's own output for any existing
// Handbollsligan/Allsvenskan clubId (see populationTierForClub below).
const DIVISION_1_BASELINE_CA = 90;
const DIVISION_1_CA_SPREAD = 26;
const DIVISION_1_CA_CEILING = 130; // deliberately stays below the STANDARD tier's own baseline (122) plus its spread, so Division 1 never systematically overlaps fringe Handbollsligan/Allsvenskan calibrated anchors
const DIVISION_1_CA_FLOOR = 55;
const DIVISION_1_PA_MAX_BONUS = 28;

export type PopulationTier = "STANDARD" | "DIVISION_1";

/**
 * HM-WORLD-PLAYER-POOL-1.0: an explicit, self-contained baseline
 * profile -- the international pool's own per-competition-tier lookup
 * (clubContextTier.ts) builds one of these and passes it in as
 * `profileOverride`, bypassing the STANDARD/DIVISION_1 tier lookup
 * entirely. Never affects any existing caller: STANDARD/DIVISION_1
 * behavior is completely unchanged when `profileOverride` is omitted.
 */
export interface PopulationBaselineProfile {
  baselineCA: number;
  caSpread: number;
  caCeiling: number;
  caFloor: number;
  paMaxBonus: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Deterministic game-prior CA for a player with no calibration and no
 * resolved estimate. `clubShift` (from clubContextTier.ts) nudges the
 * baseline -- never a flat per-club bonus, just a shift to the same
 * bounded distribution every club draws from. `tier` defaults to
 * "STANDARD" -- every pre-existing caller (Handbollsligan/Allsvenskan)
 * is byte-identical to before this parameter existed. `profileOverride`
 * (HM-WORLD-PLAYER-POOL-1.0), when provided, replaces the tier lookup
 * entirely -- used only for international-pool clubIds.
 */
export function generateGamePriorCA(playerId: string, clubShift: number, modelVersion: string, tier: PopulationTier = "STANDARD", profileOverride?: PopulationBaselineProfile): number {
  const jitter = seededOffset(`${playerId}:GAME_PRIOR_CA:${modelVersion}`, profileOverride ? profileOverride.caSpread : tier === "DIVISION_1" ? DIVISION_1_CA_SPREAD : CA_SPREAD);
  const baseline = profileOverride ? profileOverride.baselineCA : tier === "DIVISION_1" ? DIVISION_1_BASELINE_CA : BASELINE_CA;
  const floor = profileOverride ? profileOverride.caFloor : tier === "DIVISION_1" ? DIVISION_1_CA_FLOOR : CA_FLOOR;
  const ceiling = profileOverride ? profileOverride.caCeiling : tier === "DIVISION_1" ? DIVISION_1_CA_CEILING : CA_CEILING;
  const value = baseline + clubShift + jitter;
  return Math.round(clamp(value, Math.max(CA_MIN, floor), Math.min(CA_MAX, ceiling)));
}

/**
 * Deterministic game-prior PA: CA plus a small, non-negative, bounded
 * offset -- structurally can never be below CA (Part I), no age/
 * nationality input, no "wonderkid" inflation (the bonus is capped
 * small, wider for Division 1/international wonderkid candidates -- see
 * each profile's own doc).
 */
export function generateGamePriorPA(playerId: string, ca: number, modelVersion: string, tier: PopulationTier = "STANDARD", profileOverride?: PopulationBaselineProfile): number {
  const maxBonus = profileOverride ? profileOverride.paMaxBonus : tier === "DIVISION_1" ? DIVISION_1_PA_MAX_BONUS : PA_MAX_BONUS;
  const rawOffset = seededOffset(`${playerId}:GAME_PRIOR_PA:${modelVersion}`, maxBonus);
  const bonus = clamp(Math.abs(rawOffset), PA_MIN_BONUS, maxBonus);
  return Math.min(CA_MAX, ca + bonus);
}
