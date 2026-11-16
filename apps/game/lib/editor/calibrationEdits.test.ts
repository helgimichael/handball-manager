// Arena Nights SYS-02a/02b -- dirty cells, undo stack and saved-vs-draft diff are pure and exact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { countDirtyCells, dirtyFields, pickBefore, popEditStep, pushEditStep, recordDiff, revertPatch, UNDO_LIMIT, type EditStep } from "./calibrationEdits";

const base = { playerId: "p1", primaryPosition: "MV", dateOfBirth: "2000-01-01", birthYear: 2000, defaultSquadStatus: null, specialTags: ["CAPTAIN"], ca: 120, pa: 150, fullName: "A" };
type Row = typeof base;

test("dirtyFields: only the edited cells, arrays compared by value", () => {
  assert.deepEqual([...dirtyFields(base, base)], []);
  assert.deepEqual([...dirtyFields({ ...base, specialTags: ["CAPTAIN"] }, base)], []);
  assert.deepEqual([...dirtyFields({ ...base, ca: 125, specialTags: [] }, base)].sort(), ["ca", "specialTags"]);
  assert.deepEqual([...dirtyFields(base, undefined)], []);
});

test("countDirtyCells sums across rows", () => {
  const rows = [{ ...base, ca: 1 }, { ...base, playerId: "p2", pa: 1, primaryPosition: "V6" }];
  assert.equal(countDirtyCells(rows, { p1: base, p2: { ...base, playerId: "p2" } }), 3);
});

test("revertPatch restores every editable field and nothing else", () => {
  const patch = revertPatch(base);
  assert.equal(patch.ca, 120);
  assert.ok(!("fullName" in patch));
});

test("pushEditStep collapses consecutive edits of the same cell, keeps the first 'before'", () => {
  let stack: EditStep<Row>[] = [];
  stack = pushEditStep(stack, { playerId: "p1", before: { ca: 120 } });
  stack = pushEditStep(stack, { playerId: "p1", before: { ca: 1 } });
  stack = pushEditStep(stack, { playerId: "p1", before: { ca: 12 } });
  assert.equal(stack.length, 1);
  assert.deepEqual(stack[0]!.before, { ca: 120 });
  stack = pushEditStep(stack, { playerId: "p1", before: { pa: 150 } });
  stack = pushEditStep(stack, { playerId: "p2", before: { pa: 150 } });
  assert.equal(stack.length, 3);
  const { step, rest } = popEditStep(stack);
  assert.equal(step?.playerId, "p2");
  assert.equal(rest.length, 2);
  assert.deepEqual(popEditStep([]), { step: undefined, rest: [] });
});

test("pushEditStep caps the stack", () => {
  let stack: EditStep<Row>[] = [];
  for (let i = 0; i < UNDO_LIMIT + 10; i++) stack = pushEditStep(stack, { playerId: `p${i}`, before: { ca: i } });
  assert.equal(stack.length, UNDO_LIMIT);
  assert.equal(stack[0]!.playerId, "p10");
});

test("pickBefore picks only the given keys", () => {
  assert.deepEqual(pickBefore(base, ["ca", "pa"]), { ca: 120, pa: 150 });
});

test("recordDiff lists changed fields per section, nested values by value", () => {
  const saved = { player: { firstName: "A", nationalities: ["SE"] }, roster: { shirtNumber: 7, contract: { untilDate: null } } };
  assert.deepEqual(recordDiff(saved, structuredClone(saved)), []);
  const draft = { player: { firstName: "B", nationalities: ["SE"] }, roster: { shirtNumber: 7, contract: { untilDate: "2027-06-30" } } };
  assert.deepEqual(recordDiff(saved, draft).map((d) => `${d.section}.${d.field}`), ["player.firstName", "roster.contract"]);
});
