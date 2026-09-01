// Imports researched BIO data for Swedish Division 1 Norra + Sodra from
// SWEDISH_PLAYER_BIO_MASTER_v4.2_DIV1_S_PASS5.
//
// SCOPE: Division 1 Norra and Division 1 Sodra ONLY. Handbollsligan and
// Herrallsvenskan rows in the research file are ignored entirely and no
// file outside the two Division 1 directories is ever opened. (Verified:
// v4.2 differs from the already-imported v3.1 only on Division 1 rows.)
//
// IMPORTED:  dateOfBirth (+ the birthYear implied by it), birthYear-only
// NOT IMPORTED, deliberately:
//   * nationalities -- the Division 1 rows emit ISO-3 codes ("SWE",
//     "NOR", "IRL") while the SAME file uses ISO-2 for Handbollsligan
//     ("SE", "NO") and canonical `nationalities` is ISO-2 keyed by
//     ISO_TO_NATION_CODE. Writing ISO-3 would resolve to UNK. One value
//     ("IRL") has no NationCode at all. Guessing the intended format is
//     exactly the "invent a mapping" case the milestone forbids, so every
//     nationality row is reported and none is written.
//   * primaryPosition / secondaryPositions -- 46 of 232 proposals are
//     goalkeeper<->outfield swaps; quarantined for separate review.
//   * identity merges (MergedFromPlayerIds) -- each would delete a
//     canonical player, one across the Allsvenskan boundary.
//   * CA/PA -- already imported and verified (Division 1 v1).
//
// Field-level updates only: never row replacement, never player
// creation/removal, never a roster file.
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
const REPORT_OUT = path.join(REPO, "exports/player-rating-research/DIV1_BIO_IMPORT_REPORT.csv");
const NAT_HOLD_OUT = path.join(REPO, "exports/player-rating-research/DIV1_NATIONALITY_UNMAPPED.csv");

/** Only these two competitions may be touched. */
const IN_SCOPE = new Map<string, string>([
  ["Division 1 Norra", "division1-norra"],
  ["Division 1 Sodra", "division1-sodra"],
]);

/** ISO-2 codes the game can actually resolve (mirrors ISO_TO_NATION_CODE). */
const KNOWN_ISO2 = new Set([
  "SE", "DK", "NO", "DE", "ES", "HU", "SI", "IS", "FO", "IT", "QA", "NL", "PT", "AT", "CH", "PL",
  "FR", "RS", "HR", "BA", "FI", "AR", "LT", "RO", "DZ", "EE", "XK", "GB", "CL", "US",
]);

const GAME_DATE = "2026-08-30";
const MIN_YEAR = 1975;
const MAX_YEAR = 2011;

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

// --- Canonical index: Division 1 players that are actually on a roster ---
interface Target { playersPath: string; competition: string }
const fileOfPlayer = new Map<string, Target>();
const before = new Map<string, { dob: string | null; year: number | null; name: string; competition: string }>();

/** Reproduce a file's exact on-disk serialization so only the intended field changes. */
const VARIANTS: [string, (d: unknown) => string][] = [
  ["CRLF", (d) => JSON.stringify(d, null, 2).replace(/\n/g, "\r\n")],
  ["LF", (d) => JSON.stringify(d, null, 2)],
  ["LF+nl", (d) => JSON.stringify(d, null, 2) + "\n"],
  ["CRLF+nl", (d) => (JSON.stringify(d, null, 2) + "\n").replace(/\n/g, "\r\n")],
];

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
    for (const p of players as { playerId: string; fullName?: string; dateOfBirth: string | null; birthYear: number | null }[]) {
      if (!rosterIds.has(p.playerId)) continue;
      fileOfPlayer.set(p.playerId, { playersPath, competition });
      before.set(p.playerId, { dob: p.dateOfBirth ?? null, year: p.birthYear ?? null, name: p.fullName ?? "", competition });
    }
  }
}

interface Change { playerId: string; player: string; competition: string; field: string; before: string; after: string; status: string; confidence: string; source: string }
const changes: Change[] = [];
const skipped: Change[] = [];
const unresolved: string[] = [];
const nationalityHeld: { playerId: string; player: string; competition: string; club: string; value: string; reason: string; status: string }[] = [];

