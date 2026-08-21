// Analysis Hub domain types (HM-ANALYSIS-0.1).
//
// Source of truth: docs/HANDBALL_MANAGER_ANALYSIS_HUB_SPEC_v0.1.md.
// This module defines the evidence model the rest of lib/analysis is
// built around -- FACT/OBSERVED_PATTERN/INTERPRETATION are kept as
// distinct, separately-typed things, never flattened into one generic
// "insight" shape (Spec S4/§3).

export type AnalysisEvidenceLevel = "FACT" | "OBSERVED_PATTERN" | "INTERPRETATION";

export type AnalysisWindow = "LAST_MATCH" | "LAST_3" | "LAST_5" | "SEASON";

/**
 * Distinct missing-data states (Spec §19/S5) -- never conflated:
 * - NO_MATCHES_YET: zero completed matches exist for the subject at all.
 * - INSUFFICIENT_DATA: the metric/pattern exists but the sample is below
 *   its calibrated minimum (see calibration.ts).
 * - NOT_AVAILABLE_YET: the game does not persist the evidence this
 *   category needs at all (e.g. opponent player-level contributions).
 */
export type MissingDataState = "NO_MATCHES_YET" | "INSUFFICIENT_DATA" | "NOT_AVAILABLE_YET";

/** A value that either resolved to real evidence, or didn't -- forces every consumer to handle the missing case explicitly rather than defaulting to 0/"". */
export type Evidence<T> = { ok: true; value: T } | { ok: false; state: MissingDataState };

export function ok<T>(value: T): Evidence<T> {
  return { ok: true, value };
}

export function missing<T>(state: MissingDataState): Evidence<T> {
  return { ok: false, state };
}

/** One deterministic, reproducible observation over multiple FACTs (Spec §16). Never labelled ELITE/POOR/DOMINANT -- states what was observed, not a judgement. */
export interface ObservedPattern {
  evidenceLevel: "OBSERVED_PATTERN";
  /** Stable rule identifier, e.g. "SCORING_CONSISTENCY" -- see patterns.ts's PATTERN_RULE_IDS. */
  ruleId: string;
  subjectClubId: string;
  window: AnalysisWindow;
  statement: string;
  /** The exact metric values the statement is built from, for provenance/testing (Spec §24). */
  evidence: Record<string, number>;
  /** Fixture ids the pattern was computed over, for causal/evidence tracing. */
  fixtureIds: readonly string[];
}

/** A cautious deterministic manager-facing meaning derived from ONE supporting ObservedPattern (Spec §17). Never fabricates causality (Spec §18). */
export interface Interpretation {
  evidenceLevel: "INTERPRETATION";
  ruleId: string;
  subjectClubId: string;
  window: AnalysisWindow;
  statement: string;
  /** The pattern ruleId this interpretation is licensed by -- an interpretation with no supporting pattern must not be produced (see interpretations.ts). */
  supportingPatternRuleId: string;
}

/** One row of team-level match evidence from a single club's perspective, reconstructable purely from a stored FastMatchResult -- never from a live/hypothetical source. */
export interface ClubMatchStatRow {
  fixtureId: string;
  date: string;
  round: number;
  opponentClubId: string;
  isHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: "W" | "D" | "L";
  /** This club's own TeamMatchStats for this match. */
  own: import("@handball-manager/game-simulation").TeamMatchStats;
  /** The opponent's TeamMatchStats for the same match. */
  opponent: import("@handball-manager/game-simulation").TeamMatchStats;
  events: readonly import("@handball-manager/game-simulation").MatchEvent[];
}
