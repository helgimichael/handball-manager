import assert from "node:assert/strict";
import test from "node:test";
import { getAttackGap, type AttackGapId } from "../domain/geometry/attackGaps";
import { getDefenseZoneAtPosition } from "../domain/geometry/zones";
import { initialHalfCourt6v6State } from "../scenarios/halfCourt6v6";
import { validateStandardSixVsSixState } from "../domain/handball/validation";
import { DEFAULT_PASS_SPEED_METERS_PER_SECOND, SimulationInputError, step } from "./engine";
import { canReach } from "./movement";

const movingPlayerId = "attack-attack-6-3";
const moveTarget = { x: 10, y: 10.2 };

function playerIdByRole(role: "CENTER_BACK" | "RIGHT_BACK" | "LEFT_BACK") {
  const player = initialHalfCourt6v6State.players.find((candidate) => candidate.role === role);
  assert.ok(player);
  return player.id;
}

const passerPlayerId = playerIdByRole("CENTER_BACK");
const receiverPlayerId = playerIdByRole("RIGHT_BACK");
const alternateReceiverPlayerId = playerIdByRole("LEFT_BACK");
const defenderPlayerId = initialHalfCourt6v6State.players.find((candidate) => candidate.team === "DEFENSE")?.id ?? "";

function passCommand(fromPlayerId = passerPlayerId, toPlayerId = receiverPlayerId) {
  return { type: "PASS" as const, fromPlayerId, toPlayerId };
}

function passFlightState() {
  return step(initialHalfCourt6v6State, { actions: [passCommand()] }, 0);
}

function attackCommand(playerId = passerPlayerId, gapId: AttackGapId = "V3_H3") {
  return { type: "ATTACK" as const, playerId, gapId };
}

function attackIntentState(playerId = passerPlayerId) {
  return step(initialHalfCourt6v6State, { actions: [attackCommand(playerId)] }, 0);
}

test("engine step advances time without mutating input state", () => {
  const before = JSON.stringify(initialHalfCourt6v6State);
  const next = step(initialHalfCourt6v6State, {}, 0.1);

  assert.equal(JSON.stringify(initialHalfCourt6v6State), before);
  assert.notEqual(next, initialHalfCourt6v6State);
  assert.equal(next.simulationTime, 0.1);
  assert.equal(initialHalfCourt6v6State.simulationTime, 0);
});

test("MOVE command creates movement intent", () => {
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: moveTarget }] }, 0);
  const player = next.players.find((candidate) => candidate.id === movingPlayerId);

  assert.equal(player?.intent.type, "MOVE");
  assert.deepEqual(player?.intent.type === "MOVE" ? player.intent.target : null, moveTarget);
});

test("player does not teleport to target on first movement step", () => {
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: moveTarget }] }, 0.1);
  const initialPlayer = initialHalfCourt6v6State.players.find((candidate) => candidate.id === movingPlayerId);
  const player = next.players.find((candidate) => candidate.id === movingPlayerId);

  assert.ok(initialPlayer);
  assert.notDeepEqual(player?.position, moveTarget);
  assert.ok(player && player.position.y < initialPlayer.position.y && player.position.y > moveTarget.y);
});

test("acceleration limits velocity", () => {
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: moveTarget }] }, 0.1);
  const player = next.players.find((candidate) => candidate.id === movingPlayerId);

  assert.ok(player);
  assert.ok(Math.abs(Math.hypot(player.velocity.x, player.velocity.y) - 0.3) < 1e-9);
});

test("maxSpeed is never exceeded", () => {
  let state = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: { x: 10, y: 0 } }] }, 0);

  for (let i = 0; i < 20; i += 1) {
    state = step(state, {}, 0.2);
    const player = state.players.find((candidate) => candidate.id === movingPlayerId);
    assert.ok(player);
    assert.ok(Math.hypot(player.velocity.x, player.velocity.y) <= player.movementProfile.maxSpeed);
  }
});

