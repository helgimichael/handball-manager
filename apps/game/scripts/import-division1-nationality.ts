// Imports the researched NATIONALITIES for Swedish Division 1 Norra + Sodra
// from SWEDISH_PLAYER_BIO_MASTER_v4.2_DIV1_S_PASS5.
//
// These 43 values were held back by import-division1-bio.ts because the
// Division 1 rows emit ISO-3 codes ("SWE", "NOR", "IRL") while the SAME
// research file uses ISO-2 for Handbollsligan ("SE", "NO") -- and canonical
// `nationalities` is ISO-2, keyed by gameWorldAdapter's ISO_TO_NATION_CODE.
// Writing ISO-3 verbatim would resolve to UNK.
//
// HM-DIV1-NATIONALITY-1.0 authorises a NARROW, EXPLICIT normalisation at the
// import boundary only. This is a property of THIS research source's output
// format, not a change to how the game represents nationality: canonical data
// stays ISO-2 everywhere, and nothing downstream learns about ISO-3.
//
// Deliberately NOT a generic ISO-3 -> ISO-2 converter. Only the three codes
// this source actually emits are accepted; every other unrecognised value
// aborts the whole import rather than being guessed at.
//
// Ireland itself is supported properly in the model (NationCode "IRL",
// ISO_TO_NATION_CODE IE -> IRL, NATION_LABEL_SV IRL -> "Irland") -- not
// special-cased here.
//
// SCOPE: Division 1 Norra + Sodra only. Writes ONLY `nationalities`.
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
const REPORT_OUT = path.join(REPO, "exports/player-rating-research/DIV1_NATIONALITY_IMPORT_REPORT.csv");

const IN_SCOPE = new Map<string, string>([
  ["Division 1 Norra", "division1-norra"],
  ["Division 1 Sodra", "division1-sodra"],
]);

/** Only a nationality the research marks VERIFIED may be written. */
const ACCEPTED_STATUS = new Set(["VERIFIED"]);

/**
 * The ISO-2 codes the game can resolve today -- a literal mirror of
 * gameWorldAdapter's ISO_TO_NATION_CODE keys. An imported code outside this
 * set would resolve to UNK, so it aborts instead.
 */
const KNOWN_ISO2 = new Set([
  "SE", "DK", "NO", "DE", "ES", "HU", "SI", "IS", "FO", "IT", "QA", "NL", "PT", "AT", "CH", "PL",
  "FR", "RS", "HR", "BA", "FI", "AR", "LT", "RO", "DZ", "EE", "XK", "GB", "CL", "US", "IE",
]);

/** The ONLY ISO-3 spellings this research source emits. Not a general table. */
const AUTHORISED_ISO3_TO_ISO2: Record<string, string> = {
  SWE: "SE",
  NOR: "NO",
  IRL: "IE",
};

/** Normalises one token, or throws -- never guesses. */
function normaliseToken(token: string, context: string): string {
  if (KNOWN_ISO2.has(token)) return token;                       // already ISO-2, left alone
  const mapped = AUTHORISED_ISO3_TO_ISO2[token];
  if (mapped) {
    if (!KNOWN_ISO2.has(mapped)) throw new Error(`normalised ${token} -> ${mapped}, which the game cannot resolve (${context})`);
    return mapped;
  }
  throw new Error(
    `unrecognised nationality code ${JSON.stringify(token)} (${context}). ` +
    `Authorised ISO-3 inputs: ${Object.keys(AUTHORISED_ISO3_TO_ISO2).join(", ")}. ` +
    `Add an explicit mapping (and the NationCode/ISO/label entries it needs) rather than guessing.`,
  );
}

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

// --- Canonical index (Division 1, on a roster) ---
interface Target { playersPath: string; competition: string }
const fileOfPlayer = new Map<string, Target>();
const before = new Map<string, { nat: string[] | null; name: string }>();

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
    const rosterIds = new Set(JSON.parse(fs.readFileSync(path.join(clubDir, rf), "utf8")).map((x: { playerId: string }) => x.playerId));
    for (const p of players as { playerId: string; fullName?: string; nationalities: string[] | null }[]) {
      if (!rosterIds.has(p.playerId)) continue;
      fileOfPlayer.set(p.playerId, { playersPath, competition });
      before.set(p.playerId, { nat: p.nationalities ?? null, name: p.fullName ?? "" });
    }
  }
}

interface Change { playerId: string; player: string; competition: string; researchValue: string; normalised: string; before: string; after: string; status: string; confidence: string; source: string }
const changes: Change[] = [];
const skipped: string[] = [];
const unresolved: string[] = [];

