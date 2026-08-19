import assert from "node:assert/strict";
import test from "node:test";
import { initialHalfCourt6v6State } from "../scenarios/halfCourt6v6";
import { DEFAULT_PASS_SPEED_METERS_PER_SECOND, step } from "../simulation/engine";
import { canPlayerChooseAttack, resolvePostPassActionHandoff } from "./actionFlow";

const passerId = "attack-attack-6-3";
const receiverId = "attack-attack-6-4";

function passInFlight() {
  return step(initialHalfCourt6v6State, { actions: [{ type: "PASS", fromPlayerId: passerId, toPlayerId: receiverId }] }, 0);
}

test("post-pass handoff selects the receiver and clears PASS mode after reception", () => {
  const flying = passInFlight();
  const received = step(flying, {}, flying.ball.flight?.durationSeconds ?? 0);
  const handoff = resolvePostPassActionHandoff(flying, received, passerId, "PASS");

  assert.equal(received.ball.status, "POSSESSED");
  assert.equal(received.ball.possessorId, receiverId);
  assert.equal(handoff.selectedPlayerId, receiverId);
  assert.equal(handoff.activeAction, "NONE");
  assert.equal(handoff.receivedPlayerId, receiverId);
});

test("post-pass fallback uses current possessor when the in-flight render was skipped", () => {
  const flying = passInFlight();
  const received = step(flying, {}, flying.ball.flight?.durationSeconds ?? 0);
  const handoff = resolvePostPassActionHandoff(initialHalfCourt6v6State, received, passerId, "PASS");

  assert.equal(handoff.selectedPlayerId, receiverId);
  assert.equal(handoff.activeAction, "NONE");
});

test("post-pass receiver is immediately eligible for ATTACK", () => {
  const flying = passInFlight();
  const received = step(flying, {}, flying.ball.flight?.durationSeconds ?? 0);
  const handoff = resolvePostPassActionHandoff(flying, received, passerId, "PASS");

  assert.equal(canPlayerChooseAttack(received, handoff.selectedPlayerId), true);
  assert.equal(canPlayerChooseAttack(received, passerId), false);
});

test("ATTACK remains unavailable while pass is still in flight", () => {
  const flying = passInFlight();
  const midFlight = step(flying, {}, 0.1);

  assert.equal(midFlight.ball.status, "IN_FLIGHT");
  assert.equal(canPlayerChooseAttack(midFlight, receiverId), false);
});

test("PASS receive then ATTACK sequence works deterministically through repeated steps", () => {
  let state = passInFlight();
  const dt = 0.05;
  const maxSteps = Math.ceil(((state.ball.flight?.durationSeconds ?? 0) + 0.1) / dt);
  for (let i = 0; i < maxSteps && state.ball.status === "IN_FLIGHT"; i += 1) {
    state = step(state, {}, dt);
  }
  const handoff = resolvePostPassActionHandoff(null, state, passerId, "PASS");
  const attacked = step(state, { actions: [{ type: "ATTACK", playerId: handoff.selectedPlayerId, gapId: "H2_H1" }] }, 0);
  const receiver = attacked.players.find((player) => player.id === receiverId);

  assert.equal(state.ball.status, "POSSESSED");
  assert.equal(state.ball.possessorId, receiverId);
  assert.equal(receiver?.intent.type, "ATTACK");
  assert.equal(receiver?.intent.type === "ATTACK" ? receiver.intent.gapId : null, "H2_H1");
});

test("PASS timing baseline stays unchanged", () => {
  const flying = passInFlight();
  const passer = initialHalfCourt6v6State.players.find((player) => player.id === passerId);
  const receiver = initialHalfCourt6v6State.players.find((player) => player.id === receiverId);
  assert.ok(passer && receiver && flying.ball.flight);

  const distance = Math.hypot(receiver.position.x - passer.position.x, receiver.position.y - passer.position.y);
  assert.equal(flying.ball.flight.durationSeconds, distance / DEFAULT_PASS_SPEED_METERS_PER_SECOND);
});
