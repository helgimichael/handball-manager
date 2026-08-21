import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DATA_ROOT } from "../editor/paths";
import { listImportableClubIds, loadRealWorldClubSquad, validateClubSquad } from "./realWorldLoader";

// Reads the actual real-world dataset (read-only -- this module never
// writes) rather than a fixture, since the point of these tests is to
// prove the real Handbollsligan dataset itself imports cleanly.
const REAL_DATA_ROOT = DEFAULT_DATA_ROOT;

test("listImportableClubIds discovers all 14 real Handbollsligan clubs", () => {
  const ids = listImportableClubIds(REAL_DATA_ROOT);
  const handbollsliganIds = ids.filter((id) => id.startsWith("se_club_"));
  assert.equal(handbollsliganIds.length, 14);
});

test("loadRealWorldClubSquad joins players + roster for a real club and returns null for an unknown clubId", () => {
  const squad = loadRealWorldClubSquad("se_club_alingsas_hk", REAL_DATA_ROOT);
  assert.ok(squad);
  assert.equal(squad!.clubId, "se_club_alingsas_hk");
  assert.equal(squad!.competitionId, "se_handbollsligan_herr");
  assert.ok(squad!.players.length > 0);
  for (const p of squad!.players) {
    assert.ok(p.playerId.startsWith("se_player_"));
    assert.equal(p.clubId, "se_club_alingsas_hk");
  }

  assert.equal(loadRealWorldClubSquad("not_a_real_club", REAL_DATA_ROOT), null);
});

test("validateClubSquad passes for every real Handbollsligan club with no duplicate playerIds and only canonical positions", () => {
  for (const clubId of listImportableClubIds(REAL_DATA_ROOT).filter((id) => id.startsWith("se_club_"))) {
    const squad = loadRealWorldClubSquad(clubId, REAL_DATA_ROOT)!;
    const result = validateClubSquad(squad);
    assert.equal(result.ok, true, `${clubId}: ${result.errors.join("; ")}`);
    assert.equal(result.duplicatePlayerIdCount, 0);
    assert.ok(result.playerCount > 0);
  }
});

test("validateClubSquad reports a duplicate playerId and an invalid position without throwing", () => {
  const squad = loadRealWorldClubSquad("se_club_alingsas_hk", REAL_DATA_ROOT)!;
  const withDuplicate = { ...squad, players: [...squad.players, squad.players[0]] };
  const dupResult = validateClubSquad(withDuplicate);
  assert.equal(dupResult.ok, false);
  assert.equal(dupResult.duplicatePlayerIdCount, 1);

  const withBadPosition = { ...squad, players: [{ ...squad.players[0], primaryPosition: "STRIKER" }, ...squad.players.slice(1)] };
  const posResult = validateClubSquad(withBadPosition);
  assert.equal(posResult.ok, false);
  assert.ok(posResult.errors.some((e) => e.includes("STRIKER")));
});
