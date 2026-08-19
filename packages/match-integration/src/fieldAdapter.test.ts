import { test } from "node:test";
import assert from "node:assert/strict";
import { initialHalfCourt6v6State } from "@handball-manager/handball-engine/src/scenarios/halfCourt6v6.ts";
import { toMatchRenderSnapshot } from "./simAdapter";
import { snapshotToBoardObjects, snapshotToScene } from "./fieldAdapter";

const snapshot = toMatchRenderSnapshot(initialHalfCourt6v6State);

test("renderer adapter produces expected FIELD BoardObjects (8): correct count, types, positions", () => {
  const objects = snapshotToBoardObjects(snapshot);

  // 6 ATTACKER + 6 DEFENDER + 1 BALL = 13. No GOALKEEPER -- see the
  // dedicated goalkeeper test below.
  assert.equal(objects.length, 13);

  const attackers = objects.filter((o) => o.type === "ATTACKER");
  const defenders = objects.filter((o) => o.type === "DEFENDER");
  const balls = objects.filter((o) => o.type === "BALL");
  assert.equal(attackers.length, 6);
  assert.equal(defenders.length, 6);
  assert.equal(balls.length, 1);

  for (const player of snapshot.players) {
    const matched = objects.find((o) => o.id === player.id);
    assert.ok(matched, `expected a BoardObject for ${player.id}`);
    assert.equal(matched!.position.x, player.x);
    assert.equal(matched!.position.y, player.y);
    assert.equal(matched!.type, player.side === "ATTACK" ? "ATTACKER" : "DEFENDER");
  }

  const ballObject = objects.find((o) => o.type === "BALL");
  assert.ok(ballObject);
  assert.equal(ballObject!.position.x, snapshot.ball.x);
  assert.equal(ballObject!.position.y, snapshot.ball.y);
});

test("no goalkeeper object is invented (9, FIELD side)", () => {
  const objects = snapshotToBoardObjects(snapshot);
  const goalkeepers = objects.filter((o) => o.type === "GOALKEEPER");
  assert.equal(goalkeepers.length, 0);
});

test("snapshotToScene builds a valid FIELD TacticsBoardScene from the same objects", () => {
  const scene = snapshotToScene(snapshot);
  const objects = snapshotToBoardObjects(snapshot);
  assert.equal(scene.objects.length, objects.length);
  assert.equal(scene.courtView, "HALF_COURT");
  assert.deepEqual(
    [...scene.objects].map((o) => o.id).sort(),
    objects.map((o) => o.id).sort(),
  );
});

test("does not mutate the input snapshot", () => {
  const before = JSON.parse(JSON.stringify(snapshot));
  snapshotToBoardObjects(snapshot);
  const after = JSON.parse(JSON.stringify(snapshot));
  assert.deepEqual(after, before);
});
