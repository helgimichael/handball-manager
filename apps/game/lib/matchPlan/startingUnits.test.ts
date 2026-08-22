// HM-TACTICS-1.0 Part O: attack/defence starting-unit tests -- normal
// and 7v6 attack formations, independent attack/defence selection,
// attack-only/defence-only specialist pairing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAttackStartingUnit, validateDefenceStartingUnit } from "./startingUnits";
import type { AttackStartingUnit, DefenceStartingUnit, MatchSquad } from "./types";

const squad: MatchSquad = {
  fixtureId: "fx1",
  clubId: "c1",
  players: [
    { playerId: "gk1", position: "GK" },
    { playerId: "gk2", position: "GK" },
    { playerId: "m9", position: "M9" },
    { playerId: "v9", position: "V9" },
    { playerId: "h9", position: "H9" },
    { playerId: "m6", position: "M6" },
    { playerId: "v6", position: "V6" },
    { playerId: "h6", position: "H6" },
    { playerId: "def_specialist", position: "M6" },
    { playerId: "attack_specialist", position: "M9" },
  ],
};

test("HM-TACTICS-1.0: a valid normal 6+GK attack formation passes", () => {
  const unit: AttackStartingUnit = {
    formation: "NORMAL",
    slots: [
      { playerId: "gk1", position: "GK" },
      { playerId: "m9", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
      { playerId: "h6", position: "H6" },
    ],
  };
  assert.equal(validateAttackStartingUnit(unit, squad).ok, true);
});

test("HM-TACTICS-1.0: a valid 7v6 starting attack (7 outcourt, no goalkeeper) passes", () => {
  const unit: AttackStartingUnit = {
    formation: "SEVEN_V_SIX",
    slots: [
      { playerId: "m9", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
      { playerId: "h6", position: "H6" },
      { playerId: "attack_specialist", position: "M9" }, // duplicate position allowed for 7v6 (Part B: represented flexibly)
    ],
  };
  assert.equal(validateAttackStartingUnit(unit, squad).ok, true);
});

test("HM-TACTICS-1.0: a 7v6 attack that still includes a goalkeeper is rejected (invalid goalkeeper/7v6 configuration)", () => {
  const unit: AttackStartingUnit = {
    formation: "SEVEN_V_SIX",
    slots: [
      { playerId: "gk1", position: "GK" },
      { playerId: "m9", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
      { playerId: "h6", position: "H6" },
    ],
  };
  const result = validateAttackStartingUnit(unit, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("zero goalkeeper")));
});

test("HM-TACTICS-1.0: a normal attack formation with two goalkeepers is rejected", () => {
  const unit: AttackStartingUnit = {
    formation: "NORMAL",
    slots: [
      { playerId: "gk1", position: "GK" },
      { playerId: "gk2", position: "GK" },
      { playerId: "m9", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
    ],
  };
  const result = validateAttackStartingUnit(unit, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("exactly 1 goalkeeper")));
});

test("HM-TACTICS-1.0: a normal attack formation missing a position is rejected", () => {
  const unit: AttackStartingUnit = {
    formation: "NORMAL",
    slots: [
      { playerId: "gk1", position: "GK" },
      { playerId: "m9", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
      { playerId: "attack_specialist", position: "M9" }, // duplicate instead of H6
    ],
  };
  const result = validateAttackStartingUnit(unit, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("missing position \"H6\"")));
});

test("HM-TACTICS-1.0: attack and defence starters are selected independently -- defence can start a different set of players than attack", () => {
  const attackUnit: AttackStartingUnit = {
    formation: "NORMAL",
    slots: [
      { playerId: "gk1", position: "GK" },
      { playerId: "attack_specialist", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
      { playerId: "h6", position: "H6" },
    ],
  };
  const defenceUnit: DefenceStartingUnit = {
    goalkeeperId: "gk1",
    courtSlots: [
      { playerId: "def_specialist", courtSlot: 1 }, // NOT in the attack unit -- defence-only specialist
      { playerId: "v9", courtSlot: 2 },
      { playerId: "h9", courtSlot: 3 },
      { playerId: "m6", courtSlot: 4 },
      { playerId: "v6", courtSlot: 5 },
      { playerId: "h6", courtSlot: 6 },
    ],
  };
  assert.equal(validateAttackStartingUnit(attackUnit, squad).ok, true);
  assert.equal(validateDefenceStartingUnit(defenceUnit, squad).ok, true);
  const attackIds = new Set(attackUnit.slots.map((s) => s.playerId));
  const defenceIds = new Set(defenceUnit.courtSlots.map((s) => s.playerId));
  assert.ok(!attackIds.has("def_specialist"), "the defence-only specialist must not appear in the attack unit");
  assert.ok(!defenceIds.has("attack_specialist"), "the attack-only specialist must not appear in the defence unit");
});

test("HM-TACTICS-1.0: a defence unit whose goalkeeper is not actually a GK in the squad is rejected", () => {
  const unit: DefenceStartingUnit = {
    goalkeeperId: "m9", // not a goalkeeper
    courtSlots: [
      { playerId: "v9", courtSlot: 1 },
      { playerId: "h9", courtSlot: 2 },
      { playerId: "m6", courtSlot: 3 },
      { playerId: "v6", courtSlot: 4 },
      { playerId: "h6", courtSlot: 5 },
      { playerId: "def_specialist", courtSlot: 6 },
    ],
  };
  const result = validateDefenceStartingUnit(unit, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("not a goalkeeper")));
});

test("HM-TACTICS-1.0: a defence unit with a duplicated court slot number is rejected", () => {
  const unit: DefenceStartingUnit = {
    goalkeeperId: "gk1",
    courtSlots: [
      { playerId: "m9", courtSlot: 1 },
      { playerId: "v9", courtSlot: 1 },
      { playerId: "h9", courtSlot: 3 },
      { playerId: "m6", courtSlot: 4 },
      { playerId: "v6", courtSlot: 5 },
      { playerId: "h6", courtSlot: 6 },
    ],
  };
  const result = validateDefenceStartingUnit(unit, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("used more than once")));
});

test("HM-TACTICS-1.0: an attack unit referencing a player outside the match squad is rejected", () => {
  const unit: AttackStartingUnit = {
    formation: "NORMAL",
    slots: [
      { playerId: "gk1", position: "GK" },
      { playerId: "not_in_squad", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
      { playerId: "h6", position: "H6" },
    ],
  };
  const result = validateAttackStartingUnit(unit, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("not_in_squad")));
});
