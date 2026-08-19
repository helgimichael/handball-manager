/**
 * Headless Tactical Domain types (HM-TACTICS-0.4).
 *
 * Terminology, vocabulary and structure are taken directly from
 * docs/HANDBALL_MANAGER_TACTICAL_MODEL_BIBLE_v0.3.md and must not be
 * silently replaced with new abstractions. Section references below
 * point at the Bible section that defines each concept.
 *
 * Scope: only the objects required to resolve ATI-001 x TI-001
 * (Bible S19-S28, S33-S51) are implemented. No other Tactical
 * Interaction, no final player attribute taxonomy, no calibrated
 * probability magnitudes.
 */

// ---------------------------------------------------------------------------
// Relationships (Bible S2.4, S3.5)
// ---------------------------------------------------------------------------

/** The two relationships relevant to ATI-001 x TI-001. */
export type RelationshipId = "H2_H3" | "V9_M6";

// ---------------------------------------------------------------------------
// Trigger (Bible S3.4, S19.4)
// ---------------------------------------------------------------------------

/**
 * Only the trigger required for ATI-001 is modelled. The Bible's full
 * trigger vocabulary (S3.4) is not implemented -- it is not needed by
 * this milestone's single matchup.
 */
export type Trigger = "CREDIBLE_9M_THREAT";

// ---------------------------------------------------------------------------
// Defensive response vocabulary (Bible S19.6, S20.2, S35, S38)
// ---------------------------------------------------------------------------

/** First defensive response vocabulary for H2 (Bible S19.6). */
export type H2Response = "H2_HOLDS" | "H2_DELAYS" | "H2_STEERS" | "H2_STEPS" | "H2_STOPS";

/** H3's response once H2 steps and H3 must be read (Bible S20.2, S38). */
export type H3Response = "H3_HOLDS" | "H3_SECURES" | "H3_TAKES_OVER" | "H3_OVERHELPS" | "H3_LATE";

/** Collective failure states for the H2-H3 relationship (Bible S38). */
export type CollectiveFailure = "DOUBLE_COMMIT" | "FAILED_HANDOVER";

/**
 * Gate 4 (Solve Collectively) result: either a clean resolution of
 * H3's chosen response, or a collective failure state. Bible S38 lists
 * these together as "possible collective responses" -- this type
 * preserves that grouping without inventing new vocabulary.
 */
export type CollectiveResolution = H3Response | CollectiveFailure | "NOT_APPLICABLE";

// ---------------------------------------------------------------------------
// Quality / calibration-free categorical scales
// ---------------------------------------------------------------------------

/**
 * Situational execution quality category. Bible S37/S46 explicitly
 * leave the "final calibrated value/category" unapproved -- this is a
 * small ordered categorical scale used only to select deterministic
 * branches in this proof, not a calibrated numeric attribute.
 */
export type ExecutionQuality = "POOR" | "AVERAGE" | "GOOD" | "EXCELLENT";

/** Bible S41 -- exact vocabulary given, final scale/calibration not locked. */
export type OpportunityQuality = "LOW" | "MEDIUM" | "HIGH" | "CLEAR";

/** Bible S42 -- exact vocabulary given. */
export type OpportunityWindow = "SHORT" | "MEDIUM" | "SUSTAINED";

// ---------------------------------------------------------------------------
// ExecutionAssessment (Bible S36, S37) -- situational, NOT a permanent attribute
// ---------------------------------------------------------------------------

export interface ExecutionAssessment {
  actor: "H2" | "H3" | "V9" | "M6";
  task: string;
  /** PlayerRequirement labels relevant to this task (Bible S3.6, S27). */
  requirements: string[];
  quality: ExecutionQuality;
}

// ---------------------------------------------------------------------------
// RelationshipAssessment (Bible S39) -- only H2<->H3 and V9<->M6 in scope
// ---------------------------------------------------------------------------

export interface RelationshipAssessment {
  relationship: RelationshipId;
  workingRule: string;
  factors: {
    familiarity: ExecutionQuality;
    coordination: ExecutionQuality;
    communication: ExecutionQuality;
    roleCompatibility: ExecutionQuality;
  };
  quality: ExecutionQuality;
}

// ---------------------------------------------------------------------------
// TacticalOpportunity (Bible S40) -- existence != successful use
// ---------------------------------------------------------------------------

export type TacticalOpportunityType = "PIVOT_ACCESS";

export interface TacticalOpportunity {
  type: TacticalOpportunityType;
  createdBy: string[];
  targetRelationship: RelationshipId;
  quality: OpportunityQuality;
  window: OpportunityWindow;
}

// ---------------------------------------------------------------------------
// Opportunity -> Action -> Outcome separation (Bible S45, mandatory)
// ---------------------------------------------------------------------------

export type ExploitationAction = "PIVOT_PASS";

