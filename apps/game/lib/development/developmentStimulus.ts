// HM-TRAINING-1.1 Part 5/6/7/8/18: pure stimulus math -- TRAINING SESSION
// (or match exposure) -> per-attribute DEVELOPMENT STIMULUS units. These
// are development units, never attribute points and never physical load
// (Part 6: session quality != physical load -- this module never reads
// energy/load at all). Nothing here writes to CareerState; see
// developmentIntegration.ts for the CareerState-level glue.
import type { PlayerTrainingLoadSetting, TrainingDuration, TrainingIntensity, TrainingSessionType } from "../training/types";
import { seededOffset } from "../rating/generation/deterministicVariation";
import {
  GOALKEEPER_SESSION_FAMILIES,
  INDIVIDUAL_FOCUS_GOALKEEPER_FAMILIES,
  INDIVIDUAL_FOCUS_OUTCOURT_FAMILIES,
  OUTCOURT_SESSION_FAMILIES,
  goalkeeperFamilyAttributes,
  outcourtFamilyAttributes,
} from "./attributeFamilies";
import type { DevelopableAttribute, IndividualDevelopmentFocus } from "./types";

/** Part 6: a session's own base development-stimulus unit, before intensity/duration/participation scaling -- intentionally a SEPARATE constant universe from trainingLoad.ts's physical-load numbers. */
const BASE_STIMULUS_UNITS = 3.0;

const INTENSITY_STIMULUS_MULTIPLIER: Record<TrainingIntensity, number> = { LOW: 0.7, NORMAL: 1.0, HIGH: 1.25, VERY_HIGH: 1.4 };
const DURATION_STIMULUS_MULTIPLIER: Record<TrainingDuration, number> = { SHORT: 0.75, NORMAL: 1.0, LONG: 1.2 };

/** Part 7: FULL > REDUCED > RECOVERY_ONLY ~= 0 > REST = 0. RECOVERY_ONLY is exactly zero (a session attended "for recovery only" is not normal training participation), same honest-zero choice as REST rather than a fuzzy near-zero value. */
const PARTICIPATION_STIMULUS_FACTOR: Record<PlayerTrainingLoadSetting, number> = { FULL: 1.0, REDUCED: 0.5, RECOVERY_ONLY: 0, REST: 0 };

/** Part 8: emphasis, not a cheat code -- the focused family gets a real but bounded boost, every OTHER family this same session would have developed gets a small reduction (redistribution, not a free bonus). */
const INDIVIDUAL_FOCUS_BOOST = 1.5;
const INDIVIDUAL_FOCUS_OTHER_FAMILY_REDUCTION = 0.85;

/** Part 15: a small (+-12%), fully deterministic jitter -- reused seeded-hash infra (never Math.random), so identical inputs always reproduce identical stimulus. */
const JITTER_MAGNITUDE_PERCENT = 12;

function jitterFactor(seedKey: string): number {
  return 1 + seededOffset(seedKey, JITTER_MAGNITUDE_PERCENT) / 100;
}

function distributeEvenly(families: readonly (readonly string[])[], totalUnits: number, out: Partial<Record<DevelopableAttribute, number>>, add: (attr: DevelopableAttribute, units: number) => void): void {
  const allAttrs = families.flat();
  if (allAttrs.length === 0 || totalUnits === 0) return;
  const perAttr = totalUnits / allAttrs.length;
  for (const attr of allAttrs) add(attr as DevelopableAttribute, perAttr);
}

/**
 * Part 5/6/7/8: the per-session stimulus a single participating player
 * receives, keyed by attribute, given the session's own type/intensity/
 * duration, this player's own participation load setting, whether they
 * are a goalkeeper, and their individual development focus (if any).
 * Returns an empty object for a session type that develops nothing for
 * this player's branch (MATCH_PREPARATION/RECOVERY for anyone, or any
 * outcourt-only session for a goalkeeper and vice versa -- Part 20/21),
 * or when participation is REST/RECOVERY_ONLY (Part 7).
 *
 * `seedKey` should be unique per (playerId, sessionId) so the jitter is
 * stable and reproducible but not identical across sessions/players.
 */
