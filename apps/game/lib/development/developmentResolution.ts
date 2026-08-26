// HM-TRAINING-1.1 Part 9/10/11/12/13/14/22/23/24/38: the weekly
// resolution -- accumulated stimulus + age + potential headroom + fatigue
// -> possible ACTUAL attribute change + CA recompute. Pure functions
// only; developmentIntegration.ts is the only caller and owns all
// CareerState reads/writes.
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, CA_MAX, CA_MIN, GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES } from "../rating/types";
import { DEVELOPMENT_HISTORY_LIMIT, type DevelopableAttribute, type PlayerDevelopmentEvent } from "./types";

// ---------------------------------------------------------------------------
// Part 9: age effect -- smooth bands via linear interpolation between
// anchor points, never a hard cliff. Part 38: a future coaching-quality
// multiplier is a SEPARATE, still-neutral (1.0) factor multiplied in at
// the same point as this one -- see FUTURE_COACHING_QUALITY_MULTIPLIER.
// ---------------------------------------------------------------------------

const AGE_MULTIPLIER_ANCHORS: readonly [age: number, multiplier: number][] = [
  [16, 1.5],
  [21, 1.3],
  [24, 1.0],
  [28, 0.65],
  [31, 0.35],
  [35, 0.15],
  [40, 0.05],
];

/** Part 9: smooth, centralized age-development multiplier -- clamped to the nearest anchor outside the table's own range, linearly interpolated between the two bracketing anchors otherwise. A single shared curve for every attribute family in HM-TRAINING-1.1 (documented as the deliberately simple v1 choice -- Part 9's own "may eventually age differently" is future work). */
export function ageDevelopmentMultiplier(age: number): number {
  if (age <= AGE_MULTIPLIER_ANCHORS[0][0]) return AGE_MULTIPLIER_ANCHORS[0][1];
  for (let i = 0; i < AGE_MULTIPLIER_ANCHORS.length - 1; i++) {
    const [ageA, multA] = AGE_MULTIPLIER_ANCHORS[i];
    const [ageB, multB] = AGE_MULTIPLIER_ANCHORS[i + 1];
    if (age >= ageA && age <= ageB) {
      const t = (age - ageA) / (ageB - ageA);
      return multA + (multB - multA) * t;
    }
  }
  return AGE_MULTIPLIER_ANCHORS[AGE_MULTIPLIER_ANCHORS.length - 1][1];
}

// ---------------------------------------------------------------------------
// Part 10/11: potential headroom -- development slows smoothly as CA
// approaches PA, never an absolute wall (Part 11: "avoid an absolute
// mathematical wall").
// ---------------------------------------------------------------------------

const HEADROOM_FULL_EFFECT_POINTS = 30; // CA/PA points (1-200 scale) of gap that already earns the full multiplier
const MIN_HEADROOM_MULTIPLIER = 0.05; // "extremely limited", never exactly zero

export function headroomDevelopmentMultiplier(ca: number, pa: number): number {
  const headroom = pa - ca;
  if (headroom <= 0) return MIN_HEADROOM_MULTIPLIER;
  return Math.min(1, headroom / HEADROOM_FULL_EFFECT_POINTS) * (1 - MIN_HEADROOM_MULTIPLIER) + MIN_HEADROOM_MULTIPLIER;
}

// ---------------------------------------------------------------------------
// Part 22: fatigue reduces conversion QUALITY, never eliminates it.
// ---------------------------------------------------------------------------

const FATIGUE_MULTIPLIER_FLOOR = 0.4; // at 0 energy

export function fatigueDevelopmentMultiplier(currentEnergy: number): number {
  const clamped = Math.max(0, Math.min(100, currentEnergy));
  return FATIGUE_MULTIPLIER_FLOOR + (1 - FATIGUE_MULTIPLIER_FLOOR) * (clamped / 100);
}

// ---------------------------------------------------------------------------
// Part 38: staff/coaching quality hook -- always neutral (1.0) in
// HM-TRAINING-1.1, multiplied in at the exact same point every other
// efficiency factor is, so a future Staff milestone only needs to replace
// this one constant/lookup, never restructure resolution itself.
// ---------------------------------------------------------------------------

export const FUTURE_COACHING_QUALITY_MULTIPLIER = 1.0;

// ---------------------------------------------------------------------------
// Part 23: diminishing returns -- a hard weekly cap on EFFECTIVE stimulus
// per attribute, applied after every multiplier above. More training does
// not buy unlimited improvement.
// ---------------------------------------------------------------------------

const MAX_WEEKLY_EFFECTIVE_STIMULUS_PER_ATTRIBUTE = 2.5;

/** Part 13/14: units of persistent progress required for one visible +1. */
export const PROGRESS_THRESHOLD_PER_POINT = 9.0;

/** Part 24: never more than one visible point per attribute per weekly resolution, regardless of how much progress overshoots the threshold. */
const MAX_POINTS_PER_RESOLUTION = 1;

