// Arena Nights MGR-03b A "Gala Sequence": the season's existing awards
// (SeasonOutcome.awards) as an award-by-award reveal, the manager's league
// first and his own club's winners highlighted, ending in a summary card.
// Uses season-end data only; awards logic is untouched.
import type { SeasonAward, SeasonOutcome } from "../competition/types";

export interface GalaStage {
  id: string;
  award: SeasonAward;
  mine: boolean;
}

export interface GalaSummary {
  champion?: string;
  runnerUp?: string;
  cupWinner?: string;
  myWinners: SeasonAward[];
  allStars: SeasonAward[];
}

export interface GalaSequence {
  seasonId: string;
  stages: GalaStage[];
  summary: GalaSummary;
}

const AWARD_ORDER: Record<SeasonAward["id"], number> = { BEST_GOALKEEPER: 0, TOP_SCORER: 1, MVP: 2, ALL_STAR: 3 };

/** Null when the season is not complete or has no awards. */
export function buildGalaSequence(outcome: SeasonOutcome | undefined, me: string, myLeague: string): GalaSequence | null {
  if (!outcome || outcome.phase !== "COMPLETE" || outcome.awards.length === 0) return null;
  const featured = outcome.awards.filter((a) => a.id !== "ALL_STAR");
  const leagueRank = (c: string) => (c === myLeague ? 0 : 1);
  const stages = [...featured]
    .sort((a, b) => leagueRank(a.competitionId) - leagueRank(b.competitionId) || a.competitionId.localeCompare(b.competitionId) || AWARD_ORDER[a.id] - AWARD_ORDER[b.id])
    .map((award) => ({ id: `${award.id}:${award.competitionId}`, award, mine: award.clubId === me }));
  return {
    seasonId: outcome.seasonId,
    stages,
    summary: {
      champion: outcome.champion,
      runnerUp: outcome.runnerUp,
      cupWinner: outcome.cupWinner,
      myWinners: outcome.awards.filter((a) => a.clubId === me),
      allStars: outcome.awards.filter((a) => a.id === "ALL_STAR" && a.competitionId === myLeague),
    },
  };
}

/** localStorage key: the gala opens by itself once per season and viewer. */
export const galaSeenKey = (seasonId: string) => `hm:gala-seen:${seasonId}`;
