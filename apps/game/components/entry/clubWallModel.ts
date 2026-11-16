// Arena 231 -- ENT-03d C "Club Wall by ambition". Pure grouping of the playable clubs into the story each
// offers, built only from the existing preseason context (predicted position, league size, squad strength):
//   Vinna    -- tipped top three of their league (title race / promotion race),
//   Överleva -- tipped in the bottom three of their league,
//   Utmana   -- everything in between.
// Clubs whose context has not loaded yet (or is unavailable) are not guessed: they stay "Okänd" and only show
// under "Alla". The playable list itself (B-team rule, playable flag) is decided by the caller and never here.
import type { ClubPreseasonContext } from "../../lib/newGame/clubSelectionContext";

export type Ambition = "VINNA" | "UTMANA" | "OVERLEVA";
export type AmbitionFilter = "ALLA" | Ambition;
export const AMBITION_LABEL: Record<AmbitionFilter, string> = { ALLA: "Alla", VINNA: "Vinna", UTMANA: "Utmana", OVERLEVA: "Överleva" };
export const AMBITION_NOTE: Record<Ambition, string> = {
  VINNA: "Tippade topp tre – allt annat än guld eller uppflyttning är ett misslyckande.",
  UTMANA: "Mitt i serien – varje poäng tar klubben ett steg uppåt.",
  OVERLEVA: "Tippade i botten – kontraktet är hela säsongens mål.",
};

export function ambitionOf(context: ClubPreseasonContext | undefined): Ambition | null {
  if (!context || context.clubsInLeague <= 0) return null;
  if (context.predicted <= 3) return "VINNA";
  if (context.predicted > context.clubsInLeague - 3) return "OVERLEVA";
  return "UTMANA";
}

/** Squad strength vs the league average as a 0..1 meter (±10 strength points spans the bar). */
export function strengthMeter(strengthVsLeague: number): number {
  return Math.max(0, Math.min(1, 0.5 + strengthVsLeague / 20));
}

/** Board expectation as a 0..1 meter: 1 = expected to win the league, 0 = expected to survive. */
export function expectationMeter(context: Pick<ClubPreseasonContext, "predicted" | "clubsInLeague">): number {
  if (context.clubsInLeague <= 1) return 0.5;
  return Math.max(0, Math.min(1, 1 - (context.predicted - 1) / (context.clubsInLeague - 1)));
}

/** `leagueId` is resolved by the New Game page (the reviewed static-catalogue read); this model never reads it itself. */
export interface WallClub { id: string; leagueId: string }

/** Filters the wall (ambition tab + league toggle) without reordering it; "Okänd" clubs show only under Alla. */
export function filterWall<T extends WallClub>(clubs: readonly T[], contexts: Readonly<Record<string, ClubPreseasonContext>>, ambition: AmbitionFilter, competitionId: string | "ALLA"): T[] {
  return clubs.filter((c) => (competitionId === "ALLA" || c.leagueId === competitionId) && (ambition === "ALLA" || ambitionOf(contexts[c.id]) === ambition));
}

export function ambitionCounts(clubs: readonly WallClub[], contexts: Readonly<Record<string, ClubPreseasonContext>>, competitionId: string | "ALLA"): Record<AmbitionFilter, number> {
  const counts: Record<AmbitionFilter, number> = { ALLA: 0, VINNA: 0, UTMANA: 0, OVERLEVA: 0 };
  for (const c of clubs) {
    if (competitionId !== "ALLA" && c.leagueId !== competitionId) continue;
    counts.ALLA++;
    const a = ambitionOf(contexts[c.id]);
    if (a) counts[a]++;
  }
  return counts;
}
