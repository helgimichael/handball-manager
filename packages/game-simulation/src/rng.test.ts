import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng, seedFromString, nextGaussian } from "./rng";

test("identical seed produces identical sequence", () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = Array.from({ length: 20 }, () => a.nextFloat());
  const seqB = Array.from({ length: 20 }, () => b.nextFloat());
  assert.deepEqual(seqA, seqB);
});

test("different seeds produce different sequences", () => {
  const a = createRng(1);
  const b = createRng(2);
  const seqA = Array.from({ length: 10 }, () => a.nextFloat());
  const seqB = Array.from({ length: 10 }, () => b.nextFloat());
  assert.notDeepEqual(seqA, seqB);
});

test("nextFloat stays within [0, 1)", () => {
  const rng = createRng(7);
  for (let i = 0; i < 500; i += 1) {
    const v = rng.nextFloat();
    assert.ok(v >= 0 && v < 1, `value out of range: ${v}`);
  }
});

test("nextInt respects inclusive bounds", () => {
  const rng = createRng(123);
  for (let i = 0; i < 500; i += 1) {
    const v = rng.nextInt(5, 9);
    assert.ok(v >= 5 && v <= 9 && Number.isInteger(v));
  }
});

test("seedFromString is deterministic and varies with input", () => {
  assert.equal(seedFromString("save1:fixture1"), seedFromString("save1:fixture1"));
  assert.notEqual(seedFromString("save1:fixture1"), seedFromString("save1:fixture2"));
});

test("nextGaussian stays within clamped bounds across many samples", () => {
  const rng = createRng(99);
  for (let i = 0; i < 500; i += 1) {
    const v = nextGaussian(rng, 26, 3, 16, 40);
    assert.ok(v >= 16 && v <= 40, `value out of bounds: ${v}`);
    assert.ok(!Number.isNaN(v));
  }
});
