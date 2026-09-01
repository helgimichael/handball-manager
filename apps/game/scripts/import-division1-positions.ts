// Imports researched POSITIONS for Swedish Division 1 Norra + Sodra from
// SWEDISH_PLAYER_BIO_MASTER_v4.2_DIV1_S_PASS5, which is authoritative for
// Division 1 positions.
//
// Every matched Division 1 row is applied. Source quality is NOT re-evaluated
// here and nothing is quarantined -- that decision was made when the file was
// accepted as authoritative. The only rejections are MECHANICAL:
//   * a value that is not a canonical position enum cannot be stored,
//   * a secondary equal to the primary would be a self-reference,
//   * a duplicate secondary would be a malformed list.
//
// Identity rows are applied to their EXACT existing playerId: no merge, no
// playerId change, no roster movement. A player with no research row (e.g.
// Alexander Grunau / Taby) is never touched.
//
// FinalSecondaryPositions is COMMA-separated ("M6,V9") and is split as such --
// never stored as a single enum value.
//
// Writes ONLY primaryPosition and secondaryPositions, only in roster-*.json
// under the two Division 1 directories. Idempotent: re-running produces the
// same canonical state.
import * as fs from "node:fs";
import * as path from "node:path";

/** Repo root, derived from this file's location (apps/game/scripts) -- never a machine-specific path. */
const REPO = path.resolve(__dirname, "..", "..", "..");
const SWEDEN = path.join(REPO, "data/real-world/sweden/2026-27");
const RESEARCH = process.argv[2] ?? process.env.HM_RESEARCH_CSV ?? "";
if (!RESEARCH) {
  console.error("usage: tsx " + path.basename(__filename) + " <path-to-SWEDISH_PLAYER_BIO_MASTER csv>   (or set HM_RESEARCH_CSV)");
  process.exit(1);
}
const REPORT_OUT = path.join(REPO, "exports/player-rating-research/DIV1_POSITION_IMPORT_REPORT.csv");

const DIRS = new Map([["Division 1 Norra", "division1-norra"], ["Division 1 Sodra", "division1-sodra"]]);
const VALID = new Set(["MV", "V6", "H6", "V9", "M9", "H9", "M6"]);

function parseCsvLine(line: string): string[] {
  const out: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else { if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch; }
  }
  out.push(cur); return out;
}
const raw = fs.readFileSync(RESEARCH, "utf8").replace(/^\uFEFF/, "");
const lines = raw.split(/\r?\n/).filter((l) => l.length > 0);
const header = parseCsvLine(lines[0]);
const H = (n: string) => header.indexOf(n);
const rows = lines.slice(1).map(parseCsvLine).filter((r) => DIRS.has(r[H("Competition")]));

const VARIANTS: [string, (d: unknown) => string][] = [
  ["CRLF", (d) => JSON.stringify(d, null, 2).replace(/\n/g, "\r\n")],
  ["LF", (d) => JSON.stringify(d, null, 2)],
  ["LF+nl", (d) => JSON.stringify(d, null, 2) + "\n"],
  ["CRLF+nl", (d) => (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, "\r\n")],
];

interface RosterEntry { playerId: string; primaryPosition: string; secondaryPositions?: string[] }
const target = new Map<string, { rosterPath: string; comp: string; club: string; name: string }>();
const canon = new Map<string, RosterEntry>();
const loaded = new Map<string, RosterEntry[]>();
const rawOf = new Map<string, string>();
function load(p: string): RosterEntry[] {
  if (!loaded.has(p)) { rawOf.set(p, fs.readFileSync(p, "utf8")); loaded.set(p, JSON.parse(rawOf.get(p)!)); }
  return loaded.get(p)!;
}

