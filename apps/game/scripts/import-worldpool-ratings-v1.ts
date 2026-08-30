// Phase 8: canonical import of WORLD_POOL_FINAL_RATING_RESEARCH_v1.csv into
// the game's canonical LOCKED rating database, via the SAME canonical write
// path as the HBL v2.13 import (scripts/import-hbl-ratings-v2.13.ts) --
// lib/editor/ratingCalibration.ts's calibratePlayerRating. Matches strictly
// by playerId; never fuzzy-matches by name. Never creates a new player.
// Never touches any field other than CA/PA.
import * as fs from "node:fs";
import { snapshotWorldSquads } from "../lib/gameWorld/serverSnapshot";
import { calibratePlayerRating, toRatingPosition } from "../lib/editor/ratingCalibration";
import { WORLD_POOL_COMPETITION_IDS } from "../lib/career/careerWorld";
import type { CanonicalPosition } from "../lib/editor/schema";

const CSV_PATH = "C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager/exports/player-rating-research/WORLD_POOL_FINAL_RATING_RESEARCH_v1.csv";
const NOTE = "WORLD_POOL_FINAL_RATING_RESEARCH_v1 World Pool final import (100/100, individually verified, 0 REVIEW)";

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

interface CsvRow { playerId: string; player: string; club: string; finalCA: number; finalPA: number; status: string; }

function loadCsv(): CsvRow[] {
  const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  return lines.slice(1).map(parseCsvLine).map((r) => ({
    playerId: r[idx("playerId")],
    player: r[idx("Player")],
    club: r[idx("Club")],
    finalCA: Number(r[idx("Final CA")]),
    finalPA: Number(r[idx("Final PA")]),
    status: r[idx("Research Status")],
  }));
}

function main(): void {
  const rows = loadCsv();
  console.log(`Loaded ${rows.length} candidate rows from World Pool v1.`);

  const reviewRows = rows.filter((r) => r.status !== "FINAL");
  if (reviewRows.length > 0) {
    console.error(`STOP: ${reviewRows.length} row(s) not marked FINAL -- skipping those, not writing them.`);
  }
  const writable = rows.filter((r) => r.status === "FINAL");

  const uniqueIds = new Set(writable.map((r) => r.playerId));
  if (uniqueIds.size !== writable.length) {
    console.error(`STOP: duplicate playerId rows in CSV (${writable.length} rows, ${uniqueIds.size} unique).`);
    process.exit(1);
  }
  for (const r of writable) {
    if (r.finalPA < r.finalCA) { console.error(`STOP: PA < CA for ${r.playerId} (${r.player}): CA=${r.finalCA} PA=${r.finalPA}`); process.exit(1); }
    if (r.finalCA < 1 || r.finalCA > 200 || r.finalPA < 1 || r.finalPA > 200) { console.error(`STOP: out-of-range for ${r.playerId} (${r.player}): CA=${r.finalCA} PA=${r.finalPA}`); process.exit(1); }
  }

  const playerIdToClub = new Map<string, { clubId: string; position: string }>();
  for (const competitionId of WORLD_POOL_COMPETITION_IDS) {
    const worldSquads = snapshotWorldSquads(competitionId);
    for (const clubId of Object.keys(worldSquads)) {
      for (const p of worldSquads[clubId]) playerIdToClub.set(p.id, { clubId, position: p.position });
    }
  }

  const missing: string[] = [];
  for (const r of writable) if (!playerIdToClub.has(r.playerId)) missing.push(r.playerId);
  if (missing.length > 0) {
    console.error(`STOP: ${missing.length} candidate playerId(s) not found in canonical World Pool database:`, missing);
    process.exit(1);
  }

  let updated = 0;
  const failures: { playerId: string; player: string; errors: string[] }[] = [];
  for (const r of writable) {
    const { clubId, position } = playerIdToClub.get(r.playerId)!;
    const ratingPosition = toRatingPosition(position as CanonicalPosition);
    const result = calibratePlayerRating(clubId, r.playerId, ratingPosition, r.finalCA, r.finalPA, NOTE);
    if (!result.ok) {
      failures.push({ playerId: r.playerId, player: r.player, errors: result.errors });
      continue;
    }
    updated++;
  }

  console.log(`\n=== World Pool v1 import report ===`);
  console.log(`expected World Pool candidates = ${rows.length}`);
  console.log(`FINAL rows = ${writable.length}`);
  console.log(`REVIEW rows skipped = ${reviewRows.length}`);
  console.log(`matched = ${writable.length - missing.length}`);
  console.log(`updated = ${updated}`);
  console.log(`missing = ${missing.length}`);
  console.log(`duplicates = ${writable.length - uniqueIds.size}`);
  console.log(`PA < CA (post-validation) = ${writable.filter((r) => r.finalPA < r.finalCA).length}`);
  console.log(`out of range (post-validation) = ${writable.filter((r) => r.finalCA < 1 || r.finalCA > 200 || r.finalPA < 1 || r.finalPA > 200).length}`);
  if (failures.length > 0) {
    console.error(`\nWrite failures (${failures.length}):`);
    for (const f of failures) console.error(`  ${f.playerId} (${f.player}): ${f.errors.join("; ")}`);
    process.exit(1);
  }
  console.log(`\nAll ${updated} players imported successfully.`);
}

main();
