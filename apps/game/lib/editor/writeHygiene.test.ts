// HM-EDITOR-WRITE-HYGIENE-1.0: a save must write the intended field and
// NOTHING else -- no materialized optional keys, no whole-file byte noise.
//
// Two real defects this pins, both reproduced through the live editor
// before being fixed:
//
//   1. validate*Edit returns a COMPLETE, defaulted record, and savePlayerEdit
//      used to spread it wholesale over the on-disk entry. A position-only
//      edit therefore added `"defaultSquadStatus": null` and
//      `"specialTags": []` to the entry -- exactly the schema noise a
//      previous cleanup milestone had to strip from 30 roster files.
//   2. atomicWriteJsonFile serialized without a trailing newline on the
//      assumption that no source file has one. 508 canonical files do and
//      319 do not, so a one-field edit rewrote the last byte of the
//      majority of files.
//
// Everything here runs against an isolated mkdtemp fixture -- never the
// canonical data/ tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCatalog } from "./catalog";
import { savePlayerEdit, loadPlayerRecord } from "./playerRepository";
import { atomicWriteJsonFile } from "./atomicWrite";

const PLAYER_ID = "test_player_div1_1";
const CLUB_ID = "test_club_div1";

/** A Division 1-shaped roster entry: NO defaultSquadStatus, NO specialTags keys at all. */
function rosterEntry() {
  return {
    rosterEntryId: "test_2026_27_div1__1",
    playerId: PLAYER_ID,
    clubId: CLUB_ID,
    competitionId: "se_division1_norra",
    season: "2026/27",
    snapshotDate: "2026-08-27",
    shirtNumber: 5,
    sourcePosition: "",
    primaryPosition: "V9",
    secondaryPositions: [] as string[],
    rosterStatus: "CONFIRMED",
    contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
    rosterConfidence: "PARTIAL",
    dataNotes: ["deterministically GENERATED as a structural placeholder"],
  };
}

function playerEntry() {
  return {
    playerId: PLAYER_ID,
    firstName: "Test",
    lastName: "Player",
    fullName: "Test Player",
    aliases: [] as string[],
    dateOfBirth: "2000-05-05",
    birthYear: 2000,
    nationalities: ["SE"],
    heightCm: null,
    handedness: null,
    recordConfidence: "PARTIAL",
    dataNotes: [] as string[],
  };
}

interface Fixture { dataRoot: string; clubDir: string; rosterFile: string; playersFile: string }