for (const [comp, dir] of DIRS) {
  const cd = path.join(SWEDEN, dir);
  for (const d of fs.readdirSync(cd, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const clubDir = path.join(cd, d.name), fl = fs.readdirSync(clubDir);
    const pf = fl.find((f) => f.startsWith("players-") && f.endsWith(".json"));
    const rf = fl.find((f) => f.startsWith("roster-") && f.endsWith(".json"));
    if (!pf || !rf) continue;
    const rosterPath = path.join(clubDir, rf);
    const names = new Map<string, string>(JSON.parse(fs.readFileSync(path.join(clubDir, pf), "utf8"))
      .map((p: { playerId: string; fullName?: string }) => [p.playerId, p.fullName ?? ""]));
    for (const r of load(rosterPath)) {
      if (!names.has(r.playerId)) continue;
      target.set(r.playerId, { rosterPath, comp, club: d.name, name: names.get(r.playerId)! });
      canon.set(r.playerId, r);
    }
  }
}

const S = (v: string) => (v ?? "").trim();
interface Written { pid: string; name: string; comp: string; club: string; field: string; before: string; after: string; conf: string; status: string }
const written: Written[] = [];
const mechanicalSkips: string[] = [];
const unresolved: string[] = [];
let rowsWithPrimary = 0, rowsWithSecondary = 0, primaryAlreadyCorrect = 0, secondaryAlreadyCorrect = 0;
let droppedExistingSecondary = 0;

for (const r of rows) {
  const pid = r[H("playerId")];
  const t = target.get(pid);
  const entry = canon.get(pid);
  const to = S(r[H("FinalPrimaryPosition")]);
  const rawSec = S(r[H("FinalSecondaryPositions")]);
  if (!t || !entry) {
    if (to || rawSec) unresolved.push(`${r[H("Player")]} (${pid}) -- no canonical Division 1 roster entry`);
    continue;
  }
  const conf = S(r[H("Confidence")]), status = S(r[H("PositionStatus")]);

  // ---- primary ----
  if (to) {
    rowsWithPrimary++;
    if (!VALID.has(to)) mechanicalSkips.push(`${t.name} (${pid}) primaryPosition ${JSON.stringify(to)} -- not a canonical enum`);
    else if (to === entry.primaryPosition) primaryAlreadyCorrect++;
    else {
      written.push({ pid, name: t.name, comp: t.comp, club: t.club, field: "primaryPosition", before: entry.primaryPosition, after: to, conf, status });
      entry.primaryPosition = to;
    }
  }

  // ---- secondary (COMMA-separated; the file is authoritative) ----
  if (rawSec) {
    rowsWithSecondary++;
    const tokens = rawSec.split(",").map((x) => x.trim()).filter(Boolean);
    const invalid = tokens.filter((x) => !VALID.has(x));
    if (invalid.length) mechanicalSkips.push(`${t.name} (${pid}) secondaryPositions ${JSON.stringify(rawSec)} -- invalid enum token(s) ${invalid.join(", ")}`);
    else {
      // dedupe, and never keep the primary as its own secondary
      const cleaned = [...new Set(tokens)].filter((x) => x !== entry.primaryPosition);
      const existing = entry.secondaryPositions ?? [];
      if (cleaned.join(",") === existing.join(",")) secondaryAlreadyCorrect++;
      else {
        const dropped = existing.filter((x) => !cleaned.includes(x));
        if (dropped.length) droppedExistingSecondary += dropped.length;
        written.push({ pid, name: t.name, comp: t.comp, club: t.club, field: "secondaryPositions", before: existing.join(",") || "(none)", after: cleaned.join(",") || "(none)", conf, status });
        entry.secondaryPositions = cleaned;
      }
    }
  }
}

const unsafe: string[] = [];
let filesWritten = 0;
for (const [p, data] of loaded) {
  const original = rawOf.get(p)!;
  const style = VARIANTS.find(([, fn]) => fn(JSON.parse(original)) === original);
  if (!style) { unsafe.push(p); continue; }
  const next = style[1](data);
  if (next !== original) { fs.writeFileSync(p, next, "utf8"); filesWritten++; }
}

const primary = written.filter((w) => w.field === "primaryPosition");
const secondary = written.filter((w) => w.field === "secondaryPositions");
console.log("=== DIVISION 1 POSITION IMPORT (v4.2 authoritative, full apply) ===");
console.log(`research rows in scope: ${rows.length}   matched canonical players: ${target.size >= 0 ? rows.filter((r) => canon.has(r[H("playerId")])).length : 0}`);
console.log(`files written this run: ${filesWritten}`);
console.log(`\nrows with FinalPrimaryPosition:   ${rowsWithPrimary}`);
console.log(`   applied (changed):             ${primary.length}`);
console.log(`   already correct:               ${primaryAlreadyCorrect}`);
console.log(`rows with FinalSecondaryPositions: ${rowsWithSecondary}`);
console.log(`   applied (changed):             ${secondary.length}`);
console.log(`   already correct:               ${secondaryAlreadyCorrect}`);
console.log(`   existing secondary values dropped: ${droppedExistingSecondary}`);
console.log(`\nmechanical skips (unstorable values): ${mechanicalSkips.length}`);
for (const m of mechanicalSkips) console.log(`   ${m}`);
console.log(`unresolved rows: ${unresolved.length}`);
for (const u of unresolved) console.log(`   ${u}`);
if (unsafe.length) { console.log(`\nNOT byte-reproducible, SKIPPED:`); unsafe.forEach((u) => console.log(`  ${u}`)); }

const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
fs.writeFileSync(REPORT_OUT,
  ["playerId,Player,Competition,Club,Field,Before,After,Confidence,PositionStatus",
    ...written.map((w) => [w.pid, w.name, w.comp, w.club, w.field, w.before, w.after, w.conf, w.status].map(q).join(","))].join("\n") + "\n", "utf8");
console.log(`\nimport log (this run): ${path.basename(REPORT_OUT)}`);