export function computeSessionAttributeStimulus(
  sessionType: TrainingSessionType,
  intensity: TrainingIntensity,
  duration: TrainingDuration,
  loadSetting: PlayerTrainingLoadSetting,
  isGoalkeeper: boolean,
  individualFocus: IndividualDevelopmentFocus | null | undefined,
  seedKey: string,
): Partial<Record<DevelopableAttribute, number>> {
  const participation = PARTICIPATION_STIMULUS_FACTOR[loadSetting];
  if (participation <= 0) return {};

  const families: readonly (readonly string[])[] = isGoalkeeper
    ? (GOALKEEPER_SESSION_FAMILIES[sessionType] ?? []).map(goalkeeperFamilyAttributes)
    : (OUTCOURT_SESSION_FAMILIES[sessionType] ?? []).map(outcourtFamilyAttributes);
  if (families.length === 0) return {};

  const totalUnits = BASE_STIMULUS_UNITS * INTENSITY_STIMULUS_MULTIPLIER[intensity] * DURATION_STIMULUS_MULTIPLIER[duration] * participation * jitterFactor(seedKey);

  const focusFamilies = new Set(
    individualFocus && individualFocus !== "NORMAL"
      ? (isGoalkeeper ? INDIVIDUAL_FOCUS_GOALKEEPER_FAMILIES[individualFocus] : INDIVIDUAL_FOCUS_OUTCOURT_FAMILIES[individualFocus]) ?? []
      : [],
  );

  const sessionFamilyKeys = isGoalkeeper ? (GOALKEEPER_SESSION_FAMILIES[sessionType] ?? []) : (OUTCOURT_SESSION_FAMILIES[sessionType] ?? []);
  const focusIntersects = sessionFamilyKeys.some((f) => focusFamilies.has(f as never));

  const result: Partial<Record<DevelopableAttribute, number>> = {};
  const add = (attr: DevelopableAttribute, units: number) => {
    result[attr] = (result[attr] ?? 0) + units;
  };

  if (!focusIntersects) {
    distributeEvenly(families, totalUnits, result, add);
    return result;
  }

  // Part 8: split the session's families into "focused" vs "other", boost
  // the focused share and slightly reduce the rest -- never a free bonus,
  // an emphasis within the same fixed stimulus budget.
  let focusedIdx = -1;
  sessionFamilyKeys.forEach((f, i) => {
    if (focusFamilies.has(f as never)) focusedIdx = i;
  });
  const perFamilyBase = totalUnits / families.length;
  families.forEach((attrs, i) => {
    const isFocused = i === focusedIdx;
    const units = perFamilyBase * (isFocused ? INDIVIDUAL_FOCUS_BOOST : INDIVIDUAL_FOCUS_OTHER_FAMILY_REDUCTION);
    if (attrs.length === 0) return;
    const perAttr = units / attrs.length;
    for (const attr of attrs) add(attr as DevelopableAttribute, perAttr);
  });
  return result;
}

// ---------------------------------------------------------------------------
// Part 18/19/20: match playing-time stimulus -- bounded, exposure-scaled,
// never a training replacement. Deliberately a SMALL fixed budget
// (MATCH_STIMULUS_UNITS_AT_FULL_EXPOSURE) so a player cannot become
// technically elite merely by playing every match (Part 18's own
// constraint).
// ---------------------------------------------------------------------------

const MATCH_STIMULUS_UNITS_AT_FULL_EXPOSURE = 1.2;

/**
 * Part 18/20/21: match stimulus per attribute for one player, from their
 * own attack/defence/goalkeeper exposure fractions (0-1, from
 * matchUsageEngine.ts's TeamUsageTrace -- the SAME exposure numbers
 * already driving match-strength and physical load, never a second
 * exposure model). Attack exposure develops TECHNICAL+PERCEPTION_DECISION,
 * defence exposure develops DEFENSIVE, goalkeeper exposure develops all
 * GK families -- zero exposure in a phase contributes zero stimulus for
 * that phase (Part 21: "zero match exposure creates no match stimulus").
 */
export function computeMatchAttributeStimulus(attackExposure: number, defenceExposure: number, goalkeeperExposure: number, isGoalkeeper: boolean, seedKey: string): Partial<Record<DevelopableAttribute, number>> {
  const result: Partial<Record<DevelopableAttribute, number>> = {};
  const add = (attr: DevelopableAttribute, units: number) => {
    if (units <= 0) return;
    result[attr] = (result[attr] ?? 0) + units;
  };
  const jitter = jitterFactor(seedKey);

  if (isGoalkeeper) {
    if (goalkeeperExposure <= 0) return {};
    const totalUnits = MATCH_STIMULUS_UNITS_AT_FULL_EXPOSURE * goalkeeperExposure * jitter;
    const families = (["SHOT_STOPPING", "PERCEPTION_DECISION", "TRANSITION"] as const).map(goalkeeperFamilyAttributes);
    distributeEvenly(families, totalUnits, result, add);
    return result;
  }

  if (attackExposure > 0) {
    const totalUnits = MATCH_STIMULUS_UNITS_AT_FULL_EXPOSURE * attackExposure * jitter;
    const families = (["TECHNICAL", "PERCEPTION_DECISION"] as const).map(outcourtFamilyAttributes);
    distributeEvenly(families, totalUnits, result, add);
  }
  if (defenceExposure > 0) {
    const totalUnits = MATCH_STIMULUS_UNITS_AT_FULL_EXPOSURE * defenceExposure * jitter;
    const families = (["DEFENSIVE"] as const).map(outcourtFamilyAttributes);
    distributeEvenly(families, totalUnits, result, add);
  }
  return result;
}

