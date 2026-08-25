// HM-COURT-GRID-0.2 Part M: proves the manually supplied calibration was
// transcribed exactly, and that the module's own domain guarantees hold
// (deterministic, no mutation of courtGrid, multi-cell roles preserved,
// same cell legally different per context).
import { test } from "node:test";
import assert from "node:assert/strict";
import { allGridCells, COURT_GRID_DEFINITION } from "./courtGrid";
import {
  allCalibratedCells,
  attackTacticalPositionForCell,
  ATTACK_POSITION_CALIBRATION,
  ATTACK_TACTICAL_TO_ENGINE_POSITION,
  defenceCourtSlotForPosition,
  defencePositionForCourtSlot,
  defenceTacticalPositionForCell,
  DEFENCE_FORMATION_CALIBRATIONS,
  getAcceptedCellsForPosition,
  getAttackPositionCalibration,
  getDefenceFormationCalibration,
  getPositionsForCell,
  isCellValidForPosition,
  isValidCanonicalCell,
  preferredCellForPosition,
} from "./tacticalPositionCalibration";

function cellsOf(id: string, list: readonly { id: string; acceptedCells: readonly number[] }[]): readonly number[] {
  return list.find((p) => p.id === id)!.acceptedCells;
}

// ATTACK (1-7)
test("HM-COURT-GRID-0.2 (1): ATTACK V6 = [1]", () => assert.deepEqual(cellsOf("V6", ATTACK_POSITION_CALIBRATION), [1]));
test("HM-COURT-GRID-0.2 (2): ATTACK H6 = [10]", () => assert.deepEqual(cellsOf("H6", ATTACK_POSITION_CALIBRATION), [10]));
test("HM-COURT-GRID-0.3 (5): ATTACK V9 = [41,51,52]", () => assert.deepEqual(cellsOf("V9", ATTACK_POSITION_CALIBRATION), [41, 51, 52]));
test("HM-COURT-GRID-0.3 (6): ATTACK H9 = [50,59,60]", () => assert.deepEqual(cellsOf("H9", ATTACK_POSITION_CALIBRATION), [50, 59, 60]));
test("HM-COURT-GRID-0.2 (5): ATTACK M6_LEFT = [34]", () => assert.deepEqual(cellsOf("M6_LEFT", ATTACK_POSITION_CALIBRATION), [34]));
test("HM-COURT-GRID-0.2 (6): ATTACK M6_RIGHT = [37]", () => assert.deepEqual(cellsOf("M6_RIGHT", ATTACK_POSITION_CALIBRATION), [37]));
test("HM-COURT-GRID-0.3 (7): ATTACK LEFT_M9 = [64]", () => assert.deepEqual(cellsOf("LEFT_M9", ATTACK_POSITION_CALIBRATION), [64]));
test("HM-COURT-GRID-0.3 (8): ATTACK M9 = [65,66]", () => assert.deepEqual(cellsOf("M9", ATTACK_POSITION_CALIBRATION), [65, 66]));
test("HM-COURT-GRID-0.3 (9): ATTACK RIGHT_M9 = [67]", () => assert.deepEqual(cellsOf("RIGHT_M9", ATTACK_POSITION_CALIBRATION), [67]));
test("HM-COURT-GRID-0.3: LEFT_M9/M9/RIGHT_M9 are distinct tactical positions, never collapsed into one generic M9 role", () => {
  const ids = ATTACK_POSITION_CALIBRATION.map((p) => p.id);
  assert.ok(ids.includes("LEFT_M9") && ids.includes("M9") && ids.includes("RIGHT_M9"));
  assert.equal(new Set(ids).size, ids.length, "every attack position id is unique");
});

