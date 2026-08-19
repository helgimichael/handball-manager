/**
 * Headless Monte Carlo harness for repeated seeded ATI-001 x TI-001
 * probabilistic resolutions (Bible S84/S89.10). For directional sanity
 * testing only -- not a realism benchmark, and not a claim of real-world
 * probability accuracy (Bible S84).
 */
import { resolveATI001Probabilistic, type ATI001ProbabilisticResult } from "./ati001Probabilistic";
import type { ATI001ProbabilisticConfig } from "./calibrationTypes";
import { createRng, seedFromString } from "./rng";
import type { CollectiveResolution, TacticalOutcome } from "./types";

export interface MonteCarloOptions {
  seed: string;
  runs: number;
}

export interface MonteCarloAggregate {
  runs: number;
  outcomeCounts: Partial<Record<TacticalOutcome, number>>;
  collectiveResolutionCounts: Partial<Record<CollectiveResolution, number>>;
  h2ResponseCounts: Partial<Record<string, number>>;
  results: ATI001ProbabilisticResult[];
}

export function runMonteCarlo(config: ATI001ProbabilisticConfig, options: MonteCarloOptions): MonteCarloAggregate {
  const outcomeCounts: Partial<Record<TacticalOutcome, number>> = {};
  const collectiveResolutionCounts: Partial<Record<CollectiveResolution, number>> = {};
  const h2ResponseCounts: Partial<Record<string, number>> = {};
  const results: ATI001ProbabilisticResult[] = [];

  for (let i = 0; i < options.runs; i += 1) {
    const rng = createRng(seedFromString(`${options.seed}:${i}`));
    const result = resolveATI001Probabilistic(config, rng);
    results.push(result);
    outcomeCounts[result.outcome] = (outcomeCounts[result.outcome] ?? 0) + 1;
    collectiveResolutionCounts[result.collectiveResolution] = (collectiveResolutionCounts[result.collectiveResolution] ?? 0) + 1;
    h2ResponseCounts[result.h2Response] = (h2ResponseCounts[result.h2Response] ?? 0) + 1;
  }

  return { runs: options.runs, outcomeCounts, collectiveResolutionCounts, h2ResponseCounts, results };
}
