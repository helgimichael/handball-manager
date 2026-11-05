import fs from "node:fs";
import path from "node:path";
import { CLUBS, getClub, getCompetition, COMPETITIONS } from "../lib/game-data";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../lib/gameWorld/serverSnapshot";

const APP_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(APP_DIR, "../..");
const DATA_ROOT = path.join(REPO_ROOT, "data/real-world");
const SWEDEN_DIR = path.join(DATA_ROOT, "sweden/2026-27");
const INTL_DIR = path.join(DATA_ROOT, "international/2026-27");
const RESEARCH_DIR = path.join(REPO_ROOT, "exports/player-rating-research");

interface RawPlayer {
  playerId: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  aliases?: string[];
  dateOfBirth?: string | null;
  birthYear?: number | null;
  nationalities?: string[] | null;
  heightCm?: number | null;
  handedness?: string | null;
  recordConfidence?: string;
  sourceRefs?: Record<string, string[]>;
  dataNotes?: string[];
}

interface RawRosterEntry {
  rosterEntryId?: string;
  playerId: string;
  clubId: string;
  competitionId: string;
  season?: string;
  snapshotDate?: string;
  shirtNumber?: number | null;
  sourcePosition?: string;
  primaryPosition: string;
  secondaryPositions?: string[];
  rosterStatus?: string;
  contract?: {
    untilDate?: string | null;
    untilSeason?: string | null;
    optionUntilSeason?: string | null;
  };
  rosterConfidence?: string;
  sourceRefs?: Record<string, string[]>;
  defaultSquadStatus?: string;
  specialTags?: string[];
}

interface RawSource {
  sourceId: string;
  sourceType: string;
  publisher?: string;
  title?: string;
  url?: string;
  accessedAt?: string;
  seasonContext?: string;
}

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header: string[] = [];
  let cur = "";
  let inQ = false;
  for (const c of lines[0]) {
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { header.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  header.push(cur.trim());

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row: string[] = [];
    cur = "";
    inQ = false;
    for (const c of lines[i]) {
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { row.push(cur); cur = ""; }
      else cur += c;
    }
    row.push(cur);
    const obj: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = row[j] ?? "";
    }
    rows.push(obj);
  }
  return rows;
}

