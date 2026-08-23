// HM-MATCH-1.2 Parts H-M: SPECIALSPEL -- a small, persistent tactical
// intent domain for numerical-mismatch situations (6v5, 5v6, and the
// defensive responses to an opponent's 7v6/6v5/5v6). Lives inside
// persistent Tactics (Part H: "Create a clear SPECIALSPEL section
// inside persistent Tactics"), club-keyed, same persistence rule as
// TacticsTemplate -- edited only via the pre-match Tactics workspace.
//
// ENGINE BOUNDARY (Part M, audited): Fast Match
// (packages/game-simulation/src/matchEngine.ts) has NO suspension-state
// pathway at all -- no concept of "currently 6v5" or "opponent has a
// player in the box", so none of these plans can honestly influence a
// simulated result today. They are PERSISTED FOR FUTURE SIMULATION
// ONLY -- deliberately inert, never a fabricated tactical bonus (Part
// M: "No fake tactical bonuses"). The one 7v6-related lever that DOES
// affect simulation already exists and is untouched by this module --
// see tacticalMatchAdjustment.ts's SevenVSixPolicy/sevenVSixActive
// wiring, which this domain never duplicates.
export const SIX_V_FIVE_TEMPO_OPTIONS = ["CONTROLLED", "NORMAL", "FAST"] as const;
export type SixVFiveTempo = (typeof SIX_V_FIVE_TEMPO_OPTIONS)[number];

export const SIX_V_FIVE_RISK_OPTIONS = ["SAFETY_FIRST", "BALANCED", "AGGRESSIVE"] as const;
export type SixVFiveRisk = (typeof SIX_V_FIVE_RISK_OPTIONS)[number];

export const SIX_V_FIVE_PRIORITY_OPTIONS = ["WIDTH", "PIVOT", "CIRCULATION", "NORMAL"] as const;
export type SixVFivePriority = (typeof SIX_V_FIVE_PRIORITY_OPTIONS)[number];

/** Part J: the coach's intent while attacking with a numerical advantage (opponent has a player in the box). */
export interface SixVFivePlan {
  tempo: SixVFiveTempo;
  risk: SixVFiveRisk;
  priority: SixVFivePriority;
}

export const FIVE_V_SIX_GOALKEEPER_CHOICE_OPTIONS = ["KEEP_GK", "SIX_OUTCOURT"] as const;
export type FiveVSixGoalkeeperChoice = (typeof FIVE_V_SIX_GOALKEEPER_CHOICE_OPTIONS)[number];

export const FIVE_V_SIX_INTENT_OPTIONS = ["SLOW_TEMPO", "PROTECT_BALL", "BALANCED", "CONTINUE_ATTACKING"] as const;
export type FiveVSixIntent = (typeof FIVE_V_SIX_INTENT_OPTIONS)[number];

/** Part K: the coach's intent while attacking a player short (one's own player in the box). */
export interface FiveVSixPlan {
  goalkeeperChoice: FiveVSixGoalkeeperChoice;
  intent: FiveVSixIntent;
}

export const DEFENSIVE_SPECIAL_PRESS_OPTIONS = ["LOW", "NORMAL", "HIGH"] as const;
export type DefensiveSpecialPress = (typeof DEFENSIVE_SPECIAL_PRESS_OPTIONS)[number];

export const DEFENSIVE_SPECIAL_CENTRAL_FOCUS_OPTIONS = ["NORMAL", "PROTECT_CENTER"] as const;
export type DefensiveSpecialCentralFocus = (typeof DEFENSIVE_SPECIAL_CENTRAL_FOCUS_OPTIONS)[number];

export const DEFENSIVE_SPECIAL_RISK_OPTIONS = ["CAUTIOUS", "BALANCED", "AGGRESSIVE"] as const;
export type DefensiveSpecialRisk = (typeof DEFENSIVE_SPECIAL_RISK_OPTIONS)[number];

export const DEFENSIVE_SPECIAL_EMPTY_GOAL_OPTIONS = ["SAFETY_FIRST", "SEEK_OPPORTUNITY"] as const;
export type DefensiveSpecialEmptyGoal = (typeof DEFENSIVE_SPECIAL_EMPTY_GOAL_OPTIONS)[number];

/** Part L: a small, coherent set of dimensions reused for all three defensive special situations -- never 20 controls per situation. */
export interface DefensiveSpecialSituationPlan {
  press: DefensiveSpecialPress;
  centralFocus: DefensiveSpecialCentralFocus;
  risk: DefensiveSpecialRisk;
  emptyGoalApproach: DefensiveSpecialEmptyGoal;
}

export interface SpecialPlayPlan {
  sixVFive: SixVFivePlan;
  fiveVSix: FiveVSixPlan;
  against7v6: DefensiveSpecialSituationPlan;
  against6v5: DefensiveSpecialSituationPlan;
  against5v6: DefensiveSpecialSituationPlan;
}

function defaultDefensiveSpecialSituationPlan(): DefensiveSpecialSituationPlan {
  return { press: "NORMAL", centralFocus: "NORMAL", risk: "BALANCED", emptyGoalApproach: "SAFETY_FIRST" };
}

/** Deterministic neutral default -- a brand-new club (or one that has never touched Specialspel) gets this until the manager configures something else. */
export function defaultSpecialPlayPlan(): SpecialPlayPlan {
  return {
    sixVFive: { tempo: "NORMAL", risk: "BALANCED", priority: "NORMAL" },
    fiveVSix: { goalkeeperChoice: "KEEP_GK", intent: "BALANCED" },
    against7v6: defaultDefensiveSpecialSituationPlan(),
    against6v5: defaultDefensiveSpecialSituationPlan(),
    against5v6: defaultDefensiveSpecialSituationPlan(),
  };
}
