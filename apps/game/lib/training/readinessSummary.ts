// HM-ALPHA2-02B: plain-language readiness summary for the manager's own
// players -- current readiness, recent workload and tonight's recovery
// outlook, kept as three separate readings. Deliberately not a medical
// score: no probabilities, only what the recovery model actually uses.
import { addDays } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import { recoveryProfileFor, type RecoveryProfile } from "./individualRecovery";
import { workloadWindow, type WorkloadWindow } from "./workloadLedger";

export type RecoveryOutlook = "GOOD" | "NORMAL" | "REDUCED";
export type WorkloadTrend = "RISING" | "STABLE" | "FALLING";

export type ReadinessSummary = {
  readiness: number;
  week: WorkloadWindow;
  /** Last 7 days against the 28-day weekly average; null until 28 days are recorded. */
  trend: WorkloadTrend | null;
  outlook: RecoveryOutlook;
  reasons: string[];
  profile: RecoveryProfile;
};

export const RECOVERY_OUTLOOK_LABEL: Record<RecoveryOutlook, string> = { GOOD: "God", NORMAL: "Normal", REDUCED: "Nedsatt" };
export const WORKLOAD_TREND_LABEL: Record<WorkloadTrend, string> = { RISING: "↑ ökande", STABLE: "→ stabil", FALLING: "↓ minskande" };

export function readinessSummary(state: CareerState, playerId: string): ReadinessSummary {
  const readiness = state.playerPhysicalState[playerId]?.currentEnergy ?? 100;
  const week = workloadWindow(state.workloadLedger, playerId, state.gameDate, 7);
  const month = workloadWindow(state.workloadLedger, playerId, state.gameDate, 28);
  const trend: WorkloadTrend | null = !(week.complete && month.complete) || month.total === 0 ? null
    : week.total > (month.total / 4) * 1.15 ? "RISING" : week.total < (month.total / 4) * 0.85 ? "FALLING" : "STABLE";
  // Tonight's recovery: the profile the next executed day will use.
  const profile = recoveryProfileFor(state, playerId, addDays(state.gameDate, 1));
  const reasons: string[] = [];
  if (profile.loadFactor < 1) reasons.push("Mer belastning än spelaren är van vid de senaste veckorna");
  if (profile.ceiling < 100) reasons.push(`Återhämtar till högst ${Math.round(profile.ceiling)}% tills belastningen sjunker`);
  if (profile.postMatchFactor < 1) reasons.push("Nyligen spelad match");
  if (profile.medicalFactor < 1) reasons.push("Under rehabilitering");
  if (profile.ageFactor < 1) reasons.push("Ålder");
  if (profile.capacity >= 1.05) reasons.push("God uthållighet");
  if (profile.capacity <= 0.95) reasons.push("Lägre uthållighet");
  if (!profile.workloadDataComplete) reasons.push("Belastningshistoriken är ännu kort");
  const outlook: RecoveryOutlook = profile.efficiency >= 1.05 && profile.ceiling >= 100 ? "GOOD" : profile.efficiency < 0.92 || profile.ceiling < 100 ? "REDUCED" : "NORMAL";
  return { readiness, week, trend, outlook, reasons, profile };
}
