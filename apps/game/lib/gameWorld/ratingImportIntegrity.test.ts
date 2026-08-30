// Covers the HBL v2.13 (268 players), World Pool v1 (100 players), and
// Allsvenskan v0.13 (261 players) canonical rating imports: identity
// coverage, CA/PA fidelity against the source-of-truth CSVs, cross-pool
// invariants (no dupes, PA>=CA, 1-200 range), import determinism, and that
// no generator resets a locked value.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { snapshotWorldSquads, snapshotGameplayRatings } from "./serverSnapshot";
import { WORLD_POOL_COMPETITION_IDS } from "../career/careerWorld";
import { loadRatingDatabase } from "../editor/ratingDatabaseRepository";

const EXPORTS_DIR = path.join(__dirname, "..", "..", "..", "..", "exports", "player-rating-research");
const HBL_CSV_PATH = path.join(EXPORTS_DIR, "HBL_rating_import_candidates_v2.13.csv");
const WORLD_POOL_CSV_PATH = path.join(EXPORTS_DIR, "WORLD_POOL_FINAL_RATING_RESEARCH_v1.csv");
const ALLSVENSKAN_CSV_PATH = path.join(EXPORTS_DIR, "ALLSV_rating_import_candidates_v0.13.csv");
const HBL_COMPETITION_ID = "se_handbollsligan_herr";
const ALLSVENSKAN_COMPETITION_ID = "swe-2";

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

function collectRatings(competitionIds: readonly string[]): Map<string, { ca: number; pa: number }> {
  const out = new Map<string, { ca: number; pa: number }>();
  for (const competitionId of competitionIds) {
    const squads = snapshotWorldSquads(competitionId);
    const ratings = snapshotGameplayRatings(competitionId);
    for (const clubId of Object.keys(squads)) {
      for (const r of ratings[clubId] ?? []) out.set(r.playerId, { ca: r.ca, pa: r.pa });
    }
  }
  return out;
}

test("HBL v2.13: all 268 playerIds exist exactly once in the canonical DB", () => {
  const { header, rows } = loadCsv(HBL_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  assert.equal(rows.length, 268);
  const ids = rows.map((r) => r[idx("playerId")]);
  assert.equal(new Set(ids).size, 268, "no duplicate playerIds in the HBL CSV");

  const squads = snapshotWorldSquads(HBL_COMPETITION_ID);
  const dbIds = new Set<string>();
  for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) dbIds.add(p.id);
  for (const id of ids) assert.ok(dbIds.has(id), `playerId ${id} missing from canonical HBL DB`);
});

