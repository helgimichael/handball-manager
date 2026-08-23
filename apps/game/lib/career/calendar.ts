import { simulateFixture, type FastMatchResult } from "@handball-manager/game-simulation";
import { getClubStrength } from "../game-data/clubStrength";
import { getCareerClubSquad } from "./careerWorld";
import { buildSeasonCompleteMessage } from "./inboxEvents";
import { applyMatchResultBookkeeping } from "./matchResultApplication";
import { computePlayerMatchStrengthAdjustment, resolveClubMatchPlanForFixture } from "./playerMatchStrength";
import { computeAiVsAiTacticalAdjustment } from "./tacticalMatchAdjustment";
import { averageRating, type CareerFixture, type CareerState, type ClubFormEntry, type PlayerSeasonStats } from "./types";
import { computeStandings } from "@handball-manager/game-simulation";

export function getUnplayedFixtures(state: CareerState): readonly CareerFixture[] {
  return state.fixtures.filter((f) => !state.results[f.id]);
}

/** Earliest date among fixtures without a stored result, or null once the season is complete. */
export function getNextEventDate(state: CareerState): string | null {
  const unplayed = getUnplayedFixtures(state);
  if (unplayed.length === 0) {
    return null;
  }
  return unplayed.reduce((earliest, f) => (f.date < earliest ? f.date : earliest), unplayed[0].date);
}

export function getNextPlayerFixture(state: CareerState): CareerFixture | undefined {
  return getUnplayedFixtures(state)
    .filter((f) => f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId)
    .sort((a, b) => (a.date < b.date ? -1 : 1))[0];
}

export function getLastPlayedPlayerFixture(state: CareerState): { fixture: CareerFixture; result: FastMatchResult } | undefined {
  const played = state.fixtures
    .filter((f) => (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId) && state.results[f.id])
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const fixture = played[0];
  if (!fixture) {
    return undefined;
  }
  return { fixture, result: state.results[fixture.id] };
}

// ---------------------------------------------------------------------------
// HM-GAME-0.3 Career Rhythm -- used by dailyTick.ts/matchdayAction.ts.
// (HM-GAME-0.4: this module previously also carried three pre-Career-
// Rhythm debug utilities -- simulateMatchday/advanceToNextEvent/
// simulateEntireSeason -- confirmed unreachable from any live code path
// or test, and still referencing the pre-HM-GAME-0.4 Inbox category
// model. Removed as dead code rather than patched to compile against
// the new InboxCategory type; normal play has gone through the Daily
// World Tick + Continue Controller since HM-GAME-0.3.)
// ---------------------------------------------------------------------------

/** The manager club's own unplayed fixture on `date`, if any -- the MATCHDAY_READY trigger condition (Spec S11.2). */
export function getPlayerFixtureOn(state: CareerState, date: string): CareerFixture | undefined {
  return state.fixtures.find(
    (f) => f.date === date && !state.results[f.id] && (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId),
  );
}

/**
 * Simulates every fixture due on `date` that does NOT involve the
 * manager's own club (Spec S11.1/S12: other clubs may be processed by
 * ordinary Continue; the manager's own fixture must not be). Idempotent
 * for the same reason simulateMatchday is: already-resulted fixtures are
 * skipped.
 */
export function simulateAiFixturesForDate(state: CareerState, date: string): { state: CareerState; results: FastMatchResult[] } {
  const dueFixtures = state.fixtures.filter(
    (f) => f.date === date && !state.results[f.id] && f.homeClubId !== state.playerClubId && f.awayClubId !== state.playerClubId,
  );
  if (dueFixtures.length === 0) {
    return { state, results: [] };
  }

  const results: Record<string, FastMatchResult> = { ...state.results };
  const clubForm: Record<string, ClubFormEntry[]> = { ...state.clubForm };
  const playerSeasonStats: Record<string, PlayerSeasonStats> = { ...state.playerSeasonStats };
  const produced: FastMatchResult[] = [];

  for (const fixture of dueFixtures) {
    // HM-TACTICS-0.10: both clubs' own AI-derived tactical identity
    // (HM-IDENTITY-0.3) now shapes this fixture symmetrically, through
    // the SAME approved tactical-adjustment mechanism the manager's own
    // fixture already uses -- see computeAiVsAiTacticalAdjustment's own
    // doc for the exact home/away mapping. Returns undefined (no
    // adjustment argument at all, byte-identical to pre-HM-TACTICS-0.10
    // behavior) when neither club has real identity data.
    const adjustment = computeAiVsAiTacticalAdjustment(state.saveSeed, fixture.id, fixture.homeClubId, fixture.awayClubId, state.aiTacticalPreferences);

    // HM-MATCH-RATINGS-0.1 Part O: AI-vs-AI fixtures gain the same
    // player-strength influence as the manager's own fixture, using a
    // deterministic default MatchPlan for BOTH clubs (no AI MatchPlan
    // "coaching" -- just the same default-plan helper any fixture
    // without a saved plan already gets). A club with no snapshotted
    // squad (e.g. non-Tumba Allsvenskan mocks) resolves to a neutral,
    // zero-effect side, exactly as before this milestone.
    const homePlan = resolveClubMatchPlanForFixture(fixture.homeClubId, fixture.id, getCareerClubSquad(state, fixture.homeClubId), undefined);
    const awayPlan = resolveClubMatchPlanForFixture(fixture.awayClubId, fixture.id, getCareerClubSquad(state, fixture.awayClubId), undefined);
    const playerStrength = computePlayerMatchStrengthAdjustment(
      homePlan,
      state.gameplayRatings[fixture.homeClubId] ?? [],
      awayPlan,
      state.gameplayRatings[fixture.awayClubId] ?? [],
      `${state.saveSeed}:${fixture.id}`,
    );

    const combinedAdjustment = {
      home: (adjustment?.home ?? 0) + playerStrength.home,
      away: (adjustment?.away ?? 0) + playerStrength.away,
    };
    const result = simulateFixture(
      fixture,
      state.saveSeed,
      (clubId) => getClubStrength(clubId),
      undefined,
      combinedAdjustment,
    );
    results[fixture.id] = result;
    produced.push(result);
    applyMatchResultBookkeeping(result, clubForm, playerSeasonStats, state.playerClubId);
  }

  return { state: { ...state, results, clubForm, playerSeasonStats }, results: produced };
}

/**
 * Sets `seasonComplete` and appends the season-complete inbox message the
 * first time every fixture (including, now, the manager's own -- see
 * matchdayAction.ts) has a stored result. Idempotent/no-op once already
 * complete or while fixtures remain.
 */
export function checkSeasonComplete(state: CareerState): CareerState {
  if (state.seasonComplete || getUnplayedFixtures(state).length > 0) {
    return state;
  }
  const table = computeStandings(
    [...new Set(state.fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))],
    Object.values(state.results).map((r) => ({
      homeClubId: r.homeClubId,
      awayClubId: r.awayClubId,
      homeGoals: r.homeGoals,
      awayGoals: r.awayGoals,
    })),
  );
  const finalPosition = table.findIndex((row) => row.clubId === state.playerClubId) + 1;
  return {
    ...state,
    seasonComplete: true,
    inbox: [...state.inbox, buildSeasonCompleteMessage(finalPosition, state.seasonId, state.competitionId)],
  };
}

export { averageRating };
