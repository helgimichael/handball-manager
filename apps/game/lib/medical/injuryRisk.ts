// HM-INJURIES-1.0 Part 8/9: the ONE centralized, deterministic-
// probability injury risk model. Never Math.random() -- every roll is a
// pure function of a seed key (lib/rating/generation/deterministicVariation.ts's
// existing seededOffset, the same FNV-1a-hash-based approach every other
// generation system in this codebase already uses), so identical inputs
// always resolve identically (Part 8).
import { seededOffset } from "../rating/generation/deterministicVariation";
import type { TrainingIntensity, TrainingSessionType } from "../training/types";
import {
  CONTACT_INJURY_TYPES,
  INJURY_SEVERITIES,
  OVERUSE_INJURY_TYPES,
  SEVERITY_DURATION_RANGE_DAYS,
  type BodyArea,
  type InjuryMechanism,
  type InjurySeverity,
  type InjuryType,
} from "./types";
import type { InjuryHistoryEntry } from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Deterministic roll in [0, 1) -- reuses seededOffset's own hash rather than a second RNG implementation. */
export function seededRoll(seedKey: string): number {
  const offset = seededOffset(seedKey, 1_000_000); // integer in [-1_000_000, 1_000_000]
  return (offset + 1_000_000) / 2_000_000; // rescaled to [0, 1)
}

// ---------------------------------------------------------------------------
// Part 9: critical tuning constants -- kept low by design (Part 9: "most
// players should NOT get injured every week"). Every modifier below is a
// BOUNDED multiplier around 1.0 (neutral); risk only compounds when
// multiple real stressors stack (Part 9's own explicit requirement).
// ---------------------------------------------------------------------------

/** Per FULL-participation, NORMAL-intensity training session -- deliberately tiny (Part 9). */
const TRAINING_BASE_OVERUSE_RISK = 0.0009;
/** Per fixture, at full (1.0) exposure in one phase -- match load carries more real injury risk than one training session (Part 9's own "meaningful but uncommon" balance). */
const MATCH_BASE_CONTACT_RISK = 0.006;
const MATCH_BASE_OVERUSE_RISK = 0.0025;

const MAX_TRAINING_RISK_PER_SESSION = 0.03;
const MAX_MATCH_RISK_PER_PHASE = 0.05;

const PARTICIPATION_EXPOSURE_FACTOR: Record<"FULL" | "REDUCED" | "RECOVERY_ONLY" | "REST", number> = {
  FULL: 1.0,
  REDUCED: 0.5,
  RECOVERY_ONLY: 0.15,
  REST: 0,
};

const INTENSITY_RISK_FACTOR: Record<TrainingIntensity, number> = { LOW: 0.6, NORMAL: 1.0, HIGH: 1.5, VERY_HIGH: 2.0 };

/** Part 7: only session types with real physical/contact load carry meaningful overuse risk -- a pure tactical walkthrough or RECOVERY session is not a stressor. */
const SESSION_TYPE_RISK_FACTOR: Record<TrainingSessionType, number> = {
  TEAM_TACTICAL: 0.3,
  ATTACK: 0.7,
  DEFENCE: 0.8,
  TRANSITION: 0.7,
  SPECIAL_PLAY: 0.5,
  TECHNICAL: 0.5,
  PHYSICAL: 1.1,
  STRENGTH: 1.0,
  CONDITIONING: 1.3,
  GOALKEEPER: 0.6,
  MATCH_PREPARATION: 0.4,
  RECOVERY: 0.05,
};

/** Part 11: smooth, bounded -- a 31-year-old is not permanently fragile. Neutral at 24, rising gently past 28, easing off past 33 (no cliff). */
export function ageRiskModifier(age: number | null): number {
  if (age === null) return 1.0;
  if (age <= 24) return 1.0;
  const over = Math.min(age - 24, 14); // caps growth beyond 38
  return clamp(1.0 + over * 0.02, 1.0, 1.28);
}

/** Part 6/10: lower current energy -> higher risk. Neutral at 80+, rising as energy drops toward 0. */
export function fatigueRiskModifier(currentEnergy: number): number {
  const e = clamp(currentEnergy, 0, 100);
  if (e >= 80) return 1.0;
  return clamp(1.0 + ((80 - e) / 80) * 0.7, 1.0, 1.7);
}

