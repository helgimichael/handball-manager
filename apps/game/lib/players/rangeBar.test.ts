import { test } from "node:test";
import assert from "node:assert/strict";
import { rangeBarGeometry, starRangeCells } from "./rangeBar";

test("range bar places a star range on the 1-5 track", () => {
  const g = rangeBarGeometry({ min: 2, max: 4 });
  assert.equal(g.left, 25);
  assert.equal(g.width, 50);
  assert.equal(g.mid, 3);
  assert.equal(g.exact, false);
});

test("an exact estimate still gets a visible band and is flagged exact", () => {
  const g = rangeBarGeometry({ min: 5, max: 5 });
  assert.equal(g.exact, true);
  assert.ok(g.width >= 4);
  assert.ok(g.left + g.width <= 100);
});

test("ranges outside the scale are clamped, reversed bounds are normalised", () => {
  const g = rangeBarGeometry({ min: 9, max: 0 }, 0, 4);
  assert.equal(g.left, 0);
  assert.equal(g.width, 100);
});

test("star cells light only the range", () => {
  assert.deepEqual(starRangeCells({ min: 2, max: 3 }), [false, true, true, false, false]);
});