const loaded = new Map<string, { playerId: string; nationalities: string[] | null }[]>();
const rawOf = new Map<string, string>();
function load(p: string) {
  if (!loaded.has(p)) { rawOf.set(p, fs.readFileSync(p, "utf8")); loaded.set(p, JSON.parse(rawOf.get(p)!)); }
  return loaded.get(p)!;
}

const touched = new Set<string>();
let considered = 0;

for (const r of rows) {
  const fNat = (r[H("FinalNationality")] ?? "").trim();
  if (!fNat) continue;
  considered++;

  const id = r[H("playerId")];
  const player = r[H("Player")];
  const competition = r[H("Competition")];
  const status = (r[H("NationalityStatus")] ?? "").trim();

  if (!ACCEPTED_STATUS.has(status)) { skipped.push(`${player} (${id}) -- NationalityStatus=${status || "(blank)"}, not accepted`); continue; }

  // playerId is the ONLY join key.
  const target = fileOfPlayer.get(id);
  const prev = before.get(id);
  if (!target || !prev) { unresolved.push(`${player} (${id}, ${competition}) -- no canonical Division 1 match`); continue; }
  if (target.competition !== competition) { unresolved.push(`${player} (${id}) -- competition mismatch`); continue; }
  if (touched.has(id)) { unresolved.push(`${player} (${id}) -- duplicate research row`); continue; }
  touched.add(id);

  const normalised = fNat.split("/").map((s) => s.trim()).filter(Boolean)
    .map((t) => normaliseToken(t, `${player} / ${competition}`));   // throws on anything unknown
  if (new Set(normalised).size !== normalised.length) throw new Error(`duplicate nationality codes for ${player}: ${fNat}`);

  const data = load(target.playersPath);
  const entry = data.find((x) => x.playerId === id);
  if (!entry) { unresolved.push(`${player} (${id}) -- missing in players file`); continue; }

  const prevJoined = (prev.nat ?? []).join("/");
  const nextJoined = normalised.join("/");
  if (prevJoined === nextJoined) { skipped.push(`${player} (${id}) -- already ${nextJoined}`); continue; }

  entry.nationalities = normalised;
  changes.push({
    playerId: id, player, competition, researchValue: fNat, normalised: nextJoined,
    before: prevJoined || "(none)", after: nextJoined, status,
    confidence: (r[H("Confidence")] ?? "").trim(), source: r[H("Source1")] ?? "",
  });
}

// --- Write, preserving each file's exact serialization ---
const unsafe: string[] = [];
let filesWritten = 0;
for (const [p, data] of loaded) {
  const original = rawOf.get(p)!;
  const style = VARIANTS.find(([, fn]) => fn(JSON.parse(original)) === original);
  if (!style) { unsafe.push(p); continue; }
  const next = style[1](data);
  if (next !== original) { fs.writeFileSync(p, next, "utf8"); filesWritten++; }
}

console.log("=== DIVISION 1 NATIONALITY IMPORT (Norra + Sodra only) ===");
console.log(`research rows with a FinalNationality: ${considered}`);
console.log(`written: ${changes.length}   skipped: ${skipped.length}   unresolved: ${unresolved.length}`);
console.log(`files written: ${filesWritten}`);

const byNorm = new Map<string, number>();
for (const c of changes) byNorm.set(`${c.researchValue} -> ${c.normalised}`, (byNorm.get(`${c.researchValue} -> ${c.normalised}`) ?? 0) + 1);
console.log(`\nnormalisation applied:`);
for (const [k, v] of [...byNorm].sort((a, b) => b[1] - a[1])) console.log(`   ${k.padEnd(20)} ${v}`);

for (const s of skipped) console.log(`  SKIP ${s}`);
for (const u of unresolved) console.log(`  UNRESOLVED ${u}`);
if (unsafe.length) { console.log(`\nNOT byte-reproducible, SKIPPED:`); unsafe.forEach((u) => console.log(`  ${u}`)); }

const q = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
fs.writeFileSync(REPORT_OUT,
  ["playerId,Player,Competition,ResearchValue,Normalised,Before,After,NationalityStatus,Confidence,Source",
    ...changes.map((c) => [c.playerId, c.player, c.competition, c.researchValue, c.normalised, c.before, c.after, c.status, c.confidence, c.source].map(q).join(","))].join("\n") + "\n", "utf8");
console.log(`\nchange log: ${path.basename(REPORT_OUT)}`);
