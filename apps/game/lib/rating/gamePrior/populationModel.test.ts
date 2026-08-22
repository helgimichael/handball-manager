// HM-RATINGS-0.6 Part O: proves the game-prior CA/PA population model's
// core invariants -- determinism, bounded range, PA >= CA structurally.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CA_MAX, CA_MIN } from "../types";
import { generateGamePriorCA, generateGamePriorPA } from "./populationModel";

test("HM-RATINGS-0.6: generateGamePriorCA is deterministic -- same playerId/shift/version always produces the same value", () => {
  assert.equal(generateGamePriorCA("p1", 0, "v1"), generateGamePriorCA("p1", 0, "v1"));
});

test("HM-RATINGS-0.6: generateGamePriorCA stays within the 1-200 scale for a wide range of shifts", () => {
  for (const shift of [-20, -6, 0, 6, 20]) {
    for (const id of ["a", "b", "c", "d", "e"]) {
      const ca = generateGamePriorCA(id, shift, "v1");
      assert.ok(ca >= CA_MIN && ca <= CA_MAX, `ca ${ca} out of range for shift ${shift}`);
    }
  }
});

test("HM-RATINGS-0.6: generateGamePriorCA differs across players (not a constant function)", () => {
  const values = new Set(Array.from({ length: 30 }, (_, i) => generateGamePriorCA(`player_${i}`, 0, "v1")));
  assert.ok(values.size > 5, "expected meaningful spread across many players");
});

test("HM-RATINGS-0.6: a positive club shift never produces a lower CA than the same player with a negative shift (monotonic in shift, holding jitter's sign aside on average)", () => {
  // Not a strict per-player guarantee (jitter is added on top), but the
  // baseline shift itself must move the same direction for everyone.
  const withPositive = generateGamePriorCA("shift_test_player", 6, "v1");
  const withNegative = generateGamePriorCA("shift_test_player", -6, "v1");
  assert.ok(withPositive > withNegative);
});

test("HM-RATINGS-0.6: generateGamePriorPA is deterministic and never below CA", () => {
  for (const ca of [96, 110, 130, 148]) {
    const pa1 = generateGamePriorPA("p1", ca, "v1");
    const pa2 = generateGamePriorPA("p1", ca, "v1");
    assert.equal(pa1, pa2);
    assert.ok(pa1 >= ca, `pa ${pa1} below ca ${ca}`);
  }
});

test("HM-RATINGS-0.6: generateGamePriorPA's bonus is small and bounded (never a wonderkid-style inflation)", () => {
  for (const id of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    const ca = 130;
    const pa = generateGamePriorPA(id, ca, "v1");
    assert.ok(pa - ca <= 16, `PA bonus ${pa - ca} too large`);
  }
});
