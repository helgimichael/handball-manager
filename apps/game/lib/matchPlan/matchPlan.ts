// HM-TACTICS-1.0 Part K: the top-level MatchPlan validator, composing
// every sub-domain validator. Pure, deterministic, no fs/React/match-
// engine coupling.
import { validateDepthHierarchy } from "./depthHierarchy";
import { validateMatchSquad, type MatchPlanValidationResult } from "./matchSquad";
import { validatePlayerUsage } from "./playerUsage";
import { validateAttackStartingUnit, validateDefenceStartingUnit } from "./startingUnits";
import { validateSubstitutionPairs } from "./substitutionPairs";
import type { MatchPlan } from "./types";

export function validateMatchPlan(plan: MatchPlan, availablePlayerIds?: readonly string[]): MatchPlanValidationResult {
  const errors: string[] = [
    ...validateMatchSquad(plan.squad, availablePlayerIds).errors,
    ...validateAttackStartingUnit(plan.attackStartingUnit, plan.squad).errors,
    ...validateDefenceStartingUnit(plan.defenceStartingUnit, plan.squad).errors,
    ...validatePlayerUsage(plan.playerUsage, plan.squad).errors,
    ...validateSubstitutionPairs(plan.substitutionPairs, plan.squad).errors,
    ...validateDepthHierarchy(plan.depthHierarchy, plan.squad).errors,
  ];

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}
