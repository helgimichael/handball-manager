// HM-INJURIES-1.0 Part 19/20/24/25: pure rehab-progression math. No
// CareerState reads/writes here (injuryIntegration.ts is the glue layer),
// mirroring lib/staff/roleSuitability.ts's own pure/integration split.
import { rehabPhaseForProgress, type ActiveInjury } from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Part 20/29: advances one day of rehab. `medicalQuality` is
 * computeMedicalRehabQuality's own [0.75, 1.25] multiplier -- a stronger
 * physio genuinely speeds recovery, a weaker one slows it, both bounded
 * (Part 21). Idempotent per caller discipline: `injury.lastRehabProcessedDate`
 * must be checked by the caller (injuryIntegration.ts) before calling this
 * for a given date (Part 30/35 -- "reload does not duplicate rehab
 * progression").
 */
export function advanceRehabOneDay(injury: ActiveInjury, date: string, medicalQuality: number): ActiveInjury {
  const dailyIncrement = (1 / injury.expectedDurationDays) * medicalQuality;
  const rehabProgress = clamp(injury.rehabProgress + dailyIncrement, 0, 1);
  const currentPhase = rehabPhaseForProgress(rehabProgress);
  return { ...injury, rehabProgress, currentPhase, lastRehabProcessedDate: date };
}

/** Part 25: fully recovered once progress reaches 1.0 -- the caller then moves the injury into history and restores AVAILABLE. */
export function isFullyRecovered(injury: ActiveInjury): boolean {
  return injury.rehabProgress >= 1;
}
