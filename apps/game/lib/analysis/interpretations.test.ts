import { test } from "node:test";
import assert from "node:assert/strict";
import { computeInterpretations, INTERPRETATION_RULE_IDS } from "./interpretations";
import { PATTERN_RULE_IDS } from "./patterns";
import type { ObservedPattern } from "./types";

function pattern(ruleId: string, evidence: Record<string, number>): ObservedPattern {
  return { evidenceLevel: "OBSERVED_PATTERN", ruleId, subjectClubId: "club-a", window: "LAST_5", statement: "x", evidence, fixtureIds: ["f1", "f2", "f3"] };
}

test("an interpretation requires its supporting pattern to be present", () => {
  assert.deepEqual(computeInterpretations([], "club-a"), []);
});

test("no interpretation is produced when the sample is insufficient (no pattern to point to)", () => {
  // Simulates patterns.ts never having produced a pattern for an insufficient sample.
  assert.deepEqual(computeInterpretations([], "club-a"), []);
});

test("RECENT_SCORING_ABOVE_AVERAGE only fires when recent > season, not when recent < season", () => {
  const above = computeInterpretations([pattern(PATTERN_RULE_IDS.RECENT_SCORING_VS_SEASON, { recent: 30, season: 25 })], "club-a");
  assert.ok(above.some((i) => i.ruleId === INTERPRETATION_RULE_IDS.RECENT_SCORING_ABOVE_AVERAGE));

  const below = computeInterpretations([pattern(PATTERN_RULE_IDS.RECENT_SCORING_VS_SEASON, { recent: 20, season: 25 })], "club-a");
  assert.equal(below.some((i) => i.ruleId === INTERPRETATION_RULE_IDS.RECENT_SCORING_ABOVE_AVERAGE), false);
});

test("CONCEDED_FEWER_RECENTLY only fires when recent < season", () => {
  const fewer = computeInterpretations([pattern(PATTERN_RULE_IDS.CONCEDED_TREND, { recent: 20, season: 28 })], "club-a");
  assert.ok(fewer.some((i) => i.ruleId === INTERPRETATION_RULE_IDS.CONCEDED_FEWER_RECENTLY));

  const more = computeInterpretations([pattern(PATTERN_RULE_IDS.CONCEDED_TREND, { recent: 30, season: 28 })], "club-a");
  assert.equal(more.some((i) => i.ruleId === INTERPRETATION_RULE_IDS.CONCEDED_FEWER_RECENTLY), false);
});

test("statements never contain tactical, fatigue, or causal language", () => {
  const patterns = [
    pattern(PATTERN_RULE_IDS.SCORING_CONSISTENCY, { minGoals: 28, matches: 5 }),
    pattern(PATTERN_RULE_IDS.RECENT_SCORING_VS_SEASON, { recent: 30, season: 25 }),
    pattern(PATTERN_RULE_IDS.TURNOVER_FREQUENCY, { recent: 15, season: 10 }),
    pattern(PATTERN_RULE_IDS.GOALKEEPER_OUTPUT, { recent: 14, season: 10 }),
    pattern(PATTERN_RULE_IDS.CONCEDED_TREND, { recent: 20, season: 28 }),
  ];
  const forbiddenWords = ["fatigue", "because", "caused", "tactical", "overhelp", "passive", "reads shots", "vulnerable"];
  for (const interp of computeInterpretations(patterns, "club-a")) {
    const lower = interp.statement.toLowerCase();
    for (const word of forbiddenWords) {
      assert.equal(lower.includes(word), false, `"${interp.statement}" must not contain "${word}"`);
    }
  }
});

test("interpretation rule ids and text are deterministic for identical pattern input", () => {
  const patterns = [pattern(PATTERN_RULE_IDS.SCORING_CONSISTENCY, { minGoals: 28, matches: 5 })];
  const first = computeInterpretations(patterns, "club-a");
  const second = computeInterpretations([...patterns], "club-a");
  assert.deepEqual(first, second);
});
