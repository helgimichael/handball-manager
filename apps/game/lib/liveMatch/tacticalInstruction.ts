// HM-TACTICS-0.7 / HM-COACHING-0.1: headless in-match tactical
// instruction/adoption layer.
//
// A manager's mid-match tactical change must not affect the match
// instantly (Spec: "changes must not affect the match instantly"). This
// module models exactly one pending instruction as a pure value plus a
// pure status function -- issued at a given simulated match minute,
// ADOPTED only after a small, deterministic, explicitly PROVISIONAL
// implementation delay. No player receptiveness model, no shouts, no
// 7v6: the delay is a fixed constant per delivery mode, never derived
// from any player/team attribute or from real elapsed (wall-clock) time,
// which is what keeps this compatible with Live Match's pause/speed
// controls (Spec: "pause/speed does not change tactical outcome") -- the
// status is purely a function of the SIMULATED clock minute.
//
// HM-COACHING-0.1 adds a second delivery mode: an instruction issued
// during a timeout (clock.ts's TIMEOUT phase) adopts faster than a
// normal sideline instruction. This is the ONLY effect a timeout has on
// tactical adjustment -- it changes how quickly an instruction is
// delivered, never the adjustment's magnitude or direction (Spec:
// "timeout must NOT give a magical performance bonus" / "advantage
// comes only from improved instruction delivery").
import type { TeamTacticalProfile } from "../career/teamTacticalProfile";

/**
 * PROVISIONAL, deterministic delay (in simulated match minutes) between
 * a normal sideline tactical instruction being issued and it taking
 * effect. Not a claim about real handball adoption speed or a player-
 * receptiveness model (explicitly out of scope here) -- a single fixed
 * technical constant, isolated and documented exactly like
 * PROVISIONAL_NEUTRAL_CAPABILITY.
 */
export const TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES = 3;

/**
 * PROVISIONAL, deterministic delay for an instruction issued DURING a
 * timeout -- deliberately shorter than the sideline delay above (a
 * timeout gives the manager the whole team's attention, so the change
 * reaches the players faster). Still just a fixed technical constant,
 * not a player-receptiveness model, and still bounded/documented the
 * same way.
 */
export const TACTICAL_INSTRUCTION_TIMEOUT_ADOPTION_DELAY_MINUTES = 1;

export type InstructionDeliveryMode = "SIDELINE" | "TIMEOUT";

/** One in-flight tactical instruction. Only one may be pending at a time (minimum coherent scope -- no instruction queue yet). */
export interface TacticalInstruction {
  /** The simulated match minute the manager issued this instruction at. */
  issuedMinute: number;
  /** The full TeamTacticalProfile (all 3 HM-TACTICS-0.6A fields) the manager wants adopted. */
  profile: TeamTacticalProfile;
  /** HM-COACHING-0.1: how this instruction was delivered -- determines only which delay constant applies (see the two constants above), never anything about the tactical adjustment itself. */
  deliveryMode: InstructionDeliveryMode;
}

export type TacticalInstructionStatus = "PENDING" | "ADOPTED";

function adoptionDelayMinutesFor(mode: InstructionDeliveryMode): number {
  return mode === "TIMEOUT" ? TACTICAL_INSTRUCTION_TIMEOUT_ADOPTION_DELAY_MINUTES : TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES;
}

/** Deterministic: a pure function of `issuedMinute` and `deliveryMode` only -- never of wall-clock time, playback speed, or pause state. */
export function instructionAdoptionMinute(instruction: TacticalInstruction): number {
  return Math.min(60, instruction.issuedMinute + adoptionDelayMinutesFor(instruction.deliveryMode));
}

/** PENDING until the simulated clock reaches the instruction's (deterministic) adoption minute, then ADOPTED. */
export function resolveInstructionStatus(instruction: TacticalInstruction, clockMinute: number): TacticalInstructionStatus {
  return clockMinute >= instructionAdoptionMinute(instruction) ? "ADOPTED" : "PENDING";
}
