import type { StandingRow } from "@handball-manager/game-simulation";
import { competitionTable } from "../competition/tables";
import type { CareerState } from "./types";

/**
 * Live standings, recomputed from scratch from `state.results` every
 * call -- never stored/cached on CareerState, so there is no derived
 * state to keep in sync or accidentally double-count (see game-
 * simulation's table.ts for why computeStandings is safe to call
 * repeatedly).
 */
export function getLiveStandings(state: CareerState): StandingRow[] {
  // HM-PRESEASON-1.0 Part: "friendly/cup påverkar inte ligatabellen" --
  // only LEAGUE fixtures' own results ever feed the table.
  // HM-ALPHA3-M03: of the manager's own competition only (both Swedish
  // tiers now have a calendar), with the verified Swedish tiebreakers.
  const pool = state.swedishContinuity?.pools?.[state.seasonId]?.districts[state.competitionId.replace('se_division2_','')];
  if (state.competitionId.startsWith('se_division2_') && pool) return [...pool.rows].sort((a,b)=>pool.order.indexOf(a.clubId)-pool.order.indexOf(b.clubId));
  return competitionTable(state, state.competitionId);
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
  // HM-ALPHA3-M03: the same competition table (and tiebreakers) as getLiveStandings, with the watched fixture's live score substituted.
  const watched = state.results[watchedFixtureId];
  const results = watched ? { ...state.results, [watchedFixtureId]: { ...watched, homeGoals: watchedHomeGoals, awayGoals: watchedAwayGoals } } : state.results;
  return competitionTable({ ...state, results }, state.competitionId);
}
