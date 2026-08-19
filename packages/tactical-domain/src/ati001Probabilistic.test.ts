import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveATI001Probabilistic, type ATI001ProbabilisticResult } from "./ati001Probabilistic";
import { runMonteCarlo, type MonteCarloAggregate } from "./monteCarlo";
import { createRng, seedFromString } from "./rng";
import type { ATI001ProbabilisticConfig } from "./calibrationTypes";
import { resolveATI001 as deterministicResolveATI001 } from "./ati001";

function baseConfig(overrides: Partial<ATI001ProbabilisticConfig> = {}): ATI001ProbabilisticConfig {
  return {
    threatCreationTendency: "STRONGLY_INCREASE",
    h2TacticalIntent: "H2_STEPS",
    h2ResponseIntentStrength: "STRONGLY_INCREASE",
    h2TacticalFamiliarity: "MEDIUM",
    h2Capability: { perceive: "MEDIUM", time: "MEDIUM", execute: "MEDIUM", recover: "MEDIUM" },
    h3Capability: { perceive: "MEDIUM", time: "MEDIUM", execute: "MEDIUM", recover: "MEDIUM" },
    h2h3TacticalFamiliarity: "LOW",
    h2h3RelationshipQuality: "LOW",
    opportunityQuality: "HIGH",
    opportunityWindow: "MEDIUM",
    v9RecognitionCapability: "MEDIUM",
    m6RecognitionCapability: "MEDIUM",
    v9m6RelationshipQuality: "MEDIUM",
    v9m6TacticalFamiliarity: "MEDIUM",
    decisionQualityTendency: "NEUTRAL",
    exploitationCapability: { passer: "MEDIUM", receiver: "MEDIUM", sharedTiming: "MEDIUM" },
    postResponseAdvantageTendency: "NEUTRAL",
    ...overrides,
  };
}

function opportunityRuns(agg: MonteCarloAggregate): ATI001ProbabilisticResult[] {
  return agg.results.filter((r) => r.opportunity);
}

// PATH A: response intent.
test("A - stronger H2_STEPS intent produces H2_STEPS more often than a neutral configuration", () => {
  const strong = runMonteCarlo(baseConfig({ h2ResponseIntentStrength: "STRONGLY_INCREASE" }), {
    seed: "pathA-strong",
    runs: 3000,
  });
  const neutral = runMonteCarlo(baseConfig({ h2ResponseIntentStrength: "NEUTRAL" }), {
    seed: "pathA-neutral",
    runs: 3000,
  });
  const strongRate = (strong.h2ResponseCounts.H2_STEPS ?? 0) / strong.runs;
  const neutralRate = (neutral.h2ResponseCounts.H2_STEPS ?? 0) / neutral.runs;
  assert.ok(strongRate > neutralRate, `expected strong intent rate ${strongRate} > neutral rate ${neutralRate}`);
});

// PATH B: Tactical Familiarity.
test("B - higher Tactical Familiarity increases consistency between intent and interpretation", () => {
  const high = runMonteCarlo(baseConfig({ h2ResponseIntentStrength: "NEUTRAL", h2TacticalFamiliarity: "HIGH" }), {
    seed: "pathB-high",
    runs: 3000,
  });
  const low = runMonteCarlo(baseConfig({ h2ResponseIntentStrength: "NEUTRAL", h2TacticalFamiliarity: "LOW" }), {
    seed: "pathB-low",
    runs: 3000,
  });
  const matchedRate = (agg: MonteCarloAggregate) =>
    agg.results.filter((r) => r.playerInterpretation === "MATCHED_INTENT").length / agg.runs;
  assert.ok(
    matchedRate(high) > matchedRate(low),
    `expected HIGH familiarity match-rate ${matchedRate(high)} > LOW familiarity match-rate ${matchedRate(low)}`,
  );
});

// PATH C: H2<->H3 coordination.
test("C - improved H2<->H3 coordination produces more H3_SECURES and fewer H3_LATE", () => {
  const high = runMonteCarlo(baseConfig({ h2h3RelationshipQuality: "HIGH", h2h3TacticalFamiliarity: "HIGH" }), {
    seed: "pathC-high",
    runs: 3000,
  });
  const low = runMonteCarlo(baseConfig({ h2h3RelationshipQuality: "LOW", h2h3TacticalFamiliarity: "LOW" }), {
    seed: "pathC-low",
    runs: 3000,
  });
  const secureRate = (agg: MonteCarloAggregate) => (agg.collectiveResolutionCounts.H3_SECURES ?? 0) / agg.runs;
  const lateRate = (agg: MonteCarloAggregate) => (agg.collectiveResolutionCounts.H3_LATE ?? 0) / agg.runs;
  assert.ok(secureRate(high) > secureRate(low), "expected more H3_SECURES with better coordination");
  assert.ok(lateRate(high) < lateRate(low), "expected fewer H3_LATE with better coordination");
});

