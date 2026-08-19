import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveATI001 } from "./ati001";
import type { ATI001Inputs } from "./resolverTypes";

function find(steps: { step: string }[], name: string) {
  return steps.filter((s) => s.step === name);
}

// PATH A: threat not successfully created.
test("PATH A - threat not created yields NO_ADVANTAGE without a defensive response", () => {
  const inputs: ATI001Inputs = {
    threatCreated: false,
    h2Response: "H2_HOLDS",
    h2ExecutionQuality: "AVERAGE",
  };
  const result = resolveATI001(inputs);

  assert.equal(result.outcome, "NO_ADVANTAGE");
  assert.equal(result.opportunity, undefined);
  // Defence never had to reveal a response (Bible S34) -- H2 never selects.
  assert.equal(find(result.trace.steps, "H2_RESPONSE_SELECTED").length, 0);
  assert.deepEqual(result.trace.steps[0], {
    step: "THREAT_CREATION",
    trigger: "CREDIBLE_9M_THREAT",
    result: "NOT_CREATED",
  });
});

// PATH B: CREDIBLE_9M_THREAT exists, H2 holds -- holding is not automatic success.
test("PATH B - H2 holds does not automatically produce attack success", () => {
  const inputs: ATI001Inputs = {
    threatCreated: true,
    h2Response: "H2_HOLDS",
    h2ExecutionQuality: "GOOD",
    postResponseAdvantageRemains: false,
  };
  const result = resolveATI001(inputs);

  assert.equal(result.outcome, "CONTINUE_PLAY");
  assert.notEqual(result.outcome, "9M_ATTACK_CONTINUES");
  const evalStep = find(result.trace.steps, "POST_RESPONSE_ADVANTAGE_EVALUATED")[0] as unknown as {
    advantageRemains: boolean;
  };
  assert.equal(evalStep.advantageRemains, false);
});

test("PATH B (contrast) - H2 holds but V9 retains advantage continues the attack", () => {
  const inputs: ATI001Inputs = {
    threatCreated: true,
    h2Response: "H2_HOLDS",
    h2ExecutionQuality: "POOR",
    postResponseAdvantageRemains: true,
  };
  const result = resolveATI001(inputs);
  assert.equal(result.outcome, "9M_ATTACK_CONTINUES");
});

// PATH C: H2 steps, H3 secures effectively -- immediate option controlled.
test("PATH C - H2 steps and H3 secures produces RELATIONSHIP_CHANGED and NEXT_INTERACTION_AVAILABLE", () => {
  const inputs: ATI001Inputs = {
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_SECURES",
    h3ExecutionQuality: "GOOD",
    relationshipQuality: "GOOD",
  };
  const result = resolveATI001(inputs);

  assert.equal(result.outcome, "RELATIONSHIP_CHANGED");
  assert.equal(result.collectiveResolution, "H3_SECURES");
  assert.equal(result.opportunity, undefined);
  assert.equal(find(result.trace.steps, "RELATIONSHIP_CHANGED").length, 1);
  assert.deepEqual(find(result.trace.steps, "RELATIONSHIP_CHANGED")[0], {
    step: "RELATIONSHIP_CHANGED",
    relationship: "H2_H3",
  });
  assert.deepEqual(find(result.trace.steps, "NEXT_INTERACTION_AVAILABLE")[0], {
    step: "NEXT_INTERACTION_AVAILABLE",
    targetRelationship: "H2_H3",
  });
  // No new Tactical Interaction is invented -- only the flag is produced.
});

// PATH D: H2 steps, H3 is late -- a real TacticalOpportunity must be created.
test("PATH D - H2 steps and H3 is late creates a PIVOT_ACCESS TacticalOpportunity", () => {
  const inputs: ATI001Inputs = {
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_LATE",
    h3ExecutionQuality: "POOR",
    opportunityRecognised: false, // recognition irrelevant to whether the opportunity itself exists
  };
  const result = resolveATI001(inputs);

  assert.ok(result.opportunity, "expected a TacticalOpportunity to be created");
  assert.deepEqual(result.opportunity, {
    type: "PIVOT_ACCESS",
    createdBy: ["H2_STEPS", "H3_LATE"],
    targetRelationship: "H2_H3",
    quality: "HIGH",
    window: "SHORT",
  });
  assert.equal(result.collectiveResolution, "H3_LATE");
});

// PATH E: opportunity exists but attack does not recognise it -- opportunity != outcome.
test("PATH E - unrecognised opportunity remains distinct from the tactical outcome", () => {
  const inputs: ATI001Inputs = {
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_LATE",
    h3ExecutionQuality: "POOR",
    opportunityRecognised: false,
  };
  const result = resolveATI001(inputs);

  assert.ok(result.opportunity, "opportunity must still exist");
  assert.equal(result.opportunity?.type, "PIVOT_ACCESS");
  assert.equal(result.outcome, "CONTINUE_PLAY");
  assert.notEqual(result.outcome as string, result.opportunity?.type as string);
  assert.equal(result.action, undefined, "no exploitation action should be attempted without recognition");
  assert.deepEqual(find(result.trace.steps, "OPPORTUNITY_RECOGNITION")[0], {
    step: "OPPORTUNITY_RECOGNITION",
    result: "NOT_RECOGNISED",
  });
  assert.equal(find(result.trace.steps, "EXPLOITATION_ACTION").length, 0);
});

