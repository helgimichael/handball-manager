// HM-STAFF-CAREER-1.0 Part 4: a simple, deterministic staff-candidate
// decision rule -- the exact same shape as
// lib/transfers/playerDecision.ts's evaluatePlayerDecision (wage delta
// matters most, a competition-tier upgrade/downgrade matters, the
// candidate's OWN current club situation -- here, their current club's
// financial pressure -- nudges them toward accepting), with a small
// per-person deterministic jitter so identical offers to different
// people don't all resolve identically. No personality/morale-agent
// system, matching the same instruction playerDecision.ts already
// documents.
import { seededOffset } from "../rating/generation/deterministicVariation";
import type { FinancialPressureLevel } from "../economy/clubEconomyTypes";

export interface StaffDecisionResult {
  accept: boolean;
  reason: string;
}

export interface StaffDecisionInputs {
  staffId: string;
  currentWageEurPerMonth: number;
  offeredWageEurPerMonth: number;
  currentClubTier: 1 | 2 | undefined;
  newClubTier: 1 | 2 | undefined;
  currentClubPressure: FinancialPressureLevel;
}

export function evaluateStaffDecision(inputs: StaffDecisionInputs): StaffDecisionResult {
  const wageDelta = inputs.currentWageEurPerMonth > 0 ? (inputs.offeredWageEurPerMonth - inputs.currentWageEurPerMonth) / inputs.currentWageEurPerMonth : 1;
  const currentTierScore = inputs.currentClubTier === 1 ? 1 : 0;
  const newTierScore = inputs.newClubTier === 1 ? 1 : 0;
  const tierDelta = newTierScore - currentTierScore;

  const pressureBonus: Record<FinancialPressureLevel, number> = { NONE: 0, WATCH: 0, PRESSURED: 0.05, SERIOUS: 0.1, CRITICAL: 0.15 };

  const jitter = seededOffset(`${inputs.staffId}:staffRecruitment:decision-jitter`, 10) / 100; // deterministic +/-0.10

  const score = wageDelta * 0.5 + tierDelta * 0.25 + pressureBonus[inputs.currentClubPressure] + jitter;

  if (score > -0.05) {
    return { accept: true, reason: "Personen är nöjd med erbjudandet och den nya situationen." };
  }
  return { accept: false, reason: "Personen tackar nej -- erbjudandet väger inte upp mot nuvarande situation." };
}
