// Covers the HBL v2.13 (268 players), World Pool v1 (100 players),
// Allsvenskan v0.13 (261 players), and Division 1 v1 (564 DIV1_ONLY_CANONICAL
// players, 10 confirmed B-team duplicates removed as separate identities, 7
// UNRESOLVED_IDENTITY left untouched) canonical rating imports: identity
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
import { buildCatalog, findClubById } from "../editor/catalog";
import { MERGED_IDENTITIES, RELOCATED_TO_ALLSVENSKAN, REMOVED_MEMBERSHIPS, RENAMED, SUPERSEDED_RATINGS } from "./realWorldRosterCorrections";

const EXPORTS_DIR = path.join(__dirname, "..", "..", "..", "..", "exports", "player-rating-research");
const HBL_CSV_PATH = path.join(EXPORTS_DIR, "HBL_rating_import_candidates_v2.13.csv");
const WORLD_POOL_CSV_PATH = path.join(EXPORTS_DIR, "WORLD_POOL_FINAL_RATING_RESEARCH_v1.csv");
const ALLSVENSKAN_CSV_PATH = path.join(EXPORTS_DIR, "ALLSV_rating_import_candidates_v0.13.csv");
const DIV1N_CSV_PATH = path.join(EXPORTS_DIR, "DIV1N_rating_import_candidates_v0.6.csv");
const DIV1S_CSV_PATH = path.join(EXPORTS_DIR, "DIV1S_rating_import_candidates_v0.5.csv");
const DIV1_AUDIT_CSV_PATH = path.join(EXPORTS_DIR, "DIV1_PLAYER_IDENTITY_AUDIT.csv");
const HBL_COMPETITION_ID = "se_handbollsligan_herr";
const ALLSVENSKAN_COMPETITION_ID = "swe-2";
const D1N_COMPETITION_ID = "se_division1_norra";
const D1S_COMPETITION_ID = "se_division1_sodra";
const D1_COMPETITION_IDS = [D1N_COMPETITION_ID, D1S_COMPETITION_ID] as const;

// The 10 confirmed B-team duplicates: their Division 1 identity was removed
// (Option A) since the same real person already has a canonical HBL record.
const CONFIRMED_B_TEAM_DUPLICATES: { div1PlayerId: string; hblPlayerId: string }[] = [
  { div1PlayerId: "player_dominic_brigerstrand_e88d285c", hblPlayerId: "player_dominic_brigerstrand_4ac3c690" },
  { div1PlayerId: "player_elliot_lundstad_33ed7ef3", hblPlayerId: "player_elliot_lundstad_ff8f992c" },
  { div1PlayerId: "player_fabian_simonsson_d4a53e4f", hblPlayerId: "player_fabian_simonsson_dfdf3f8d" },
  { div1PlayerId: "player_felix_lilja_24216081", hblPlayerId: "player_felix_lilja_e91d1945" },
  { div1PlayerId: "player_hannes_malm_lindblom_20784e09", hblPlayerId: "player_hannes_malm_lindblom_14a6be17" },
  { div1PlayerId: "player_max_blomberg_romero_1afaa101", hblPlayerId: "player_max_blomberg_romero_992b2a4a" },
  { div1PlayerId: "player_milo_knaapinen_3a3d7aa7", hblPlayerId: "player_milo_knaapinen_59a3a0cd" },
  { div1PlayerId: "player_oliver_andersson_2285d6b0", hblPlayerId: "player_oliver_andersson_ef8ef0a2" },
  { div1PlayerId: "player_sebastian_kallemyr_3674d2fb", hblPlayerId: "player_sebastian_kallemyr_ef0da952" },
  { div1PlayerId: "player_theo_ivarsson_4a592c8a", hblPlayerId: "player_theo_ivarsson_77eb2224" },
];

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

/**
 * collectRatings, following the documented identity-level roster changes
 * (realWorldRosterCorrections.ts): a relocated player's rating is read at his
 * new Herrallsvenskan club, a removed membership's from its retained locked
 * record, and a merged duplicate's from its canonical identity. Only for
 * checks of an import's own values -- the cross-pool duplicate checks keep
 * using the live pools.
 */
