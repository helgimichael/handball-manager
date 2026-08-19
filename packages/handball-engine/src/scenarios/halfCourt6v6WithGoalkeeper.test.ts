import assert from "node:assert/strict";
import test from "node:test";
import { validateHandballState } from "../domain/handball/validation";
import { DEFAULT_MOVEMENT_PROFILE } from "../domain/handball/movement";
import { step } from "../simulation/engine";
import {
  createHalfCourt6v6StateWithGoalkeeper,
  initialHalfCourt6v6State,
  initialHalfCourt6v6WithGoalkeeperState
} from "./halfCourt6v6";

// HM-0.4A: goalkeeper-as-entity foundation tests. These deliberately
// live in a new file rather than editing halfCourt6v6.test.ts, so every
// pre-existing SIM test file (asserting the goalkeeper-less
// initialHalfCourt6v6State against validateStandardSixVsSixState's
// exact 6/6 check) stays completely untouched.

test("goalkeeper exists in the new canonical state, additional to the existing 12 field players (1, 18)", () => {
  assert.equal(initialHalfCourt6v6WithGoalkeeperState.players.length, 13);
  const fieldPlayers = initialHalfCourt6v6WithGoalkeeperState.players.filter((player) => player.kind === "FIELD_PLAYER");
  assert.equal(fieldPlayers.length, 12);
});

test("goalkeeper has a stable unique id, distinct from every field player id (2)", () => {
  const goalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((player) => player.kind === "GOALKEEPER");
  assert.ok(goalkeeper);
  assert.equal(goalkeeper!.id, "defense-defence-6-0-goalkeeper");
  const ids = initialHalfCourt6v6WithGoalkeeperState.players.map((player) => player.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("goalkeeper belongs to the DEFENSE team in this half-court scenario (3)", () => {
  const goalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((player) => player.kind === "GOALKEEPER");
  assert.equal(goalkeeper?.team, "DEFENSE");
});

test("goalkeeper is distinguishable from field players by kind and role, and is excluded from the field DefenseRole taxonomy (4)", () => {
  const goalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((player) => player.kind === "GOALKEEPER");
  assert.ok(goalkeeper);
  assert.equal(goalkeeper!.kind, "GOALKEEPER");
  assert.equal(goalkeeper!.role, "GOALKEEPER");
  const fieldDefenderRoles = ["L1", "L2", "L3", "R3", "R2", "R1"];
  assert.ok(!fieldDefenderRoles.includes(goalkeeper!.role));
});

test("goalkeeper starts at the canonical FIELD coordinate for defence-6-0, not an invented value (5)", () => {
  const goalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((player) => player.kind === "GOALKEEPER");
  // Same coordinate as canonicals/fieldHandball/formations.ts's
  // "defence-6-0" GOALKEEPER object -- byte-identical to FIELD's own
  // FormationLibrary.ts, per HM-0.1/HM-0.2D.
  assert.deepEqual(goalkeeper?.position, { x: 9.888641, y: 0.517817 });
});

test("goalkeeper has a valid facing vector derived from the canonical rotation (6)", () => {
  const goalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((player) => player.kind === "GOALKEEPER");
  assert.ok(goalkeeper);
  // rotation 180 -> facing { x: sin(pi), y: -cos(pi) } = { x: ~0, y: 1 }
  assert.ok(Math.abs(goalkeeper!.facing.x) < 1e-9);
  assert.ok(Math.abs(goalkeeper!.facing.y - 1) < 1e-9);
  const magnitude = Math.hypot(goalkeeper!.facing.x, goalkeeper!.facing.y);
  assert.ok(Math.abs(magnitude - 1) < 1e-9);
});

test("goalkeeper has a valid MovementProfile, the same shared default other players use (7)", () => {
  const goalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((player) => player.kind === "GOALKEEPER");
  assert.deepEqual(goalkeeper?.movementProfile, DEFAULT_MOVEMENT_PROFILE);
});

test("goalkeeper starts idle with zero velocity, same invariant as every other player", () => {
  const goalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((player) => player.kind === "GOALKEEPER");
  assert.deepEqual(goalkeeper?.velocity, { x: 0, y: 0 });
  assert.deepEqual(goalkeeper?.intent, { type: "IDLE" });
});

test("goalkeeper-inclusive state still passes general world validation", () => {
  assert.deepEqual(validateHandballState(initialHalfCourt6v6WithGoalkeeperState), { valid: true, issues: [] });
});

test("the goalkeeper-less scenario is completely unaffected -- still exactly 12 players, 6 ATTACK + 6 DEFENSE", () => {
  assert.equal(initialHalfCourt6v6State.players.length, 12);
  assert.equal(initialHalfCourt6v6State.players.filter((p) => p.team === "DEFENSE").length, 6);
  assert.ok(!initialHalfCourt6v6State.players.some((p) => p.kind === "GOALKEEPER"));
});

test("goalkeeper defense.homePositions are not polluted -- still exactly the 6 field defenders", () => {
  assert.equal(initialHalfCourt6v6WithGoalkeeperState.defense.homePositions.length, 6);
  assert.ok(!initialHalfCourt6v6WithGoalkeeperState.defense.homePositions.some((home) => home.playerId.endsWith("goalkeeper")));
});

test("goalkeeper can be moved through the existing MOVE mechanics (17)", () => {
  const goalkeeper = initialHalfCourt6v6WithGoalkeeperState.players.find((player) => player.kind === "GOALKEEPER")!;
  const target = { x: 9.888641, y: 1.5 };
  const moved = step(
    initialHalfCourt6v6WithGoalkeeperState,
    { actions: [{ type: "MOVE", playerId: goalkeeper.id, target }] },
    0.5
  );
  const movedGoalkeeper = moved.players.find((player) => player.id === goalkeeper.id)!;
  assert.ok(movedGoalkeeper.position.y > goalkeeper.position.y, "expected the goalkeeper to have moved toward the target");
  assert.equal(movedGoalkeeper.kind, "GOALKEEPER");
});

test("scenario factory returns deterministic equivalent state", () => {
  assert.deepEqual(createHalfCourt6v6StateWithGoalkeeper(), createHalfCourt6v6StateWithGoalkeeper());
});
