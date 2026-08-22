// PROVISIONAL presentation pacing (HM-MATCH-0.1, recalibrated HM-MATCH-0.2).
//
// These are UI-watchability timings, not a claim of real match-minute
// duration. One "tick" always advances the simulated clock by exactly
// one match minute (see clock.ts); this table only controls how often a
// tick fires in real time, isolated here instead of scattered
// setTimeout/setInterval literals through the playback hook/component.
// Recalibrating this table can never affect the simulated result: the
// entire FastMatchResult (score, events, stats) is already fully computed
// before Live Match ever mounts (see match-day/[fixtureId]/page.tsx's
// module doc) -- ticking only controls how much of it has been revealed
// yet, never what it is.
//
// HM-MATCH-0.2: X1 was 700ms/minute (a 60-minute match in 42 real
// seconds) -- too fast to read commentary or act as a coach. Recalibrated
// so X1 leaves real time to read a commentary line and consider a
// tactical response; X2/X4/X8 stay simple integer multiples of X1 so the
// speed labels remain honest (X2 is exactly twice as fast as X1, etc).
import type { PlaybackSpeed } from "./clock";

const BASE_TICK_INTERVAL_MS = 3000;

export const PLAYBACK_TICK_INTERVAL_MS: Record<Exclude<PlaybackSpeed, "PAUSED">, number> = {
  X1: BASE_TICK_INTERVAL_MS,
  X2: BASE_TICK_INTERVAL_MS / 2,
  X4: BASE_TICK_INTERVAL_MS / 4,
  X8: BASE_TICK_INTERVAL_MS / 8,
};

/**
 * HM-COACHING-0.1: a real handball timeout is 60 real-world seconds
 * (Spec: "represent a real 60-second timeout in the UI"). This is a
 * wall-clock countdown owned entirely by the presentation layer
 * (useLiveMatch.ts) -- it never advances or is read by the simulated
 * clock (clock.ts's TIMEOUT phase already freezes clockMinute on its
 * own), so it has no bearing on match determinism.
 */
export const TIMEOUT_DURATION_SECONDS = 60;