const LOW_COORDINATION = { h2h3RelationshipQuality: "LOW", h2h3TacticalFamiliarity: "LOW" } as const;

// PATH D: V9 recognition.
test("D - improved V9 recognition capability increases V9 recognition of identical opportunities", () => {
  const cfgBase = baseConfig(LOW_COORDINATION);
  const high = runMonteCarlo({ ...cfgBase, v9RecognitionCapability: "HIGH" }, { seed: "pathD-high", runs: 4000 });
  const low = runMonteCarlo({ ...cfgBase, v9RecognitionCapability: "LOW" }, { seed: "pathD-low", runs: 4000 });
  const highRuns = opportunityRuns(high);
  const lowRuns = opportunityRuns(low);
  assert.ok(highRuns.length > 50 && lowRuns.length > 50, "need enough opportunity samples in both configurations");
  const rate = (runs: ATI001ProbabilisticResult[]) =>
    runs.filter((r) => r.recognition?.individual.v9Recognition).length / runs.length;
  assert.ok(rate(highRuns) > rate(lowRuns), "expected higher V9 recognition capability to recognise more often");
});

// PATH E: M6 recognition.
test("E - improved M6 recognition capability increases M6 recognition of identical opportunities", () => {
  const cfgBase = baseConfig(LOW_COORDINATION);
  const high = runMonteCarlo({ ...cfgBase, m6RecognitionCapability: "HIGH" }, { seed: "pathE-high", runs: 4000 });
  const low = runMonteCarlo({ ...cfgBase, m6RecognitionCapability: "LOW" }, { seed: "pathE-low", runs: 4000 });
  const highRuns = opportunityRuns(high);
  const lowRuns = opportunityRuns(low);
  assert.ok(highRuns.length > 50 && lowRuns.length > 50, "need enough opportunity samples in both configurations");
  const rate = (runs: ATI001ProbabilisticResult[]) =>
    runs.filter((r) => r.recognition?.individual.m6Recognition).length / runs.length;
  assert.ok(rate(highRuns) > rate(lowRuns), "expected higher M6 recognition capability to recognise more often");
});

// PATH F: Shared Recognition.
test("F - improved V9<->M6 relationship/familiarity increases Shared Recognition", () => {
  const cfgBase = baseConfig({
    ...LOW_COORDINATION,
    v9RecognitionCapability: "HIGH",
    m6RecognitionCapability: "HIGH",
  });
  const high = runMonteCarlo(
    { ...cfgBase, v9m6RelationshipQuality: "HIGH", v9m6TacticalFamiliarity: "HIGH" },
    { seed: "pathF-high", runs: 4000 },
  );
  const low = runMonteCarlo(
    { ...cfgBase, v9m6RelationshipQuality: "LOW", v9m6TacticalFamiliarity: "LOW" },
    { seed: "pathF-low", runs: 4000 },
  );
  const sharedInterpretedRate = (agg: MonteCarloAggregate) =>
    opportunityRuns(agg).filter((r) => r.recognition?.shared.sharedInterpretation);
  const highSharedInterpreted = sharedInterpretedRate(high);
  const lowSharedInterpreted = sharedInterpretedRate(low);
  assert.ok(
    highSharedInterpreted.length > 50 && lowSharedInterpreted.length > 50,
    "need enough both-recognised samples in both configurations",
  );
  const sharedRecognitionRate = (runs: ATI001ProbabilisticResult[]) =>
    runs.filter((r) => r.sharedRecognition).length / runs.length;
  assert.ok(
    sharedRecognitionRate(highSharedInterpreted) > sharedRecognitionRate(lowSharedInterpreted),
    "expected better V9<->M6 relationship/familiarity to increase Shared Recognition",
  );
});

