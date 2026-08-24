// HM-MATCH-1.3A: a persistent, CareerState-backed snapshot of an
// in-progress Live Match -- the fix for "navigating away and back
// resets the match to 0-0/00:00" (confirmed root cause: clock/coaching
// state was plain React component-local `useState` in useLiveMatch.ts/
// match-day/[fixtureId]/page.tsx, reinitialized fresh on every mount).
//
// CORE PRINCIPLE (Part "A live match is not a page"): a live match is a
// persistent career event. Navigation must not create, restart, advance
// or destroy it. This file is the smallest state needed to reconstruct
// an in-progress match exactly: the pure clock (phase/minute/speed/
// timeouts) plus the small pieces of mid-match coaching state that
// were previously ONLY local component state (currentProfile,
// sevenVSixActive, the opponent-adaptation trigger/landing state).
//
// Deliberately NOT duplicated here: `career.liveMatchPlans`/
// `matchPlanChangeHistory` (MatchPlan-side coaching state) and
// `career.results[fixtureId]` (the full simulated timeline) already
// persist independently and correctly survive navigation today -- see
// matchPlanMidMatchChange.ts/tacticalMidMatchChange.ts. This session
// object only carries what nothing else already persists.
//
// Also deliberately NOT persisted: any in-flight PENDING instruction/
// shout/7v6-switch/MatchPlan-change (useLiveMatch's own
// assessedInstruction/shoutState/assessedSevenVSix/pendingMatchPlanChange).
// These resolve within a handful of simulated minutes; if a manager
// navigates away mid-pending, the simplest and most honest behavior is
// that the in-flight change is dropped and must be reissued -- Part E's
// own acceptance scenario only requires an already-ADOPTED change to
// survive navigation, which it does (via currentProfile/sevenVSixActive
// below, or liveMatchPlans for MatchPlan changes).
import type { LiveMatchClock } from "./clock";
import { initLiveMatchClock, kickoff } from "./clock";
import type { TeamTacticalProfile } from "../career/teamTacticalProfile";
import type { OpponentAdaptationEffect, OpponentAdaptationTrigger } from "../career/opponentAdaptation";
import type { ImplementationOutcome } from "./implementationAssessment";

export interface AssessedOpponentAdaptationSnapshot {
  trigger: OpponentAdaptationTrigger;
  outcome: ImplementationOutcome;
  assessmentMinute: number;
  actualAdoptionMinute: number;
}

export interface LiveMatchSessionState {
  fixtureId: string;
  clock: LiveMatchClock;
  /** Mirrors match-day/[fixtureId]/page.tsx's own `currentProfile` -- the match-scoped tactical profile actually in effect right now (diverges from `career.tacticalProfile`, the season-persistent one, once any in-match instruction/shout adopts). */
  currentProfile: TeamTacticalProfile;
  sevenVSixActive: boolean;
  sevenVSixActiveSinceMinute: number | null;
  ati001HighSinceMinute: number | null;
  opponentAdaptationEffect: OpponentAdaptationEffect | null;
  assessedOpponentAdaptation: AssessedOpponentAdaptationSnapshot | null;
  /** Whether the opponent-adaptation LANDING effect has already fired for `assessedOpponentAdaptation` -- restored on remount so a delayed landing is never re-applied twice. Whether it was already ASSESSED (the other one-shot guard in page.tsx) is derivable from `clock.phase` alone: assessment always happens synchronously the moment HALF_TIME is first reached, so `clock.phase !== "PRE_MATCH" && clock.phase !== "FIRST_HALF"` on restore is exactly equivalent to the ref having already fired. */
  opponentAdaptationLanded: boolean;
}

/** Part C: the ONE place a session is created -- called only from the explicit STARTA MATCH action, never implicitly. Always starts at FIRST_HALF/clockMinute 0 (kickoff), seeded from the manager's current season-persistent tactical profile. */
export function createLiveMatchSession(fixtureId: string, tacticalProfile: TeamTacticalProfile): LiveMatchSessionState {
  return {
    fixtureId,
    clock: kickoff(initLiveMatchClock()),
    currentProfile: tacticalProfile,
    sevenVSixActive: false,
    sevenVSixActiveSinceMinute: null,
    ati001HighSinceMinute: null,
    opponentAdaptationEffect: null,
    assessedOpponentAdaptation: null,
    opponentAdaptationLanded: false,
  };
}

/** A session is "live" (actively in progress, blocking Continue -- Part G) whenever its clock has moved past PRE_MATCH but not yet reached FULL_TIME. In practice `createLiveMatchSession` always kicks off immediately, so PRE_MATCH is transient/never actually persisted, but this stays defensive. */
export function isLiveMatchSessionActive(session: LiveMatchSessionState | null | undefined): session is LiveMatchSessionState {
  if (!session) return false;
  return session.clock.phase !== "PRE_MATCH" && session.clock.phase !== "FULL_TIME";
}
