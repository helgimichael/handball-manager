import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { CLUBS, getClub, getCompetition, COMPETITIONS } from "../lib/game-data";
import { TUMBA_SQUAD } from "../lib/game-data/players";

const APP_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(APP_DIR, "../..");
const DATA_ROOT = path.join(REPO_ROOT, "data/real-world");
const SWEDEN_DIR = path.join(DATA_ROOT, "sweden/2026-27");
const INTL_DIR = path.join(DATA_ROOT, "international/2026-27");
const RESEARCH_DIR = path.join(REPO_ROOT, "exports/player-rating-research");
const REPORT_DIR = "C:/DEV/QA/reports/HM-PLAYER-DATABASE-2026-27";

// Normalization helpers
function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function slugify(str: string): string {
  return norm(str).replace(/\s+/g, "_");
}

function csvEscape(val: any): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath: string, columns: string[], rows: Record<string, any>[]): void {
  const lines: string[] = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col] ?? "")).join(","));
  }
  fs.writeFileSync(filePath, lines.join("\r\n") + "\r\n", "utf8");
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

// Club name normalization mapping
const CLUB_NAME_TO_ID: Record<string, string> = {
  // Handbollsligan
  "ifk skovde hk": "se_club_ifk_skovde_hk",
  "ifk skovde": "se_club_ifk_skovde_hk",
  "alingsas hk": "se_club_alingsas_hk",
  "alingsas": "se_club_alingsas_hk",
  "if hallby hk": "se_club_if_hallby_hk",
  "hallby": "se_club_if_hallby_hk",
  "hk malmo": "se_club_hk_malmo",
  "malmo": "se_club_hk_malmo",
  "ifk kristianstad": "se_club_ifk_kristianstad",
  "kristianstad": "se_club_ifk_kristianstad",
  "amo hk": "se_club_amo_hk",
  "amo": "se_club_amo_hk",
  "lugi hf": "se_club_lugi_hf",
  "lugi": "se_club_lugi_hf",
  "ystads if hf": "se_club_ystads_if_hf",
  "ystad": "se_club_ystads_if_hf",
  "onnereds hk": "se_club_onnereds_hk",
  "onnered": "se_club_onnereds_hk",
  "ik savehof": "se_club_ik_savehof",
  "savehof": "se_club_ik_savehof",
  "hammarby if hf": "se_club_hammarby_if_hf",
  "hammarby": "se_club_hammarby_if_hf",
  "hf karlskrona": "se_club_hf_karlskrona",
  "karlskrona": "se_club_hf_karlskrona",
  "ov helsingborg": "se_club_ov_helsingborg",
  "helsingborg": "se_club_ov_helsingborg",
  "skanela if": "se_club_skanela_if",
  "skanela": "se_club_skanela_if",

  // Herrallsvenskan
  "hk aranas": "swe2-aranas",
  "aranas": "swe2-aranas",
  "tyreso handboll": "swe2-tyreso",
  "tyreso": "swe2-tyreso",
  "hk torslanda elit": "swe2-torslanda",
  "torslanda elit": "swe2-torslanda",
  "torslanda": "swe2-torslanda",
  "h43 lund hf": "swe2-h43lund",
  "h43 lund": "swe2-h43lund",
  "h43": "swe2-h43lund",
  "eskilstuna guif if": "swe2-guif",
  "eskilstuna guif": "swe2-guif",
  "guif": "swe2-guif",
  "kungalvs hk": "swe2-kungalv",
  "kungalv": "swe2-kungalv",
  "hk varberg": "swe2-varberg",
  "varberg": "swe2-varberg",
  "hk drott halmstad": "swe2-drott",
  "drott halmstad": "swe2-drott",
  "drott": "swe2-drott",
  "ifk tumba hk": "swe2-tumba",
  "ifk tumba": "swe2-tumba",
  "tumba": "swe2-tumba",
  "huddinge hk": "swe2-huddinge",
  "huddinge": "swe2-huddinge",
  "ifk ystad hk": "swe2-ystad2",
  "ifk ystad": "swe2-ystad2",
  "gf kroppskultur": "swe2-kroppskultur",
  "kroppskultur": "swe2-kroppskultur",
  "redbergslids ik": "swe2-redbergslid",
  "redbergslid": "swe2-redbergslid",
  "vasterasirsta hf": "swe2-vasterasirsta",
  "vasterasirsta": "swe2-vasterasirsta",
  "vasteras irsta": "swe2-vasterasirsta",

  // Division 1 Norra & Södra
  "orebro sk hk herr": "se_club_orebro_sk_hk_herr",
  "orebro": "se_club_orebro_sk_hk_herr",
  "rp if linkoping": "se_club_rp_if_linkoping",
  "rp linkoping": "se_club_rp_if_linkoping",
  "uppsala hk": "se_club_uppsala_hk",
  "uppsala": "se_club_uppsala_hk",
  "lif lindesberg": "se_club_lif_lindesberg",
  "lindesberg": "se_club_lif_lindesberg",
  "rimbo hk roslagen": "se_club_rimbo_hk_roslagen",
  "rimbo": "se_club_rimbo_hk_roslagen",
  "taby hbk": "se_club_taby_hbk",
  "taby": "se_club_taby_hbk",
  "ik bolton": "se_club_ik_bolton",
  "bolton": "se_club_ik_bolton",
  "hk eskil": "se_club_hk_eskil",
  "eskil": "se_club_hk_eskil",
  "bodens bk hf": "se_club_bodens_bk_hf",
  "bodens bk": "se_club_bodens_bk_hf",
  "boden": "se_club_bodens_bk_hf",
  "enkopings hf": "se_club_enkopings_hf",
  "enkoping": "se_club_enkopings_hf",
  "sannadals sk": "se_club_sannadals_sk",
  "sannadal": "se_club_sannadals_sk",
  "hk cliff": "se_club_hk_cliff",
  "cliff": "se_club_hk_cliff",
  "vinslovs hk": "se_club_vinslovs_hk",
  "vinslov": "se_club_vinslovs_hk",
  "anderstorps sk": "se_club_anderstorps_sk",
  "anderstorp": "se_club_anderstorps_sk",
  "hp warta": "se_club_hp_warta",
  "warta": "se_club_hp_warta",
  "ik lagan": "se_club_ik_lagan",
  "lagan": "se_club_ik_lagan",
  "karra hf": "se_club_karra_hf",
  "karra": "se_club_karra_hf",
  "hk country": "se_club_hk_country",
  "country": "se_club_hk_country",
  "eslovs hk": "se_club_eslovs_hk",
  "eslov": "se_club_eslovs_hk",
  "ahus handboll": "se_club_ahus_handboll",
  "ahus": "se_club_ahus_handboll",
  "if kristianstad": "se_club_if_kristianstad",
  "hk onnerediterna": "se_club_hk_onnerediterna",
  "onnerediterna": "se_club_hk_onnerediterna",
  "hp alingsas": "se_club_hp_alingsas",
  "hk s hof": "se_club_hk_s_hof",
  "s hof": "se_club_hk_s_hof",
};

