// HM-SCOUTING-1.0: proofs for the scout-report-specific view -- market
// value uncertainty banding and the deterministic recommendation.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScoutReportView, resolveMarketValueRange } from "./scoutReportVisibility";
import type { KnowledgeRatingInput } from "./playerVisibility";

function makeRating(overrides: Partial<KnowledgeRatingInput> = {}): KnowledgeRatingInput {
  return {
    position: "M9",
    ca: 160,
    pa: 175,
    branch: {
      branch: "OUTCOURT",
      attributes: {
        PLAYMAKING: { value: 18, origin: "GENERATED_PRIOR" },
        TOP_SPEED: { value: 6, origin: "GENERATED_PRIOR" },
        PASSING: { value: 15, origin: "GENERATED_PRIOR" },
        CENTRAL_DEFENCE: { value: 5, origin: "GENERATED_PRIOR" },
      },
    },
    attackRoleProficiencies: [{ role: "PRIMARY_PLAYMAKER" }],
    defenceRoleProficiencies: [],
    ...overrides,
  };
}

test("resolveMarketValueRange widens as knowledge drops, and always contains the true value", () => {
  const trueValue = 1_000_000;
  const minimal = resolveMarketValueRange(trueValue, 10);
  const high = resolveMarketValueRange(trueValue, 90);

  assert.ok(minimal.max - minimal.min > high.max - high.min, "MINIMAL knowledge must produce a wider range than HIGH");
  assert.ok(minimal.min <= trueValue && trueValue <= minimal.max);
  assert.ok(high.min <= trueValue && trueValue <= high.max);
});

test("resolveMarketValueRange never goes negative", () => {
  const range = resolveMarketValueRange(1000, 0);
  assert.ok(range.min >= 0);
});

test("resolveMarketValueRange is a single exact point only conceptually at the extreme -- still deterministic for identical inputs", () => {
  const a = resolveMarketValueRange(500_000, 60);
  const b = resolveMarketValueRange(500_000, 60);
  assert.deepEqual(a, b);
});

test("buildScoutReportView never exposes raw CA/PA -- only the same knowledge-gated view resolvePlayerVisibility already produces", () => {
  const view = buildScoutReportView(makeRating(), 80, 500_000, 15);
  const json = JSON.stringify(view);
  assert.ok(!json.includes("160"), "raw CA must never appear in the report view");
  assert.ok(!json.includes("175"), "raw PA must never appear in the report view");
});

test("buildScoutReportView gives no recommendation at MINIMAL knowledge", () => {
  const view = buildScoutReportView(makeRating(), 10, 500_000, 10);
  assert.equal(view.tier, "MINIMAL");
  assert.match(view.recommendation, /Otillräcklig kännedom/);
});

test("buildScoutReportView recommends a strong, HIGH-knowledge player for signing", () => {
  const view = buildScoutReportView(makeRating({ ca: 190, pa: 195 }), 90, 1_000_000, 18);
  assert.equal(view.tier, "HIGH");
  assert.match(view.recommendation, /Rekommenderas/);
});

test("buildScoutReportView's confidence rises with both knowledge and scout suitability", () => {
  const lowKnowledgeWeakScout = buildScoutReportView(makeRating(), 30, 500_000, 2);
  const highKnowledgeEliteScout = buildScoutReportView(makeRating(), 90, 500_000, 20);
  assert.ok(highKnowledgeEliteScout.confidencePct > lowKnowledgeWeakScout.confidencePct);
  assert.ok(lowKnowledgeWeakScout.confidencePct >= 0 && lowKnowledgeWeakScout.confidencePct <= 100);
  assert.ok(highKnowledgeEliteScout.confidencePct >= 0 && highKnowledgeEliteScout.confidencePct <= 100);
});

test("buildScoutReportView falls back to a neutral confidence assumption when no scout has filed a report yet (null suitability)", () => {
  const view = buildScoutReportView(makeRating(), 50, 500_000, null);
  assert.ok(view.confidencePct >= 0 && view.confidencePct <= 100);
});

test("buildScoutReportView's marketValueRange is null only when no canonical value was resolvable at all", () => {
  const withValue = buildScoutReportView(makeRating(), 50, 500_000, 10);
  const withoutValue = buildScoutReportView(makeRating(), 50, undefined, 10);
  assert.ok(withValue.marketValueRange !== null);
  assert.equal(withoutValue.marketValueRange, null);
});

test("buildScoutReportView is deterministic -- identical inputs always produce an identical view (no reroll on repeated calls)", () => {
  const a = buildScoutReportView(makeRating(), 65, 750_000, 12);
  const b = buildScoutReportView(makeRating(), 65, 750_000, 12);
  assert.deepEqual(a, b);
});
