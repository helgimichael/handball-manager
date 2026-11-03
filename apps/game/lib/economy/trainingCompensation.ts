// HM-CONTRACTS-1.0A & HM-PLAYTEST-IMPROVEMENT-02: training/youth compensation -- a SEPARATE economic
// component, deliberately never folded into computePlayerMarketValueEur
// or any transfer-fee concept. Part: "en ung spelare
// med utgånget kontrakt/Bosman kan ha: transfer fee = €0 men training
// compensation > €0".
import { getClub, getCompetition } from "../game-data";
import type { PlayerClubHistoryEntry, TrainingCompensationResult, TrainingCompensationRuleSet } from "./types";
import {
  SHF_2026_2027_TABLE,
  EHF_IHF_2026_TABLE,
  calculatePlayerTrainingCompensation,
  calculateAcquisitionCost,
  type AcquisitionCostBreakdown,
  type TrainingCompensationResultDetailed,
} from "../transfers/trainingCompensation";

export {
  SHF_2026_2027_TABLE,
  EHF_IHF_2026_TABLE,
  calculatePlayerTrainingCompensation,
  calculateAcquisitionCost,
  type AcquisitionCostBreakdown,
  type TrainingCompensationResultDetailed,
};

/**
 * Legacy foundation placeholder preserved for backward-compatibility with older tests.
 */
export const GENERIC_FOUNDATION_RULE_SET: TrainingCompensationRuleSet = {
  version: "GENERIC_FOUNDATION_v0.1",
  maxCompensationAge: 23,
  perClubPerYearEur: (tier) => (tier === 1 ? 900 : tier === 2 ? 500 : 400),
};

function clampYears(fromAge: number, toAge: number): number {
  return Math.max(1, toAge - fromAge);
}

/**
 * Pure calculation over explicit history entries with a specific ruleSet.
 */
export function computeTrainingCompensationEur(
  age: number | null,
  history: readonly PlayerClubHistoryEntry[],
  ruleSet: TrainingCompensationRuleSet = GENERIC_FOUNDATION_RULE_SET
): TrainingCompensationResult {
  if (age === null || age > ruleSet.maxCompensationAge || history.length === 0) {
    return { totalEur: 0, perClub: [], ruleSetVersion: ruleSet.version };
  }

  const perClub = history.map((entry) => {
    const years = clampYears(entry.fromAge, entry.toAge);
    const tier = getCompetition(getClub(entry.clubId)?.competitionId ?? "")?.tier;
    const amountEur = years * ruleSet.perClubPerYearEur(tier);
    return { clubId: entry.clubId, years, amountEur };
  });

  return { totalEur: perClub.reduce((sum, c) => sum + c.amountEur, 0), perClub, ruleSetVersion: ruleSet.version };
}

/**
 * Part: "transfer fee + training compensation + signing costs = total acquisition cost"
 */
export function computeTotalAcquisitionCostEur(
  transferFeeEur: number,
  trainingCompensationEur: number,
  signingCostsEur: number = 0
): number {
  return transferFeeEur + trainingCompensationEur + signingCostsEur;
}