/** Builds an isolated catalog-discoverable club. `trailingNewline` controls the files' EOF style. */
function withFixture(trailingNewline: boolean, fn: (f: Fixture) => void): void {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hm-write-hygiene-"));
  try {
    const clubDir = path.join(dataRoot, "testnation", "2026-27", "division1-norra", "Test Club Div1");
    fs.mkdirSync(clubDir, { recursive: true });
    const eof = trailingNewline ? "\n" : "";
    const rosterFile = path.join(clubDir, "roster-test-2026-27.json");
    const playersFile = path.join(clubDir, "players-test.json");
    fs.writeFileSync(clubDir + "/manifest.json", JSON.stringify({ club: "Test Club Div1", clubId: CLUB_ID, files: ["players-test.json", "roster-test-2026-27.json", "qc-test.json"] }, null, 2) + eof);
    fs.writeFileSync(playersFile, JSON.stringify([playerEntry()], null, 2) + eof);
    fs.writeFileSync(rosterFile, JSON.stringify([rosterEntry()], null, 2) + eof);
    fs.writeFileSync(path.join(clubDir, "qc-test.json"), JSON.stringify({ clubId: CLUB_ID, clubName: "Test Club Div1", expectedRosterCount: 1 }, null, 2) + eof);
    fn({ dataRoot, clubDir, rosterFile, playersFile });
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

const readRoster = (f: Fixture) => JSON.parse(fs.readFileSync(f.rosterFile, "utf8"))[0] as Record<string, unknown>;
const rawRoster = (f: Fixture) => fs.readFileSync(f.rosterFile, "utf8");

/** Saves through the real repository path, editing only what `mutate` changes. */
function save(f: Fixture, mutate: (r: Record<string, unknown>, p: Record<string, unknown>) => void) {
  const catalog = buildCatalog(f.dataRoot);
  const record = loadPlayerRecord(catalog, CLUB_ID, PLAYER_ID);
  assert.ok(record, "fixture player must load");
  const player = { ...record!.player } as unknown as Record<string, unknown>;
  const roster = { ...record!.roster } as unknown as Record<string, unknown>;
  mutate(roster, player);
  return savePlayerEdit(catalog, CLUB_ID, PLAYER_ID, player, roster);
}

test("write hygiene: a primaryPosition-only edit changes ONLY primaryPosition", () => {
  withFixture(false, (f) => {
    const before = readRoster(f);
    const result = save(f, (roster) => { roster.primaryPosition = "M6"; });
    assert.equal(result.ok, true);

    const after = readRoster(f);
    assert.equal(after.primaryPosition, "M6");
    const changed = Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    assert.deepEqual(changed, ["primaryPosition"], `only primaryPosition may change, got ${changed.join(", ")}`);
  });
});

test("write hygiene: a secondaryPositions-only edit changes ONLY secondaryPositions", () => {
  withFixture(false, (f) => {
    const before = readRoster(f);
    const result = save(f, (roster) => { roster.secondaryPositions = ["H9"]; });
    assert.equal(result.ok, true);

    const after = readRoster(f);
    assert.deepEqual(after.secondaryPositions, ["H9"]);
    const changed = Object.keys({ ...before, ...after }).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    assert.deepEqual(changed, ["secondaryPositions"], `only secondaryPositions may change, got ${changed.join(", ")}`);
  });
});

test("write hygiene: an absent defaultSquadStatus stays ABSENT after a position edit", () => {
  withFixture(false, (f) => {
    assert.equal("defaultSquadStatus" in readRoster(f), false, "fixture must start without the key");
    save(f, (roster) => { roster.primaryPosition = "M6"; });
    assert.equal("defaultSquadStatus" in readRoster(f), false, "the key must not be materialized as null");
  });
});

test("write hygiene: an absent specialTags stays ABSENT after a position edit", () => {
  withFixture(false, (f) => {
    assert.equal("specialTags" in readRoster(f), false, "fixture must start without the key");
    save(f, (roster) => { roster.primaryPosition = "M6"; });
    assert.equal("specialTags" in readRoster(f), false, "the key must not be materialized as []");
  });
});

test("write hygiene: a DELIBERATE squad-status / tag edit still persists", () => {
  withFixture(false, (f) => {
    const result = save(f, (roster) => { roster.defaultSquadStatus = "KEY_PLAYER"; roster.specialTags = ["CAPTAIN"]; });
    assert.equal(result.ok, true);
    const after = readRoster(f);
    assert.equal(after.defaultSquadStatus, "KEY_PLAYER");
    assert.deepEqual(after.specialTags, ["CAPTAIN"]);
    assert.equal(after.primaryPosition, "V9", "an untouched field must not move");
  });
});

test("write hygiene: clearing a previously SET squad status back to null is a real edit and persists", () => {
  withFixture(false, (f) => {
    save(f, (roster) => { roster.defaultSquadStatus = "KEY_PLAYER"; });
    assert.equal(readRoster(f).defaultSquadStatus, "KEY_PLAYER");
    // Now clear it -- null is the reader default, but here it is a genuine change.
    save(f, (roster) => { roster.defaultSquadStatus = null; });
    const after = readRoster(f);
    assert.equal("defaultSquadStatus" in after, true, "an explicit clear must still be written");
    assert.equal(after.defaultSquadStatus, null);
  });
});

test("write hygiene: a file that ends with a newline keeps it", () => {
  withFixture(true, (f) => {
    assert.equal(rawRoster(f).endsWith("\n"), true, "fixture must start with a trailing newline");
    save(f, (roster) => { roster.primaryPosition = "M6"; });
    assert.equal(rawRoster(f).endsWith("\n"), true, "the trailing newline must be preserved");
    assert.equal(rawRoster(f).endsWith("\n\n"), false, "and must not be doubled");
  });
});

test("write hygiene: a file without a trailing newline stays without one", () => {
  withFixture(false, (f) => {
    assert.equal(rawRoster(f).endsWith("\n"), false, "fixture must start without a trailing newline");
    save(f, (roster) => { roster.primaryPosition = "M6"; });
    assert.equal(rawRoster(f).endsWith("\n"), false, "no trailing newline may be introduced");
  });
});

test("write hygiene: a roster-only edit does not rewrite the identity/bio file at all", () => {
  withFixture(true, (f) => {
    const beforeBytes = fs.readFileSync(f.playersFile, "utf8");
    save(f, (roster) => { roster.primaryPosition = "M6"; });
    assert.equal(fs.readFileSync(f.playersFile, "utf8"), beforeBytes, "players-*.json must be byte-identical");
    assert.equal(fs.existsSync(`${f.playersFile}.bak`), false, "no backup means the identity file was never written");
    assert.equal(fs.existsSync(`${f.rosterFile}.bak`), true, "the roster file was written, so it has a backup");
  });
});

test("write hygiene: atomicWriteJsonFile preserves EOF style for a brand-new file (no trailing newline)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hm-write-hygiene-new-"));
  try {
    const p = path.join(dir, "new.json");
    atomicWriteJsonFile(p, [{ a: 1 }]);
    assert.equal(fs.readFileSync(p, "utf8").endsWith("\n"), false);
    // Re-writing that same file must keep its (absent) style.
    atomicWriteJsonFile(p, [{ a: 2 }]);
    assert.equal(fs.readFileSync(p, "utf8").endsWith("\n"), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