/** Part 5/9: heavier decaying recent training/match load -> higher overuse risk. `recentLoad` is PlayerPhysicalState's own existing decaying magnitude (lib/training/types.ts). */
export function recentLoadRiskModifier(recentLoad: number): number {
  return clamp(1.0 + Math.min(recentLoad, 40) / 40 * 0.8, 1.0, 1.8);
}

/** Part 10/12: STRENGTH/CONTACT_BALANCE lower CONTACT risk; ENDURANCE/REPEAT_SPRINT_ABILITY lower OVERUSE risk. Neutral (1.0) at the attribute midpoint (10.5/20), bounded. Goalkeepers (no PHYSICAL family) always get the neutral value -- same established fallback as playerMatchStrength.ts's GOALKEEPER_NEUTRAL_STAMINA. */
export function physicalResilienceModifier(avgRelevantAttribute: number | null): number {
  if (avgRelevantAttribute === null) return 1.0;
  const t = (avgRelevantAttribute - 10.5) / 9.5; // -1..1 across the 1-20 scale
  return clamp(1.0 - t * 0.2, 0.8, 1.2);
}

/** Part 12/34: recurrence risk from a same-body-area injury within its own recurrence window -- decays linearly back to 1.0 as the window elapses, bounded. */
const RECURRENCE_WINDOW_DAYS = 60;
const RECURRENCE_MAX_MULTIPLIER = 1.5;

export function recurrenceRiskModifier(history: readonly InjuryHistoryEntry[], bodyArea: BodyArea, asOfDate: string): number {
  let best = 1.0;
  const asOf = new Date(`${asOfDate}T00:00:00Z`).getTime();
  for (const entry of history) {
    if (entry.bodyArea !== bodyArea) continue;
    const returned = new Date(`${entry.returnDate}T00:00:00Z`).getTime();
    const daysSinceReturn = (asOf - returned) / 86_400_000;
    if (daysSinceReturn < 0 || daysSinceReturn > RECURRENCE_WINDOW_DAYS) continue;
    const t = 1 - daysSinceReturn / RECURRENCE_WINDOW_DAYS; // 1.0 right after return -> 0.0 at window edge
    const multiplier = 1.0 + t * (RECURRENCE_MAX_MULTIPLIER - 1.0);
    if (multiplier > best) best = multiplier;
  }
  return best;
}

export interface InjuryRiskInputs {
  age: number | null;
  currentEnergy: number;
  recentLoad: number;
  physicalResilience: number | null;
  injuryHistory: readonly InjuryHistoryEntry[];
  asOfDate: string;
}

// Recurrence is body-area-specific, but at RISK-COMPUTATION time we don't
// yet know which body area a not-yet-occurred injury would affect -- use
// the single worst (highest) recurrence multiplier across any body area
// currently within its window, a conservative but honest approximation
// (Part 12: "increase recurrence risk", never claimed to be area-exact
// before the injury type itself is chosen).
function worstRecurrenceModifier(history: readonly InjuryHistoryEntry[], asOfDate: string): number {
  let best = 1.0;
  for (const area of new Set(history.map((h) => h.bodyArea))) {
    const m = recurrenceRiskModifier(history, area, asOfDate);
    if (m > best) best = m;
  }
  return best;
}

/**
 * Part 14: training injury risk -- OVERUSE mechanism only (Part 7: never
 * one identical formula for all injury types; training carries no acute
 * contact-collision channel the way a match does). Zero for REST/zero
 * participation (Part 39 #2).
 */
export function computeTrainingInjuryRisk(
  loadSetting: "FULL" | "REDUCED" | "RECOVERY_ONLY" | "REST",
  sessionType: TrainingSessionType,
  intensity: TrainingIntensity,
  inputs: InjuryRiskInputs,
): number {
  const exposure = PARTICIPATION_EXPOSURE_FACTOR[loadSetting];
  if (exposure <= 0) return 0;

  const modifier =
    ageRiskModifier(inputs.age) *
    fatigueRiskModifier(inputs.currentEnergy) *
    recentLoadRiskModifier(inputs.recentLoad) *
    physicalResilienceModifier(inputs.physicalResilience) *
    worstRecurrenceModifier(inputs.injuryHistory, inputs.asOfDate);

  const risk = TRAINING_BASE_OVERUSE_RISK * exposure * INTENSITY_RISK_FACTOR[intensity] * SESSION_TYPE_RISK_FACTOR[sessionType] * modifier;
  return clamp(risk, 0, MAX_TRAINING_RISK_PER_SESSION);
}

