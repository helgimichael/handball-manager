// Scheduled Career Task abstraction (HM-GAME-0.3, Spec S16).
//
// A minimal scheduled-task model: a task has a start date, a completion
// date, a target entity and a status. Completion is driven by date
// arithmetic against a task-specific completion date, never a hardcoded
// weekday (Spec S9/S16). This is deliberately not a scouting/analysis
// simulation -- v0.1 only proves that a task can progress and complete.

import { getScoutedPlayers } from "../game-data";
import { addDays, isSameOrBefore } from "./dateUtils";
import { OPPONENT_ANALYSIS_LEAD_DAYS, SCOUT_TASK_DURATION_DAYS } from "./careerRhythmConfig";
import type { EntityRef } from "./careerEvents";

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

/** Seeds the one scouting task HM-GAME-0.3 v0.1 needs to prove SCOUT_REPORT_READY. */
export function seedCareerTasks(seasonStartDate: string): CareerTask[] {
  const scouted = getScoutedPlayers();
  if (scouted.length === 0) {
    return [];
  }
  const target = scouted[1] ?? scouted[0];
  return [
    {
      id: `task:SCOUTING:${target.id}`,
      type: "SCOUTING",
      targetEntity: { entityType: "player", entityId: target.id },
      startDate: seasonStartDate,
      completionDate: addDays(seasonStartDate, SCOUT_TASK_DURATION_DAYS),
      status: "IN_PROGRESS",
    },
  ];
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