// PATH F: opportunity recognised, exploitation execution fails.
test("PATH F - recognised opportunity with poor exploitation execution produces TURNOVER", () => {
  const inputs: ATI001Inputs = {
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_LATE",
    h3ExecutionQuality: "POOR",
    opportunityRecognised: true,
    exploitationExecutionQuality: "POOR",
  };
  const result = resolveATI001(inputs);

  assert.equal(result.opportunity?.type, "PIVOT_ACCESS");
  assert.equal(result.action, "PIVOT_PASS");
  assert.equal(result.outcome, "TURNOVER");
  // Opportunity, action and outcome are distinct fields, per Bible S45.
  assert.notEqual(result.opportunity?.type as string, result.outcome as string);
  assert.deepEqual(find(result.trace.steps, "EXPLOITATION_EXECUTION")[0], {
    step: "EXPLOITATION_EXECUTION",
    quality: "POOR",
  });
});

// PATH G: opportunity recognised and successfully exploited.
test("PATH G - recognised opportunity with good exploitation execution produces a positive tactical outcome", () => {
  const inputs: ATI001Inputs = {
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_LATE",
    h3ExecutionQuality: "POOR",
    opportunityRecognised: true,
    exploitationExecutionQuality: "GOOD",
  };
  const result = resolveATI001(inputs);

  assert.equal(result.opportunity?.type, "PIVOT_ACCESS");
  assert.equal(result.action, "PIVOT_PASS");
  assert.equal(result.outcome, "PIVOT_ACCESS");
  // No shot/goal is resolved here -- this is a tactical outcome only.
  assert.ok(!("shot" in result) && !("goal" in result));
});

// PATH H: defensive response changes another relationship and creates NEXT_INTERACTION_AVAILABLE
// via overhelp/double commitment, distinct from PATH C's clean H3_SECURES chain.
test("PATH H - H3 overhelps transfers the problem and flags NEXT_INTERACTION_AVAILABLE without inventing ATI-002", () => {
  const inputs: ATI001Inputs = {
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_OVERHELPS",
    h3ExecutionQuality: "AVERAGE",
  };
  const result = resolveATI001(inputs);

  assert.equal(result.collectiveResolution, "H3_OVERHELPS");
  assert.equal(result.outcome, "NEXT_INTERACTION_AVAILABLE");
  assert.deepEqual(find(result.trace.steps, "RELATIONSHIP_CHANGED")[0], {
    step: "RELATIONSHIP_CHANGED",
    relationship: "V9_M6",
  });
  assert.deepEqual(find(result.trace.steps, "NEXT_INTERACTION_AVAILABLE")[0], {
    step: "NEXT_INTERACTION_AVAILABLE",
    targetRelationship: "V9_M6",
  });
  // The next interaction is flagged, not implemented -- no ATI-002 fields exist on the result.
  assert.ok(!("nextInteraction" in result));
});

// Structural / domain-shape assertions shared across the proof.

test("ResolutionTrace preserves causal order matching the Bible S51 example shape", () => {
  const result = resolveATI001({
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_LATE",
    h3ExecutionQuality: "POOR",
    opportunityRecognised: true,
    exploitationExecutionQuality: "GOOD",
  });

  const order = result.trace.steps.map((s) => s.step);
  assert.deepEqual(order, [
    "THREAT_CREATION",
    "H2_RESPONSE_SELECTED",
    "H2_EXECUTION",
    "H3_RESPONSE_SELECTED",
    "H3_EXECUTION",
    "COLLECTIVE_RESOLUTION",
    "OPPORTUNITY_CREATED",
    "OPPORTUNITY_RECOGNITION",
    "EXPLOITATION_ACTION",
    "EXPLOITATION_EXECUTION",
    "TACTICAL_OUTCOME",
  ]);
  assert.equal(result.trace.interaction, "ATI-001 x TI-001");
  assert.equal(result.trace.trigger, "CREDIBLE_9M_THREAT");
});

test("ExecutionAssessment is situational, not a permanent attribute -- no numeric rating field exists", () => {
  const result = resolveATI001({
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_SECURES",
    h3ExecutionQuality: "EXCELLENT",
  });

  for (const assessment of result.executionAssessments) {
    assert.ok(["H2", "H3", "V9", "M6"].includes(assessment.actor));
    assert.ok(typeof assessment.task === "string" && assessment.task.length > 0);
    assert.ok(Array.isArray(assessment.requirements));
    assert.ok(["POOR", "AVERAGE", "GOOD", "EXCELLENT"].includes(assessment.quality));
    assert.ok(!("overallRating" in assessment));
  }
  assert.equal(result.executionAssessments.length, 2);
  assert.equal(result.executionAssessments[0].actor, "H2");
  assert.equal(result.executionAssessments[1].actor, "H3");
});

test("RelationshipAssessment is only produced for H2-H3 when H2 steps, and carries no locked numeric scale", () => {
  const stepped = resolveATI001({
    threatCreated: true,
    h2Response: "H2_STEPS",
    h2ExecutionQuality: "GOOD",
    h3Response: "H3_HOLDS",
    h3ExecutionQuality: "AVERAGE",
  });
  assert.ok(stepped.relationshipAssessment);
  assert.equal(stepped.relationshipAssessment?.relationship, "H2_H3");
  assert.equal(stepped.relationshipAssessment?.workingRule, "WR_DEF_H2_H3_STEP_COVER");

  const held = resolveATI001({
    threatCreated: true,
    h2Response: "H2_HOLDS",
    h2ExecutionQuality: "GOOD",
    postResponseAdvantageRemains: false,
  });
  assert.equal(held.relationshipAssessment, undefined);
});
