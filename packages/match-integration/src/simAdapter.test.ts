import { test } from "node:test";
import assert from "node:assert/strict";
import { initialHalfCourt6v6State } from "@handball-manager/handball-engine/src/scenarios/halfCourt6v6.ts";
import { step } from "@handball-manager/handball-engine/src/simulation/engine.ts";
import type { HandballState } from "@handball-manager/handball-engine/src/domain/handball/state.ts";
import { toMatchRenderSnapshot } from "./simAdapter";

// Real SIM state, not a hand-authored fixture: proves the adapter works
// against the actual canonical scenario, the same one HM-0.2E's demo
// host loads.
const canonicalState: HandballState = initialHalfCourt6v6State;

test("player ids map correctly (1)", () => {
  const snapshot = toMatchRenderSnapshot(canonicalState);
  const simIds = canonicalState.players.map((p) => p.id).sort();
  const snapshotIds = snapshot.players.map((p) => p.id).sort();
  assert.deepEqual(snapshotIds, simIds);
});

test("attacking/defending team distinction maps correctly (2)", () => {
  const snapshot = toMatchRenderSnapshot(canonicalState);
  for (const simPlayer of canonicalState.players) {
    const mapped = snapshot.players.find((p) => p.id === simPlayer.id);
    assert.ok(mapped, `expected a mapped player for ${simPlayer.id}`);
    assert.equal(mapped!.side, simPlayer.team);
  }
  const attackCount = snapshot.players.filter((p) => p.side === "ATTACK").length;
  const defenseCount = snapshot.players.filter((p) => p.side === "DEFENSE").length;
  assert.equal(attackCount, 6);
  assert.equal(defenseCount, 6);
});

test("x/y positions are preserved with no coordinate transform (3)", () => {
  const snapshot = toMatchRenderSnapshot(canonicalState);
  for (const simPlayer of canonicalState.players) {
    const mapped = snapshot.players.find((p) => p.id === simPlayer.id);
    assert.ok(mapped);
    assert.equal(mapped!.x, simPlayer.position.x);
    assert.equal(mapped!.y, simPlayer.position.y);
  }
});

test("ball position maps correctly (4)", () => {
  const snapshot = toMatchRenderSnapshot(canonicalState);
  assert.equal(snapshot.ball.x, canonicalState.ball.position.x);
  assert.equal(snapshot.ball.y, canonicalState.ball.position.y);
});

test("possessed ball maps status and possessorPlayerId correctly (5)", () => {
  // The canonical scenario's ball starts POSSESSED (see HM-0.2E report
  // Section 5 for the exact possessor id observed).
  assert.equal(canonicalState.ball.status, "POSSESSED");
  assert.ok(canonicalState.ball.possessorId);

  const snapshot = toMatchRenderSnapshot(canonicalState);
  assert.equal(snapshot.ball.status, "POSSESSED");
  assert.equal(snapshot.ball.possessorPlayerId, canonicalState.ball.possessorId);
});

test("in-flight ball maps correctly (6)", () => {
  // Drive a real PASS through SIM's own step() (not a hand-authored
  // fixture) between the two known ATTACK players from the canonical
  // scenario, exactly as the demo host's PASS control will.
  const passerId = canonicalState.ball.possessorId!;
  const passer = canonicalState.players.find((p) => p.id === passerId)!;
  const receiver = canonicalState.players.find((p) => p.team === "ATTACK" && p.id !== passerId)!;

  const afterPass = step(
    canonicalState,
    { actions: [{ type: "PASS", fromPlayerId: passer.id, toPlayerId: receiver.id }] },
    0,
  );

  assert.equal(afterPass.ball.status, "IN_FLIGHT");
  assert.equal(afterPass.ball.possessorId, null);

  const snapshot = toMatchRenderSnapshot(afterPass);
  assert.equal(snapshot.ball.status, "IN_FLIGHT");
  assert.equal(snapshot.ball.possessorPlayerId, null);
  assert.equal(snapshot.ball.x, afterPass.ball.position.x);
  assert.equal(snapshot.ball.y, afterPass.ball.position.y);
});

test("simulationTime maps correctly (7)", () => {
  assert.equal(toMatchRenderSnapshot(canonicalState).simulationTime, canonicalState.simulationTime);

  const advanced = step(canonicalState, {}, 0.5);
  assert.equal(toMatchRenderSnapshot(advanced).simulationTime, advanced.simulationTime);
  assert.notEqual(advanced.simulationTime, canonicalState.simulationTime);
});

test("no goalkeeper is invented -- every mapped player is kind FIELD_PLAYER (9, SIM side)", () => {
  const snapshot = toMatchRenderSnapshot(canonicalState);
  assert.equal(snapshot.players.length, 12);
  for (const player of snapshot.players) {
    assert.equal(player.kind, "FIELD_PLAYER");
  }
});

test("snapshot generation does not mutate SIM state (10)", () => {
  const before = JSON.parse(JSON.stringify(canonicalState));
  toMatchRenderSnapshot(canonicalState);
  const after = JSON.parse(JSON.stringify(canonicalState));
  assert.deepEqual(after, before);
});
