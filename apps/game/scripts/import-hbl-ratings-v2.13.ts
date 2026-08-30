// HM-PLAYER-DATABASE-EXPORT-1.0 Phase 2: canonical import of the final
// HBL_rating_import_candidates_v2.13.csv research pass into the game's
// canonical LOCKED rating database (lib/editor/ratingDatabaseRepository.ts,
// data/real-world/.../ratings/<clubId>.json), via the SAME canonical
// write path the Editor's own calibration UI uses
// (lib/editor/ratingCalibration.ts's calibratePlayerRating) -- no parallel
// write mechanism. Matches strictly by playerId; never fuzzy-matches by
// name. Never creates a new player. Never touches any field other than
// CA/PA (calibratePlayerRating's own draft-override step only ever sets
// ca/pa; nothing else in the player record is written).
import * as fs from "node:fs";
import { snapshotWorldSquads } from "../lib/gameWorld/serverSnapshot";
import { calibratePlayerRating, toRatingPosition } from "../lib/editor/ratingCalibration";
import type { CanonicalPosition } from "../lib/editor/schema";

const CSV_PATH = "C:/Users/helgi/Desktop/HBL_rating_import_candidates_v2.13.csv";
const HBL_COMPETITION_ID = "se_handbollsligan_herr";
const NOTE = "HM_Player_Rating_Research_v2.13 HBL final import (268/268, individually researched, 0 REVIEW)";

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

interface CsvRow { playerId: string; player: string; club: string; currentCA: number; currentPA: number; newCA: number; newPA: number; }

function loadCsv(): CsvRow[] {
  const raw = fs.readFileSync(CSV_PATH, "utf8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);
  return lines.slice(1).map(parseCsvLine).map((r) => ({
    playerId: r[idx("playerId")],
    player: r[idx("Player")],
    club: r[idx("Club")],
    currentCA: Number(r[idx("Current CA")]),
    currentPA: Number(r[idx("Current PA")]),
    newCA: Number(r[idx("New CA")]),
    newPA: Number(r[idx("New PA")]),
  }));
}

function main(): void {
  const rows = loadCsv();
  console.log(`Loaded ${rows.length} candidate rows from v2.13.`);

  // Pre-flight identity/range validation -- STOP before writing anything if any invariant fails.
  const uniqueIds = new Set(rows.map((r) => r.playerId));
  if (uniqueIds.size !== rows.length) {
    console.error(`STOP: duplicate playerId rows in CSV (${rows.length} rows, ${uniqueIds.size} unique).`);
    process.exit(1);
  }
  for (const r of rows) {
    if (r.newPA < r.newCA) { console.error(`STOP: PA < CA for ${r.playerId} (${r.player}): CA=${r.newCA} PA=${r.newPA}`); process.exit(1); }
    if (r.newCA < 1 || r.newCA > 200 || r.newPA < 1 || r.newPA > 200) { console.error(`STOP: out-of-range for ${r.playerId} (${r.player}): CA=${r.newCA} PA=${r.newPA}`); process.exit(1); }
  }

  const worldSquads = snapshotWorldSquads(HBL_COMPETITION_ID);
  const playerIdToClub = new Map<string, { clubId: string; position: string }>();
  for (const clubId of Object.keys(worldSquads)) {
    for (const p of worldSquads[clubId]) playerIdToClub.set(p.id, { clubId, position: p.position });
  }

  const missing: string[] = [];
  for (const r of rows) if (!playerIdToClub.has(r.playerId)) missing.push(r.playerId);
  if (missing.length > 0) {
    console.error(`STOP: ${missing.length} candidate playerId(s) not found in canonical HBL database:`, missing);
    process.exit(1);
  }

  let updated = 0;
  const failures: { playerId: string; player: string; errors: string[] }[] = [];
  for (const r of rows) {
    const { clubId, position } = playerIdToClub.get(r.playerId)!;
    const ratingPosition = toRatingPosition(position as CanonicalPosition);
    const result = calibratePlayerRating(clubId, r.playerId, ratingPosition, r.newCA, r.newPA, NOTE);
    if (!result.ok) {
      failures.push({ playerId: r.playerId, player: r.player, errors: result.errors });
      continue;
    }
    updated++;
  }

  console.log(`\n=== HBL v2.13 import report ===`);
  console.log(`expected HBL candidates = ${rows.length}`);
  console.log(`matched = ${rows.length - missing.length}`);
  console.log(`updated = ${updated}`);
  console.log(`missing = ${missing.length}`);
  console.log(`duplicates = ${rows.length - uniqueIds.size}`);
  console.log(`PA < CA (post-validation) = ${rows.filter((r) => r.newPA < r.newCA).length}`);
  console.log(`out of range (post-validation) = ${rows.filter((r) => r.newCA < 1 || r.newCA > 200 || r.newPA < 1 || r.newPA > 200).length}`);
  if (failures.length > 0) {
    console.error(`\nWrite failures (${failures.length}):`);
    for (const f of failures) console.error(`  ${f.playerId} (${f.player}): ${f.errors.join("; ")}`);
    process.exit(1);
  }
  console.log(`\nAll ${updated} players imported successfully.`);
}

main();
