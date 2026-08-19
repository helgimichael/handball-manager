import { simulateFixture, type FastMatchResult } from "@handball-manager/game-simulation";
import { getClubStrength } from "../game-data/clubStrength";
import { buildTumbaMatchRoster } from "./tumbaRoster";
import { buildPostMatchMessage, buildPreMatchMessage, buildSeasonCompleteMessage } from "./inboxEvents";
import { applyMatchResultBookkeeping } from "./matchResultApplication";
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

/**
 * Simulates every fixture scheduled on `date` (not just the player's
 * own club's fixture -- the world moves around the manager, per the
 * HM-GAME-0.2A brief's Section 12) and returns a new CareerState with
 * results/standings-inputs/player-stats/form/inbox all updated.
 *
 * Idempotent by construction: a fixture already present in
 * `state.results` is skipped (never re-simulated), so calling this
 * twice for the same date is always safe -- the "no duplicate
 * simulation" regression this pass requires.
 */
function simulateMatchday(state: CareerState, date: string): { state: CareerState; results: FastMatchResult[] } {
  const dueFixtures = state.fixtures.filter((f) => f.date === date && !state.results[f.id]);
  if (dueFixtures.length === 0) {
    return { state, results: [] };
  }

  const results: Record<string, FastMatchResult> = { ...state.results };
  const playerSeasonStats: Record<string, PlayerSeasonStats> = { ...state.playerSeasonStats };
  const clubForm: Record<string, ClubFormEntry[]> = { ...state.clubForm };
  const newInboxMessages = [...state.inbox];
  const producedResults: FastMatchResult[] = [];
  const tumbaRoster = buildTumbaMatchRoster();

  for (const fixture of dueFixtures) {
    const isPlayerFixture = fixture.homeClubId === state.playerClubId || fixture.awayClubId === state.playerClubId;

    const result = simulateFixture(
      fixture,
      state.saveSeed,
      (clubId) => getClubStrength(clubId),
      isPlayerFixture
        ? (clubId) => (clubId === state.playerClubId ? tumbaRoster : undefined)
        : undefined,
    );
    results[fixture.id] = result;
    producedResults.push(result);

    applyMatchResultBookkeeping(result, clubForm, playerSeasonStats, state.playerClubId);

    if (isPlayerFixture) {
      // Both delivered together on the matchday CONTINUE, in reading
      // order: "today's the day" followed immediately by the result --
      // CONTINUE jumps straight to the next relevant date (per the
      // brief's preferred UX), so there is no separate "day before"
      // click to hang a standalone pre-match notice on.
      newInboxMessages.push(buildPreMatchMessage(fixture, state.playerClubId));
      newInboxMessages.push(buildPostMatchMessage(fixture, result, state.playerClubId));
    }
  }

  let nextState: CareerState = {
    ...state,
    gameDate: date,
    results,
    playerSeasonStats,
    clubForm,
    inbox: newInboxMessages,
  };

  const stillUnplayed = getUnplayedFixtures(nextState);
  if (stillUnplayed.length === 0) {
    const table = computeStandings(
      [...new Set(nextState.fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))],
      Object.values(nextState.results).map((r) => ({
        homeClubId: r.homeClubId,
        awayClubId: r.awayClubId,
        homeGoals: r.homeGoals,
        awayGoals: r.awayGoals,
      })),
    );
    const finalPosition = table.findIndex((row) => row.clubId === state.playerClubId) + 1;
    nextState = {
      ...nextState,
      seasonComplete: true,
      inbox: [...nextState.inbox, buildSeasonCompleteMessage(finalPosition, state.seasonId)],
    };
  }

  return { state: nextState, results: producedResults };
}

export type AdvanceResult = {
  state: CareerState;
  simulatedResults: FastMatchResult[];
  /** True if the advance landed on and simulated the player's own fixture. */
  playerMatchdayReached: boolean;
};

/**
 * The CONTINUE action: advances the calendar to the next relevant
 * event date (skipping quiet days in one jump, per the brief's
 * preferred UX -- the date model itself still moves in real day
 * increments internally via each fixture's own stored date, nothing is
 * faked), simulates every fixture due that date, and returns the
 * updated state. If the season is already complete, this is a no-op.
 */
export function advanceToNextEvent(state: CareerState): AdvanceResult {
  if (state.seasonComplete) {
    return { state, simulatedResults: [], playerMatchdayReached: false };
  }

  const nextDate = getNextEventDate(state);
  if (!nextDate) {
    return { state, simulatedResults: [], playerMatchdayReached: false };
  }

  const { state: nextState, results } = simulateMatchday(state, nextDate);
  const playerMatchdayReached = results.some(
    (r) => r.homeClubId === state.playerClubId || r.awayClubId === state.playerClubId,
  );

  return { state: nextState, simulatedResults: results, playerMatchdayReached };
}

/** Debug-only utility (not exposed in normal player-facing UX) to fast-forward an entire season for QA. */
export function simulateEntireSeason(state: CareerState): CareerState {
  let current = state;
  let guard = 0;
  while (!current.seasonComplete && guard < 400) {
    current = advanceToNextEvent(current).state;
    guard += 1;
  }
  return current;
}

// ---------------------------------------------------------------------------
// HM-GAME-0.3 Career Rhythm additions -- used by dailyTick.ts/matchdayAction.ts.
// The functions above (simulateMatchday/advanceToNextEvent/simulateEntireSeason)
// are untouched legacy/debug utilities kept for QA fast-forwarding; normal
// play now goes through the Daily World Tick + Continue Controller instead.
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
    const result = simulateFixture(fixture, state.saveSeed, (clubId) => getClubStrength(clubId));
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
    inbox: [...state.inbox, buildSeasonCompleteMessage(finalPosition, state.seasonId)],
  };
}

export { averageRating };