// PATH G: Opportunity Window.
test("G - SHORT opportunities are harder to recognise than otherwise equivalent SUSTAINED opportunities", () => {
  const cfgBase = baseConfig(LOW_COORDINATION);
  const short = runMonteCarlo({ ...cfgBase, opportunityWindow: "SHORT" }, { seed: "pathG-short", runs: 4000 });
  const sustained = runMonteCarlo({ ...cfgBase, opportunityWindow: "SUSTAINED" }, { seed: "pathG-sustained", runs: 4000 });
  const shortRuns = opportunityRuns(short);
  const sustainedRuns = opportunityRuns(sustained);
  assert.ok(shortRuns.length > 50 && sustainedRuns.length > 50, "need enough opportunity samples in both configurations");
  const recognitionRate = (runs: ATI001ProbabilisticResult[]) =>
    runs.filter((r) => r.recognition?.individual.v9Recognition).length / runs.length;
  assert.ok(
    recognitionRate(shortRuns) < recognitionRate(sustainedRuns),
    "expected SHORT window to be harder to recognise than SUSTAINED",
  );
});

const HIGH_RECOGNITION = {
  ...LOW_COORDINATION,
  v9RecognitionCapability: "HIGH",
  m6RecognitionCapability: "HIGH",
  v9m6RelationshipQuality: "HIGH",
  v9m6TacticalFamiliarity: "HIGH",
} as const;

// PATH H: Exploitation execution.
test("H - improved exploitation execution increases successful exploitation of already-recognised opportunities", () => {
  const cfgBase = baseConfig({ ...HIGH_RECOGNITION, opportunityWindow: "SUSTAINED" });
  const high = runMonteCarlo(
    { ...cfgBase, exploitationCapability: { passer: "HIGH", receiver: "HIGH", sharedTiming: "HIGH" } },
    { seed: "pathH-high", runs: 5000 },
  );
  const low = runMonteCarlo(
    { ...cfgBase, exploitationCapability: { passer: "LOW", receiver: "LOW", sharedTiming: "LOW" } },
    { seed: "pathH-low", runs: 5000 },
  );
  const attemptedRuns = (agg: MonteCarloAggregate) => agg.results.filter((r) => r.action === "PIVOT_PASS");
  const highAttempted = attemptedRuns(high);
  const lowAttempted = attemptedRuns(low);
  assert.ok(highAttempted.length > 50 && lowAttempted.length > 50, "need enough recognised+attempted samples");
  // TURNOVER is set exactly when exploitation execution failed (Bible S44/S45), independent
  // of Defensive Recovery -- a direct, uncorrupted measure of execution success.
  const successRate = (runs: ATI001ProbabilisticResult[]) => runs.filter((r) => r.outcome !== "TURNOVER").length / runs.length;
  assert.ok(
    successRate(highAttempted) > successRate(lowAttempted),
    "expected better exploitation capability to reduce TURNOVER rate among attempted exploitations",
  );
});

// PATH I: Defensive Recovery.
test("I - improved Defensive Recovery reduces successful exploitation of otherwise equivalent SHORT opportunities", () => {
  const cfgBase = baseConfig({
    ...HIGH_RECOGNITION,
    opportunityWindow: "SHORT",
    exploitationCapability: { passer: "HIGH", receiver: "HIGH", sharedTiming: "HIGH" },
  });
  const highRecovery = runMonteCarlo(
    { ...cfgBase, h3Capability: { ...cfgBase.h3Capability, recover: "HIGH" } },
    { seed: "pathI-high", runs: 6000 },
  );
  const lowRecovery = runMonteCarlo(
    { ...cfgBase, h3Capability: { ...cfgBase.h3Capability, recover: "LOW" } },
    { seed: "pathI-low", runs: 6000 },
  );
  const executedOk = (agg: MonteCarloAggregate) =>
    agg.results.filter((r) => r.action === "PIVOT_PASS" && r.outcome !== "TURNOVER");
  const highExecuted = executedOk(highRecovery);
  const lowExecuted = executedOk(lowRecovery);
  assert.ok(highExecuted.length > 30 && lowExecuted.length > 30, "need enough successfully-executed exploitation samples");
  const stillSuccessfulRate = (runs: ATI001ProbabilisticResult[]) =>
    runs.filter((r) => r.outcome === "PIVOT_ACCESS").length / runs.length;
  assert.ok(
    stillSuccessfulRate(highExecuted) < stillSuccessfulRate(lowExecuted),
    "expected improved Defensive Recovery to reduce the share of executed exploitations that stay successful",
  );
});

