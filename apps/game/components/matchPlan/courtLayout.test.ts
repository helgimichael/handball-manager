// HM-TACTICS-1.2 Part 4: pure-function coverage for the court chip
// layout tables -- proves formation changes actually move the visual
// depth (not just relabel the same fixed grid) and that the 7v6 arc
// layout always produces exactly as many distinct slots as requested.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTACK_NORMAL_LAYOUT, defenceLayout, sevenVSixAttackLayout } from "./courtLayout";
import { DEFENCE_FORMATION_OPTIONS } from "./courtScene";

test("HM-TACTICS-1.2: ATTACK_NORMAL_LAYOUT has exactly one slot per outcourt position plus GK", () => {
  const keys = ATTACK_NORMAL_LAYOUT.map((s) => s.key);
  assert.deepEqual(new Set(keys), new Set(["GK", "V6", "V9", "M9", "H9", "H6", "M6"]));
});

test("HM-TACTICS-1.2: sevenVSixAttackLayout always returns exactly `count` distinct slots, keyed 0..count-1", () => {
  const layout = sevenVSixAttackLayout(7);
  assert.equal(layout.length, 7);
  assert.deepEqual(
    layout.map((s) => s.key),
    ["0", "1", "2", "3", "4", "5", "6"],
  );
});

test("HM-TACTICS-1.2: defenceLayout always includes a GK slot plus courtSlot 1-6, for every named base formation", () => {
  for (const formation of DEFENCE_FORMATION_OPTIONS) {
    const layout = defenceLayout(formation);
    assert.deepEqual(
      layout.map((s) => s.key).sort(),
      ["1", "2", "3", "4", "5", "6", "GK"].sort(),
    );
  }
});

test("HM-TACTICS-1.2: switching base formation changes at least one court slot's visual depth -- formations are not just relabeled copies of the same flat line", () => {
  const flat = new Map(defenceLayout("6-0").map((s) => [s.key, s.yPct]));
  for (const formation of DEFENCE_FORMATION_OPTIONS) {
    if (formation === "6-0") continue;
    const layout = defenceLayout(formation);
    const changed = layout.some((s) => flat.get(s.key) !== s.yPct);
    assert.ok(changed, `${formation} should visually differ from the flat 6-0 line`);
  }
});

test("HM-TACTICS-1.2: defenceLayout falls back to 6-0's depths for an unrecognized formation string, never throwing", () => {
  const fallback = defenceLayout("unknown-formation");
  assert.deepEqual(fallback, defenceLayout("6-0"));
});
