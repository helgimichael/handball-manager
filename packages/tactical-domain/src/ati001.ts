/**
 * ATI-001 x TI-001 resolver (HM-TACTICS-0.4).
 *
 * Implements the six-gate Tactical Matchup Engine v0.1 pipeline (Bible
 * S33): CREATE THE PROBLEM -> CHOOSE RESPONSE -> EXECUTE RESPONSE ->
 * SOLVE COLLECTIVELY -> RECOGNISE OPPORTUNITY -> EXPLOIT OPPORTUNITY
 * -> TACTICAL OUTCOME.
 *
 * Scope: exactly one matchup. Attack: V9 + M6 (ATI-001, Bible S19-S28).
 * Defence: H2 + H3 (TI-001, Bible S6). Mandatory defensive convention
 * (Bible S4, not inverted): H2 meets V9, H3 works centrally.
 *
 * This is a deterministic proof, not a calibrated probability engine
 * (Bible S49, explicitly prohibited: collapsing to a single aggregate
 * attackRating/defenseRating contest). All branching below is driven
 * directly by the injected ATI001Inputs so that every causal path is
 * reproducible and testable -- see Bible S57: "deterministic testing
 * must be possible even if production resolution later uses
 * probability sampling."
 */
import type {
  ExecutionAssessment,
  RelationshipAssessment,
  ResolutionTraceStep,
  TacticalOpportunity,
  TacticalOutcome,
} from "./types";
import type { ATI001Inputs as Inputs, ATI001Result as Result } from "./resolverTypes";

export type { ATI001Inputs, ATI001Result } from "./resolverTypes";

const TRIGGER = "CREDIBLE_9M_THREAT" as const;

const H3_REQUIREMENTS: Record<string, string[]> = {
  H3_SECURES: [
    "recognise teammate action",
    "monitor pivot threat",
    "adjust position",
    "decide help depth",
  ],
  H3_TAKES_OVER: ["recognise teammate action", "monitor pivot threat", "decide help depth", "take over threat"],
  H3_LATE: ["recognise teammate action", "monitor pivot threat", "adjust position"],
  H3_OVERHELPS: ["recognise teammate action", "monitor pivot threat", "decide help depth"],
  H3_HOLDS: ["monitor pivot threat", "adjust position"],
};

const H2_REQUIREMENTS = ["threat recognition", "timing", "closing ability", "contact control", "recovery"];

function h2Task(response: Inputs["h2Response"]): string {
  return response === "H2_STEPS" ? "H2_STEP_AND_INFLUENCE" : `H2_${response.replace("H2_", "")}`;
}

/** Gate 4: Solve Collectively (Bible S38). */
function solveCollectively(
  h2Response: Inputs["h2Response"],
  h3Response: Inputs["h3Response"],
): Result["collectiveResolution"] {
  if (h2Response !== "H2_STEPS" || !h3Response) {
    return "NOT_APPLICABLE";
  }
  // The chosen H3 response is the collective resolution for this proof;
  // execution/relationship quality are recorded for explainability
  // (Bible S50) rather than silently overriding the injected decision.
  return h3Response;
}

/** Gate 5+6: create opportunity (if any), recognise it, attempt exploitation. */
function recogniseAndExploit(
  collective: Result["collectiveResolution"],
  inputs: Inputs,
  steps: ResolutionTraceStep[],
): { opportunity?: TacticalOpportunity; outcome: TacticalOutcome; action?: "PIVOT_PASS" } {
  if (collective === "H3_LATE") {
    const opportunity: TacticalOpportunity = {
      type: "PIVOT_ACCESS",
      createdBy: ["H2_STEPS", "H3_LATE"],
      targetRelationship: "H2_H3",
      quality: inputs.opportunityQuality ?? "HIGH",
      window: inputs.opportunityWindow ?? "SHORT",
    };
    steps.push({ step: "OPPORTUNITY_CREATED", opportunity });

    const recognised = inputs.opportunityRecognised ?? false;
    steps.push({ step: "OPPORTUNITY_RECOGNITION", result: recognised ? "RECOGNISED" : "NOT_RECOGNISED" });
    if (!recognised) {
      // Opportunity existed but the attack did not use it (Bible S43/S45):
      // the opportunity and the outcome remain distinct concepts.
      return { opportunity, outcome: "CONTINUE_PLAY" };
    }

    steps.push({ step: "EXPLOITATION_ACTION", action: "PIVOT_PASS" });
    const executionQuality = inputs.exploitationExecutionQuality ?? "POOR";
    steps.push({ step: "EXPLOITATION_EXECUTION", quality: executionQuality });
    const outcome: TacticalOutcome = executionQuality === "GOOD" || executionQuality === "EXCELLENT" ? "PIVOT_ACCESS" : "TURNOVER";
    return { opportunity, outcome, action: "PIVOT_PASS" };
  }

  steps.push({ step: "OPPORTUNITY_NOT_CREATED" });
  return { outcome: "CONTINUE_PLAY" };
}