// 6:0 (8-13)
test("HM-COURT-GRID-0.2 (8): 6-0 V1 = [181]", () => assert.deepEqual(cellsOf("V1", DEFENCE_FORMATION_CALIBRATIONS["6-0"].positions), [181]));
test("HM-COURT-GRID-0.2 (9): 6-0 H1 = [190]", () => assert.deepEqual(cellsOf("H1", DEFENCE_FORMATION_CALIBRATIONS["6-0"].positions), [190]));
test("HM-COURT-GRID-0.2 (10): 6-0 V2 = [163]", () => assert.deepEqual(cellsOf("V2", DEFENCE_FORMATION_CALIBRATIONS["6-0"].positions), [163]));
test("HM-COURT-GRID-0.2 (11): 6-0 H2 = [168]", () => assert.deepEqual(cellsOf("H2", DEFENCE_FORMATION_CALIBRATIONS["6-0"].positions), [168]));
test("HM-COURT-GRID-0.2 (12): 6-0 V3 = [165]", () => assert.deepEqual(cellsOf("V3", DEFENCE_FORMATION_CALIBRATIONS["6-0"].positions), [165]));
test("HM-COURT-GRID-0.2 (13): 6-0 H3 = [166]", () => assert.deepEqual(cellsOf("H3", DEFENCE_FORMATION_CALIBRATIONS["6-0"].positions), [166]));

// 5:1 (14-19)
test("HM-COURT-GRID-0.2 (14): 5-1 V1 = [181]", () => assert.deepEqual(cellsOf("V1", DEFENCE_FORMATION_CALIBRATIONS["5-1"].positions), [181]));
test("HM-COURT-GRID-0.2 (15): 5-1 H1 = [190]", () => assert.deepEqual(cellsOf("H1", DEFENCE_FORMATION_CALIBRATIONS["5-1"].positions), [190]));
test("HM-COURT-GRID-0.2 (16): 5-1 V2 = [163]", () => assert.deepEqual(cellsOf("V2", DEFENCE_FORMATION_CALIBRATIONS["5-1"].positions), [163]));
test("HM-COURT-GRID-0.2 (17): 5-1 H2 = [168]", () => assert.deepEqual(cellsOf("H2", DEFENCE_FORMATION_CALIBRATIONS["5-1"].positions), [168]));
test("HM-COURT-GRID-0.2 (18): 5-1 CH = [165,166]", () => assert.deepEqual(cellsOf("CH", DEFENCE_FORMATION_CALIBRATIONS["5-1"].positions), [165, 166]));
test("HM-COURT-GRID-0.2 (19): 5-1 CENTER = [145,146]", () => assert.deepEqual(cellsOf("CENTER", DEFENCE_FORMATION_CALIBRATIONS["5-1"].positions), [145, 146]));

// 3:2:1 (20-25)
test("HM-COURT-GRID-0.2 (20): 3-2-1 VB = [181]", () => assert.deepEqual(cellsOf("VB", DEFENCE_FORMATION_CALIBRATIONS["3-2-1"].positions), [181]));
test("HM-COURT-GRID-0.2 (21): 3-2-1 HB = [190]", () => assert.deepEqual(cellsOf("HB", DEFENCE_FORMATION_CALIBRATIONS["3-2-1"].positions), [190]));
test("HM-COURT-GRID-0.2 (22): 3-2-1 VHB = [153]", () => assert.deepEqual(cellsOf("VHB", DEFENCE_FORMATION_CALIBRATIONS["3-2-1"].positions), [153]));
test("HM-COURT-GRID-0.2 (23): 3-2-1 HHB = [158]", () => assert.deepEqual(cellsOf("HHB", DEFENCE_FORMATION_CALIBRATIONS["3-2-1"].positions), [158]));
test("HM-COURT-GRID-0.2 (24): 3-2-1 CH = [165,166]", () => assert.deepEqual(cellsOf("CH", DEFENCE_FORMATION_CALIBRATIONS["3-2-1"].positions), [165, 166]));
test("HM-COURT-GRID-0.2 (25): 3-2-1 CENTER = [145,146]", () => assert.deepEqual(cellsOf("CENTER", DEFENCE_FORMATION_CALIBRATIONS["3-2-1"].positions), [145, 146]));

