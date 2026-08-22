import { test } from "node:test";
import assert from "node:assert/strict";
import { seededOffset } from "./deterministicVariation";

test("HM-RATINGS-0.4: seededOffset is deterministic -- same seed key always returns the same offset", () => {
  assert.equal(seededOffset("player_a:PASSING:v1", 1), seededOffset("player_a:PASSING:v1", 1));
});

test("HM-RATINGS-0.4: seededOffset is bounded to [-magnitude, magnitude]", () => {
  for (const key of ["a", "b", "c", "player_x:ATTR:v1", "player_y:ATTR:v1", "zzzzz"]) {
    const offset = seededOffset(key, 1);
    assert.ok(offset >= -1 && offset <= 1);
  }
});

test("HM-RATINGS-0.4: seededOffset returns 0 for a non-positive magnitude", () => {
  assert.equal(seededOffset("anything", 0), 0);
});

test("HM-RATINGS-0.4: seededOffset varies across different seed keys (not a constant function)", () => {
  const offsets = new Set<number>();
  for (let i = 0; i < 20; i++) offsets.add(seededOffset(`seed_${i}`, 2));
  assert.ok(offsets.size > 1, "expected seededOffset to produce more than one distinct value across many seeds");
});
