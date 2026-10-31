// Covers the HBL_PLAYER_BIO_FINAL_v1 bio-data milestone (DOB/nationality/
// position corrections written to the 268 active HBL players' identity and
// roster files): population invariants, DOB never fabricated (no invented
// Jan-1 dates, birthYear consistent with any exact DOB), valid position
// enum + no duplicate/self-referential secondary positions, nationality
// values persisted faithfully, CA/PA/roster untouched by this milestone,
// and the canonical age calculation continues to work correctly against
// both exact DOB and birthYear-only players.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { snapshotWorldSquads, snapshotGameplayRatings } from "./serverSnapshot";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { RELOCATED_TO_ALLSVENSKAN, SUPERSEDED_RATINGS } from "./realWorldRosterCorrections";

const HBL_ID = "se_handbollsligan_herr";
const ALLSVENSKAN_ID = "swe-2";
const VALID_POSITIONS = new Set(["MV", "V6", "H6", "V9", "M9", "H9", "M6"]);
const EXPORTS_DIR = path.join(__dirname, "..", "..", "..", "..", "exports", "player-rating-research");
const HBL_BIO_CSV_PATH = path.join(EXPORTS_DIR, "HBL_PLAYER_BIO_FINAL_v2.csv");
/** The current authoritative bio research input (supersedes the v2 snapshot for imported fields). */
const RESEARCH_V31_PATH = path.join(EXPORTS_DIR, "SWEDISH_PLAYER_BIO_MASTER_v3.1.csv");
const HBL_RATING_CSV_PATH = path.join(EXPORTS_DIR, "HBL_rating_import_candidates_v2.13.csv");

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function loadCsv(csvPath: string): { header: string[]; rows: string[][] } {
  const raw = fs.readFileSync(csvPath, "utf8").replace(/^﻿/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(",");
  return { header, rows: lines.slice(1).map(parseCsvLine) };
}

// 268 at the bio milestone; HM-DATA-1.3 moved 2 of them and HM-DATA-1.5 1 more (loan; same playerIds) to their 2026/27 Herrallsvenskan clubs.
test("HBL bio milestone: exactly 265 unique active HBL playerIds, no duplicates", () => {
  const squads = snapshotWorldSquads(HBL_ID);
  const allIds: string[] = [];
  for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) allIds.push(p.id);
  assert.equal(allIds.length, 265);
  assert.equal(new Set(allIds).size, 265, "no duplicate playerIds in the active HBL population");
});

