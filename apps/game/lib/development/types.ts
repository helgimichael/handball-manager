// HM-TRAINING-1.1: Player Development Foundation -- the persistent
// stimulus/progress state per player. Deliberately separate from
// lib/training/* (which owns SESSION EXECUTION / PHYSICAL LOAD /
// RECOVERY) -- this package owns the next layer: TRAINING STIMULUS ->
// INDIVIDUAL DEVELOPMENT -> ATTRIBUTE CHANGE OVER TIME. See
// developmentStimulus.ts (session/match -> stimulus), developmentResolution.ts
// (weekly resolution: age/headroom/fatigue -> actual attribute change +
// CA recompute), developmentIntegration.ts (the CareerState-level glue
// dailyTick.ts/matchdayAction.ts call).
import type { GoalkeeperAttribute, OutcourtAttribute } from "../rating/types";

/** Either branch's attribute vocabulary -- development never mixes them for one player (mirrors GeneratedOutcourtProfile/GeneratedGoalkeeperProfile's own branch separation). */
export type DevelopableAttribute = OutcourtAttribute | GoalkeeperAttribute;

/** Part 26: one VISIBLE attribute change -- an event is only ever created when `attributeProgress` actually crosses the threshold and the underlying 1-20 value moves (Part 33 #27/#28: no event for a week where only hidden progress accumulated). */
export interface PlayerDevelopmentEvent {
  date: string;
  attribute: DevelopableAttribute;
  previousValue: number;
  newValue: number;
  /** Free-form, e.g. "Training: TECHNICAL stimulus" / "Match exposure" -- provenance for the Player Profile/Training report, never parsed back. */
  sourceSummary: string;
}

/** Bounded history -- most-recent-first, never a full calculation log (Part 26). */
export const DEVELOPMENT_HISTORY_LIMIT = 20;

/**
 * Part 3: the smallest honest per-player development state.
 * `attributeStimulus` is the WEEKLY accumulator (training sessions +
 * match exposure both add into it during the week; weekly resolution
 * always drains it back to empty, whether or not it produced a visible
 * change) -- `attributeProgress` is the PERSISTENT fractional progress
 * toward each attribute's next +1 (never reset by resolution, only by
 * actually crossing the threshold). Keeping these two separate is what
 * makes "training well without an immediate visible attribute" (Part 16)
 * representable: a below-threshold week still moves `attributeProgress`
 * forward even though `attributeStimulus` itself is cleared.
 */
export interface PlayerDevelopmentState {
  playerId: string;
  attributeStimulus: Partial<Record<DevelopableAttribute, number>>;
  /**
   * HM-STAFF-1.0 Part 11/26: `attributeStimulus[attr] * thatSession'sStaffQuality`,
   * summed -- alongside `attributeStimulus` itself, this lets weekly
   * resolution recover a proper STIMULUS-WEIGHTED average coaching
   * quality per attribute (`attributeQualityWeightedSum[attr] /
   * attributeStimulus[attr]`) even when a week's stimulus for one
   * attribute came from several sessions led by different-quality
   * coaches. Reset alongside `attributeStimulus` every weekly
   * resolution, whether or not a visible change happened (same
   * lifecycle as the stimulus it's paired with).
   */
  attributeQualityWeightedSum: Partial<Record<DevelopableAttribute, number>>;
  attributeProgress: Partial<Record<DevelopableAttribute, number>>;
  /** ISO date of the last weekly resolution that actually ran for this player -- Part 33 #34's own idempotency guard (a date already recorded here is never re-resolved). Null until the first resolution ever runs. */
  lastDevelopmentDate: string | null;
  /** Most-recent-first, capped at DEVELOPMENT_HISTORY_LIMIT. */
  developmentHistory: readonly PlayerDevelopmentEvent[];
}

/**
 * Part 8: a manager-chosen individual development emphasis -- deliberately
 * family-level (matching lib/rating/types.ts's own OUTCOURT_ATTRIBUTE_FAMILIES/
 * GOALKEEPER_ATTRIBUTE_FAMILIES), not 40 individual-attribute choices, and
 * a DIFFERENT, smaller vocabulary from TrainingSessionType (a focus is an
 * EMPHASIS on a development target, not a session to schedule). NORMAL
 * means no emphasis -- the reserved `PlayerTrainingAssignment.individualFocus`
 * defaults there for every existing player (safe additive migration from
 * HM-TRAINING-1.0, which never set this field to anything but null).
 */
export const INDIVIDUAL_DEVELOPMENT_FOCUSES = ["NORMAL", "TECHNICAL", "ATTACKING_DECISIONS", "DEFENCE", "PHYSICAL", "MENTAL", "GOALKEEPER"] as const;
export type IndividualDevelopmentFocus = (typeof INDIVIDUAL_DEVELOPMENT_FOCUSES)[number];

/**
 * Part 27: the manager's UI must never show a raw PA number (Rating
 * Model's own "PA is a theoretical ceiling ... can never leak into match
 * performance/UI" boundary) -- same coarse, uncertainty-flavoured 1-5
 * star conversion precedent as lib/game-data/players.ts's own
 * `potentialStars()`, just sourced from the live GameplayPlayerRating.pa
 * (1-200) development actually writes to, instead of PlayerMock's own
 * static `potentialAbility`.
 */
export function potentialStarsFromPA(pa: number): number {
  return Math.max(1, Math.min(5, Math.ceil(pa / 40)));
}
