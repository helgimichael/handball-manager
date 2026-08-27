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
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import { ensureCareerPlayerContracts, recalibratePlayerContractEndDates, recalibratePlayerContractWages } from "../economy/contractIntegration";
import { ensureCareerPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { ensureCareerAllClubEconomies } from "../economy/clubEconomyIntegration";
import { ensureCareerPlayerSquadStatus } from "./squadStatus";
import { getCareerClubSquad } from "./careerWorld";
import { EUR_TO_SEK_REFERENCE_RATE } from "../economy/currency";
import type { PlayerContract } from "../economy/types";

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

  // HM-TRAINING-1.1 (career-state schema v16): additive, same pattern as
  // playerPhysicalState -- an existing career simply never had any
  // accumulated development stimulus yet; every reader
  // (resolveWeeklyDevelopmentIfDue, the Training/Profile UI) already
  // treats a missing entry as "nothing accumulated, nothing to show", so
  // an empty object here changes nothing observable for old saves.
  if (next.playerDevelopmentState === undefined) {
    next = { ...next, playerDevelopmentState: {} };
  }

  // HM-STAFF-1.0 (career-state schema v17): additive -- an existing
  // career simply never had a staff roster resolved yet. Deliberately
  // migrated to an EMPTY roster, never regenerated on load: staff
  // (unlike trainingWeeks) is snapshotted once at creation, not resolved
  // on demand, so retroactively generating one here would silently
  // invent staff for an old save that never had any -- every reader
  // (resolveResponsibleCoach, the Staff/Training UI) already treats an
  // empty roster as "no eligible staff, use the neutral quality
  // multiplier" (Part 9), never crashing.
  if (next.staffRoster === undefined) {
    next = { ...next, staffRoster: {} };
  }
  if (next.staffEmployment === undefined) {
    next = { ...next, staffEmployment: {} };
  }

  // HM-RATINGS-CAREER-1.0 (career-state schema v18): additive
  // NORMALIZATION, not a new field -- an existing career (any schema
  // version, including a v17 save whose club never had ANY
  // gameplayRatings, e.g. every pre-this-milestone mock/Tumba career)
  // may be missing a rating for some or all of its own roster players.
  // ensureCareerGameplayRatings only ever ADDS a missing player's own
  // generated fallback rating -- an existing evidence-backed OR already-
  // developed entry is never touched, never regenerated (Part 22: "do
  // not wipe existing ratings... do not regenerate evidence-backed
  // profiles"). Idempotent (Part 23), so running it on an already-
  // complete save is a real no-op (returns the same object reference).
  next = ensureCareerGameplayRatings(next, next.playerClubId);

  // HM-INJURIES-1.0 (career-state schema v19): additive -- an existing
  // career simply never had an injury/rehab thread yet. Migrated to an
  // EMPTY map, never retroactively injuring anyone -- every reader
  // (isSelectableForMatch, effectiveTrainingLoadSetting, the Squad/
  // Profile/Medical UI) already treats a missing entry as "healthy, no
  // history", so this changes nothing observable for an old save beyond
  // making the new system available going forward.
  if (next.playerInjuries === undefined) {
    next = { ...next, playerInjuries: {} };
  }

  // HM-PRESEASON-1.0 (career-state schema v20): additive --
  // 1. every existing fixture predates the LEAGUE/CUP/FRIENDLY
  //    distinction; every one of them WAS a league fixture (this concept
  //    didn't exist before), so backfilling `type: "LEAGUE"` is not a
  //    guess, it's the only value that was ever true for them.
  // 2. `leagueKickoffDate` is set equal to the existing `gameDate` used
  //    to be treated as season-start -- so `getSeasonPhase` resolves
  //    COMPETITIVE_SEASON immediately for an old save (Part: "byte-
  //    identical to this concept not existing yet"), never retroactively
  //    placing an in-progress old career into a preseason it never had.
  if (next.fixtures.some((f) => f.type === undefined)) {
    next = { ...next, fixtures: next.fixtures.map((f) => (f.type === undefined ? { ...f, type: "LEAGUE" as const } : f)) };
  }
  if (next.leagueKickoffDate === undefined) {
    next = { ...next, leagueKickoffDate: next.gameDate };
  }

  // HM-CONTRACTS-1.0 (career-state schema v21): additive -- an existing
  // career simply never had a persistent contract for some or all of its
  // own roster players. Same normalization pattern as
  // ensureCareerGameplayRatings (v18): only ADDS a missing player's own
  // generated contract, never touches/rerolls an existing one, true
  // no-op once complete. Runs unconditionally (idempotent) so it also
  // catches a v18-era save whose players already had ratings but
  // predates this milestone entirely.
  if (next.playerContracts === undefined) {
    next = { ...next, playerContracts: {} };
  }

  // HM-CONTRACTS-1.0A (career-state schema v22, part 1/2): CURRENCY
  // MIGRATION -- an HM-CONTRACTS-1.0-era save's own `playerContracts`
  // entries still carry the original `wageSekPerMonth` field (SEK). EUR
  // is now canonical (lib/economy/currency.ts), so every such entry is
  // converted ONCE here (never re-converted -- gated on the OLD field's
  // presence, so re-running this migration on an already-converted save
  // is a true no-op) using the same fixed reference rate the currency
  // module documents. This is a real unit conversion, NOT a bare field
  // rename -- treating an old SEK number as if it were already EUR would
  // silently overvalue every migrated player's wage ~11x.
  const legacyContracts = Object.values(next.playerContracts) as unknown as Array<PlayerContract & { wageSekPerMonth?: number }>;
  if (legacyContracts.some((c) => c.wageSekPerMonth !== undefined && (c as { wageEurPerMonth?: number }).wageEurPerMonth === undefined)) {
    const convertedContracts: Record<string, PlayerContract> = {};
    for (const [playerId, contract] of Object.entries(next.playerContracts)) {
      const legacy = contract as PlayerContract & { wageSekPerMonth?: number };
      if (legacy.wageSekPerMonth !== undefined) {
        const { wageSekPerMonth, ...rest } = legacy;
        convertedContracts[playerId] = { ...rest, wageEurPerMonth: Math.round(wageSekPerMonth / EUR_TO_SEK_REFERENCE_RATE) };
      } else {
        convertedContracts[playerId] = contract;
      }
    }
    next = { ...next, playerContracts: convertedContracts };
  }

  next = ensureCareerPlayerContracts(next, next.playerClubId);

  // HM-WAGE-MARKET-1.0: recalibrate every EXISTING contract's own wage
  // against the current salary formula -- Economy 1.0's own calibration
  // report proved the pre-recalibration wage scale was not compatible
  // with real club purchasing power (9/14 real Handbollsligan clubs
  // CRITICAL/SERIOUS purely from this mismatch). Naturally idempotent
  // (see recalibratePlayerContractWages's own doc), so -- like
  // ensureCareerGameplayRatings/ensureCareerPlayerContracts above -- it
  // is safe to run unconditionally on every migration, never only once.
  next = recalibratePlayerContractWages(next);

  // HM-DATA-ALLSVENSKAN-1.1B: recalibrate every EXISTING contract's own
  // end date onto Swedish handball's normal 1 June -> 31 May
  // contract-year logic -- see recalibratePlayerContractEndDates' own
  // doc. Naturally idempotent, safe unconditionally on every migration,
  // same precedent as the wage recalibration immediately above.
  next = recalibratePlayerContractEndDates(next);

  // HM-CONTRACTS-1.0A (career-state schema v22, part 2/2): additive --
  // an existing career simply never had a club/youth history for some or
  // all of its own roster players. Same normalization pattern as
  // ensureCareerPlayerContracts.
  if (next.playerClubHistory === undefined) {
    next = { ...next, playerClubHistory: {} };
  }
  next = ensureCareerPlayerClubHistory(next, next.playerClubId);

  // HM-ECONOMY-1.0 (career-state schema v23): additive -- an existing
  // career simply never had a club economy baseline for any club yet.
  // Same normalization pattern as ensureCareerPlayerContracts:
  // ensureCareerAllClubEconomies only ever ADDS a missing club's own
  // generated baseline (and, internally, fills any of THAT club's own
  // missing ratings/contracts so its derived costs are real), never
  // touches/rerolls an existing one, true no-op once every career club
  // is complete.
  if (next.clubEconomies === undefined) {
    next = { ...next, clubEconomies: {} };
  }
  next = ensureCareerAllClubEconomies(next);

  // HM-TRANSFERS-1.0 (career-state schema v24): additive -- an existing
  // career simply never had a transfer/loan thread yet. Migrated to
  // EMPTY maps, never retroactively inventing a negotiation history --
  // every reader already treats a missing entry as "no offers/loans
  // yet", exactly the state a save always implicitly had before this
  // milestone.
  if (next.transferOffers === undefined) {
    next = { ...next, transferOffers: {} };
  }
  if (next.loans === undefined) {
    next = { ...next, loans: {} };
  }

  // HM-DATA-ALLSVENSKAN-1.1B (career-state schema v25): additive -- an
  // existing career simply never had a persistent squad-status tier for
  // some or all of its own roster players. Same "only fill what's
  // missing" normalization pattern as ensureCareerPlayerContracts --
  // never overwrites a manager's own already-persisted edit.
  if (next.playerSquadStatus === undefined) {
    next = { ...next, playerSquadStatus: {} };
  }
  next = ensureCareerPlayerSquadStatus(next, next.playerClubId, getCareerClubSquad(next, next.playerClubId));

  // HM-DATA-ALLSVENSKAN-1.1B Parts 11/12/13: additive -- an existing
  // career simply never had a knowledge map yet. Migrated to EMPTY maps,
  // never retroactively inventing a familiarity history -- every reader
  // already treats a missing entry as DEFAULT_EXTERNAL_KNOWLEDGE_PCT
  // (or 100 for the manager's own club/players), exactly the state a
  // save always implicitly had before this milestone.
  if (next.clubKnowledge === undefined) {
    next = { ...next, clubKnowledge: {} };
  }
  if (next.playerKnowledge === undefined) {
    next = { ...next, playerKnowledge: {} };
  }

  // HM-STAFF-CAREER-1.0 (career-state schema v26): additive -- an
  // existing career simply never had a career-tracked staff club-history
  // thread yet (no one had ever changed clubs via recruitment before
  // this milestone existed). Migrated to an EMPTY map, never inventing a
  // move history -- every reader already treats a missing entry as "no
  // tracked moves", exactly the state a save always implicitly had.
  // The whole-competition staffRoster/staffEmployment top-up itself
  // (an existing save only ever had its own club's roster) needs an
  // async fetch and so happens in CareerContext.tsx's own
  // getOrCreateCareerState, not here -- see its own doc for why.
  if (next.staffClubHistory === undefined) {
    next = { ...next, staffClubHistory: {} };
  }

  return next;
}
