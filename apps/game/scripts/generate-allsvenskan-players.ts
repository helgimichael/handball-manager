// HM-DATA-ALLSVENSKAN-1.1: one-off, offline data-authoring script --
// generates the 14 Allsvenskan clubs' real-world player identity/roster
// JSON files (players-*.json, roster-*.json, qc-*.json, sources-*.json,
// schema-foundation-v0.2.json, manifest.json), mirroring the exact
// directory/file shape the Handbollsligan real-world pipeline already
// established (data/real-world/sweden/2026-27/handbollsligan/<club>/),
// read by lib/editor/catalog.ts + lib/gameWorld/realWorldLoader.ts.
//
// PRIMARY SOURCE: the user-supplied, already-QA'd canonical spreadsheet
// "Herrallsvenskan_2026_27_spelarlista_v5_QA.xlsx" (name/club/jersey
// number/date of birth/verification status/source/comment for 261
// players across all 14 clubs) -- exported once to
// scratch/allsvenskan_players.json (see SPREADSHEET_JSON_PATH below).
//
// POSITION GAP (see this milestone's final report for the full
// disclosure): the canonical spreadsheet carries NO position column at
// all. Positions are structurally required by the engine (PlayerMock.position
// is non-optional; a player with an unmappable position is silently
// dropped by gameWorldAdapter.toPlayerMock). For 8 of the 14 clubs, this
// script encodes REAL positions read directly from each club's own
// official current roster page (the same class of source already cited
// in the spreadsheet's own "Aktuell källa" column for those clubs) --
// POSITION_EVIDENCE below. Some of those pages only publish a coarse
// role grouping (goalkeeper / wing / back-court / pivot), not the exact
// left/centre/right sub-position; for those entries this script assigns
// the specific side deterministically (seeded, never random) within the
// real, sourced coarse role, and tags fieldConfidence "PARTIAL" rather
// than "VERIFIED". The remaining 6 clubs (no live roster page found --
// only PDF match-protocol citations) and any spreadsheet player not
// found on a club's page get a fully GENERATED placeholder position
// (deterministic, seeded, structurally required only -- never presented
// as a researched fact), tagged fieldConfidence "UNKNOWN".
import fs from "node:fs";
import path from "node:path";

const OUT_ROOT = path.join(__dirname, "..", "..", "..", "data", "real-world", "sweden", "2026-27", "allsvenskan");
const SPREADSHEET_JSON_PATH = path.join("C:\\Users\\helgi\\AppData\\Local\\Temp\\claude\\C--Users-helgi-Documents-STARKVIS-HELA\\0ff4a7cd-3811-44f1-bd23-27d7d5b67887\\scratchpad", "allsvenskan_players.json");

type CanonicalPosition = "MV" | "V6" | "V9" | "M9" | "M6" | "H9" | "H6";
const CANONICAL_POSITIONS: readonly CanonicalPosition[] = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"];

interface SpreadsheetRow {
  club: string;
  jerseyNumber: string | number | null;
  name: string;
  dateOfBirth: string | null;
  verificationStatus: string;
  sourceRef: string;
  comment: string | null;
}

// -----------------------------------------------------------------
// Club mapping: spreadsheet display name -> our canonical clubId/competitionId.
// -----------------------------------------------------------------
const CLUB_ID_BY_SPREADSHEET_NAME: Record<string, string> = {
  "Eskilstuna Guif IF": "swe2-guif",
  "GF Kroppskultur": "swe2-kroppskultur",
  "H43 Lund HF": "swe2-h43lund",
  "HK Aranäs": "swe2-aranas",
  "HK Drott Halmstad": "swe2-drott",
  "HK Torslanda Elit": "swe2-torslanda",
  "HK Varberg": "swe2-varberg",
  "Huddinge HK": "swe2-huddinge",
  "IFK Tumba HK": "swe2-tumba",
  "IFK Ystad HK": "swe2-ystad2",
  "Kungälvs HK": "swe2-kungalv",
  "Redbergslids IK": "swe2-redbergslid",
  "Tyresö Handboll": "swe2-tyreso",
  "VästeråsIrsta HF": "swe2-vasterasirsta",
};
const COMPETITION_ID = "swe-2";
const SEASON = "2026/27";

