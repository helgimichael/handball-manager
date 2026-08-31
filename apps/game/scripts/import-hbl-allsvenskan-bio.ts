// Imports researched bio data for Handbollsligan + Herrallsvenskan from
// SWEDISH_PLAYER_BIO_MASTER_v3.1. Field-level updates only -- never row
// replacement, never player creation/removal.
//
// SCOPE: Handbollsligan and Herrallsvenskan ONLY. Division 1 rows in the
// research file are ignored entirely and no Division 1 file is opened.
//
// IMPORTED:  dateOfBirth, birthYear, nationalities
// QUARANTINED (see the audit report):
//   * primaryPosition / secondaryPositions -- 61 of 77 proposed primary
//     changes derive from single-match Profixio protocols, and 16 of them
//     are goalkeeper<->outfield swaps (MV -> H6 etc). A match protocol
//     records who played, not a player's canonical position, so this field
//     is not safe to import from that source.
//   * MergedFromPlayerIds identity merges -- each would DELETE a canonical
//     player (one of them a Division 1 player), which both breaks the
//     "same player count before and after" invariant and crosses the
//     Division 1 scope boundary.
//   * Any FinalDOB ending -01-01 -- the classic fabricated-placeholder
//     pattern; a birth-year-only source must stay birth-year-only.
import * as fs from "node:fs";
import * as path from "node:path";

const REPO = "C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager";
const SWEDEN = path.join(REPO, "data/real-world/sweden/2026-27");
const RESEARCH = "C:/Users/helgi/Desktop/bio master/SWEDISH_PLAYER_BIO_MASTER_v3.1_DIV1_N_PASS1.csv";
const REPORT_OUT = path.join(REPO, "exports/player-rating-research/HBL_ALLSV_BIO_IMPORT_REPORT.csv");

/** Only these two competitions may be touched. */
const IN_SCOPE = new Map<string, string>([
  ["Handbollsligan", "handbollsligan"],
  ["Herrallsvenskan", "allsvenskan"],
]);

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
const rows = lines.slice(1).map(parseCsvLine).filter((r) => IN_SCOPE.has(r[H("Competition")]));

// --- Build canonical index (in-scope only) ---
interface ClubFile { clubDir: string; playersPath: string; competition: string; }
const fileOfPlayer = new Map<string, ClubFile>();
const canonBefore = new Map<string, { dob: string | null; year: number | null; nat: string[] | null; name: string; competition: string }>();

for (const [competition, dir] of IN_SCOPE) {
  const compDir = path.join(SWEDEN, dir);
  for (const d of fs.readdirSync(compDir, { withFileTypes: true })) {
    if (!d.isDirectory()) continue;
    const clubDir = path.join(compDir, d.name);
    const files = fs.readdirSync(clubDir);
    const pf = files.find((f) => f.startsWith("players-") && f.endsWith(".json"));
    const rf = files.find((f) => f.startsWith("roster-") && f.endsWith(".json"));
    if (!pf || !rf) continue;
    const playersPath = path.join(clubDir, pf);
    const players = JSON.parse(fs.readFileSync(playersPath, "utf8"));
    const roster = JSON.parse(fs.readFileSync(path.join(clubDir, rf), "utf8"));
    const rosterIds = new Set(roster.map((x: { playerId: string }) => x.playerId));
    for (const p of players as { playerId: string; fullName?: string; dateOfBirth: string | null; birthYear: number | null; nationalities: string[] | null }[]) {
      if (!rosterIds.has(p.playerId)) continue;
      fileOfPlayer.set(p.playerId, { clubDir, playersPath, competition });
      canonBefore.set(p.playerId, { dob: p.dateOfBirth ?? null, year: p.birthYear ?? null, nat: p.nationalities ?? null, name: p.fullName ?? "", competition });
    }
  }
}

interface Change { playerId: string; player: string; competition: string; field: string; before: string; after: string; source: string; }
const changes: Change[] = [];
const skipped: Change[] = [];
const unresolved: string[] = [];

// playersPath -> parsed JSON (loaded once, written once)
const loaded = new Map<string, { playerId: string; dateOfBirth: string | null; birthYear: number | null; nationalities: string[] | null }[]>();
function load(p: string) {
  if (!loaded.has(p)) loaded.set(p, JSON.parse(fs.readFileSync(p, "utf8")));
  return loaded.get(p)!;
}

const touchedIds = new Set<string>();

