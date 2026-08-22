// HM-TACTICS-1.0 Part O: depth/hierarchy validation tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateDepthHierarchy } from "./depthHierarchy";
import type { DepthHierarchy, MatchSquad } from "./types";

const squad: MatchSquad = {
  fixtureId: "fx1",
  clubId: "c1",
  players: [
    { playerId: "m9_primary", position: "M9" },
    { playerId: "m9_secondary", position: "M9" },
    { playerId: "m9_emergency", position: "M9" },
    { playerId: "gk_first", position: "GK" },
    { playerId: "gk_second", position: "GK" },
  ],
};

test("HM-TACTICS-1.0: a valid depth hierarchy (M9 primary/secondary/emergency, GK first/second choice) passes and is deterministic", () => {
  const hierarchy: DepthHierarchy = [
    {
      groupKey: "M9",
      entries: [
        { playerId: "m9_primary", priority: 1 },
        { playerId: "m9_secondary", priority: 2 },
        { playerId: "m9_emergency", priority: 3 },
      ],
    },
    {
      groupKey: "GK",
      entries: [
        { playerId: "gk_first", priority: 1 },
        { playerId: "gk_second", priority: 2 },
      ],
    },
  ];
  const a = validateDepthHierarchy(hierarchy, squad);
  const b = validateDepthHierarchy(hierarchy, squad);
  assert.equal(a.ok, true);
  assert.deepEqual(a, b);
});

test("HM-TACTICS-1.0: a depth entry referencing a player outside the squad is rejected", () => {
  const hierarchy: DepthHierarchy = [{ groupKey: "M9", entries: [{ playerId: "outsider", priority: 1 }] }];
  const result = validateDepthHierarchy(hierarchy, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("outsider")));
});

test("HM-TACTICS-1.0: duplicate priority entries within a depth group are rejected", () => {
  const hierarchy: DepthHierarchy = [
    {
      groupKey: "M9",
      entries: [
        { playerId: "m9_primary", priority: 1 },
        { playerId: "m9_secondary", priority: 1 },
      ],
    },
  ];
  const result = validateDepthHierarchy(hierarchy, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("duplicate priority")));
});

test("HM-TACTICS-1.0: a non-positive or non-integer priority is rejected", () => {
  const hierarchy: DepthHierarchy = [{ groupKey: "M9", entries: [{ playerId: "m9_primary", priority: 0 }] }];
  assert.equal(validateDepthHierarchy(hierarchy, squad).ok, false);
});

test("HM-TACTICS-1.0: depth groups use a generic free-form groupKey, not a hardcoded position enum", () => {
  const hierarchy: DepthHierarchy = [{ groupKey: "M6_ATTACK", entries: [{ playerId: "m9_primary", priority: 1 }] }];
  assert.equal(validateDepthHierarchy(hierarchy, squad).ok, true);
});
