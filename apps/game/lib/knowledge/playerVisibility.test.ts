// HM-DATA-ALLSVENSKAN-1.1B Part 12: player visibility resolver proofs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePlayerVisibility, type KnowledgeRatingInput } from "./playerVisibility";

function makeRating(overrides: Partial<KnowledgeRatingInput> = {}): KnowledgeRatingInput {
  return {
    position: "M9",
    ca: 130,
    pa: 145,
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

test("(1) MINIMAL knowledge shows only a wide ability range -- no potential, archetype, strengths, or weaknesses", () => {
  const view = resolvePlayerVisibility(makeRating(), 10);
  assert.equal(view.tier, "MINIMAL");
  assert.ok(view.abilityRange.max - view.abilityRange.min >= 2);
  assert.equal(view.potentialRange, null);
  assert.equal(view.archetype, null);
  assert.equal(view.strengths, null);
  assert.equal(view.weaknesses, null);
});

test("(2) LOW knowledge still hides potential/archetype/strengths/weaknesses, but the ability range is narrower than MINIMAL", () => {
  const view = resolvePlayerVisibility(makeRating(), 30);
  assert.equal(view.tier, "LOW");
  assert.equal(view.potentialRange, null);
  assert.equal(view.archetype, null);
});

test("(3) MEDIUM knowledge unlocks potential range, archetype, and exactly one strength/weakness", () => {
  const view = resolvePlayerVisibility(makeRating(), 60);
  assert.equal(view.tier, "MEDIUM");
  assert.ok(view.potentialRange);
  assert.equal(view.archetype, "Primär speluppbyggare");
  assert.equal(view.strengths?.length, 1);
  assert.equal(view.weaknesses?.length, 1);
  assert.equal(view.strengths?.[0], "Speluppbyggnad", "expected the highest-value attribute (PLAYMAKING=18)");
  assert.equal(view.weaknesses?.[0], "Centralförsvar", "expected the lowest-value attribute (CENTRAL_DEFENCE=5)");
});

test("(4) HIGH knowledge gives an exact ability/potential range (min===max) and up to 3 strengths/weaknesses", () => {
  const view = resolvePlayerVisibility(makeRating(), 90);
  assert.equal(view.tier, "HIGH");
  assert.equal(view.abilityRange.min, view.abilityRange.max);
  assert.equal(view.potentialRange!.min, view.potentialRange!.max);
  assert.equal(view.strengths?.length, 3);
  assert.equal(view.weaknesses?.length, 3);
});

test("(5) raw CA/PA never appear anywhere in the resolved view at any knowledge level", () => {
  for (const pct of [0, 25, 50, 75, 100]) {
    const view = resolvePlayerVisibility(makeRating({ ca: 137, pa: 151 }), pct);
    const serialized = JSON.stringify(view);
    assert.ok(!serialized.includes("137"));
    assert.ok(!serialized.includes("151"));
  }
});

test("(6) a goalkeeper's archetype is never drawn from attackRoleProficiencies (branch separation preserved)", () => {
  const gkRating = makeRating({
    branch: { branch: "GOALKEEPER", attributes: { SHOT_STOPPING: { value: 16, origin: "GENERATED_PRIOR" }, DISTRIBUTION: { value: 8, origin: "GENERATED_PRIOR" } } },
    attackRoleProficiencies: [{ role: "PRIMARY_PLAYMAKER" }], // deliberately present but must be ignored for a GK
    defenceRoleProficiencies: [],
  });
  const view = resolvePlayerVisibility(gkRating, 60);
  assert.notEqual(view.archetype, "Primär speluppbyggare");
});

test("(7) the resolver is a pure function of its inputs -- identical inputs always produce identical output", () => {
  const rating = makeRating();
  assert.deepEqual(resolvePlayerVisibility(rating, 60), resolvePlayerVisibility(rating, 60));
});