test("HBL bio milestone: no fabricated DOB among this milestone's own corrections (no invented Jan-1 default), and birthYear is always consistent with any exact DOB league-wide", () => {
  // Global consistency check: wherever both an exact DOB and a birthYear
  // exist, they must agree (this would only ever diverge from a data bug).
  const squads = snapshotWorldSquads(HBL_ID);
  for (const clubId of Object.keys(squads)) {
    for (const p of squads[clubId]) {
      if (p.dateOfBirth && p.birthYear) {
        assert.equal(Number(p.dateOfBirth.slice(0, 4)), p.birthYear, `${p.firstName} ${p.lastName}: dateOfBirth year and birthYear disagree`);
      }
    }
  }

  // Targeted check: every DOB this milestone actually wrote (FinalDOB that
  // differs from CurrentDOB in the research CSV) must never be a fabricated
  // "YYYY-01-01" default -- a birth-year-only source must stay birthYear-only.
  const { header, rows } = loadCsv(HBL_BIO_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  let newDobsChecked = 0;
  for (const r of rows) {
    const previousDob = r[idx("PreviousDOB")];
    const finalDob = r[idx("FinalDOB")];
    if (finalDob && finalDob !== previousDob) {
      newDobsChecked++;
      assert.ok(!finalDob.endsWith("-01-01"), `${r[idx("Player")]}: newly-written DOB ${finalDob} ends in -01-01 -- verify this is a real birthday, not a fabricated placeholder`);
    }
  }
  assert.ok(newDobsChecked > 0, "expected at least one newly-written exact DOB to check this milestone");
});

test("HBL bio milestone: an age-derived birth year is never persisted as canonical data", () => {
  // Age -> birthYear is INFERENCE (age 19 on 2026-08-30 implies 2006 or 2007
  // depending on the birthday), so it may be recorded for review but must
  // never reach the canonical database. Any row carrying INFERRED_FROM_AGE
  // must therefore have written nothing.
  const { header, rows } = loadCsv(HBL_BIO_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  const squads = snapshotWorldSquads(HBL_ID);
  const byId = new Map<string, ReturnType<typeof snapshotWorldSquads>[string][number]>();
  for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) byId.set(p.id, p);

  for (const r of rows) {
    if (r[idx("DOBStatus")] !== "INFERRED_FROM_AGE") continue;
    const live = byId.get(r[idx("playerId")]);
    assert.ok(live, `unknown playerId ${r[idx("playerId")]}`);
    assert.equal(live!.dateOfBirth, null, `${r[idx("Player")]}: an age-inferred DOB must never be persisted`);
    assert.equal(live!.birthYear ?? null, null, `${r[idx("Player")]}: an age-inferred birthYear must never be persisted`);
  }
});

test("HBL bio milestone: every position (primary and secondary) is a valid canonical enum value, no duplicate or self-referential secondary positions", () => {
  const squads = snapshotWorldSquads(HBL_ID);
  for (const clubId of Object.keys(squads)) {
    for (const p of squads[clubId]) {
      assert.ok(VALID_POSITIONS.has(p.position), `${p.firstName} ${p.lastName}: invalid primary position ${p.position}`);
      const secondary = p.secondaryPositions ?? [];
      for (const s of secondary) assert.ok(VALID_POSITIONS.has(s), `${p.firstName} ${p.lastName}: invalid secondary position ${s}`);
      assert.equal(new Set(secondary).size, secondary.length, `${p.firstName} ${p.lastName}: duplicate secondary positions`);
      assert.ok(!secondary.includes(p.position), `${p.firstName} ${p.lastName}: primary position ${p.position} duplicated in secondaryPositions`);
    }
  }
});

test("HBL + Allsvenskan bio import: every imported DOB/nationality matches the v3.1 research source", () => {
  // The authoritative research input is now SWEDISH_PLAYER_BIO_MASTER_v3.1
  // (it supersedes the earlier per-milestone v2 snapshot). Only the fields
  // actually imported are asserted here -- primaryPosition/secondaryPositions
  // were deliberately QUARANTINED, because 61 of 77 proposed primary changes
  // came from single-match Profixio protocols and 16 of those were impossible
  // goalkeeper<->outfield swaps. See HBL_ALLSV_BIO_IMPORT_REPORT.csv.
  const { header, rows } = loadCsv(RESEARCH_V31_PATH);
  const idx = (name: string) => header.indexOf(name);

  const live = new Map<string, { dateOfBirth: string | null; birthYear: number | null; nationalities: string[] | null }>();
  for (const competitionId of [HBL_ID, ALLSVENSKAN_ID]) {
    const squads = snapshotWorldSquads(competitionId);
    for (const clubId of Object.keys(squads)) {
      for (const p of squads[clubId]) live.set(p.id, { dateOfBirth: p.dateOfBirth, birthYear: p.birthYear ?? null, nationalities: p.nationalities ?? null });
    }
  }

  let checkedDob = 0;
  let checkedNat = 0;
  for (const r of rows) {
    const competition = r[idx("Competition")];
    if (competition !== "Handbollsligan" && competition !== "Herrallsvenskan") continue; // Division 1 is out of scope and was never imported.
    const playerId = r[idx("playerId")];
    const p = live.get(playerId);
    if (!p) continue; // identity-merge rows without a canonical counterpart -- covered by the population test.

    const finalDob = (r[idx("FinalDOB")] ?? "").trim();
    // A "-01-01" value is the fabricated-placeholder pattern and is refused on import.
    if (finalDob && /^\d{4}-\d{2}-\d{2}$/.test(finalDob) && !finalDob.endsWith("-01-01")) {
      assert.equal(p.dateOfBirth, finalDob, `DOB mismatch for ${playerId} (${r[idx("Player")]})`);
      checkedDob++;
    }

    const finalNat = (r[idx("FinalNationality")] ?? "").trim();
    if (finalNat) {
      assert.equal((p.nationalities ?? []).join("/"), finalNat, `nationality mismatch for ${playerId} (${r[idx("Player")]})`);
      checkedNat++;
    }
  }
  assert.ok(checkedDob > 200, `expected the import to cover many DOBs, only checked ${checkedDob}`);
  assert.ok(checkedNat > 200, `expected the import to cover many nationalities, only checked ${checkedNat}`);
});

test("HBL bio milestone: CA/PA ratings are completely unaffected by the bio-data corrections", () => {
  const { header, rows } = loadCsv(HBL_RATING_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  const ratings = snapshotGameplayRatings(HBL_ID);
  const ratingById = new Map<string, { ca: number; pa: number }>();
  for (const clubId of Object.keys(ratings)) for (const r of ratings[clubId]) ratingById.set(r.playerId, { ca: r.ca, pa: r.pa });
  // Relocated players carry their locked rating to the new Herrallsvenskan club.
  const allsvenskanRatings = snapshotGameplayRatings(ALLSVENSKAN_ID);
  for (const { playerId, fromCompetitionId, toClubId } of RELOCATED_TO_ALLSVENSKAN) {
    const moved = fromCompetitionId === HBL_ID ? allsvenskanRatings[toClubId]?.find((r) => r.playerId === playerId) : undefined;
    if (moved) ratingById.set(playerId, { ca: moved.ca, pa: moved.pa });
  }

  for (const r of rows) {
    const playerId = r[idx("playerId")];
    // A documented superseded rating must hold its superseding value instead of the import's.
    const superseded = SUPERSEDED_RATINGS.get(playerId);
    const expectedCA = superseded?.ca ?? Number(r[idx("New CA")]);
    const expectedPA = superseded?.pa ?? Number(r[idx("New PA")]);
    const live = ratingById.get(playerId);
    assert.ok(live, `no live rating found for ${playerId}`);
    assert.equal(live!.ca, expectedCA, `CA drifted for ${playerId} after the bio-data milestone`);
    assert.equal(live!.pa, expectedPA, `PA drifted for ${playerId} after the bio-data milestone`);
  }
});

test("HBL bio milestone: playerAgeAtDate progresses correctly with the career gameDate for both exact-DOB and birthYear-only players", () => {
  assert.equal(playerAgeAtDate("2000-01-01", null, "2026-08-30"), 26);
  assert.equal(playerAgeAtDate("2000-01-01", null, "2027-08-30"), 27);
  assert.equal(playerAgeAtDate("2000-01-01", null, "2030-08-30"), 30);
  assert.equal(playerAgeAtDate(null, 2007, "2026-08-30"), 19);
  assert.equal(playerAgeAtDate(null, 2007, "2027-01-01"), 20);
  assert.equal(playerAgeAtDate(null, null, "2026-08-30"), null);
});