// 3:3 (26-31)
test("HM-COURT-GRID-0.2 (26): 3-3 VB = [172]", () => assert.deepEqual(cellsOf("VB", DEFENCE_FORMATION_CALIBRATIONS["3-3"].positions), [172]));
test("HM-COURT-GRID-0.2 (27): 3-3 HB = [179]", () => assert.deepEqual(cellsOf("HB", DEFENCE_FORMATION_CALIBRATIONS["3-3"].positions), [179]));
test("HM-COURT-GRID-0.2 (28): 3-3 MB = [165,166]", () => assert.deepEqual(cellsOf("MB", DEFENCE_FORMATION_CALIBRATIONS["3-3"].positions), [165, 166]));
test("HM-COURT-GRID-0.2 (29): 3-3 VF = [152]", () => assert.deepEqual(cellsOf("VF", DEFENCE_FORMATION_CALIBRATIONS["3-3"].positions), [152]));
test("HM-COURT-GRID-0.2 (30): 3-3 HF = [159]", () => assert.deepEqual(cellsOf("HF", DEFENCE_FORMATION_CALIBRATIONS["3-3"].positions), [159]));
test("HM-COURT-GRID-0.2 (31): 3-3 MITTEN_FRAM = [145,146]", () => assert.deepEqual(cellsOf("MITTEN_FRAM", DEFENCE_FORMATION_CALIBRATIONS["3-3"].positions), [145, 146]));

// 4:2 (32-37)
test("HM-COURT-GRID-0.2 (32): 4-2 V1 = [172]", () => assert.deepEqual(cellsOf("V1", DEFENCE_FORMATION_CALIBRATIONS["4-2"].positions), [172]));
test("HM-COURT-GRID-0.2 (33): 4-2 H1 = [179]", () => assert.deepEqual(cellsOf("H1", DEFENCE_FORMATION_CALIBRATIONS["4-2"].positions), [179]));
test("HM-COURT-GRID-0.2 (34): 4-2 V2 = [163]", () => assert.deepEqual(cellsOf("V2", DEFENCE_FORMATION_CALIBRATIONS["4-2"].positions), [163]));
test("HM-COURT-GRID-0.2 (35): 4-2 H2 = [168]", () => assert.deepEqual(cellsOf("H2", DEFENCE_FORMATION_CALIBRATIONS["4-2"].positions), [168]));
test("HM-COURT-GRID-0.2 (36): 4-2 VF = [144]", () => assert.deepEqual(cellsOf("VF", DEFENCE_FORMATION_CALIBRATIONS["4-2"].positions), [144]));
test("HM-COURT-GRID-0.2 (37): 4-2 HF = [147]", () => assert.deepEqual(cellsOf("HF", DEFENCE_FORMATION_CALIBRATIONS["4-2"].positions), [147]));

// 38: every referenced cell exists in canonical 1-200 grid
test("HM-COURT-GRID-0.2 (38): every referenced cell exists in the canonical 1-200 grid", () => {
  const canonicalCells = new Set(allGridCells().map((c) => c.cellNumber));
  for (const cell of allCalibratedCells()) {
    assert.ok(canonicalCells.has(cell), `cell ${cell} must exist in the canonical grid`);
    assert.ok(isValidCanonicalCell(cell));
  }
  assert.ok(allCalibratedCells().length > 0);
});

// 39: no calibration mutates courtGrid
test("HM-COURT-GRID-0.2 (39): the calibration module never mutates courtGrid's own frozen definition", () => {
  assert.ok(Object.isFrozen(COURT_GRID_DEFINITION));
  const before = JSON.stringify(COURT_GRID_DEFINITION);
  getAttackPositionCalibration();
  getDefenceFormationCalibration("6-0");
  getPositionsForCell("ATTACK", 1);
  assert.equal(JSON.stringify(COURT_GRID_DEFINITION), before);
});

