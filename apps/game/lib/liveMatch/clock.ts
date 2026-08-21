// Live match clock (HM-MATCH-0.1).
//
// A pure, headless state machine over an already-generated FastMatchResult
// (see liveMatchEngine's governing rule: this NEVER decides the result --
// it only reveals the Fast Match Engine's pre-generated timeline over
// simulated time). Two 30-minute halves, an explicit HALF_TIME state the
// manager must advance out of, FULL_TIME at 60.

export type MatchPhase = "PRE_MATCH" | "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "TIMEOUT" | "FULL_TIME";
export type PlaybackSpeed = "PAUSED" | "X1" | "X2" | "X4" | "X8";

export interface LiveMatchClock {
  phase: MatchPhase;
  /** 0-60, the latest simulated minute revealed so far. */
  clockMinute: number;
  speed: PlaybackSpeed;
  /** HM-COACHING-0.1: which in-play phase to resume into once the current TIMEOUT ends. Only ever set while phase is TIMEOUT. */
  timeoutReturnPhase?: "FIRST_HALF" | "SECOND_HALF";
  /** HM-COACHING-0.1: timeouts already called this half -- see MAX_TIMEOUTS_PER_HALF's doc for why this is a deliberately simplified, provisional count, not full IHF regulation. */
  timeoutsUsed: { firstHalf: number; secondHalf: number };
}

export function initLiveMatchClock(): LiveMatchClock {
  return { phase: "PRE_MATCH", clockMinute: 0, speed: "PAUSED", timeoutsUsed: { firstHalf: 0, secondHalf: 0 } };
}

export function kickoff(clock: LiveMatchClock): LiveMatchClock {
  if (clock.phase !== "PRE_MATCH") {
    return clock;
  }
  return { ...clock, phase: "FIRST_HALF", speed: "X1" };
}

/** No-op outside FIRST_HALF/SECOND_HALF -- there is nothing to play back in PRE_MATCH/HALF_TIME/FULL_TIME. */
export function setSpeed(clock: LiveMatchClock, speed: PlaybackSpeed): LiveMatchClock {
  if (clock.phase !== "FIRST_HALF" && clock.phase !== "SECOND_HALF") {
    return clock;
  }
  return { ...clock, speed };
}

/** Advances the clock by exactly one simulated minute, stopping precisely at the half/full-time boundary. */
export function tick(clock: LiveMatchClock): LiveMatchClock {
  if (clock.phase !== "FIRST_HALF" && clock.phase !== "SECOND_HALF") {
    return clock;
  }
  const nextMinute = clock.clockMinute + 1;
  if (clock.phase === "FIRST_HALF" && nextMinute >= 30) {
    return { ...clock, clockMinute: 30, phase: "HALF_TIME", speed: "PAUSED" };
  }
  if (clock.phase === "SECOND_HALF" && nextMinute >= 60) {
    return { ...clock, clockMinute: 60, phase: "FULL_TIME", speed: "PAUSED" };
  }
  return { ...clock, clockMinute: nextMinute };
}

/** Explicit manager interaction required to leave HALF_TIME (Spec S14) -- never automatic. */
export function startSecondHalf(clock: LiveMatchClock): LiveMatchClock {
  if (clock.phase !== "HALF_TIME") {
    return clock;
  }
  return { ...clock, phase: "SECOND_HALF", speed: "X1" };
}

/** INSTANT RESULT: jumps straight to full time. Reveals the SAME pre-generated timeline, never a different one. */
export function revealInstantly(): LiveMatchClock {
  return { phase: "FULL_TIME", clockMinute: 60, speed: "PAUSED", timeoutsUsed: { firstHalf: 0, secondHalf: 0 } };
}

// ---------------------------------------------------------------------------
// HM-COACHING-0.1: timeout as an in-match coaching intervention.
//
// A timeout freezes simulated match time for free: `tick()` above is
// already a no-op outside FIRST_HALF/SECOND_HALF, so entering the
// TIMEOUT phase is sufficient on its own -- clockMinute simply stops
// advancing until endTimeout() returns play to the half it was called
// from, unchanged. The real 60-second on-screen countdown is a
// presentation-only concern owned by useLiveMatch.ts/pacing.ts, not by
// this pure state machine.
// ---------------------------------------------------------------------------

/**
 * PROVISIONAL, deliberately simplified timeout-availability rule: one
 * team timeout per half. The Tactical Model Bible does not define
 * timeout counts/eligibility, and real IHF rules are considerably more
 * elaborate (up to 3 per match, at most 2 per half, only while in team
 * possession, signalled with a green card) -- none of that is modeled
 * here. This is a single, isolated, documented placeholder rule, not a
 * claim of full regulation.
 */
export const MAX_TIMEOUTS_PER_HALF = 1;

/** Whether the manager could call a timeout right now. */
export function canCallTimeout(clock: LiveMatchClock): boolean {
  if (clock.phase !== "FIRST_HALF" && clock.phase !== "SECOND_HALF") {
    return false;
  }
  const used = clock.phase === "FIRST_HALF" ? clock.timeoutsUsed.firstHalf : clock.timeoutsUsed.secondHalf;
  return used < MAX_TIMEOUTS_PER_HALF;
}

/** No-op if `canCallTimeout` would be false. Freezes clockMinute (via TIMEOUT never being ticked) and pauses playback speed. */
export function callTimeout(clock: LiveMatchClock): LiveMatchClock {
  if (!canCallTimeout(clock)) {
    return clock;
  }
  const half = clock.phase as "FIRST_HALF" | "SECOND_HALF";
  return {
    ...clock,
    phase: "TIMEOUT",
    timeoutReturnPhase: half,
    speed: "PAUSED",
    timeoutsUsed: {
      firstHalf: half === "FIRST_HALF" ? clock.timeoutsUsed.firstHalf + 1 : clock.timeoutsUsed.firstHalf,
      secondHalf: half === "SECOND_HALF" ? clock.timeoutsUsed.secondHalf + 1 : clock.timeoutsUsed.secondHalf,
    },
  };
}

/** Resumes play at the half the timeout was called from (X1, clockMinute unchanged). No-op outside TIMEOUT. */
export function endTimeout(clock: LiveMatchClock): LiveMatchClock {
  if (clock.phase !== "TIMEOUT" || !clock.timeoutReturnPhase) {
    return clock;
  }
  const { timeoutReturnPhase, ...rest } = clock;
  return { ...rest, phase: timeoutReturnPhase, speed: "X1" };
}
