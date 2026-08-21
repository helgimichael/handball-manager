// Deterministic interpretation rules (HM-ANALYSIS-0.1, Spec §17/§18).
//
// An interpretation may ONLY be produced when a specific supporting
// ObservedPattern already exists (Spec §17: "cautious deterministic
// interpretations only where supported") -- this module never invents
// one from raw metrics directly. Every statement here matches one of
// the spec's explicitly allowed examples; nothing tactical, causal,
// psychological, or fatigue-related is produced (Spec §18: forbidden
// without richer evidence this game does not model in v0.1).
import { PATTERN_RULE_IDS } from "./patterns";
import type { Interpretation, ObservedPattern } from "./types";

export const INTERPRETATION_RULE_IDS = {
  OFFENSIVE_PRODUCTION_STABLE: "OFFENSIVE_PRODUCTION_STABLE",
  RECENT_SCORING_ABOVE_AVERAGE: "RECENT_SCORING_ABOVE_AVERAGE",
  TURNOVERS_ABOVE_AVERAGE: "TURNOVERS_ABOVE_AVERAGE",
  GOALKEEPER_OUTPUT_INCREASED: "GOALKEEPER_OUTPUT_INCREASED",
  CONCEDED_FEWER_RECENTLY: "CONCEDED_FEWER_RECENTLY",
} as const;

function find(patterns: readonly ObservedPattern[], ruleId: string): ObservedPattern | undefined {
  return patterns.find((p) => p.ruleId === ruleId);
}

/** Derives the small, spec-literal set of allowed interpretations from an already-computed pattern list. Each check requires BOTH the supporting pattern to exist AND its evidence to point in the one direction the spec's example statement describes -- the opposite direction of the same pattern produces no interpretation at all, rather than an invented negative one. */
export function computeInterpretations(patterns: readonly ObservedPattern[], subjectClubId: string): Interpretation[] {
  const out: Interpretation[] = [];

  const consistency = find(patterns, PATTERN_RULE_IDS.SCORING_CONSISTENCY);
  if (consistency) {
    out.push({
      evidenceLevel: "INTERPRETATION",
      ruleId: INTERPRETATION_RULE_IDS.OFFENSIVE_PRODUCTION_STABLE,
      subjectClubId,
      window: consistency.window,
      statement: "Recent offensive production has been stable.",
      supportingPatternRuleId: consistency.ruleId,
    });
  }

  const scoring = find(patterns, PATTERN_RULE_IDS.RECENT_SCORING_VS_SEASON);
  if (scoring && scoring.evidence.recent > scoring.evidence.season) {
    out.push({
      evidenceLevel: "INTERPRETATION",
      ruleId: INTERPRETATION_RULE_IDS.RECENT_SCORING_ABOVE_AVERAGE,
      subjectClubId,
      window: scoring.window,
      statement: "Recent scoring output is above the season average.",
      supportingPatternRuleId: scoring.ruleId,
    });
  }

  const turnovers = find(patterns, PATTERN_RULE_IDS.TURNOVER_FREQUENCY);
  if (turnovers && turnovers.evidence.recent > turnovers.evidence.season) {
    out.push({
      evidenceLevel: "INTERPRETATION",
      ruleId: INTERPRETATION_RULE_IDS.TURNOVERS_ABOVE_AVERAGE,
      subjectClubId,
      window: turnovers.window,
      statement: "Recent matches have contained more turnovers than the season average.",
      supportingPatternRuleId: turnovers.ruleId,
    });
  }

  const gk = find(patterns, PATTERN_RULE_IDS.GOALKEEPER_OUTPUT);
  if (gk && gk.evidence.recent > gk.evidence.season) {
    out.push({
      evidenceLevel: "INTERPRETATION",
      ruleId: INTERPRETATION_RULE_IDS.GOALKEEPER_OUTPUT_INCREASED,
      subjectClubId,
      window: gk.window,
      statement: "Goalkeeper save output has increased recently.",
      supportingPatternRuleId: gk.ruleId,
    });
  }

  const conceded = find(patterns, PATTERN_RULE_IDS.CONCEDED_TREND);
  if (conceded && conceded.evidence.recent < conceded.evidence.season) {
    out.push({
      evidenceLevel: "INTERPRETATION",
      ruleId: INTERPRETATION_RULE_IDS.CONCEDED_FEWER_RECENTLY,
      subjectClubId,
      window: conceded.window,
      statement: "The team has conceded fewer goals recently.",
      supportingPatternRuleId: conceded.ruleId,
    });
  }

  return out;
}
