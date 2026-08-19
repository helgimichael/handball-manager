// Daily World Tick (HM-GAME-0.3, Spec S5-S13).
//
// Processes exactly ONE calendar day in the fixed conceptual order the
// spec requires:
//   1. Date/Calendar   2. Player availability   3. Training/Recovery
//   4. Scouting/Analysis progress   5. Club/Competition world
//   6. Fixtures   7. Table/Statistics
//   8. Career Event generation   9. Inbox delivery   10. Continue stop check
//
// Steps 8+9 are folded into a single `emit()` gate used throughout (see
// below) rather than a separate pass, since every step above already
// knows exactly which event it produced. Step 10 (the stop check) is the
// Continue Controller's job (continueController.ts), not this module's --
// processDay only reports what happened; it never decides to keep going.

import {
  getPlayerFixtureOn,
  getNextPlayerFixture,
  checkSeasonComplete,
  simulateAiFixturesForDate,
} from "./calendar";
import {
  buildCompetitionUpdateEvent,
  buildMatchPreparationReadyEvent,
  buildMatchdayReadyEvent,
  buildOpponentReportReadyEvent,
  buildPlayerStatusChangedEvent,
  buildScoutReportReadyEvent,
  buildStaffReportEvent,
  buildTrainingCompletedEvent,
  buildTrainingReportEvent,
  type CareerEvent,
} from "./careerEvents";
import { ensureOpponentAnalysisTask, progressCareerTasks } from "./careerTasks";
import {
  MATCH_PREPARATION_OFFSET_DAYS,
  STAFF_REPORT_INTERVAL_DAYS,
  STAFF_REPORT_OFFSET_DAYS,
  TRAINING_REPORT_INTERVAL_DAYS,
} from "./careerRhythmConfig";
import { addDays, daysBetween, isSameOrBefore } from "./dateUtils";
import { careerEventToInboxMessage } from "./inboxBridge";
import type { CareerState } from "./types";

export interface DailyTickResult {
  state: CareerState;
  /** Every CareerEvent newly created (not deduplicated away) on this call, in generation order. */
  events: CareerEvent[];
}

/**
 * Processes `date`. Callers (continueController.ts) are responsible for
 * only ever calling this with `date === processedThroughDate + 1 day` --
 * that invariant, plus this function's own id-based dedup gate, is what
 * makes exactly-once processing hold (Spec S20/S27) even if a caller
 * accidentally reprocessed a date.
 */
export function processDay(state: CareerState, date: string): DailyTickResult {
  let next = state;
  const events: CareerEvent[] = [];

  function emit(candidate: CareerEvent): void {
    if (next.careerEvents.some((e) => e.id === candidate.id)) {
      return; // Idempotent: the same semantic event never duplicates (Spec S27).
    }
    next = { ...next, careerEvents: [...next.careerEvents, candidate] };
    events.push(candidate);
    if (candidate.type !== "TRAINING_COMPLETED") {
      next = { ...next, inbox: [...next.inbox, careerEventToInboxMessage(candidate)] };
    }
  }

  // --- 2. Player availability ---------------------------------------------
  for (const status of Object.values(next.playerStatuses)) {
    if (status.availability !== "AVAILABLE" && status.returnDate && isSameOrBefore(status.returnDate, date)) {
      next = {
        ...next,
        playerStatuses: { ...next.playerStatuses, [status.playerId]: { playerId: status.playerId, availability: "AVAILABLE" } },
      };
      emit(buildPlayerStatusChangedEvent(status.playerId, date, true));
    }
  }

  // --- 3. Training / Recovery ---------------------------------------------
  emit(buildTrainingCompletedEvent(date));
  const daysSinceStart = daysBetween(next.seasonStartDate, date);
  if (daysSinceStart > 0 && daysSinceStart % TRAINING_REPORT_INTERVAL_DAYS === 0) {
    emit(buildTrainingReportEvent(date));
  }
  if (daysSinceStart > 0 && daysSinceStart % STAFF_REPORT_INTERVAL_DAYS === STAFF_REPORT_OFFSET_DAYS) {
    emit(buildStaffReportEvent(date));
  }

  // --- 4. Scouting / Analysis progress ------------------------------------
  const upcomingFixture = getNextPlayerFixture(next);
  if (upcomingFixture) {
    const opponentClubId = upcomingFixture.homeClubId === next.playerClubId ? upcomingFixture.awayClubId : upcomingFixture.homeClubId;
    next = {
      ...next,
      tasks: ensureOpponentAnalysisTask(next.tasks, upcomingFixture.id, opponentClubId, upcomingFixture.date, date),
    };
  }
  const { tasks: progressedTasks, completed } = progressCareerTasks(next.tasks, date);
  next = { ...next, tasks: progressedTasks };
  for (const task of completed) {
    if (task.type === "SCOUTING") {
      emit(buildScoutReportReadyEvent(task.id, task.targetEntity.entityId, date));
    } else {
      emit(buildOpponentReportReadyEvent(task.id, task.targetEntity.entityId, date));
    }
  }

  // --- 5. Club / Competition world -- deliberately shallow in v0.1 (Spec S10).

  // --- 6. Fixtures ---------------------------------------------------------
  const playerFixtureToday = getPlayerFixtureOn(next, date);
  const { state: afterAi, results: aiResults } = simulateAiFixturesForDate(next, date);
  next = afterAi;
  if (playerFixtureToday) {
    emit(buildMatchdayReadyEvent(playerFixtureToday.id, date));
  }

  // Match preparation, a fixed number of days before an unplayed fixture
  // (Spec S17, provisional offset -- see careerRhythmConfig.ts). Never
  // fires ON the fixture's own date -- MATCHDAY_READY owns that date.
  if (upcomingFixture && upcomingFixture.date !== date) {
    const prepDate = addDays(upcomingFixture.date, -MATCH_PREPARATION_OFFSET_DAYS);
    if (prepDate === date) {
      emit(buildMatchPreparationReadyEvent(upcomingFixture.id, date));
    }
  }

  // --- 7. Table / Statistics ------------------------------------------------
  if (aiResults.length > 0) {
    emit(buildCompetitionUpdateEvent(date, next.competitionId));
  }

  // --- Season completion (only possible once the manager's own fixtures are also resolved -- see matchdayAction.ts) ---
  next = checkSeasonComplete(next);

  // --- 1. Date / Calendar (bookkeeping close-out) ---------------------------
  next = { ...next, gameDate: date, processedThroughDate: date };

  return { state: next, events };
}
