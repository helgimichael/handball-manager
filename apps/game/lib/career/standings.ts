import { computeStandings, ALLSVENSKAN_POINTS_RULE, type StandingRow } from "@handball-manager/game-simulation";
import { CLUBS } from "../game-data";
import type { CareerState } from "./types";

/**
 * Live standings, recomputed from scratch from `state.results` every
 * call -- never stored/cached on CareerState, so there is no derived
 * state to keep in sync or accidentally double-count (see game-
 * simulation's table.ts for why computeStandings is safe to call
 * repeatedly).
 */
export function getLiveStandings(state: CareerState): StandingRow[] {
  const clubIds = CLUBS.filter((c) => c.competitionId === state.competitionId).map((c) => c.id);
  const results = Object.values(state.results).map((r) => ({
    homeClubId: r.homeClubId,
    awayClubId: r.awayClubId,
    homeGoals: r.homeGoals,
    awayGoals: r.awayGoals,
  }));
  return computeStandings(clubIds, results, ALLSVENSKAN_POINTS_RULE);
}

export function getPlayerClubPosition(state: CareerState): number {
  const table = getLiveStandings(state);
  return table.findIndex((row) => row.clubId === state.playerClubId) + 1;
}

/**
 * HM-MATCH-0.2: a PROVISIONAL table for the Live Match screen -- exactly
 * `getLiveStandings` (never stored/mutated on CareerState, same as
 * above), except the one fixture currently being watched contributes its
 * live-revealed score instead of its already-written-to-state.results
 * final score (Career Rhythm's Daily World Tick fully simulates the
 * manager's own fixture and writes the complete FastMatchResult before
 * Live Match ever mounts -- see match-day page's module doc -- so
 * without this override the "live" table would silently already show
 * the full-time result while the manager is still only 12 minutes in).
 *
 * Every OTHER fixture already in `state.results` -- including same-date
 * AI-vs-AI fixtures -- is used completely unchanged: Career Rhythm's
 * processDay() (dailyTick.ts) fully resolves every other same-date
 * fixture before the manager's own MATCHDAY_READY event is even emitted,
 * so those are genuinely, honestly final by the time this is called --
 * never a fabricated "also in progress" claim (Spec: "do not fake
 * simultaneous matches if the current calendar cannot yet represent them
 * honestly"). A future Living Calendar milestone that can represent
 * fixtures as genuinely in-progress independent of the manager's own
 * match would extend this function's inputs, not its shape.
 */
export function getLiveTableStandings(state: CareerState, watchedFixtureId: string, watchedHomeGoals: number, watchedAwayGoals: number): StandingRow[] {
  const clubIds = CLUBS.filter((c) => c.competitionId === state.competitionId).map((c) => c.id);
  const results = Object.entries(state.results).map(([fixtureId, r]) => ({
    homeClubId: r.homeClubId,
    awayClubId: r.awayClubId,
    homeGoals: fixtureId === watchedFixtureId ? watchedHomeGoals : r.homeGoals,
    awayGoals: fixtureId === watchedFixtureId ? watchedAwayGoals : r.awayGoals,
  }));
  return computeStandings(clubIds, results, ALLSVENSKAN_POINTS_RULE);
}
