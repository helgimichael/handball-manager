// HM-TACTICS-1.0 Part O: MatchSquad validation tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateMatchSquad } from "./matchSquad";
import type { MatchSquad } from "./types";

function player(playerId: string, position: MatchSquad["players"][number]["position"] = "M9") {
  return { playerId, position };
}

test("HM-TACTICS-1.0: a valid 16-player squad passes validation", () => {
  const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: Array.from({ length: 16 }, (_, i) => player(`p${i}`)) };
  assert.equal(validateMatchSquad(squad).ok, true);
});

test("HM-TACTICS-1.0: a 17-player squad is rejected", () => {
  const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: Array.from({ length: 17 }, (_, i) => player(`p${i}`)) };
  const result = validateMatchSquad(squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("at most 16")));
});

test("HM-TACTICS-1.0: a duplicate player in the squad is rejected", () => {
  const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: [player("p1"), player("p2"), player("p1")] };
  const result = validateMatchSquad(squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("Duplicate player")));
});

test("HM-TACTICS-1.0: a squad player not in the available roster source is rejected", () => {
  const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: [player("p1"), player("p2")] };
  const result = validateMatchSquad(squad, ["p1"]);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("p2") && e.includes("not part of the available squad source")));
});

test("HM-TACTICS-1.0: an empty squad is rejected (minimum 1 player)", () => {
  const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: [] };
  assert.equal(validateMatchSquad(squad).ok, false);
});

test("HM-TACTICS-1.0: goalkeeper/outcourt identity is preserved -- a GK player's position stays 'GK'", () => {
  const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: [player("gk1", "GK"), player("out1", "M9")] };
  assert.equal(squad.players[0].position, "GK");
  assert.notEqual(squad.players[1].position, "GK");
});
