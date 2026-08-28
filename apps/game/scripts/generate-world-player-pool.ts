// HM-WORLD-PLAYER-POOL-1.0: one-off, offline data-authoring script --
// generates real-world player identity/roster JSON files for the
// 100-player HANDBALL_MANAGER_INTERNATIONAL_PLAYER_POOL_v0.1 workbook,
// mirroring the exact directory/file shape the Handbollsligan/
// Allsvenskan/Division 1 real-world pipelines already established (see
// scripts/generate-division1-players.ts). Every field except the new
// `worldPoolMetadata` block matches that shape exactly.
//
// PRIMARY SOURCE: the user-supplied workbook, exported once to
// scratch/intl_players.json (100 rows, audited against the workbook's
// own Summary sheet -- zero mismatches -- before this script was run).
//
// CLUB/COMPETITION REUSE: 14 of the 31 clubs (and all 6 of their
// competitions) already exist as mock entries in game-data/clubs.ts/
// competitions.ts (from earlier milestones' Denmark/Germany/Norway/
// Spain/Hungary/Iceland blocks) -- this script reuses those exact
// existing clubIds/competitionIds rather than creating duplicates (Part:
// "Återanvänd existerande club entity om klubben redan finns"). The
// other 17 clubs and 10 competitions are genuinely new and get new,
// clearly-namespaced ids (int-*).
import fs from "node:fs";
import path from "node:path";

const OUT_ROOT = path.join(__dirname, "..", "..", "..", "data", "real-world", "international", "2026-27");
const SCRATCH = "C:\\Users\\helgi\\AppData\\Local\\Temp\\claude\\C--Users-helgi-Documents-STARKVIS-HELA\\0ff4a7cd-3811-44f1-bd23-27d7d5b67887\\scratchpad";
const PLAYERS_JSON_PATH = path.join(SCRATCH, "intl_players.json");

type CanonicalPosition = "MV" | "V6" | "V9" | "M9" | "M6" | "H9" | "H6";

// Part: "Map GK/LW/RW/LB/CB/RB/P till befintliga canonical HM-positioner."
const SOURCE_POSITION_MAP: Record<string, CanonicalPosition> = {
  GK: "MV",
  LW: "V6",
  RW: "H6",
  LB: "V9",
  RB: "H9",
  CB: "M9",
  P: "M6",
};

// Part: "Importera source birth data och nationality exakt enligt
// workbook" -- nationalities are encoded as ISO-3166-1 alpha-2 (the
// SAME encoding every other real-world club's nationalities field
// already uses, per gameWorldAdapter.ts's own ISO_TO_NATION_CODE) so
// the fact is preserved exactly, just in the codebase's existing
// standard format rather than a new one-off text convention.
const NATIONALITY_TO_ISO: Record<string, string> = {
  Algeria: "DZ",
  Argentina: "AR",
  Austria: "AT",
  "Bosnia and Herzegovina": "BA",
  Croatia: "HR",
  Denmark: "DK",
  "Faroe Islands": "FO",
  France: "FR",
  Germany: "DE",
  Hungary: "HU",
  Iceland: "IS",
  Italy: "IT",
  Lithuania: "LT",
  Netherlands: "NL",
  Norway: "NO",
  Poland: "PL",
  Portugal: "PT",
  Qatar: "QA",
  Romania: "RO",
  Serbia: "RS",
  Slovenia: "SI",
  Spain: "ES",
  Sweden: "SE",
  Switzerland: "CH",
};

