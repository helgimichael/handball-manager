import assert from "node:assert/strict";
import test from "node:test";
import { getAttackGap, getDefensiveAttackGaps, isValidAttackGapTarget } from "./attackGaps";
import {
  buildCanonicalDefensiveZoneLabelPositions,
  buildCanonicalDefensiveZonePolygons,
  getDefenseZoneAtPosition,
  isCanonicalDefensiveZonePath
} from "./zones";

test("canonical defensive zones use FIELD approved polygons", () => {
  const zones = buildCanonicalDefensiveZonePolygons();

  assert.equal(zones.length, 10);
  assert.equal(zones[0]?.id, "defensive-top-ZONE_1_LEFT");
  assert.equal(zones[0]?.displayLabel, "H1");
  assert.ok(zones[0]?.d.includes("A 9 9"));
  assert.ok(isCanonicalDefensiveZonePath(zones[0]?.d ?? ""));
});

test("zone lookup is headless, meter based, and uses canonical divider geometry", () => {
  assert.equal(getDefenseZoneAtPosition({ x: 10, y: 7 })?.zoneId, "ZONE_3");
  assert.equal(getDefenseZoneAtPosition({ x: 19, y: 2 })?.zoneId, "ZONE_1_RIGHT");
  assert.equal(getDefenseZoneAtPosition({ x: 10, y: 9.5 }), null);
  assert.equal(getDefenseZoneAtPosition({ x: 10, y: 33 })?.goalSide, "bottom");
});

test("canonical defensive zone labels are derived for both goals", () => {
  const labels = buildCanonicalDefensiveZoneLabelPositions();

  assert.equal(labels.length, 10);
  assert.deepEqual(
    labels.filter((label) => label.goalSide === "top").map((label) => label.text),
    ["H1", "H2", "3", "V2", "V1"]
  );
});

test("canonical attack gaps are deterministic and meter based", () => {
  const first = getDefensiveAttackGaps();
  const second = getDefensiveAttackGaps();

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map((gap) => gap.id),
    ["V1_V2", "V2_V3", "V3_H3", "H3_H2", "H2_H1"]
  );
  assert.equal(getAttackGap("V3_H3")?.label, "V3/H3");
});

test("attack gap targets are within court bounds", () => {
  assert.ok(getDefensiveAttackGaps().every((gap) => isValidAttackGapTarget(gap)));
});
