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

import { TUMBA_SQUAD, type InboxCategory, type InboxMessage } from "../game-data";
import { seedCareerTasks } from "./careerTasks";
import { seedPlayerStatuses } from "./playerStatus";
import type { CareerState } from "./types";

// HM-GAME-0.4: InboxMessage.category was a set of Swedish string
// literals before this milestone (Spec §33: "map existing categories
// safely"). Best-effort mapping onto the new English category model --
// old messages don't need to be retroactively perfect, just valid.
const LEGACY_CATEGORY_MAP: Record<string, InboxCategory> = {
  "Assisterande tränare": "STAFF",
  Match: "MATCH",
  Träning: "STAFF",
  Spelare: "PLAYER",
  Scouting: "SCOUTING",
  Styrelse: "CLUB",
  Kontrakt: "CLUB",
};

function migrateInboxMessage(message: InboxMessage, careerEvents: CareerState["careerEvents"]): InboxMessage {
  let next = message;
  if (!(next.category in ({ MATCH: 1, ANALYSIS: 1, SCOUTING: 1, STAFF: 1, MEDICAL: 1, PLAYER: 1, COMPETITION: 1, CLUB: 1, SYSTEM: 1 } satisfies Record<InboxCategory, 1>))) {
    next = { ...next, category: LEGACY_CATEGORY_MAP[next.category] ?? "SYSTEM" };
  }
  if (next.archived === undefined) {
    next = { ...next, archived: false };
  }
  if (next.resolved === undefined) {
    const linkedEvent = next.careerEventId ? careerEvents.find((e) => e.id === next.careerEventId) : undefined;
    next = { ...next, resolved: linkedEvent ? linkedEvent.resolved : true };
  }
  return next;
}

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

  // HM-GAME-0.4: additive InboxMessage fields (archived/resolved) and
  // the new category model -- never invalidates an old career merely
  // because Inbox improved (Spec §33). Idempotent: migrateInboxMessage
  // is a no-op for any message that already has both fields and a
  // current-model category.
  const needsInboxMigration = next.inbox.some(
    (m) => m.archived === undefined || m.resolved === undefined || !(m.category in ({ MATCH: 1, ANALYSIS: 1, SCOUTING: 1, STAFF: 1, MEDICAL: 1, PLAYER: 1, COMPETITION: 1, CLUB: 1, SYSTEM: 1 } satisfies Record<InboxCategory, 1>)),
  );
  if (needsInboxMigration) {
    next = { ...next, inbox: next.inbox.map((m) => migrateInboxMessage(m, next.careerEvents)) };
  }

  return next;
}