/**
 * Players whose 2026/27 roster membership was removed by a documented correction: the identity is still in its
 * club's players file, has no roster row, and its dataNotes record the removal. An undocumented disappearance
 * is not matched here and still fails the import checks.
 */
function documentedRemovedMemberships(competitionIds: readonly string[]): Map<string, { clubId: string; lock: { ca: number; pa: number } | null }> {
  const out = new Map<string, { clubId: string; lock: { ca: number; pa: number } | null }>();
  for (const club of buildCatalog().clubs.filter((c) => competitionIds.includes(c.competitionId))) {
    const rostered = new Set((JSON.parse(fs.readFileSync(club.rosterFile, "utf8")) as { playerId: string }[]).map((r) => r.playerId));
    const locks = loadRatingDatabase(club.clubId);
    for (const p of JSON.parse(fs.readFileSync(club.playersFile, "utf8")) as { playerId: string; dataNotes?: string[] }[]) {
      if (rostered.has(p.playerId) || !(p.dataNotes ?? []).some((n) => /roster membership at .+ removed/.test(n))) continue;
      const lock = locks[p.playerId];
      out.set(p.playerId, { clubId: club.clubId, lock: lock ? { ca: lock.ca.value, pa: lock.pa?.value ?? lock.ca.value } : null });
    }
  }
  return out;
}

function collectImportedRatings(competitionIds: readonly string[]): Map<string, { ca: number; pa: number }> {
  const out = collectRatings(competitionIds);
  for (const [playerId, { lock }] of documentedRemovedMemberships(competitionIds)) if (lock && !out.has(playerId)) out.set(playerId, lock);
  const relocated = RELOCATED_TO_ALLSVENSKAN.filter((r) => competitionIds.includes(r.fromCompetitionId) && !out.has(r.playerId));
  const merged = competitionIds.includes(ALLSVENSKAN_COMPETITION_ID) ? MERGED_IDENTITIES : [];
  if (relocated.length > 0 || merged.length > 0) {
    const allsvenskan = collectRatings([ALLSVENSKAN_COMPETITION_ID]);
    for (const r of relocated) { const rating = allsvenskan.get(r.playerId); if (rating) out.set(r.playerId, rating); }
    for (const m of merged) { const rating = allsvenskan.get(m.canonicalPlayerId); if (rating) out.set(m.retiredPlayerId, rating); }
  }
  if (competitionIds.includes(ALLSVENSKAN_COMPETITION_ID)) {
    for (const r of REMOVED_MEMBERSHIPS) {
      const lock = loadRatingDatabase(r.clubId)[r.playerId];
      if (lock) out.set(r.playerId, { ca: lock.ca.value, pa: lock.pa?.value ?? lock.ca.value });
    }
  }
  return out;
}

/** An import's playerIds as they exist now: live squads, plus relocations (found at their new club), removed memberships (still locked) and merged duplicates (whose canonical identity is live). */
function importedIdentityIds(competitionId: string): Set<string> {
  const ids = new Set<string>();
  const squads = snapshotWorldSquads(competitionId);
  for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) ids.add(p.id);
  const relocated = RELOCATED_TO_ALLSVENSKAN.filter((r) => r.fromCompetitionId === competitionId);
  if (relocated.length > 0) {
    const allsvenskan = snapshotWorldSquads(ALLSVENSKAN_COMPETITION_ID);
    for (const r of relocated) if (allsvenskan[r.toClubId]?.some((p) => p.id === r.playerId)) ids.add(r.playerId);
  }
  if (competitionId === ALLSVENSKAN_COMPETITION_ID) {
    for (const r of REMOVED_MEMBERSHIPS) if (loadRatingDatabase(r.clubId)[r.playerId]) ids.add(r.playerId);
    for (const m of MERGED_IDENTITIES) if (squads[m.clubId]?.some((p) => p.id === m.canonicalPlayerId)) ids.add(m.retiredPlayerId);
  }
  return ids;
}