// ---------------------------------------------------------------------------
// HM-CLUB-PARTNERSHIPS-1.1: placement development exposure -- a player on
// an active B-team/development-partnership placement (lib/career/
// playerPlacements.ts) is genuinely training and playing at the PARTNER
// club, not the manager's own. Division 1 has no real match simulation
// (Part: "Skapa inte fejkade Division 1-matcher/mål/assist"), so this is
// deliberately NOT modelled as match exposure -- a flat, deterministic,
// bounded DAILY stimulus across a broad, well-rounded attribute spread
// (never sport-specific micromanagement, since no real session data
// exists for a club Division 1 never actually simulates), scaled only by
// two REAL, already-canonical facts: the relation type itself (the
// parent's own B-team is fully integrated into its own pathway; an
// external development-partner club is real but less integrated) and the
// player's own age (a young player benefits slightly more from regular
// first-team-adjacent minutes elsewhere -- mirrors the rest of the
// pipeline's existing age-sensitivity without duplicating
// headroomDevelopmentMultiplier's own CA/PA-based logic, which still
// applies afterward in developmentResolution.ts exactly as it does for
// every other stimulus source). Deliberately smaller than a single
// intensive parent-club session (BASE_STIMULUS_UNITS=3.0): an ordinary
// placement day is normal club activity, not a curated individual
// session -- "hellre en enkel modell än falsk precision".
// ---------------------------------------------------------------------------

const PLACEMENT_DAILY_STIMULUS_UNITS = 2.0;

/** Part: relation type is a real, already-canonical fact (ClubPartnership.type) -- never invented hidden club quality. The parent's own B-team (AFFILIATED_B_TEAM) is fully integrated into its own development pathway; an external DEVELOPMENT_PARTNERSHIP club is real development but less integrated. Also reused as the "coaching quality" multiplier for this stimulus (see playerPlacements.ts), the same existing concept every other stimulus source already carries. */
export const PLACEMENT_RELATION_QUALITY_MULTIPLIER: Record<"AFFILIATED_B_TEAM" | "DEVELOPMENT_PARTNERSHIP", number> = {
  AFFILIATED_B_TEAM: 1.0,
  DEVELOPMENT_PARTNERSHIP: 0.82,
};

const PLACEMENT_YOUNGER_AGE_BONUS_MAX_AGE = 17;
const PLACEMENT_YOUNGER_AGE_BONUS = 1.1;

/**
 * One placement-day's stimulus for one player, spread evenly across a
 * broad, honest attribute set (TECHNICAL+PERCEPTION_DECISION+DEFENSIVE
 * for outcourt, all three GK families for a goalkeeper) -- never a single
 * targeted family, since a placement has no individual-focus concept of
 * its own. `seedKey` should be unique per (playerId, placementId, date)
 * for stable, reproducible jitter (Part 15's existing deterministic-jitter
 * convention, same seededOffset infra, never Math.random).
 */
export function computePlacementAttributeStimulus(
  relationType: "AFFILIATED_B_TEAM" | "DEVELOPMENT_PARTNERSHIP",
  age: number | null,
  isGoalkeeper: boolean,
  seedKey: string,
): Partial<Record<DevelopableAttribute, number>> {
  const relationMultiplier = PLACEMENT_RELATION_QUALITY_MULTIPLIER[relationType];
  const ageMultiplier = age !== null && age <= PLACEMENT_YOUNGER_AGE_BONUS_MAX_AGE ? PLACEMENT_YOUNGER_AGE_BONUS : 1.0;
  const totalUnits = PLACEMENT_DAILY_STIMULUS_UNITS * relationMultiplier * ageMultiplier * jitterFactor(seedKey);

  const families = isGoalkeeper
    ? (["SHOT_STOPPING", "PERCEPTION_DECISION", "TRANSITION"] as const).map(goalkeeperFamilyAttributes)
    : (["TECHNICAL", "PERCEPTION_DECISION", "DEFENSIVE"] as const).map(outcourtFamilyAttributes);

  const result: Partial<Record<DevelopableAttribute, number>> = {};
  const add = (attr: DevelopableAttribute, units: number) => {
    result[attr] = (result[attr] ?? 0) + units;
  };
  distributeEvenly(families, totalUnits, result, add);
  return result;
}