const loaded = new Map<string, { playerId: string; dateOfBirth: string | null; birthYear: number | null }[]>();
const rawOf = new Map<string, string>();
function load(p: string) {
  if (!loaded.has(p)) { rawOf.set(p, fs.readFileSync(p, "utf8")); loaded.set(p, JSON.parse(rawOf.get(p)!)); }
  return loaded.get(p)!;
}

const touched = new Set<string>();

for (const r of rows) {
  const id = r[H("playerId")];
  const player = r[H("Player")];
  const competition = r[H("Competition")];
  const club = r[H("Club")];
  const target = fileOfPlayer.get(id);
  const prev = before.get(id);

  // playerId is the ONLY join key. No name fallback, ever.
  if (!target || !prev) { unresolved.push(`${player} (${id}, ${competition}/${club}) -- no canonical Division 1 match`); continue; }
  if (target.competition !== competition) { unresolved.push(`${player} (${id}) -- competition mismatch`); continue; }
  if (touched.has(id)) { unresolved.push(`${player} (${id}) -- duplicate research row, skipped`); continue; }
  touched.add(id);

  const data = load(target.playersPath);
  const entry = data.find((x) => x.playerId === id);
  if (!entry) { unresolved.push(`${player} (${id}) -- missing in players file`); continue; }

  const src = r[H("Source1")] ?? "";
  const conf = r[H("Confidence")] ?? "";
  const dobStatus = (r[H("DOBStatus")] ?? "").trim();
  const natStatus = (r[H("NationalityStatus")] ?? "").trim();
  const fDob = (r[H("FinalDOB")] ?? "").trim();
  const fYear = (r[H("FinalBirthYear")] ?? "").trim();
  const fNat = (r[H("FinalNationality")] ?? "").trim();

  // --- dateOfBirth -------------------------------------------------------
  let wroteExactDob = false;
  if (fDob) {
    const rec = (field: string, after: string, reason: string) =>
      skipped.push({ playerId: id, player, competition, field, before: String(prev.dob), after, status: reason, confidence: conf, source: src });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fDob)) rec("dateOfBirth", fDob, "malformed date");
    else if (fDob.endsWith("-01-01")) rec("dateOfBirth", fDob, "suspected fabricated 01-01 placeholder");
    else if (Number.isNaN(Date.parse(`${fDob}T00:00:00Z`)) || new Date(`${fDob}T00:00:00Z`).toISOString().slice(0, 10) !== fDob) rec("dateOfBirth", fDob, "impossible calendar date");
    else if (fDob > GAME_DATE) rec("dateOfBirth", fDob, "future date");
    else if (Number(fDob.slice(0, 4)) < MIN_YEAR || Number(fDob.slice(0, 4)) > MAX_YEAR) rec("dateOfBirth", fDob, `implausible birth year (outside ${MIN_YEAR}-${MAX_YEAR})`);
    else {
      wroteExactDob = true;
      if (fDob !== (prev.dob ?? "")) {
        entry.dateOfBirth = fDob;
        changes.push({ playerId: id, player, competition, field: "dateOfBirth", before: String(prev.dob), after: fDob, status: dobStatus, confidence: conf, source: src });
        // birthYear is DERIVED from the exact DOB, never an independent source.
        const derived = Number(fDob.slice(0, 4));
        if (entry.birthYear !== derived) {
          changes.push({ playerId: id, player, competition, field: "birthYear", before: String(prev.year), after: String(derived), status: "DERIVED_FROM_DOB", confidence: conf, source: src });
          entry.birthYear = derived;
        }
      }
    }
  }

  // --- birthYear (only when no exact DOB is present or being set) ---------
  if (!wroteExactDob && !entry.dateOfBirth && fYear) {
    if (!/^\d{4}$/.test(fYear)) {
      skipped.push({ playerId: id, player, competition, field: "birthYear", before: String(prev.year), after: fYear, status: "malformed year", confidence: conf, source: src });
    } else if (Number(fYear) < MIN_YEAR || Number(fYear) > MAX_YEAR) {
      skipped.push({ playerId: id, player, competition, field: "birthYear", before: String(prev.year), after: fYear, status: `implausible year (outside ${MIN_YEAR}-${MAX_YEAR})`, confidence: conf, source: src });
    } else if (fYear !== String(prev.year ?? "")) {
      entry.birthYear = Number(fYear);
      changes.push({ playerId: id, player, competition, field: "birthYear", before: String(prev.year), after: fYear, status: dobStatus, confidence: conf, source: src });
    }
  }

  // --- nationalities: HELD, never written (see module doc) ----------------
  if (fNat) {
    const parts = fNat.split("/").map((s) => s.trim()).filter(Boolean);
    const unknown = parts.filter((p) => !KNOWN_ISO2.has(p));
    nationalityHeld.push({
      playerId: id, player, competition, club, value: fNat, status: natStatus,
      reason: unknown.length === 0
        ? "ISO-2 and mappable, but held with the rest of the Division 1 nationality set for one consistent decision"
        : `not a known ISO-2 code: ${unknown.join(", ")} (Division 1 rows use ISO-3 while Handbollsligan rows in the same file use ISO-2)`,
    });
  }
}

