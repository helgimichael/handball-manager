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
//
// HM-TACTICS-0.9 adds a third delivery mode: an instruction issued
// during HALF_TIME (clock.ts's own HALF_TIME phase) adopts with ZERO
// extra delay -- the halftime break itself IS the delivery window (see
// TACTICAL_INSTRUCTION_HALFTIME_ADOPTION_DELAY_MINUTES below), and
// implementationAssessment.ts gives it an even better delivery-quality
// score than a timeout (a proper sit-down team talk beats a 60-second
// break in play). Still never touches the tactical adjustment's own
// magnitude -- delivery reliability only, same as timeout.
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

/**
 * PROVISIONAL, deterministic delay for an instruction issued DURING
 * HALF_TIME. Zero: the halftime break itself is the whole delivery
 * window (the clock is frozen at 30:00 for as long as the manager
 * stays there -- see clock.ts), so there is nothing left to wait out
 * once the manager gives the instruction. What can still vary is
 * implementationAssessment.ts's FULL/PARTIAL/DELAYED outcome, not this
 * delay.
 */
export const TACTICAL_INSTRUCTION_HALFTIME_ADOPTION_DELAY_MINUTES = 0;

export type InstructionDeliveryMode = "SIDELINE" | "TIMEOUT" | "HALFTIME";

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
  switch (mode) {
    case "TIMEOUT":
      return TACTICAL_INSTRUCTION_TIMEOUT_ADOPTION_DELAY_MINUTES;
    case "HALFTIME":
      return TACTICAL_INSTRUCTION_HALFTIME_ADOPTION_DELAY_MINUTES;
    default:
      return TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES;
  }
}

/** Deterministic: a pure function of `issuedMinute` and `deliveryMode` only -- never of wall-clock time, playback speed, or pause state. */
export function instructionAdoptionMinute(instruction: TacticalInstruction): number {
  return Math.min(60, instruction.issuedMinute + adoptionDelayMinutesFor(instruction.deliveryMode));
}

/** PENDING until the simulated clock reaches the instruction's (deterministic) adoption minute, then ADOPTED. */
export function resolveInstructionStatus(instruction: TacticalInstruction, clockMinute: number): TacticalInstructionStatus {
  return clockMinute >= instructionAdoptionMinute(instruction) ? "ADOPTED" : "PENDING";
}
