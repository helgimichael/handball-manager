// Club match-history selector (HM-ANALYSIS-0.1).
//
// The one place that turns CareerState.fixtures + CareerState.results
// into a club-perspective row list. Every other analysis module (windows,
// metrics, patterns, half splits, scoring runs) operates on
// ClubMatchStatRow[] -- never reads CareerState directly -- so there is
// exactly one place that could get the home/away perspective swap wrong.
import type { CareerState } from "../career/types";
import type { AnalysisWindow, ClubMatchStatRow } from "./types";

/** Every completed match involving `clubId`, from that club's own perspective, ascending by date. Includes AI-vs-AI matches when `clubId` is an AI club -- CareerState stores a full FastMatchResult (team stats + timeline) for every fixture in the season, not only the manager's own (see calendar.ts's simulateMatchday). */
export function getClubMatchHistory(career: CareerState, clubId: string): ClubMatchStatRow[] {
  const rows: ClubMatchStatRow[] = [];
  for (const fixture of career.fixtures) {
    const isHome = fixture.homeClubId === clubId;
    const isAway = fixture.awayClubId === clubId;
    if (!isHome && !isAway) continue;
    const result = career.results[fixture.id];
    if (!result) continue;

    const own = isHome ? result.homeStats : result.awayStats;
    const opponent = isHome ? result.awayStats : result.homeStats;
    const goalsFor = isHome ? result.homeGoals : result.awayGoals;
    const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;

    rows.push({
      fixtureId: fixture.id,
      date: fixture.date,
      round: fixture.round,
      opponentClubId: isHome ? fixture.awayClubId : fixture.homeClubId,
      isHome,
      goalsFor,
      goalsAgainst,
      result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
      own,
      opponent,
      events: result.events,
    });
  }
  return rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Slices a club's ascending match history down to the requested analysis window (Spec §13). LAST_MATCH/LAST_3/LAST_5 take the most recent N; SEASON takes everything played so far. Never pads with anything -- a short slice just means a short slice, calibration.ts decides whether that's enough to analyze. */
export function sliceWindow(rows: readonly ClubMatchStatRow[], window: AnalysisWindow): ClubMatchStatRow[] {
  switch (window) {
    case "LAST_MATCH":
      return rows.slice(-1);
    case "LAST_3":
      return rows.slice(-3);
    case "LAST_5":
      return rows.slice(-5);
    case "SEASON":
      return [...rows];
  }
}