export function runInventory() {
  console.log("=== HANDBALL MANAGER: PLAYER DATABASE AUDIT & INVENTORY 2026/27 ===");

  // 1. Load Master Bio Research
  const masterBioPath = path.join(RESEARCH_DIR, "SWEDISH_PLAYER_BIO_MASTER_v3.1.csv");
  const masterBioRows = fs.existsSync(masterBioPath) ? parseCsv(fs.readFileSync(masterBioPath, "utf8")) : [];
  console.log(`Loaded Master Bio Research: ${masterBioRows.length} Swedish players`);
  const masterBioMap = new Map<string, Record<string, string>>();
  for (const row of masterBioRows) {
    if (row.playerId) masterBioMap.set(row.playerId, row);
  }

  // 2. Load World Pool Research
  const worldPoolPath = path.join(RESEARCH_DIR, "WORLD_POOL_FINAL_RATING_RESEARCH_v1.csv");
  const worldPoolRows = fs.existsSync(worldPoolPath) ? parseCsv(fs.readFileSync(worldPoolPath, "utf8")) : [];
  console.log(`Loaded World Pool Research: ${worldPoolRows.length} international players`);
  const worldPoolMap = new Map<string, Record<string, string>>();
  for (const row of worldPoolRows) {
    if (row.playerId) worldPoolMap.set(row.playerId, row);
  }

  // 3. Load Profixio Registrations from existing reports
  const allsvPfxPath = path.join(REPO_ROOT, "C:/DEV/QA/reports/HM-DATA-1.0/profixio-squads-2026-10-31.json");
  const allsvPfx: any[] = fs.existsSync(allsvPfxPath) ? JSON.parse(fs.readFileSync(allsvPfxPath, "utf8")) : [];
  console.log(`Loaded Profixio Allsvenskan Squads: ${allsvPfx.length} registrations`);

  const div1PfxPath = path.join(REPO_ROOT, "C:/DEV/QA/reports/HM-DATA-1.5/division1-profixio-squads-2026-10-31.json");
  const div1Pfx: any[] = fs.existsSync(div1PfxPath) ? JSON.parse(fs.readFileSync(div1PfxPath, "utf8")) : [];
  console.log(`Loaded Profixio Division 1 Squads: ${div1Pfx.length} registrations`);

  // Build unified Profixio Map by playerId / name
  const pfxByPlayerNameAndDob = new Map<string, any[]>();
  const pfxByFullName = new Map<string, any[]>();
  for (const p of [...allsvPfx, ...div1Pfx]) {
    const fn = (p.fullName || `${p.firstName || ""} ${p.lastName || ""}`).trim().toLowerCase();
    const dob = p.dateOfBirth || "";
    if (fn) {
      if (!pfxByFullName.has(fn)) pfxByFullName.set(fn, []);
      pfxByFullName.get(fn)!.push(p);
      if (dob) {
        const key = `${fn}|${dob}`;
        if (!pfxByPlayerNameAndDob.has(key)) pfxByPlayerNameAndDob.set(key, []);
        pfxByPlayerNameAndDob.get(key)!.push(p);
      }
    }
  }

  // 4. Scan all real-world player files on disk
  interface CanonicalPlayerRecord {
    playerId: string;
    fullName: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    birthYear: string;
    nationality: string;
    secondaryNationality: string;
    heightCm: string;
    clubId: string;
    clubName: string;
    competitionId: string;
    competitionName: string;
    country: string;
    tier: string;
    primaryPosition: string;
    secondaryPositions: string[];
    shirtNumber: string;
    rosterStatus: string;
    recordConfidence: string;
    rosterConfidence: string;
    sourceReferences: string[];
    isFictional: boolean;
    verificationStatus: string;
    notes: string[];
    masterBio?: Record<string, string>;
    worldPool?: Record<string, string>;
  }

  const players: CanonicalPlayerRecord[] = [];
  const sourcesMap = new Map<string, RawSource>();

  // Function to process a league directory
  function processLeagueDir(leaguePath: string, defaultCompId: string, country: string, tier: string) {
    if (!fs.existsSync(leaguePath)) return;
    const clubDirs = fs.readdirSync(leaguePath, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "ratings" && d.name !== "identity" && d.name !== "fixtures");

    for (const clubDir of clubDirs) {
      const fullClubPath = path.join(leaguePath, clubDir.name);
      const files = fs.readdirSync(fullClubPath);

      // Find players, roster, sources files
      const playersFile = files.find((f) => f.startsWith("players-") && f.endsWith(".json"));
      const rosterFile = files.find((f) => f.startsWith("roster-") && f.endsWith(".json"));
      const sourcesFile = files.find((f) => f.startsWith("sources-") && f.endsWith(".json"));

      if (!playersFile || !rosterFile) continue;

      const rawPlayers: RawPlayer[] = JSON.parse(fs.readFileSync(path.join(fullClubPath, playersFile), "utf8"));
      const rawRoster: RawRosterEntry[] = JSON.parse(fs.readFileSync(path.join(fullClubPath, rosterFile), "utf8"));
      const rawSources: RawSource[] = sourcesFile ? JSON.parse(fs.readFileSync(path.join(fullClubPath, sourcesFile), "utf8")) : [];

      for (const src of rawSources) {
        sourcesMap.set(src.sourceId, src);
      }

      const rosterByPlayerId = new Map<string, RawRosterEntry>();
      for (const r of rawRoster) {
        rosterByPlayerId.set(r.playerId, r);
      }

      for (const p of rawPlayers) {
        const r = rosterByPlayerId.get(p.playerId);
        const clubId = r?.clubId ?? "unknown";
        const clubObj = getClub(clubId);
        const compId = r?.competitionId ?? defaultCompId;
        const compObj = getCompetition(compId);

        const fullName = p.fullName || `${p.firstName || ""} ${p.lastName || ""}`.trim();
        const dob = p.dateOfBirth || "";
        const birthYear = p.birthYear ? String(p.birthYear) : dob ? dob.slice(0, 4) : "";
        const nats = p.nationalities || [];
        const nat = nats[0] || (country === "SWE" ? "SE" : country);
        const secNat = nats[1] || "";

        // Collect all source IDs
        const srcRefsSet = new Set<string>();
        if (p.sourceRefs) {
          for (const list of Object.values(p.sourceRefs)) {
            for (const s of list) srcRefsSet.add(s);
          }
        }
        if (r?.sourceRefs) {
          for (const list of Object.values(r.sourceRefs)) {
            for (const s of list) srcRefsSet.add(s);
          }
        }

        const bio = masterBioMap.get(p.playerId);
        const wp = worldPoolMap.get(p.playerId);

        // Determine verification status
        let status = "UNVERIFIED_2026_27";
        if (r?.rosterStatus === "CONFIRMED" || r?.rosterConfidence === "VERIFIED" || bio?.Confidence === "High") {
          status = "VERIFIED_ACTIVE_2026_27";
        } else if (wp && wp["Research Status"] === "FINAL") {
          status = "VERIFIED_ACTIVE_2026_27";
        } else if (bio && (bio.DOBStatus === "EXACT_VERIFIED" || bio.DOBStatus === "UNCHANGED_VERIFIED" || bio.DOBStatus === "BIRTH_YEAR_VERIFIED")) {
          status = "VERIFIED_ACTIVE_2026_27";
        }

        players.push({
          playerId: p.playerId,
          fullName,
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          dateOfBirth: dob,
          birthYear,
          nationality: nat,
          secondaryNationality: secNat,
          heightCm: p.heightCm ? String(p.heightCm) : "",
          clubId,
          clubName: clubObj?.name || clubDir.name,
          competitionId: compId,
          competitionName: compObj?.name || compId,
          country,
          tier,
          primaryPosition: r?.primaryPosition || "M9",
          secondaryPositions: r?.secondaryPositions || [],
          shirtNumber: r?.shirtNumber !== null && r?.shirtNumber !== undefined ? String(r?.shirtNumber) : "",
          rosterStatus: r?.rosterStatus || "UNKNOWN",
          recordConfidence: p.recordConfidence || "UNVERIFIED",
          rosterConfidence: r?.rosterConfidence || "UNVERIFIED",
          sourceReferences: [...srcRefsSet],
          isFictional: false,
          verificationStatus: status,
          notes: p.dataNotes || [],
          masterBio: bio,
          worldPool: wp,
        });
      }
    }
  }

  // Scan Swedish leagues
  processLeagueDir(path.join(SWEDEN_DIR, "handbollsligan"), "se_handbollsligan_herr", "SWE", "1");
  processLeagueDir(path.join(SWEDEN_DIR, "allsvenskan"), "swe-2", "SWE", "2");
  processLeagueDir(path.join(SWEDEN_DIR, "division1-norra"), "se_division1_norra", "SWE", "3");
  processLeagueDir(path.join(SWEDEN_DIR, "division1-sodra"), "se_division1_sodra", "SWE", "3");

  // Scan International leagues
  if (fs.existsSync(INTL_DIR)) {
    const intlComps = fs.readdirSync(INTL_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const compDir of intlComps) {
      processLeagueDir(path.join(INTL_DIR, compDir.name), compDir.name, compDir.name.split("_")[0].toUpperCase(), "1");
    }
  }

  console.log(`Total canonical real players indexed: ${players.length}`);

  // Summary by league
  const byComp: Record<string, number> = {};
  for (const p of players) {
    byComp[p.competitionId] = (byComp[p.competitionId] || 0) + 1;
  }
  console.log("Player count by competition:", byComp);

  // Check name collisions
  const byName = new Map<string, CanonicalPlayerRecord[]>();
  for (const p of players) {
    const key = p.fullName.toLowerCase().trim();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(p);
  }
  const collisions = [...byName.entries()].filter(([_, list]) => list.length > 1);
  console.log(`Name collisions found: ${collisions.length}`);
  for (const [name, list] of collisions) {
    console.log(`  - "${name}": ${list.map((p) => `${p.playerId} (${p.clubName}, ${p.primaryPosition}, DOB: ${p.dateOfBirth || p.birthYear || 'unknown'})`).join(" vs ")}`);
  }

  return { players, sourcesMap, collisions, masterBioMap, worldPoolMap };
}

if (require.main === module || process.argv[1]?.endsWith("inventory-player-database.ts")) {
  runInventory();
}
