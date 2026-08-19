import assert from "node:assert/strict";
import test from "node:test";
import { getDefenseZoneAtPosition } from "../../domain/geometry/zones";
import type { HandballState } from "../../domain/handball/state";
import { initialHalfCourt6v6State } from "../../scenarios/halfCourt6v6";
import { step } from "../../simulation/engine";
import { observeDefensiveThreat } from "./threat";

const ballCarrierId = "attack-attack-6-3";
const receiverId = "attack-attack-6-4";

function withCarrierPosition(state: HandballState, position: { x: number; y: number }): HandballState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === ballCarrierId ? { ...player, position: { ...position } } : player)),
    ball: { ...state.ball, position: { ...position } }
  };
}

test("possession threat identifies attacking ball carrier", () => {
  const threat = observeDefensiveThreat(initialHalfCourt6v6State);

  assert.equal(threat.type, "POSSESSION_THREAT");
  assert.equal(threat.type === "POSSESSION_THREAT" ? threat.ballCarrierId : null, ballCarrierId);
});

test("active attack threat identifies gap intent and target", () => {
  const state = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: ballCarrierId, gapId: "V2_V3" }] }, 0);
  const threat = observeDefensiveThreat(state);

  assert.equal(threat.type, "ACTIVE_ATTACK_THREAT");
  assert.equal(threat.type === "ACTIVE_ATTACK_THREAT" ? threat.activeAttackGapId : null, "V2_V3");
  assert.ok(threat.type === "ACTIVE_ATTACK_THREAT" && threat.attackTarget !== threat.carrierPosition);
});

test("in-flight pass produces no direct ball carrier threat", () => {
  const state = step(initialHalfCourt6v6State, { actions: [{ type: "PASS", fromPlayerId: ballCarrierId, toPlayerId: receiverId }] }, 0);
  const threat = observeDefensiveThreat(state);

  assert.equal(threat.type, "NO_DIRECT_BALL_THREAT");
});

test("threat position follows real carrier position during attack", () => {
  const attacking = step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: ballCarrierId, gapId: "H2_H1" }] }, 0);
  const moved = withCarrierPosition(attacking, { x: 12.4, y: 8.1 });
  const threat = observeDefensiveThreat(moved);

  assert.equal(threat.type, "ACTIVE_ATTACK_THREAT");
  assert.deepEqual(threat.type === "ACTIVE_ATTACK_THREAT" ? threat.threatPosition : null, { x: 12.4, y: 8.1 });
});

test("threat current zone comes from canonical spatial lookup", () => {
  const state = withCarrierPosition(initialHalfCourt6v6State, { x: 10, y: 7 });
  const threat = observeDefensiveThreat(state);

  assert.equal(threat.type, "POSSESSION_THREAT");
  assert.deepEqual(threat.type === "POSSESSION_THREAT" ? threat.currentZone : null, getDefenseZoneAtPosition({ x: 10, y: 7 }));
});

test("same state produces same threat observation", () => {
  assert.deepEqual(observeDefensiveThreat(initialHalfCourt6v6State), observeDefensiveThreat(initialHalfCourt6v6State));
});

test("threat observation does not mutate input state", () => {
  const before = JSON.stringify(initialHalfCourt6v6State);
  observeDefensiveThreat(initialHalfCourt6v6State);

  assert.equal(JSON.stringify(initialHalfCourt6v6State), before);
});