/**
 * A canonical rating import is the source of truth for a player only for
 * as long as nobody has deliberately re-calibrated that player since.
 * The Player Data Editor (Spelare -> Kalibrering) is an intentional,
 * canonical authoring surface: when a human overrides a CA/PA there, the
 * NEW value -- not the frozen import CSV -- is what the game should ship.
 *
 * So the fidelity tests below assert two DIFFERENT things rather than one:
 *
 *   1. IMPORT CORRECTNESS -- every player still carrying the import's own
 *      provenance note in rating-review.json must match the import CSV
 *      exactly. This is what proves the import was applied faithfully and
 *      has not drifted.
 *   2. OVERRIDE ACCOUNTABILITY -- a player who DIVERGES from the CSV is
 *      acceptable only if the divergence is recorded: their review note is
 *      no longer the import's, and rating-overrides.json holds the exact
 *      live value. Silent drift (a value that differs with no recorded
 *      override) still fails, which is the property that actually matters.
 *
 * Without this split the tests treat a frozen CSV as permanent truth, and a
 * deliberate editor decision is indistinguishable from data corruption.
 */
function playerClubIds(competitionIds: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const competitionId of competitionIds) {
    const squads = snapshotWorldSquads(competitionId);
    for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) out.set(p.id, clubId);
  }
  return out;
}

interface RatingProvenance {
  /** rating-review.json note -- the import stamps its own CSV name here; an editor calibration replaces it. */
  reviewNote: string;
  /** rating-overrides.json entry, when the player has an explicit override recorded. */
  override: { ca?: number; pa?: number } | undefined;
}

function readJsonIfPresent(filePath: string): Record<string, Record<string, unknown>> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return raw !== null && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, Record<string, unknown>>) : {};
  } catch {
    return {};
  }
}

function loadProvenance(competitionIds: readonly string[]): Map<string, RatingProvenance> {
  // buildCatalog() deliberately re-walks the whole data tree on every call
  // (see its own doc), and loadRatingReviewState/loadRatingOverrideState each
  // build it internally. Calling those per club would mean ~166 full-tree
  // walks across the three fidelity tests -- so the catalog is built ONCE
  // here and the two small provenance files are read directly.
  const catalog = buildCatalog();
  const out = new Map<string, RatingProvenance>();
  const perClub = new Map<string, { review: Record<string, Record<string, unknown>>; override: Record<string, Record<string, unknown>> }>();

  const clubIds = playerClubIds(competitionIds);
  for (const r of RELOCATED_TO_ALLSVENSKAN) if (competitionIds.includes(r.fromCompetitionId) && !clubIds.has(r.playerId)) clubIds.set(r.playerId, r.toClubId);
  // A merged duplicate's provenance now lives under its canonical id.
  const canonicalOf = new Map<string, string>();
  if (competitionIds.includes(ALLSVENSKAN_COMPETITION_ID)) {
    for (const r of REMOVED_MEMBERSHIPS) clubIds.set(r.playerId, r.clubId);
    for (const m of MERGED_IDENTITIES) { clubIds.set(m.retiredPlayerId, m.clubId); canonicalOf.set(m.retiredPlayerId, m.canonicalPlayerId); }
  }
  for (const [playerId, clubId] of clubIds) {
    if (!perClub.has(clubId)) {
      const club = findClubById(catalog, clubId);
      perClub.set(clubId, club
        ? {
            review: readJsonIfPresent(path.join(club.clubDir, "rating-review.json")),
            override: readJsonIfPresent(path.join(club.clubDir, "rating-overrides.json")),
          }
        : { review: {}, override: {} });
    }
    const files = perClub.get(clubId)!;
    const review = files.review[canonicalOf.get(playerId) ?? playerId];
    const override = files.override[canonicalOf.get(playerId) ?? playerId];
    out.set(playerId, {
      reviewNote: typeof review?.note === "string" ? review.note : "",
      override: override
        ? {
            ...(typeof override.ca === "number" ? { ca: override.ca } : {}),
            ...(typeof override.pa === "number" ? { pa: override.pa } : {}),
          }
        : undefined,
    });
  }
  return out;
}

