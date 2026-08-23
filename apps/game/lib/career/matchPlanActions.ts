// HM-TACTICS-1.1: pure MatchPlan persistence, mirroring
// tacticalProfileActions.ts's exact pattern (kept separate from
// CareerContext.tsx so it's unit-testable without a browser/React
// environment). Deliberately targeted at ONE fixture's entry in
// `career.matchPlans` -- never touches `career.tacticalProfile` (the
// club's own, separately-keyed permanent tactical identity).
//
// HM-MATCH-1.1 Part 1/2: this is also the ONE place a pre-match
// MatchPlan edit syncs `state.tactics` forward -- deliberate, because
// this function is called EXCLUSIVELY by the pre-match Tactics
// workspace (CareerContext.tsx's `updateMatchPlanAction`). A LIVE,
// in-match coaching change goes through a structurally separate action
// (`applyMidMatchPlanChangeAction` -> matchPlanMidMatchChange.ts, which
// writes only to `liveMatchPlans`) that never calls this function, so a
// fixture-specific override can never leak back into the persistent
// template -- satisfied by construction, not by a runtime check.
//
// HM-MATCH-1.2 Part C correction: `state.playerMatchDefaults` is NOT
// auto-synced here any more. HM-MATCH-1.1's original design synced
// every squad player's matchRole/playingTimeIntention/phaseUsage on
// EVERY pre-match edit, which silently promoted any one-off,
// fixture-specific tweak into the manager's permanent standard --
// exactly what this milestone's own Part C explicitly forbids ("Do NOT
// make every fixture edit permanently change the player's default
// without an explicit manager action"). `setPlayerMatchDefault` below
// is now the ONE place that store is written, called only when the
// manager explicitly presses "Använd som standard" (see
// PlayerInstructionPanel.tsx).
import type { PlayerMatchDefault } from "../matchPlan/persistentDefaults";
import type { MatchPlan } from "../matchPlan/types";
import type { CareerState } from "./types";

/**
 * Replaces (or adds) exactly one fixture's MatchPlan, and syncs the
 * plan's own attackPlan/defencePlan/transitionPlan forward into the
 * manager's persistent `tactics` template -- so the NEXT fixture's
 * default plan inherits the general playing style the manager just
 * configured, instead of resetting to neutral defaults every match.
 * Idempotent: re-syncing identical values is a harmless no-op. Every
 * other field of CareerState, including every other fixture's plan and
 * `playerMatchDefaults`, is passed through unchanged.
 */
export function setMatchPlan(state: CareerState, fixtureId: string, plan: MatchPlan): CareerState {
  const tactics = { ...state.tactics, [plan.clubId]: { attackPlan: plan.attackPlan, defencePlan: plan.defencePlan, transitionPlan: plan.transitionPlan } };
  return { ...state, matchPlans: { ...state.matchPlans, [fixtureId]: plan }, tactics };
}

/**
 * HM-MATCH-1.2 Part C: the ONE explicit manager action that promotes a
 * player's CURRENT match-usage choice into their persistent standard --
 * "Använd som standard". Never called implicitly by any other edit path.
 */
export function setPlayerMatchDefault(state: CareerState, playerId: string, value: PlayerMatchDefault): CareerState {
  return { ...state, playerMatchDefaults: { ...state.playerMatchDefaults, [playerId]: value } };
}
