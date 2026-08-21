// PROVISIONAL presentation pacing (HM-MATCH-0.1).
//
// These are UI-watchability timings, not a claim of real match-minute
// duration. One "tick" always advances the simulated clock by exactly
// one match minute (see clock.ts); this table only controls how often a
// tick fires in real time, isolated here instead of scattered
// setTimeout/setInterval literals through the playback hook/component.
import type { PlaybackSpeed } from "./clock";

export const PLAYBACK_TICK_INTERVAL_MS: Record<Exclude<PlaybackSpeed, "PAUSED">, number> = {
  X1: 700,
  X2: 350,
  X4: 160,
  X8: 70,
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
