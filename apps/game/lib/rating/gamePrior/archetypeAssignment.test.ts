// HM-RATINGS-0.6 Part D/F/O: proves archetype assignment is
// deterministic, always valid for the position, and reuses the
// existing role vocabulary for outcourt players.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTACK_ROLES_BY_POSITION, OUTCOURT_POSITIONS } from "../types";
import { assignArchetypeForPosition, assignGoalkeeperArchetype, assignOutcourtArchetype } from "./archetypeAssignment";
import { GOALKEEPER_ARCHETYPES } from "./types";

test("HM-RATINGS-0.6: assignOutcourtArchetype always returns a role that exists in ATTACK_ROLES_BY_POSITION for that position", () => {
  for (const position of OUTCOURT_POSITIONS) {
    for (const id of ["p1", "p2", "p3", "p4", "p5"]) {
      const role = assignOutcourtArchetype(id, position, "v1");
      assert.ok((ATTACK_ROLES_BY_POSITION[position] as readonly string[]).includes(role), `${role} is not valid for ${position}`);
    }
  }
});

test("HM-RATINGS-0.6: assignGoalkeeperArchetype always returns one of the 4 GK archetypes", () => {
  for (const id of ["p1", "p2", "p3", "p4", "p5"]) {
    assert.ok(GOALKEEPER_ARCHETYPES.includes(assignGoalkeeperArchetype(id, "v1")));
  }
});

test("HM-RATINGS-0.6: archetype assignment is deterministic", () => {
  assert.equal(assignOutcourtArchetype("p1", "M9", "v1"), assignOutcourtArchetype("p1", "M9", "v1"));
  assert.equal(assignGoalkeeperArchetype("p1", "v1"), assignGoalkeeperArchetype("p1", "v1"));
});

test("HM-RATINGS-0.6: different players at the same position receive varied archetypes, not all the same one", () => {
  const roles = new Set(Array.from({ length: 20 }, (_, i) => assignOutcourtArchetype(`m9_player_${i}`, "M9", "v1")));
  assert.ok(roles.size > 1, "expected more than one distinct archetype across 20 M9 players");
});

test("HM-RATINGS-0.6: assignArchetypeForPosition dispatches to the goalkeeper table for GK and the outcourt table otherwise", () => {
  const gk = assignArchetypeForPosition("p1", "GK", "v1");
  assert.ok(GOALKEEPER_ARCHETYPES.includes(gk as never));
  const outcourt = assignArchetypeForPosition("p1", "M9", "v1");
  assert.ok((ATTACK_ROLES_BY_POSITION.M9 as readonly string[]).includes(outcourt));
});
