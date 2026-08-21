// Live match clock (HM-MATCH-0.1).
//
// A pure, headless state machine over an already-generated FastMatchResult
// (see liveMatchEngine's governing rule: this NEVER decides the result --
// it only reveals the Fast Match Engine's pre-generated timeline over
// simulated time). Two 30-minute halves, an explicit HALF_TIME state the
// manager must advance out of, FULL_TIME at 60.

export type MatchPhase = "PRE_MATCH" | "FIRST_HALF" | "HALF_TIME" | "SECOND_HALF" | "FULL_TIME";
export type PlaybackSpeed = "PAUSED" | "X1" | "X2" | "X4" | "X8";

export interface LiveMatchClock {
  phase: MatchPhase;
  /** 0-60, the latest simulated minute revealed so far. */
  clockMinute: number;
  speed: PlaybackSpeed;
}

export function initLiveMatchClock(): LiveMatchClock {
  return { phase: "PRE_MATCH", clockMinute: 0, speed: "PAUSED" };
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
  return { phase: "FULL_TIME", clockMinute: 60, speed: "PAUSED" };
}