// ---------------------------------------------------------------------------
// Part 12: CA recompute -- NEVER an independent CA increment. A small,
// centralized, deterministic nudge proportional to the attribute's own
// share of the branch's total attribute count, so growing one of 56 (or
// 21) attributes by one point moves CA by exactly that attribute's own
// fair fractional share of the full 1-200 range -- never double-counted
// against the attribute change itself (no separate CA roll exists
// anywhere in this module).
// ---------------------------------------------------------------------------

function caNudgePerAttributePoint(branch: "OUTCOURT" | "GOALKEEPER"): number {
  const attributeCount = branch === "OUTCOURT" ? OUTCOURT_ATTRIBUTES.length : GOALKEEPER_ATTRIBUTES.length;
  return (CA_MAX - CA_MIN) / (ATTRIBUTE_MAX - ATTRIBUTE_MIN) / attributeCount;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface AttributeResolutionInputs {
  attribute: DevelopableAttribute;
  rawStimulus: number;
  age: number | null;
  currentEnergy: number;
}

export interface AttributeResolutionResult {
  /** Updated progress if no point was gained this attribute, or the remainder after one point was gained. */
  nextProgress: number;
  /** Present only when a visible +1 actually happened this resolution. */
  event?: { previousValue: number; newValue: number };
  caDelta: number;
}

/**
 * Part 9/10/11/12/13/22/23/24: resolves ONE attribute for one player for
 * one week. Pure -- caller (developmentIntegration.ts) supplies the
 * current attribute value/progress/ca/pa and writes the result back.
 */
export function resolveAttributeForWeek(
  branch: "OUTCOURT" | "GOALKEEPER",
  currentValue: number,
  ca: number,
  pa: number,
  priorProgress: number,
  inputs: AttributeResolutionInputs,
): AttributeResolutionResult {
  const ageMult = inputs.age === null ? 1 : ageDevelopmentMultiplier(inputs.age);
  const headroomMult = headroomDevelopmentMultiplier(ca, pa);
  const fatigueMult = fatigueDevelopmentMultiplier(inputs.currentEnergy);
  const effectiveStimulus = Math.min(inputs.rawStimulus * ageMult * headroomMult * fatigueMult * FUTURE_COACHING_QUALITY_MULTIPLIER, MAX_WEEKLY_EFFECTIVE_STIMULUS_PER_ATTRIBUTE);

  let progress = priorProgress + effectiveStimulus;
  let pointsGained = 0;
  while (progress >= PROGRESS_THRESHOLD_PER_POINT && pointsGained < MAX_POINTS_PER_RESOLUTION) {
    progress -= PROGRESS_THRESHOLD_PER_POINT;
    pointsGained += 1;
  }
  // Part 24: overshoot beyond the one-point cap this resolution is
  // discarded (not carried as extra progress), so a single freakishly
  // heavy week can never bank multiple future points either.
  if (pointsGained >= MAX_POINTS_PER_RESOLUTION) progress = Math.min(progress, PROGRESS_THRESHOLD_PER_POINT - 0.01);

  if (pointsGained === 0) {
    return { nextProgress: progress, caDelta: 0 };
  }

  const newValue = clamp(currentValue + pointsGained, ATTRIBUTE_MIN, ATTRIBUTE_MAX);
  if (newValue === currentValue) {
    // Already at the attribute cap -- progress is still consumed (a
    // maxed attribute stops absorbing further stimulus productively),
    // but no event/CA change happens (Part 24: no attribute can exceed
    // its valid max).
    return { nextProgress: progress, caDelta: 0 };
  }
  const caDelta = (newValue - currentValue) * caNudgePerAttributePoint(branch);
  return { nextProgress: progress, event: { previousValue: currentValue, newValue }, caDelta };
}

/** Appends one event, most-recent-first, capped at DEVELOPMENT_HISTORY_LIMIT. */
export function pushDevelopmentEvent(history: readonly PlayerDevelopmentEvent[], event: PlayerDevelopmentEvent): readonly PlayerDevelopmentEvent[] {
  return [event, ...history].slice(0, DEVELOPMENT_HISTORY_LIMIT);
}

/**
 * Part 12: applies every resolved attribute change for one player to
 * their own GameplayPlayerRating (mutating a shallow clone, never the
 * original) -- attribute values AND the CA nudge derived from them,
 * together, so CA and attributes can never diverge into a double-counted
 * state.
 */
export function applyResolvedAttributeChanges(rating: GameplayPlayerRating, changes: readonly { attribute: DevelopableAttribute; newValue: number; caDelta: number }[]): GameplayPlayerRating {
  if (changes.length === 0) return rating;
  const attributes = { ...rating.branch.attributes } as Record<string, { value: number; origin: string }>;
  let ca = rating.ca;
  for (const change of changes) {
    const existing = attributes[change.attribute];
    attributes[change.attribute] = { value: change.newValue, origin: existing?.origin ?? "GENERATED_PRIOR" };
    ca = clamp(ca + change.caDelta, CA_MIN, CA_MAX);
  }
  return { ...rating, ca, branch: { ...rating.branch, attributes } as GameplayPlayerRating["branch"] };
}
