// HM-ALPHA2-04B: offensive tempo at the plan/engine boundary.
// The match plan already stores `attackPlan.tempo` as SLOW / BALANCED / FAST.
// The played (v2) match reads it as SLOW / BALANCED / QUICK, the engine's own
// names (QUICK predates this and stays valid in active saves). Shown to the
// coach as Lugnt / Balanserat / Snabbt -- low, balanced and high tempo.
import type { OffensiveTempo } from "@handball-manager/handball-engine/src/v2/core/coaching";
import type { AttackPlanConfig } from "./types";

/** The engine tempo for a stored plan. Missing or unknown plays BALANCED, as before. */
export function engineOffensiveTempo(plan: Pick<AttackPlanConfig, "tempo"> | undefined): OffensiveTempo {
  const tempo = plan?.tempo;
  return tempo === "SLOW" ? "SLOW" : tempo === "FAST" ? "QUICK" : "BALANCED";
}

/** The plan value a chosen engine tempo is stored as. */
export function attackPlanTempo(tempo: OffensiveTempo): AttackPlanConfig["tempo"] {
  return tempo === "SLOW" ? "SLOW" : tempo === "QUICK" ? "FAST" : "BALANCED";
}