for (const r of rows) {
  const id = r[H("playerId")];
  const player = r[H("Player")];
  const competition = r[H("Competition")];
  const target = fileOfPlayer.get(id);
  const before = canonBefore.get(id);
  if (!target || !before) { unresolved.push(`${player} (${id}, ${competition}) -- no canonical match in scope`); continue; }
  if (target.competition !== competition) { unresolved.push(`${player} (${id}) -- competition mismatch`); continue; }
  if (touchedIds.has(id)) { unresolved.push(`${player} (${id}) -- duplicate research row, skipped`); continue; }
  touchedIds.add(id);

  const data = load(target.playersPath);
  const entry = data.find((x) => x.playerId === id);
  if (!entry) { unresolved.push(`${player} (${id}) -- missing in players file`); continue; }

  const src = r[H("Source1")] ?? "";
  const fDob = (r[H("FinalDOB")] ?? "").trim();
  const fYear = (r[H("FinalBirthYear")] ?? "").trim();
  const fNat = (r[H("FinalNationality")] ?? "").trim();

  // --- dateOfBirth ---
  if (fDob) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fDob)) {
      skipped.push({ playerId: id, player, competition, field: "dateOfBirth", before: String(before.dob), after: fDob, source: "malformed date" });
    } else if (fDob.endsWith("-01-01")) {
      // Fabricated-placeholder pattern -- refuse, but keep the year if we can.
      skipped.push({ playerId: id, player, competition, field: "dateOfBirth", before: String(before.dob), after: fDob, source: "suspected fabricated 01-01 placeholder" });
    } else if (fDob !== (before.dob ?? "")) {
      entry.dateOfBirth = fDob;
      entry.birthYear = Number(fDob.slice(0, 4));
      changes.push({ playerId: id, player, competition, field: "dateOfBirth", before: String(before.dob), after: fDob, source: src });
      if (String(before.year) !== fDob.slice(0, 4)) {
        changes.push({ playerId: id, player, competition, field: "birthYear", before: String(before.year), after: fDob.slice(0, 4), source: src });
      }
    }
  }

  // --- birthYear (only when no exact DOB is present/being set) ---
  if (!entry.dateOfBirth && fYear && /^\d{4}$/.test(fYear) && fYear !== String(before.year ?? "")) {
    entry.birthYear = Number(fYear);
    changes.push({ playerId: id, player, competition, field: "birthYear", before: String(before.year), after: fYear, source: src });
  }

  // --- nationalities ---
  if (fNat) {
    const next = fNat.split("/").map((s) => s.trim()).filter(Boolean);
    const prev = (before.nat ?? []).join("/");
    if (next.join("/") !== prev) {
      entry.nationalities = next;
      changes.push({ playerId: id, player, competition, field: "nationalities", before: prev || "(none)", after: next.join("/"), source: src });
    }
  }
}

// --- Write files ---
for (const [p, data] of loaded) fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");

// --- Report ---
function tally(comp: string, field: string) { return changes.filter((c) => c.competition === comp && c.field === field).length; }
console.log(`=== IMPORT COMPLETE (HBL + Herrallsvenskan only) ===`);
console.log(`files written: ${loaded.size}`);
for (const comp of IN_SCOPE.keys()) {
  console.log(`\n${comp}`);
  console.log(`  DOB updated:         ${tally(comp, "dateOfBirth")}`);
  console.log(`  birthYear updated:   ${tally(comp, "birthYear")}`);
  console.log(`  nationality updated: ${tally(comp, "nationalities")}`);
  console.log(`  position updated:    0 (quarantined)`);
  console.log(`  secondaryPosition updated: 0 (quarantined)`);
  console.log(`  CA updated:          0 (not present in this research file)`);
  console.log(`  PA updated:          0 (not present in this research file)`);
  console.log(`  unresolved:          ${unresolved.filter((u) => u.includes(comp)).length}`);
}
console.log(`\ntotal field changes: ${changes.length}`);
console.log(`distinct players modified: ${new Set(changes.map((c) => c.playerId)).size}`);
console.log(`\nskipped (refused) values: ${skipped.length}`);
for (const s of skipped) console.log(`  ${s.player} ${s.field}: ${s.after} -- ${s.source}`);
console.log(`\nunresolved: ${unresolved.length}`);
for (const u of unresolved) console.log(`  ${u}`);

function q(v: string) { return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }
const out = ["playerId,Player,Competition,Field,Before,After,Source"];
for (const c of changes) out.push([c.playerId, c.player, c.competition, c.field, c.before, c.after, c.source].map(q).join(","));
fs.writeFileSync(REPORT_OUT, out.join("\n") + "\n", "utf8");
console.log(`\nchange log written: ${path.basename(REPORT_OUT)}`);
