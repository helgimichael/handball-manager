// Exports the complete canonical Swedish player population (Handbollsligan,
// Herrallsvenskan, Division 1 Norra, Division 1 Sodra) as a research
// worksheet: SWEDISH_PLAYER_BIO_MASTER_v1.csv.
//
// READ-ONLY. Reads the raw canonical JSON (players-*.json + roster-*.json)
// directly rather than the derived gameplay snapshot, because the gameplay
// `nationality` field applies a fallback for players with no researched
// nationality -- that fallback must never be presented here as if it were
// real source data. A player with no raw `nationalities` entry exports an
// EMPTY CurrentNationality.
//
// Every Final*/Status/Confidence/Source column is intentionally left blank:
// this file is the input to an external research pass, not its output.
import * as fs from "node:fs";
import * as path from "node:path";

const REPO = "C:/Users/helgi/Documents/STARKVIS-HELA/handball-manager";
const SWEDEN_ROOT = path.join(REPO, "data/real-world/sweden/2026-27");
const OUT_PATH = path.join(REPO, "exports/player-rating-research/SWEDISH_PLAYER_BIO_MASTER_v1.csv");

const COMPETITIONS: { dir: string; competitionId: string; competition: string }[] = [
  { dir: "handbollsligan", competitionId: "se_handbollsligan_herr", competition: "Handbollsligan" },
  { dir: "allsvenskan", competitionId: "swe-2", competition: "Herrallsvenskan" },
  { dir: "division1-norra", competitionId: "se_division1_norra", competition: "Division 1 Norra" },
  { dir: "division1-sodra", competitionId: "se_division1_sodra", competition: "Division 1 Sodra" },
];

interface PlayerIdentity {
  playerId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  nationalities: string[] | null;
}

interface RosterEntry {
  playerId: string;
  clubId: string;
  rosterStatus: string;
  primaryPosition: string;
  secondaryPositions?: string[];
}

interface QcFile {
  clubId?: string;
  clubName?: string;
}

interface Row {
  playerId: string;
  player: string;
  competitionId: string;
  competition: string;
  clubId: string;
  club: string;
  currentNationality: string;
  currentDob: string;
  currentBirthYear: string;
  currentPrimaryPosition: string;
  currentSecondaryPositions: string;
  rosterStatus: string;
}

const rows: Row[] = [];
const perCompetition = new Map<string, number>();

for (const comp of COMPETITIONS) {
  const compDir = path.join(SWEDEN_ROOT, comp.dir);
  if (!fs.existsSync(compDir)) {
    console.error(`STOP: competition directory missing: ${compDir}`);
    process.exit(1);
  }

  let compCount = 0;
  for (const dirent of fs.readdirSync(compDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const clubDir = path.join(compDir, dirent.name);
    const files = fs.readdirSync(clubDir);
    const playersFile = files.find((f) => f.startsWith("players-") && f.endsWith(".json"));
    const rosterFile = files.find((f) => f.startsWith("roster-") && f.endsWith(".json"));
    const qcFile = files.find((f) => f.startsWith("qc-") && f.endsWith(".json"));
    // Non-club subdirectories (e.g. shared "ratings"/"identity" folders) carry no roster.
    if (!playersFile || !rosterFile) continue;

    const players: PlayerIdentity[] = JSON.parse(fs.readFileSync(path.join(clubDir, playersFile), "utf8"));
    const roster: RosterEntry[] = JSON.parse(fs.readFileSync(path.join(clubDir, rosterFile), "utf8"));
    const qc: QcFile = qcFile ? JSON.parse(fs.readFileSync(path.join(clubDir, qcFile), "utf8")) : {};

    const identityById = new Map(players.map((p) => [p.playerId, p]));

    // The roster is the population source of truth: a person belongs to the
    // competition because they hold a current-season roster entry, not merely
    // because an identity record exists in the club folder.
    for (const entry of roster) {
      const identity = identityById.get(entry.playerId);
      if (!identity) {
        console.error(`STOP: roster entry ${entry.playerId} in ${clubDir} has no matching identity record.`);
        process.exit(1);
      }

      const name =
        identity.fullName ??
        [identity.firstName, identity.lastName].filter(Boolean).join(" ");

      rows.push({
        playerId: entry.playerId,
        player: name,
        competitionId: comp.competitionId,
        competition: comp.competition,
        clubId: entry.clubId || qc.clubId || "",
        club: qc.clubName ?? dirent.name,
        // Raw source only -- an absent list stays empty, never a fallback value.
        currentNationality: identity.nationalities && identity.nationalities.length > 0 ? identity.nationalities.join("/") : "",
        currentDob: identity.dateOfBirth ?? "",
        currentBirthYear: identity.birthYear != null ? String(identity.birthYear) : "",
        currentPrimaryPosition: entry.primaryPosition ?? "",
        currentSecondaryPositions: (entry.secondaryPositions ?? []).join("/"),
        rosterStatus: entry.rosterStatus ?? "",
      });
      compCount++;
    }
  }
  perCompetition.set(comp.competition, compCount);
}

// --- Integrity checks ---
const ids = rows.map((r) => r.playerId);
const uniqueIds = new Set(ids);
const duplicates = ids.length - uniqueIds.size;
const duplicateIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];

