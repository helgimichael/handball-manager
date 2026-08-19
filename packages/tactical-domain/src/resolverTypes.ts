/**
 * Input/result types for the ATI-001 x TI-001 resolver (HM-TACTICS-0.4).
 *
 * ATI001Inputs are the "controlled resolution inputs / test decisions"
 * the task explicitly allows injecting to force specific causal
 * branches deterministically -- not calibrated probabilities.
 */
import type {
  CollectiveResolution,
  ExecutionAssessment,
  ExecutionQuality,
  ExploitationAction,
  H2Response,
  H3Response,
  OpportunityQuality,
  OpportunityWindow,
  RelationshipAssessment,
  ResolutionTrace,
  TacticalOpportunity,
  TacticalOutcome,
} from "./types";

export interface ATI001Inputs {
  /** Gate 1 (Bible S34): did the attack credibly create CREDIBLE_9M_THREAT? */
  threatCreated: boolean;

  /** Gate 2 (Bible S35): H2's selected response. */
  h2Response: H2Response;

  /** Gate 3 (Bible S36/S37): H2's execution quality for that response. */
  h2ExecutionQuality: ExecutionQuality;

  /**
   * Only used when h2Response is NOT H2_STEPS (Bible S20.1): does V9
   * still have a meaningful advantage after H2's non-stepping response?
   */
  postResponseAdvantageRemains?: boolean;

  /** Only used when h2Response === H2_STEPS (Bible S20.2): H3's response. */
  h3Response?: H3Response;
  /** H3's execution quality for its response. */
  h3ExecutionQuality?: ExecutionQuality;

  /** Gate 4 (Bible S39): H2-H3 RelationshipAssessment inputs. */
  relationshipQuality?: ExecutionQuality;
  relationshipFactors?: {
    familiarity?: ExecutionQuality;
    coordination?: ExecutionQuality;
    communication?: ExecutionQuality;
    roleCompatibility?: ExecutionQuality;
  };

  /** Gate 5 (Bible S40-S43): only meaningful if a TacticalOpportunity was created. */
  opportunityQuality?: OpportunityQuality;
  opportunityWindow?: OpportunityWindow;
  opportunityRecognised?: boolean;

  /** Gate 6 (Bible S44): only meaningful if the opportunity was recognised. */
  exploitationExecutionQuality?: ExecutionQuality;
}

export interface ATI001Result {
  outcome: TacticalOutcome;
  opportunity?: TacticalOpportunity;
  action?: ExploitationAction;
  executionAssessments: ExecutionAssessment[];
  relationshipAssessment?: RelationshipAssessment;
  collectiveResolution: CollectiveResolution;
  trace: ResolutionTrace;
}
