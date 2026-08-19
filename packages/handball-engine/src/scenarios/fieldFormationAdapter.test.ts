import assert from "node:assert/strict";
import test from "node:test";
import { CANONICAL_BOARD_OBJECT_VISUALS } from "../canonicals/fieldHandball/boardObjectVisuals";
import { CANONICAL_ATTACK_FORMATIONS, CANONICAL_DEFENSE_FORMATIONS } from "../canonicals/fieldHandball/formations";
import {
  DEFAULT_ATTACK_FORMATION_ID,
  DEFAULT_DEFENSE_FORMATION_ID,
  fieldAttackFormationToBall,
  fieldAttackFormationToPlayers,
  fieldDefenseFormationToPlayers
} from "./fieldFormationAdapter";

test("SIM initializes players from canonical FIELD formations", () => {
  const attackers = fieldAttackFormationToPlayers(DEFAULT_ATTACK_FORMATION_ID);
  const defenders = fieldDefenseFormationToPlayers(DEFAULT_DEFENSE_FORMATION_ID);

  assert.equal(attackers.length, 6);
  assert.equal(defenders.length, 6);
  assert.deepEqual(
    attackers.map((player) => player.role),
    ["LEFT_WING", "LEFT_BACK", "CENTER_BACK", "RIGHT_BACK", "RIGHT_WING", "PIVOT"]
  );
  assert.deepEqual(attackers.find((player) => player.role === "CENTER_BACK")?.position, { x: 9.08686, y: 11.854121 });
  assert.deepEqual(defenders[0]?.position, { x: 2.004454, y: 2.054565 });
});

test("canonical FIELD ball position is interpreted as carried possession when near an attacker", () => {
  const attackers = fieldAttackFormationToPlayers(DEFAULT_ATTACK_FORMATION_ID);
  const ball = fieldAttackFormationToBall(DEFAULT_ATTACK_FORMATION_ID, attackers);
  const centerBack = attackers.find((player) => player.role === "CENTER_BACK");

  assert.ok(centerBack);
  assert.deepEqual(ball.position, centerBack.position);
  assert.equal(ball.possessorId, centerBack.id);
  assert.equal(ball.status, "POSSESSED");
  assert.equal(ball.flight, null);
});

test("available formation registries expose only FIELD presets", () => {
  assert.deepEqual(
    CANONICAL_DEFENSE_FORMATIONS.map((formation) => formation.id),
    ["defence-6-0", "defence-5-1", "defence-3-2-1", "defence-3-3", "defence-4-2", "attack-7-vs-6"]
  );
  assert.deepEqual(
    CANONICAL_ATTACK_FORMATIONS.map((formation) => formation.id),
    ["attack-6", "attack-7", "attack-empty-left-wing"]
  );
});

test("SIM visual mapping uses canonical FIELD object definitions", () => {
  assert.equal(CANONICAL_BOARD_OBJECT_VISUALS.ATTACKER.shape, "triangle");
  assert.equal(CANONICAL_BOARD_OBJECT_VISUALS.DEFENDER.shape, "circle");
  assert.equal(CANONICAL_BOARD_OBJECT_VISUALS.GOALKEEPER.shape, "square");
  assert.equal(CANONICAL_BOARD_OBJECT_VISUALS.BALL.physicalSizeMeters, 0.19);
});
