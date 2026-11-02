// HM-PLAYTEST-01 5.5: preseason context for the New Game club choice.
//
// Every number is derived from the game's own world model, never a fixed
// ranking: the predicted position ranks each league's clubs by the same
// squad-derived strength the match pre-calculations use (current squads and
// gameplay ratings), the expectation follows the board's own thresholds for
// that league, and the financial context is the club's generated economy
// baseline (the very one the career will start with).
import { computeSquadDerivedClubStrength } from "../career/squadDerivedClubStrength";
import { generateClubEconomyBaseline } from "../economy/clubEconomyGeneration";
import { ECONOMIC_BAND_LABEL } from "../economy/clubEconomyLabels";
import { ALLSVENSKAN, HANDBOLLSLIGAN } from "../competition/rules";
import { getClubsByCompetition, getCompetition, type PlayerMock } from "../game-data";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";

export type ClubPreseasonContext = {
  readonly clubId: string;
  readonly predicted: number;
  readonly clubsInLeague: number;
  readonly expectation: string;
  /** Squad strength against the league average, in strength points (0-100 scale). */
  readonly strengthVsLeague: number;
  readonly economyLabel: string;
  readonly annualRevenueEur: number;
  readonly cashEur: number;
};

/** The board's preseason league expectation for a predicted position (lib/board/board.ts thresholds). */
export function expectationFor(competitionId: string, p: number): string {
  if (competitionId === HANDBOLLSLIGAN) return p <= 2 ? "Vinna grundserien" : p <= 4 ? "Topp fyra" : p <= 8 ? "SM-slutspel" : p <= 11 ? "Säkra kontraktet utan kval" : "Undvika direkt nedflyttning";
  if (competitionId === ALLSVENSKAN) return p <= 2 ? "Gå upp till Handbollsligan" : p <= 5 ? "Kvalplats uppåt" : p <= 10 ? "Stabil mittenplacering" : "Undvika nedflyttning";
  return "Bästa möjliga placering";
}

export function buildClubPreseasonContexts(competitionId: string, squads: Record<string, PlayerMock[]>, ratings: Record<string, GameplayPlayerRating[]>): ClubPreseasonContext[] {
  const clubs = getClubsByCompetition(competitionId);
  const tier = getCompetition(competitionId)?.tier;
  const strengths = clubs.map((c) => ({ id: c.id, overall: computeSquadDerivedClubStrength(c.id, squads[c.id] ?? [], ratings[c.id] ?? []).overall }));
  const ranked = [...strengths].sort((a, b) => b.overall - a.overall || a.id.localeCompare(b.id));
  const average = strengths.reduce((n, s) => n + s.overall, 0) / Math.max(1, strengths.length);
  return strengths.map((s) => {
    const predicted = ranked.findIndex((r) => r.id === s.id) + 1;
    const economy = generateClubEconomyBaseline(s.id, tier === 1 || tier === 2 ? tier : undefined);
    const r = economy.revenue;
    return {
      clubId: s.id,
      predicted,
      clubsInLeague: clubs.length,
      expectation: expectationFor(competitionId, predicted),
      strengthVsLeague: Math.round((s.overall - average) * 10) / 10,
      economyLabel: ECONOMIC_BAND_LABEL[economy.band],
      annualRevenueEur: r.commercialRevenueEur + r.mediaRevenueEur + r.matchdayRevenueEur + r.sportingRevenueEur + r.otherRevenueEur,
      cashEur: economy.cashEur,
    };
  });
}

/** Client-side: fetch the league's squads and ratings and build the context. Null when the data is unavailable. */
export async function fetchClubPreseasonContexts(competitionId: string): Promise<ClubPreseasonContext[] | null> {
  try {
    const [squadsRes, ratingsRes] = await Promise.all([
      fetch(`/api/game-world/squad-snapshot?competitionId=${encodeURIComponent(competitionId)}`),
      fetch(`/api/game-world/gameplay-ratings-snapshot?competitionId=${encodeURIComponent(competitionId)}`),
    ]);
    if (!squadsRes.ok) return null;
    const squads = ((await squadsRes.json()) as { worldSquads?: Record<string, PlayerMock[]> }).worldSquads ?? {};
    const ratings = ratingsRes.ok ? ((await ratingsRes.json()) as { gameplayRatings?: Record<string, GameplayPlayerRating[]> }).gameplayRatings ?? {} : {};
    return buildClubPreseasonContexts(competitionId, squads, ratings);
  } catch {
    return null;
  }
}
