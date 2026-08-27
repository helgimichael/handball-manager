// HM-CONTRACTS-1.0A: training/youth compensation -- a SEPARATE economic
// component, deliberately never folded into computePlayerMarketValueEur
// or any transfer-fee concept (none exists yet). Part: "en ung spelare
// med utgånget kontrakt/Bosman kan ha: transfer fee = €0 men training
// compensation > €0" -- this module's whole point is that it is
// evaluable completely independently of contract status/market value,
// driven ONLY by (a) the player's own age and (b) their persisted club
// history (clubHistory.ts).
//
// Part: "Om exakt SHF/EHF-formel inte redan finns tillräckligt tydligt...
// bygg inte påhittad precision." Confirmed by audit: no training/youth-
// compensation formula (SHF, EHF, or otherwise) exists anywhere in this
// project's docs or sources. GENERIC_FOUNDATION_RULE_SET below is
// therefore an HONEST, clearly-labeled FIRST-PASS placeholder -- a flat
// per-year-per-club EUR rate, scaled only by league tier -- not a claim
// of real federation calibration. See its own doc comment for exactly
// what still needs real-world calibration.
import { getClub, getCompetition } from "../game-data";
import type { PlayerClubHistoryEntry, TrainingCompensationResult, TrainingCompensationRuleSet } from "./types";

/**
 * Part: "Vi vet att utbildningsersättning och internationella övergångar
 * kan ha olika regelverk, så undvik hårdkodning som gör Sverige-formeln
 * global." This object is ONE swappable rule set, not baked into the
 * compute function's own logic -- a future Swedish-specific or EHF-
 * specific rule set is a sibling object of the exact same shape, chosen
 * by the caller (e.g. by nation/competitionId), never a rewrite of
 * computeTrainingCompensationEur itself.
 *
 * CALIBRATION STATUS (Part: "rapportera vilka delar som behöver senare
 * regelkalibrering"): maxCompensationAge=23 loosely mirrors the shape of
 * real-world (e.g. FIFA/football) training-compensation age brackets as
 * a STRUCTURAL placeholder only -- handball's own real SHF/EHF age
 * cutoff, if one exists, has not been sourced for this project and MUST
 * be verified/replaced before this is treated as realistic. The flat
 * per-year-per-tier EUR rates (900 tier 1 / 500 tier 2 / 400 unknown)
 * are ballpark, foundation-pass numbers with NO real regulatory source
 * -- calibrate against actual Swedish handball youth-compensation
 * figures (if published) or explicit design guidance before relying on
 * exact amounts anywhere beyond this foundation.
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
 * Part: "spelare under relevant ung ålder kan generera
 * utbildningsersättning... mottagande utbildningsklubb/ar kan
 * identifieras från spelarhistoriken... belopp räknas i EUR". Pure --
 * takes the player's CURRENT age and their already-persisted club
 * history, returns zero (empty result, never a crash) once the player
 * is older than `ruleSet.maxCompensationAge`. Every PAST club in
 * `history` contributes its own share, so multiple training clubs are
 * structurally representable (Part: "flera utbildningsklubbar kan
 * representeras"), not just one.
 */
export function computeTrainingCompensationEur(age: number | null, history: readonly PlayerClubHistoryEntry[], ruleSet: TrainingCompensationRuleSet = GENERIC_FOUNDATION_RULE_SET): TrainingCompensationResult {
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
 * Part: "transfer fee + training compensation + (senare) agent/signing
 * costs = total acquisition cost" -- a trivial, deliberately dumb sum.
 * No transfer system exists yet (Scope stop), so `transferFeeEur` is
 * always supplied by the caller (0 for a free transfer/Bosman scenario,
 * or a hypothetical figure for a report/example) -- this function never
 * invents or looks one up itself.
 */
export function computeTotalAcquisitionCostEur(transferFeeEur: number, trainingCompensationEur: number): number {
  return transferFeeEur + trainingCompensationEur;
}
