// HM-MATCH-1.1 Part 1/2: TACTICS vs MATCHPLAN separation.
//
// Audit finding: MatchPlan's own attackPlan/defencePlan/transitionPlan
// config was previously synthesized FRESH with hardcoded neutral
// defaults for every single fixture (defaultMatchPlan.ts), with zero
// memory of a manager's prior tactical choices -- and a player's
// matchRole/playingTimeIntention/phaseUsage reset to a generic
// STARTER/ROTATION heuristic every fixture too, with no way to say
// "Gustav is normally a KEY_PLAYER" once and have it stick.
//
// This module defines the two small, headless, pure data shapes that
// close that gap -- reusing this domain's OWN existing vocabulary
// (AttackPlanConfig/DefencePlanConfig/TransitionPlanConfig,
// MatchRole/PlayingTimeIntention/PhaseUsage) verbatim, never a second,
// duplicated type system. CareerState (lib/career/types.ts) is where
// these actually get PERSISTED (`tactics`/`playerMatchDefaults`,
// career-state schema v11) -- this module only defines their shape, the
// same headless boundary every other type in lib/matchPlan/types.ts
// already keeps.
import type { AttackPlanConfig, DefencePlanConfig, MatchRole, PlayerPhaseUsage, PlayingTimeIntention, TransitionPlanConfig } from "./types";

/**
 * TACTICS: "how does this club generally play" -- persists across
 * fixtures until the manager changes it via the pre-match Tactics
 * workspace. A fixture's own MatchPlan.attackPlan/defencePlan/
 * transitionPlan may still freely diverge from this for one match (a
 * fixture-specific override); only an explicit pre-match Tactics edit
 * (never a live in-match coaching change) syncs a new value back here
 * -- see lib/career/matchPlanActions.ts's own doc for the one write path.
 */
export interface TacticsTemplate {
  attackPlan: AttackPlanConfig;
  defencePlan: DefencePlanConfig;
  transitionPlan: TransitionPlanConfig;
}

/**
 * A player's normal squad standing / intended usage -- "Gustav is a
 * KEY_PLAYER, VERY_HIGH playing time, BOTH_PHASES" -- independent of any
 * one fixture's MatchPlan override. Same persistence rule as
 * TacticsTemplate: only a pre-match edit syncs a new value here; a
 * live/in-match change or a one-off fixture override never does.
 */
export interface PlayerMatchDefault {
  matchRole: MatchRole;
  playingTimeIntention: PlayingTimeIntention;
  phaseUsage: PlayerPhaseUsage;
}