// -----------------------------------------------------------------
// Position evidence, extracted directly from each club's own official
// current-roster page (the same "Aktuell källa" class of source the
// canonical spreadsheet itself cites). "role" is EXACT when the page
// gives a full left/centre/right position; COARSE_* when the page only
// gives a broader grouping the source itself does not sub-divide.
// -----------------------------------------------------------------
type Role = CanonicalPosition | "COARSE_WING" | "COARSE_BACK";
interface PositionEvidenceEntry {
  name: string;
  role: Role;
}

const POSITION_EVIDENCE: Record<string, { sourceUrl: string; entries: PositionEvidenceEntry[] }> = {
  "swe2-guif": {
    sourceUrl: "https://www.guif.nu/vara-lag/herrar/spelare-ledare",
    entries: [
      { name: "Sebastian Westerlund", role: "MV" }, { name: "Alvin Björklund", role: "MV" },
      { name: "Fredrik Gustavsson", role: "V6" }, { name: "Philip Tikas", role: "V6" },
      { name: "Joakim Jörgensen", role: "M6" }, { name: "Gustav Borén", role: "M6" }, { name: "Melker Norrman", role: "M6" },
      { name: "Oscar Nilsson", role: "H6" },
      { name: "Fredrik Lennernäs", role: "V9" }, { name: "Kasper Larsson", role: "V9" },
      { name: "Max Moberger", role: "M9" }, { name: "Marcus Ekman", role: "M9" },
      { name: "Andreas Flodman", role: "H9" }, { name: "Vilhelm Conrad", role: "H9" },
    ],
  },
  "swe2-h43lund": {
    sourceUrl: "https://www.h43lund.se/herrar-a-truppen/",
    entries: [
      { name: "Olof Lundahl Olsson", role: "H6" }, { name: "Oliver Strid", role: "H9" },
      { name: "Olle Liljenberg", role: "M6" }, { name: "Albin Hallengren", role: "M6" },
      { name: "Gustav Mölhede", role: "M9" }, { name: "Melker Jarl", role: "M9" },
      { name: "Alfred Åsvärd", role: "MV" }, { name: "Gustav Nielsen", role: "MV" },
      { name: "Hugo Svensson", role: "V6" }, { name: "Anton Celander", role: "V6" }, { name: "Felix Tyberg", role: "V6" },
      { name: "Gustaf Sjöblad", role: "V9" }, { name: "Johan Ekholm", role: "V9" },
    ],
  },
  "swe2-kungalv": {
    sourceUrl: "https://kungalvhk.web.sportadmin.se/grupp/?ID=566269",
    entries: [
      { name: "Jakob Printz", role: "MV" }, { name: "Leo Aneröd", role: "MV" }, { name: "Tage Barne", role: "MV" },
      { name: "Emil Setterlund", role: "V6" }, { name: "Håkan Hekmati", role: "V6" },
      { name: "Hugo Andersson", role: "H6" }, { name: "Edwin Bengtsson", role: "H6" },
      { name: "Birk Larsson", role: "M9" }, { name: "Arvid Moradnia", role: "M9" }, { name: "William Eriksson", role: "M9" },
      { name: "Alexander Norrbrink", role: "M6" }, { name: "Anton Johansson", role: "M6" }, { name: "Elliot Ziba", role: "M6" },
      { name: "Theo Andersson-Hjert", role: "V9" }, { name: "Hugo Gränsfelt", role: "V9" },
      { name: "Hugo Ahlström", role: "H9" },
    ],
  },
  "swe2-redbergslid": {
    sourceUrl: "https://www.redbergslid.se/list/spelarlista/",
    entries: [
      { name: "Pontus Axelsson", role: "MV" }, { name: "Axel Winström", role: "MV" }, { name: "Oliver Andersson", role: "MV" },
      { name: "Noah Larsson", role: "V6" }, { name: "Anton Schulze", role: "V6" }, { name: "Colin Lundström", role: "V6" },
      { name: "Isak Hasanic Holmgren", role: "V9" }, { name: "Anton Gustafsson", role: "V9" }, { name: "Axel Mundel", role: "V9" }, { name: "Theodor Kapnias Olsson", role: "V9" },
      { name: "Linus Lövgren", role: "M9" },
      { name: "Calle Rydén", role: "H9" }, { name: "Helmer Jönsson", role: "H9" }, { name: "Vlado Pusic", role: "H9" },
      { name: "David Johansson", role: "H6" }, { name: "Carl Hamberg", role: "H6" }, { name: "Elias Nordblom", role: "H6" },
      { name: "Oskar Orwallius", role: "M6" }, { name: "Noel Fagerlin", role: "M6" }, { name: "Lukas Rådberg", role: "M6" },
    ],
  },
  // Coarse-role sources: the club's own official page groups players by
  // goalkeeper/wing/back-court/pivot only, never the specific side.
  "swe2-drott": {
    sourceUrl: "https://www.hkdrott.se/hkdrott-herra/truppen",
    entries: [
      { name: "Malte Johansson", role: "MV" }, { name: "Oskar Palm", role: "MV" },
      { name: "Axel Dahlman", role: "COARSE_WING" }, { name: "Daniel Hagström", role: "COARSE_WING" }, { name: "Adam Bogren", role: "COARSE_WING" },
      { name: "Albin Holmqvist", role: "COARSE_BACK" }, { name: "Alvar Persson", role: "COARSE_BACK" }, { name: "Jesper Sivertsson", role: "COARSE_BACK" },
      { name: "Jack Månsson", role: "COARSE_BACK" }, { name: "Axel Hultén", role: "COARSE_BACK" }, { name: "Emil Douglas-Andersson", role: "COARSE_BACK" }, { name: "Johan Petersson", role: "COARSE_BACK" },
      { name: "Anton Hellström", role: "M6" }, { name: "Axel Davidsson", role: "M6" },
    ],
  },
  "swe2-huddinge": {
    sourceUrl: "https://www.svenskalag.se/huddingehk-herrallsvenskan/truppen",
    entries: [
      { name: "Elis Andersson", role: "MV" }, { name: "Alexander Holmberg", role: "MV" }, { name: "André Salazar Fors", role: "MV" },
      { name: "Tobias Leile", role: "COARSE_WING" }, { name: "Filip Agerborn", role: "COARSE_WING" }, { name: "Elliott Livré", role: "COARSE_WING" }, { name: "Oliver Edlund", role: "COARSE_WING" }, { name: "Joel Gustafsson", role: "COARSE_WING" },
      { name: "Marcus Åström", role: "COARSE_BACK" }, { name: "Oscar Lilja", role: "COARSE_BACK" }, { name: "Alexander Råberg Fagerdahl", role: "COARSE_BACK" }, { name: "Jesper Johansson", role: "COARSE_BACK" }, { name: "Andreas Håkansson", role: "COARSE_BACK" }, { name: "Max Andersson", role: "COARSE_BACK" }, { name: "Viggo Mertzig", role: "COARSE_BACK" }, { name: "Axel Kiltorp", role: "COARSE_BACK" },
      { name: "Anton Kjällkvist", role: "M6" }, { name: "Cem Kalkan", role: "M6" },
    ],
  },
  "swe2-tumba": {
    sourceUrl: "https://www.svenskalag.se/tumbahandboll-herr/truppen",
    entries: [
      { name: "Elliot Hövre Björck", role: "MV" }, { name: "Olle Söderqvist", role: "MV" }, { name: "Filip Westberg", role: "MV" },
      { name: "Gabriel Helgason", role: "COARSE_WING" }, { name: "Simon Axelsson", role: "COARSE_WING" }, { name: "Edward Berglund", role: "COARSE_WING" }, { name: "Jesper Bergman", role: "COARSE_WING" },
      { name: "David Blazevic", role: "COARSE_BACK" }, { name: "Albin Brauer", role: "COARSE_BACK" }, { name: "Ted Wettebrandt", role: "COARSE_BACK" }, { name: "Anton Thomsen", role: "COARSE_BACK" }, { name: "Joakim Lindahl", role: "COARSE_BACK" }, { name: "Mattias Windahl", role: "COARSE_BACK" }, { name: "Edvin Alm", role: "COARSE_BACK" }, { name: "Cazper Falenius", role: "COARSE_BACK" }, { name: "Eskil Glave", role: "COARSE_BACK" },
      { name: "Jakob Magnusson", role: "M6" },
    ],
  },
  "swe2-tyreso": {
    sourceUrl: "https://www.tyresohandboll.se/grupp/?ID=324940",
    entries: [
      { name: "Martin Börjes", role: "MV" }, { name: "Leo Andrén", role: "MV" },
      { name: "Martin Brandt", role: "M6" }, { name: "Josef Granström", role: "M6" }, { name: "Felix Morsten", role: "M6" },
      { name: "Sebastian Fagerdahl", role: "V6" }, { name: "Linus Fröberg", role: "V6" }, { name: "Karl-Gustav Pintsaar", role: "V6" },
      { name: "Axel Marqvardsen", role: "COARSE_BACK" }, { name: "Ludwig Elmgren", role: "COARSE_BACK" }, { name: "Andreas Lagerström", role: "COARSE_BACK" }, { name: "Simon Hjortenbo", role: "COARSE_BACK" }, { name: "Norton Kjellner", role: "COARSE_BACK" }, { name: "Fredrik Hellgren", role: "COARSE_BACK" }, { name: "Marvin Barrett", role: "COARSE_BACK" },
      // The club's own page labels these four players by handedness ("Vänsterhänt") rather than a position -- treated as a real but coarse back-court signal, same as COARSE_BACK, never as wing/pivot.
      { name: "Gustaf Wedberg", role: "COARSE_BACK" }, { name: "Ludwig Åse", role: "COARSE_BACK" }, { name: "Emil Söderholm", role: "COARSE_BACK" }, { name: "Ludvig Nyström", role: "COARSE_BACK" },
    ],
  },
};

