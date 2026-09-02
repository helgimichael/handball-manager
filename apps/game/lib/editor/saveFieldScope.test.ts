// HM-EDITOR-SAVE-SCOPE-1.0: an edit is validated against the fields it
// actually changes -- never against unrelated values it merely echoes back.
//
// The reported failure: three Division 1 position corrections (Gustav
// Wickström, Hugo Aronsson, Johan Hammarberg) failed with HTTP 422
//   "rosterStatus must be one of: CONFIRMED, ANNOUNCED_IN, REGISTERED,
//    LOAN_IN, LOAN_OUT, DEPARTING, LEFT, UNCERTAIN"
// while the same edit on Ivar Mehra succeeded. The difference was not the
// edit -- it was the players' STORED rosterStatus. 199 Division 1 players
// carry "PROVISIONAL", a value the game reads fine (realWorldLoader types
// rosterStatus as a plain string; gameWorldAdapter only branches on
// CONFIRMED/REGISTERED) but which is absent from ROSTER_STATUS_VALUES.
// The bulk workspace echoes a player's whole stored record back on save, so
// that one unacceptable stored value made all 199 players permanently
// uneditable -- position-only edits included.
//
// The invariant pinned here: a valid position-only edit must persist for any
// player regardless of unrelated stored fields, AND a genuinely new invalid
// value must still be rejected.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildCatalog } from "./catalog";
import { savePlayerEdit, loadPlayerRecord } from "./playerRepository";
import { validateRosterEdit, validatePlayerEdit } from "./schema";

const PLAYER_ID = "test_player_prov_1";
const CLUB_ID = "test_club_prov";

/** A Division 1-shaped entry storing the out-of-enum rosterStatus that caused the failure. */
function rosterEntry() {
  return {
    rosterEntryId: "test_2026_27_prov__1",
    playerId: PLAYER_ID,
    clubId: CLUB_ID,
    competitionId: "se_division1_norra",
    season: "2026/27",
    snapshotDate: "2026-08-27",
    shirtNumber: 7,
    sourcePosition: "",
    primaryPosition: "V6",
    secondaryPositions: [] as string[],
    rosterStatus: "PROVISIONAL", // <-- outside ROSTER_STATUS_VALUES, valid to the game
    contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
    rosterConfidence: "PARTIAL",
    dataNotes: [] as string[],
  };
}

function playerEntry() {
  return {
    playerId: PLAYER_ID,
    firstName: "Prov",
    lastName: "Spelare",
    fullName: "Prov Spelare",
    aliases: [] as string[],
    dateOfBirth: "2002-07-12",
    birthYear: 2002,
    nationalities: null, // the 774-player case: stored as null, not an array
    heightCm: null,
    handedness: null,
    recordConfidence: "PARTIAL",
    dataNotes: [] as string[],
  };
}

interface Fixture { dataRoot: string; rosterFile: string }

function withFixture(fn: (f: Fixture) => void): void {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), "hm-save-scope-"));
  try {
    const clubDir = path.join(dataRoot, "testnation", "2026-27", "division1-norra", "Test Club Prov");
    fs.mkdirSync(clubDir, { recursive: true });
    const rosterFile = path.join(clubDir, "roster-test-2026-27.json");
    fs.writeFileSync(path.join(clubDir, "manifest.json"), JSON.stringify({ club: "Test Club Prov", clubId: CLUB_ID, files: ["players-test.json", "roster-test-2026-27.json", "qc-test.json"] }, null, 2));
    fs.writeFileSync(path.join(clubDir, "players-test.json"), JSON.stringify([playerEntry()], null, 2));
    fs.writeFileSync(rosterFile, JSON.stringify([rosterEntry()], null, 2));
    fs.writeFileSync(path.join(clubDir, "qc-test.json"), JSON.stringify({ clubId: CLUB_ID, clubName: "Test Club Prov", expectedRosterCount: 1 }, null, 2));
    fn({ dataRoot, rosterFile });
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
}

const readRoster = (f: Fixture) => JSON.parse(fs.readFileSync(f.rosterFile, "utf8"))[0] as Record<string, unknown>;

/** Saves through the real repository path, exactly as the bulk workspace does: the WHOLE record echoed back with one field changed. */
function save(f: Fixture, mutate: (roster: Record<string, unknown>, player: Record<string, unknown>) => void) {
  const catalog = buildCatalog(f.dataRoot);
  const record = loadPlayerRecord(catalog, CLUB_ID, PLAYER_ID);
  assert.ok(record, "fixture player must load");
  const player = { ...record!.player } as unknown as Record<string, unknown>;
  const roster = { ...record!.roster } as unknown as Record<string, unknown>;
  mutate(roster, player);
  return savePlayerEdit(catalog, CLUB_ID, PLAYER_ID, player, roster);
}

