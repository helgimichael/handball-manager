"use client";

// React wrapper (HM-MATCH-0.1) around the pure clock/view modules. All
// actual match-state logic lives in clock.ts/liveMatchView.ts and is
// unit-tested there; this hook only owns the setInterval ticking and
// exposes the current view + controls.
import { useEffect, useRef, useState } from "react";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import {
  initLiveMatchClock,
  kickoff,
  revealInstantly,
  setSpeed as setClockSpeed,
  startSecondHalf as startClockSecondHalf,
  tick,
  type LiveMatchClock,
  type PlaybackSpeed,
} from "./clock";
import { computeLiveMatchView, type LiveMatchView } from "./liveMatchView";
import { PLAYBACK_TICK_INTERVAL_MS } from "./pacing";

export interface UseLiveMatchResult {
  view: LiveMatchView;
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;
  startSecondHalf: () => void;
  instantResult: () => void;
}

export function useLiveMatch(result: FastMatchResult): UseLiveMatchResult {
  const [clock, setClock] = useState<LiveMatchClock>(() => kickoff(initLiveMatchClock()));
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (clock.speed === "PAUSED") {
      return;
    }
    const intervalMs = PLAYBACK_TICK_INTERVAL_MS[clock.speed];
    timerRef.current = setInterval(() => {
      setClock((current) => tick(current));
    }, intervalMs);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clock.speed, clock.phase]);

  return {
    view: computeLiveMatchView(result, clock),
    speed: clock.speed,
    setSpeed: (speed) => setClock((current) => setClockSpeed(current, speed)),
    startSecondHalf: () => setClock((current) => startClockSecondHalf(current)),
    instantResult: () => setClock(() => revealInstantly()),
  };
}