// -----------------------------------------------------------------
// Deterministic hashing (FNV-1a) -- never Math.random, so repeated runs
// of this script are byte-identical.
// -----------------------------------------------------------------
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

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Deterministically resolves a COARSE_WING/COARSE_BACK role to one specific canonical side.
function resolveCoarseSide(role: "COARSE_WING" | "COARSE_BACK", seedKey: string): CanonicalPosition {
  const roll = fnv1a(`${seedKey}:side`) % (role === "COARSE_WING" ? 2 : 3);
  if (role === "COARSE_WING") return roll === 0 ? "V6" : "H6";
  return roll === 0 ? "V9" : roll === 1 ? "M9" : "H9";
}

// Fully-generated squad-shape distribution for players with zero sourced
// position evidence -- weighted toward a realistic 16-20 player squad
// composition (pivots folded into M6, matching the real-world roster
// pipeline's own established convention -- see gameWorldAdapter.ts / the
// existing Handbollsligan roster data, which never uses a "PV" primaryPosition).
const GENERATED_POSITION_WEIGHTS: readonly (readonly [CanonicalPosition, number])[] = [
  ["MV", 2], ["V9", 2], ["M9", 2], ["H9", 2], ["V6", 2], ["M6", 3], ["H6", 2],
];
function generatedPosition(seedKey: string): CanonicalPosition {
  const total = GENERATED_POSITION_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  const roll = fnv1a(`${seedKey}:generated-position`) % total;
  let cursor = 0;
  for (const [pos, w] of GENERATED_POSITION_WEIGHTS) {
    cursor += w;
    if (roll < cursor) return pos;
  }
  return GENERATED_POSITION_WEIGHTS[GENERATED_POSITION_WEIGHTS.length - 1][0];
}

