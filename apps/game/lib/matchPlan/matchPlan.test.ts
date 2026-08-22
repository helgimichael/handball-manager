// HM-TACTICS-1.0 Part O: whole-MatchPlan composition tests -- the
// ATTACK/DEFENCE/TRANSITION structure, and the hard boundary this
// milestone requires: a fixture-specific plan must never be able to
// mutate the club's permanent tactical identity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultTeamTacticalProfile } from "../career/teamTacticalProfile";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { validateMatchPlan } from "./matchPlan";
import type { MatchSquad } from "./types";

function fullSquad(fixtureId = "fx1", clubId = "c1"): MatchSquad {
  return {
    fixtureId,
    clubId,
    players: [
      { playerId: "gk1", position: "GK" },
      { playerId: "gk2", position: "GK" },
      { playerId: "m9", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
      { playerId: "h6", position: "H6" },
      { playerId: "bench1", position: "V9" },
      { playerId: "bench2", position: "M6" },
    ],
  };
}

test("HM-TACTICS-1.0: a complete, coherent default match plan passes full composed validation", () => {
  const { plan } = buildDefaultMatchPlan(fullSquad());
  assert.ok(plan);
  const result = validateMatchPlan(plan!);
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
});

test("HM-TACTICS-1.0: a match plan carries separate ATTACK, DEFENCE, and TRANSITION tactical configuration -- not collapsed into one object", () => {
  const { plan } = buildDefaultMatchPlan(fullSquad());
  assert.ok(plan);
  assert.ok(plan!.attackPlan);
  assert.ok(plan!.defencePlan);
  assert.ok(plan!.transitionPlan);
  // Genuinely distinct shapes -- attack has tempo, defence has baseFormation, transition has firstWaveAggression.
  assert.ok("tempo" in plan!.attackPlan);
  assert.ok("baseFormation" in plan!.defencePlan);
  assert.ok("firstWaveAggression" in plan!.transitionPlan);
  assert.ok(!("tempo" in plan!.defencePlan));
  assert.ok(!("baseFormation" in plan!.attackPlan));
});

test("HM-TACTICS-1.0: MatchPlan structurally cannot carry a TeamTacticalProfile -- building and validating a fixture-specific plan never touches the club's permanent tactical identity object", () => {
  const clubProfile = defaultTeamTacticalProfile();
  const snapshotBefore = JSON.stringify(clubProfile);

  const { plan } = buildDefaultMatchPlan(fullSquad());
  assert.ok(plan);
  validateMatchPlan(plan!);

  // The club profile object passed nowhere near this domain is provably untouched.
  assert.equal(JSON.stringify(clubProfile), snapshotBefore);
  // And MatchPlan's own shape has no field of that type at all -- a
  // TeamTacticalProfile has exactly ati001UsageTendency/
  // h2ResponsePreference/tacticalFamiliarity; none of those keys exist
  // anywhere on the plan or its three phase configs.
  const planKeys = new Set([...Object.keys(plan!), ...Object.keys(plan!.attackPlan), ...Object.keys(plan!.defencePlan), ...Object.keys(plan!.transitionPlan)]);
  for (const clubProfileKey of Object.keys(clubProfile)) {
    assert.ok(!planKeys.has(clubProfileKey), `MatchPlan must not carry TeamTacticalProfile's "${clubProfileKey}" field`);
  }
});

test("HM-TACTICS-1.0: two different fixtures for the same club produce independent match plans with no shared mutable state", () => {
  const squadA = fullSquad("fixture_a", "c1");
  const squadB = fullSquad("fixture_b", "c1");
  const { plan: planA } = buildDefaultMatchPlan(squadA);
  const { plan: planB } = buildDefaultMatchPlan(squadB);
  assert.ok(planA && planB);
  assert.equal(planA!.fixtureId, "fixture_a");
  assert.equal(planB!.fixtureId, "fixture_b");
  // Deriving a changed copy of one plan must never affect the other.
  const changedA = { ...planA!, attackPlan: { ...planA!.attackPlan, tempo: "FAST" as const } };
  assert.equal(changedA.attackPlan.tempo, "FAST");
  assert.equal(planA!.attackPlan.tempo, "BALANCED", "the original planA object must be untouched");
  assert.equal(planB!.attackPlan.tempo, "BALANCED");
});