export function resolveATI001(inputs: Inputs): Result {
  const steps: ResolutionTraceStep[] = [];
  const executionAssessments: ExecutionAssessment[] = [];

  // Gate 1: Create the Problem (Bible S34).
  steps.push({ step: "THREAT_CREATION", trigger: TRIGGER, result: inputs.threatCreated ? "CREATED" : "NOT_CREATED" });
  if (!inputs.threatCreated) {
    const outcome: TacticalOutcome = "NO_ADVANTAGE";
    steps.push({ step: "TACTICAL_OUTCOME", outcome });
    return {
      outcome,
      executionAssessments,
      collectiveResolution: "NOT_APPLICABLE",
      trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
    };
  }

  // Gate 2: Choose Response (Bible S35).
  steps.push({ step: "H2_RESPONSE_SELECTED", response: inputs.h2Response });

  // Gate 3: Execute Response (Bible S36/S37).
  const h2Assessment: ExecutionAssessment = {
    actor: "H2",
    task: h2Task(inputs.h2Response),
    requirements: H2_REQUIREMENTS,
    quality: inputs.h2ExecutionQuality,
  };
  executionAssessments.push(h2Assessment);
  steps.push({ step: "H2_EXECUTION", quality: inputs.h2ExecutionQuality });

  if (inputs.h2Response !== "H2_STEPS") {
    // Non-stepping branch (HOLDS/DELAYS/STEERS/STOPS): per Bible S20.1,
    // holding does not automatically mean attack success -- ATI-001
    // must evaluate whether V9 still has a meaningful advantage.
    const advantageRemains = inputs.postResponseAdvantageRemains ?? false;
    steps.push({ step: "POST_RESPONSE_ADVANTAGE_EVALUATED", advantageRemains });
    const outcome: TacticalOutcome = advantageRemains ? "9M_ATTACK_CONTINUES" : "CONTINUE_PLAY";
    steps.push({ step: "TACTICAL_OUTCOME", outcome });
    return {
      outcome,
      executionAssessments,
      collectiveResolution: "NOT_APPLICABLE",
      trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
    };
  }

  // H2 stepped: attack must read H3 before choosing exploitation (Bible S20.2).
  const h3Response = inputs.h3Response ?? "H3_HOLDS";
  steps.push({ step: "H3_RESPONSE_SELECTED", response: h3Response });

  const h3ExecutionQuality = inputs.h3ExecutionQuality ?? "AVERAGE";
  const h3Assessment: ExecutionAssessment = {
    actor: "H3",
    task: `H3_${h3Response.replace("H3_", "")}`,
    requirements: H3_REQUIREMENTS[h3Response] ?? [],
    quality: h3ExecutionQuality,
  };
  executionAssessments.push(h3Assessment);
  steps.push({ step: "H3_EXECUTION", quality: h3ExecutionQuality });

  // Gate 4: Solve Collectively (Bible S38/S39).
  const relationshipAssessment: RelationshipAssessment = {
    relationship: "H2_H3",
    workingRule: "WR_DEF_H2_H3_STEP_COVER",
    factors: {
      familiarity: inputs.relationshipFactors?.familiarity ?? "AVERAGE",
      coordination: inputs.relationshipFactors?.coordination ?? "AVERAGE",
      communication: inputs.relationshipFactors?.communication ?? "AVERAGE",
      roleCompatibility: inputs.relationshipFactors?.roleCompatibility ?? "AVERAGE",
    },
    quality: inputs.relationshipQuality ?? "AVERAGE",
  };
  const collectiveResolution = solveCollectively(inputs.h2Response, h3Response);
  steps.push({ step: "COLLECTIVE_RESOLUTION", resolution: collectiveResolution });

  // Gate 5 + Gate 6: Recognise Opportunity / Exploit Opportunity (Bible S43/S44).
  const { opportunity, outcome: exploitOutcome, action } = recogniseAndExploit(collectiveResolution, inputs, steps);

  let outcome: TacticalOutcome = exploitOutcome;
  if (collectiveResolution === "H3_SECURES" || collectiveResolution === "H3_TAKES_OVER") {
    // Immediate behind-H2 option closed, but H3's security changed the
    // H2-H3 relationship and may open the next Tactical Interaction
    // (Bible S20.4/S21). This proof stops at NEXT_INTERACTION_AVAILABLE
    // and does not invent that next interaction.
    steps.push({ step: "RELATIONSHIP_CHANGED", relationship: "H2_H3" });
    steps.push({ step: "NEXT_INTERACTION_AVAILABLE", targetRelationship: "H2_H3" });
    outcome = "RELATIONSHIP_CHANGED";
  } else if (collectiveResolution === "H3_OVERHELPS") {
    // Overhelp/double commitment (Bible S20.5/S38): binds more
    // defenders than necessary, transferring the problem to a
    // different relationship. Chaining flagged, not implemented.
    steps.push({ step: "RELATIONSHIP_CHANGED", relationship: "V9_M6" });
    steps.push({ step: "NEXT_INTERACTION_AVAILABLE", targetRelationship: "V9_M6" });
    outcome = "NEXT_INTERACTION_AVAILABLE";
  }

  steps.push({ step: "TACTICAL_OUTCOME", outcome });

  return {
    outcome,
    opportunity,
    action,
    executionAssessments,
    relationshipAssessment,
    collectiveResolution,
    trace: { interaction: "ATI-001 x TI-001", trigger: TRIGGER, steps },
  };
}
