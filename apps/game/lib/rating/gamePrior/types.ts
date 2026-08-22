// HM-RATINGS-0.6: the GAME PRIOR layer's own types. This is the
// fallback tier for players with no calibration (HM-RATINGS-0.2) and
// no evidence-based estimate (HM-RATINGS-0.5) -- a deterministic,
// clearly-labeled GAMEPLAY REPRESENTATION, never presented as
// researched fact (Core Principle: "For weak-data players explicitly
// mark the result as GENERATED_GAME_PRIOR").
export const GAME_PRIOR_MODEL_VERSION = "HM-RATINGS-0.6-v1";

/** A small, reusable archetype label -- for outcourt players this is literally an existing AttackRole/DefenceRole (Part F: "prefer existing project role vocabulary"); for goalkeepers it's one of the 4 new GK archetypes this milestone adds. */
export type GoalkeeperArchetype = "SHOT_STOPPER" | "POSITIONING_READER" | "DISTRIBUTOR" | "BALANCED_GOALKEEPER";

export const GOALKEEPER_ARCHETYPES: readonly GoalkeeperArchetype[] = ["SHOT_STOPPER", "POSITIONING_READER", "DISTRIBUTOR", "BALANCED_GOALKEEPER"];

export interface GamePriorCAResult {
  value: number;
  clubContextShift: number;
  archetype: string;
}
