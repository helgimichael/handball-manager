"use client";

// React wrapper (HM-MATCH-0.1) around the pure clock/view modules. All
// actual match-state logic lives in clock.ts/liveMatchView.ts and is
// unit-tested there; this hook only owns the setInterval ticking and
// exposes the current view + controls.
import { useEffect, useRef, useState } from "react";
import { seedFromString, type FastMatchResult } from "@handball-manager/game-simulation";
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
import { instructionAdoptionMinute, type InstructionDeliveryMode, type TacticalInstruction } from "./tacticalInstruction";
import {
  applyShoutOverride,
  resolveShoutStatus,
  shoutDeliveryMinute,
  shoutExpiryMinute,
  type Shout,
  type ShoutStatus,
  type ShoutType,
} from "./sidelineShout";
import { sevenVSixAdoptionMinute, type SevenVSixInstruction, type SevenVSixTarget } from "./sevenVSixMode";
import { matchPlanChangeAdoptionMinute, resolveMatchPlanChangeStatus, type MatchPlanChange, type MatchPlanChangeInstruction, type MatchPlanChangeStatus } from "./matchPlanChange";
import {
  applyProfileMask,
  assessImplementation,
  changedProfileFields,
  IMPLEMENTATION_DELAY_EXTENSION_MINUTES,
  RECENT_CHANGE_WINDOW_MINUTES,
  type ImplementationOutcome,
} from "./implementationAssessment";
import type { CapabilityLevel } from "../career/teamTacticalProfile";

/** HM-COACHING-0.3: what Live Match shows for an in-flight (or just-landed) assessed instruction -- deliberately just these 4 discrete labels, never the underlying scores/probabilities (Spec: "avoid exposing fake precision"). */
export type InstructionLifecycleStatus = "PENDING" | "DELAYED" | "PARTIAL" | "ADOPTED";

export interface LastInstructionOutcome {
  outcome: ImplementationOutcome;
  landedMinute: number;
}

