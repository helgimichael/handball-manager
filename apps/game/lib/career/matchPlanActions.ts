// HM-TACTICS-1.1: pure MatchPlan persistence, mirroring
// tacticalProfileActions.ts's exact pattern (kept separate from
// CareerContext.tsx so it's unit-testable without a browser/React
// environment). Deliberately targeted at ONE fixture's entry in
// `career.matchPlans` -- never touches `career.tacticalProfile` (the
// club's own, separately-keyed permanent tactical identity).
import type { MatchPlan } from "../matchPlan/types";
import type { CareerState } from "./types";

/** Replaces (or adds) exactly one fixture's MatchPlan. Every other field of CareerState, including every other fixture's plan, is passed through unchanged. */
export function setMatchPlan(state: CareerState, fixtureId: string, plan: MatchPlan): CareerState {
  return { ...state, matchPlans: { ...state.matchPlans, [fixtureId]: plan } };
}