// 40: same cell, different role meaning per context
test("HM-COURT-GRID-0.2 (40): cell 165 legally means V3 in 6:0, CH in 5:1 and 3:2:1, MB in 3:3 -- same cell, different tactical meaning per context", () => {
  assert.equal(getPositionsForCell("6-0", 165)[0]!.id, "V3");
  assert.equal(getPositionsForCell("5-1", 165)[0]!.id, "CH");
  assert.equal(getPositionsForCell("3-2-1", 165)[0]!.id, "CH");
  assert.equal(getPositionsForCell("3-3", 165)[0]!.id, "MB");
});

// 41: multi-cell roles preserve every supplied accepted cell
test("HM-COURT-GRID-0.2 (41): multi-cell positions preserve every supplied accepted cell -- never collapsed to one cell or an average", () => {
  assert.deepEqual(getAcceptedCellsForPosition("ATTACK", "M9"), [65, 66]);
  assert.deepEqual(getAcceptedCellsForPosition("5-1", "CH"), [165, 166]);
  assert.deepEqual(getAcceptedCellsForPosition("5-1", "CENTER"), [145, 146]);
  assert.deepEqual(getAcceptedCellsForPosition("3-2-1", "CH"), [165, 166]);
  assert.deepEqual(getAcceptedCellsForPosition("3-2-1", "CENTER"), [145, 146]);
  assert.deepEqual(getAcceptedCellsForPosition("3-3", "MB"), [165, 166]);
  assert.deepEqual(getAcceptedCellsForPosition("3-3", "MITTEN_FRAM"), [145, 146]);
  assert.ok(isCellValidForPosition("ATTACK", "M9", 65));
  assert.ok(isCellValidForPosition("ATTACK", "M9", 66));
  assert.ok(!isCellValidForPosition("ATTACK", "M9", 64));
});

// 42: output deterministic
test("HM-COURT-GRID-0.2 (42): calibration lookups are deterministic -- repeated calls return identical results", () => {
  assert.deepEqual(getAttackPositionCalibration(), getAttackPositionCalibration());
  assert.deepEqual(getDefenceFormationCalibration("3-3"), getDefenceFormationCalibration("3-3"));
  assert.deepEqual(getPositionsForCell("ATTACK", 1), getPositionsForCell("ATTACK", 1));
});

test("HM-COURT-GRID-0.2: every attack and defence-formation position list has exactly 6 or 7 positions as specified, no extras added (Part C)", () => {
  assert.equal(ATTACK_POSITION_CALIBRATION.length, 9);
  for (const formation of ["6-0", "5-1", "3-2-1", "3-3", "4-2"] as const) {
    assert.equal(DEFENCE_FORMATION_CALIBRATIONS[formation].positions.length, 6);
  }
});

test("HM-COURT-GRID-0.2: no position within the same context shares an accepted cell with another position in that same context", () => {
  function assertNoOverlap(positions: readonly { id: string; acceptedCells: readonly number[] }[]) {
    const seen = new Map<number, string>();
    for (const p of positions) {
      for (const c of p.acceptedCells) {
        const owner = seen.get(c);
        assert.ok(!owner || owner === p.id, `cell ${c} claimed by both ${owner} and ${p.id}`);
        seen.set(c, p.id);
      }
    }
  }
  assertNoOverlap(ATTACK_POSITION_CALIBRATION);
  for (const formation of ["6-0", "5-1", "3-2-1", "3-3", "4-2"] as const) {
    assertNoOverlap(DEFENCE_FORMATION_CALIBRATIONS[formation].positions);
  }
});

// -- HM-COURT-GRID-0.3: engine-position mapping, cell->position lookup, courtSlot ordering --

test("HM-COURT-GRID-0.3: LEFT_M9/M9/RIGHT_M9 all resolve to engine Position 'M9', M6_LEFT/M6_RIGHT both resolve to 'M6' -- Match Engine inputs unchanged in meaning", () => {
  assert.equal(ATTACK_TACTICAL_TO_ENGINE_POSITION.LEFT_M9, "M9");
  assert.equal(ATTACK_TACTICAL_TO_ENGINE_POSITION.M9, "M9");
  assert.equal(ATTACK_TACTICAL_TO_ENGINE_POSITION.RIGHT_M9, "M9");
  assert.equal(ATTACK_TACTICAL_TO_ENGINE_POSITION.M6_LEFT, "M6");
  assert.equal(ATTACK_TACTICAL_TO_ENGINE_POSITION.M6_RIGHT, "M6");
  assert.equal(ATTACK_TACTICAL_TO_ENGINE_POSITION.V6, "V6");
  assert.equal(ATTACK_TACTICAL_TO_ENGINE_POSITION.H6, "H6");
});

