import assert from "node:assert/strict";
import test from "node:test";
import { validateHandballState, validateStandardSixVsSixState } from "../domain/handball/validation";
import type { HandballState } from "../domain/handball/state";
import { createHalfCourt6v6State, initialHalfCourt6v6State } from "./halfCourt6v6";

test("halfCourt6v6 contains exactly twelve players", () => {
  assert.equal(initialHalfCourt6v6State.players.length, 12);
});

test("halfCourt6v6 contains six attackers and six defenders", () => {
  const attackers = initialHalfCourt6v6State.players.filter((player) => player.team === "ATTACK");
  const defenders = initialHalfCourt6v6State.players.filter((player) => player.team === "DEFENSE");

  assert.equal(attackers.length, 6);
  assert.equal(defenders.length, 6);
});

test("ball starts with the canonical FIELD ball carrier", () => {
  const centerBack = initialHalfCourt6v6State.players.find((player) => player.role === "CENTER_BACK");

  assert.ok(centerBack);
  assert.deepEqual(initialHalfCourt6v6State.ball.position, centerBack.position);
  assert.equal(initialHalfCourt6v6State.ball.possessorId, centerBack.id);
  assert.equal(initialHalfCourt6v6State.ball.status, "POSSESSED");
  assert.equal(initialHalfCourt6v6State.ball.flight, null);
});

test("standard scenario passes world validation", () => {
  assert.deepEqual(validateStandardSixVsSixState(initialHalfCourt6v6State), { valid: true, issues: [] });
});

test("duplicate player id is rejected", () => {
  const state: HandballState = {
    ...initialHalfCourt6v6State,
    players: [
      { ...initialHalfCourt6v6State.players[0] },
      { ...initialHalfCourt6v6State.players[1], id: initialHalfCourt6v6State.players[0].id }
    ]
  };

  assert.equal(validateHandballState(state).issues[0]?.code, "DUPLICATE_PLAYER_ID");
});

test("out-of-bounds player is rejected", () => {
  const state: HandballState = {
    ...initialHalfCourt6v6State,
    players: [{ ...initialHalfCourt6v6State.players[0], position: { x: -1, y: 5 } }]
  };

  assert.equal(validateHandballState(state).issues[0]?.code, "PLAYER_OUT_OF_BOUNDS");
});

test("invalid possessor id is rejected", () => {
  const state: HandballState = {
    ...initialHalfCourt6v6State,
    ball: { ...initialHalfCourt6v6State.ball, possessorId: "missing-player" }
  };

  assert.equal(validateHandballState(state).issues[0]?.code, "INVALID_BALL_POSSESSOR");
});

test("possessed ball without possessor is rejected", () => {
  const state: HandballState = {
    ...initialHalfCourt6v6State,
    ball: { ...initialHalfCourt6v6State.ball, possessorId: null, status: "POSSESSED" }
  };

  assert.equal(validateHandballState(state).issues[0]?.code, "POSSESSED_BALL_WITHOUT_POSSESSOR");
});

test("loose ball with possessor is rejected", () => {
  const state: HandballState = {
    ...initialHalfCourt6v6State,
    ball: { ...initialHalfCourt6v6State.ball, possessorId: initialHalfCourt6v6State.players[0]?.id ?? null, status: "LOOSE" }
  };

  assert.equal(validateHandballState(state).issues[0]?.code, "LOOSE_BALL_WITH_POSSESSOR");
});

test("in-flight ball without flight metadata is rejected", () => {
  const state: HandballState = {
    ...initialHalfCourt6v6State,
    ball: { ...initialHalfCourt6v6State.ball, possessorId: null, status: "IN_FLIGHT", flight: null }
  };

  assert.equal(validateHandballState(state).issues[0]?.code, "IN_FLIGHT_BALL_WITHOUT_FLIGHT");
});

test("in-flight ball with possessor is rejected", () => {
  const state: HandballState = {
    ...initialHalfCourt6v6State,
    ball: {
      ...initialHalfCourt6v6State.ball,
      status: "IN_FLIGHT",
      flight: {
        passerId: "a",
        receiverId: "b",
        from: { x: 1, y: 1 },
        to: { x: 2, y: 2 },
        elapsedSeconds: 0,
        durationSeconds: 1,
        speedMetersPerSecond: 12
      }
    }
  };

  assert.equal(validateHandballState(state).issues[0]?.code, "IN_FLIGHT_BALL_WITH_POSSESSOR");
});

test("possessed ball away from possessor is rejected", () => {
  const state: HandballState = {
    ...initialHalfCourt6v6State,
    ball: {
      ...initialHalfCourt6v6State.ball,
      possessorId: initialHalfCourt6v6State.players[0]?.id ?? null,
      status: "POSSESSED",
      position: { x: 1, y: 1 }
    }
  };

  assert.equal(validateHandballState(state).issues[0]?.code, "POSSESSED_BALL_POSITION_MISMATCH");
});

test("standard scenario has stable attack and defense roles", () => {
  assert.deepEqual(
    initialHalfCourt6v6State.players.filter((player) => player.team === "ATTACK").map((player) => player.role),
    ["LEFT_WING", "LEFT_BACK", "CENTER_BACK", "RIGHT_BACK", "RIGHT_WING", "PIVOT"]
  );
  assert.deepEqual(
    initialHalfCourt6v6State.players.filter((player) => player.team === "DEFENSE").map((player) => player.role),
    ["L1", "L2", "L3", "R3", "R2", "R1"]
  );
});

test("canonical FIELD positions initialize the default formations", () => {
  const centerBack = initialHalfCourt6v6State.players.find((player) => player.role === "CENTER_BACK");
  const firstDefender = initialHalfCourt6v6State.players.find((player) => player.id === "defense-defence-6-0-1");

  assert.deepEqual(centerBack?.position, { x: 9.08686, y: 11.854121 });
  assert.deepEqual(firstDefender?.position, { x: 2.004454, y: 2.054565 });
});

test("all start velocities are zero", () => {
  assert.ok(initialHalfCourt6v6State.players.every((player) => player.velocity.x === 0 && player.velocity.y === 0));
});

test("all start intents are idle", () => {
  assert.ok(initialHalfCourt6v6State.players.every((player) => player.intent.type === "IDLE"));
});

test("scenario factory returns deterministic equivalent state", () => {
  assert.deepEqual(createHalfCourt6v6State(), createHalfCourt6v6State());
});
