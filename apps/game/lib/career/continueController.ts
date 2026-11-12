import { CalendarSchedulingError } from "../competition/cupSchedule";
import { buildClubEvent } from "./careerEvents";
import { withEvents } from "../manager/events";
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
  | "CALENDAR_CONFLICT"
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
  // HM-M7D: a manager without a club no longer freezes the world -- the calendar
  // continues (his old club is run by an interim) and stops at offers and other
  // important career news like any other day.
  if (pendingAction) {
    // Spec S19/S22: Continue cannot silently pass an unresolved
    // ACTION_REQUIRED event -- not even to process a fresh day.
    return { state, events: [], stopReason: "ACTION_REQUIRED_PENDING", daysProcessed: 0 };
  }

  let current = state;
  const allEvents: CareerEvent[] = [];

  for (let daysProcessed = 1; daysProcessed <= CONTINUE_MAX_DAYS_PER_PRESS; daysProcessed += 1) {
    const nextDate = addDays(current.processedThroughDate, 1);
    let day: ReturnType<typeof processDay>;
    try { day = processDay(current, nextDate); }
    catch (error) {
      if (!(error instanceof CalendarSchedulingError)) throw error;
      const event = buildClubEvent('SEASON_MILESTONE', `calendar-conflict:${current.seasonId}:${error.fixtureId}`, current.gameDate, 'IMPORTANT', 'Kalendern kan inte fortsätta', error.message, [{ route: 'SEASON' }]);
      return { state: event ? withEvents(current, [event]) : current, events: [...allEvents, ...(event ? [event] : [])], stopReason: 'CALENDAR_CONFLICT', daysProcessed: daysProcessed - 1 };
    }
    const { state: tickState, events } = day;
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