const CLUB_ID_MAP: Record<string, string> = {
  "THW Kiel": "ger1-kiel",
  "Füchse Berlin": "ger1-fuchse",
  "HSG Wetzlar": "ger1-wetzlar",
  "Aalborg Håndbold": "den1-aalborg",
  "Bjerringbro-Silkeborg": "den1-bjerringbro",
  "Skjern Håndbold": "den1-skjern",
  "TMS Ringsted": "den1-tms",
  "SAH - Aarhus": "den1-skanderborg",
  "Elverum Håndball": "nor1-elverum",
  "Barça": "esp1-barca",
  "Fraikin BM. Granollers": "esp1-granollers",
  "REBI Balonmano Cuenca": "esp1-cuenca",
  "ONE Veszprém": "hun1-veszprem",
  "Valur": "isl1-valur",
  "ALPLA HC Hard": "int-hard",
  "FIVERS Margareten": "int-fivers",
  "H71": "int-h71",
  "Veszprém Handball Academy": "int-veszprem-academy",
  "Black Devils Meran Alperia": "int-meran",
  "Metelli Cologne": "int-cologno",
  "Proger Cassano Magnago": "int-cassano",
  "Camerano": "int-camerano",
  "Paese": "int-paese",
  "Serra Fasano": "int-fasano",
  "Humby/Bevo HC": "int-bevo",
  "KRAS/Volendam": "int-volendam",
  "RoyalFloraHolland/HV Aalsmeer": "int-aalsmeer",
  "ORLEN Wisła Płock": "int-wisla-plock",
  "Sporting CP": "int-sporting",
  "Al Duhail": "int-alduhail",
  "Kadetten Schaffhausen": "int-schaffhausen",
};

const COMPETITION_ID_MAP: Record<string, string> = {
  Bundesliga: "ger-1",
  "Bambuni Herreligaen": "den-1",
  "Elkjøp-ligaen": "nor-1",
  "Liga NEXUS ENERGÍA ASOBAL": "esp-1",
  "K&H férfi kézilabda liga (NB I)": "hun-1",
  "Olís-deild karla": "isl-1",
  "HLA MEISTERLIGA": "int-aut-1",
  "Burn-kappingin": "int-fro-1",
  "NB I/B": "int-hun-2b",
  "Serie A Gold": "int-ita-1",
  "Serie A Silver": "int-ita-2",
  "Super Handball League": "int-ned-1",
  "ORLEN Superliga": "int-pol-1",
  "Campeonato Betclic Masculino": "int-por-1",
  "Qatar Handball League": "int-qat-1",
  "Quickline Handball League": "int-che-1",
};

interface SourceRow {
  ID: string;
  Name: string;
  Club: string;
  League: string;
  "Pool Region": string;
  "League Country": string;
  Born: string;
  Nationality: string;
  Position: string;
  "HM Level": string;
  Prospect: "Yes" | "No";
  "Wonderkid Candidate": "Yes" | "No";
  Confidence: "A" | "B";
  Notes: string | null;
  "Source URL(s)": string;
}

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
function hexSuffix(seed: string): string {
  return fnv1a(seed).toString(16).padStart(8, "0").slice(0, 8);
}
function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}
function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

const rows: SourceRow[] = JSON.parse(fs.readFileSync(PLAYERS_JSON_PATH, "utf8"));
if (rows.length !== 100) throw new Error(`expected exactly 100 source rows, found ${rows.length}`);

const SCHEMA_FOUNDATION = {
  schemaVersion: "HM-REAL-WORLD-0.2",
  idStandard: {
    playerId: "player_intl_<normalized-name-slug>_<persistent-8hex>",
    rule: "The token is generated once and persisted (deterministically hashed from the workbook's own stable ID + full name), so re-running this generator is idempotent.",
    normalizationExamples: { "Mathias Gidsel": "mathias_gidsel" },
  },
  playerEntity: { separatesPersonFromRoster: true, fieldsAddedAfterPilot: ["birthYear", "aliases", "fieldConfidence", "sourceRefs", "dataNotes", "worldPoolMetadata"] },
  rosterEntity: {
    fieldsAddedAfterPilot: ["rosterEntryId", "competitionId", "snapshotDate", "rosterStatus", "contract"],
    contractShape: { untilDate: "YYYY-MM-DD or null", untilSeason: "YYYY/YY or null", optionUntilSeason: "YYYY/YY or null" },
  },
  confidenceValues: ["VERIFIED", "PARTIAL", "UNKNOWN"],
  rosterStatusValues: ["CONFIRMED", "ANNOUNCED_IN", "REGISTERED", "LOAN_IN", "LOAN_OUT", "DEPARTING", "LEFT", "UNCERTAIN"],
  canonicalPositions: Object.values(SOURCE_POSITION_MAP),
  missingDataRule: "Use null. Never infer an exact value from age, role, old shirt number, nationality assumptions, or typical positional versatility.",
  worldPoolMetadataRule:
    "HM-WORLD-PLAYER-POOL-1.0: HM Level/Prospect/Wonderkid Candidate/Confidence/Notes are GAME-DESIGN METADATA, not factual claims about the real person -- see lib/rating/gamePrior for how HM Level/Wonderkid feed CA/PA generation as a bounded, non-authoritative signal, never a second CA. workbookId/sourceUrls are provenance only.",
};

