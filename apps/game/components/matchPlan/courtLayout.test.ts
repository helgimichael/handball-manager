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

test("HM-MATCH-1.3B2 Part 4: attack orientation -- V6/V9 render on the screen-viewer's RIGHT (high xPct), H6/H9 on the LEFT (low xPct), the accepted coach-facing handball convention (verified visually in-browser and confirmed here so it never regresses)", () => {
  const byKey = new Map(ATTACK_NORMAL_LAYOUT.map((s) => [s.key, s]));
  assert.ok(byKey.get("V6")!.xPct > 50, "V6 must be on the right half of the board");
  assert.ok(byKey.get("H6")!.xPct < 50, "H6 must be on the left half of the board");
  assert.ok(byKey.get("V9")!.xPct > 50, "V9 must be on the right half of the board");
  assert.ok(byKey.get("H9")!.xPct < 50, "H9 must be on the left half of the board");
});

test("HM-MATCH-1.3B2 Part 4: defence orientation matches attack's -- courtSlot 1 (V1) renders on the same (right) side as V6/V9, courtSlot 6 (H1) on the same (left) side as H6/H9, one consistent coach-facing convention across the whole board", () => {
  const attack = new Map(ATTACK_NORMAL_LAYOUT.map((s) => [s.key, s]));
  const defence = defenceLayout("6-0");
  const slot1 = defence.find((s) => s.key === "1")!;
  const slot6 = defence.find((s) => s.key === "6")!;
  assert.ok((slot1.xPct > 50) === (attack.get("V6")!.xPct > 50), "courtSlot 1 (V1) must be on the same side as V6");
  assert.ok((slot6.xPct > 50) === (attack.get("H6")!.xPct > 50), "courtSlot 6 (H1) must be on the same side as H6");
  assert.ok(slot1.xPct > slot6.xPct, "V1 must render to the right of H1");
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