test("HM-COURT-GRID-0.3: attackTacticalPositionForCell resolves every calibrated cell to exactly its own position, and null for an uncalibrated cell", () => {
  assert.equal(attackTacticalPositionForCell(64)!.id, "LEFT_M9");
  assert.equal(attackTacticalPositionForCell(65)!.id, "M9");
  assert.equal(attackTacticalPositionForCell(66)!.id, "M9");
  assert.equal(attackTacticalPositionForCell(67)!.id, "RIGHT_M9");
  assert.equal(attackTacticalPositionForCell(41)!.id, "V9");
  assert.equal(attackTacticalPositionForCell(52)!.id, "V9");
  assert.equal(attackTacticalPositionForCell(34)!.id, "M6_LEFT");
  assert.equal(attackTacticalPositionForCell(999), null);
});

test("HM-COURT-GRID-0.3: preferredCellForPosition returns the documented migration default, always a member of acceptedCells", () => {
  assert.equal(preferredCellForPosition("ATTACK", "V9"), 51);
  assert.equal(preferredCellForPosition("ATTACK", "H9"), 60);
  assert.equal(preferredCellForPosition("ATTACK", "M9"), 65);
  assert.equal(preferredCellForPosition("ATTACK", "V6"), 1);
  assert.equal(preferredCellForPosition("ATTACK", "M6_LEFT"), 34);
  for (const formation of ["6-0", "5-1", "3-2-1", "3-3", "4-2"] as const) {
    for (const p of DEFENCE_FORMATION_CALIBRATIONS[formation].positions) {
      const preferred = preferredCellForPosition(formation, p.id);
      assert.ok(preferred !== null && p.acceptedCells.includes(preferred));
    }
  }
});

test("HM-COURT-GRID-0.3: defenceCourtSlotForPosition for 6:0 reproduces the existing V1=1,V2=2,V3=3,H3=4,H2=5,H1=6 courtSlot numbering exactly", () => {
  assert.equal(defenceCourtSlotForPosition("6-0", "V1"), 1);
  assert.equal(defenceCourtSlotForPosition("6-0", "V2"), 2);
  assert.equal(defenceCourtSlotForPosition("6-0", "V3"), 3);
  assert.equal(defenceCourtSlotForPosition("6-0", "H3"), 4);
  assert.equal(defenceCourtSlotForPosition("6-0", "H2"), 5);
  assert.equal(defenceCourtSlotForPosition("6-0", "H1"), 6);
});

test("HM-COURT-GRID-0.3: defencePositionForCourtSlot is the exact inverse of defenceCourtSlotForPosition, for every formation and slot 1-6", () => {
  for (const formation of ["6-0", "5-1", "3-2-1", "3-3", "4-2"] as const) {
    for (let slot = 1; slot <= 6; slot++) {
      const position = defencePositionForCourtSlot(formation, slot)!;
      assert.equal(defenceCourtSlotForPosition(formation, position.id), slot);
    }
  }
});

test("HM-COURT-GRID-0.3: defenceTacticalPositionForCell resolves a formation's own calibrated cells correctly and is context-scoped (same cell, different position, matching context 40)", () => {
  assert.equal(defenceTacticalPositionForCell("6-0", 165)!.id, "V3");
  assert.equal(defenceTacticalPositionForCell("5-1", 165)!.id, "CH");
  assert.equal(defenceTacticalPositionForCell("3-2-1", 165)!.id, "CH");
  assert.equal(defenceTacticalPositionForCell("3-3", 165)!.id, "MB");
  assert.equal(defenceTacticalPositionForCell("6-0", 999), null);
});
