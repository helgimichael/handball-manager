// Scheduled Career Task abstraction (HM-GAME-0.3, Spec S16).
//
// A minimal scheduled-task model: a task has a start date, a completion
// date, a target entity and a status. Completion is driven by date
// arithmetic against a task-specific completion date, never a hardcoded
// weekday (Spec S9/S16). This is deliberately not a scouting/analysis
// simulation -- v0.1 only proves that a task can progress and complete.

import { addDays, isSameOrBefore } from "./dateUtils";
import { OPPONENT_ANALYSIS_LEAD_DAYS } from "./careerRhythmConfig";
import type { EntityRef } from "./careerEvents";

/**
 * HM-SCOUTING-1.0: the "SCOUTING" task type is now legacy/unreachable --
 * seedCareerTasks below no longer creates one (it seeded a single fake
 * demo task against lib/game-data/scouting.ts's hardcoded fictional
 * SCOUTED_PLAYERS array, "just proving SCOUT_REPORT_READY can fire").
 * Real player scouting is now lib/career/scouting.ts's own
 * ScoutingAssignment/ScoutReport system, driven by real assigned staff
 * and real CareerState-resident knowledge -- see that module's own
 * header. This type is left as-is (not removed) purely so
 * `progressCareerTasks`'s existing branch structure, which
 * OPPONENT_ANALYSIS still genuinely uses, needs no restructuring.
 */
export type CareerTaskType = "SCOUTING" | "OPPONENT_ANALYSIS";
export type CareerTaskStatus = "IN_PROGRESS" | "COMPLETED";

export interface CareerTask {
  id: string;
  type: CareerTaskType;
  targetEntity: EntityRef;
  startDate: string;
  completionDate: string;
  status: CareerTaskStatus;
}

/**
 * HM-SCOUTING-1.0: no longer seeds a fake SCOUTING demo task (see this
 * module's own header) -- a fresh career now starts with an empty task
 * list; OPPONENT_ANALYSIS tasks are still created dynamically, one per
 * upcoming fixture, via ensureOpponentAnalysisTask below.
 */
export function seedCareerTasks(_seasonStartDate: string): CareerTask[] {
  return [];
}

/** Ensures exactly one active OPPONENT_ANALYSIS task exists for a given upcoming fixture, keyed by fixture id (idempotent). */
export function ensureOpponentAnalysisTask(
  tasks: readonly CareerTask[],
  fixtureId: string,
  opponentClubId: string,
  fixtureDate: string,
  today: string,
): CareerTask[] {
  const id = `task:OPPONENT_ANALYSIS:${fixtureId}`;
  if (tasks.some((t) => t.id === id)) {
    return [...tasks];
  }
  const desiredCompletion = addDays(fixtureDate, -OPPONENT_ANALYSIS_LEAD_DAYS);
  const completionDate = isSameOrBefore(desiredCompletion, today) ? today : desiredCompletion;
  const task: CareerTask = {
    id,
    type: "OPPONENT_ANALYSIS",
    targetEntity: { entityType: "club", entityId: opponentClubId },
    startDate: today,
    completionDate,
    status: "IN_PROGRESS",
  };
  return [...tasks, task];
}

/** Marks any task whose completionDate has arrived as COMPLETED, returning the updated list and the tasks that completed on this call. */
export function progressCareerTasks(tasks: readonly CareerTask[], date: string): { tasks: CareerTask[]; completed: CareerTask[] } {
  const completed: CareerTask[] = [];
  const next = tasks.map((task) => {
    if (task.status === "IN_PROGRESS" && isSameOrBefore(task.completionDate, date)) {
      const updated: CareerTask = { ...task, status: "COMPLETED" };
      completed.push(updated);
      return updated;
    }
    return task;
  });
  return { tasks: next, completed };
}
