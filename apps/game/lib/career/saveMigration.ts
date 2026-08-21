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

import { TUMBA_SQUAD } from "../game-data";
import { seedCareerTasks } from "./careerTasks";
import { seedPlayerStatuses } from "./playerStatus";
import type { CareerState } from "./types";

/** True for any CareerState written before HM-GAME-0.3 (career-state schema v2 or earlier). */
function needsCareerRhythmMigration(career: CareerState): boolean {
  return career.processedThroughDate === undefined;
}

/** Idempotent: already-migrated states pass through unchanged, field by field. */
export function migrateCareerState(career: CareerState): CareerState {
  let next = career;

  if (needsCareerRhythmMigration(next)) {
    const seasonStartDate = next.seasonStartDate ?? next.gameDate;
    next = {
      ...next,
      seasonStartDate,
      processedThroughDate: next.gameDate,
      careerEvents: next.careerEvents ?? [],
      // Pre-HM-DATA-0.2 saves were always IFK Tumba -- seed against its
      // known mock squad, matching this save's actual player identities.
      playerStatuses: next.playerStatuses ?? seedPlayerStatuses(seasonStartDate, TUMBA_SQUAD),
      tasks: next.tasks ?? seedCareerTasks(seasonStartDate),
    };
  }

  // HM-DATA-0.2 (career-state schema v4): additive, no other migration
  // needed -- a save with no worldSquads simply had none snapshotted
  // (pre-HM-DATA-0.2, or a club without real-world data at creation
  // time); career-aware readers fall back to the legacy mock squad.
  if (next.worldSquads === undefined) {
    next = { ...next, worldSquads: {} };
  }

  return next;
}
