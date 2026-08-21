import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildCatalog } from "./catalog";
import { getClubEntry, listClubPlayers, loadPlayerRecord, savePlayerEdit } from "./playerRepository";

const FIXTURE_ROOT = path.join(__dirname, "__fixtures__", "real-world");
const CLUB_ID = "test_club_fixture";
const ALPHA_ID = "test_player_alpha_00000001";
const BETA_ID = "test_player_beta_00000002";

function catalog() {
  return buildCatalog(FIXTURE_ROOT);
}

/** Snapshots the two fixture files, runs `fn`, then restores their EXACT original bytes and deletes any .bak created -- never leaves the test fixture mutated (Spec S35: clean test artifacts afterward). */
function withRestoredFixture(fn: () => void) {
  const club = getClubEntry(catalog(), CLUB_ID)!;
  const playersBefore = fs.readFileSync(club.playersFile, "utf8");
  const rosterBefore = fs.readFileSync(club.rosterFile, "utf8");
  try {
    fn();
  } finally {
    fs.writeFileSync(club.playersFile, playersBefore, "utf8");
    fs.writeFileSync(club.rosterFile, rosterBefore, "utf8");
    for (const f of [`${club.playersFile}.bak`, `${club.rosterFile}.bak`]) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
}

test("listClubPlayers returns both fixture players merged with roster data", () => {
  const rows = listClubPlayers(catalog(), CLUB_ID)!;
  assert.equal(rows.length, 2);
  const alpha = rows.find((r) => r.playerId === ALPHA_ID)!;
  assert.equal(alpha.fullName, "Alpha Testsson");
  assert.equal(alpha.primaryPosition, "H9");
  assert.equal(alpha.shirtNumber, 7);
});

test("listClubPlayers returns null for an unknown clubId", () => {
  assert.equal(listClubPlayers(catalog(), "unknown"), null);
});

test("loadPlayerRecord merges player + roster + resolved sources for one player", () => {
  const record = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
  assert.equal(record.playerId, ALPHA_ID);
  assert.equal(record.player.firstName, "Alpha");
  assert.equal(record.roster.primaryPosition, "H9");
  assert.equal(record.readOnly.rosterEntryId, "test_roster_alpha");
  assert.equal(record.readOnly.sources.length, 1);
  assert.equal(record.readOnly.sources[0].sourceId, "src_fixture_alpha");
});

test("loadPlayerRecord returns null for a player not on this club's roster", () => {
  assert.equal(loadPlayerRecord(catalog(), CLUB_ID, "not_a_real_player"), null);
});

test("HM-DATA-EDITOR-0.1 full save workflow: load -> edit -> diff -> save -> unrelated player unchanged -> reload returns edited value", () => {
  withRestoredFixture(() => {
    const before = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    const betaBefore = loadPlayerRecord(catalog(), CLUB_ID, BETA_ID)!;

    const editedPlayer = { ...before.player, lastName: "Andersén", heightCm: 192 };
    const editedRoster = { ...before.roster, shirtNumber: 11 };

    const result = savePlayerEdit(catalog(), CLUB_ID, ALPHA_ID, editedPlayer, editedRoster);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.diff.map((d) => d.field).sort(),
        ["heightCm", "lastName", "shirtNumber"].sort(),
      );
    }

    const club = getClubEntry(catalog(), CLUB_ID)!;
    assert.ok(fs.existsSync(`${club.playersFile}.bak`), "a backup must be created on save");
    const parsed = JSON.parse(fs.readFileSync(club.playersFile, "utf8"));
    assert.ok(Array.isArray(parsed), "output must parse as valid JSON");

    const reloaded = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    assert.equal(reloaded.player.lastName, "Andersén");
    assert.equal(reloaded.player.heightCm, 192);
    assert.equal(reloaded.roster.shirtNumber, 11);
    assert.equal(reloaded.player.firstName, "Alpha", "untouched fields on the same player must be preserved");

    const betaAfter = loadPlayerRecord(catalog(), CLUB_ID, BETA_ID)!;
    assert.deepEqual(betaAfter.player, betaBefore.player, "the other player's record must be completely untouched");
    assert.deepEqual(betaAfter.roster, betaBefore.roster);
  });
});

