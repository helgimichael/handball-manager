import type { CareerState } from "./types";
import { getClub } from "../game-data";

export interface PlayerFormEntry {
  fixtureId: string;
  date: string;
  opponentClubId: string;
  opponentName: string;
  opponentShortName: string;
  isHome: boolean;
  scoreText: string;
  played: boolean;
  rating?: number;
  goals?: number;
  started?: boolean;
}

/**
 * Returns the recent match history for a player:
 * - "FIXTURES": The club's latest completed matches (with DNP for matches where player didn't play).
 * - "APPEARANCES": Only matches where the player actually played on court and received a rating.
 */
export function getPlayerFormHistory(
  state: CareerState,
  playerId: string,
  mode: "FIXTURES" | "APPEARANCES" = "APPEARANCES",
  limit = 5
): PlayerFormEntry[] {
  const clubId = state.playerContracts[playerId]?.clubId ?? state.playerClubId;
  const fixtures = (state.fixtures ?? [])
    .filter((f) => (f.homeClubId === clubId || f.awayClubId === clubId) && !!state.results[f.id])
    .sort((a, b) => b.date.localeCompare(a.date));

  const list: PlayerFormEntry[] = [];

  for (const f of fixtures) {
    const res = state.results[f.id];
    if (!res) continue;

    const isHome = f.homeClubId === clubId;
    const oppId = isHome ? f.awayClubId : f.homeClubId;
    const opp = getClub(oppId);
    const oppName = opp?.name ?? oppId;
    const oppShort = opp?.shortName ?? oppId;
    const scoreText = isHome ? `${res.homeGoals}–${res.awayGoals}` : `${res.awayGoals}–${res.homeGoals}`;

    const contribs = isHome ? res.homePlayerContributions : res.awayPlayerContributions;
    const contribution = (contribs ?? []).find((c) => c.playerId === playerId);

    if (contribution) {
      list.push({
        fixtureId: f.id,
        date: f.date,
        opponentClubId: oppId,
        opponentName: oppName,
        opponentShortName: oppShort,
        isHome,
        scoreText,
        played: true,
        rating: contribution.rating,
        goals: contribution.goals,
        started: contribution.started,
      });
    } else if (mode === "FIXTURES") {
      list.push({
        fixtureId: f.id,
        date: f.date,
        opponentClubId: oppId,
        opponentName: oppName,
        opponentShortName: oppShort,
        isHome,
        scoreText,
        played: false,
      });
    }

    if (list.length >= limit) break;
  }

  return list;
}

/**
 * The rating from the player's most recent appearance on court, or null if no appearances yet.
 */
export function getPlayerLastMatchRating(state: CareerState, playerId: string): number | null {
  const appearances = getPlayerFormHistory(state, playerId, "APPEARANCES", 1);
  return appearances[0]?.rating ?? null;
}

/**
 * The average rating across the player's last 5 appearances on court, or null if no appearances.
 */
export function getPlayerLastFiveAverageRating(state: CareerState, playerId: string): number | null {
  const appearances = getPlayerFormHistory(state, playerId, "APPEARANCES", 5);
  if (!appearances.length) return null;
  const sum = appearances.reduce((acc, a) => acc + (a.rating ?? 0), 0);
  return Math.round((sum / appearances.length) * 10) / 10;
}
