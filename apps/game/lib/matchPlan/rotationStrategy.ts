// HM-ALPHA2-04C: rotation at the plan/engine boundary. The plan's transition
// part stores the assistant's rotation strategy (SHORT / BALANCED / WIDE) and
// whether the assistant substitutes from kickoff. Older plans have neither and
// keep their behaviour: BALANCED, assistant off (manual substitutions only).
import type { RotationStrategy } from "@handball-manager/handball-engine/src/v2/core/coaching";
import type { TransitionPlanConfig } from "./types";

/** The engine strategy for a stored plan. Missing or unknown plays BALANCED. */
export function engineRotationStrategy(plan: Pick<TransitionPlanConfig, "rotationStrategy"> | undefined): RotationStrategy {
  const strategy = plan?.rotationStrategy;
  return strategy === "SHORT" || strategy === "WIDE" ? strategy : "BALANCED";
}

/** Whether the manager's assistant substitutes from kickoff. Missing stays off. */
export function assistantRotationAtKickoff(plan: Pick<TransitionPlanConfig, "assistantRotation"> | undefined): boolean {
  return plan?.assistantRotation === true;
}