test("editing only a player-entity field never rewrites or backs up the roster file (Spec S23)", () => {
  withRestoredFixture(() => {
    const club = getClubEntry(catalog(), CLUB_ID)!;
    const rosterBefore = fs.readFileSync(club.rosterFile, "utf8");

    const record = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    const result = savePlayerEdit(catalog(), CLUB_ID, ALPHA_ID, { ...record.player, heightCm: 201 }, record.roster);
    assert.equal(result.ok, true);

    assert.equal(fs.readFileSync(club.rosterFile, "utf8"), rosterBefore, "roster file bytes must be untouched");
    assert.equal(fs.existsSync(`${club.rosterFile}.bak`), false, "no backup should be created for an untouched file");
    assert.equal(fs.existsSync(`${club.playersFile}.bak`), true);
  });
});

test("saving with no actual field changes reports an empty diff and does not write a backup", () => {
  withRestoredFixture(() => {
    const record = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    const result = savePlayerEdit(catalog(), CLUB_ID, ALPHA_ID, record.player, record.roster);
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.diff, []);
    const club = getClubEntry(catalog(), CLUB_ID)!;
    assert.equal(fs.existsSync(`${club.playersFile}.bak`), false);
  });
});

test("an invalid edit is rejected and the source files remain byte-identical (Spec S36)", () => {
  withRestoredFixture(() => {
    const club = getClubEntry(catalog(), CLUB_ID)!;
    const playersBefore = fs.readFileSync(club.playersFile, "utf8");
    const rosterBefore = fs.readFileSync(club.rosterFile, "utf8");

    const record = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    const invalidRoster = { ...record.roster, primaryPosition: "STRIKER" };
    const result = savePlayerEdit(catalog(), CLUB_ID, ALPHA_ID, record.player, invalidRoster);

    assert.equal(result.ok, false);
    assert.equal(fs.readFileSync(club.playersFile, "utf8"), playersBefore);
    assert.equal(fs.readFileSync(club.rosterFile, "utf8"), rosterBefore);
    assert.equal(fs.existsSync(`${club.playersFile}.bak`), false);
  });
});

test("saving for a playerId that does not exist on this club is rejected", () => {
  withRestoredFixture(() => {
    const record = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    const result = savePlayerEdit(catalog(), CLUB_ID, "not_a_real_player", record.player, record.roster);
    assert.equal(result.ok, false);
  });
});

test("a duplicate playerId already present in source data is a hard error, not silently resolved", () => {
  withRestoredFixture(() => {
    const club = getClubEntry(catalog(), CLUB_ID)!;
    const players = JSON.parse(fs.readFileSync(club.playersFile, "utf8"));
    // Corrupt the fixture in-memory-on-disk to simulate a pre-existing duplicate id, matching Spec S24's scenario.
    players.push({ ...players[0] });
    fs.writeFileSync(club.playersFile, JSON.stringify(players, null, 2), "utf8");

    const record = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    const result = savePlayerEdit(catalog(), CLUB_ID, ALPHA_ID, record.player, record.roster);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.errors.some((e) => e.toLowerCase().includes("duplicate")));
    }
  });
});

test("nullable optional fields save cleanly as null, not a fake default", () => {
  withRestoredFixture(() => {
    const record = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    const editedPlayer = { ...record.player, dateOfBirth: null, heightCm: null };
    const editedRoster = { ...record.roster, shirtNumber: null };
    const result = savePlayerEdit(catalog(), CLUB_ID, ALPHA_ID, editedPlayer, editedRoster);
    assert.equal(result.ok, true);

    const reloaded = loadPlayerRecord(catalog(), CLUB_ID, ALPHA_ID)!;
    assert.equal(reloaded.player.dateOfBirth, null);
    assert.equal(reloaded.player.heightCm, null);
    assert.equal(reloaded.roster.shirtNumber, null);
  });
});