// --- Write CSV ---
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const header = [
  "playerId", "Player", "competitionId", "Competition", "clubId", "Club",
  "CurrentNationality", "CurrentDOB", "CurrentBirthYear", "CurrentPrimaryPosition", "CurrentSecondaryPositions",
  "RosterStatus",
  "FinalNationality", "FinalDOB", "FinalBirthYear", "FinalPrimaryPosition", "FinalSecondaryPositions",
  "NationalityStatus", "DOBStatus", "PositionStatus",
  "Confidence", "Source1", "Source2", "ResearchNote",
];

const lines = [header.join(",")];
for (const r of rows) {
  lines.push([
    r.playerId, r.player, r.competitionId, r.competition, r.clubId, r.club,
    r.currentNationality, r.currentDob, r.currentBirthYear, r.currentPrimaryPosition, r.currentSecondaryPositions,
    r.rosterStatus,
    "", "", "", "", "",   // Final* -- deliberately blank
    "", "", "",           // *Status -- deliberately blank
    "", "", "", "",       // Confidence / Source1 / Source2 / ResearchNote -- deliberately blank
  ].map(csvField).join(","));
}
fs.writeFileSync(OUT_PATH, lines.join("\n") + "\n", "utf8");

// --- Report ---
console.log(`=== SWEDISH_PLAYER_BIO_MASTER_v1.csv ===`);
console.log(`total exported players: ${rows.length}`);
for (const comp of COMPETITIONS) {
  console.log(`  ${comp.competition}: ${perCompetition.get(comp.competition) ?? 0}`);
}
console.log(`\nunique playerIds: ${uniqueIds.size}`);
console.log(`duplicate playerIds: ${duplicates}`);
if (duplicateIds.length > 0) console.log(`  duplicates: ${duplicateIds.join(", ")}`);

const dobExact = rows.filter((r) => r.currentDob).length;
const yearOnly = rows.filter((r) => !r.currentDob && r.currentBirthYear).length;
const natPresent = rows.filter((r) => r.currentNationality).length;
const posPresent = rows.filter((r) => r.currentPrimaryPosition).length;
console.log(`\nCurrent DOB exact:            ${dobExact}`);
console.log(`Current birthYear-only:       ${yearOnly}`);
console.log(`Current nationality present:  ${natPresent}`);
console.log(`Current primaryPosition present: ${posPresent}`);

const statusCounts = new Map<string, number>();
for (const r of rows) statusCounts.set(r.rosterStatus, (statusCounts.get(r.rosterStatus) ?? 0) + 1);
console.log(`\nRosterStatus breakdown:`, Object.fromEntries([...statusCounts.entries()].sort()));

console.log(`\nunique playerIds === total rows: ${uniqueIds.size === rows.length}`);
console.log(`duplicates === 0: ${duplicates === 0}`);
if (uniqueIds.size !== rows.length || duplicates !== 0) {
  console.error(`FAILED integrity invariants.`);
  process.exit(1);
}