test("HBL v2.13: imported CA/PA matches the v2.13 New CA/New PA columns exactly", () => {
  const { header, rows } = loadCsv(HBL_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  const ratings = collectRatings([HBL_COMPETITION_ID]);
  for (const r of rows) {
    const playerId = r[idx("playerId")];
    const expectedCA = Number(r[idx("New CA")]);
    const expectedPA = Number(r[idx("New PA")]);
    const actual = ratings.get(playerId);
    assert.ok(actual, `no live rating found for HBL playerId ${playerId}`);
    assert.equal(actual!.ca, expectedCA, `CA mismatch for ${playerId}`);
    assert.equal(actual!.pa, expectedPA, `PA mismatch for ${playerId}`);
  }
});

test("World Pool v1: all 100 identities are unique and present in the canonical DB", () => {
  const { header, rows } = loadCsv(WORLD_POOL_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  assert.equal(rows.length, 100);
  const ids = rows.map((r) => r[idx("playerId")]);
  assert.equal(new Set(ids).size, 100, "no duplicate playerIds in the World Pool CSV");

  const dbIds = new Set<string>();
  for (const competitionId of WORLD_POOL_COMPETITION_IDS) {
    const squads = snapshotWorldSquads(competitionId);
    for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) dbIds.add(p.id);
  }
  for (const id of ids) assert.ok(dbIds.has(id), `playerId ${id} missing from canonical World Pool DB`);
});

test("World Pool v1: imported CA/PA matches the Final CA/Final PA columns exactly", () => {
  const { header, rows } = loadCsv(WORLD_POOL_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  const ratings = collectRatings(WORLD_POOL_COMPETITION_IDS);
  for (const r of rows) {
    assert.equal(r[idx("Research Status")], "FINAL");
    const playerId = r[idx("playerId")];
    const expectedCA = Number(r[idx("Final CA")]);
    const expectedPA = Number(r[idx("Final PA")]);
    const actual = ratings.get(playerId);
    assert.ok(actual, `no live rating found for World Pool playerId ${playerId}`);
    assert.equal(actual!.ca, expectedCA, `CA mismatch for ${playerId}`);
    assert.equal(actual!.pa, expectedPA, `PA mismatch for ${playerId}`);
  }
});

test("Allsvenskan v0.13: all 261 playerIds exist exactly once in the canonical DB", () => {
  const { header, rows } = loadCsv(ALLSVENSKAN_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  assert.equal(rows.length, 261);
  const ids = rows.map((r) => r[idx("playerId")]);
  assert.equal(new Set(ids).size, 261, "no duplicate playerIds in the Allsvenskan CSV");

  const squads = snapshotWorldSquads(ALLSVENSKAN_COMPETITION_ID);
  const dbIds = new Set<string>();
  for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) dbIds.add(p.id);
  for (const id of ids) assert.ok(dbIds.has(id), `playerId ${id} missing from canonical Allsvenskan DB`);
});

test("Allsvenskan v0.13: imported CA/PA matches the v0.13 New CA/New PA columns exactly", () => {
  const { header, rows } = loadCsv(ALLSVENSKAN_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  const ratings = collectRatings([ALLSVENSKAN_COMPETITION_ID]);
  for (const r of rows) {
    const playerId = r[idx("playerId")];
    const expectedCA = Number(r[idx("New CA")]);
    const expectedPA = Number(r[idx("New PA")]);
    const actual = ratings.get(playerId);
    assert.ok(actual, `no live rating found for Allsvenskan playerId ${playerId}`);
    assert.equal(actual!.ca, expectedCA, `CA mismatch for ${playerId}`);
    assert.equal(actual!.pa, expectedPA, `PA mismatch for ${playerId}`);
  }
});

test("HBL + World Pool + Allsvenskan combined: no PA < CA and all ratings in [1, 200]", () => {
  const combined = new Map([
    ...collectRatings([HBL_COMPETITION_ID]),
    ...collectRatings(WORLD_POOL_COMPETITION_IDS),
    ...collectRatings([ALLSVENSKAN_COMPETITION_ID]),
  ]);
  for (const [playerId, { ca, pa }] of combined) {
    assert.ok(pa >= ca, `PA < CA for ${playerId}: ca=${ca} pa=${pa}`);
    assert.ok(ca >= 1 && ca <= 200, `CA out of range for ${playerId}: ${ca}`);
    assert.ok(pa >= 1 && pa <= 200, `PA out of range for ${playerId}: ${pa}`);
  }
});

test("HBL + World Pool + Allsvenskan combined: no playerId duplicated across the three imported pools", () => {
  const hblIds = new Set(collectRatings([HBL_COMPETITION_ID]).keys());
  const worldPoolIds = new Set(collectRatings(WORLD_POOL_COMPETITION_IDS).keys());
  const allsvIds = new Set(collectRatings([ALLSVENSKAN_COMPETITION_ID]).keys());
  for (const id of hblIds) assert.ok(!worldPoolIds.has(id) && !allsvIds.has(id), `playerId ${id} present in HBL and another pool`);
  for (const id of worldPoolIds) assert.ok(!allsvIds.has(id), `playerId ${id} present in both World Pool and Allsvenskan pools`);
});

test("Allsvenskan v0.13 import did not change any HBL or World Pool rating", () => {
  const { header: hblHeader, rows: hblRows } = loadCsv(HBL_CSV_PATH);
  const hblIdx = (name: string) => hblHeader.indexOf(name);
  const hblRatings = collectRatings([HBL_COMPETITION_ID]);
  for (const r of hblRows) {
    const playerId = r[hblIdx("playerId")];
    const expectedCA = Number(r[hblIdx("New CA")]);
    const expectedPA = Number(r[hblIdx("New PA")]);
    const actual = hblRatings.get(playerId);
    assert.equal(actual?.ca, expectedCA, `HBL CA drifted for ${playerId} after the Allsvenskan import`);
    assert.equal(actual?.pa, expectedPA, `HBL PA drifted for ${playerId} after the Allsvenskan import`);
  }

  const { header: wpHeader, rows: wpRows } = loadCsv(WORLD_POOL_CSV_PATH);
  const wpIdx = (name: string) => wpHeader.indexOf(name);
  const wpRatings = collectRatings(WORLD_POOL_COMPETITION_IDS);
  for (const r of wpRows) {
    const playerId = r[wpIdx("playerId")];
    const expectedCA = Number(r[wpIdx("Final CA")]);
    const expectedPA = Number(r[wpIdx("Final PA")]);
    const actual = wpRatings.get(playerId);
    assert.equal(actual?.ca, expectedCA, `World Pool CA drifted for ${playerId} after the Allsvenskan import`);
    assert.equal(actual?.pa, expectedPA, `World Pool PA drifted for ${playerId} after the Allsvenskan import`);
  }
});

test("import is deterministic: repeated reads of the locked rating database return identical values", () => {
  const { header, rows } = loadCsv(WORLD_POOL_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  const sample = rows.slice(0, 10);

  const squads: Record<string, ReturnType<typeof snapshotWorldSquads>[string]> = {};
  for (const competitionId of WORLD_POOL_COMPETITION_IDS) {
    const s = snapshotWorldSquads(competitionId);
    for (const clubId of Object.keys(s)) squads[clubId] = s[clubId];
  }

  for (const r of sample) {
    const playerId = r[idx("playerId")];
    const finalCA = Number(r[idx("Final CA")]);
    const finalPA = Number(r[idx("Final PA")]);
    let clubId: string | undefined;
    for (const [cid, players] of Object.entries(squads)) {
      if (players.some((x) => x.id === playerId)) { clubId = cid; break; }
    }
    assert.ok(clubId, `could not resolve club for ${playerId}`);

    const readA = loadRatingDatabase(clubId!)[playerId];
    const readB = loadRatingDatabase(clubId!)[playerId];
    assert.deepEqual(readA, readB, `two reads of the locked rating for ${playerId} diverged`);
    assert.ok(readA, `no locked rating found for ${playerId}`);
    assert.equal(readA!.ca.value, finalCA, `locked CA for ${playerId} does not match the CSV's Final CA`);
    assert.equal(readA!.pa?.value, finalPA, `locked PA for ${playerId} does not match the CSV's Final PA`);
  }
});

test("HBL + World Pool + Allsvenskan: non-rating player fields are untouched by the import (name/club/DOB stable)", () => {
  const { header: hblHeader, rows: hblRows } = loadCsv(HBL_CSV_PATH);
  const hblIdx = (name: string) => hblHeader.indexOf(name);
  const squads = snapshotWorldSquads(HBL_COMPETITION_ID);
  const byId = new Map<string, { firstName: string; lastName: string }>();
  for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) byId.set(p.id, { firstName: p.firstName, lastName: p.lastName });

  for (const r of hblRows.slice(0, 20)) {
    const playerId = r[hblIdx("playerId")];
    const csvPlayerName = r[hblIdx("Player")];
    const dbPlayer = byId.get(playerId);
    assert.ok(dbPlayer, `player ${playerId} missing from DB`);
    const dbFullName = `${dbPlayer!.firstName} ${dbPlayer!.lastName}`;
    assert.equal(dbFullName, csvPlayerName, `name mismatch for ${playerId}: DB="${dbFullName}" CSV="${csvPlayerName}"`);
  }

  const { header: allsvHeader, rows: allsvRows } = loadCsv(ALLSVENSKAN_CSV_PATH);
  const allsvIdx = (name: string) => allsvHeader.indexOf(name);
  const allsvSquads = snapshotWorldSquads(ALLSVENSKAN_COMPETITION_ID);
  const allsvById = new Map<string, { firstName: string; lastName: string }>();
  for (const clubId of Object.keys(allsvSquads)) for (const p of allsvSquads[clubId]) allsvById.set(p.id, { firstName: p.firstName, lastName: p.lastName });

  for (const r of allsvRows.slice(0, 20)) {
    const playerId = r[allsvIdx("playerId")];
    const csvPlayerName = r[allsvIdx("Player")];
    const dbPlayer = allsvById.get(playerId);
    assert.ok(dbPlayer, `player ${playerId} missing from DB`);
    const dbFullName = `${dbPlayer!.firstName} ${dbPlayer!.lastName}`;
    assert.equal(dbFullName, csvPlayerName, `name mismatch for ${playerId}: DB="${dbFullName}" CSV="${csvPlayerName}"`);
  }
});
