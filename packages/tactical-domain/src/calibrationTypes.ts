/**
 * Calibration-layer types for ATI-001 x TI-001 (HM-TACTICS-0.5).
 *
 * These extend, and do not replace, the HM-TACTICS-0.4 domain types in
 * ./types. Section references point at
 * docs/HANDBALL_MANAGER_TACTICAL_MODEL_BIBLE_v0.4.md.
 */
import type {
  DecisionQuality,
  ExecutionComponents,
  ExecutionQuality,
  ExploitationAction,
  H2Response,
  OpportunityQuality,
  OpportunityWindow,
  TacticalOpportunityType,
} from "./types";

// ---------------------------------------------------------------------------
// Symbolic / relative calibration inputs (Bible S83) -- not real percentages
// ---------------------------------------------------------------------------

/**
 * Relative modifier strength (Bible S83). Symbolic, not a calibrated
 * probability. Only ever converted to a number inside
 * provisionalCalibration.ts.
 */
export type SymbolicModifier = "STRONGLY_INCREASE" | "INCREASE" | "NEUTRAL" | "DECREASE" | "STRONGLY_DECREASE";

/**
 * Abstract functional capability input (Bible S87). Not a final player
 * attribute -- a calibration-only fixture.
 */
export type CapabilityLevel = "LOW" | "MEDIUM" | "HIGH";

/** A CapabilityLevel for each of the four execution components (Bible S65). */
export interface CapabilityProfile {
  perceive: CapabilityLevel;
  time: CapabilityLevel;
  execute: CapabilityLevel;
  recover: CapabilityLevel;
}

// ---------------------------------------------------------------------------
// Tactical Intent vs Player Interpretation vs Response Selection (Bible S60-S64)
// ---------------------------------------------------------------------------

/**
 * Why the sampled response matched, or deviated from, Tactical Intent.
 * These causes must remain conceptually distinct (Bible S60-S64) -- a
 * deviation is not automatically an error.
 */
export type PlayerInterpretationCause =
  | "MATCHED_INTENT"
  | "TACTICAL_VARIATION"
  | "SITUATIONAL_ADAPTATION"
  | "LOW_FAMILIARITY_DEVIATION"
  | "DECISION_ERROR";

// ---------------------------------------------------------------------------
// Explainable probability trace (Bible S86) -- complements ResolutionTrace
// ---------------------------------------------------------------------------

export interface AppliedProbabilityModifier {
  source: string;
  reason: string;
  /** The distribution key this modifier affects. */
  target: string;
  direction: "INCREASE" | "DECREASE";
}

/**
 * One explainable sampled decision: base distribution, every modifier
 * applied to it (each with a source and reason, Bible S48/S86), the
 * resulting distribution, and the sampled value. Does not replace
 * ResolutionTrace (Bible S51) -- the two complement each other.
 */
export interface ProbabilityDecisionTrace {
  decision: string;
  baseWeights: Record<string, number>;
  modifiers: AppliedProbabilityModifier[];
  resultingWeights: Record<string, number>;
  sampled: string;
}

// ---------------------------------------------------------------------------
// RecognitionAssessment (Bible S74)
// ---------------------------------------------------------------------------

export interface RecognitionAssessment {
  individual: {
    v9Recognition: boolean;
    m6Recognition: boolean;
  };
  shared: {
    sharedInterpretation: boolean;
    sharedTiming: boolean;
  };
  context: {
    opportunityQuality: OpportunityQuality;
    opportunityWindow: OpportunityWindow;
  };
}

// ---------------------------------------------------------------------------
// ExploitationAssessment (Bible S78-S79)
// ---------------------------------------------------------------------------

export interface ExploitationAssessment {
  opportunity: TacticalOpportunityType;
  selectedAction: ExploitationAction;
  decisionQuality: DecisionQuality;
  execution: {
    passerExecution: ExecutionQuality;
    receiverExecution: ExecutionQuality;
    sharedTiming: ExecutionQuality;
  };
  context: {
    opportunityWindow: OpportunityWindow;
    defensiveRecoverySucceeded: boolean;
  };
}

// ---------------------------------------------------------------------------
// ATI001ProbabilisticConfig -- the injectable calibration inputs
// ---------------------------------------------------------------------------

/**
 * Calibration inputs for one probabilistic ATI-001 x TI-001 resolution.
 * Every field maps to an approved Bible v0.4 concept; none is a final
 * player attribute or a calibrated real-world probability (Bible S87).
 */
export interface ATI001ProbabilisticConfig {
  /** Gate 1 (Bible S34): relative tendency for the attack to create CREDIBLE_9M_THREAT. */
  threatCreationTendency: SymbolicModifier;

  /** Bible S60: the Working Rule's intended H2 response before interpretation/selection. */
  h2TacticalIntent: H2Response;
  /** Bible S60/S83: how strongly the team's tactical design favours the intended response. */
  h2ResponseIntentStrength: SymbolicModifier;
  /** Bible S63: consistency between intent, interpretation and collective response. */
  h2TacticalFamiliarity: CapabilityLevel;

  /** Bible S65-S66: H2's PERCEIVE/TIME/EXECUTE/RECOVER capability profile. */
  h2Capability: CapabilityProfile;
  /** Bible S65-S66/S80: H3's PERCEIVE/TIME/EXECUTE/RECOVER capability profile (RECOVER also drives Defensive Recovery). */
  h3Capability: CapabilityProfile;

  /** Bible S68: do H2/H3 know the team's intended solution? */
  h2h3TacticalFamiliarity: CapabilityLevel;
  /** Bible S68: do these two particular players coordinate well with each other? */
  h2h3RelationshipQuality: CapabilityLevel;

  /** Bible S41/S42: fixed per-run experiment variables for this proof. */
  opportunityQuality: OpportunityQuality;
  opportunityWindow: OpportunityWindow;

  /** Bible S72: V9's individual capacity to recognise an existing opportunity. */
  v9RecognitionCapability: CapabilityLevel;
  /** Bible S72: M6's individual capacity to recognise an existing opportunity. */
  m6RecognitionCapability: CapabilityLevel;
  /** Bible S68/S73: V9<->M6 relationship quality, distinct from familiarity. */
  v9m6RelationshipQuality: CapabilityLevel;
  /** Bible S73: V9<->M6 tactical familiarity, distinct from relationship quality. */
  v9m6TacticalFamiliarity: CapabilityLevel;

  /** Bible S77: relative tendency for the selected action to be well judged. */
  decisionQualityTendency: SymbolicModifier;

  /** Bible S79: exploitation execution capability profile. */
  exploitationCapability: {
    passer: CapabilityLevel;
    receiver: CapabilityLevel;
    sharedTiming: CapabilityLevel;
  };

  /** Bible S20.1: relative tendency for V9 to retain advantage after a non-stepping H2 response. */
  postResponseAdvantageTendency: SymbolicModifier;
}

// ---------------------------------------------------------------------------
// ATI001ProbabilisticResult
// ---------------------------------------------------------------------------

export type { ExecutionComponents };