interface ClubGroup {
  clubDisplayName: string;
  clubId: string;
  competitionId: string;
  leagueCountry: string;
  rows: SourceRow[];
}
const clubGroups = new Map<string, ClubGroup>();
for (const row of rows) {
  const clubId = CLUB_ID_MAP[row.Club];
  if (!clubId) throw new Error(`Unmapped club: "${row.Club}"`);
  const competitionId = COMPETITION_ID_MAP[row.League];
  if (!competitionId) throw new Error(`Unmapped competition: "${row.League}"`);
  if (!clubGroups.has(row.Club)) {
    clubGroups.set(row.Club, { clubDisplayName: row.Club, clubId, competitionId, leagueCountry: row["League Country"], rows: [] });
  }
  clubGroups.get(row.Club)!.rows.push(row);
}

let totalPlayers = 0;
for (const group of clubGroups.values()) {
  const players = group.rows.map((row) => {
    const { firstName, lastName } = splitName(row.Name);
    const playerId = `player_intl_${slug(row.Name)}_${hexSuffix(`worldpool100:${row.ID}:${row.Name}`)}`;
    const isFullDate = /^\d{4}-\d{2}-\d{2}$/.test(row.Born);
    const isYearOnly = /^\d{4}$/.test(row.Born);
    if (!isFullDate && !isYearOnly) throw new Error(`Unrecognized Born format for ${row.Name}: "${row.Born}"`);
    const dateOfBirth = isFullDate ? row.Born : null;
    const birthYear = isFullDate ? Number(row.Born.slice(0, 4)) : Number(row.Born);
    const position = SOURCE_POSITION_MAP[row.Position];
    if (!position) throw new Error(`Unmapped position "${row.Position}" for ${row.Name}`);
    const nationalityIso = NATIONALITY_TO_ISO[row.Nationality];
    if (!nationalityIso) throw new Error(`Unmapped nationality "${row.Nationality}" for ${row.Name}`);

    return {
      playerId,
      firstName,
      lastName,
      fullName: row.Name,
      dateOfBirth,
      birthYear,
      nationalities: [nationalityIso],
      position,
      recordConfidence: row.Confidence === "A" ? "VERIFIED" : "PARTIAL",
      sourceUrls: row["Source URL(s)"].split("|").map((u) => u.trim()),
      worldPoolMetadata: {
        workbookId: row.ID,
        poolRegion: row["Pool Region"],
        leagueCountry: row["League Country"],
        sourceNationality: row.Nationality,
        hmLevel: row["HM Level"],
        prospect: row.Prospect === "Yes",
        wonderkidCandidate: row["Wonderkid Candidate"] === "Yes",
        confidence: row.Confidence,
        notes: row.Notes,
      },
    };
  });

  const playersJson = players.map((p) => ({
    playerId: p.playerId,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: p.fullName,
    aliases: [],
    dateOfBirth: p.dateOfBirth,
    birthYear: p.birthYear,
    nationalities: p.nationalities,
    heightCm: null,
    handedness: null,
    recordConfidence: p.recordConfidence,
    fieldConfidence: p.dateOfBirth ? { dateOfBirth: p.recordConfidence } : { birthYear: p.recordConfidence },
    sourceRefs: { identity: ["src_intl_pool_v0_1"] },
    dataNotes: p.worldPoolMetadata.notes ? [p.worldPoolMetadata.notes] : [],
    worldPoolMetadata: p.worldPoolMetadata,
  }));

  const rosterJson = players.map((p) => ({
    rosterEntryId: `intl_2026_27_${slug(group.clubDisplayName)}__${p.playerId.split("_").pop()}`,
    playerId: p.playerId,
    clubId: group.clubId,
    competitionId: group.competitionId,
    season: "2026/27",
    snapshotDate: "2026-08-27",
    shirtNumber: null,
    sourcePosition: p.position,
    primaryPosition: p.position,
    secondaryPositions: [],
    rosterStatus: "CONFIRMED",
    contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
    rosterConfidence: p.recordConfidence,
    sourceRefs: { roster: ["src_intl_pool_v0_1"], position: ["src_intl_pool_v0_1"] },
    dataNotes: [],
  }));

  const sources = [
    {
      sourceId: "src_intl_pool_v0_1",
      sourceType: "USER_COMPILED",
      publisher: "User-provided research compilation",
      title: "HANDBALL MANAGER — International Player Pool v0.1",
      url: null,
      publishedAt: "2026-08-27",
      accessedAt: "2026-08-27",
      seasonContext: "2026/27",
    },
  ];

  const qc = {
    clubId: group.clubId,
    clubName: group.clubDisplayName,
    competitionId: group.competitionId,
    season: "2026/27",
    snapshotDate: "2026-08-27",
    datasetStatus: "PRESEASON",
    qcStatus: "VERIFIED",
    expectedRosterCount: players.length,
    exportedRosterCount: players.length,
    checks: {
      currentLeagueRosterLocated: true,
      allLeagueRosterNamesCaptured: false, // Part: this is a curated 100-player POOL, never a full league/club roster
      incomingTransfersChecked: false,
      departuresChecked: false,
      duplicatePlayers: 0,
      canonicalPositionsValid: true,
      guessedSecondaryPositions: 0,
      guessedDatesOfBirth: 0,
      guessedHeights: players.length,
      guessedNationalities: 0,
      guessedContractDates: players.length,
    },
    knownConflicts: [],
    staleSourceWarnings: [
      "HM-WORLD-PLAYER-POOL-1.0: this club's roster here is ONLY the subset of players present in the 100-player international pool -- never presented or treated as that club's complete real squad.",
    ],
    openFieldsSummary: {
      exactDateOfBirthMissing: players.filter((p) => !p.dateOfBirth).length,
      heightMissing: players.length,
      handednessMissing: players.length,
      shirtNumberMissing: players.length,
      contractEndMissing: players.length,
    },
  };

  const manifest = {
    milestone: "HM-WORLD-PLAYER-POOL-1.0",
    club: group.clubDisplayName,
    snapshotDate: "2026-08-27",
    files: [`players-${slug(group.clubDisplayName)}.json`, `roster-${slug(group.clubDisplayName)}-2026-27.json`, `qc-${slug(group.clubDisplayName)}.json`, `sources-${slug(group.clubDisplayName)}.json`, "schema-foundation-v0.2.json"],
  };

  const compSlug = slug(group.competitionId);
  // Part: a handful of source club display names contain "/" (e.g.
  // "Humby/Bevo HC") -- sanitized for the DIRECTORY name only; the JSON
  // files themselves still carry the exact original display name.
  const clubDirName = group.clubDisplayName.replace(/[/\\]/g, " - ");
  const clubDir = path.join(OUT_ROOT, compSlug, clubDirName);
  writeJson(path.join(clubDir, "manifest.json"), manifest);
  writeJson(path.join(clubDir, `qc-${slug(group.clubDisplayName)}.json`), qc);
  writeJson(path.join(clubDir, `sources-${slug(group.clubDisplayName)}.json`), sources);
  writeJson(path.join(clubDir, "schema-foundation-v0.2.json"), SCHEMA_FOUNDATION);
  writeJson(path.join(clubDir, `players-${slug(group.clubDisplayName)}.json`), playersJson);
  writeJson(path.join(clubDir, `roster-${slug(group.clubDisplayName)}-2026-27.json`), rosterJson);

  totalPlayers += players.length;
}

console.log(`Generated world player pool data: ${clubGroups.size} clubs, ${totalPlayers} players.`);
for (const g of clubGroups.values()) {
  console.log(`  ${g.clubId} (${g.competitionId}): ${g.rows.length} players -- ${g.clubDisplayName}`);
}
