// HM-TRAINING-1.0 Part 24: thin CareerState-level wrappers around
// lib/training/trainingSchedule.ts's pure TrainingWeek edit functions --
// same "unwrap the week, apply the pure fn, write it back" discipline as
// lib/career/matchPlanActions.ts wraps lib/matchPlan/matchPlanEdits.ts.
// Every function here also calls `ensureTrainingWeek` first so the very
// first edit to a not-yet-persisted (only resolved-on-demand) week
// creates and stores it in the same call, rather than requiring a
// separate "create the week" step from the caller.
import {
  addTrainingSession,
  buildTrainingWeek,
  ensureTrainingWeek,
  removeTrainingSession,
  setTrainingDayType,
  type SessionSeed,
} from "../training/trainingSchedule";
import type { TrainingDayType, TrainingSession, TrainingWeek } from "../training/types";
import { updateTrainingSession as updateTrainingSessionPure } from "../training/trainingSchedule";
import type { CareerState } from "./types";

function withWeek(state: CareerState, weekStart: string, fn: (week: TrainingWeek) => TrainingWeek): CareerState {
  const ensured = ensureTrainingWeek(state, weekStart);
  const week = ensured.trainingWeeks[weekStart];
  const nextWeek = fn(week);
  if (nextWeek === week) return ensured;
  return { ...ensured, trainingWeeks: { ...ensured.trainingWeeks, [weekStart]: { ...nextWeek, planning: { source: "MANAGER" } } } };
}

export function setTrainingDayTypeAction(state: CareerState, weekStart: string, date: string, dayType: TrainingDayType): CareerState {
  return withWeek(state, weekStart, (week) => setTrainingDayType(week, date, dayType));
}

export function addTrainingSessionAction(state: CareerState, weekStart: string, date: string, seed: SessionSeed): CareerState {
  return withWeek(state, weekStart, (week) => addTrainingSession(week, date, seed));
}

export function removeTrainingSessionAction(state: CareerState, weekStart: string, date: string, sessionId: string): CareerState {
  return withWeek(state, weekStart, (week) => removeTrainingSession(week, date, sessionId));
}

export function updateTrainingSessionAction(
  state: CareerState,
  weekStart: string,
  date: string,
  sessionId: string,
  patch: Partial<Pick<TrainingSession, "type" | "intensity" | "duration" | "target" | "selectedPlayerIds" | "tacticalFocus" | "coachId">>,
): CareerState {
  return withWeek(state, weekStart, (week) => updateTrainingSessionPure(week, date, sessionId, patch));
}

/**
 * Applies a whole weekly template to `weekStart` from scratch -- discards
 * any prior EDITS for that week (Part 17: "apply a template" is a
 * deliberate reset, not a merge), but never touches a day that has
 * already executed (mirrors mapDay's own guard in trainingSchedule.ts):
 * re-generating an already-executed day's sessions would silently reset
 * its `executed` flag, and the next executeTrainingDay call would then
 * double-apply that day's physical load.
 */
export function applyWeeklyTemplateAction(state: CareerState, weekStart: string, template: Parameters<typeof buildTrainingWeek>[3]): CareerState {
  const freshWeek = buildTrainingWeek(weekStart, state.fixtures, state.playerClubId, template);
  const existingWeek = state.trainingWeeks[weekStart];
  const days = freshWeek.days.map((day) => {
    const existingDay = existingWeek?.days.find((d) => d.date === day.date);
    return existingDay?.executed ? existingDay : day;
  });
  return { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: { ...freshWeek, days, planning: { source: "MANAGER" } } } };
}
