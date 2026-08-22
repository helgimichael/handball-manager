// HM-TACTICS-1.0 Part O: substitution-pair validation tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSubstitutionPairs } from "./substitutionPairs";
import type { MatchSquad, SubstitutionPair } from "./types";

const squad: MatchSquad = {
  fixtureId: "fx1",
  clubId: "c1",
  players: [
    { playerId: "attacker1", position: "M9" },
    { playerId: "defender1", position: "M6" },
    { playerId: "attacker2", position: "V9" },
    { playerId: "defender2", position: "M6" },
  ],
};

test("HM-TACTICS-1.0: a valid substitution pair (both players in squad, different players) passes", () => {
  const pairs: SubstitutionPair[] = [{ attackPlayerId: "attacker1", defencePlayerId: "defender1" }];
  assert.equal(validateSubstitutionPairs(pairs, squad).ok, true);
});

test("HM-TACTICS-1.0: multiple independent substitution pairs all pass", () => {
  const pairs: SubstitutionPair[] = [
    { attackPlayerId: "attacker1", defencePlayerId: "defender1" },
    { attackPlayerId: "attacker2", defencePlayerId: "defender2" },
  ];
  assert.equal(validateSubstitutionPairs(pairs, squad).ok, true);
});

test("HM-TACTICS-1.0: a self-pair is rejected", () => {
  const pairs: SubstitutionPair[] = [{ attackPlayerId: "attacker1", defencePlayerId: "attacker1" }];
  const result = validateSubstitutionPairs(pairs, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("themselves")));
});

test("HM-TACTICS-1.0: a pair referencing a player outside the squad is rejected", () => {
  const pairs: SubstitutionPair[] = [{ attackPlayerId: "attacker1", defencePlayerId: "outsider" }];
  const result = validateSubstitutionPairs(pairs, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("outsider")));
});

test("HM-TACTICS-1.0: a player belonging to two different pairs is rejected", () => {
  const pairs: SubstitutionPair[] = [
    { attackPlayerId: "attacker1", defencePlayerId: "defender1" },
    { attackPlayerId: "attacker1", defencePlayerId: "defender2" },
  ];
  const result = validateSubstitutionPairs(pairs, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("more than one substitution pair")));
});

test("HM-TACTICS-1.0: an empty pair list is valid (pairs are optional coach intent)", () => {
  assert.equal(validateSubstitutionPairs([], squad).ok, true);
});