/**
 * Shared tactical outcome vocabulary (Bible S20.1, S24, S47), restricted
 * to the outcomes this milestone's proof paths actually produce.
 * "9M_ATTACK_CONTINUES" is named explicitly in Bible S20.1.
 */
export type TacticalOutcome =
  | "NO_ADVANTAGE"
  | "CONTINUE_PLAY"
  | "RESET_ATTACK"
  | "9M_ATTACK_CONTINUES"
  | "RELATIONSHIP_CHANGED"
  | "NEXT_INTERACTION_AVAILABLE"
  | "PIVOT_ACCESS"
  | "TURNOVER"
  /**
   * Bible S24/S47 vocabulary, added in HM-TACTICS-0.5: a recognised and
   * attempted exploitation that a recovering defender pressures/closes
   * (Bible S80) rather than an outright turnover.
   */
  | "PRESSURED_SOLUTION";

// ---------------------------------------------------------------------------
// DecisionQuality (Bible S46) -- analytical, not a permanent attribute
// ---------------------------------------------------------------------------

export type DecisionQuality = "GOOD" | "POOR";

// ---------------------------------------------------------------------------
// ProbabilityModifier (Bible S48) -- traceable only, no calibrated magnitude
// ---------------------------------------------------------------------------

export interface ProbabilityModifier {
  source: string;
  reason: string;
  affects: TacticalOutcome[];
  direction: "INCREASE" | "DECREASE";
}

// ---------------------------------------------------------------------------
// ResolutionTrace (Bible S51) -- typed causal trace, not hardcoded text
// ---------------------------------------------------------------------------

export type ResolutionTraceStep =
  | { step: "THREAT_CREATION"; trigger: Trigger; result: "CREATED" | "NOT_CREATED" }
  | { step: "H2_RESPONSE_SELECTED"; response: H2Response }
  | { step: "H2_EXECUTION"; quality: ExecutionQuality }
  | { step: "POST_RESPONSE_ADVANTAGE_EVALUATED"; advantageRemains: boolean }
  | { step: "H3_RESPONSE_SELECTED"; response: H3Response }
  | { step: "H3_EXECUTION"; quality: ExecutionQuality }
  | { step: "COLLECTIVE_RESOLUTION"; resolution: CollectiveResolution }
  | { step: "OPPORTUNITY_CREATED"; opportunity: TacticalOpportunity }
  | { step: "OPPORTUNITY_NOT_CREATED" }
  | { step: "OPPORTUNITY_RECOGNITION"; result: "RECOGNISED" | "NOT_RECOGNISED" }
  | { step: "EXPLOITATION_ACTION"; action: ExploitationAction }
  | { step: "EXPLOITATION_EXECUTION"; quality: ExecutionQuality }
  | { step: "RELATIONSHIP_CHANGED"; relationship: RelationshipId }
  | { step: "NEXT_INTERACTION_AVAILABLE"; targetRelationship: RelationshipId }
  | { step: "TACTICAL_OUTCOME"; outcome: TacticalOutcome }
  // --- HM-TACTICS-0.5 additions: additive only, not used by the HM-TACTICS-0.4 deterministic resolver ---
  /** Bible S60: what the Working Rule/manager intends H2 to do before any sampling. */
  | { step: "TACTICAL_INTENT_SET"; response: H2Response }
  /** Bible S60-S64: why the sampled response matched or deviated from tactical intent. */
  | { step: "PLAYER_INTERPRETATION"; cause: string }
  /** Bible S65-S66: the PERCEIVE/TIME/EXECUTE/RECOVER decomposition for one actor. */
  | { step: "EXECUTION_COMPONENTS"; actor: "H2" | "H3"; components: ExecutionComponents }
  /** Bible S72: V9 and M6 individual recognition of an existing TacticalOpportunity. */
  | { step: "INDIVIDUAL_RECOGNITION"; v9Recognised: boolean; m6Recognised: boolean }
  /** Bible S73: SharedRecognition -- a V9<->M6 relationship-level property, not a player attribute. */
  | { step: "SHARED_RECOGNITION"; sharedInterpretation: boolean; sharedTiming: boolean; result: boolean }
  /** Bible S77: the action selected from the set the TacticalOpportunity supports. */
  | { step: "ACTION_SELECTED"; action: ExploitationAction; decisionQuality: DecisionQuality }
  /** Bible S80: defence remains active after opportunity creation. */
  | { step: "DEFENSIVE_RECOVERY"; recovered: boolean };

/**
 * PERCEIVE / TIME / EXECUTE / RECOVER functional decomposition of execution
 * (Bible S65-S66). These are functional demands, not permanent player
 * attributes, and must be able to produce distinct causal consequences.
 */
export interface ExecutionComponents {
  perceive: ExecutionQuality;
  time: ExecutionQuality;
  execute: ExecutionQuality;
  recover: ExecutionQuality;
}

export interface ResolutionTrace {
  interaction: "ATI-001 x TI-001";
  trigger: Trigger;
  steps: ResolutionTraceStep[];
}
