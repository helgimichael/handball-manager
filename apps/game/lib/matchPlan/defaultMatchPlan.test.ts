// HM-TACTICS-1.0 Part O: default match plan tests -- determinism, only
// referencing selected squad players, and (Part O: "use real player/
// position data in at least one test") a real Handbollsligan club
// squad run through the domain end-to-end.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadRealWorldClubSquad } from "../gameWorld/realWorldLoader";
import { mapPrimaryPosition } from "../rating/pipeline/evidenceCollection";
import { buildDefaultMatchPlan } from "./defaultMatchPlan";
import { validateMatchSquad } from "./matchSquad";
import { validateMatchPlan } from "./matchPlan";
import type { MatchSquad } from "./types";

function fullSquad(): MatchSquad {
  return {
    fixtureId: "fx1",
    clubId: "c1",
    players: [
      { playerId: "gk1", position: "GK" },
      { playerId: "m9", position: "M9" },
      { playerId: "v9", position: "V9" },
      { playerId: "h9", position: "H9" },
      { playerId: "m6", position: "M6" },
      { playerId: "v6", position: "V6" },
      { playerId: "h6", position: "H6" },
      { playerId: "bench1", position: "V9" },
    ],
  };
}

test("HM-TACTICS-1.0: buildDefaultMatchPlan is deterministic -- same squad always produces the same plan", () => {
  const squad = fullSquad();
  const a = buildDefaultMatchPlan(squad);
  const b = buildDefaultMatchPlan(squad);
  assert.deepEqual(a, b);
});

test("HM-TACTICS-1.0: the default plan references only players from the selected squad -- attack unit, defence unit, usage, and depth hierarchy", () => {
  const squad = fullSquad();
  const { plan } = buildDefaultMatchPlan(squad);
  assert.ok(plan);
  const squadIds = new Set(squad.players.map((p) => p.playerId));

  for (const slot of plan!.attackStartingUnit.slots) assert.ok(squadIds.has(slot.playerId));
  for (const slot of plan!.defenceStartingUnit.courtSlots) assert.ok(squadIds.has(slot.playerId));
  assert.ok(squadIds.has(plan!.defenceStartingUnit.goalkeeperId));
  for (const usage of plan!.playerUsage) assert.ok(squadIds.has(usage.playerId));
  for (const group of plan!.depthHierarchy) {
    for (const entry of group.entries) assert.ok(squadIds.has(entry.playerId));
  }
});

test("HM-TACTICS-1.0: every starter in the default plan belongs to the 16-player match squad (validated end-to-end)", () => {
  const { plan } = buildDefaultMatchPlan(fullSquad());
  assert.ok(plan);
  const result = validateMatchPlan(plan!);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
});

test("HM-TACTICS-1.0: buildDefaultMatchPlan fails honestly (never fabricates a plan) for a squad with no goalkeeper", () => {
  const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: fullSquad().players.filter((p) => p.position !== "GK") };
  const result = buildDefaultMatchPlan(squad);
  assert.equal(result.ok, false);
  assert.equal(result.plan, null);
  assert.ok(result.errors.some((e) => e.includes("no goalkeeper")));
});

test("HM-TACTICS-1.0: buildDefaultMatchPlan fails honestly for a squad with fewer than 6 outcourt players", () => {
  const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: [{ playerId: "gk1", position: "GK" }, { playerId: "m9", position: "M9" }] };
  const result = buildDefaultMatchPlan(squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("fewer than 6")));
});

test("HM-TACTICS-1.0: a real Handbollsligan club squad (Hammarby IF HF) produces a valid, complete default match plan", () => {
  const squad = loadRealWorldClubSquad("se_club_hammarby_if_hf");
  assert.ok(squad, "expected to load a real club squad");

  const matchSquadPlayers = squad!.players
    .map((p) => {
      const position = mapPrimaryPosition(p.primaryPosition);
      return position ? { playerId: p.playerId, position } : null;
    })
    .filter((p): p is { playerId: string; position: NonNullable<ReturnType<typeof mapPrimaryPosition>> } => p !== null);

  const matchSquad: MatchSquad = { fixtureId: "real_fixture_1", clubId: squad!.clubId, players: matchSquadPlayers.slice(0, 16) };

  const squadValidation = validateMatchSquad(matchSquad, squad!.players.map((p) => p.playerId));
  assert.equal(squadValidation.ok, true, JSON.stringify(squadValidation.errors));

  const { plan, errors } = buildDefaultMatchPlan(matchSquad);
  assert.ok(plan, `expected a default plan to build for a real 16-player Hammarby selection: ${errors.join(", ")}`);

  const validation = validateMatchPlan(plan!, squad!.players.map((p) => p.playerId));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.equal(plan!.squad.players.length, 16);
  assert.equal(plan!.attackStartingUnit.formation, "NORMAL");
  assert.equal(plan!.attackStartingUnit.slots.length, 7);
});

