// HM-ALPHA2-04A: defensive aggression at the plan/engine boundary.
// The match plan already carries the pressure and risk dials
// (`ballOrientedPressure`, `riskLevel`, LOW/MEDIUM/HIGH). The played (v2)
// match reads them as one coaching decision, LOW / BALANCED / HIGH, which
// moves the defensive line in the engine. Pressure is the stored source;
// the tactics page writes both dials together so the plan stays coherent.
import type { DefensiveAggression } from "@handball-manager/handball-engine/src/v2/core/coaching";
import type { DefencePlanConfig, IntensityLevel } from "./types";

/** The engine level for a stored plan. Missing or MEDIUM plays BALANCED, as before. */
export function engineDefensiveAggression(plan: Pick<DefencePlanConfig, "ballOrientedPressure"> | undefined): DefensiveAggression {
  const pressure = plan?.ballOrientedPressure;
  return pressure === "LOW" ? "LOW" : pressure === "HIGH" ? "HIGH" : "BALANCED";
}

/** The plan dials a chosen level is stored as. */
export function defencePlanAggression(level: DefensiveAggression): Pick<DefencePlanConfig, "ballOrientedPressure" | "riskLevel"> {
  const intensity: IntensityLevel = level === "BALANCED" ? "MEDIUM" : level;
  return { ballOrientedPressure: intensity, riskLevel: intensity };
}
