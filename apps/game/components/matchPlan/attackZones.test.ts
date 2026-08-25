// HM-MATCH-1.3B2 Part 1/2/3: pure-function coverage for the snap-zone
// projection -- proves it is a deterministic, one-occupant-per-zone
// mapping of `attackStartingUnit.slots`, never separate UI state.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTACK_ZONE_IDS, ATTACK_ZONE_LAYOUT, ATTACK_ZONE_POSITION, projectSlotsOntoZones } from "./attackZones";

const NORMAL_SLOTS = [
  { playerId: "gk", position: "GK" as const },
  { playerId: "p_v6", position: "V6" as const },
  { playerId: "p_v9", position: "V9" as const },
  { playerId: "p_m9", position: "M9" as const },
  { playerId: "p_h9", position: "H9" as const },
  { playerId: "p_h6", position: "H6" as const },
  { playerId: "p_m6", position: "M6" as const },
];

test("HM-MATCH-1.3B2: every zone has a coordinate, and each zone's home position is a recognized outcourt position", () => {
  for (const zoneId of ATTACK_ZONE_IDS) {
    const layout = ATTACK_ZONE_LAYOUT[zoneId];
    assert.ok(Number.isFinite(layout.xPct) && Number.isFinite(layout.yPct));
    assert.ok(["V6", "V9", "M9", "H9", "H6", "M6"].includes(ATTACK_ZONE_POSITION[zoneId]));
  }
});

test("HM-MATCH-1.3B2: the three pivot zones (PIVOT_LEFT/CENTRE/RIGHT) all produce tactical position M6", () => {
  assert.equal(ATTACK_ZONE_POSITION.PIVOT_LEFT, "M6");
  assert.equal(ATTACK_ZONE_POSITION.PIVOT_CENTRE, "M6");
  assert.equal(ATTACK_ZONE_POSITION.PIVOT_RIGHT, "M6");
});

test("HM-MATCH-1.3B2: a standard 1-of-each-position lineup projects each outcourt slot onto exactly its own home zone -- no zone doubles up, none is left empty", () => {
  const projection = projectSlotsOntoZones(NORMAL_SLOTS);
  assert.equal(projection.V6, 1);
  assert.equal(projection.V9, 2);
  assert.equal(projection.M9, 3);
  assert.equal(projection.H9, 4);
  assert.equal(projection.H6, 5);
  assert.equal(projection.PIVOT_CENTRE, 6);
  assert.equal(projection.PIVOT_LEFT, null);
  assert.equal(projection.PIVOT_RIGHT, null);
});

test("HM-MATCH-1.3B2 Part 1/5: a 'two pivots, no centre-back' shape (the milestone's own example) projects onto two DISTINCT pivot zones, and only one occupant ever exists per zone", () => {
  const twoPivotSlots = [
    { playerId: "gk", position: "GK" as const },
    { playerId: "p_v6", position: "V6" as const },
    { playerId: "p_v9", position: "V9" as const },
    { playerId: "p_h9", position: "H9" as const }, // M9 moved to pivot
    { playerId: "p_h6", position: "H6" as const },
    { playerId: "p_m6_a", position: "M6" as const },
    { playerId: "p_m6_b", position: "M6" as const }, // the ex-M9 player, now a second pivot
  ];
  const projection = projectSlotsOntoZones(twoPivotSlots);
  const occupiedZones = ATTACK_ZONE_IDS.filter((z) => projection[z] !== null);
  const occupiedSlotIndexes = occupiedZones.map((z) => projection[z]);
  assert.equal(occupiedZones.length, 6, "exactly 6 outcourt zones must be occupied");
  assert.equal(new Set(occupiedSlotIndexes).size, occupiedSlotIndexes.length, "no slot index may occupy more than one zone");
  const pivotZonesOccupied = ["PIVOT_LEFT", "PIVOT_CENTRE", "PIVOT_RIGHT"].filter((z) => projection[z as keyof typeof projection] !== null);
  assert.equal(pivotZonesOccupied.length, 2, "two distinct pivot zones must be occupied");
  assert.equal(projection.M9, null, "the M9 zone must now be empty -- nobody plays backcourt-centre in this shape");
});

test("HM-MATCH-1.3B2: projection is a pure function -- the same slots array always produces the same zone mapping", () => {
  const a = projectSlotsOntoZones(NORMAL_SLOTS);
  const b = projectSlotsOntoZones(NORMAL_SLOTS);
  assert.deepEqual(a, b);
});

test("HM-MATCH-1.3B2: GK is never projected onto an outcourt zone", () => {
  const projection = projectSlotsOntoZones(NORMAL_SLOTS);
  for (const zoneId of ATTACK_ZONE_IDS) {
    if (projection[zoneId] !== null) {
      assert.notEqual(NORMAL_SLOTS[projection[zoneId]!].position, "GK");
    }
  }
});
