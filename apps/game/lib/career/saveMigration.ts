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
import { defaultTeamTacticalProfile } from "./teamTacticalProfile";
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

  // HM-TACTICS-0.6A (career-state schema v6): additive. An existing
  // career simply never had a tactical profile to change -- it gets the
  // same deterministic default a brand-new career would, never an
  // invented/random one.
  if (next.tacticalProfile === undefined) {
    next = { ...next, tacticalProfile: defaultTeamTacticalProfile() };
  }

  // HM-IDENTITY-0.3 (career-state schema v7): additive, same pattern as
  // worldSquads -- an existing career simply never had an AI tactical
  // preference snapshot; matchdayAction.ts's own NEUTRAL-opponent
  // fallback already handles a missing entry safely, so an empty object
  // here changes nothing about the resulting match simulation for old saves.
  if (next.aiTacticalPreferences === undefined) {
    next = { ...next, aiTacticalPreferences: {} };
  }

  // HM-TACTICS-1.1 (career-state schema v8): additive -- an existing
  // career simply never had a saved MatchPlan for any fixture yet; the
  // Tactics workspace already treats a missing entry as "build the
  // deterministic default on the fly", so an empty object here changes
  // nothing observable for old saves.
  if (next.matchPlans === undefined) {
    next = { ...next, matchPlans: {} };
  }

  // HM-MATCH-RATINGS-0.1 (career-state schema v9): additive, same
  // pattern as worldSquads/aiTacticalPreferences -- an existing career
  // simply never had a canonical gameplay-ratings snapshot;
  // playerMatchStrength.ts already treats a missing rating as neutral
  // (no effect), so an empty object here changes nothing observable
  // beyond what this milestone itself introduces for old saves.
  if (next.gameplayRatings === undefined) {
    next = { ...next, gameplayRatings: {} };
  }

  // HM-COACHING-1.0 (career-state schema v10): additive -- an existing
  // career simply never had a live-match coaching change; every reader
  // (resolveCurrentMatchPlan, the Live Match change-history panel)
  // already treats a missing entry as "no live change yet, fall back to
  // the saved pre-match plan / show an empty history", so empty objects
  // here change nothing observable for old saves.
  if (next.liveMatchPlans === undefined) {
    next = { ...next, liveMatchPlans: {} };
  }
  if (next.matchPlanChangeHistory === undefined) {
    next = { ...next, matchPlanChangeHistory: {} };
  }

  // HM-MATCH-1.1 (career-state schema v11): additive -- an existing
  // career simply never had a persistent Tactics/player-default template
  // yet; every reader (buildDefaultMatchPlan's own optional params, the
  // Tactics workspace) already treats a missing entry as "fall back to
  // the same hardcoded neutral defaults this game always used", so empty
  // objects here change nothing observable for old saves.
  if (next.tactics === undefined) {
    next = { ...next, tactics: {} };
  }
  if (next.playerMatchDefaults === undefined) {
    next = { ...next, playerMatchDefaults: {} };
  }

  // HM-MATCH-1.2 (career-state schema v12): additive -- an existing
  // career simply never had a Specialspel plan yet; every reader
  // (defaultSpecialPlayPlan's own fallback) already treats a missing
  // entry as "use the neutral default", so an empty object here changes
  // nothing observable for old saves.
  if (next.specialPlay === undefined) {
    next = { ...next, specialPlay: {} };
  }

  // HM-MATCH-1.3A (career-state schema v13): additive -- an existing
  // career simply never had a persistent live-match session; every
  // reader already treats `null` as "no match currently in progress",
  // exactly the state a save always implicitly had before this
  // milestone (a save could never previously have been mid-match, since
  // nothing about a live match was persisted at all).
  if (next.activeMatchSession === undefined) {
    next = { ...next, activeMatchSession: null };
  }

  // HM-PHYSICAL-1.0 (career-state schema v14): additive, same pattern as
  // `results` -- an existing career simply never had a physical report
  // for any played fixture yet; every reader already treats a missing
  // entry as "no energy data available" (Match Report simply omits the
  // section), so an empty object here changes nothing observable for
  // old saves.
  if (next.physicalReports === undefined) {
    next = { ...next, physicalReports: {} };
  }

  // HM-TRAINING-1.0 (career-state schema v15): additive, same pattern as
  // `physicalReports` -- an existing career simply never had a training
  // schedule or persistent player physical/readiness state yet. Every
  // reader already treats a missing entry as "resolve/generate on
  // demand" (trainingWeeks) or "neutral starting energy, exactly like
  // before this milestone" (playerPhysicalState/playerTrainingAssignments),
  // so empty objects here change nothing observable for old saves.
  if (next.trainingWeeks === undefined) {
    next = { ...next, trainingWeeks: {} };
  }
  if (next.playerPhysicalState === undefined) {
    next = { ...next, playerPhysicalState: {} };
  }
  if (next.playerTrainingAssignments === undefined) {
    next = { ...next, playerTrainingAssignments: {} };
  }

  return next;
}
