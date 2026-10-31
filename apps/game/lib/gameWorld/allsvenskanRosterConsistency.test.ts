// HM-DATA-1.3 / HM-DATA-1.5: permanent guards for the Swedish roster
// corrections (Profixio leagueid28141 + leagueid28142, snapshot 2026-10-31)
// -- no club may silently snapshot as an empty squad, one identity and one
// roster membership per playerId across every league, no cross-league
// name+DOB identity collisions, every locked Herrallsvenskan rating agrees
// with its roster row on position and GOALKEEPER/OUTCOURT branch, and no
// Division 1 goalkeeper/outfield branch conflict beyond the documented
// unresolved ones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCatalog } from "../editor/catalog";
import { loadRealWorldClubSquad, validateClubSquad } from "./realWorldLoader";
import { loadRatingDatabase } from "../editor/ratingDatabaseRepository";
import { readDataFile } from "./dataFiles";

const readJsonFile = <T>(file: string): T => JSON.parse(readDataFile(file).replace(/^﻿/, "")) as T;

const ALLSVENSKAN_COMPETITION_ID = "swe-2";
const DIVISION_1_COMPETITION_IDS = ["se_division1_norra", "se_division1_sodra"];

// HM-DATA-1.5 merged the only pre-existing pair (Olle Söderqvist); keep this empty unless an owner decision documents a new one.
const KNOWN_NAME_DOB_COLLISIONS = new Set<string>([]);

// HM-DATA-1.5/1.6 UNRESOLVED: Division 1 GK/OUTCOURT branch conflicts with no exact sourced position (never guessed);
// HM-DATA-1.6 removed the unsupported memberships of Thronborg and Källström, so they left this list.
const DIVISION_1_UNRESOLVED_BRANCH = new Set([
  "player_morgan_lindstrom_8ede3dcf", // Bodens BK HF: Profixio MV vs research H9
  "player_emmet_broman_1bbd897a", // HK Cliff: outfield, side unknown
  "player_fabio_carlos_pereira_f2f96196", // Kärra HF: outfield, side unknown
  "player_simon_hedlund_2e446f63", // HK Cliff: outfield (wing), side unknown
  "player_isho_nissan_fa1beff1", // Sannadals SK: "9M", side unknown
  "player_marcus_nylund_235313fd", // Sannadals SK: outfield (wing), side unknown
]);

// HM-DATA-1.3 HOLD: roster/lock drift that predates the correction and is deliberately left until the position is verified.
const HELD_POSITION_DRIFT = new Set(["se_player_axel_hulten_d4d855a0", "se_player_tobias_leile_2d7a55da"]);

interface IdentityRow { playerId: string; fullName: string; dateOfBirth: string | null }
interface RosterRow { playerId: string; primaryPosition: string }

const catalog = buildCatalog();

test("every real-world club in every competition loads, validates and is non-empty (no silent empty worldSquad)", () => {
  for (const club of catalog.clubs) {
    const squad = loadRealWorldClubSquad(club.clubId);
    assert.ok(squad, `${club.clubId}: not loadable`);
    const result = validateClubSquad(squad!);
    assert.ok(result.ok, `${club.clubId}: ${JSON.stringify(result.errors)}`);
    assert.ok(squad!.players.length > 0, `${club.clubId}: empty squad`);
  }
});

test("each playerId has exactly one identity record and at most one roster membership across all leagues", () => {
  const identities = new Map<string, string[]>();
  const memberships = new Map<string, string[]>();
  for (const club of catalog.clubs) {
    for (const p of readJsonFile<IdentityRow[]>(club.playersFile)) identities.set(p.playerId, [...(identities.get(p.playerId) ?? []), club.clubId]);
    for (const r of readJsonFile<RosterRow[]>(club.rosterFile)) memberships.set(r.playerId, [...(memberships.get(r.playerId) ?? []), club.clubId]);
  }
  for (const [playerId, clubs] of identities) assert.equal(clubs.length, 1, `${playerId} has identity records in ${clubs.join(", ")}`);
  for (const [playerId, clubs] of memberships) assert.equal(clubs.length, 1, `${playerId} is on the rosters of ${clubs.join(", ")}`);
});

test("no cross-league name+DOB identity collision beyond documented owner decisions", () => {
  const byKey = new Map<string, string[]>();
  for (const club of catalog.clubs) {
    for (const p of readJsonFile<IdentityRow[]>(club.playersFile)) {
      if (!p.dateOfBirth) continue;
      const key = `${p.fullName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()}|${p.dateOfBirth}`;
      byKey.set(key, [...(byKey.get(key) ?? []), p.playerId]);
    }
  }
  for (const [key, ids] of byKey) {
    if (ids.length > 1) assert.ok(KNOWN_NAME_DOB_COLLISIONS.has(key), `possible duplicate identity ${key}: ${ids.join(", ")}`);
  }
});

test("Herrallsvenskan: locked rating position and GOALKEEPER/OUTCOURT branch agree with the roster", () => {
  let checked = 0;
  for (const club of catalog.clubs.filter((c) => c.competitionId === ALLSVENSKAN_COMPETITION_ID)) {
    const locks = loadRatingDatabase(club.clubId);
    for (const row of readJsonFile<RosterRow[]>(club.rosterFile)) {
      const lock = locks[row.playerId];
      if (!lock) continue; // unlocked players are rated by the game prior from the roster position itself
      checked++;
      assert.equal(lock.clubId, club.clubId, `${row.playerId}: locked under ${lock.clubId}, rostered at ${club.clubId}`);
      assert.equal(lock.branch.branch === "GOALKEEPER", row.primaryPosition === "MV", `${row.playerId}: ${lock.branch.branch} rating for roster position ${row.primaryPosition}`);
      if (HELD_POSITION_DRIFT.has(row.playerId)) continue;
      assert.equal(lock.position === "GK" ? "MV" : lock.position, row.primaryPosition, `${row.playerId}: roster ${row.primaryPosition} vs locked ${lock.position}`);
    }
  }
  assert.ok(checked > 200, `expected the Herrallsvenskan locks to be checked, got ${checked}`);
});

test("Division 1: no goalkeeper carries an outfield rating branch (or vice versa) beyond the documented unresolved cases", () => {
  let checked = 0;
  const unresolvedSeen = new Set<string>();
  for (const club of catalog.clubs.filter((c) => DIVISION_1_COMPETITION_IDS.includes(c.competitionId))) {
    const locks = loadRatingDatabase(club.clubId);
    for (const row of readJsonFile<RosterRow[]>(club.rosterFile)) {
      const lock = locks[row.playerId];
      if (!lock) continue;
      checked++;
      if ((lock.branch.branch === "GOALKEEPER") === (row.primaryPosition === "MV")) continue;
      assert.ok(DIVISION_1_UNRESOLVED_BRANCH.has(row.playerId), `${row.playerId}: ${lock.branch.branch} rating for roster position ${row.primaryPosition}`);
      unresolvedSeen.add(row.playerId);
    }
  }
  assert.ok(checked > 400, `expected the Division 1 locks to be checked, got ${checked}`);
  // Once a documented case is resolved it must leave the list, so the list cannot hide a new conflict.
  for (const id of DIVISION_1_UNRESOLVED_BRANCH) assert.ok(unresolvedSeen.has(id), `${id} is no longer a branch conflict -- remove it from DIVISION_1_UNRESOLVED_BRANCH`);
});