/**
 * Shared body for the three "imported CA/PA matches the CSV" tests.
 * `importTag` is the marker the import wrote into its own review note (its
 * own CSV name), which is how a still-pristine import row is recognised.
 */
function assertImportFidelity(opts: {
  label: string;
  rows: string[][];
  idOf: (row: string[]) => string;
  caOf: (row: string[]) => number;
  paOf: (row: string[]) => number;
  competitionIds: readonly string[];
  importTag: string;
}): void {
  const ratings = collectImportedRatings(opts.competitionIds);
  const provenance = loadProvenance(opts.competitionIds);
  let pristine = 0;

  for (const row of opts.rows) {
    const playerId = opts.idOf(row);
    const expectedCA = opts.caOf(row);
    const expectedPA = opts.paOf(row);
    const actual = ratings.get(playerId);
    assert.ok(actual, `no live rating found for ${opts.label} playerId ${playerId}`);

    const p = provenance.get(playerId);
    if ((p?.reviewNote ?? "").includes(opts.importTag)) {
      // (1) Untouched since the import, so it must still match it exactly.
      assert.equal(actual!.ca, expectedCA, `CA drifted for ${playerId} (${opts.label}) -- it still carries the import's own provenance note, so this is drift, not a deliberate override`);
      assert.equal(actual!.pa, expectedPA, `PA drifted for ${playerId} (${opts.label}) -- it still carries the import's own provenance note, so this is drift, not a deliberate override`);
      pristine++;
      continue;
    }

    // (2) Re-calibrated after the import: the live value must be exactly
    //     what the recorded override says, and an override must exist.
    assert.ok(p?.override, `${playerId} (${opts.label}) no longer carries the import's provenance note but has no rating-overrides.json record -- an unrecorded rating change`);
    if (p!.override!.ca !== undefined) {
      assert.equal(actual!.ca, p!.override!.ca, `CA for ${playerId} (${opts.label}) does not match its recorded override`);
    }
    if (p!.override!.pa !== undefined) {
      assert.equal(actual!.pa, p!.override!.pa, `PA for ${playerId} (${opts.label}) does not match its recorded override`);
    }
  }

  // Guard against this test quietly becoming vacuous: if most rows stopped
  // carrying the import's provenance, the CSV is no longer a meaningful
  // baseline and the import should be re-exported, rather than the test
  // silently verifying almost nothing.
  const floor = Math.floor(opts.rows.length * 0.9);
  assert.ok(
    pristine >= floor,
    `${opts.label}: only ${pristine}/${opts.rows.length} rows still carry the import's provenance note (need >= ${floor}) -- re-export the import CSV instead of letting this test verify almost nothing`,
  );
}