// ---------------------------------------------------------------------------
// THE BUG
// ---------------------------------------------------------------------------

test("a position-only edit persists even though the stored rosterStatus is outside the enum", () => {
  withFixture((f) => {
    const result = save(f, (roster) => { roster.primaryPosition = "M6"; });
    assert.equal(result.ok, true, `the edit must not be rejected by an unrelated stored field: ${JSON.stringify((result as { errors?: string[] }).errors)}`);
    assert.equal(readRoster(f).primaryPosition, "M6");
  });
});

test("the out-of-enum rosterStatus is preserved byte-for-byte by that save", () => {
  withFixture((f) => {
    save(f, (roster) => { roster.primaryPosition = "M6"; });
    assert.equal(readRoster(f).rosterStatus, "PROVISIONAL", "an echoed-back field must never be rewritten or normalised");
  });
});

test("a secondaryPositions edit also persists for such a player", () => {
  withFixture((f) => {
    const result = save(f, (roster) => { roster.secondaryPositions = ["H9"]; });
    assert.equal(result.ok, true);
    assert.deepEqual(readRoster(f).secondaryPositions, ["H9"]);
    assert.equal(readRoster(f).rosterStatus, "PROVISIONAL");
  });
});

test("a stored nationalities of null does not block a position edit", () => {
  withFixture((f) => {
    const result = save(f, (roster) => { roster.primaryPosition = "H6"; });
    assert.equal(result.ok, true);
    assert.equal(readRoster(f).primaryPosition, "H6");
  });
});

// ---------------------------------------------------------------------------
// The guards must still hold: a NEW invalid value is still rejected
// ---------------------------------------------------------------------------

test("changing rosterStatus to a NEW invalid value is still rejected", () => {
  withFixture((f) => {
    const result = save(f, (roster) => { roster.rosterStatus = "GARBAGE"; });
    assert.equal(result.ok, false, "tolerating an unchanged value must not tolerate a newly written one");
    assert.match((result as { errors: string[] }).errors.join("; "), /rosterStatus must be one of/);
    assert.equal(readRoster(f).rosterStatus, "PROVISIONAL", "the file must be untouched by a rejected save");
  });
});

test("changing primaryPosition to an invalid value is still rejected", () => {
  withFixture((f) => {
    const result = save(f, (roster) => { roster.primaryPosition = "NOT_A_POSITION"; });
    assert.equal(result.ok, false);
    assert.match((result as { errors: string[] }).errors.join("; "), /primaryPosition must be one of/);
    assert.equal(readRoster(f).primaryPosition, "V6");
  });
});

test("changing nationalities to an invalid value is still rejected", () => {
  withFixture((f) => {
    const result = save(f, (_roster, player) => { player.nationalities = ["SWEDEN"]; });
    assert.equal(result.ok, false);
    assert.match((result as { errors: string[] }).errors.join("; "), /nationalities/);
  });
});

// ---------------------------------------------------------------------------
// The validators themselves
// ---------------------------------------------------------------------------

test("validateRosterEdit WITHOUT a baseline still rejects an out-of-enum rosterStatus", () => {
  const result = validateRosterEdit(rosterEntry());
  assert.equal(result.ok, false, "the strict contract is unchanged when no baseline is supplied");
});

test("validateRosterEdit WITH the matching baseline accepts it and passes the value through", () => {
  const stored = rosterEntry();
  // The workspace always sends the reader-normalised optional fields, even
  // when the stored Division 1 entry omits the keys entirely.
  const submitted = { ...stored, defaultSquadStatus: null, specialTags: [], primaryPosition: "M6" };
  const result = validateRosterEdit(submitted, stored as unknown as Record<string, unknown>);
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.rosterStatus, "PROVISIONAL", "the stored value is preserved verbatim");
  assert.equal(result.ok && result.value.primaryPosition, "M6", "the genuinely edited field is the validated new value");
});

test("validatePlayerEdit WITH a baseline accepts an unchanged out-of-spec field but not a changed one", () => {
  const stored = { ...playerEntry(), recordConfidence: "LEGACY_UNKNOWN" };
  const asRecord = stored as unknown as Record<string, unknown>;
  assert.equal(validatePlayerEdit({ ...stored, birthYear: 2003 }, asRecord).ok, true, "an unrelated stored value must not block a birthYear edit");
  assert.equal(validatePlayerEdit({ ...stored, recordConfidence: "NONSENSE" }, asRecord).ok, false, "editing that field to a new invalid value is still rejected");
});
