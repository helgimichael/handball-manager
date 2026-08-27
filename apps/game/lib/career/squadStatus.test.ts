// HM-DATA-ALLSVENSKAN-1.1B Part 3: Persistent Squad Status proofs --
// real newCareer/saveMigration flow, mirroring contractCareerIntegration.test.ts's
// own established pattern.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createNewCareerState } from "./newCareer";
import { migrateCareerState } from "./saveMigration";
import { getCareerClubSquad } from "./careerWorld";
import { TUMBA_CLUB_ID } from "../game-data";
import { ensureCareerPlayerSquadStatus, SQUAD_STATUS_TIERS, updatePlayerSquadStatus } from "./squadStatus";
import type { CareerState } from "./types";
import type { PlayerMock } from "../game-data";

function fakePlayer(overrides: Partial<PlayerMock>): PlayerMock {
  return {
    id: "fake-player",
    clubId: TUMBA_CLUB_ID,
    firstName: "Fake",
    lastName: "Player",
    shirtNumber: null,
    position: "M9",
    nationality: "SWE",
    dateOfBirth: null,
    heightCm: null,
    weightKg: null,
    foot: null,
    squadStatus: "Rotation",
    currentAbility: 100,
    potentialAbility: 100,
    form: 5,
    fitnessPct: 100,
    moralePct: 70,
    appearances: 0,
    goals: 0,
    contractEndSeason: "2027/28",
    wageSekPerMonth: 0,
    attributes: {
      technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 },
      mental: { beslutsfattande: 10, kyla: 10, arbetskapacitet: 10, kampvilja: 10, positionering: 10, lagarbete: 10, ledarskap: 10 },
      physical: { snabbhet: 10, acceleration: 10, styrka: 10, explosivitet: 10, uthallighet: 10, rorlighet: 10 },
    },
    ...overrides,
  };
}

function freshTumba(seed: string): CareerState {
  return createNewCareerState(seed, TUMBA_CLUB_ID);
}

test("(1) a fresh career gives every roster player exactly one persistent squad-status tier, always a valid SquadStatusTier", () => {
  const state = freshTumba("squadstatus-1");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  for (const player of squad) {
    const tier = state.playerSquadStatus[player.id];
    assert.ok(tier, `missing squad status for ${player.id}`);
    assert.ok((SQUAD_STATUS_TIERS as readonly string[]).includes(tier));
  }
  assert.equal(Object.keys(state.playerSquadStatus).length, squad.length);
});

test("(2) calling ensureCareerPlayerSquadStatus on an already-complete roster returns the exact same state reference (true no-op)", () => {
  const state = freshTumba("squadstatus-2");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const result = ensureCareerPlayerSquadStatus(state, TUMBA_CLUB_ID, squad);
  assert.equal(result, state);
});

test("(3) updatePlayerSquadStatus persists the manager's explicit edit, and is a no-op when re-setting the identical value", () => {
  const state = freshTumba("squadstatus-3");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const updated = updatePlayerSquadStatus(state, playerId, "KEY_PLAYER");
  assert.equal(updated.playerSquadStatus[playerId], "KEY_PLAYER");
  assert.notEqual(updated, state);

  const noOp = updatePlayerSquadStatus(updated, playerId, "KEY_PLAYER");
  assert.equal(noOp, updated);
});

test("(4) a manager's edit survives ensureCareerPlayerSquadStatus/migration -- never re-derived or overwritten once explicitly set", () => {
  const state = freshTumba("squadstatus-4");
  const squad = getCareerClubSquad(state, TUMBA_CLUB_ID);
  const playerId = squad[0].id;
  const edited = updatePlayerSquadStatus(state, playerId, "TALENT");
  const reEnsured = ensureCareerPlayerSquadStatus(edited, TUMBA_CLUB_ID, squad);
  assert.equal(reEnsured.playerSquadStatus[playerId], "TALENT");

  const migrated = migrateCareerState(edited);
  assert.equal(migrated.playerSquadStatus[playerId], "TALENT");
});

test("(5) a pre-1.1B save (playerSquadStatus entirely absent) migrates to a complete tier set for every roster player", () => {
  const state = freshTumba("squadstatus-5");
  const legacy = { ...state } as Partial<CareerState>;
  delete (legacy as Record<string, unknown>).playerSquadStatus;
  const migrated = migrateCareerState(legacy as CareerState);
  const squad = getCareerClubSquad(migrated, TUMBA_CLUB_ID);
  assert.equal(Object.keys(migrated.playerSquadStatus).length, squad.length);
});

test("(6) squad status is independent of playerMatchDefaults/playerStatuses -- editing one never touches the others", () => {
  const state = freshTumba("squadstatus-6");
  const playerId = getCareerClubSquad(state, TUMBA_CLUB_ID)[0].id;
  const before = { matchDefaults: state.playerMatchDefaults, playerStatuses: state.playerStatuses };
  const updated = updatePlayerSquadStatus(state, playerId, "KEY_PLAYER");
  assert.equal(updated.playerMatchDefaults, before.matchDefaults);
  assert.equal(updated.playerStatuses, before.playerStatuses);
});

test("(7) a career's squad status survives a JSON save/reload round-trip byte-for-byte", () => {
  const state = freshTumba("squadstatus-7");
  const roundTripped = JSON.parse(JSON.stringify(state)) as CareerState;
  assert.deepEqual(roundTripped.playerSquadStatus, state.playerSquadStatus);
});

test("(8) HM-PLAYER-DATA-EDITOR-1.0: an editor-calibrated calibratedSquadStatusTier wins outright as the career's starting default, overriding the coarse Förstaval/Rotation-based guess", () => {
  const state = freshTumba("squadstatus-8");
  const calibrated = fakePlayer({ id: "calibrated-key-player", squadStatus: "Rotation", calibratedSquadStatusTier: "KEY_PLAYER" });
  const next = ensureCareerPlayerSquadStatus(state, TUMBA_CLUB_ID, [calibrated]);
  assert.equal(next.playerSquadStatus["calibrated-key-player"], "KEY_PLAYER", "the calibrated tier must win even though the coarse squadStatus ('Rotation') would otherwise derive ROTATION");
});

test("(9) HM-PLAYER-DATA-EDITOR-1.0: a player with no calibratedSquadStatusTier still falls back to the pre-existing coarse derivation, unaffected", () => {
  const state = freshTumba("squadstatus-9");
  const uncalibrated = fakePlayer({ id: "uncalibrated-player", squadStatus: "Förstaval" });
  const next = ensureCareerPlayerSquadStatus(state, TUMBA_CLUB_ID, [uncalibrated]);
  assert.equal(next.playerSquadStatus["uncalibrated-player"], "FIRST_CHOICE");
});
