// CareerState schema migration (HM-GAME-0.3, Spec S25).
//
// HM-GAME-0.2A saves ("career-state schema v2") have no Career Rhythm
// fields at all. Loading one must not crash and must not replay/duplicate
// prior world ticks or Inbox events (Spec S25/S37.10). A v2 save's
// `gameDate` was always the last date `advanceToNextEvent` fully
// resolved (the old jump model never left a day partially processed), so
// it is safe -- and correct -- to treat it as already fully processed:
// `processedThroughDate` backfills to `gameDate` itself, not a day
// earlier, otherwise the next CONTINUE would silently reprocess a date
// the old system already simulated.

import { seedCareerTasks } from "./careerTasks";
import { seedPlayerStatuses } from "./playerStatus";
import type { CareerState } from "./types";

/** True for any CareerState written before HM-GAME-0.3 (career-state schema v2 or earlier). */
function needsCareerRhythmMigration(career: CareerState): boolean {
  return career.processedThroughDate === undefined;
}

/** Idempotent: already-migrated (schema v3) states pass through unchanged. */
export function migrateCareerState(career: CareerState): CareerState {
  if (!needsCareerRhythmMigration(career)) {
    return career;
  }
  const seasonStartDate = career.seasonStartDate ?? career.gameDate;
  return {
    ...career,
    seasonStartDate,
    processedThroughDate: career.gameDate,
    careerEvents: career.careerEvents ?? [],
    playerStatuses: career.playerStatuses ?? seedPlayerStatuses(seasonStartDate),
    tasks: career.tasks ?? seedCareerTasks(seasonStartDate),
  };
}
