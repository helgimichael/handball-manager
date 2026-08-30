// Phase 13-14: builds and applies the Division 1 Norra/Sodra rating import
// set, restricted STRICTLY to playerIds classified DIV1_ONLY_CANONICAL in
// DIV1_PLAYER_IDENTITY_AUDIT.csv. ALREADY_CANONICAL_HIGHER_LEVEL,
// DIV1_DUPLICATE_CONFIRMED, and UNRESOLVED_IDENTITY playerIds are excluded
// entirely -- a Division 1 rating must never be written for a player whose
// real identity resolves to an HBL/Allsvenskan canonical record, and an
// unresolved identity gets no rating write until better evidence exists.
// Same canonical write path as every prior import (calibratePlayerRating).
import * as fs from "node:fs";
import { snapshotWorldSquads } from "../lib/gameWorld/serverSnapshot";
import { calibratePlayerRating, toRatingPosition } from "../lib/editor/ratingCalibration";
import type { CanonicalPosition } from "../lib/editor/schema";

const DIV1N_CSV = "C:/Users/helgi/Desktop/Div. 1/DIV1N_rating_import_candidates_v0.6.csv";
const DIV1S_CSV = "C:/Users/helgi/Desktop/Div. 1/DIV1S_rating_import_candidates_v0.5.csv";
const AUDIT_CSV = "C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager/exports/player-rating-research/DIV1_PLAYER_IDENTITY_AUDIT.csv";
const D1N_ID = "se_division1_norra";
const D1S_ID = "se_division1_sodra";
const NOTE = "DIV1N_rating_import_candidates_v0.6 / DIV1S_rating_import_candidates_v0.5 Division 1 import (DIV1_ONLY_CANONICAL set only)";

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