export interface UseLiveMatchResult {
  view: LiveMatchView;
  /** HM-MATCH-1.3A: the raw clock (phase/clockMinute/speed/timeoutsUsed/timeoutReturnPhase) -- exposed so a persistent LiveMatchSession can be reconstructed exactly on remount, not just the derived pieces `view`/`speed` already surfaced. */
  clock: LiveMatchClock;
  speed: PlaybackSpeed;
  setSpeed: (speed: PlaybackSpeed) => void;
  startSecondHalf: () => void;
  instantResult: () => void;
  /** HM-TACTICS-0.7: the one in-flight instruction, if any (null once landed and applied). */
  pendingInstruction: TacticalInstruction | null;
  /** HM-COACHING-0.3: PENDING while awaiting assessment, DELAYED/PARTIAL/ADOPTED once assessed (see the module doc on implementationAssessment.ts). */
  instructionStatus: InstructionLifecycleStatus | null;
  /** The last assessed instruction's outcome, kept around for display after the pending slot frees up (a new instruction can be issued immediately). */
  lastInstructionOutcome: LastInstructionOutcome | null;
  /** No-op if an instruction is already pending (one at a time) or the match isn't currently in play (i.e. not FIRST_HALF/SECOND_HALF -- this never fires during a TIMEOUT). `baselineProfile` is the profile currently in effect, needed to assess complexity/what a PARTIAL outcome would keep. */
  issueInstruction: (profile: TeamTacticalProfile, baselineProfile: TeamTacticalProfile) => void;
  /** HM-COACHING-0.1: whether the manager could call a timeout right now (see clock.ts's canCallTimeout/MAX_TIMEOUTS_PER_HALF). */
  canCallTimeout: boolean;
  /** No-op if `canCallTimeout` is false. */
  callTimeout: () => void;
  /** Ends the current timeout early, resuming play immediately. No-op outside TIMEOUT. */
  endTimeout: () => void;
  /** Real-world seconds left in the current timeout countdown; null outside TIMEOUT. Presentation-only -- has no bearing on match determinism. */
  timeoutSecondsRemaining: number | null;
  /** No-op if an instruction is already pending or the match isn't currently in a TIMEOUT. Improves (never guarantees) delivery vs `issueInstruction` -- see implementationAssessment.ts. */
  issueTimeoutInstruction: (profile: TeamTacticalProfile, baselineProfile: TeamTacticalProfile) => void;
  /** HM-TACTICS-0.9: no-op if an instruction is already pending or the match isn't currently in HALF_TIME. Better delivery context than even a timeout -- see implementationAssessment.ts. */
  issueHalftimeInstruction: (profile: TeamTacticalProfile, baselineProfile: TeamTacticalProfile) => void;
  /** HM-COACHING-0.2: the one in-flight shout, if any (null once EXPIRED and reverted). Deliberately NOT put through HM-COACHING-0.3's assessment -- see implementationAssessment.ts's module doc for why. */
  pendingShout: Shout | null;
  shoutStatus: ShoutStatus | null;
  /** No-op if a shout is already pending/active (one at a time -- Spec: "must not stack") or the match isn't currently in play. */
  issueShout: (type: ShoutType, baselineProfile: TeamTacticalProfile) => void;
  /** HM-TACTICS-0.8: the one in-flight 7v6 ON/OFF switch, if any (null once landed and applied). */
  pendingSevenVSixInstruction: SevenVSixInstruction | null;
  sevenVSixInstructionStatus: InstructionLifecycleStatus | null;
  lastSevenVSixOutcome: LastInstructionOutcome | null;
  /** No-op if a 7v6 switch is already pending or the match isn't currently in play. `tacticalFamiliarity` is the manager's current profile familiarity, used as HM-COACHING-0.3 assessment context. */
  issueSevenVSixInstruction: (target: SevenVSixTarget, tacticalFamiliarity: CapabilityLevel) => void;
  /** No-op if a 7v6 switch is already pending or the match isn't currently in a TIMEOUT. */
  issueSevenVSixTimeoutInstruction: (target: SevenVSixTarget, tacticalFamiliarity: CapabilityLevel) => void;
  /** HM-TACTICS-0.9: no-op if a 7v6 switch is already pending or the match isn't currently in HALF_TIME. */
  issueSevenVSixHalftimeInstruction: (target: SevenVSixTarget, tacticalFamiliarity: CapabilityLevel) => void;
  /** HM-COACHING-1.0: the one in-flight live MatchPlan coaching change, if any (null once landed and applied). Deliberately simpler than the profile instruction above -- no DELAYED/PARTIAL assessment (see matchPlanChange.ts's module doc). */
  pendingMatchPlanChange: MatchPlanChangeInstruction | null;
  matchPlanChangeStatus: MatchPlanChangeStatus | null;
  /** No-op if a MatchPlan change is already pending (one at a time) or the match isn't currently in play. */
  issueMatchPlanChange: (change: MatchPlanChange) => void;
  /** HM-MATCH-1.2 Part U/W: no-op if a MatchPlan change is already pending or the match isn't currently in HALF_TIME -- 0-minute delay (adopts exactly at the halftime minute), so the confirmed second-half plan affects only [30, 60]. */
  issueHalftimeMatchPlanChange: (change: MatchPlanChange) => void;
}

interface ShoutState {
  shout: Shout;
  /** The profile in effect when the shout was called -- captured once, at issue time, so expiry reverts to exactly this, regardless of anything else that happens meanwhile. */
  baselineProfile: TeamTacticalProfile;
  /** `applyShoutOverride(baselineProfile, shout.type)`, precomputed at issue time. */
  overrideProfile: TeamTacticalProfile;
}

/**
 * HM-COACHING-0.3: an assessed permanent tactical instruction. Everything
 * situational is precomputed once, at issue time (deterministic given
 * the fixture's own result seed) -- `actualAdoptionMinute` and
 * `actualProfile` are exactly what the splice will use once the
 * instruction lands, regardless of how many renders happen in between.
 */