test("HBL v2.13: all 268 playerIds exist exactly once in the canonical DB", () => {
  const { header, rows } = loadCsv(HBL_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  assert.equal(rows.length, 268);
  const ids = rows.map((r) => r[idx("playerId")]);
  assert.equal(new Set(ids).size, 268, "no duplicate playerIds in the HBL CSV");

  const dbIds = importedIdentityIds(HBL_COMPETITION_ID);
  for (const id of ids) assert.ok(dbIds.has(id), `playerId ${id} missing from canonical HBL DB`);
});

test("HBL v2.13: imported CA/PA matches the v2.13 CSV, except where a later editor override is recorded", () => {
  const { header, rows } = loadCsv(HBL_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  assertImportFidelity({
    label: "HBL v2.13",
    rows,
    idOf: (r) => r[idx("playerId")],
    caOf: (r) => Number(r[idx("New CA")]),
    paOf: (r) => Number(r[idx("New PA")]),
    competitionIds: [HBL_COMPETITION_ID],
    // The note the HBL import stamped -- named after its own research
    // source, not after the candidates CSV this test reads.
    importTag: "HM_Player_Rating_Research_v2.13",
  });
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

test("World Pool v1: imported CA/PA matches the Final CA/Final PA columns, except where a later editor override is recorded", () => {
  const { header, rows } = loadCsv(WORLD_POOL_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  for (const r of rows) assert.equal(r[idx("Research Status")], "FINAL");
  assertImportFidelity({
    label: "World Pool v1",
    rows,
    idOf: (r) => r[idx("playerId")],
    caOf: (r) => Number(r[idx("Final CA")]),
    paOf: (r) => Number(r[idx("Final PA")]),
    competitionIds: WORLD_POOL_COMPETITION_IDS,
    importTag: "WORLD_POOL_FINAL_RATING_RESEARCH_v1",
  });
});

test("Allsvenskan v0.13: all 261 playerIds exist exactly once in the canonical DB", () => {
  const { header, rows } = loadCsv(ALLSVENSKAN_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  assert.equal(rows.length, 261);
  const ids = rows.map((r) => r[idx("playerId")]);
  assert.equal(new Set(ids).size, 261, "no duplicate playerIds in the Allsvenskan CSV");

  const dbIds = importedIdentityIds(ALLSVENSKAN_COMPETITION_ID);
  for (const id of ids) assert.ok(dbIds.has(id), `playerId ${id} missing from canonical Allsvenskan DB`);
});

test("Allsvenskan v0.13: imported CA/PA matches the v0.13 CSV, except where a later editor override is recorded", () => {
  const { header, rows } = loadCsv(ALLSVENSKAN_CSV_PATH);
  const idx = (name: string) => header.indexOf(name);
  assertImportFidelity({
    label: "Allsvenskan v0.13",
    rows,
    idOf: (r) => r[idx("playerId")],
    caOf: (r) => Number(r[idx("New CA")]),
    paOf: (r) => Number(r[idx("New PA")]),
    competitionIds: [ALLSVENSKAN_COMPETITION_ID],
    importTag: "ALLSV_rating_import_candidates_v0.13",
  });
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
  const hblRatings = collectImportedRatings([HBL_COMPETITION_ID]);
  for (const r of hblRows) {
    const playerId = r[hblIdx("playerId")];
    // A documented superseded rating must hold its superseding value instead of the import's.
    const superseded = SUPERSEDED_RATINGS.get(playerId);
    const expectedCA = superseded?.ca ?? Number(r[hblIdx("New CA")]);
    const expectedPA = superseded?.pa ?? Number(r[hblIdx("New PA")]);
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
  // HM-DATA-1.3 removed some 2026/27 memberships but kept the identity record: read those from the club's players file.
  for (const { playerId, clubId } of REMOVED_MEMBERSHIPS) {
    const club = findClubById(buildCatalog(), clubId);
    const identity = club && (JSON.parse(fs.readFileSync(club.playersFile, "utf8")) as { playerId: string; firstName: string; lastName: string }[]).find((p) => p.playerId === playerId);
    if (identity) allsvById.set(playerId, { firstName: identity.firstName, lastName: identity.lastName });
  }
  for (const m of MERGED_IDENTITIES) { const canonical = allsvById.get(m.canonicalPlayerId); if (canonical) allsvById.set(m.retiredPlayerId, canonical); }

  for (const r of allsvRows.slice(0, 20)) {
    const playerId = r[allsvIdx("playerId")];
    const csvPlayerName = RENAMED.get(r[allsvIdx("playerId")]) ?? r[allsvIdx("Player")];
    const dbPlayer = allsvById.get(playerId);
    assert.ok(dbPlayer, `player ${playerId} missing from DB`);
    const dbFullName = `${dbPlayer!.firstName} ${dbPlayer!.lastName}`;
    assert.equal(dbFullName, csvPlayerName, `name mismatch for ${playerId}: DB="${dbFullName}" CSV="${csvPlayerName}"`);
  }
});

test("Division 1 v1: the identity audit classifies all 581 source rows and the DIV1_ONLY_CANONICAL set matches the imported CA/PA exactly", () => {
  const { header: nHeader, rows: nRows } = loadCsv(DIV1N_CSV_PATH);
  const { header: sHeader, rows: sRows } = loadCsv(DIV1S_CSV_PATH);
  assert.equal(nRows.length, 308);
  assert.equal(sRows.length, 273);
  const nIdx = (name: string) => nHeader.indexOf(name);
  const sIdx = (name: string) => sHeader.indexOf(name);

  const { header: auditHeader, rows: auditRows } = loadCsv(DIV1_AUDIT_CSV_PATH);
  const auditIdx = (name: string) => auditHeader.indexOf(name);
  assert.equal(auditRows.length, 581, "the identity audit must classify every Division 1 source row");
  const statusById = new Map(auditRows.map((r) => [r[auditIdx("sourcePlayerId")], r[auditIdx("Status")]]));

  const statusCounts = new Map<string, number>();
  for (const status of statusById.values()) statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  assert.equal(statusCounts.get("DIV1_ONLY_CANONICAL"), 564);
  assert.equal(statusCounts.get("ALREADY_CANONICAL_HIGHER_LEVEL"), 10);
  assert.equal(statusCounts.get("DIV1_DUPLICATE_CONFIRMED") ?? 0, 0);
  assert.equal(statusCounts.get("UNRESOLVED_IDENTITY"), 7);

  const ratings = collectImportedRatings(D1_COMPETITION_IDS);
  let checkedOnlyCanonical = 0;
  for (const [rows, idx] of [[nRows, nIdx] as const, [sRows, sIdx] as const]) {
    for (const r of rows) {
      const playerId = r[idx("playerId")];
      const status = statusById.get(playerId);
      assert.ok(status, `playerId ${playerId} missing from the identity audit`);
      if (status !== "DIV1_ONLY_CANONICAL") continue;
      const expectedCA = Number(r[idx("New CA")]);
      const expectedPA = Number(r[idx("New PA")]);
      const actual = ratings.get(playerId);
      assert.ok(actual, `no live rating found for DIV1_ONLY_CANONICAL playerId ${playerId}`);
      assert.equal(actual!.ca, expectedCA, `CA mismatch for ${playerId}`);
      assert.equal(actual!.pa, expectedPA, `PA mismatch for ${playerId}`);
      checkedOnlyCanonical++;
    }
  }
  assert.equal(checkedOnlyCanonical, 564);
});

test("Division 1 v1: the 10 confirmed B-team duplicates no longer exist as separate Division 1 identities, and the surviving HBL playerId is unaffected", () => {
  const dbIds = new Set<string>();
  for (const competitionId of D1_COMPETITION_IDS) {
    const squads = snapshotWorldSquads(competitionId);
    for (const clubId of Object.keys(squads)) for (const p of squads[clubId]) dbIds.add(p.id);
  }
  const hblIds = new Set<string>();
  const hblSquads = snapshotWorldSquads(HBL_COMPETITION_ID);
  for (const clubId of Object.keys(hblSquads)) for (const p of hblSquads[clubId]) hblIds.add(p.id);

  const { header: hblHeader, rows: hblRows } = loadCsv(HBL_CSV_PATH);
  const hblIdx = (name: string) => hblHeader.indexOf(name);
  const hblCsvById = new Map(hblRows.map((r) => [r[hblIdx("playerId")], { ca: Number(r[hblIdx("New CA")]), pa: Number(r[hblIdx("New PA")]) }]));
  const hblRatings = collectRatings([HBL_COMPETITION_ID]);

  for (const { div1PlayerId, hblPlayerId } of CONFIRMED_B_TEAM_DUPLICATES) {
    assert.ok(!dbIds.has(div1PlayerId), `${div1PlayerId} must no longer exist as a separate Division 1 identity`);
    for (const competitionId of D1_COMPETITION_IDS) {
      const squads = snapshotWorldSquads(competitionId);
      for (const clubId of Object.keys(squads)) {
        assert.ok(!loadRatingDatabase(clubId)[div1PlayerId], `no leftover locked rating record may exist for removed playerId ${div1PlayerId}`);
      }
    }
    assert.ok(hblIds.has(hblPlayerId), `higher-level playerId ${hblPlayerId} must still exist exactly once in HBL`);
    const live = hblRatings.get(hblPlayerId);
    const expected = hblCsvById.get(hblPlayerId);
    assert.ok(live && expected, `no HBL rating found for ${hblPlayerId}`);
    assert.equal(live!.ca, expected!.ca, `HBL CA for ${hblPlayerId} must be unaffected by the Division 1 import`);
    assert.equal(live!.pa, expected!.pa, `HBL PA for ${hblPlayerId} must be unaffected by the Division 1 import`);
  }
});

test("Division 1 v1: the 7 UNRESOLVED_IDENTITY playerIds received no rating write and remain at their pre-import baseline", () => {
  const { header: auditHeader, rows: auditRows } = loadCsv(DIV1_AUDIT_CSV_PATH);
  const auditIdx = (name: string) => auditHeader.indexOf(name);
  const unresolvedIds = auditRows.filter((r) => r[auditIdx("Status")] === "UNRESOLVED_IDENTITY").map((r) => r[auditIdx("sourcePlayerId")]);
  assert.equal(unresolvedIds.length, 7);

  const { header: nHeader, rows: nRows } = loadCsv(DIV1N_CSV_PATH);
  const { header: sHeader, rows: sRows } = loadCsv(DIV1S_CSV_PATH);
  const nIdx = (name: string) => nHeader.indexOf(name);
  const sIdx = (name: string) => sHeader.indexOf(name);
  const currentById = new Map<string, { ca: number; pa: number }>();
  for (const r of nRows) currentById.set(r[nIdx("playerId")], { ca: Number(r[nIdx("Current CA")]), pa: Number(r[nIdx("Current PA")]) });
  for (const r of sRows) currentById.set(r[sIdx("playerId")], { ca: Number(r[sIdx("Current CA")]), pa: Number(r[sIdx("Current PA")]) });

  const ratings = collectRatings(D1_COMPETITION_IDS);
  const removed = documentedRemovedMemberships(D1_COMPETITION_IDS);
  for (const id of unresolvedIds) {
    // An unlocked player whose membership a documented correction removed has no live (roster-derived) rating any more.
    if (removed.has(id) && !removed.get(id)!.lock) continue;
    const live = ratings.get(id);
    const baseline = currentById.get(id);
    assert.ok(live && baseline, `no rating/baseline found for unresolved playerId ${id}`);
    assert.equal(live!.ca, baseline!.ca, `unresolved playerId ${id} CA must remain unchanged (no import applied)`);
    assert.equal(live!.pa, baseline!.pa, `unresolved playerId ${id} PA must remain unchanged (no import applied)`);
  }
});

test("HBL + World Pool + Allsvenskan + Division 1 combined: no PA < CA, all ratings in [1, 200], and no playerId duplicated across the four imported pools", () => {
  const hblIds = new Set(collectRatings([HBL_COMPETITION_ID]).keys());
  const worldPoolIds = new Set(collectRatings(WORLD_POOL_COMPETITION_IDS).keys());
  const allsvIds = new Set(collectRatings([ALLSVENSKAN_COMPETITION_ID]).keys());
  const div1Ids = new Set(collectRatings(D1_COMPETITION_IDS).keys());

  for (const id of div1Ids) {
    assert.ok(!hblIds.has(id), `playerId ${id} present in both Division 1 and HBL`);
    assert.ok(!worldPoolIds.has(id), `playerId ${id} present in both Division 1 and World Pool`);
    assert.ok(!allsvIds.has(id), `playerId ${id} present in both Division 1 and Allsvenskan`);
  }

  const combined = new Map([
    ...collectRatings([HBL_COMPETITION_ID]),
    ...collectRatings(WORLD_POOL_COMPETITION_IDS),
    ...collectRatings([ALLSVENSKAN_COMPETITION_ID]),
    ...collectRatings(D1_COMPETITION_IDS),
  ]);
  for (const [playerId, { ca, pa }] of combined) {
    assert.ok(pa >= ca, `PA < CA for ${playerId}: ca=${ca} pa=${pa}`);
    assert.ok(ca >= 1 && ca <= 200, `CA out of range for ${playerId}: ${ca}`);
    assert.ok(pa >= 1 && pa <= 200, `PA out of range for ${playerId}: ${pa}`);
  }
});
