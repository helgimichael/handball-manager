// HM-MATCH-1.3A: the ONLY writers of `state.activeMatchSession` -- mirrors
// matchPlanActions.ts/specialPlayActions.ts's own single-purpose-action
// pattern exactly.
import type { LiveMatchSessionState } from "../liveMatch/liveMatchSession";
import { createLiveMatchSession } from "../liveMatch/liveMatchSession";
import type { CareerState } from "./types";

/**
 * Part C: creates a fresh session for `fixtureId` -- but ONLY if none
 * already exists for it. If the manager already started this exact
 * fixture (e.g. they navigated back to Match Preview mid-match and
 * pressed STARTA MATCH again), this is a no-op that returns the
 * UNCHANGED existing session, never resetting it back to kickoff. This
 * is what makes "Match cannot start twice / re-pressing STARTA MATCH
 * resumes rather than restarts" true without the caller needing to
 * check first.
 */
export function startLiveMatchSession(state: CareerState, fixtureId: string, tacticalProfile: LiveMatchSessionState["currentProfile"]): CareerState {
  if (state.activeMatchSession?.fixtureId === fixtureId) {
    return state;
  }
  return { ...state, activeMatchSession: createLiveMatchSession(fixtureId, tacticalProfile) };
}

/**
 * Part D/E: the write side of "navigation must not reset the match" --
 * called on every meaningful in-match state change (clock tick, phase
 * transition, adopted instruction/7v6/opponent-adaptation). A no-op if
 * `fixtureId` no longer matches the currently active session (guards
 * against a stale write landing after the session was already cleared
 * or replaced by a different fixture).
 */
export function updateLiveMatchSession(state: CareerState, fixtureId: string, session: LiveMatchSessionState): CareerState {
  if (state.activeMatchSession?.fixtureId !== fixtureId) {
    return state;
  }
  if (state.activeMatchSession === session) {
    return state;
  }
  return { ...state, activeMatchSession: session };
}

/** Part I: called once the manager explicitly leaves a finished match (MATCHRAPPORT / FORTSÄTT), never automatically at FULL_TIME itself (Part M #15: reopening a completed match must not spontaneously recreate or destroy state mid-navigation). A no-op if `fixtureId` doesn't match the current session. */
export function clearLiveMatchSession(state: CareerState, fixtureId: string): CareerState {
  if (state.activeMatchSession?.fixtureId !== fixtureId) {
    return state;
  }
  return { ...state, activeMatchSession: null };
}