export interface MatchInjuryRiskResult {
  contactRisk: number;
  overuseRisk: number;
}

/**
 * Part 13: match injury risk -- both CONTACT (Part 7's dominant match
 * channel) and OVERUSE, each scaled by the player's OWN actual resolved
 * exposure fraction for that phase (never a flat "played the match"
 * assumption). Zero for zero exposure (Part 39 #1) -- a player not
 * drawn onto the court this match structurally cannot get hurt in it.
 */
export function computeMatchInjuryRisk(exposureFraction: number, inputs: InjuryRiskInputs): MatchInjuryRiskResult {
  if (exposureFraction <= 0) return { contactRisk: 0, overuseRisk: 0 };
  const bounded = clamp(exposureFraction, 0, 1);
  // The eventual injury's body area isn't known yet (that's resolved only
  // once a risk roll succeeds), so recurrence uses the same worst-case
  // approximation across any body area currently within its window.
  const nonRecurrenceModifier = ageRiskModifier(inputs.age) * fatigueRiskModifier(inputs.currentEnergy) * recentLoadRiskModifier(inputs.recentLoad) * physicalResilienceModifier(inputs.physicalResilience);
  const recurrence = worstRecurrenceModifier(inputs.injuryHistory, inputs.asOfDate);
  const combined = nonRecurrenceModifier * recurrence;

  return {
    contactRisk: clamp(MATCH_BASE_CONTACT_RISK * bounded * combined, 0, MAX_MATCH_RISK_PER_PHASE),
    overuseRisk: clamp(MATCH_BASE_OVERUSE_RISK * bounded * combined, 0, MAX_MATCH_RISK_PER_PHASE),
  };
}

/** Part 6/7: deterministically resolves WHICH injury occurred once a risk roll has already succeeded (a separate roll from the yes/no occurrence roll). */
export function pickInjuryType(mechanism: InjuryMechanism, severity: InjurySeverity, seedKey: string): InjuryType {
  const pool = mechanism === "CONTACT" ? (severity === "SEVERE" ? [...CONTACT_INJURY_TYPES, "ACL_TEAR" as InjuryType] : CONTACT_INJURY_TYPES) : OVERUSE_INJURY_TYPES;
  const index = Math.abs(seededOffset(`${seedKey}:type`, 1_000_000)) % pool.length;
  return pool[index];
}

/** Part 22: MINOR most common, SEVERE rare -- a fixed weighted distribution, not risk-magnitude-scaled (kept simple per Part 9's "do not build an injury apocalypse"). */
const SEVERITY_WEIGHTS: Record<InjurySeverity, number> = { MINOR: 0.55, MODERATE: 0.3, MAJOR: 0.12, SEVERE: 0.03 };

export function pickSeverity(seedKey: string): InjurySeverity {
  const roll = seededRoll(`${seedKey}:severity`);
  let cumulative = 0;
  for (const severity of INJURY_SEVERITIES) {
    cumulative += SEVERITY_WEIGHTS[severity];
    if (roll < cumulative) return severity;
  }
  return "MINOR";
}

/** Part 22/23: an exact duration deterministically picked within the severity's own range, then smoothly age-adjusted (older players recover a little slower -- Part 11, bounded, no cliff). */
export function pickExpectedDurationDays(severity: InjurySeverity, age: number | null, seedKey: string): number {
  const range = SEVERITY_DURATION_RANGE_DAYS[severity];
  const span = range.max - range.min;
  const offset = Math.abs(seededOffset(`${seedKey}:duration`, 1_000_000)) % (span + 1);
  const base = range.min + offset;
  const ageFactor = age === null ? 1.0 : clamp(1.0 + Math.max(0, age - 27) * 0.01, 1.0, 1.2);
  return Math.round(base * ageFactor);
}
