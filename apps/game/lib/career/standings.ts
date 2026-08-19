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
