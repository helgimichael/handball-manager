/**
 * ATI-001 x TI-001 probability-ready calibration resolver (HM-TACTICS-0.5).
 *
 * This EXTENDS, and does not replace, the deterministic resolver in
 * ati001.ts (Bible S85/S90: "Preserve HM-TACTICS-0.4 deterministic
 * behaviour" / "replace deterministic HM-TACTICS-0.4 tests" is a
 * non-goal). ati001.ts is untouched by this file.
 *
 * Implements the calibration causal chain (Bible S59):
 *
 *   TACTICAL TRIGGER -> TACTICAL INTENT -> PLAYER INTERPRETATION ->
 *   RESPONSE SELECTION -> INDIVIDUAL EXECUTION -> COLLECTIVE COORDINATION ->
 *   TACTICAL OPPORTUNITY -> INDIVIDUAL RECOGNITION -> SHARED RECOGNITION ->
 *   ACTION SELECTION -> EXPLOITATION EXECUTION -> DEFENSIVE RECOVERY ->
 *   TACTICAL OUTCOME
 *
 * Every sampled decision is explainable via a ProbabilityDecisionTrace
 * (Bible S86) and the chain also produces a normal ResolutionTrace
 * (Bible S51) using the same step vocabulary as the deterministic
 * resolver, extended additively in types.ts.
 */
import type {
  ATI001ProbabilisticConfig,
  CapabilityLevel,
  CapabilityProfile,
  ExploitationAssessment,
  PlayerInterpretationCause,
  ProbabilityDecisionTrace,
  RecognitionAssessment,
  SymbolicModifier,
} from "./calibrationTypes";
import {
  CAPABILITY_BINARY_TRUE_MULTIPLIER,
  CAPABILITY_EXECUTION_QUALITY_WEIGHTS,
  COLLECTIVE_SECURES_BASE_WEIGHT_MULTIPLIER,
  INTENT_BASE_WEIGHT_MULTIPLIER,
  OPPORTUNITY_WINDOW_SUCCESS_MULTIPLIER,
  SYMBOLIC_MODIFIER_MULTIPLIER,
} from "./provisionalCalibration";
import type { Rng } from "./rng";
import { weightedBoolean, weightedSample, type WeightedModifierInput } from "./sampling";
import type {
  CollectiveResolution,
  DecisionQuality,
  ExecutionComponents,
  ExecutionQuality,
  ExploitationAction,
  H2Response,
  H3Response,
  OpportunityWindow,
  RelationshipAssessment,
  ResolutionTrace,
  ResolutionTraceStep,
  TacticalOpportunity,
  TacticalOutcome,
} from "./types";

const TRIGGER = "CREDIBLE_9M_THREAT" as const;

export interface ATI001ProbabilisticResult {
  outcome: TacticalOutcome;
  opportunity?: TacticalOpportunity;
  action?: ExploitationAction;
  collectiveResolution: CollectiveResolution;
  h2Response: H2Response;
  playerInterpretation: PlayerInterpretationCause;
  h2ExecutionComponents: ExecutionComponents;
  h3ExecutionComponents?: ExecutionComponents;
  relationshipAssessment?: RelationshipAssessment;
  recognition?: RecognitionAssessment;
  sharedRecognition?: boolean;
  exploitation?: ExploitationAssessment;
  defensiveRecoverySucceeded?: boolean;
  trace: ResolutionTrace;
  probabilityTrace: ProbabilityDecisionTrace[];
}

/** Bible S83: NEUTRAL means "no modifier" -- do not push a no-op entry. */
function tendencyModifier<K extends string>(
  target: K,
  tendency: SymbolicModifier,
  source: string,
  reason: string,
): WeightedModifierInput<K>[] {
  if (tendency === "NEUTRAL") return [];
  const multiplier = SYMBOLIC_MODIFIER_MULTIPLIER[tendency];
  return [{ source, reason, target, direction: multiplier > 1 ? "INCREASE" : "DECREASE", multiplier }];
}

/** MEDIUM means "no modifier" -- do not push a no-op entry. */
function capabilityModifier<K extends string>(
  target: K,
  level: CapabilityLevel,
  source: string,
  reason: string,
): WeightedModifierInput<K>[] {
  const multiplier = CAPABILITY_BINARY_TRUE_MULTIPLIER[level];
  if (multiplier === 1) return [];
  return [{ source, reason, target, direction: multiplier > 1 ? "INCREASE" : "DECREASE", multiplier }];
}