// --- Write files, preserving each file's exact serialization -------------
const unsafe: string[] = [];
let filesWritten = 0;
for (const [p, data] of loaded) {
  const original = rawOf.get(p)!;
  const style = VARIANTS.find(([, fn]) => fn(JSON.parse(original)) === original);
  if (!style) { unsafe.push(p); continue; }
  const next = style[1](data);
  if (next !== original) { fs.writeFileSync(p, next, "utf8"); filesWritten++; }
}

// --- Report ---------------------------------------------------------------
const tally = (comp: string, field: string) => changes.filter((c) => c.competition === comp && c.field === field).length;
console.log("=== DIVISION 1 BIO IMPORT (Norra + Sodra only) ===");
console.log(`research rows in scope: ${rows.length}   matched canonical players: ${touched.size}`);
console.log(`files written: ${filesWritten}`);
for (const comp of IN_SCOPE.keys()) {
  console.log(`\n${comp}`);
  console.log(`  dateOfBirth updated:       ${tally(comp, "dateOfBirth")}`);
  console.log(`  birthYear updated:         ${tally(comp, "birthYear")}`);
  console.log(`  nationalities updated:     0 (HELD -- see ${path.basename(NAT_HOLD_OUT)})`);
  console.log(`  positions updated:         0 (out of scope)`);
  console.log(`  CA/PA updated:             0 (already imported)`);
}
const dobWrites = changes.filter((c) => c.field === "dateOfBirth").length;
const derived = changes.filter((c) => c.status === "DERIVED_FROM_DOB").length;
const yearOnly = changes.filter((c) => c.field === "birthYear" && c.status !== "DERIVED_FROM_DOB").length;
console.log(`\ntotal field writes: ${changes.length}  (exact DOB ${dobWrites}, birthYear derived from DOB ${derived}, birthYear-only ${yearOnly})`);
console.log(`distinct players modified: ${new Set(changes.map((c) => c.playerId)).size}`);
console.log(`\nskipped (refused) values: ${skipped.length}`);
for (const s of skipped) console.log(`  ${s.player} ${s.field}: ${s.after} -- ${s.status}`);
console.log(`\nunresolved: ${unresolved.length}`);
for (const u of unresolved) console.log(`  ${u}`);
console.log(`\nnationality rows HELD (not written): ${nationalityHeld.length}`);
if (unsafe.length) { console.log(`\nNOT byte-reproducible, SKIPPED:`); unsafe.forEach((u) => console.log(`  ${u}`)); }

const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
fs.writeFileSync(REPORT_OUT,
  ["playerId,Player,Competition,Field,Before,After,Status,Confidence,Source",
    ...changes.map((c) => [c.playerId, c.player, c.competition, c.field, c.before, c.after, c.status, c.confidence, c.source].map(q).join(","))].join("\n") + "\n", "utf8");
fs.writeFileSync(NAT_HOLD_OUT,
  ["playerId,Player,Competition,Club,ResearchNationality,NationalityStatus,HeldReason",
    ...nationalityHeld.map((n) => [n.playerId, n.player, n.competition, n.club, n.value, n.status, n.reason].map(q).join(","))].join("\n") + "\n", "utf8");
console.log(`\nchange log:        ${path.basename(REPORT_OUT)}`);
console.log(`nationality hold:  ${path.basename(NAT_HOLD_OUT)}`);