interface AssessedInstructionState {
  instruction: TacticalInstruction;
  baselineProfile: TeamTacticalProfile;
  changedFields: (keyof TeamTacticalProfile)[];
  outcome: ImplementationOutcome;
  assessmentMinute: number;
  actualAdoptionMinute: number;
  actualProfile: TeamTacticalProfile;
}

interface AssessedSevenVSixState {
  instruction: SevenVSixInstruction;
  outcome: ImplementationOutcome;
  assessmentMinute: number;
  actualAdoptionMinute: number;
}

function resolveAssessedLifecycle(
  clockMinute: number,
  assessmentMinute: number,
  actualAdoptionMinute: number,
  outcome: ImplementationOutcome,
): InstructionLifecycleStatus {
  if (clockMinute < assessmentMinute) {
    return "PENDING";
  }
  if (outcome === "DELAYED" && clockMinute < actualAdoptionMinute) {
    return "DELAYED";
  }
  return outcome === "PARTIAL" ? "PARTIAL" : "ADOPTED";
}

function countRecentChanges(recentIssuanceMinutes: readonly number[], atMinute: number): number {
  return recentIssuanceMinutes.filter((m) => m < atMinute && m > atMinute - RECENT_CHANGE_WINDOW_MINUTES).length;
}

function buildAssessedInstruction(
  instruction: TacticalInstruction,
  baselineProfile: TeamTacticalProfile,
  resultSeed: number,
  recentChangeCount: number,
): AssessedInstructionState {
  const changedFields = changedProfileFields(baselineProfile, instruction.profile);
  const assessmentMinute = instructionAdoptionMinute(instruction);
  const seed = seedFromString(`${resultSeed}:assessment:profile:${instruction.issuedMinute}:${instruction.deliveryMode}`);
  const { outcome, adoptedUnitMask } = assessImplementation(seed, {
    tacticalFamiliarity: baselineProfile.tacticalFamiliarity,
    deliveryMode: instruction.deliveryMode,
    changedUnitCount: changedFields.length,
    recentChangeCount,
  });
  const actualAdoptionMinute = outcome === "DELAYED" ? Math.min(60, assessmentMinute + IMPLEMENTATION_DELAY_EXTENSION_MINUTES) : assessmentMinute;
  const actualProfile = applyProfileMask(baselineProfile, instruction.profile, changedFields, adoptedUnitMask);
  return { instruction, baselineProfile, changedFields, outcome, assessmentMinute, actualAdoptionMinute, actualProfile };
}

function buildAssessedSevenVSix(
  instruction: SevenVSixInstruction,
  tacticalFamiliarity: CapabilityLevel,
  resultSeed: number,
  recentChangeCount: number,
): AssessedSevenVSixState {
  const assessmentMinute = sevenVSixAdoptionMinute(instruction);
  const seed = seedFromString(`${resultSeed}:assessment:7v6:${instruction.issuedMinute}:${instruction.deliveryMode}`);
  const { outcome } = assessImplementation(seed, {
    tacticalFamiliarity,
    deliveryMode: instruction.deliveryMode,
    changedUnitCount: 1, // a single ON/OFF switch -- PARTIAL never applies (see implementationAssessment.ts)
    recentChangeCount,
  });
  const actualAdoptionMinute = outcome === "DELAYED" ? Math.min(60, assessmentMinute + IMPLEMENTATION_DELAY_EXTENSION_MINUTES) : assessmentMinute;
  return { instruction, outcome, assessmentMinute, actualAdoptionMinute };
}

