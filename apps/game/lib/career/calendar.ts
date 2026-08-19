import { simulateFixture, type FastMatchResult } from "@handball-manager/game-simulation";
import { getClubStrength } from "../game-data/clubStrength";
import { buildTumbaMatchRoster } from "./tumbaRoster";
import { buildPostMatchMessage, buildPreMatchMessage, buildSeasonCompleteMessage } from "./inboxEvents";
import { averageRating, emptyPlayerSeasonStats, type CareerFixture, type CareerState, type ClubFormEntry, type PlayerSeasonStats } from "./types";
import { computeStandings } from "@handball-manager/game-simulation";

const FORM_HISTORY_LENGTH = 5;

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

function pushForm(existing: readonly ClubFormEntry[] | undefined, entry: ClubFormEntry): ClubFormEntry[] {
  const next = [...(existing ?? []), entry];
  return next.slice(Math.max(0, next.length - FORM_HISTORY_LENGTH));
}

function applyPlayerContribution(
  stats: Record<string, PlayerSeasonStats>,
  playerId: string,
  goals: number,
  shots: number,
  rating: number,
  started: boolean,
  saves?: number,
  shotsFaced?: number,
): void {
  const current = stats[playerId] ?? emptyPlayerSeasonStats(playerId);
  stats[playerId] = {
    playerId,
    appearances: current.appearances + 1,
    starts: current.starts + (started ? 1 : 0),
    goals: current.goals + goals,
    shots: current.shots + shots,
    saves: current.saves + (saves ?? 0),
    shotsFaced: current.shotsFaced + (shotsFaced ?? 0),
    ratingSum: current.ratingSum + rating,
  };
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

    // Club form for both sides.
    const homeEntry: ClubFormEntry = result.homeGoals > result.awayGoals ? "W" : result.homeGoals < result.awayGoals ? "L" : "D";
    const awayEntry: ClubFormEntry = result.awayGoals > result.homeGoals ? "W" : result.awayGoals < result.homeGoals ? "L" : "D";
    clubForm[fixture.homeClubId] = pushForm(clubForm[fixture.homeClubId], homeEntry);
    clubForm[fixture.awayClubId] = pushForm(clubForm[fixture.awayClubId], awayEntry);

    if (isPlayerFixture) {
      // Both delivered together on the matchday CONTINUE, in reading
      // order: "today's the day" followed immediately by the result --
      // CONTINUE jumps straight to the next relevant date (per the
      // brief's preferred UX), so there is no separate "day before"
      // click to hang a standalone pre-match notice on.
      newInboxMessages.push(buildPreMatchMessage(fixture, state.playerClubId));
      newInboxMessages.push(buildPostMatchMessage(fixture, result, state.playerClubId));

      const isHome = fixture.homeClubId === state.playerClubId;
      const contributions = isHome ? result.homePlayerContributions : result.awayPlayerContributions;
      for (const contribution of contributions) {
        applyPlayerContribution(
          playerSeasonStats,
          contribution.playerId,
          contribution.goals,
          contribution.shots,
          contribution.rating,
          contribution.started,
          contribution.saves,
          contribution.shotsFaced,
        );
      }
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

export { averageRating };
