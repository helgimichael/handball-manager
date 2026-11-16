// Arena Nights SYS-02e -- court grid keyboard nudge stays on the canonical 20x10 grid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isNudgeKey, nudgeCell } from "./courtGridNudge";

test("nudgeCell starts at cell 1 when nothing is inspected", () => {
  assert.equal(nudgeCell(null, "ArrowRight").cellNumber, 1);
});

test("nudgeCell moves one step and clamps at the edges", () => {
  assert.equal(nudgeCell(1, "ArrowRight").cellNumber, 2);
  assert.equal(nudgeCell(1, "ArrowDown").cellNumber, 11);
  assert.equal(nudgeCell(1, "ArrowUp").cellNumber, 1);
  assert.equal(nudgeCell(1, "ArrowLeft").cellNumber, 1);
  assert.equal(nudgeCell(200, "ArrowDown").cellNumber, 200);
  assert.equal(nudgeCell(10, "ArrowRight").cellNumber, 10);
  assert.equal(nudgeCell(55, "ArrowUp").cellId, "R5C5");
});

test("isNudgeKey only accepts arrows", () => {
  assert.ok(isNudgeKey("ArrowUp"));
  assert.ok(!isNudgeKey("a"));
});
