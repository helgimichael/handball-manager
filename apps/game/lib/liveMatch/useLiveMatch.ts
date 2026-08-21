"use client";

// React wrapper (HM-MATCH-0.1) around the pure clock/view modules. All
// actual match-state logic lives in clock.ts/liveMatchView.ts and is
// unit-tested there; this hook only owns the setInterval ticking and
// exposes the current view + controls.
import { useEffect, useRef, useState } from "react";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import type { TeamTacticalProfile } from "../career/teamTacticalProfile";
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
import {
  instructionAdoptionMinute,
  resolveInstructionStatus,
  type TacticalInstruction,
  type TacticalInstructionStatus,
} from "./tacticalInstruction";

export interface UseLiveMatchResult {
  view: LiveMatchView;
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;
  startSecondHalf: () => void;
  instantResult: () => void;
  /** HM-TACTICS-0.7: the one in-flight instruction, if any (null once ADOPTED and applied). */
  pendingInstruction: TacticalInstruction | null;
  instructionStatus: TacticalInstructionStatus | null;
  /** No-op if an instruction is already pending (one at a time) or the match isn't currently in play. */
  issueInstruction: (profile: TeamTacticalProfile) => void;
}

/**
 * `onInstructionAdopted` is called exactly once per issued instruction,
 * the moment the simulated clock reaches its (deterministic) adoption
 * minute -- never on issue, never twice. The caller (the Live Match
 * screen) is expected to splice the change into career state via
 * CareerContext's `applyMidMatchTacticalChange`, which then flows back
 * in as a new `result` prop; this hook's own clock state is unaffected
 * by that prop swap (the `useState` initializer only runs once), so the
 * reveal continues uninterrupted from the same simulated minute --
 * pause/speed play no part in when adoption happens (Spec: "pause/speed
 * does not change tactical outcome").
 */
export function useLiveMatch(result: FastMatchResult, onInstructionAdopted: (adoptionMinute: number, profile: TeamTacticalProfile) => void): UseLiveMatchResult {
  const [clock, setClock] = useState<LiveMatchClock>(() => kickoff(initLiveMatchClock()));
  const [instruction, setInstruction] = useState<TacticalInstruction | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appliedIssuedMinuteRef = useRef<number | null>(null);

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

  const view = computeLiveMatchView(result, clock);

  useEffect(() => {
    if (!instruction) {
      return;
    }
    if (appliedIssuedMinuteRef.current === instruction.issuedMinute) {
      return;
    }
    if (resolveInstructionStatus(instruction, view.clockMinute) !== "ADOPTED") {
      return;
    }
    appliedIssuedMinuteRef.current = instruction.issuedMinute;
    const adoptionMinute = instructionAdoptionMinute(instruction);
    const { profile } = instruction;
    // Deferred to a microtask so the state updates below happen outside
    // this effect's own synchronous body (avoids cascading same-commit
    // re-renders) -- the same pattern the tick timer above already uses
    // (setState only ever fires from within a callback the effect
    // registered, never directly in the effect body itself).
    queueMicrotask(() => {
      onInstructionAdopted(adoptionMinute, profile);
      setInstruction(null);
    });
  }, [instruction, view.clockMinute, onInstructionAdopted]);

  return {
    view,
    speed: clock.speed,
    setSpeed: (speed) => setClock((current) => setClockSpeed(current, speed)),
    startSecondHalf: () => setClock((current) => startClockSecondHalf(current)),
    instantResult: () => setClock(() => revealInstantly()),
    pendingInstruction: instruction,
    instructionStatus: instruction ? resolveInstructionStatus(instruction, view.clockMinute) : null,
    issueInstruction: (profile) => {
      if (instruction) return;
      if (clock.phase !== "FIRST_HALF" && clock.phase !== "SECOND_HALF") return;
      setInstruction({ issuedMinute: view.clockMinute, profile });
    },
  };
}