function loadCsv(path: string) {
  const raw = fs.readFileSync(path, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  return { header, idx, rows: lines.slice(1).map(parseCsvLine) };
}

interface CandidateRow { playerId: string; player: string; club: string; newCA: number; newPA: number; competitionId: string; }

function loadCandidates(path: string, competitionId: string): CandidateRow[] {
  const { idx, rows } = loadCsv(path);
  return rows.map((r) => ({
    playerId: r[idx("playerId")],
    player: r[idx("Player")],
    club: r[idx("Club")],
    newCA: Number(r[idx("New CA")]),
    newPA: Number(r[idx("New PA")]),
    competitionId,
  }));
}

/**
 * The repo lives under a synced folder on this machine (OneDrive), which
 * transiently locks files being renamed during atomic writes -- surfaces as
 * EPERM on renameSync. Retry with a short backoff rather than touching the
 * production atomicWrite.ts write path.
 */
function calibrateWithRetry(
  clubId: string,
  playerId: string,
  position: ReturnType<typeof toRatingPosition>,
  ca: number,
  pa: number,
  note: string,
  attempts = 5,
): ReturnType<typeof calibratePlayerRating> {
  for (let i = 0; i < attempts; i++) {
    try {
      return calibratePlayerRating(clubId, playerId, position, ca, pa, note);
    } catch (err) {
      const isEperm = err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "EPERM";
      if (!isEperm || i === attempts - 1) throw err;
      const waitMs = 200 * (i + 1);
      const until = Date.now() + waitMs;
      while (Date.now() < until) { /* busy-wait: this is a one-off sync script, not production code */ }
    }
  }
  throw new Error("unreachable");
}

function main(): void {
  const allCandidates = [...loadCandidates(DIV1N_CSV, D1N_ID), ...loadCandidates(DIV1S_CSV, D1S_ID)];
  console.log(`Total Division 1 source rows: ${allCandidates.length}`);

  const { idx: auditIdx, rows: auditRows } = loadCsv(AUDIT_CSV);
  const statusByPlayerId = new Map<string, string>();
  for (const r of auditRows) statusByPlayerId.set(r[auditIdx("sourcePlayerId")], r[auditIdx("Status")]);

  const excludedHigherLevel = allCandidates.filter((c) => statusByPlayerId.get(c.playerId) === "ALREADY_CANONICAL_HIGHER_LEVEL");
  const excludedDuplicate = allCandidates.filter((c) => statusByPlayerId.get(c.playerId) === "DIV1_DUPLICATE_CONFIRMED");
  const excludedUnresolved = allCandidates.filter((c) => statusByPlayerId.get(c.playerId) === "UNRESOLVED_IDENTITY");
  const importSet = allCandidates.filter((c) => statusByPlayerId.get(c.playerId) === "DIV1_ONLY_CANONICAL");

  console.log(`Confirmed higher-level duplicates excluded: ${excludedHigherLevel.length}`);
  console.log(`Confirmed Division 1 internal duplicates excluded: ${excludedDuplicate.length}`);
  console.log(`Unresolved identities excluded: ${excludedUnresolved.length}`);
  console.log(`Final Division 1 rating candidates (DIV1_ONLY_CANONICAL): ${importSet.length}`);

  const unclassified = allCandidates.filter((c) => !statusByPlayerId.has(c.playerId));
  if (unclassified.length > 0) {
    console.error(`STOP: ${unclassified.length} source rows have no audit classification at all:`, unclassified.map((c) => c.playerId));
    process.exit(1);
  }

  // Pre-flight validation.
  const uniqueIds = new Set(importSet.map((c) => c.playerId));
  if (uniqueIds.size !== importSet.length) {
    console.error(`STOP: duplicate playerId rows in the import set (${importSet.length} rows, ${uniqueIds.size} unique).`);
    process.exit(1);
  }
  for (const c of importSet) {
    if (c.newPA < c.newCA) { console.error(`STOP: PA < CA for ${c.playerId} (${c.player}): CA=${c.newCA} PA=${c.newPA}`); process.exit(1); }
    if (c.newCA < 1 || c.newCA > 200 || c.newPA < 1 || c.newPA > 200) { console.error(`STOP: out-of-range for ${c.playerId} (${c.player}): CA=${c.newCA} PA=${c.newPA}`); process.exit(1); }
  }

  // Safety: none of the excluded higher-level playerIds may appear in the import set.
  const importSetIds = new Set(importSet.map((c) => c.playerId));
  for (const c of excludedHigherLevel) {
    if (importSetIds.has(c.playerId)) { console.error(`STOP: higher-level-duplicate playerId ${c.playerId} leaked into the import set.`); process.exit(1); }
  }

  const playerIdToClub = new Map<string, { clubId: string; position: string; competitionId: string }>();
  for (const competitionId of [D1N_ID, D1S_ID]) {
    const worldSquads = snapshotWorldSquads(competitionId);
    for (const clubId of Object.keys(worldSquads)) {
      for (const p of worldSquads[clubId]) playerIdToClub.set(p.id, { clubId, position: p.position, competitionId });
    }
  }

  const missing: string[] = [];
  for (const c of importSet) if (!playerIdToClub.has(c.playerId)) missing.push(c.playerId);
  if (missing.length > 0) {
    console.error(`STOP: ${missing.length} import-set playerId(s) not found in canonical Division 1 database:`, missing);
    process.exit(1);
  }

  let updated = 0;
  const failures: { playerId: string; player: string; errors: string[] }[] = [];
  for (const c of importSet) {
    const { clubId, position } = playerIdToClub.get(c.playerId)!;
    const ratingPosition = toRatingPosition(position as CanonicalPosition);
    const result = calibrateWithRetry(clubId, c.playerId, ratingPosition, c.newCA, c.newPA, NOTE);
    if (!result.ok) {
      failures.push({ playerId: c.playerId, player: c.player, errors: result.errors });
      continue;
    }
    updated++;
  }

  console.log(`\n=== Division 1 v1 import report ===`);
  console.log(`matched = ${importSet.length - missing.length}`);
  console.log(`updated = ${updated}`);
  console.log(`missing = ${missing.length}`);
  console.log(`duplicates = ${importSet.length - uniqueIds.size}`);
  console.log(`PA < CA (post-validation) = ${importSet.filter((c) => c.newPA < c.newCA).length}`);
  console.log(`out of range (post-validation) = ${importSet.filter((c) => c.newCA < 1 || c.newCA > 200 || c.newPA < 1 || c.newPA > 200).length}`);
  if (failures.length > 0) {
    console.error(`\nWrite failures (${failures.length}):`);
    for (const f of failures) console.error(`  ${f.playerId} (${f.player}): ${f.errors.join("; ")}`);
    process.exit(1);
  }
  console.log(`\nAll ${updated} players imported successfully.`);
}

main();