export function useLiveMatch(
  result: FastMatchResult,
  onInstructionAdopted: (adoptionMinute: number, profile: TeamTacticalProfile) => void,
  onShoutDelivered: (deliveryMinute: number, overrideProfile: TeamTacticalProfile) => void,
  onShoutExpired: (expiryMinute: number, baselineProfile: TeamTacticalProfile) => void,
  onSevenVSixAdopted: (adoptionMinute: number, active: boolean) => void,
  onMatchPlanChangeAdopted: (adoptionMinute: number, requestedMinute: number, change: MatchPlanChange) => void,
  /** HM-MATCH-1.3A Part D/E: resumes from a persisted LiveMatchSession's clock instead of always kicking off fresh at PRE_MATCH/minute 0 -- the direct fix for "navigate away and back resets to 0-0/00:00". `undefined` (every pre-1.3A caller) keeps the original kickoff-on-mount behavior. */
  initialClock?: LiveMatchClock,
): UseLiveMatchResult {
  const [clock, setClock] = useState<LiveMatchClock>(() => initialClock ?? kickoff(initLiveMatchClock()));
  const [assessedInstruction, setAssessedInstruction] = useState<AssessedInstructionState | null>(null);
  const [lastInstructionOutcome, setLastInstructionOutcome] = useState<LastInstructionOutcome | null>(null);
  const [timeoutSecondsRemaining, setTimeoutSecondsRemaining] = useState<number | null>(null);
  const [shoutState, setShoutState] = useState<ShoutState | null>(null);
  const [assessedSevenVSix, setAssessedSevenVSix] = useState<AssessedSevenVSixState | null>(null);
  const [lastSevenVSixOutcome, setLastSevenVSixOutcome] = useState<LastInstructionOutcome | null>(null);
  const [pendingMatchPlanChange, setPendingMatchPlanChange] = useState<MatchPlanChangeInstruction | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appliedIssuedMinuteRef = useRef<number | null>(null);
  const shoutPhaseRef = useRef<"NONE" | "DELIVERED" | "EXPIRED">("NONE");
  const sevenVSixAppliedIssuedMinuteRef = useRef<number | null>(null);
  const matchPlanChangeAppliedIdRef = useRef<string | null>(null);
  // HM-COACHING-0.3: every tactical change issued through this hook
  // (instruction, timeout instruction, shout, 7v6 switch) pushes its
  // issue minute here -- used only to count "how many recent tactical
  // changes" for the NEXT assessed instruction/7v6 switch's context. A
  // ref, not state: it never needs to trigger a re-render on its own.
  const recentIssuanceMinutesRef = useRef<number[]>([]);

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

  // HM-TACTICS-0.7 / HM-COACHING-0.3: the assessed instruction lands
  // exactly once, at its (precomputed, deterministic) actual adoption
  // minute -- PENDING/DELAYED are pure display states resolved from the
  // same precomputed minutes, never re-assessed.
  useEffect(() => {
    if (!assessedInstruction) {
      return;
    }
    if (appliedIssuedMinuteRef.current === assessedInstruction.instruction.issuedMinute) {
      return;
    }
    const status = resolveAssessedLifecycle(
      view.clockMinute,
      assessedInstruction.assessmentMinute,
      assessedInstruction.actualAdoptionMinute,
      assessedInstruction.outcome,
    );
    if (status === "PENDING" || status === "DELAYED") {
      return;
    }
    appliedIssuedMinuteRef.current = assessedInstruction.instruction.issuedMinute;
    const { actualAdoptionMinute, actualProfile, outcome } = assessedInstruction;
    // Deferred to a microtask so the state updates below happen outside
    // this effect's own synchronous body (avoids cascading same-commit
    // re-renders) -- the same pattern the tick timer above already uses
    // (setState only ever fires from within a callback the effect
    // registered, never directly in the effect body itself).
    queueMicrotask(() => {
      onInstructionAdopted(actualAdoptionMinute, actualProfile);
      setLastInstructionOutcome({ outcome, landedMinute: actualAdoptionMinute });
      setAssessedInstruction(null);
    });
  }, [assessedInstruction, view.clockMinute, onInstructionAdopted]);

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

  // HM-TACTICS-0.8 / HM-COACHING-0.3: 7v6 ON/OFF switch adoption. A
  // persistent mode, not a shout -- lands exactly once (never expires on
  // its own), mirroring the permanent-instruction effect above.
  useEffect(() => {
    if (!assessedSevenVSix) {
      return;
    }
    if (sevenVSixAppliedIssuedMinuteRef.current === assessedSevenVSix.instruction.issuedMinute) {
      return;
    }
    const status = resolveAssessedLifecycle(
      view.clockMinute,
      assessedSevenVSix.assessmentMinute,
      assessedSevenVSix.actualAdoptionMinute,
      assessedSevenVSix.outcome,
    );
    if (status === "PENDING" || status === "DELAYED") {
      return;
    }
    sevenVSixAppliedIssuedMinuteRef.current = assessedSevenVSix.instruction.issuedMinute;
    const { actualAdoptionMinute, outcome, instruction } = assessedSevenVSix;
    queueMicrotask(() => {
      onSevenVSixAdopted(actualAdoptionMinute, instruction.target === "ON");
      setLastSevenVSixOutcome({ outcome, landedMinute: actualAdoptionMinute });
      setAssessedSevenVSix(null);
    });
  }, [assessedSevenVSix, view.clockMinute, onSevenVSixAdopted]);

  // HM-COACHING-1.0: a live MatchPlan change lands exactly once, at its
  // (deterministic, unassessed) adoption minute -- mirrors the 7v6
  // effect above, deliberately without DELAYED/PARTIAL (see
  // matchPlanChange.ts's module doc for why).
  useEffect(() => {
    if (!pendingMatchPlanChange) {
      return;
    }
    if (matchPlanChangeAppliedIdRef.current === pendingMatchPlanChange.id) {
      return;
    }
    const status = resolveMatchPlanChangeStatus(pendingMatchPlanChange, view.clockMinute);
    if (status === "PENDING") {
      return;
    }
    matchPlanChangeAppliedIdRef.current = pendingMatchPlanChange.id;
    const adoptionMinute = matchPlanChangeAdoptionMinute(pendingMatchPlanChange);
    const { issuedMinute, change } = pendingMatchPlanChange;
    queueMicrotask(() => {
      onMatchPlanChangeAdopted(adoptionMinute, issuedMinute, change);
      setPendingMatchPlanChange(null);
    });
  }, [pendingMatchPlanChange, view.clockMinute, onMatchPlanChangeAdopted]);

  const instructionLifecycleStatus = assessedInstruction
    ? resolveAssessedLifecycle(view.clockMinute, assessedInstruction.assessmentMinute, assessedInstruction.actualAdoptionMinute, assessedInstruction.outcome)
    : null;
  const sevenVSixInstructionStatus = assessedSevenVSix
    ? resolveAssessedLifecycle(view.clockMinute, assessedSevenVSix.assessmentMinute, assessedSevenVSix.actualAdoptionMinute, assessedSevenVSix.outcome)
    : null;

  function phaseAllowsDeliveryMode(deliveryMode: InstructionDeliveryMode): boolean {
    switch (deliveryMode) {
      case "TIMEOUT":
        return clock.phase === "TIMEOUT";
      case "HALFTIME":
        return clock.phase === "HALF_TIME";
      default:
        return clock.phase === "FIRST_HALF" || clock.phase === "SECOND_HALF";
    }
  }

  function issueInstructionWithMode(profile: TeamTacticalProfile, baselineProfile: TeamTacticalProfile, deliveryMode: InstructionDeliveryMode) {
    if (assessedInstruction) return;
    if (!phaseAllowsDeliveryMode(deliveryMode)) return;
    const instruction: TacticalInstruction = { issuedMinute: view.clockMinute, profile, deliveryMode };
    const recentChangeCount = countRecentChanges(recentIssuanceMinutesRef.current, view.clockMinute);
    recentIssuanceMinutesRef.current.push(view.clockMinute);
    appliedIssuedMinuteRef.current = null;
    setAssessedInstruction(buildAssessedInstruction(instruction, baselineProfile, result.seed, recentChangeCount));
  }

  function issueSevenVSixWithMode(target: SevenVSixTarget, tacticalFamiliarity: CapabilityLevel, deliveryMode: InstructionDeliveryMode) {
    if (assessedSevenVSix) return;
    if (!phaseAllowsDeliveryMode(deliveryMode)) return;
    const instruction: SevenVSixInstruction = { target, issuedMinute: view.clockMinute, deliveryMode };
    const recentChangeCount = countRecentChanges(recentIssuanceMinutesRef.current, view.clockMinute);
    recentIssuanceMinutesRef.current.push(view.clockMinute);
    sevenVSixAppliedIssuedMinuteRef.current = null;
    setAssessedSevenVSix(buildAssessedSevenVSix(instruction, tacticalFamiliarity, result.seed, recentChangeCount));
  }

  return {
    view,
    clock,
    speed: clock.speed,
    setSpeed: (speed) => setClock((current) => setClockSpeed(current, speed)),
    startSecondHalf: () => setClock((current) => startClockSecondHalf(current)),
    instantResult: () => setClock(() => revealInstantly()),
    pendingInstruction: assessedInstruction?.instruction ?? null,
    instructionStatus: instructionLifecycleStatus,
    lastInstructionOutcome,
    issueInstruction: (profile, baselineProfile) => issueInstructionWithMode(profile, baselineProfile, "SIDELINE"),
    canCallTimeout: canCallTimeout(clock),
    callTimeout: () => setClock((current) => callTimeoutClock(current)),
    endTimeout: () => setClock((current) => endTimeoutClock(current)),
    timeoutSecondsRemaining,
    issueTimeoutInstruction: (profile, baselineProfile) => issueInstructionWithMode(profile, baselineProfile, "TIMEOUT"),
    issueHalftimeInstruction: (profile, baselineProfile) => issueInstructionWithMode(profile, baselineProfile, "HALFTIME"),
    pendingShout: shoutState?.shout ?? null,
    shoutStatus: shoutState ? resolveShoutStatus(shoutState.shout, view.clockMinute) : null,
    issueShout: (type, baselineProfile) => {
      if (shoutState) return;
      if (clock.phase !== "FIRST_HALF" && clock.phase !== "SECOND_HALF") return;
      shoutPhaseRef.current = "NONE";
      recentIssuanceMinutesRef.current.push(view.clockMinute);
      setShoutState({
        shout: { type, issuedMinute: view.clockMinute },
        baselineProfile,
        overrideProfile: applyShoutOverride(baselineProfile, type),
      });
    },
    pendingSevenVSixInstruction: assessedSevenVSix?.instruction ?? null,
    sevenVSixInstructionStatus,
    lastSevenVSixOutcome,
    issueSevenVSixInstruction: (target, tacticalFamiliarity) => issueSevenVSixWithMode(target, tacticalFamiliarity, "SIDELINE"),
    issueSevenVSixTimeoutInstruction: (target, tacticalFamiliarity) => issueSevenVSixWithMode(target, tacticalFamiliarity, "TIMEOUT"),
    issueSevenVSixHalftimeInstruction: (target, tacticalFamiliarity) => issueSevenVSixWithMode(target, tacticalFamiliarity, "HALFTIME"),
    pendingMatchPlanChange,
    matchPlanChangeStatus: pendingMatchPlanChange ? resolveMatchPlanChangeStatus(pendingMatchPlanChange, view.clockMinute) : null,
    issueMatchPlanChange: (change) => {
      if (pendingMatchPlanChange) return;
      if (clock.phase !== "FIRST_HALF" && clock.phase !== "SECOND_HALF") return;
      matchPlanChangeAppliedIdRef.current = null;
      setPendingMatchPlanChange({ id: `${change.kind}:${view.clockMinute}:${change.category}`, issuedMinute: view.clockMinute, change, deliveryMode: "SIDELINE" });
    },
    issueHalftimeMatchPlanChange: (change) => {
      if (pendingMatchPlanChange) return;
      if (clock.phase !== "HALF_TIME") return;
      matchPlanChangeAppliedIdRef.current = null;
      setPendingMatchPlanChange({ id: `${change.kind}:${view.clockMinute}:${change.category}:halftime`, issuedMinute: view.clockMinute, change, deliveryMode: "HALFTIME" });
    },
  };
}
