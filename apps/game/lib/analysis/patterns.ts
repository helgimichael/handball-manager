// Deterministic pattern library (HM-ANALYSIS-0.1, Spec §16/S9).
//
// Intentionally small -- five categories, matching the spec exactly.
// Every rule is a pure function of ClubMatchStatRow[]; nothing here
// reads randomness, wall-clock time, or an AI model. Labels like
// ELITE/POOR/DOMINANT are deliberately never used (Spec §16).
import type { ClubMatchStatRow, MissingDataState, ObservedPattern } from "./types";
import { MIN_SAMPLE } from "./calibration";
import { sliceWindow } from "./matchHistory";
import { goalsConcededPerMatch, goalsPerMatch, savesPerMatch, turnoversPerMatch } from "./metrics";

export const PATTERN_RULE_IDS = {
  SCORING_CONSISTENCY: "SCORING_CONSISTENCY",
  RECENT_SCORING_VS_SEASON: "RECENT_SCORING_VS_SEASON",
  CONCEDED_TREND: "CONCEDED_TREND",
  TURNOVER_FREQUENCY: "TURNOVER_FREQUENCY",
  GOALKEEPER_OUTPUT: "GOALKEEPER_OUTPUT",
} as const;

export type PatternResult = { status: "OK"; pattern: ObservedPattern } | { status: "MISSING"; state: MissingDataState };

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** "Scored at least MIN goals in each of the last N matches" -- MIN is the true minimum, never an invented round number, over the last 5 (or last 3 if a full 5 isn't played yet). */
export function scoringConsistency(allRows: readonly ClubMatchStatRow[], clubId: string): PatternResult {
  const window = allRows.length >= 5 ? "LAST_5" : "LAST_3";
  const rows = sliceWindow(allRows, window);
  if (rows.length < MIN_SAMPLE.LAST_3) {
    return { status: "MISSING", state: allRows.length === 0 ? "NO_MATCHES_YET" : "INSUFFICIENT_DATA" };
  }
  const min = Math.min(...rows.map((r) => r.goalsFor));
  return {
    status: "OK",
    pattern: {
      evidenceLevel: "OBSERVED_PATTERN",
      ruleId: PATTERN_RULE_IDS.SCORING_CONSISTENCY,
      subjectClubId: clubId,
      window,
      statement: `Scored at least ${min} goals in each of the last ${rows.length} matches.`,
      evidence: { minGoals: min, matches: rows.length },
      fixtureIds: rows.map((r) => r.fixtureId),
    },
  };
}

function compareRecentToSeason(
  allRows: readonly ClubMatchStatRow[],
  clubId: string,
  ruleId: string,
  metricFn: (rows: readonly ClubMatchStatRow[]) => number | null,
  statementFor: (recent: number, season: number) => string | null,
): PatternResult {
  if (allRows.length === 0) return { status: "MISSING", state: "NO_MATCHES_YET" };
  const recentRows = sliceWindow(allRows, "LAST_5");
  if (recentRows.length < MIN_SAMPLE.LAST_3 || allRows.length < MIN_SAMPLE.SEASON) {
    return { status: "MISSING", state: "INSUFFICIENT_DATA" };
  }
  const recent = metricFn(recentRows);
  const season = metricFn(allRows);
  if (recent === null || season === null) return { status: "MISSING", state: "INSUFFICIENT_DATA" };
  const statement = statementFor(recent, season);
  if (!statement) return { status: "MISSING", state: "INSUFFICIENT_DATA" };
  return {
    status: "OK",
    pattern: {
      evidenceLevel: "OBSERVED_PATTERN",
      ruleId,
      subjectClubId: clubId,
      window: "LAST_5",
      statement,
      evidence: { recent: round1(recent), season: round1(season) },
      fixtureIds: recentRows.map((r) => r.fixtureId),
    },
  };
}

export function recentScoringVsSeason(allRows: readonly ClubMatchStatRow[], clubId: string): PatternResult {
  return compareRecentToSeason(allRows, clubId, PATTERN_RULE_IDS.RECENT_SCORING_VS_SEASON, goalsPerMatch, (recent, season) => {
    if (recent > season) return `Recent scoring output (${round1(recent)}/match) is above the season average (${round1(season)}/match).`;
    if (recent < season) return `Recent scoring output (${round1(recent)}/match) is below the season average (${round1(season)}/match).`;
    return null; // equal -- no directional pattern to report
  });
}

export function concededTrend(allRows: readonly ClubMatchStatRow[], clubId: string): PatternResult {
  return compareRecentToSeason(allRows, clubId, PATTERN_RULE_IDS.CONCEDED_TREND, goalsConcededPerMatch, (recent, season) => {
    if (recent < season) return `Conceded fewer goals recently (${round1(recent)}/match) than the season average (${round1(season)}/match).`;
    if (recent > season) return `Conceded more goals recently (${round1(recent)}/match) than the season average (${round1(season)}/match).`;
    return null;
  });
}

export function turnoverFrequency(allRows: readonly ClubMatchStatRow[], clubId: string): PatternResult {
  return compareRecentToSeason(allRows, clubId, PATTERN_RULE_IDS.TURNOVER_FREQUENCY, turnoversPerMatch, (recent, season) => {
    if (recent > season) return `Turnover frequency has increased recently (${round1(recent)}/match) compared with the season average (${round1(season)}/match).`;
    if (recent < season) return `Turnover frequency has decreased recently (${round1(recent)}/match) compared with the season average (${round1(season)}/match).`;
    return null;
  });
}

export function goalkeeperOutput(allRows: readonly ClubMatchStatRow[], clubId: string): PatternResult {
  return compareRecentToSeason(allRows, clubId, PATTERN_RULE_IDS.GOALKEEPER_OUTPUT, savesPerMatch, (recent, season) => {
    if (recent > season) return `Recent goalkeeper save output (${round1(recent)}/match) is above the season average (${round1(season)}/match).`;
    if (recent < season) return `Recent goalkeeper save output (${round1(recent)}/match) is below the season average (${round1(season)}/match).`;
    return null;
  });
}

/** Runs every pattern rule for one club and returns only the ones that actually produced a pattern (Spec §16: every produced pattern carries evidence; missing ones are a UI/view-model concern, not silently included here). */
export function computeAllPatterns(allRows: readonly ClubMatchStatRow[], clubId: string): ObservedPattern[] {
  const results = [
    scoringConsistency(allRows, clubId),
    recentScoringVsSeason(allRows, clubId),
    concededTrend(allRows, clubId),
    turnoverFrequency(allRows, clubId),
    goalkeeperOutput(allRows, clubId),
  ];
  return results.filter((r): r is { status: "OK"; pattern: ObservedPattern } => r.status === "OK").map((r) => r.pattern);
}