/** Same as capabilityModifier but inverted: higher capability DECREASES the target's weight. */
function inverseCapabilityModifier<K extends string>(
  target: K,
  level: CapabilityLevel,
  source: string,
  reason: string,
): WeightedModifierInput<K>[] {
  const multiplier = CAPABILITY_BINARY_TRUE_MULTIPLIER[level];
  if (multiplier === 1) return [];
  const inverse = 1 / multiplier;
  return [{ source, reason, target, direction: inverse > 1 ? "INCREASE" : "DECREASE", multiplier: inverse }];
}

function windowModifier<K extends string>(target: K, window: OpportunityWindow): WeightedModifierInput<K>[] {
  const multiplier = OPPORTUNITY_WINDOW_SUCCESS_MULTIPLIER[window];
  if (multiplier === 1) return [];
  return [
    {
      source: `OPPORTUNITY_WINDOW_${window}`,
      reason:
        window === "SHORT"
          ? "SHORT opportunity window: less time available for recognition/coordination, reduces successful recognition/exploitation"
          : "SUSTAINED opportunity window: more time available for recognition/coordination, increases successful recognition/exploitation",
      target,
      direction: multiplier > 1 ? "INCREASE" : "DECREASE",
      multiplier,
    },
  ];
}

function sampleExecutionComponent(
  rng: Rng,
  decision: string,
  level: CapabilityLevel,
): { quality: ExecutionQuality; trace: ProbabilityDecisionTrace } {
  const base = CAPABILITY_EXECUTION_QUALITY_WEIGHTS[level];
  const { sampled, trace } = weightedSample(rng, decision, base, []);
  return { quality: sampled as ExecutionQuality, trace };
}

function sampleExecutionComponents(
  rng: Rng,
  actor: "H2" | "H3",
  capability: CapabilityProfile,
  probabilityTrace: ProbabilityDecisionTrace[],
): ExecutionComponents {
  const perceive = sampleExecutionComponent(rng, `${actor}_PERCEIVE`, capability.perceive);
  const time = sampleExecutionComponent(rng, `${actor}_TIME`, capability.time);
  const execute = sampleExecutionComponent(rng, `${actor}_EXECUTE`, capability.execute);
  const recover = sampleExecutionComponent(rng, `${actor}_RECOVER`, capability.recover);
  probabilityTrace.push(perceive.trace, time.trace, execute.trace, recover.trace);
  return { perceive: perceive.quality, time: time.quality, execute: execute.quality, recover: recover.quality };
}

function classifyInterpretation(
  sampled: H2Response,
  intent: H2Response,
  familiarity: CapabilityLevel,
): PlayerInterpretationCause {
  if (sampled === intent) return "MATCHED_INTENT";
  if (familiarity === "LOW") return "LOW_FAMILIARITY_DEVIATION";
  if (familiarity === "HIGH") return "SITUATIONAL_ADAPTATION";
  return "TACTICAL_VARIATION";
}

const QUALITY_RANK: Record<ExecutionQuality, number> = { POOR: 0, AVERAGE: 1, GOOD: 2, EXCELLENT: 3 };
function worstOf(...qualities: ExecutionQuality[]): ExecutionQuality {
  return qualities.reduce((worst, q) => (QUALITY_RANK[q] < QUALITY_RANK[worst] ? q : worst));
}

