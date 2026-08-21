// Metric formulas (HM-ANALYSIS-0.1, Spec §15). The ONLY place these
// formulas are implemented -- UI components must call these, never
// recompute a percentage inline (Spec S7: "do not duplicate formulas
// across components").
import type { ClubFormEntry } from "../career/types";
import type { ClubMatchStatRow } from "./types";

function sum(rows: readonly ClubMatchStatRow[], pick: (r: ClubMatchStatRow) => number): number {
  return rows.reduce((total, r) => total + pick(r), 0);
}

/** Every ratio-based metric returns `null` for a zero denominator -- never 0, never NaN. A team that has taken no 7m attempts has no 7m conversion rate, it does not have a 0% one. */
function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

export function goalsPerMatch(rows: readonly ClubMatchStatRow[]): number | null {
  return rows.length > 0 ? sum(rows, (r) => r.goalsFor) / rows.length : null;
}

export function goalsConcededPerMatch(rows: readonly ClubMatchStatRow[]): number | null {
  return rows.length > 0 ? sum(rows, (r) => r.goalsAgainst) / rows.length : null;
}

export function shootingPct(rows: readonly ClubMatchStatRow[]): number | null {
  return ratio(sum(rows, (r) => r.own.goals), sum(rows, (r) => r.own.shots));
}

export function opponentShootingPct(rows: readonly ClubMatchStatRow[]): number | null {
  return ratio(sum(rows, (r) => r.opponent.goals), sum(rows, (r) => r.opponent.shots));
}

export function turnoversPerMatch(rows: readonly ClubMatchStatRow[]): number | null {
  return rows.length > 0 ? sum(rows, (r) => r.own.turnovers) / rows.length : null;
}

export function sevenMetreConversion(rows: readonly ClubMatchStatRow[]): number | null {
  return ratio(sum(rows, (r) => r.own.sevenMetreGoals), sum(rows, (r) => r.own.sevenMetreAttempts));
}

export function savePct(rows: readonly ClubMatchStatRow[]): number | null {
  return ratio(sum(rows, (r) => r.own.saves), sum(rows, (r) => r.own.shotsFaced));
}

export function savesPerMatch(rows: readonly ClubMatchStatRow[]): number | null {
  return rows.length > 0 ? sum(rows, (r) => r.own.saves) / rows.length : null;
}

export function shotsPerMatch(rows: readonly ClubMatchStatRow[]): number | null {
  return rows.length > 0 ? sum(rows, (r) => r.own.shots) / rows.length : null;
}

export function twoMinPerMatch(rows: readonly ClubMatchStatRow[]): number | null {
  return rows.length > 0 ? sum(rows, (r) => r.own.twoMinuteSuspensions) / rows.length : null;
}

export function goalDifference(rows: readonly ClubMatchStatRow[]): number {
  return sum(rows, (r) => r.goalsFor) - sum(rows, (r) => r.goalsAgainst);
}

export function form(rows: readonly ClubMatchStatRow[]): ClubFormEntry[] {
  return rows.map((r) => r.result);
}

/** First/second-half goal split summed across `rows`, from event timelines (Spec §7: first-half/second-half goals). */
export function firstHalfGoals(rows: readonly ClubMatchStatRow[]): number {
  return sum(rows, (r) => r.events.filter((e) => e.type === "GOAL" && e.side === (r.isHome ? "home" : "away") && e.minute <= 30).length);
}

export function secondHalfGoals(rows: readonly ClubMatchStatRow[]): number {
  return sum(rows, (r) => r.events.filter((e) => e.type === "GOAL" && e.side === (r.isHome ? "home" : "away") && e.minute > 30).length);
}
