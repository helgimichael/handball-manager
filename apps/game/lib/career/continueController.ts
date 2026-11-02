// Continue Controller (HM-GAME-0.3, Spec S18-S19).
//
//   CONTINUE
//     -> any unresolved ACTION_REQUIRED event already pending? STOP, do not process a new day.
//     -> process next unprocessed day (processedThroughDate + 1)
//     -> ACTION_REQUIRED this day?  STOP.
//     -> IMPORTANT this day?        STOP (v0.1 soft-stop rule, Spec S19).
//     -> only INFORMATION/nothing?  loop to the next day.
//
// This is the ONLY place that decides whether the world keeps advancing.
// dailyTick.ts only ever processes exactly one day and reports what
// happened; it never loops or decides to stop on its own.

import { addDays } from "./dateUtils";
import { processDay } from "./dailyTick";
import type { CareerEvent } from "./careerEvents";
import { CONTINUE_MAX_DAYS_PER_PRESS } from "./careerRhythmConfig";
import type { CareerState } from "./types";

export type ContinueStopReason =
  | "SEASON_COMPLETE"
  | "ACTION_REQUIRED_PENDING"
  | "ACTION_REQUIRED"
  | "IMPORTANT"
  | "MAX_DAYS_REACHED";

export interface ContinueResult {
  state: CareerState;
  /** Every CareerEvent generated across every day processed by this single CONTINUE press, in order. */
  events: CareerEvent[];
  stopReason: ContinueStopReason;
  daysProcessed: number;
}

export function continueCareerRhythm(state: CareerState): ContinueResult {
  if (state.productionMatch) return { state, events: [], stopReason: 'ACTION_REQUIRED_PENDING', daysProcessed: 0 };
  if (state.seasonComplete) {
    return { state, events: [], stopReason: "SEASON_COMPLETE", daysProcessed: 0 };
  }

  const pendingAction = state.careerEvents.find((e) => e.requiresAction && !e.resolved);
  // HM-ALPHA3-M07: a manager without a club picks one before the world moves on.
  if (pendingAction || state.managerCareer?.seekingJob) {
    // Spec S19/S22: Continue cannot silently pass an unresolved
    // ACTION_REQUIRED event -- not even to process a fresh day.
    return { state, events: [], stopReason: "ACTION_REQUIRED_PENDING", daysProcessed: 0 };
  }

  let current = state;
  const allEvents: CareerEvent[] = [];

  for (let daysProcessed = 1; daysProcessed <= CONTINUE_MAX_DAYS_PER_PRESS; daysProcessed += 1) {
    const nextDate = addDays(current.processedThroughDate, 1);
    const { state: tickState, events } = processDay(current, nextDate);
    current = tickState;
    allEvents.push(...events);

    if (current.seasonComplete) {
      return { state: current, events: allEvents, stopReason: "SEASON_COMPLETE", daysProcessed };
    }
    if (events.some((e) => e.priority === "ACTION_REQUIRED")) {
      return { state: current, events: allEvents, stopReason: "ACTION_REQUIRED", daysProcessed };
    }
    if (events.some((e) => e.priority === "IMPORTANT")) {
      return { state: current, events: allEvents, stopReason: "IMPORTANT", daysProcessed };
    }
  }

  return { state: current, events: allEvents, stopReason: "MAX_DAYS_REACHED", daysProcessed: CONTINUE_MAX_DAYS_PER_PRESS };
}