test("multiple steps move player toward target", () => {
  const first = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: moveTarget }] }, 0.1);
  const second = step(first, {}, 0.1);
  const firstPlayer = first.players.find((player) => player.id === movingPlayerId);
  const secondPlayer = second.players.find((player) => player.id === movingPlayerId);

  assert.ok(firstPlayer && secondPlayer);
  assert.ok(secondPlayer.position.y < firstPlayer.position.y);
});

test("player stops at target without overshoot", () => {
  const target = { x: 9.1, y: 11.6 };
  let state = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target }] }, 0);

  for (let i = 0; i < 20; i += 1) {
    state = step(state, {}, 0.1);
  }

  const player = state.players.find((candidate) => candidate.id === movingPlayerId);
  assert.ok(player);
  assert.deepEqual(player.position, target);
});

test("velocity is zero and intent is idle when MOVE completes", () => {
  let state = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: { x: 9.1, y: 11.6 } }] }, 0);

  for (let i = 0; i < 20; i += 1) {
    state = step(state, {}, 0.1);
  }

  const player = state.players.find((candidate) => candidate.id === movingPlayerId);
  assert.ok(player);
  assert.deepEqual(player.velocity, { x: 0, y: 0 });
  assert.deepEqual(player.intent, { type: "IDLE" });
});

test("dt = 0 leaves player positions unchanged", () => {
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: moveTarget }] }, 0);

  assert.deepEqual(
    next.players.map((player) => player.position),
    initialHalfCourt6v6State.players.map((player) => player.position)
  );
});

test("negative dt is rejected", () => {
  assert.throws(() => step(initialHalfCourt6v6State, {}, -0.1), SimulationInputError);
});

test("simulationTime increases deterministically", () => {
  const first = step(initialHalfCourt6v6State, {}, 0.25);
  const second = step(first, {}, 0.25);

  assert.equal(second.simulationTime, 0.5);
});

test("same input gives same output", () => {
  const input = { actions: [{ type: "MOVE" as const, playerId: movingPlayerId, target: moveTarget }] };

  assert.deepEqual(step(initialHalfCourt6v6State, input, 0.1), step(initialHalfCourt6v6State, input, 0.1));
});

test("valid PASS starts an in-flight ball", () => {
  const next = passFlightState();

  assert.equal(next.ball.status, "IN_FLIGHT");
  assert.ok(next.ball.flight);
  assert.equal(next.ball.flight.passerId, passerPlayerId);
  assert.equal(next.ball.flight.receiverId, receiverPlayerId);
});

test("passer loses possession and possessorId is null during pass flight", () => {
  const next = passFlightState();

  assert.equal(next.ball.possessorId, null);
  assert.equal(next.ball.status, "IN_FLIGHT");
});

test("PASS does not teleport the ball to receiver at pass start", () => {
  const next = passFlightState();
  const passer = initialHalfCourt6v6State.players.find((player) => player.id === passerPlayerId);
  const receiver = initialHalfCourt6v6State.players.find((player) => player.id === receiverPlayerId);

  assert.ok(passer && receiver);
  assert.deepEqual(next.ball.position, passer.position);
  assert.notDeepEqual(next.ball.position, receiver.position);
});

test("PASS duration is deterministic from distance and constant speed", () => {
  const next = passFlightState();
  const passer = initialHalfCourt6v6State.players.find((player) => player.id === passerPlayerId);
  const receiver = initialHalfCourt6v6State.players.find((player) => player.id === receiverPlayerId);

  assert.ok(next.ball.flight && passer && receiver);
  const expectedDuration = Math.hypot(receiver.position.x - passer.position.x, receiver.position.y - passer.position.y) / DEFAULT_PASS_SPEED_METERS_PER_SECOND;
  assert.equal(next.ball.flight.durationSeconds, expectedDuration);
});

