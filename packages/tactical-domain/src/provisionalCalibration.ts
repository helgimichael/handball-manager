/**
 * PROVISIONAL numeric calibration for the ATI-001 x TI-001 probabilistic
 * resolver (HM-TACTICS-0.5).
 *
 * ==========================================================================
 * THESE NUMBERS ARE NOT HANDBALL TRUTH.
 * ==========================================================================
 *
 * They are a technical mapping that lets a small set of approved,
 * symbolic/relative Bible v0.4 concepts (SymbolicModifier, CapabilityLevel,
 * OpportunityWindow) drive a weighted-random sampler, purely so this
 * milestone can prove DIRECTIONAL behaviour ("more coordination -> more
 * H3_SECURES") over many seeded resolutions (Bible S83-S84).
 *
 * - Do not read these values as calibrated real-world handball
 *   probabilities.
 * - Do not use them anywhere outside the sampling helpers in
 *   sampling.ts / ati001Probabilistic.ts.
 * - Do not encode them into ResolutionTrace step content as if they were
 *   domain facts -- ResolutionTrace stays categorical (Bible S51); only
 *   ProbabilityDecisionTrace (Bible S86) is allowed to show weights, and
 *   even there they remain explicitly provisional.
 * - This is the ONLY file in the package that contains numeric magnitudes.
 */
import type { CapabilityLevel, SymbolicModifier } from "./calibrationTypes";
import type { ExecutionQuality, OpportunityWindow } from "./types";

export const PROVISIONAL_CALIBRATION_NOTICE =
  "Provisional, technical, directional-proof-only weights. Not calibrated real-world handball probabilities.";

/** Multiplier applied to a distribution entry favoured by a SymbolicModifier. */
export const SYMBOLIC_MODIFIER_MULTIPLIER: Record<SymbolicModifier, number> = {
  STRONGLY_DECREASE: 0.25,
  DECREASE: 0.5,
  NEUTRAL: 1,
  INCREASE: 2,
  STRONGLY_INCREASE: 4,
};

/**
 * Baseline weights across the four ExecutionQuality categories for a given
 * CapabilityLevel, used when sampling one PERCEIVE/TIME/EXECUTE/RECOVER
 * component (Bible S65-S66). Higher capability shifts weight toward
 * GOOD/EXCELLENT without making POOR impossible.
 */
export const CAPABILITY_EXECUTION_QUALITY_WEIGHTS: Record<CapabilityLevel, Record<ExecutionQuality, number>> = {
  LOW: { POOR: 4, AVERAGE: 2, GOOD: 1, EXCELLENT: 0.5 },
  MEDIUM: { POOR: 1, AVERAGE: 2, GOOD: 2, EXCELLENT: 1 },
  HIGH: { POOR: 0.5, AVERAGE: 1, GOOD: 2, EXCELLENT: 4 },
};

/**
 * Multiplier applied to the "true" side of a binary weighted choice
 * (e.g. recognised / not-recognised) for a given CapabilityLevel.
 */
export const CAPABILITY_BINARY_TRUE_MULTIPLIER: Record<CapabilityLevel, number> = {
  LOW: 0.5,
  MEDIUM: 1,
  HIGH: 2,
};

/**
 * Multiplier applied to the "true" side of a recognition/timing binary
 * choice for a given OpportunityWindow (Bible S75: SHORT increases
 * recognition/timing demand, i.e. reduces the chance of success).
 */
export const OPPORTUNITY_WINDOW_SUCCESS_MULTIPLIER: Record<OpportunityWindow, number> = {
  SHORT: 0.5,
  MEDIUM: 1,
  SUSTAINED: 1.5,
};

/** Base (NEUTRAL, MEDIUM/MEDIUM) weight for a true/false binary choice before any modifiers. */
export const BASE_BINARY_WEIGHT = { TRUE: 1, FALSE: 1 };

/**
 * How strongly the Working-Rule-intended H2 response (Bible S60) starts
 * out favoured over the uniform base prior across the other four
 * responses, before any SymbolicModifier/TacticalFamiliarity is applied.
 */
export const INTENT_BASE_WEIGHT_MULTIPLIER = 3;

/**
 * How strongly the Working-Rule-intended collective response
 * (H3_SECURES, per WR_DEF_H2_H3_STEP_COVER, Bible S3.3) starts out
 * favoured over the uniform base prior across the other four H3
 * responses, before any modifier is applied.
 */
export const COLLECTIVE_SECURES_BASE_WEIGHT_MULTIPLIER = 3;