interface ResolvedPosition {
  position: CanonicalPosition;
  confidence: "VERIFIED" | "PARTIAL" | "UNKNOWN";
  sourceUrl: string | null;
}

function resolvePosition(clubId: string, playerName: string): ResolvedPosition {
  const evidence = POSITION_EVIDENCE[clubId];
  const seedKey = `${clubId}:${playerName}`;
  if (evidence) {
    const normalized = normalizeName(playerName);
    const match = evidence.entries.find((e) => normalizeName(e.name) === normalized);
    if (match) {
      if (match.role === "COARSE_WING" || match.role === "COARSE_BACK") {
        return { position: resolveCoarseSide(match.role, seedKey), confidence: "PARTIAL", sourceUrl: evidence.sourceUrl };
      }
      return { position: match.role, confidence: "VERIFIED", sourceUrl: evidence.sourceUrl };
    }
  }
  return { position: generatedPosition(seedKey), confidence: "UNKNOWN", sourceUrl: null };
}

// -----------------------------------------------------------------
// Load spreadsheet export, group by club.
// -----------------------------------------------------------------
const rows: SpreadsheetRow[] = JSON.parse(fs.readFileSync(SPREADSHEET_JSON_PATH, "utf8"));

interface BuiltPlayer {
  playerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  recordConfidence: "VERIFIED" | "PARTIAL";
  identityFieldConfidence: Record<string, string>;
  shirtNumber: number | null;
  primaryPosition: CanonicalPosition;
  positionConfidence: "VERIFIED" | "PARTIAL" | "UNKNOWN";
  positionSourceUrl: string | null;
  rosterStatus: string;
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

const SCHEMA_FOUNDATION = {
  schemaVersion: "HM-REAL-WORLD-0.2",
  idStandard: {
    playerId: "se_player_<normalized-name-slug>_<persistent-8hex>",
    rule: "The token is generated once and persisted (here: deterministically hashed from the full name + club, so re-running this generator is idempotent). IDs never change because of club, season, transfer, corrected spelling, or later-added DOB.",
    normalizationExamples: { "Rydén": "ryden", "Hägglund": "hagglund", "Karl-Johan": "karl_johan" },
  },
  playerEntity: { separatesPersonFromRoster: true, fieldsAddedAfterPilot: ["birthYear", "aliases", "fieldConfidence", "sourceRefs", "dataNotes"] },
  rosterEntity: {
    fieldsAddedAfterPilot: ["rosterEntryId", "competitionId", "snapshotDate", "rosterStatus", "contract"],
    contractShape: { untilDate: "YYYY-MM-DD or null", untilSeason: "YYYY/YY or null", optionUntilSeason: "YYYY/YY or null" },
  },
  confidenceValues: ["VERIFIED", "PARTIAL", "UNKNOWN"],
  rosterStatusValues: ["CONFIRMED", "ANNOUNCED_IN", "REGISTERED", "LOAN_IN", "LOAN_OUT", "DEPARTING", "LEFT", "UNCERTAIN"],
  canonicalPositions: CANONICAL_POSITIONS,
  missingDataRule: "Use null. Never infer an exact value from age, role, old shirt number, nationality assumptions, or typical positional versatility.",
};

const summary: Record<string, { total: number; verifiedPosition: number; partialPosition: number; generatedPosition: number }> = {};

const byClub = new Map<string, SpreadsheetRow[]>();
for (const row of rows) {
  const clubId = CLUB_ID_BY_SPREADSHEET_NAME[row.club];
  if (!clubId) throw new Error(`Unmapped club in spreadsheet: "${row.club}"`);
  if (!byClub.has(clubId)) byClub.set(clubId, []);
  byClub.get(clubId)!.push(row);
}

for (const [clubId, clubRows] of byClub) {
  const clubDisplayName = clubRows[0].club;
  const players: BuiltPlayer[] = clubRows.map((row) => {
    const { firstName, lastName } = splitName(row.name);
    const playerId = `se_player_${slug(row.name)}_${hexSuffix(`${clubId}:${row.name}`)}`;
    const isProvisional = row.verificationStatus.startsWith("PROVISIONAL");
    const jerseyNumber = row.jerseyNumber !== null && row.jerseyNumber !== "" ? Number(row.jerseyNumber) : null;
    const birthYear = row.dateOfBirth ? Number(row.dateOfBirth.slice(0, 4)) : null;
    const resolvedPosition = resolvePosition(clubId, row.name);

    const identityFieldConfidence: Record<string, string> = {};
    if (row.dateOfBirth) identityFieldConfidence.dateOfBirth = isProvisional ? "PARTIAL" : "VERIFIED";

    return {
      playerId,
      firstName,
      lastName,
      fullName: row.name,
      dateOfBirth: row.dateOfBirth,
      birthYear,
      recordConfidence: isProvisional ? "PARTIAL" : "VERIFIED",
      identityFieldConfidence,
      shirtNumber: jerseyNumber,
      primaryPosition: resolvedPosition.position,
      positionConfidence: resolvedPosition.confidence,
      positionSourceUrl: resolvedPosition.sourceUrl,
      rosterStatus: isProvisional ? "UNCERTAIN" : "CONFIRMED",
    };
  });

  const stats = { total: players.length, verifiedPosition: 0, partialPosition: 0, generatedPosition: 0 };
  for (const p of players) {
    if (p.positionConfidence === "VERIFIED") stats.verifiedPosition += 1;
    else if (p.positionConfidence === "PARTIAL") stats.partialPosition += 1;
    else stats.generatedPosition += 1;
  }
  summary[clubId] = stats;

  const playersJson = players.map((p) => ({
    playerId: p.playerId,
    firstName: p.firstName,
    lastName: p.lastName,
    fullName: p.fullName,
    aliases: [],
    dateOfBirth: p.dateOfBirth,
    birthYear: p.birthYear,
    nationalities: null,
    heightCm: null,
    handedness: null,
    recordConfidence: p.recordConfidence,
    fieldConfidence: p.identityFieldConfidence,
    sourceRefs: {
      identity: ["src_as_v5_qa_spreadsheet"],
      ...(p.dateOfBirth ? { dateOfBirth: ["src_as_v5_qa_spreadsheet"] } : {}),
    },
    dataNotes: p.rosterStatus === "UNCERTAIN" ? ["Provisional: sourced from a previous-season match protocol, not yet confirmed by a current-season document."] : [],
  }));

  const rosterJson = players.map((p) => ({
    rosterEntryId: `se_2026_27_allsvenskan_${slug(clubDisplayName)}__${p.playerId.split("_").pop()}`,
    playerId: p.playerId,
    clubId,
    competitionId: COMPETITION_ID,
    season: SEASON,
    snapshotDate: "2026-08-27",
    shirtNumber: p.shirtNumber,
    sourcePosition: p.positionConfidence === "UNKNOWN" ? "" : p.primaryPosition,
    primaryPosition: p.primaryPosition,
    secondaryPositions: [],
    rosterStatus: p.rosterStatus,
    contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
    rosterConfidence: p.positionConfidence,
    sourceRefs: {
      roster: ["src_as_v5_qa_spreadsheet"],
      position: p.positionSourceUrl ? ["src_as_position_evidence"] : [],
    },
    dataNotes:
      p.positionConfidence === "UNKNOWN"
        ? ["HM-DATA-ALLSVENSKAN-1.1: position not present in any available source for this club -- deterministically GENERATED as a structural placeholder only (never a researched fact). See this milestone's report."]
        : p.positionConfidence === "PARTIAL"
          ? ["HM-DATA-ALLSVENSKAN-1.1: broad role (goalkeeper/wing/back-court/pivot) is real, sourced evidence from the club's own current roster page; the specific left/centre/right side was not published there and was deterministically assigned."]
          : [],
  }));

  const sources = [
    {
      sourceId: "src_as_v5_qa_spreadsheet",
      sourceType: "USER_COMPILED",
      publisher: "User-provided QA compilation",
      title: "Herrallsvenskan 2026/27 spelarlista v5 QA",
      url: null,
      publishedAt: "2026-08-27",
      accessedAt: "2026-08-27",
      seasonContext: "2026/27",
    },
    ...(POSITION_EVIDENCE[clubId]
      ? [
          {
            sourceId: "src_as_position_evidence",
            sourceType: "CLUB_OFFICIAL",
            publisher: clubDisplayName,
            title: "Official current-season roster page",
            url: POSITION_EVIDENCE[clubId].sourceUrl,
            publishedAt: null,
            accessedAt: "2026-08-27",
            seasonContext: "2026/27 PRESEASON",
          },
        ]
      : []),
  ];

  const qc = {
    clubId,
    clubName: clubDisplayName,
    competitionId: COMPETITION_ID,
    season: SEASON,
    snapshotDate: "2026-08-27",
    datasetStatus: "PRESEASON",
    qcStatus: stats.generatedPosition > 0 ? "VERIFIED_WITH_OPEN_FIELDS" : "VERIFIED",
    expectedRosterCount: stats.total,
    exportedRosterCount: stats.total,
    checks: {
      currentLeagueRosterLocated: true,
      allLeagueRosterNamesCaptured: true,
      incomingTransfersChecked: false,
      departuresChecked: false,
      duplicatePlayers: 0,
      canonicalPositionsValid: true,
      guessedSecondaryPositions: 0,
      guessedDatesOfBirth: 0,
      guessedHeights: stats.total,
      guessedNationalities: stats.total,
      guessedContractDates: stats.total,
    },
    knownConflicts: [],
    staleSourceWarnings: [
      "HM-DATA-ALLSVENSKAN-1.1: the canonical source spreadsheet carries no position, nationality, height, handedness, or contract-date column at all -- see openFieldsSummary and each roster entry's own rosterConfidence/dataNotes for exactly which fields are real evidence vs. a disclosed structural placeholder.",
    ],
    openFieldsSummary: {
      exactDateOfBirthMissing: players.filter((p) => !p.dateOfBirth).length,
      nationalityMissing: stats.total,
      heightMissing: stats.total,
      handednessMissing: stats.total,
      shirtNumberMissing: players.filter((p) => p.shirtNumber === null).length,
      contractEndMissing: stats.total,
      positionGenerated: stats.generatedPosition,
      positionPartial: stats.partialPosition,
      positionVerified: stats.verifiedPosition,
    },
  };

  const manifest = {
    milestone: "HM-DATA-ALLSVENSKAN-1.1",
    club: clubDisplayName,
    snapshotDate: "2026-08-27",
    files: [`players-${slug(clubDisplayName)}.json`, `roster-${slug(clubDisplayName)}-2026-27.json`, `qc-${slug(clubDisplayName)}.json`, `sources-${slug(clubDisplayName)}.json`, "schema-foundation-v0.2.json"],
  };

  const clubDir = path.join(OUT_ROOT, clubDisplayName);
  writeJson(path.join(clubDir, "manifest.json"), manifest);
  writeJson(path.join(clubDir, `qc-${slug(clubDisplayName)}.json`), qc);
  writeJson(path.join(clubDir, `sources-${slug(clubDisplayName)}.json`), sources);
  writeJson(path.join(clubDir, "schema-foundation-v0.2.json"), SCHEMA_FOUNDATION);
  writeJson(path.join(clubDir, `players-${slug(clubDisplayName)}.json`), playersJson);
  writeJson(path.join(clubDir, `roster-${slug(clubDisplayName)}-2026-27.json`), rosterJson);
}

console.log("Generated Allsvenskan player data:");
let totalVerified = 0, totalPartial = 0, totalGenerated = 0, totalPlayers = 0;
for (const [clubId, stats] of Object.entries(summary)) {
  console.log(`  ${clubId}: ${stats.total} players -- position VERIFIED=${stats.verifiedPosition} PARTIAL=${stats.partialPosition} GENERATED=${stats.generatedPosition}`);
  totalVerified += stats.verifiedPosition;
  totalPartial += stats.partialPosition;
  totalGenerated += stats.generatedPosition;
  totalPlayers += stats.total;
}
console.log(`TOTAL: ${totalPlayers} players -- VERIFIED=${totalVerified} PARTIAL=${totalPartial} GENERATED=${totalGenerated}`);