test("PASS advances over multiple steps", () => {
  const started = passFlightState();
  const first = step(started, {}, 0.1);
  const second = step(first, {}, 0.1);

  assert.equal(first.ball.status, "IN_FLIGHT");
  assert.equal(second.ball.status, "IN_FLIGHT");
  assert.notDeepEqual(first.ball.position, started.ball.position);
  assert.notDeepEqual(second.ball.position, first.ball.position);
});

test("PASS does not overshoot receiver target", () => {
  const started = passFlightState();
  assert.ok(started.ball.flight);
  const completed = step(started, {}, started.ball.flight.durationSeconds + 10);
  const receiver = completed.players.find((player) => player.id === receiverPlayerId);

  assert.ok(receiver);
  assert.equal(completed.ball.status, "POSSESSED");
  assert.deepEqual(completed.ball.position, receiver.position);
});

test("completed PASS gives possession to receiver and clears flight state", () => {
  const started = passFlightState();
  assert.ok(started.ball.flight);
  const completed = step(started, {}, started.ball.flight.durationSeconds);
  const receiver = completed.players.find((player) => player.id === receiverPlayerId);

  assert.ok(receiver);
  assert.equal(completed.ball.status, "POSSESSED");
  assert.equal(completed.ball.possessorId, receiverPlayerId);
  assert.equal(completed.ball.flight, null);
  assert.deepEqual(completed.ball.position, receiver.position);
});

test("invalid PASS passer id is rejected", () => {
  assert.throws(() => step(initialHalfCourt6v6State, { actions: [passCommand("missing-player", receiverPlayerId)] }, 0), SimulationInputError);
});

test("invalid PASS receiver id is rejected", () => {
  assert.throws(() => step(initialHalfCourt6v6State, { actions: [passCommand(passerPlayerId, "missing-player")] }, 0), SimulationInputError);
});

test("PASS from passer to same player is rejected", () => {
  assert.throws(() => step(initialHalfCourt6v6State, { actions: [passCommand(passerPlayerId, passerPlayerId)] }, 0), SimulationInputError);
});

test("PASS by player without possession is rejected", () => {
  assert.throws(() => step(initialHalfCourt6v6State, { actions: [passCommand(alternateReceiverPlayerId, receiverPlayerId)] }, 0), SimulationInputError);
});

test("PASS to opposing team is rejected for SIM-3", () => {
  assert.throws(() => step(initialHalfCourt6v6State, { actions: [passCommand(passerPlayerId, defenderPlayerId)] }, 0), SimulationInputError);
});

test("dt = 0 does not advance ball flight", () => {
  const started = passFlightState();
  const next = step(started, {}, 0);

  assert.equal(next.ball.status, "IN_FLIGHT");
  assert.deepEqual(next.ball.position, started.ball.position);
  assert.deepEqual(next.ball.flight, started.ball.flight);
});

test("same PASS state plus command and dt gives same result", () => {
  const input = { actions: [passCommand()] };

  assert.deepEqual(step(initialHalfCourt6v6State, input, 0.1), step(initialHalfCourt6v6State, input, 0.1));
});

test("PASS does not mutate input state", () => {
  const before = JSON.stringify(initialHalfCourt6v6State);
  step(initialHalfCourt6v6State, { actions: [passCommand()] }, 0.1);

  assert.equal(JSON.stringify(initialHalfCourt6v6State), before);
});

test("MOVE still works while pass logic exists", () => {
  const started = passFlightState();
  const next = step(started, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: moveTarget }] }, 0);
  const movingPlayer = next.players.find((player) => player.id === movingPlayerId);

  assert.equal(next.ball.status, "IN_FLIGHT");
  assert.equal(movingPlayer?.intent.type, "MOVE");
});

