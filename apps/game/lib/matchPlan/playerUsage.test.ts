// HM-TACTICS-1.0 Part O: player match-role, playing-time intention, and
// phase-usage vocabulary tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePlayerUsage } from "./playerUsage";
import { MATCH_ROLES, PLAYER_PHASE_USAGES, PLAYING_TIME_INTENTIONS } from "./types";
import type { MatchSquad, PlayerMatchUsage } from "./types";

const squad: MatchSquad = { fixtureId: "fx1", clubId: "c1", players: [{ playerId: "p1", position: "M9" }, { playerId: "p2", position: "M6" }] };

test("HM-TACTICS-1.0: the full match-role vocabulary is usable in a PlayerMatchUsage entry", () => {
  for (const role of MATCH_ROLES) {
    const usage: PlayerMatchUsage = { playerId: "p1", matchRole: role, playingTimeIntention: "NORMAL", phaseUsage: "BOTH_PHASES" };
    assert.equal(usage.matchRole, role);
  }
});

test("HM-TACTICS-1.0: the full playing-time-intention vocabulary is usable", () => {
  for (const intention of PLAYING_TIME_INTENTIONS) {
    const usage: PlayerMatchUsage = { playerId: "p1", matchRole: "ROTATION", playingTimeIntention: intention, phaseUsage: "BOTH_PHASES" };
    assert.equal(usage.playingTimeIntention, intention);
  }
});

test("HM-TACTICS-1.0: the full phase-usage vocabulary is usable, including attack-only/defence-only specialist pairing", () => {
  for (const phase of PLAYER_PHASE_USAGES) {
    const usage: PlayerMatchUsage = { playerId: "p1", matchRole: "SPECIALIST", playingTimeIntention: "NORMAL", phaseUsage: phase };
    assert.equal(usage.phaseUsage, phase);
  }
  // Concrete example from Part F: an attack-only playmaker and a defence-only specialist.
  const attackOnly: PlayerMatchUsage = { playerId: "p1", matchRole: "SPECIALIST", playingTimeIntention: "HIGH", phaseUsage: "ATTACK_ONLY" };
  const defenceOnly: PlayerMatchUsage = { playerId: "p2", matchRole: "SPECIALIST", playingTimeIntention: "HIGH", phaseUsage: "DEFENCE_ONLY" };
  const result = validatePlayerUsage([attackOnly, defenceOnly], squad);
  assert.equal(result.ok, true);
});

test("HM-TACTICS-1.0: every squad player must have a usage entry -- a missing one is rejected", () => {
  const usage: PlayerMatchUsage[] = [{ playerId: "p1", matchRole: "STARTER", playingTimeIntention: "HIGH", phaseUsage: "BOTH_PHASES" }];
  const result = validatePlayerUsage(usage, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("p2") && e.includes("no match-role")));
});

test("HM-TACTICS-1.0: a usage entry for a player outside the squad is rejected", () => {
  const usage: PlayerMatchUsage[] = [
    { playerId: "p1", matchRole: "STARTER", playingTimeIntention: "HIGH", phaseUsage: "BOTH_PHASES" },
    { playerId: "p2", matchRole: "STARTER", playingTimeIntention: "HIGH", phaseUsage: "BOTH_PHASES" },
    { playerId: "outsider", matchRole: "STARTER", playingTimeIntention: "HIGH", phaseUsage: "BOTH_PHASES" },
  ];
  const result = validatePlayerUsage(usage, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("outsider")));
});

test("HM-TACTICS-1.0: a duplicate usage entry for the same player is rejected", () => {
  const usage: PlayerMatchUsage[] = [
    { playerId: "p1", matchRole: "STARTER", playingTimeIntention: "HIGH", phaseUsage: "BOTH_PHASES" },
    { playerId: "p1", matchRole: "ROTATION", playingTimeIntention: "LOW", phaseUsage: "BOTH_PHASES" },
    { playerId: "p2", matchRole: "STARTER", playingTimeIntention: "HIGH", phaseUsage: "BOTH_PHASES" },
  ];
  const result = validatePlayerUsage(usage, squad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("Duplicate")));
});