export function resolveATI001Probabilistic(config: ATI001ProbabilisticConfig, rng: Rng): ATI001ProbabilisticResult {
  const steps: ResolutionTraceStep[] = [];
  const probabilityTrace: ProbabilityDecisionTrace[] = [];

  // --- Gate 1: Create the Problem (Bible S34) ---------------------------
  const threatBase = { TRUE: 1, FALSE: 1 };
  const threatModifiers = tendencyModifier<"TRUE" | "FALSE">(
    "TRUE",
    config.threatCreationTendency,
    "threatCreationTendency",
    "Attack's relative tendency to establish a credible V9 threat",
  );
  const threatResult = weightedBoolean(rng, "THREAT_CREATION", threatBase.TRUE, threatBase.FALSE, threatModifiers);
  probabilityTrace.push(threatResult.trace);
  steps.push({ step: "THREAT_CREATION", trigger: TRIGGER, result: threatResult.sampled ? "CREATED" : "NOT_CREATED" });

  if (!threatResult.sampled) {
    const outcome: TacticalOutcome = "NO_ADVANTAGE";
    steps.push({ step: "TACTICAL_OUTCOME", outcome });
    return {
      outcome,
      collectiveResolution: "NOT_APPLICABLE",
      h2Response: "H2_HOLDS",
      playerInterpretation: "MATCHED_INTENT",
      h2ExecutionComponents: { perceive: "AVERAGE", time: "AVERAGE", execute: "AVERAGE", recover: "AVERAGE" },
      trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
      probabilityTrace,
    };
  }

  // --- Tactical Intent -> Player Interpretation -> Response Selection (Bible S60-S64) ---
  steps.push({ step: "TACTICAL_INTENT_SET", response: config.h2TacticalIntent });

  const responseBase: Record<H2Response, number> = {
    H2_HOLDS: 1,
    H2_DELAYS: 1,
    H2_STEERS: 1,
    H2_STEPS: 1,
    H2_STOPS: 1,
  };
  responseBase[config.h2TacticalIntent] = INTENT_BASE_WEIGHT_MULTIPLIER;
  const responseModifiers: WeightedModifierInput<H2Response>[] = [
    ...tendencyModifier(
      config.h2TacticalIntent,
      config.h2ResponseIntentStrength,
      "h2ResponseIntentStrength",
      "Tactical design strength of the intended Working Rule response",
    ),
    ...capabilityModifier(
      config.h2TacticalIntent,
      config.h2TacticalFamiliarity,
      "h2TacticalFamiliarity",
      "Higher Tactical Familiarity increases consistency between tactical intent and selected response",
    ),
  ];
  const responseResult = weightedSample(rng, "H2_RESPONSE_SELECTION", responseBase, responseModifiers);
  probabilityTrace.push(responseResult.trace);
  const h2Response = responseResult.sampled;
  const playerInterpretation = classifyInterpretation(h2Response, config.h2TacticalIntent, config.h2TacticalFamiliarity);
  steps.push({ step: "PLAYER_INTERPRETATION", cause: playerInterpretation });
  steps.push({ step: "H2_RESPONSE_SELECTED", response: h2Response });

  // --- Individual Execution: H2 (Bible S65-S66) --------------------------
  const h2ExecutionComponents = sampleExecutionComponents(rng, "H2", config.h2Capability, probabilityTrace);
  steps.push({ step: "EXECUTION_COMPONENTS", actor: "H2", components: h2ExecutionComponents });
  const h2ExecutionQuality = worstOf(h2ExecutionComponents.time, h2ExecutionComponents.execute);
  steps.push({ step: "H2_EXECUTION", quality: h2ExecutionQuality });

  if (h2Response !== "H2_STEPS") {
    // Non-stepping branch (Bible S20.1): holding is not automatic success.
    const advBase = { TRUE: 1, FALSE: 1 };
    const advModifiers = tendencyModifier<"TRUE" | "FALSE">(
      "TRUE",
      config.postResponseAdvantageTendency,
      "postResponseAdvantageTendency",
      "Relative tendency for V9 to retain a meaningful advantage after a non-stepping H2 response",
    );
    const advResult = weightedBoolean(rng, "POST_RESPONSE_ADVANTAGE", advBase.TRUE, advBase.FALSE, advModifiers);
    probabilityTrace.push(advResult.trace);
    steps.push({ step: "POST_RESPONSE_ADVANTAGE_EVALUATED", advantageRemains: advResult.sampled });
    const outcome: TacticalOutcome = advResult.sampled ? "9M_ATTACK_CONTINUES" : "CONTINUE_PLAY";
    steps.push({ step: "TACTICAL_OUTCOME", outcome });
    return {
      outcome,
      collectiveResolution: "NOT_APPLICABLE",
      h2Response,
      playerInterpretation,
      h2ExecutionComponents,
      trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
      probabilityTrace,
    };
  }

  // --- Individual Execution: H3, then Collective Coordination (Bible S67-S68) ---
  const h3ExecutionComponents = sampleExecutionComponents(rng, "H3", config.h3Capability, probabilityTrace);
  steps.push({ step: "EXECUTION_COMPONENTS", actor: "H3", components: h3ExecutionComponents });
  const h3ExecutionQuality = worstOf(h3ExecutionComponents.time, h3ExecutionComponents.execute);
  steps.push({ step: "H3_EXECUTION", quality: h3ExecutionQuality });

  const relationshipAssessment: RelationshipAssessment = {
    relationship: "H2_H3",
    workingRule: "WR_DEF_H2_H3_STEP_COVER",
    factors: {
      familiarity: h2ExecutionQuality,
      coordination: h3ExecutionQuality,
      communication: h3ExecutionQuality,
      roleCompatibility: h2ExecutionQuality,
    },
    quality: worstOf(h2ExecutionQuality, h3ExecutionQuality),
  };

  const collectiveBase: Record<H3Response, number> = {
    H3_HOLDS: 1,
    H3_SECURES: COLLECTIVE_SECURES_BASE_WEIGHT_MULTIPLIER,
    H3_TAKES_OVER: 1,
    H3_OVERHELPS: 1,
    H3_LATE: 1,
  };
  const collectiveModifiers: WeightedModifierInput<H3Response>[] = [
    // Bible S68: Tactical Familiarity (do H2/H3 know the intended solution?) is distinct
    // from Relationship Quality (do these two particular players coordinate?).
    ...capabilityModifier(
      "H3_SECURES",
      config.h2h3TacticalFamiliarity,
      "h2h3TacticalFamiliarity",
      "Higher H2<->H3 Tactical Familiarity increases consistency toward the intended collective solution (H3_SECURES)",
    ),
    ...capabilityModifier(
      "H3_SECURES",
      config.h2h3RelationshipQuality,
      "h2h3RelationshipQuality",
      "Improved H2<->H3 Relationship Quality increases successful collective coordination (H3_SECURES)",
    ),
    ...inverseCapabilityModifier(
      "H3_LATE",
      config.h2h3RelationshipQuality,
      "h2h3RelationshipQuality",
      "Improved H2<->H3 Relationship Quality reduces late collective security (H3_LATE)",
    ),
  ];
  if (h2ExecutionComponents.time === "POOR") {
    collectiveModifiers.push({
      source: "H2_TIME_POOR",
      reason: "H2 stepped with poor timing, giving H3 less time to react -- increases H3_LATE",
      target: "H3_LATE",
      direction: "INCREASE",
      multiplier: SYMBOLIC_MODIFIER_MULTIPLIER.INCREASE,
    });
    collectiveModifiers.push({
      source: "H2_TIME_POOR",
      reason: "H2 stepped with poor timing, giving H3 less time to react -- decreases H3_SECURES",
      target: "H3_SECURES",
      direction: "DECREASE",
      multiplier: SYMBOLIC_MODIFIER_MULTIPLIER.DECREASE,
    });
  }
  const collectiveResult = weightedSample(rng, "H2_H3_COLLECTIVE_RESOLUTION", collectiveBase, collectiveModifiers);
  probabilityTrace.push(collectiveResult.trace);
  const h3Response = collectiveResult.sampled;
  steps.push({ step: "H3_RESPONSE_SELECTED", response: h3Response });
  const collectiveResolution: CollectiveResolution = h3Response;
  steps.push({ step: "COLLECTIVE_RESOLUTION", resolution: collectiveResolution });

  // --- Tactical Opportunity / chaining branches (same shape as ati001.ts) ---
  if (collectiveResolution === "H3_SECURES" || collectiveResolution === "H3_TAKES_OVER") {
    steps.push({ step: "RELATIONSHIP_CHANGED", relationship: "H2_H3" });
    steps.push({ step: "NEXT_INTERACTION_AVAILABLE", targetRelationship: "H2_H3" });
    const outcome: TacticalOutcome = "RELATIONSHIP_CHANGED";
    steps.push({ step: "TACTICAL_OUTCOME", outcome });
    return {
      outcome,
      collectiveResolution,
      h2Response,
      playerInterpretation,
      h2ExecutionComponents,
      h3ExecutionComponents,
      relationshipAssessment,
      trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
      probabilityTrace,
    };
  }
  if (collectiveResolution === "H3_OVERHELPS") {
    steps.push({ step: "RELATIONSHIP_CHANGED", relationship: "V9_M6" });
    steps.push({ step: "NEXT_INTERACTION_AVAILABLE", targetRelationship: "V9_M6" });
    const outcome: TacticalOutcome = "NEXT_INTERACTION_AVAILABLE";
    steps.push({ step: "TACTICAL_OUTCOME", outcome });
    return {
      outcome,
      collectiveResolution,
      h2Response,
      playerInterpretation,
      h2ExecutionComponents,
      h3ExecutionComponents,
      relationshipAssessment,
      trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
      probabilityTrace,
    };
  }
  if (collectiveResolution !== "H3_LATE") {
    // H3_HOLDS: attack must still evaluate whether the space is exploitable
    // (Bible S20.3); without an M6 availability model in this milestone's
    // scope, no opportunity is created and the attack retains alternatives.
    steps.push({ step: "OPPORTUNITY_NOT_CREATED" });
    const outcome: TacticalOutcome = "CONTINUE_PLAY";
    steps.push({ step: "TACTICAL_OUTCOME", outcome });
    return {
      outcome,
      collectiveResolution,
      h2Response,
      playerInterpretation,
      h2ExecutionComponents,
      h3ExecutionComponents,
      relationshipAssessment,
      trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
      probabilityTrace,
    };
  }

  // --- collectiveResolution === "H3_LATE": TacticalOpportunity created ---
  const opportunity: TacticalOpportunity = {
    type: "PIVOT_ACCESS",
    createdBy: ["H2_STEPS", "H3_LATE"],
    targetRelationship: "H2_H3",
    quality: config.opportunityQuality,
    window: config.opportunityWindow,
  };
  steps.push({ step: "OPPORTUNITY_CREATED", opportunity });

  // --- Individual Recognition (Bible S72) ---------------------------------
  const v9RecBase = { TRUE: 1, FALSE: 1 };
  const v9RecModifiers = [
    ...capabilityModifier("TRUE", config.v9RecognitionCapability, "v9RecognitionCapability", "V9's individual capacity to recognise the created opportunity"),
    ...windowModifier<"TRUE" | "FALSE">("TRUE", config.opportunityWindow),
  ];
  const v9Rec = weightedBoolean(rng, "V9_RECOGNITION", v9RecBase.TRUE, v9RecBase.FALSE, v9RecModifiers);
  probabilityTrace.push(v9Rec.trace);

  const m6RecBase = { TRUE: 1, FALSE: 1 };
  const m6RecModifiers = [
    ...capabilityModifier("TRUE", config.m6RecognitionCapability, "m6RecognitionCapability", "M6's individual capacity to recognise the created opportunity"),
    ...windowModifier<"TRUE" | "FALSE">("TRUE", config.opportunityWindow),
  ];
  const m6Rec = weightedBoolean(rng, "M6_RECOGNITION", m6RecBase.TRUE, m6RecBase.FALSE, m6RecModifiers);
  probabilityTrace.push(m6Rec.trace);

  steps.push({ step: "INDIVIDUAL_RECOGNITION", v9Recognised: v9Rec.sampled, m6Recognised: m6Rec.sampled });

  // --- Shared Recognition (Bible S73) -- relationship-level, not individual ---
  const sharedInterpretation = v9Rec.sampled && m6Rec.sampled;
  let sharedTiming = false;
  if (sharedInterpretation) {
    const timingBase = { TRUE: 1, FALSE: 1 };
    const timingModifiers = [
      ...capabilityModifier("TRUE", config.v9m6RelationshipQuality, "v9m6RelationshipQuality", "V9<->M6 Relationship Quality affects whether both players coordinate with compatible timing"),
      ...capabilityModifier("TRUE", config.v9m6TacticalFamiliarity, "v9m6TacticalFamiliarity", "V9<->M6 Tactical Familiarity affects whether both players coordinate with compatible timing"),
      ...windowModifier<"TRUE" | "FALSE">("TRUE", config.opportunityWindow),
    ];
    const timingResult = weightedBoolean(rng, "V9_M6_SHARED_TIMING", timingBase.TRUE, timingBase.FALSE, timingModifiers);
    probabilityTrace.push(timingResult.trace);
    sharedTiming = timingResult.sampled;
  }
  const sharedRecognition = sharedInterpretation && sharedTiming;
  steps.push({ step: "SHARED_RECOGNITION", sharedInterpretation, sharedTiming, result: sharedRecognition });

  const recognition: RecognitionAssessment = {
    individual: { v9Recognition: v9Rec.sampled, m6Recognition: m6Rec.sampled },
    shared: { sharedInterpretation, sharedTiming },
    context: { opportunityQuality: config.opportunityQuality, opportunityWindow: config.opportunityWindow },
  };

  if (!sharedRecognition) {
    steps.push({ step: "OPPORTUNITY_RECOGNITION", result: "NOT_RECOGNISED" });
    const outcome: TacticalOutcome = "CONTINUE_PLAY";
    steps.push({ step: "TACTICAL_OUTCOME", outcome });
    return {
      outcome,
      opportunity,
      collectiveResolution,
      h2Response,
      playerInterpretation,
      h2ExecutionComponents,
      h3ExecutionComponents,
      relationshipAssessment,
      recognition,
      sharedRecognition,
      trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
      probabilityTrace,
    };
  }
  steps.push({ step: "OPPORTUNITY_RECOGNITION", result: "RECOGNISED" });

  // --- Action Selection (Bible S77) -- PIVOT_ACCESS only supports PIVOT_PASS in this scope ---
  const action: ExploitationAction = "PIVOT_PASS";
  const decisionBase = { GOOD: 1, POOR: 1 };
  const decisionModifiers = tendencyModifier<"GOOD" | "POOR">(
    "GOOD",
    config.decisionQualityTendency,
    "decisionQualityTendency",
    "Relative tendency for the selected action to be well judged given the opportunity",
  );
  const decisionResult = weightedSample(rng, "DECISION_QUALITY", decisionBase, decisionModifiers);
  probabilityTrace.push(decisionResult.trace);
  const decisionQuality = decisionResult.sampled as DecisionQuality;
  steps.push({ step: "ACTION_SELECTED", action, decisionQuality });
  steps.push({ step: "EXPLOITATION_ACTION", action });

  // --- Exploitation Execution (Bible S78-S79) -----------------------------
  const passer = sampleExecutionComponent(rng, "V9_PASSER_EXECUTION", config.exploitationCapability.passer);
  const receiver = sampleExecutionComponent(rng, "M6_RECEIVER_EXECUTION", config.exploitationCapability.receiver);
  const timing = sampleExecutionComponent(rng, "V9_M6_EXPLOITATION_TIMING", config.exploitationCapability.sharedTiming);
  probabilityTrace.push(passer.trace, receiver.trace, timing.trace);
  const exploitationExecutionQuality = worstOf(passer.quality, receiver.quality, timing.quality);
  steps.push({ step: "EXPLOITATION_EXECUTION", quality: exploitationExecutionQuality });

  // --- Defensive Recovery (Bible S80) -- reuses H3's RECOVER component ---
  const recoveryModifiers = capabilityModifier(
    "TRUE",
    config.h3Capability.recover,
    "h3Capability.recover",
    "H3's RECOVER capability determines whether the defence closes/degrades the opportunity after it is created",
  );
  const recoveryResult = weightedBoolean(rng, "H3_DEFENSIVE_RECOVERY", 1, 1, recoveryModifiers);
  probabilityTrace.push(recoveryResult.trace);
  const defensiveRecoverySucceeded = recoveryResult.sampled;
  steps.push({ step: "DEFENSIVE_RECOVERY", recovered: defensiveRecoverySucceeded });

  const exploitation: ExploitationAssessment = {
    opportunity: "PIVOT_ACCESS",
    selectedAction: action,
    decisionQuality,
    execution: { passerExecution: passer.quality, receiverExecution: receiver.quality, sharedTiming: timing.quality },
    context: { opportunityWindow: config.opportunityWindow, defensiveRecoverySucceeded },
  };

  const executionSucceeded = exploitationExecutionQuality === "GOOD" || exploitationExecutionQuality === "EXCELLENT";
  let outcome: TacticalOutcome;
  if (!executionSucceeded) {
    outcome = "TURNOVER";
  } else if (defensiveRecoverySucceeded) {
    // Bible S80: opportunity degrades/closes when defence recovers, even
    // though the attack's own exploitation execution was good.
    outcome = "PRESSURED_SOLUTION";
  } else {
    outcome = "PIVOT_ACCESS";
  }
  steps.push({ step: "TACTICAL_OUTCOME", outcome });

  return {
    outcome,
    opportunity,
    action,
    collectiveResolution,
    h2Response,
    playerInterpretation,
    h2ExecutionComponents,
    h3ExecutionComponents,
    relationshipAssessment,
    recognition,
    sharedRecognition,
    exploitation,
    defensiveRecoverySucceeded,
    trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
    probabilityTrace,
  };
}
