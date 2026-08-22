"use client";

// React wrapper (HM-MATCH-0.1) around the pure clock/view modules. All
// actual match-state logic lives in clock.ts/liveMatchView.ts and is
// unit-tested there; this hook only owns the setInterval ticking and
// exposes the current view + controls.
import { useEffect, useRef, useState } from "react";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import type { TeamTacticalProfile } from "../career/teamTacticalProfile";
import {
  callTimeout as callTimeoutClock,
  canCallTimeout,
  endTimeout as endTimeoutClock,
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
import { PLAYBACK_TICK_INTERVAL_MS, TIMEOUT_DURATION_SECONDS } from "./pacing";
import {
  instructionAdoptionMinute,
  resolveInstructionStatus,
  type TacticalInstruction,
  type TacticalInstructionStatus,
} from "./tacticalInstruction";
import {
  applyShoutOverride,
  resolveShoutStatus,
  shoutDeliveryMinute,
  shoutExpiryMinute,
  type Shout,
  type ShoutStatus,
  type ShoutType,
} from "./sidelineShout";
import {
  resolveSevenVSixInstructionStatus,
  sevenVSixAdoptionMinute,
  type SevenVSixInstruction,
  type SevenVSixInstructionStatus,
  type SevenVSixTarget,
} from "./sevenVSixMode";

export interface UseLiveMatchResult {
  view: LiveMatchView;
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;
  startSecondHalf: () => void;
  instantResult: () => void;
  /** HM-TACTICS-0.7: the one in-flight instruction, if any (null once ADOPTED and applied). */
  pendingInstruction: TacticalInstruction | null;
  instructionStatus: TacticalInstructionStatus | null;
  /** No-op if an instruction is already pending (one at a time) or the match isn't currently in play (i.e. not FIRST_HALF/SECOND_HALF -- this never fires during a TIMEOUT). */
  issueInstruction: (profile: TeamTacticalProfile) => void;
  /** HM-COACHING-0.1: whether the manager could call a timeout right now (see clock.ts's canCallTimeout/MAX_TIMEOUTS_PER_HALF). */
  canCallTimeout: boolean;
  /** No-op if `canCallTimeout` is false. */
  callTimeout: () => void;
  /** Ends the current timeout early, resuming play immediately. No-op outside TIMEOUT. */
  endTimeout: () => void;
  /** Real-world seconds left in the current timeout countdown; null outside TIMEOUT. Presentation-only -- has no bearing on match determinism. */
  timeoutSecondsRemaining: number | null;
  /** No-op if an instruction is already pending or the match isn't currently in a TIMEOUT. Adopts faster than `issueInstruction` (see tacticalInstruction.ts). */
  issueTimeoutInstruction: (profile: TeamTacticalProfile) => void;
  /** HM-COACHING-0.2: the one in-flight shout, if any (null once EXPIRED and reverted). */
  pendingShout: Shout | null;
  shoutStatus: ShoutStatus | null;
  /** No-op if a shout is already pending/active (one at a time -- Spec: "must not stack") or the match isn't currently in play. */
  issueShout: (type: ShoutType, baselineProfile: TeamTacticalProfile) => void;
  /** HM-TACTICS-0.8: the one in-flight 7v6 ON/OFF switch, if any (null once ADOPTED and applied). */
  pendingSevenVSixInstruction: SevenVSixInstruction | null;
  sevenVSixInstructionStatus: SevenVSixInstructionStatus | null;
  /** No-op if a 7v6 switch is already pending or the match isn't currently in play. */
  issueSevenVSixInstruction: (target: SevenVSixTarget) => void;
  /** No-op if a 7v6 switch is already pending or the match isn't currently in a TIMEOUT. Adopts faster than `issueSevenVSixInstruction`. */
  issueSevenVSixTimeoutInstruction: (target: SevenVSixTarget) => void;
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
interface ShoutState {
  shout: Shout;
  /** The profile in effect when the shout was called -- captured once, at issue time, so expiry reverts to exactly this, regardless of anything else that happens meanwhile. */
  baselineProfile: TeamTacticalProfile;
  /** `applyShoutOverride(baselineProfile, shout.type)`, precomputed at issue time. */
  overrideProfile: TeamTacticalProfile;
}

export function useLiveMatch(
  result: FastMatchResult,
  onInstructionAdopted: (adoptionMinute: number, profile: TeamTacticalProfile) => void,
  onShoutDelivered: (deliveryMinute: number, overrideProfile: TeamTacticalProfile) => void,
  onShoutExpired: (expiryMinute: number, baselineProfile: TeamTacticalProfile) => void,
  onSevenVSixAdopted: (adoptionMinute: number, active: boolean) => void,
): UseLiveMatchResult {
  const [clock, setClock] = useState<LiveMatchClock>(() => kickoff(initLiveMatchClock()));
  const [instruction, setInstruction] = useState<TacticalInstruction | null>(null);
  const [timeoutSecondsRemaining, setTimeoutSecondsRemaining] = useState<number | null>(null);
  const [shoutState, setShoutState] = useState<ShoutState | null>(null);
  const [sevenVSixInstruction, setSevenVSixInstruction] = useState<SevenVSixInstruction | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appliedIssuedMinuteRef = useRef<number | null>(null);
  const shoutPhaseRef = useRef<"NONE" | "DELIVERED" | "EXPIRED">("NONE");
  const sevenVSixAppliedIssuedMinuteRef = useRef<number | null>(null);

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

  // HM-COACHING-0.1: the 60 real-world-second timeout countdown. Purely
  // presentational (see pacing.ts's TIMEOUT_DURATION_SECONDS doc) --
  // simulated match time is already frozen by clock.ts's TIMEOUT phase
  // regardless of how this countdown behaves.
  useEffect(() => {
    if (clock.phase !== "TIMEOUT") {
      // Deferred to a microtask -- same reasoning as the other effects in
      // this file: setState only ever fires from within a callback the
      // effect registered, never directly in the effect body itself.
      queueMicrotask(() => setTimeoutSecondsRemaining(null));
      return;
    }
    queueMicrotask(() => setTimeoutSecondsRemaining(TIMEOUT_DURATION_SECONDS));
    const interval = setInterval(() => {
      setTimeoutSecondsRemaining((current) => (current === null ? null : Math.max(0, current - 1)));
    }, 1000);
    return () => clearInterval(interval);
  }, [clock.phase]);

  useEffect(() => {
    if (clock.phase !== "TIMEOUT" || timeoutSecondsRemaining !== 0) {
      return;
    }
    // See the instruction-adoption effect below for why this is deferred
    // to a microtask rather than calling setClock directly here.
    queueMicrotask(() => {
      setClock((current) => endTimeoutClock(current));
    });
  }, [clock.phase, timeoutSecondsRemaining]);

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

  // HM-COACHING-0.2: shout delivery + automatic expiry. Both transitions
  // are handled in ONE effect (rather than two separate ones, as the
  // permanent-instruction effect above only needs) because a fast-
  // forward (instantResult) can jump the clock straight past ACTIVE
  // into EXPIRED in a single render -- in that case both the delivery
  // splice and the revert splice must still happen, in order, rather
  // than silently skipping the delivery. CareerContext's
  // applyMidMatchTacticalChange uses a functional state update
  // specifically so two such calls in the same microtask never race
  // against a stale snapshot.
  useEffect(() => {
    if (!shoutState) {
      return;
    }
    const status = resolveShoutStatus(shoutState.shout, view.clockMinute);
    if (status === "PENDING" || shoutPhaseRef.current === "EXPIRED") {
      return;
    }
    const wasUndelivered = shoutPhaseRef.current === "NONE";
    shoutPhaseRef.current = status === "EXPIRED" ? "EXPIRED" : "DELIVERED";
    const deliveryMinute = shoutDeliveryMinute(shoutState.shout);
    const expiryMinute = shoutExpiryMinute(shoutState.shout);
    const { overrideProfile, baselineProfile } = shoutState;
    queueMicrotask(() => {
      if (wasUndelivered) {
        onShoutDelivered(deliveryMinute, overrideProfile);
      }
      if (status === "EXPIRED") {
        onShoutExpired(expiryMinute, baselineProfile);
        setShoutState(null);
      }
    });
  }, [shoutState, view.clockMinute, onShoutDelivered, onShoutExpired]);

  // HM-TACTICS-0.8: 7v6 ON/OFF switch adoption. A persistent mode, not a
  // shout -- adopts exactly once (never expires on its own), mirroring
  // the permanent-instruction effect above rather than the shout
  // effect's delivery+expiry pair.
  useEffect(() => {
    if (!sevenVSixInstruction) {
      return;
    }
    if (sevenVSixAppliedIssuedMinuteRef.current === sevenVSixInstruction.issuedMinute) {
      return;
    }
    if (resolveSevenVSixInstructionStatus(sevenVSixInstruction, view.clockMinute) !== "ADOPTED") {
      return;
    }
    sevenVSixAppliedIssuedMinuteRef.current = sevenVSixInstruction.issuedMinute;
    const adoptionMinute = sevenVSixAdoptionMinute(sevenVSixInstruction);
    const { target } = sevenVSixInstruction;
    queueMicrotask(() => {
      onSevenVSixAdopted(adoptionMinute, target === "ON");
      setSevenVSixInstruction(null);
    });
  }, [sevenVSixInstruction, view.clockMinute, onSevenVSixAdopted]);

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
      setInstruction({ issuedMinute: view.clockMinute, profile, deliveryMode: "SIDELINE" });
    },
    canCallTimeout: canCallTimeout(clock),
    callTimeout: () => setClock((current) => callTimeoutClock(current)),
    endTimeout: () => setClock((current) => endTimeoutClock(current)),
    timeoutSecondsRemaining,
    issueTimeoutInstruction: (profile) => {
      if (instruction) return;
      if (clock.phase !== "TIMEOUT") return;
      setInstruction({ issuedMinute: view.clockMinute, profile, deliveryMode: "TIMEOUT" });
    },
    pendingShout: shoutState?.shout ?? null,
    shoutStatus: shoutState ? resolveShoutStatus(shoutState.shout, view.clockMinute) : null,
    issueShout: (type, baselineProfile) => {
      if (shoutState) return;
      if (clock.phase !== "FIRST_HALF" && clock.phase !== "SECOND_HALF") return;
      shoutPhaseRef.current = "NONE";
      setShoutState({
        shout: { type, issuedMinute: view.clockMinute },
        baselineProfile,
        overrideProfile: applyShoutOverride(baselineProfile, type),
      });
    },
    pendingSevenVSixInstruction: sevenVSixInstruction,
    sevenVSixInstructionStatus: sevenVSixInstruction ? resolveSevenVSixInstructionStatus(sevenVSixInstruction, view.clockMinute) : null,
    issueSevenVSixInstruction: (target) => {
      if (sevenVSixInstruction) return;
      if (clock.phase !== "FIRST_HALF" && clock.phase !== "SECOND_HALF") return;
      setSevenVSixInstruction({ target, issuedMinute: view.clockMinute, deliveryMode: "SIDELINE" });
    },
    issueSevenVSixTimeoutInstruction: (target) => {
      if (sevenVSixInstruction) return;
      if (clock.phase !== "TIMEOUT") return;
      setSevenVSixInstruction({ target, issuedMinute: view.clockMinute, deliveryMode: "TIMEOUT" });
    },
  };
}