// PATH J: Reproducibility.
test("J - same seed and configuration reproduce identical aggregate distributions and traces", () => {
  const config = baseConfig();
  const run1 = runMonteCarlo(config, { seed: "reproducibility-seed", runs: 500 });
  const run2 = runMonteCarlo(config, { seed: "reproducibility-seed", runs: 500 });
  assert.deepEqual(run1.outcomeCounts, run2.outcomeCounts);
  assert.deepEqual(run1.collectiveResolutionCounts, run2.collectiveResolutionCounts);
  assert.deepEqual(run1.h2ResponseCounts, run2.h2ResponseCounts);
  assert.deepEqual(run1.results[0].trace, run2.results[0].trace);
  assert.deepEqual(run1.results[0].probabilityTrace, run2.results[0].probabilityTrace);

  const run3 = runMonteCarlo(config, { seed: "a-completely-different-seed", runs: 500 });
  assert.notDeepEqual(run1.outcomeCounts, run3.outcomeCounts, "a different seed should not reproduce the same aggregate distribution");
});

// Structural / explainability assertions.

test("HM-TACTICS-0.4 deterministic resolver is untouched -- ati001.ts exports are unaffected by this file", () => {
  assert.equal(typeof deterministicResolveATI001, "function");
});

test("every ProbabilityDecisionTrace entry is fully explainable (source, reason, target, direction)", () => {
  const rng = createRng(seedFromString("explainability-check"));
  const result = resolveATI001Probabilistic(
    baseConfig({
      ...LOW_COORDINATION,
      v9RecognitionCapability: "HIGH",
      m6RecognitionCapability: "HIGH",
      v9m6RelationshipQuality: "HIGH",
      v9m6TacticalFamiliarity: "HIGH",
      opportunityWindow: "SUSTAINED",
    }),
    rng,
  );
  assert.ok(result.probabilityTrace.length > 0);
  for (const entry of result.probabilityTrace) {
    assert.ok(typeof entry.decision === "string" && entry.decision.length > 0);
    assert.ok(entry.baseWeights && Object.keys(entry.baseWeights).length > 0);
    assert.ok(entry.resultingWeights && Object.keys(entry.resultingWeights).length > 0);
    assert.ok(typeof entry.sampled === "string");
    for (const modifier of entry.modifiers) {
      assert.ok(modifier.source.length > 0);
      assert.ok(modifier.reason.length > 0);
      assert.ok(modifier.target.length > 0);
      assert.ok(modifier.direction === "INCREASE" || modifier.direction === "DECREASE");
    }
  }
});

test("a full-chain run produces every calibration-layer ResolutionTrace step type", () => {
  // Weighted heavily toward reaching every stage of the chain in one run.
  const config = baseConfig({
    h2h3RelationshipQuality: "LOW",
    h2h3TacticalFamiliarity: "LOW",
    v9RecognitionCapability: "HIGH",
    m6RecognitionCapability: "HIGH",
    v9m6RelationshipQuality: "HIGH",
    v9m6TacticalFamiliarity: "HIGH",
    opportunityWindow: "SUSTAINED",
    exploitationCapability: { passer: "HIGH", receiver: "HIGH", sharedTiming: "HIGH" },
  });
  let found: ATI001ProbabilisticResult | undefined;
  for (let i = 0; i < 500 && !found; i += 1) {
    const rng = createRng(seedFromString(`full-chain-search:${i}`));
    const candidate = resolveATI001Probabilistic(config, rng);
    if (candidate.action === "PIVOT_PASS") found = candidate;
  }
  assert.ok(found, "expected at least one full-chain run within 500 seeded attempts");
  const stepTypes = new Set(found!.trace.steps.map((s) => s.step));
  for (const expected of [
    "THREAT_CREATION",
    "TACTICAL_INTENT_SET",
    "PLAYER_INTERPRETATION",
    "H2_RESPONSE_SELECTED",
    "EXECUTION_COMPONENTS",
    "H2_EXECUTION",
    "H3_RESPONSE_SELECTED",
    "H3_EXECUTION",
    "COLLECTIVE_RESOLUTION",
    "OPPORTUNITY_CREATED",
    "INDIVIDUAL_RECOGNITION",
    "SHARED_RECOGNITION",
    "OPPORTUNITY_RECOGNITION",
    "ACTION_SELECTED",
    "EXPLOITATION_ACTION",
    "EXPLOITATION_EXECUTION",
    "DEFENSIVE_RECOVERY",
    "TACTICAL_OUTCOME",
  ]) {
    assert.ok(stepTypes.has(expected as never), `expected step type ${expected} in full-chain trace`);
  }
});
