/**
 * Generic explainable weighted-sampling helper for the HM-TACTICS-0.5
 * calibration layer (Bible S86: every probabilistic decision must expose
 * base distribution, modifiers, source/reason of each modifier, resulting
 * distribution and sampled result).
 *
 * This file contains no domain knowledge and no numeric magnitudes of its
 * own -- callers supply weights (see provisionalCalibration.ts, the only
 * file allowed to contain numbers) and modifiers with a source/reason.
 */
import type { AppliedProbabilityModifier, ProbabilityDecisionTrace } from "./calibrationTypes";
import type { Rng } from "./rng";

export interface WeightedModifierInput<K extends string> {
  source: string;
  reason: string;
  target: K;
  /** Explanatory only (Bible S48/S86 traceability) -- must match multiplier > 1 / < 1. The math always multiplies. */
  direction: "INCREASE" | "DECREASE";
  /** Always applied as `currentWeight * multiplier`. Values < 1 decrease, values > 1 increase. */
  multiplier: number;
}

export function weightedSample<K extends string>(
  rng: Rng,
  decision: string,
  baseWeights: Record<K, number>,
  modifiers: WeightedModifierInput<K>[],
): { sampled: K; trace: ProbabilityDecisionTrace } {
  const resultingWeights: Record<string, number> = { ...baseWeights };
  const appliedModifiers: AppliedProbabilityModifier[] = [];

  for (const modifier of modifiers) {
    const current = resultingWeights[modifier.target] ?? 0;
    resultingWeights[modifier.target] = current * modifier.multiplier;
    appliedModifiers.push({
      source: modifier.source,
      reason: modifier.reason,
      target: modifier.target,
      direction: modifier.direction,
    });
  }

  const entries = Object.entries(resultingWeights) as [K, number][];
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = rng.nextFloat() * total;
  let sampled: K = entries[entries.length - 1][0];
  for (const [key, weight] of entries) {
    if (roll < weight) {
      sampled = key;
      break;
    }
    roll -= weight;
  }

  return {
    sampled,
    trace: {
      decision,
      baseWeights: { ...baseWeights },
      modifiers: appliedModifiers,
      resultingWeights,
      sampled,
    },
  };
}

export function weightedBoolean(
  rng: Rng,
  decision: string,
  baseTrueWeight: number,
  baseFalseWeight: number,
  modifiers: WeightedModifierInput<"TRUE" | "FALSE">[],
): { sampled: boolean; trace: ProbabilityDecisionTrace } {
  const { sampled, trace } = weightedSample(
    rng,
    decision,
    { TRUE: baseTrueWeight, FALSE: baseFalseWeight },
    modifiers,
  );
  return { sampled: sampled === "TRUE", trace };
}
