// HM-TACTICS-1.1: pure MatchPlan persistence, mirroring
// tacticalProfileActions.ts's exact pattern (kept separate from
// CareerContext.tsx so it's unit-testable without a browser/React
// environment). Deliberately targeted at ONE fixture's entry in
// `career.matchPlans` -- never touches `career.tacticalProfile` (the
// club's own, separately-keyed permanent tactical identity).
//
// HM-MATCH-1.1 Part 1/2: this is also the ONE place a pre-match
// MatchPlan edit syncs `state.tactics`/`state.playerMatchDefaults`
// forward -- deliberate, because this function is called EXCLUSIVELY by
// the pre-match Tactics workspace (CareerContext.tsx's
// `updateMatchPlanAction`). A LIVE, in-match coaching change goes
// through a structurally separate action
// (`applyMidMatchPlanChangeAction` -> matchPlanMidMatchChange.ts, which
// writes only to `liveMatchPlans`) that never calls this function, so a
// fixture-specific override can never leak back into the persistent
// template -- satisfied by construction, not by a runtime check.
import type { MatchPlan } from "../matchPlan/types";
import type { CareerState } from "./types";

/**
 * Replaces (or adds) exactly one fixture's MatchPlan, and syncs the
 * plan's own attackPlan/defencePlan/transitionPlan and every squad
 * player's matchRole/playingTimeIntention/phaseUsage forward into the
 * manager's persistent `tactics`/`playerMatchDefaults` templates -- so
 * the NEXT fixture's default plan inherits what the manager just
 * configured, instead of resetting to neutral defaults every match.
 * Idempotent: re-syncing identical values is a harmless no-op. Every
 * other field of CareerState, including every other fixture's plan, is
 * passed through unchanged.
 */
export function setMatchPlan(state: CareerState, fixtureId: string, plan: MatchPlan): CareerState {
  const tactics = { ...state.tactics, [plan.clubId]: { attackPlan: plan.attackPlan, defencePlan: plan.defencePlan, transitionPlan: plan.transitionPlan } };
  const playerMatchDefaults = { ...state.playerMatchDefaults };
  for (const usage of plan.playerUsage) {
    playerMatchDefaults[usage.playerId] = { matchRole: usage.matchRole, playingTimeIntention: usage.playingTimeIntention, phaseUsage: usage.phaseUsage };
  }
  return { ...state, matchPlans: { ...state.matchPlans, [fixtureId]: plan }, tactics, playerMatchDefaults };
}
