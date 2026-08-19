import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createHalfCourt6v6StateWithGoalkeeper,
  initialHalfCourt6v6WithGoalkeeperState,
} from "@handball-manager/handball-engine/src/scenarios/halfCourt6v6.ts";
import { toMatchRenderSnapshot } from "./simAdapter";
import { snapshotToBoardObjects } from "./fieldAdapter";

// HM-0.4A: verifies the goalkeeper entity added to handball-engine
// bridges correctly through the existing, unmodified neutral contract
// and renderer adapter -- new file, does not touch simAdapter.test.ts
// or fieldAdapter.test.ts (both of which correctly continue to assert
// zero goalkeepers against the goalkeeper-LESS initialHalfCourt6v6State).

test("simAdapter maps the SIM goalkeeper to kind GOALKEEPER (11)", () => {
  const snapshot = toMatchRenderSnapshot(initialHalfCourt6v6WithGoalkeeperState);
  const goalkeeper = snapshot.players.find((p) => p.kind === "GOALKEEPER");
  assert.ok(goalkeeper, "expected exactly one GOALKEEPER-kind player in the snapshot");
  assert.equal(goalkeeper!.id, "defense-defence-6-0-goalkeeper");
  assert.equal(goalkeeper!.side, "DEFENSE");
});

test("MatchRenderSnapshot contains exactly one goalkeeper and thirteen players total (12)", () => {
  const snapshot = toMatchRenderSnapshot(initialHalfCourt6v6WithGoalkeeperState);
  assert.equal(snapshot.players.length, 13);
  assert.equal(snapshot.players.filter((p) => p.kind === "GOALKEEPER").length, 1);
  assert.equal(snapshot.players.filter((p) => p.kind === "FIELD_PLAYER").length, 12);
});

test("fieldAdapter produces exactly one GOALKEEPER BoardObject (13)", () => {
  const snapshot = toMatchRenderSnapshot(initialHalfCourt6v6WithGoalkeeperState);
  const objects = snapshotToBoardObjects(snapshot);
  // 6 ATTACKER + 6 DEFENDER + 1 GOALKEEPER + 1 BALL = 14.
  assert.equal(objects.length, 14);
  const goalkeepers = objects.filter((o) => o.type === "GOALKEEPER");
  assert.equal(goalkeepers.length, 1);
  assert.equal(goalkeepers[0].id, "defense-defence-6-0-goalkeeper");
});

test("goalkeeper position is preserved SIM -> snapshot -> FIELD unchanged (14)", () => {
  const simGoalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((p) => p.kind === "GOALKEEPER")!;
  const snapshot = toMatchRenderSnapshot(initialHalfCourt6v6WithGoalkeeperState);
  const snapshotGoalkeeper = snapshot.players.find((p) => p.kind === "GOALKEEPER")!;
  const boardGoalkeeper = snapshotToBoardObjects(snapshot).find((o) => o.type === "GOALKEEPER")!;

  assert.deepEqual(snapshotGoalkeeper.x, simGoalkeeper.position.x);
  assert.deepEqual(snapshotGoalkeeper.y, simGoalkeeper.position.y);
  assert.deepEqual(boardGoalkeeper.position, { x: simGoalkeeper.position.x, y: simGoalkeeper.position.y });
});

test("re-creating the scenario reproduces the exact same goalkeeper -- RESET equivalent (15), no duplicate created (16)", () => {
  const first = createHalfCourt6v6StateWithGoalkeeper();
  const second = createHalfCourt6v6StateWithGoalkeeper();

  const firstGoalkeepers = first.players.filter((p) => p.kind === "GOALKEEPER");
  const secondGoalkeepers = second.players.filter((p) => p.kind === "GOALKEEPER");
  assert.equal(firstGoalkeepers.length, 1);
  assert.equal(secondGoalkeepers.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(firstGoalkeepers[0])),
    JSON.parse(JSON.stringify(secondGoalkeepers[0])),
  );

  // Simulate several REPEATED resets in a row (mirrors match-demo's
  // RESET handler calling createHalfCourt6v6StateWithGoalkeeper()
  // fresh each time) -- still exactly one goalkeeper, never
  // accumulating duplicates.
  for (let i = 0; i < 5; i += 1) {
    const state = createHalfCourt6v6StateWithGoalkeeper();
    assert.equal(state.players.filter((p) => p.kind === "GOALKEEPER").length, 1);
    assert.equal(state.players.length, 13);
  }
});

test("goalkeeper never appears twice even when mapped through the full bridge repeatedly", () => {
  for (let i = 0; i < 3; i += 1) {
    const snapshot = toMatchRenderSnapshot(createHalfCourt6v6StateWithGoalkeeper());
    const objects = snapshotToBoardObjects(snapshot);
    assert.equal(objects.filter((o) => o.type === "GOALKEEPER").length, 1);
  }
});
