// HM-TACTICS-0.7: headless in-match tactical instruction/adoption layer.
//
// A manager's mid-match tactical change must not affect the match
// instantly (Spec: "changes must not affect the match instantly"). This
// module models exactly one pending instruction as a pure value plus a
// pure status function -- issued at a given simulated match minute,
// ADOPTED only after a small, deterministic, explicitly PROVISIONAL
// implementation delay. No player receptiveness model, no shouts, no
// timeout, no 7v6: the delay is a single fixed constant, never derived
// from any player/team attribute or from real elapsed (wall-clock) time,
// which is what keeps this compatible with Live Match's pause/speed
// controls (Spec: "pause/speed does not change tactical outcome") -- the
// status is purely a function of the SIMULATED clock minute.
import type { TeamTacticalProfile } from "../career/teamTacticalProfile";

/**
 * PROVISIONAL, deterministic delay (in simulated match minutes) between
 * a tactical instruction being issued and it taking effect. Not a claim
 * about real handball adoption speed or a player-receptiveness model
 * (explicitly out of scope here) -- a single fixed technical constant,
 * isolated and documented exactly like PROVISIONAL_NEUTRAL_CAPABILITY.
 */
export const TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES = 3;

/** One in-flight tactical instruction. Only one may be pending at a time (minimum coherent scope -- no instruction queue yet). */
export interface TacticalInstruction {
  /** The simulated match minute the manager issued this instruction at. */
  issuedMinute: number;
  /** The full TeamTacticalProfile (all 3 HM-TACTICS-0.6A fields) the manager wants adopted. */
  profile: TeamTacticalProfile;
}

export type TacticalInstructionStatus = "PENDING" | "ADOPTED";

/** Deterministic: a pure function of `issuedMinute` only -- never of wall-clock time, playback speed, or pause state. */
export function instructionAdoptionMinute(instruction: TacticalInstruction): number {
  return Math.min(60, instruction.issuedMinute + TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES);
}

/** PENDING until the simulated clock reaches the instruction's (deterministic) adoption minute, then ADOPTED. */
export function resolveInstructionStatus(instruction: TacticalInstruction, clockMinute: number): TacticalInstructionStatus {
  return clockMinute >= instructionAdoptionMinute(instruction) ? "ADOPTED" : "PENDING";
}