test("valid ATTACK creates semantic ATTACK intent", () => {
  const next = attackIntentState();
  const attacker = next.players.find((player) => player.id === passerPlayerId);
  const gap = getAttackGap("V3_H3");

  assert.ok(attacker && gap);
  assert.equal(attacker.intent.type, "ATTACK");
  assert.equal(attacker.intent.type === "ATTACK" ? attacker.intent.gapId : null, "V3_H3");
  assert.deepEqual(attacker.intent.type === "ATTACK" ? attacker.intent.target : null, gap.position);
});

test("ATTACK uses approved calibrated target coordinates", () => {
  const next = step(initialHalfCourt6v6State, { actions: [attackCommand(passerPlayerId, "H2_H1")] }, 0);
  const attacker = next.players.find((player) => player.id === passerPlayerId);

  assert.deepEqual(attacker?.intent.type === "ATTACK" ? attacker.intent.target : null, { x: 19.265, y: 4.666 });
});

test("ATTACK requires ball possession by the attacker", () => {
  assert.throws(() => step(initialHalfCourt6v6State, { actions: [attackCommand(alternateReceiverPlayerId)] }, 0), SimulationInputError);
});

test("defender ATTACK is rejected", () => {
  assert.throws(() => step(initialHalfCourt6v6State, { actions: [attackCommand(defenderPlayerId)] }, 0), SimulationInputError);
});

test("invalid ATTACK gap is rejected", () => {
  assert.throws(
    () => step(initialHalfCourt6v6State, { actions: [{ type: "ATTACK", playerId: passerPlayerId, gapId: "missing-gap" as "V3_H3" }] }, 0),
    SimulationInputError
  );
});

test("ATTACK while ball is in flight is rejected", () => {
  assert.throws(() => step(passFlightState(), { actions: [attackCommand(passerPlayerId)] }, 0), SimulationInputError);
});

test("ATTACK movement respects acceleration and does not teleport", () => {
  const next = step(initialHalfCourt6v6State, { actions: [attackCommand()] }, 0.1);
  const attacker = next.players.find((player) => player.id === passerPlayerId);
  const initialAttacker = initialHalfCourt6v6State.players.find((player) => player.id === passerPlayerId);
  const gap = getAttackGap("V3_H3");

  assert.ok(attacker && initialAttacker && gap);
  assert.equal(attacker.intent.type, "ATTACK");
  assert.ok(Math.abs(Math.hypot(attacker.velocity.x, attacker.velocity.y) - 0.3) < 1e-9);
  assert.notDeepEqual(attacker.position, gap.position);
  assert.notDeepEqual(attacker.position, initialAttacker.position);
});

test("ATTACK respects maxSpeed over multiple steps", () => {
  let state = attackIntentState();

  for (let i = 0; i < 20; i += 1) {
    state = step(state, {}, 0.2);
    const attacker = state.players.find((player) => player.id === passerPlayerId);
    assert.ok(attacker);
    assert.ok(Math.hypot(attacker.velocity.x, attacker.velocity.y) <= attacker.movementProfile.maxSpeed);
  }
});

test("ATTACK does not overshoot and completes at exact gap target", () => {
  let state = attackIntentState();
  const gap = getAttackGap("V3_H3");
  assert.ok(gap);

  for (let i = 0; i < 40; i += 1) {
    state = step(state, {}, 0.1);
  }

  const attacker = state.players.find((player) => player.id === passerPlayerId);
  assert.ok(attacker);
  assert.deepEqual(attacker.position, gap.position);
  assert.deepEqual(attacker.velocity, { x: 0, y: 0 });
  assert.deepEqual(attacker.intent, { type: "IDLE" });
});

test("ball follows attacker and possessor remains attacker during ATTACK", () => {
  const next = step(initialHalfCourt6v6State, { actions: [attackCommand()] }, 0.2);
  const attacker = next.players.find((player) => player.id === passerPlayerId);

  assert.ok(attacker);
  assert.equal(next.ball.status, "POSSESSED");
  assert.equal(next.ball.possessorId, passerPlayerId);
  assert.deepEqual(next.ball.position, attacker.position);
});

