// HM-TACTICS-0.9: the smallest deterministic AI opponent adaptation
// layer. The opponent may only react to tactical states it can
// honestly OBSERVE in the current model -- there is no hidden
// scoreline-aware rubber-banding, no coach rating/personality, and no
// new ATI/TI vocabulary. Two observable, already-existing signals are
// supported:
//
//   - persistent 7v6 (HM-TACTICS-0.8's own ON/OFF mode)
//   - sustained ati001UsageTendency = HIGH (TeamTacticalProfile's own
//     existing field)
//
// Once a pattern has persisted long enough, the opponent "notices" and,
// after its own implementation delay, DAMPENS (never adds to) one of
// the EXISTING numeric adjustment channels tacticalMatchAdjustment.ts
// already computes for the manager's own side -- see
// computeTacticalMatchAdjustment's `opponentAdaptation` parameter. This
// is never a new bonus and never a direct score change: it only ever
// partially cancels an increment the manager's own tactics already
// earned, honestly modeling "the opponent has caught on."
import type { CapabilityLevel } from "./teamTacticalProfile";

export type OpponentAdaptationTrigger = "SEVEN_V_SIX" | "ATI001_HIGH";

/** PROVISIONAL: how many consecutive simulated match minutes a pattern must persist before the opponent notices it at all. */
export const OPPONENT_ADAPTATION_TRIGGER_MINUTES = 8;

/** PROVISIONAL: how many minutes after noticing the opponent needs to actually implement its own reaction -- the opponent isn't magically instant either, mirroring the manager's own sideline delay. */
export const OPPONENT_ADAPTATION_DELAY_MINUTES = 3;

/**
 * PROVISIONAL, isolated: how much of the relevant existing bonus
 * channel the opponent cancels once (fully) adapted. Never pushes the
 * channel below its own pre-bonus baseline, and never a new bonus of
 * its own -- see tacticalMatchAdjustment.ts's application of this
 * figure.
 */
export const OPPONENT_ADAPTATION_DAMPENING_FRACTION = 0.5;

export interface OpponentAdaptationEffect {
  trigger: OpponentAdaptationTrigger;
  dampeningFraction: number;
}

/** What the opponent can honestly observe about the manager's own tactical state, and since which simulated match minute. */
export interface ObservableTacticalState {
  sevenVSixActive: boolean;
  /** The simulated match minute 7v6 became active, or null while inactive. */
  sevenVSixActiveSinceMinute: number | null;
  ati001UsageTendency: CapabilityLevel;
  /** The simulated match minute ati001UsageTendency became HIGH, or null while it isn't HIGH. */
  ati001HighSinceMinute: number | null;
}

/**
 * Deterministic: a pure function of the observable state and the
 * minute being checked. Returns null ("no adaptation if there is
 * nothing supported to react to") unless a pattern has persisted for
 * at least OPPONENT_ADAPTATION_TRIGGER_MINUTES. 7v6 is checked first --
 * an arbitrary but fixed, documented tie-break if both happen to
 * qualify at once, never a hidden priority system.
 */
export function detectOpponentAdaptationTrigger(state: ObservableTacticalState, atMinute: number): OpponentAdaptationTrigger | null {
  if (
    state.sevenVSixActive &&
    state.sevenVSixActiveSinceMinute !== null &&
    atMinute - state.sevenVSixActiveSinceMinute >= OPPONENT_ADAPTATION_TRIGGER_MINUTES
  ) {
    return "SEVEN_V_SIX";
  }
  if (
    state.ati001UsageTendency === "HIGH" &&
    state.ati001HighSinceMinute !== null &&
    atMinute - state.ati001HighSinceMinute >= OPPONENT_ADAPTATION_TRIGGER_MINUTES
  ) {
    return "ATI001_HIGH";
  }
  return null;
}
