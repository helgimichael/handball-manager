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

test("HM-MATCH-1.2: sevenVSixAttackLayout always returns exactly one slot per position given, keyed 0..count-1", () => {
  const layout = sevenVSixAttackLayout(["V6", "V9", "M9", "H9", "H6", "M6", "M6"]);
  assert.equal(layout.length, 7);
  assert.deepEqual(
    layout.map((s) => s.key),
    ["0", "1", "2", "3", "4", "5", "6"],
  );
});

test("HM-MATCH-1.2: sevenVSixAttackLayout gives the duplicated position (e.g. two M6) two visually distinct chip positions, never an exact overlap", () => {
  const layout = sevenVSixAttackLayout(["V6", "V9", "M9", "H9", "H6", "M6", "M6"]);
  const [firstM6, secondM6] = [layout[5], layout[6]];
  assert.notEqual(firstM6.xPct, secondM6.xPct, "the two M6 slots must not render at the exact same x position");
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

test("HM-MATCH-1.2 Part F: every pair of named base formations is visually distinct from every other -- 5:1 is not just '6:0 with one player moved', it is also distinct from 3:2:1/3:3/4:2, and so on for every pair", () => {
  const layoutsByFormation = new Map(DEFENCE_FORMATION_OPTIONS.map((f) => [f, defenceLayout(f)]));
  for (const a of DEFENCE_FORMATION_OPTIONS) {
    for (const b of DEFENCE_FORMATION_OPTIONS) {
      if (a === b) continue;
      const layoutA = new Map(layoutsByFormation.get(a)!.map((s) => [s.key, s.yPct]));
      const layoutB = layoutsByFormation.get(b)!;
      const differs = layoutB.some((s) => layoutA.get(s.key) !== s.yPct);
      assert.ok(differs, `${a} and ${b} must not render identical depth geometry`);
    }
  }
});