test("ATTACK progresses over multiple steps", () => {
  const started = attackIntentState();
  const first = step(started, {}, 0.1);
  const second = step(first, {}, 0.1);
  const firstAttacker = first.players.find((player) => player.id === passerPlayerId);
  const secondAttacker = second.players.find((player) => player.id === passerPlayerId);

  assert.ok(firstAttacker && secondAttacker);
  assert.equal(secondAttacker.intent.type, "ATTACK");
  assert.notDeepEqual(secondAttacker.position, firstAttacker.position);
});

test("same ATTACK state plus command and dt gives same result", () => {
  const input = { actions: [attackCommand()] };

  assert.deepEqual(step(initialHalfCourt6v6State, input, 0.1), step(initialHalfCourt6v6State, input, 0.1));
});

test("ATTACK does not mutate input state", () => {
  const before = JSON.stringify(initialHalfCourt6v6State);
  step(initialHalfCourt6v6State, { actions: [attackCommand()] }, 0.1);

  assert.equal(JSON.stringify(initialHalfCourt6v6State), before);
});

test("zone lookup remains available while approved ATTACK targets exist", () => {
  let state = step(initialHalfCourt6v6State, { actions: [attackCommand(passerPlayerId, "H2_H1")] }, 0);

  for (let i = 0; i < 40; i += 1) {
    state = step(state, {}, 0.1);
  }

  const attacker = state.players.find((player) => player.id === passerPlayerId);
  assert.ok(attacker);
  assert.deepEqual(attacker.position, { x: 19.265, y: 4.666 });
  assert.ok(getDefenseZoneAtPosition({ x: 10, y: 7 }));
});

test("PASS receiver can initiate ATTACK after receiving possession", () => {
  let state = passFlightState();
  assert.ok(state.ball.flight);
  state = step(state, {}, state.ball.flight.durationSeconds);
  const attacked = step(state, { actions: [attackCommand(receiverPlayerId, "H2_H1")] }, 0);
  const receiver = attacked.players.find((player) => player.id === receiverPlayerId);

  assert.equal(attacked.ball.status, "POSSESSED");
  assert.equal(attacked.ball.possessorId, receiverPlayerId);
  assert.equal(receiver?.intent.type, "ATTACK");
});

test("MOVE still works while attack logic exists", () => {
  const next = step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: alternateReceiverPlayerId, target: moveTarget }] }, 0);
  const player = next.players.find((candidate) => candidate.id === alternateReceiverPlayerId);

  assert.equal(player?.intent.type, "MOVE");
});

test("out-of-bounds MOVE target is rejected", () => {
  assert.throws(
    () => step(initialHalfCourt6v6State, { actions: [{ type: "MOVE", playerId: movingPlayerId, target: { x: 21, y: 12 } }] }, 0),
    SimulationInputError
  );
});

test("reachable near target is true", () => {
  const player = initialHalfCourt6v6State.players.find((candidate) => candidate.id === movingPlayerId);
  assert.ok(player);

  assert.equal(canReach(player, { x: 9.1, y: 11.8 }, 1).reachable, true);
});

test("unreachable distant target under short time is false", () => {
  const player = initialHalfCourt6v6State.players.find((candidate) => candidate.id === movingPlayerId);
  assert.ok(player);

  assert.equal(canReach(player, { x: 10, y: 0 }, 0.7).reachable, false);
});

test("estimated reach time is deterministic", () => {
  const player = initialHalfCourt6v6State.players.find((candidate) => candidate.id === movingPlayerId);
  assert.ok(player);

  const first = canReach(player, moveTarget, 2);
  const second = canReach(player, moveTarget, 2);
  assert.deepEqual(first, second);
});

test("default scenario still passes standard world validation", () => {
  assert.deepEqual(validateStandardSixVsSixState(initialHalfCourt6v6State), { valid: true, issues: [] });
});
