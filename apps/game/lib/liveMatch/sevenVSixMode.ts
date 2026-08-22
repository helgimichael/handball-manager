// HM-TACTICS-0.8: 7v6 as a persistent tactical mode.
//
// Not a shout (HM-COACHING-0.2): 7v6 stays ON until the manager
// switches it back OFF, not until a fixed timer expires. It reuses the
// exact same issued -> pending -> adopted architecture HM-TACTICS-0.7's
// permanent tactical instructions, HM-COACHING-0.1's timeout
// instructions, and HM-TACTICS-0.9's halftime instructions already use
// -- including the SAME three delay constants -- rather than inventing
// a parallel set.
import {
  TACTICAL_INSTRUCTION_ADOPTION_DELAY_MINUTES,
  TACTICAL_INSTRUCTION_HALFTIME_ADOPTION_DELAY_MINUTES,
  TACTICAL_INSTRUCTION_TIMEOUT_ADOPTION_DELAY_MINUTES,
} from "./tacticalInstruction";
import type { InstructionDeliveryMode } from "./tacticalInstruction";

export type SevenVSixTarget = "ON" | "OFF";

/** One in-flight ON/OFF switch. Only one may be pending at a time (mirrors the existing single-instruction-slot pattern -- no queue). */
export interface SevenVSixInstruction {
  target: SevenVSixTarget;
  issuedMinute: number;
  deliveryMode: InstructionDeliveryMode;
}

export type SevenVSixInstructionStatus = "PENDING" | "ADOPTED";

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

/** Deterministic: a pure function of `issuedMinute`/`deliveryMode` only -- never of wall-clock time, playback speed, or pause state. */
export function sevenVSixAdoptionMinute(instruction: SevenVSixInstruction): number {
  return Math.min(60, instruction.issuedMinute + adoptionDelayMinutesFor(instruction.deliveryMode));
}

export function resolveSevenVSixInstructionStatus(instruction: SevenVSixInstruction, clockMinute: number): SevenVSixInstructionStatus {
  return clockMinute >= sevenVSixAdoptionMinute(instruction) ? "ADOPTED" : "PENDING";
}