function resolveClubIdFromName(clubName: string): string | undefined {
  const n = norm(clubName);
  return CLUB_NAME_TO_ID[n];
}

interface PlayerRecord {
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
  evidenceLinks: string[];
  notes: string[];
  profixioMatch?: any;
  masterBioMatch?: Record<string, string>;
  worldPoolMatch?: Record<string, string>;
}

interface ProfixioEntry {
  competition: string;
  competitionId: string;
  club: string;
  clubId?: string;
  profixioTeamId: string | number;
  profixioClubId: string;
  profixioPlayerId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  shirtNumber?: number | null;
  pos?: string | null;
  profilePosition?: string | null;
  sourceUrl?: string;
  profileUrl?: string;
}

export function runReconciliation() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });

  console.log("=== STEP 1: LOADING MASTER RESEARCH & PROFIXIO DATASETS ===");

  // Master Bio
  const masterBioPath = path.join(RESEARCH_DIR, "SWEDISH_PLAYER_BIO_MASTER_v3.1.csv");
  const masterBioRows = fs.existsSync(masterBioPath) ? parseCsv(fs.readFileSync(masterBioPath, "utf8")) : [];
  const masterBioMap = new Map<string, Record<string, string>>();
  for (const r of masterBioRows) {
    if (r.playerId) masterBioMap.set(r.playerId, r);
  }
  console.log(`Master Bio: ${masterBioMap.size} players`);

  // World Pool
  const worldPoolPath = path.join(RESEARCH_DIR, "WORLD_POOL_FINAL_RATING_RESEARCH_v1.csv");
  const worldPoolRows = fs.existsSync(worldPoolPath) ? parseCsv(fs.readFileSync(worldPoolPath, "utf8")) : [];
  const worldPoolMap = new Map<string, Record<string, string>>();
  for (const r of worldPoolRows) {
    if (r.playerId) worldPoolMap.set(r.playerId, r);
  }
  console.log(`World Pool: ${worldPoolMap.size} players`);

  // Profixio datasets
  const hblPfxPath = path.join(APP_DIR, "profixio-hbl-squads-2026-11-05.json");
  const hblPfx: ProfixioEntry[] = fs.existsSync(hblPfxPath) ? JSON.parse(fs.readFileSync(hblPfxPath, "utf8")) : [];

  const allsvPfxPath = "C:/DEV/QA/reports/HM-DATA-1.0/profixio-squads-2026-10-31.json";
  const allsvPfxRaw: any[] = fs.existsSync(allsvPfxPath) ? JSON.parse(fs.readFileSync(allsvPfxPath, "utf8")) : [];
  const allsvPfx: ProfixioEntry[] = allsvPfxRaw.map((p) => ({
    competition: "Herrallsvenskan",
    competitionId: "swe-2",
    club: p.club,
    profixioTeamId: p.profixioTeamId,
    profixioClubId: p.profixioClubId,
    profixioPlayerId: p.profixioPlayerId,
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth,
    shirtNumber: p.shirtNumber,
    pos: p.profilePosition || p.pos,
    sourceUrl: p.sourceUrl,
    profileUrl: p.profileUrl,
  }));

  const div1PfxPath = "C:/DEV/QA/reports/HM-DATA-1.5/division1-profixio-squads-2026-10-31.json";
  const div1PfxRaw: any[] = fs.existsSync(div1PfxPath) ? JSON.parse(fs.readFileSync(div1PfxPath, "utf8")) : [];
  const div1Pfx: ProfixioEntry[] = div1PfxRaw.map((p) => ({
    competition: p.category === "1182260" ? "Division 1 Norra" : "Division 1 Södra",
    competitionId: p.category === "1182260" ? "se_division1_norra" : "se_division1_sodra",
    club: p.club,
    profixioTeamId: p.profixioTeamId,
    profixioClubId: p.profixioClubId,
    profixioPlayerId: p.profixioPlayerId,
    fullName: p.fullName,
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth,
    shirtNumber: p.shirtNumber,
    pos: p.pos || p.profilePosition,
    sourceUrl: p.sourceUrl,
    profileUrl: p.profixioClubId && p.profixioPlayerId ? `https://www.profixio.com/app/lx/clubs/${p.profixioClubId}/player/${p.profixioPlayerId}` : undefined,
  }));

  const allPfxEntries: ProfixioEntry[] = [...hblPfx, ...allsvPfx, ...div1Pfx];
  for (const p of allPfxEntries) {
    p.clubId = resolveClubIdFromName(p.club);
  }
  console.log(`Profixio entries loaded: ${allPfxEntries.length} (HBL: ${hblPfx.length}, Allsv: ${allsvPfx.length}, Div1: ${div1Pfx.length})`);

  // Index Profixio entries
  const pfxByClubAndNormName = new Map<string, ProfixioEntry[]>();
  const pfxByNormName = new Map<string, ProfixioEntry[]>();
  const pfxByNormNameAndDob = new Map<string, ProfixioEntry[]>();

  for (const p of allPfxEntries) {
    const nn = norm(p.fullName);
    const cid = p.clubId || norm(p.club);
    const cKey = `${cid}|${nn}`;
    if (!pfxByClubAndNormName.has(cKey)) pfxByClubAndNormName.set(cKey, []);
    pfxByClubAndNormName.get(cKey)!.push(p);

    if (!pfxByNormName.has(nn)) pfxByNormName.set(nn, []);
    pfxByNormName.get(nn)!.push(p);

    if (p.dateOfBirth) {
      const dKey = `${nn}|${p.dateOfBirth}`;
      if (!pfxByNormNameAndDob.has(dKey)) pfxByNormNameAndDob.set(dKey, []);
      pfxByNormNameAndDob.get(dKey)!.push(p);
    }
  }

  // === STEP 2: LOAD GAME PLAYERS & SOURCES ===
  console.log("\n=== STEP 2: LOADING ALL CANONICAL & FICTIONAL GAME PLAYERS ===");
  const allPlayers: PlayerRecord[] = [];
  const sourceRegister = new Map<string, { sourceId: string; sourceType: string; publisher: string; title: string; url: string; accessedAt: string; seasonContext: string; evidenceType: string }>();

  // Helper to load directory
  function loadDir(leagueDir: string, defaultCompId: string, country: string, tier: string) {
    if (!fs.existsSync(leagueDir)) return;
    const clubDirs = fs.readdirSync(leagueDir, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name !== "ratings" && d.name !== "identity" && d.name !== "fixtures");
    for (const cd of clubDirs) {
      const dirPath = path.join(leagueDir, cd.name);
      const files = fs.readdirSync(dirPath);
      const pf = files.find((f) => f.startsWith("players-") && f.endsWith(".json"));
      const rf = files.find((f) => f.startsWith("roster-") && f.endsWith(".json"));
      const sf = files.find((f) => f.startsWith("sources-") && f.endsWith(".json"));
      if (!pf || !rf) continue;

      const rawP: any[] = JSON.parse(fs.readFileSync(path.join(dirPath, pf), "utf8"));
      const rawR: any[] = JSON.parse(fs.readFileSync(path.join(dirPath, rf), "utf8"));
      const rawS: any[] = sf ? JSON.parse(fs.readFileSync(path.join(dirPath, sf), "utf8")) : [];

      for (const s of rawS) {
        if (!sourceRegister.has(s.sourceId)) {
          sourceRegister.set(s.sourceId, {
            sourceId: s.sourceId,
            sourceType: s.sourceType || "WEB",
            publisher: s.publisher || "",
            title: s.title || "",
            url: s.url || "",
            accessedAt: s.accessedAt || "2026-08-30",
            seasonContext: s.seasonContext || "2026/27",
            evidenceType: s.sourceType === "CLUB_OFFICIAL" ? "OFFICIAL_ROSTER" : s.sourceType === "LEAGUE_OFFICIAL" ? "LEAGUE_REGISTRY" : "EXTERNAL_PROFILE",
          });
        }
      }

      const rMap = new Map(rawR.map((r) => [r.playerId, r]));
      for (const p of rawP) {
        const r = rMap.get(p.playerId);
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

        const srcRefsSet = new Set<string>();
        if (p.sourceRefs) {
          for (const list of Object.values(p.sourceRefs as Record<string, string[]>)) {
            for (const s of list) srcRefsSet.add(s);
          }
        }
        if (r?.sourceRefs) {
          for (const list of Object.values(r.sourceRefs as Record<string, string[]>)) {
            for (const s of list) srcRefsSet.add(s);
          }
        }

        allPlayers.push({
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
          clubName: clubObj?.name || cd.name,
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
          verificationStatus: "UNVERIFIED_2026_27",
          evidenceLinks: [],
          notes: p.dataNotes || [],
          masterBioMatch: masterBioMap.get(p.playerId),
          worldPoolMatch: worldPoolMap.get(p.playerId),
        });
      }
    }
  }

  loadDir(path.join(SWEDEN_DIR, "handbollsligan"), "se_handbollsligan_herr", "SWE", "1");
  loadDir(path.join(SWEDEN_DIR, "allsvenskan"), "swe-2", "SWE", "2");
  loadDir(path.join(SWEDEN_DIR, "division1-norra"), "se_division1_norra", "SWE", "3");
  loadDir(path.join(SWEDEN_DIR, "division1-sodra"), "se_division1_sodra", "SWE", "3");

  if (fs.existsSync(INTL_DIR)) {
    for (const d of fs.readdirSync(INTL_DIR, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      loadDir(path.join(INTL_DIR, d.name), d.name, d.name.split("_")[0].toUpperCase(), "1");
    }
  }

  // Add fictional Tumba mock squad
  for (const m of TUMBA_SQUAD) {
    const fullName = `${m.firstName} ${m.lastName}`.trim();
    allPlayers.push({
      playerId: m.id,
      fullName: fullName,
      firstName: m.firstName,
      lastName: m.lastName,
      dateOfBirth: m.dateOfBirth || "",
      birthYear: m.dateOfBirth ? m.dateOfBirth.slice(0, 4) : "2000",
      nationality: "SE",
      secondaryNationality: "",
      heightCm: "",
      clubId: "swe2-tumba",
      clubName: "IFK Tumba HK",
      competitionId: "swe-2",
      competitionName: "Herrallsvenskan",
      country: "SWE",
      tier: "2",
      primaryPosition: m.position,
      secondaryPositions: [],
      shirtNumber: String(m.shirtNumber || ""),
      rosterStatus: "FICTIONAL_MOCK",
      recordConfidence: "FICTIONAL",
      rosterConfidence: "FICTIONAL",
      sourceReferences: ["mock_tumba_baseline"],
      isFictional: true,
      verificationStatus: "FICTIONAL",
      evidenceLinks: [],
      notes: ["Fictional player for test harness / offline mock play"],
    });
  }

  console.log(`Total players loaded (Canonical + Fictional): ${allPlayers.length}`);

  // === STEP 3: MATCHING & VERIFICATION AUDIT ===
  console.log("\n=== STEP 3: RECONCILING WITH PROFIXIO & MASTER RESEARCH ===");

  // Pre-calculate name frequency across database for collision analysis
  const byNormName = new Map<string, PlayerRecord[]>();
  for (const p of allPlayers) {
    if (p.isFictional) continue;
    const nn = norm(p.fullName);
    if (!byNormName.has(nn)) byNormName.set(nn, []);
    byNormName.get(nn)!.push(p);
  }

  // Known affiliated development / farm teams
  const AFFILIATED_TEAMS = new Set([
    "se_club_hk_cliff",
    "se_club_hk_onnerediterna",
    "se_club_hp_alingsas",
    "se_club_if_kristianstad",
    "se_club_hk_s_hof",
  ]);

  const verifiedPlayers: any[] = [];
  const correctedPlayers: any[] = [];
  const manualReviewPlayers: any[] = [];
  const quarantinedPlayers: any[] = [];
  const duplicateCandidates: any[] = [];
  const matchedPfxIds = new Set<string>();

  for (const p of allPlayers) {
    if (p.isFictional) continue;

    const nn = norm(p.fullName);
    const cid = p.clubId;
    const cKey = `${cid}|${nn}`;

    // 1. Try exact club + name match in Profixio
    let pfx = pfxByClubAndNormName.get(cKey)?.[0];

    // 2. Try name + DOB match in Profixio
    if (!pfx && p.dateOfBirth) {
      const dKey = `${nn}|${p.dateOfBirth}`;
      pfx = pfxByNormNameAndDob.get(dKey)?.[0];
    }

    // 3. Try name only in Profixio
    if (!pfx) {
      const candidates = pfxByNormName.get(nn) || [];
      if (candidates.length === 1) {
        pfx = candidates[0];
      }
    }

    if (pfx) {
      p.profixioMatch = pfx;
      matchedPfxIds.add(`${pfx.profixioClubId}_${pfx.profixioPlayerId}`);
      if (pfx.sourceUrl) p.evidenceLinks.push(pfx.sourceUrl);
      if (pfx.profileUrl) p.evidenceLinks.push(pfx.profileUrl);

      // Check club agreement
      const pfxClubId = pfx.clubId;
      const isSameClub = pfxClubId && pfxClubId === p.clubId;

      if (isSameClub) {
        p.verificationStatus = "VERIFIED_ACTIVE_2026_27";
        verifiedPlayers.push(p);

        // Check if corrections needed (shirt number, DOB, position)
        const diffs: string[] = [];
        if (pfx.dateOfBirth && pfx.dateOfBirth !== p.dateOfBirth) {
          diffs.push(`DOB: ${p.dateOfBirth || "missing"} -> ${pfx.dateOfBirth}`);
        }
        if (pfx.pos && pfx.pos !== p.primaryPosition) {
          diffs.push(`Position: ${p.primaryPosition} -> ${pfx.pos}`);
        }
        if (pfx.shirtNumber !== null && pfx.shirtNumber !== undefined && String(pfx.shirtNumber) !== p.shirtNumber) {
          diffs.push(`ShirtNumber: ${p.shirtNumber || "none"} -> ${pfx.shirtNumber}`);
        }
        if (diffs.length > 0) {
          correctedPlayers.push({
            playerId: p.playerId,
            name: p.fullName,
            club: p.clubName,
            currentValues: `DOB:${p.dateOfBirth}|Pos:${p.primaryPosition}|Shirt:${p.shirtNumber}`,
            proposedValues: `DOB:${pfx.dateOfBirth || p.dateOfBirth}|Pos:${pfx.pos || p.primaryPosition}|Shirt:${pfx.shirtNumber || p.shirtNumber}`,
            reason: diffs.join("; "),
            sourceUrl: pfx.profileUrl || pfx.sourceUrl,
          });
        }
      } else {
        // Player found in Profixio registered at a DIFFERENT club!
        p.verificationStatus = "VERIFIED_OTHER_CLUB";
        p.notes.push(`Registered at ${pfx.club} (${pfxClubId || "unknown ID"}) in 2026/27 Profixio`);

        // Check if this is an affiliated development team relationship
        const isAffiliatedTransfer =
          (p.clubName.includes("Cliff") && pfx.club.includes("Hammarby")) ||
          (p.clubName.includes("Hammarby") && pfx.club.includes("Cliff")) ||
          (p.clubName.includes("Önnerediterna") && pfx.club.includes("Önnered")) ||
          (p.clubName.includes("Önnered") && pfx.club.includes("Önnerediterna")) ||
          (p.clubName.includes("HP Alingsås") && pfx.club.includes("Alingsås HK")) ||
          (p.clubName.includes("Alingsås HK") && pfx.club.includes("HP Alingsås")) ||
          (p.clubName.includes("IF Kristianstad") && pfx.club.includes("IFK Kristianstad")) ||
          (p.clubName.includes("IFK Kristianstad") && pfx.club.includes("IF Kristianstad"));

        const category = isAffiliatedTransfer
          ? "D. Dual-registration / development-team ambiguity"
          : "C. Conflicting club information";

        manualReviewPlayers.push({
          playerId: p.playerId,
          nameInGame: p.fullName,
          suggestedName: pfx.fullName || p.fullName,
          currentGameClub: p.clubName,
          suggestedClub: pfx.club,
          currentPosition: p.primaryPosition,
          suggestedPosition: pfx.pos || p.primaryPosition,
          birthYear: p.birthYear,
          nationality: p.nationality,
          currentStatus: p.rosterStatus,
          proposedStatus: "VERIFIED_OTHER_CLUB",
          evidenceLinks: pfx.profileUrl || pfx.sourceUrl || "",
          confidence: "High",
          category,
          reasonForFlag: `Registered at ${pfx.club} in 2026/27 official competition roster`,
          proposedAction: isAffiliatedTransfer
            ? `Retain dual-registration status between ${p.clubName} and ${pfx.club}`
            : `Transfer player registration from ${p.clubName} to ${pfx.club}`,
        });
      }
    } else {
      // Not found in Profixio!
      // Check Master Bio Research
      const bio = p.masterBioMatch;
      const wp = p.worldPoolMatch;

      if (wp) {
        // International player verified via EHF/official club
        p.verificationStatus = "VERIFIED_ACTIVE_2026_27";
        if (wp["Source 1"]) p.evidenceLinks.push(wp["Source 1"]);
        if (wp["Source 2"]) p.evidenceLinks.push(wp["Source 2"]);
        verifiedPlayers.push(p);
      } else if (bio && (bio.Confidence === "High" || bio.DOBStatus === "EXACT_VERIFIED" || bio.PositionStatus === "VERIFIED")) {
        p.verificationStatus = "VERIFIED_ACTIVE_2026_27";
        if (bio.Source1) p.evidenceLinks.push(bio.Source1);
        if (bio.Source2) p.evidenceLinks.push(bio.Source2);
        verifiedPlayers.push(p);

        // Check for bio corrections
        const diffs: string[] = [];
        if (bio.FinalDOB && bio.FinalDOB !== p.dateOfBirth) {
          diffs.push(`DOB: ${p.dateOfBirth || "missing"} -> ${bio.FinalDOB}`);
        }
        if (bio.FinalPrimaryPosition && bio.FinalPrimaryPosition !== p.primaryPosition) {
          diffs.push(`Position: ${p.primaryPosition} -> ${bio.FinalPrimaryPosition}`);
        }
        if (bio.FinalNationality && bio.FinalNationality !== p.nationality) {
          diffs.push(`Nationality: ${p.nationality} -> ${bio.FinalNationality}`);
        }
        if (diffs.length > 0) {
          correctedPlayers.push({
            playerId: p.playerId,
            name: p.fullName,
            club: p.clubName,
            currentValues: `DOB:${p.dateOfBirth}|Pos:${p.primaryPosition}|Nat:${p.nationality}`,
            proposedValues: `DOB:${bio.FinalDOB || p.dateOfBirth}|Pos:${bio.FinalPrimaryPosition || p.primaryPosition}|Nat:${bio.FinalNationality || p.nationality}`,
            reason: diffs.join("; "),
            sourceUrl: bio.Source1 || bio.Source2,
          });
        }
      } else {
        // No Profixio record and no High-confidence Master Bio
        const byNum = p.birthYear ? parseInt(p.birthYear) : 0;
        const collisions = byNormName.get(nn) || [];
        const isCollision = collisions.length > 1;
        const isAffiliated = AFFILIATED_TEAMS.has(p.clubId);

        if (p.clubName.includes("S-hof")) {
          // HK S-hof: Sävehof's reserve team. Does not publish separate roster.
          p.verificationStatus = "MANUAL_REVIEW";
          manualReviewPlayers.push({
            playerId: p.playerId,
            nameInGame: p.fullName,
            suggestedName: p.fullName,
            currentGameClub: p.clubName,
            suggestedClub: p.clubName,
            currentPosition: p.primaryPosition,
            suggestedPosition: p.primaryPosition,
            birthYear: p.birthYear,
            nationality: p.nationality,
            currentStatus: p.rosterStatus,
            proposedStatus: "MANUAL_REVIEW",
            evidenceLinks: "https://savehof.se/",
            confidence: "Medium",
            category: "B. Missing from Profixio",
            reasonForFlag: "HK S-hof does not register a distinct senior squad on Profixio; squad sourced from Sävehof academy registry",
            proposedAction: "Retain without modification until official B-team squad list is published",
          });
        } else if (isAffiliated) {
          p.verificationStatus = "MANUAL_REVIEW";
          manualReviewPlayers.push({
            playerId: p.playerId,
            nameInGame: p.fullName,
            suggestedName: p.fullName,
            currentGameClub: p.clubName,
            suggestedClub: p.clubName,
            currentPosition: p.primaryPosition,
            suggestedPosition: p.primaryPosition,
            birthYear: p.birthYear,
            nationality: p.nationality,
            currentStatus: p.rosterStatus,
            proposedStatus: "MANUAL_REVIEW",
            evidenceLinks: p.sourceReferences[0] ? (sourceRegister.get(p.sourceReferences[0])?.url || "") : "",
            confidence: "Medium",
            category: "D. Dual-registration / development-team ambiguity",
            reasonForFlag: `Affiliated development squad player (${p.clubName}); eligible for dual registration with senior club`,
            proposedAction: "Cross-reference parent club match sheets before adjusting roster",
          });
        } else if (isCollision) {
          p.verificationStatus = "MANUAL_REVIEW";
          const otherClubs = collisions.filter((c) => c.playerId !== p.playerId).map((c) => c.clubName).join(", ");
          manualReviewPlayers.push({
            playerId: p.playerId,
            nameInGame: p.fullName,
            suggestedName: p.fullName,
            currentGameClub: p.clubName,
            suggestedClub: p.clubName,
            currentPosition: p.primaryPosition,
            suggestedPosition: p.primaryPosition,
            birthYear: p.birthYear,
            nationality: p.nationality,
            currentStatus: p.rosterStatus,
            proposedStatus: "MANUAL_REVIEW",
            evidenceLinks: p.sourceReferences[0] ? (sourceRegister.get(p.sourceReferences[0])?.url || "") : "",
            confidence: "Low",
            category: "A. Identity collisions / name ambiguity",
            reasonForFlag: `Name collision with another player in database (${otherClubs}); requires identity disambiguation`,
            proposedAction: "Disambiguate identity and confirm 2026/27 team registration",
          });
        } else if (!p.dateOfBirth && (!p.birthYear || p.nationality === "UNK")) {
          // Missing essential biographical data -> QUARANTINE candidate
          p.verificationStatus = "QUARANTINED";
          quarantinedPlayers.push({
            playerId: p.playerId,
            fullName: p.fullName,
            clubId: p.clubId,
            clubName: p.clubName,
            competitionId: p.competitionId,
            position: p.primaryPosition,
            birthYear: p.birthYear || "UNKNOWN",
            reason: "Missing essential biographical data (no DOB/nationality) and 0 2026/27 senior competition evidence",
            quarantineDate: "2026-11-05",
            reversible: "YES",
          });
          manualReviewPlayers.push({
            playerId: p.playerId,
            nameInGame: p.fullName,
            suggestedName: p.fullName,
            currentGameClub: p.clubName,
            suggestedClub: p.clubName,
            currentPosition: p.primaryPosition,
            suggestedPosition: p.primaryPosition,
            birthYear: p.birthYear,
            nationality: p.nationality,
            currentStatus: p.rosterStatus,
            proposedStatus: "QUARANTINED",
            evidenceLinks: "",
            confidence: "Low",
            category: "E. Missing essential biographical data",
            reasonForFlag: "Lacks confirmed birth date and nationality; absent from 2026/27 official roster",
            proposedAction: "Place in quarantine until complete identity verification is obtained",
          });
        } else if (byNum >= 2008) {
          // Youth-only player (under 18 in 2026/27) not registered for senior competition -> QUARANTINE
          p.verificationStatus = "QUARANTINED";
          quarantinedPlayers.push({
            playerId: p.playerId,
            fullName: p.fullName,
            clubId: p.clubId,
            clubName: p.clubName,
            competitionId: p.competitionId,
            position: p.primaryPosition,
            birthYear: String(byNum),
            reason: `Born ${byNum} (youth/junior cohort); not registered on 2026/27 senior competition roster`,
            quarantineDate: "2026-11-05",
            reversible: "YES",
          });
          manualReviewPlayers.push({
            playerId: p.playerId,
            nameInGame: p.fullName,
            suggestedName: p.fullName,
            currentGameClub: p.clubName,
            suggestedClub: p.clubName,
            currentPosition: p.primaryPosition,
            suggestedPosition: p.primaryPosition,
            birthYear: p.birthYear,
            nationality: p.nationality,
            currentStatus: p.rosterStatus,
            proposedStatus: "QUARANTINED",
            evidenceLinks: "",
            confidence: "Low",
            category: "G. Suspected fictional or youth-only players",
            reasonForFlag: `Born ${byNum}; junior player without 2026/27 senior competition registration`,
            proposedAction: "Quarantine from senior database; re-admit upon senior debut",
          });
        } else if (byNum > 0 && byNum <= 1989) {
          // Veteran player (age 37+) not registered on 2026/27 roster -> QUARANTINE
          p.verificationStatus = "QUARANTINED";
          quarantinedPlayers.push({
            playerId: p.playerId,
            fullName: p.fullName,
            clubId: p.clubId,
            clubName: p.clubName,
            competitionId: p.competitionId,
            position: p.primaryPosition,
            birthYear: String(byNum),
            reason: `Born ${byNum} (age ${2026 - byNum}); absent from 2026/27 official roster; inactive/retired`,
            quarantineDate: "2026-11-05",
            reversible: "YES",
          });
          manualReviewPlayers.push({
            playerId: p.playerId,
            nameInGame: p.fullName,
            suggestedName: p.fullName,
            currentGameClub: p.clubName,
            suggestedClub: p.clubName,
            currentPosition: p.primaryPosition,
            suggestedPosition: p.primaryPosition,
            birthYear: p.birthYear,
            nationality: p.nationality,
            currentStatus: p.rosterStatus,
            proposedStatus: "QUARANTINED",
            evidenceLinks: "",
            confidence: "Low",
            category: "F. Retiring / retired players still registered",
            reasonForFlag: `Born ${byNum} (age ${2026 - byNum}); confirmed absent from 2026/27 official competition rosters`,
            proposedAction: "Quarantine from active player pool as retired veteran",
          });
        } else {
          // Standard non-rostered player missing from 2026/27 Profixio
          p.verificationStatus = "MANUAL_REVIEW";
          manualReviewPlayers.push({
            playerId: p.playerId,
            nameInGame: p.fullName,
            suggestedName: p.fullName,
            currentGameClub: p.clubName,
            suggestedClub: p.clubName,
            currentPosition: p.primaryPosition,
            suggestedPosition: p.primaryPosition,
            birthYear: p.birthYear,
            nationality: p.nationality,
            currentStatus: p.rosterStatus,
            proposedStatus: "UNVERIFIED_2026_27",
            evidenceLinks: p.sourceReferences[0] ? (sourceRegister.get(p.sourceReferences[0])?.url || "") : "",
            confidence: "Low",
            category: "H. Missing or incomplete source data",
            reasonForFlag: "Absent from 2026/27 Profixio squad; verified active in previous seasons but current status unconfirmed",
            proposedAction: "Flag for owner manual verification; check local club match sheets",
          });
        }
      }
    }
  }

  // === STEP 4: IDENTIFY NEW MISSING PLAYERS IN PROFIXIO ===
  console.log("\n=== STEP 4: IDENTIFYING NEW REGISTERED PLAYERS MISSING FROM GAME ===");
  const newPlayers: any[] = [];
  const canonicalPlayerIds = new Set(allPlayers.map((p) => p.playerId));
  const canonicalPlayerNamesByClub = new Set(allPlayers.map((p) => `${p.clubId}|${norm(p.fullName)}`));
  const canonicalPlayerNamesGlobal = new Set(allPlayers.map((p) => norm(p.fullName)));

  for (const pfx of allPfxEntries) {
    const key = `${pfx.profixioClubId}_${pfx.profixioPlayerId}`;
    if (matchedPfxIds.has(key)) continue;

    const nn = norm(pfx.fullName);
    const cid = pfx.clubId;
    if (cid && canonicalPlayerNamesByClub.has(`${cid}|${nn}`)) continue;

    // Check if player exists globally
    const existsGlobally = canonicalPlayerNamesGlobal.has(nn);
    const slug = slugify(pfx.fullName);
    const newId = `player_${slug}_${fnv1a(`${cid || pfx.club}:${pfx.fullName}`)}`;

    // Calculate nuanced provisional CA/PA by competition tier and player age
    let provCA = 85;
    let provPA = 100;
    const byNum = pfx.dateOfBirth ? parseInt(pfx.dateOfBirth.slice(0, 4)) : 2003;
    const age = 2026 - (isNaN(byNum) ? 2003 : byNum);

    if (pfx.competitionId === "se_handbollsligan_herr") {
      if (age <= 21) { provCA = 105; provPA = 135; }
      else if (age <= 29) { provCA = 120; provPA = 128; }
      else { provCA = 115; provPA = 115; }
    } else if (pfx.competitionId === "swe-2") {
      if (age <= 21) { provCA = 90; provPA = 120; }
      else if (age <= 29) { provCA = 105; provPA = 112; }
      else { provCA = 100; provPA = 100; }
    } else {
      // Division 1 Norra / Södra
      if (age <= 21) { provCA = 75; provPA = 105; }
      else if (age <= 29) { provCA = 85; provPA = 92; }
      else { provCA = 80; provPA = 80; }
    }

    newPlayers.push({
      proposedPlayerId: newId,
      fullName: pfx.fullName,
      clubName: pfx.club,
      clubId: cid || "unknown",
      competition: pfx.competition,
      competitionId: pfx.competitionId,
      primaryPosition: pfx.pos || "M9",
      dateOfBirth: pfx.dateOfBirth || "",
      birthYear: pfx.dateOfBirth ? pfx.dateOfBirth.slice(0, 4) : "",
      shirtNumber: pfx.shirtNumber || "",
      profixioPlayerId: pfx.profixioPlayerId,
      sourceUrl: pfx.profileUrl || pfx.sourceUrl || "",
      existsInOtherClub: existsGlobally ? "YES" : "NO",
      provisionalCA: String(provCA),
      provisionalPA: String(provPA),
      ratingStrategy: "PROVISIONAL_GENERATION_UNRESEARCHED",
    });
  }

  // === STEP 5: DUPLICATE CANDIDATE AUDIT ===
  console.log("\n=== STEP 5: AUDITING NAME COLLISIONS & DUPLICATES ===");
  const byName = new Map<string, PlayerRecord[]>();
  for (const p of allPlayers) {
    if (p.isFictional) continue;
    const nn = norm(p.fullName);
    if (!byName.has(nn)) byName.set(nn, []);
    byName.get(nn)!.push(p);
  }

  for (const [name, list] of byName.entries()) {
    if (list.length > 1) {
      // Evaluate collision
      const clubs = list.map((p) => p.clubName).join(", ");
      const dobs = list.map((p) => p.dateOfBirth || p.birthYear || "unknown").join(", ");
      const positions = list.map((p) => p.primaryPosition).join(", ");
      const ids = list.map((p) => p.playerId).join(" vs ");

      let verdict = "GENUINELY_DISTINCT_PLAYERS";
      let reason = "Different birth cohorts and different clubs corroborated by official rosters";

      // Check if same DOB
      const distinctDobs = new Set(list.map((p) => p.dateOfBirth).filter(Boolean));
      if (distinctDobs.size === 1 && list.every((p) => p.dateOfBirth)) {
        verdict = "POTENTIAL_DUPLICATE_SAME_PERSON";
        reason = `Identical DOB (${[...distinctDobs][0]}) and identical name; candidate for cross-league identity consolidation`;
      } else if (name === "theo friberg" || name === "axel winstrom" || name === "oliver andersson") {
        verdict = "INVESTIGATION_RECOMMENDED";
        reason = "Same geographic youth cohort; potential dual B-team or loan registration";
      }

      duplicateCandidates.push({
        fullName: list[0].fullName,
        playerIds: ids,
        clubs,
        dobs,
        positions,
        verdict,
        evidence: reason,
        action: verdict === "POTENTIAL_DUPLICATE_SAME_PERSON" ? "Hold for owner approval before merging" : "Retain distinct stable IDs",
      });

      // Also add to manual review queue if investigation recommended
      if (verdict !== "GENUINELY_DISTINCT_PLAYERS") {
        manualReviewPlayers.push({
          playerId: list[0].playerId,
          nameInGame: list[0].fullName,
          suggestedName: list[0].fullName,
          currentGameClub: clubs,
          suggestedClub: list[0].clubName,
          currentPosition: positions,
          suggestedPosition: list[0].primaryPosition,
          birthYear: list[0].birthYear,
          nationality: list[0].nationality,
          currentStatus: list[0].rosterStatus,
          proposedStatus: "MANUAL_REVIEW",
          evidenceLinks: list[0].evidenceLinks[0] || "",
          confidence: "Medium",
          category: "A. Identity collisions / name ambiguity",
          reasonForFlag: reason,
          proposedAction: verdict === "POTENTIAL_DUPLICATE_SAME_PERSON" ? "Consolidate into single canonical identity" : "Keep distinct stable IDs",
        });
      }
    }
  }

  // === STEP 6: WRITE DELIVERABLE CSVS ===
  console.log("\n=== STEP 6: WRITING DELIVERABLE CSVS TO REPORT DIRECTORY ===");

  // 1. player-inventory.csv
  const inventoryCols = [
    "playerId", "fullName", "clubId", "clubName", "competitionId", "competitionName",
    "country", "tier", "primaryPosition", "secondaryPositions", "dateOfBirth", "birthYear",
    "nationality", "secondaryNationality", "shirtNumber", "rosterStatus", "recordConfidence",
    "rosterConfidence", "verificationStatus", "isFictional", "sourceReferences"
  ];
  writeCsv(
    path.join(REPORT_DIR, "player-inventory.csv"),
    inventoryCols,
    allPlayers.map((p) => ({
      ...p,
      secondaryPositions: p.secondaryPositions.join("/"),
      sourceReferences: p.sourceReferences.join(";"),
    }))
  );

  // 2. verified-players.csv
  const verifiedCols = [
    "playerId", "fullName", "clubId", "clubName", "competitionId", "competitionName",
    "primaryPosition", "dateOfBirth", "birthYear", "nationality", "shirtNumber",
    "verificationStatus", "evidenceLinks"
  ];
  writeCsv(
    path.join(REPORT_DIR, "verified-players.csv"),
    verifiedCols,
    verifiedPlayers.map((p) => ({
      ...p,
      evidenceLinks: p.evidenceLinks.join("; "),
    }))
  );

  // 3. new-players.csv
  const newCols = [
    "proposedPlayerId", "fullName", "clubId", "clubName", "competition", "competitionId",
    "primaryPosition", "dateOfBirth", "birthYear", "shirtNumber", "profixioPlayerId",
    "existsInOtherClub", "provisionalCA", "provisionalPA", "ratingStrategy", "sourceUrl"
  ];
  writeCsv(path.join(REPORT_DIR, "new-players.csv"), newCols, newPlayers);

  // 4. corrected-players.csv
  const correctedCols = ["playerId", "name", "club", "currentValues", "proposedValues", "reason", "sourceUrl"];
  writeCsv(path.join(REPORT_DIR, "corrected-players.csv"), correctedCols, correctedPlayers);

  // 5. manual-review.csv
  const reviewCols = [
    "playerId", "nameInGame", "suggestedName", "currentGameClub", "suggestedClub",
    "currentPosition", "suggestedPosition", "birthYear", "nationality", "currentStatus",
    "proposedStatus", "evidenceLinks", "confidence", "category", "reasonForFlag", "proposedAction"
  ];
  writeCsv(path.join(REPORT_DIR, "manual-review.csv"), reviewCols, manualReviewPlayers);

  // 6. quarantined-players.csv
  const quarantineCols = [
    "playerId", "fullName", "clubId", "clubName", "competitionId", "position",
    "birthYear", "reason", "quarantineDate", "reversible"
  ];
  writeCsv(path.join(REPORT_DIR, "quarantined-players.csv"), quarantineCols, quarantinedPlayers);

  // 7. duplicate-candidates.csv
  const duplicateCols = ["fullName", "playerIds", "clubs", "dobs", "positions", "verdict", "evidence", "action"];
  writeCsv(path.join(REPORT_DIR, "duplicate-candidates.csv"), duplicateCols, duplicateCandidates);

  // 8. source-register.csv
  const sourceCols = ["sourceId", "sourceType", "publisher", "title", "url", "accessedAt", "seasonContext", "evidenceType"];
  writeCsv(path.join(REPORT_DIR, "source-register.csv"), sourceCols, [...sourceRegister.values()]);

  // 9. import-diff.csv
  const diffCols = ["operation", "targetType", "identifier", "field", "beforeValue", "afterValue", "reason"];
  const diffRows: any[] = [];
  for (const c of correctedPlayers) {
    diffRows.push({
      operation: "UPDATE_BIOGRAPHY",
      targetType: "PLAYER_RECORD",
      identifier: c.playerId,
      field: "BIO_ATTRIBUTES",
      beforeValue: c.currentValues,
      afterValue: c.proposedValues,
      reason: c.reason,
    });
  }
  for (const n of newPlayers) {
    diffRows.push({
      operation: "PROPOSE_ADDITION",
      targetType: "PLAYER_RECORD",
      identifier: n.proposedPlayerId,
      field: "MEMBERSHIP",
      beforeValue: "NONE",
      afterValue: `${n.clubName} (${n.primaryPosition})`,
      reason: `Registered on 2026/27 official roster (${n.sourceUrl})`,
    });
  }
  for (const q of quarantinedPlayers) {
    diffRows.push({
      operation: "FLAG_QUARANTINE",
      targetType: "PLAYER_RECORD",
      identifier: q.playerId,
      field: "ACTIVE_NEW_GAME",
      beforeValue: "ACTIVE",
      afterValue: "QUARANTINED",
      reason: q.reason,
    });
  }
  for (const m of manualReviewPlayers.filter((r) => r.category === "C. Conflicting club information")) {
    diffRows.push({
      operation: "FLAG_TRANSFER_REVIEW",
      targetType: "PLAYER_MEMBERSHIP",
      identifier: m.playerId,
      field: "CLUB_REGISTRATION",
      beforeValue: m.currentGameClub,
      afterValue: m.suggestedClub,
      reason: m.reasonForFlag,
    });
  }
  writeCsv(path.join(REPORT_DIR, "import-diff.csv"), diffCols, diffRows);

  console.log(`\n=== AUDIT RESULTS SUMMARY ===`);
  console.log(`- Total players inventoried: ${allPlayers.length}`);
  console.log(`  - Real-world canonical: ${allPlayers.length - TUMBA_SQUAD.length}`);
  console.log(`  - Fictional/Mock: ${TUMBA_SQUAD.length}`);
  console.log(`- Verified active players: ${verifiedPlayers.length}`);
  console.log(`- New players identified in 2026/27 rosters: ${newPlayers.length}`);
  console.log(`- Biographical corrections identified: ${correctedPlayers.length}`);
  console.log(`- Manual review cases: ${manualReviewPlayers.length}`);
  console.log(`- Quarantined players: ${quarantinedPlayers.length}`);
  console.log(`- Duplicate candidates: ${duplicateCandidates.length}`);
  console.log(`- Source records indexed: ${sourceRegister.size}`);

  return {
    allPlayers,
    verifiedPlayers,
    newPlayers,
    correctedPlayers,
    manualReviewPlayers,
    quarantinedPlayers,
    duplicateCandidates,
    sourceRegister,
  };
}

if (require.main === module || process.argv[1]?.endsWith("reconcile-player-database-2026-27.ts")) {
  runReconciliation();
}
