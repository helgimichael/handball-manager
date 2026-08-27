// HM-DATA-ALLSVENSKAN-1.1B Part 2: proves the tactical-role presentation
// layer never leaks a raw enum for any real role in the domain vocabulary.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTACK_ROLES, DEFENCE_ROLES } from "./types";
import { GOALKEEPER_ARCHETYPES } from "./gamePrior/types";
import { presentAttackRole, presentDefenceRole, presentGoalkeeperArchetype, presentTacticalRole } from "./presentation";

test("(1) every AttackRole renders as readable Swedish, never the raw enum", () => {
  for (const role of ATTACK_ROLES) {
    const text = presentAttackRole(role);
    assert.ok(!/_/.test(text) && !/[A-Z]{2,}/.test(text), `${role} -> "${text}"`);
  }
});

test("(2) every DefenceRole renders as readable Swedish, never the raw enum", () => {
  for (const role of DEFENCE_ROLES) {
    const text = presentDefenceRole(role);
    assert.ok(!/_/.test(text) && !/[A-Z]{2,}/.test(text), `${role} -> "${text}"`);
  }
});

test("(3) every GoalkeeperArchetype renders as readable Swedish, never the raw enum", () => {
  for (const archetype of GOALKEEPER_ARCHETYPES) {
    const text = presentGoalkeeperArchetype(archetype);
    assert.ok(!/_/.test(text) && !/[A-Z]{2,}/.test(text), `${archetype} -> "${text}"`);
  }
});

test("(4) presentTacticalRole resolves the two documented worked examples correctly", () => {
  assert.equal(presentTacticalRole("SCREENING_PIVOT"), "Skärmande mittsexa");
  assert.equal(presentTacticalRole("COMPLETE_BACK"), "Komplett nia");
});

test("(5) presentTacticalRole never throws and never leaks raw text for an unknown role", () => {
  const text = presentTacticalRole("SOME_FUTURE_ROLE");
  assert.ok(!text.includes("SOME_FUTURE_ROLE"));
  assert.ok(!/_/.test(text));
});
