// HM-ALPHA2-02B: individual between-match recovery. Extends -- never
// replaces -- the existing day-level recovery (trainingLoad.ts's
// overnight / REST / empty-RECOVERY formulas): the energy those formulas
// would restore today is scaled by this player's own recovery efficiency,
// and, when recent workload clearly exceeds what the player is used to,
// capped by a temporary readiness ceiling.
//
// Readiness (currentEnergy, 0-100) and workload (the WP ledger) stay
// separate quantities: workload only shapes how efficiently readiness
// comes back. The spike ratio below is a game-balance input, NOT a
// validated medical risk score, and nothing here touches injury odds.
import { addDays, daysBetween } from "../career/dateUtils";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getCareerSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { workloadWindow, type WorkloadWindow } from "./workloadLedger";

export const RECOVERY_TUNING = {
  /** Attribute capacity: 1-20 mean of ENDURANCE and REPEAT_SPRINT_ABILITY maps linearly onto this range (10.5 -> 1.0). */
  capacityMin: 0.85,
  capacityMax: 1.15,
  /** Age: recovery efficiency falls this much per year above `ageFrom`, never by more than `ageMaxLoss`. */
  ageFrom: 29,
  agePerYear: 0.015,
  ageMaxLoss: 0.15,
  /** Workload reference never below a light training week, so a lightly-used player's ratio stays meaningful. */
  weeklyReferenceFloor: 50,
  /** Per unit of spike above the player's own tolerance (= capacity). */
  loadSlope: 0.4,
  loadFactorMin: 0.75,
  ceilingSlope: 20,
  ceilingMin: 80,
  /** The night after a match costs up to this share of recovery (scaled by that match's own load), half of it the night after. */
  postMatchMaxLoss: 0.2,
  postMatchFullLoad: 80,
  injuredFactor: 0.9,
  efficiencyMin: 0.6,
  efficiencyMax: 1.2,
} as const;

const T = RECOVERY_TUNING;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round2 = (n: number) => Math.round(n * 100) / 100;

export type RecoveryInputs = {
  /** 1-20 attribute values; undefined = not modelled for this player (neutral). */
  endurance?: number;
  repeatSprint?: number;
  age: number | null;
  /** Rolling windows ending the day BEFORE the recovery night. */
  window7: WorkloadWindow;
  window28: WorkloadWindow;
  /** Most recent recorded match before the recovery night, if any. */
  lastMatch: { daysSince: number; load: number } | null;
  injured: boolean;
};

export type RecoveryProfile = {
  capacity: number;
  ageFactor: number;
  /** acute 7-day load / max(28-day weekly average, floor); null until both windows are complete. */
  spike: number | null;
  loadFactor: number;
  postMatchFactor: number;
  medicalFactor: number;
  efficiency: number;
  ceiling: number;
  /** False while the ledger does not yet cover 28 days: workload terms stay neutral. */
  workloadDataComplete: boolean;
};

export function recoveryProfile(i: RecoveryInputs): RecoveryProfile {
  const attrs = [i.endurance, i.repeatSprint].filter((v): v is number => typeof v === "number");
  const attrMean = attrs.length ? attrs.reduce((a, b) => a + b, 0) / attrs.length : 10.5;
  const capacity = T.capacityMin + (T.capacityMax - T.capacityMin) * clamp((attrMean - 1) / 19, 0, 1);
  const ageFactor = i.age === null ? 1 : 1 - Math.min(T.ageMaxLoss, T.agePerYear * Math.max(0, i.age - T.ageFrom));

  const workloadDataComplete = i.window7.complete && i.window28.complete;
  let spike: number | null = null;
  let loadFactor = 1;
  let ceiling = 100;
  if (workloadDataComplete) {
    spike = i.window7.total / Math.max(i.window28.total / 4, T.weeklyReferenceFloor);
    const excess = Math.max(0, spike - capacity); // better-conditioned players tolerate more
    loadFactor = clamp(1 - T.loadSlope * excess, T.loadFactorMin, 1);
    ceiling = clamp(100 - T.ceilingSlope * excess, T.ceilingMin, 100);
  }

  const soreness = i.lastMatch && i.lastMatch.daysSince >= 1 && i.lastMatch.daysSince <= 2
    ? T.postMatchMaxLoss * clamp(i.lastMatch.load / T.postMatchFullLoad, 0, 1) * (i.lastMatch.daysSince === 1 ? 1 : 0.5)
    : 0;
  const postMatchFactor = 1 - soreness;
  const medicalFactor = i.injured ? T.injuredFactor : 1;
  const efficiency = clamp(capacity * ageFactor * loadFactor * postMatchFactor * medicalFactor, T.efficiencyMin, T.efficiencyMax);
  return {
    capacity: round2(capacity), ageFactor: round2(ageFactor), spike: spike === null ? null : round2(spike), loadFactor: round2(loadFactor),
    postMatchFactor: round2(postMatchFactor), medicalFactor, efficiency: round2(efficiency), ceiling: Math.round(ceiling * 10) / 10, workloadDataComplete,
  };
}

/**
 * `baselineAfter` is what the existing day-level formulas would give.
 * The gain is scaled by efficiency (always > 0, so recovery is always
 * possible) and stops at the ceiling; recovery never lowers energy.
 */
export function applyIndividualRecovery(energyBefore: number, baselineAfter: number, profile: RecoveryProfile): number {
  const gain = Math.max(0, baselineAfter - energyBefore) * profile.efficiency;
  if (energyBefore >= profile.ceiling) return energyBefore;
  return Math.min(energyBefore + gain, profile.ceiling, 100);
}

function attributeOf(rating: GameplayPlayerRating | undefined, key: "ENDURANCE" | "REPEAT_SPRINT_ABILITY"): number | undefined {
  if (!rating || rating.branch.branch !== "OUTCOURT") return undefined; // goalkeepers: neutral, same precedent as staminaOf
  return rating.branch.attributes[key]?.value;
}

/** Inputs for one manager-squad player on the night before `date`'s activities. */
export function recoveryInputsFor(state: CareerState, playerId: string, date: string): RecoveryInputs {
  const asOf = addDays(date, -1);
  const rating = (state.gameplayRatings[state.playerClubId] ?? []).find((r) => r.playerId === playerId);
  const player = getCareerSquad(state).find((p) => p.id === playerId);
  const lastMatch = [...(state.workloadLedger?.entries[playerId] ?? [])].reverse().find((e) => e.source === "MATCH" && e.date < date);
  return {
    endurance: attributeOf(rating, "ENDURANCE"),
    repeatSprint: attributeOf(rating, "REPEAT_SPRINT_ABILITY"),
    age: player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, date) : null,
    window7: workloadWindow(state.workloadLedger, playerId, asOf, 7),
    window28: workloadWindow(state.workloadLedger, playerId, asOf, 28),
    lastMatch: lastMatch ? { daysSince: daysBetween(lastMatch.date, date), load: lastMatch.load } : null,
    injured: state.playerStatuses[playerId]?.availability === "INJURED",
  };
}

export function recoveryProfileFor(state: CareerState, playerId: string, date: string): RecoveryProfile {
  return recoveryProfile(recoveryInputsFor(state, playerId, date));
}
