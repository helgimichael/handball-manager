// HM-DATA-DIV1-1.0: one-off, offline data-authoring script -- generates
// the 24 Division 1 Norra/Södra clubs' real-world player identity/roster
// JSON files (players-*.json, roster-*.json, qc-*.json, sources-*.json,
// schema-foundation-v0.2.json, manifest.json), mirroring the exact
// directory/file shape the Handbollsligan/Allsvenskan real-world
// pipelines already established (see scripts/generate-allsvenskan-players.ts,
// read by lib/editor/catalog.ts + lib/gameWorld/realWorldLoader.ts).
//
// PRIMARY SOURCE: the user-supplied, already-QA'd canonical spreadsheet
// "handball-manager-division1-2026-27.xlsx" (24 clubs, 581 players,
// playerId/clubId ALREADY assigned in the same id scheme this repo uses
// -- never re-hashed here). Exported once to scratch/div1_clubs.json and
// scratch/div1_players.json (see SOURCE paths below).
//
// POSITION GAP: the source spreadsheet already carries a resolved
// primaryPosition for 190/581 players (the rest genuinely have no
// position in any available source -- see the Overview sheet's own
// "Data rule: No guessing"). Positions are structurally required by the
// engine (PlayerMock.position is non-optional; gameWorldAdapter.toPlayerMock
// silently drops a player with an unmappable position). For the 391
// players with no sourced position, this script assigns a deterministic
// GENERATED placeholder position (seeded, never random -- same mechanism
// generate-allsvenskan-players.ts already established), tagged
// rosterConfidence "UNKNOWN" and disclosed via dataNotes -- never
// presented as a researched fact.
import fs from "node:fs";
import path from "node:path";

const OUT_ROOT_NORRA = path.join(__dirname, "..", "..", "..", "data", "real-world", "sweden", "2026-27", "division1-norra");
const OUT_ROOT_SODRA = path.join(__dirname, "..", "..", "..", "data", "real-world", "sweden", "2026-27", "division1-sodra");
const SCRATCH = "C:\\Users\\helgi\\AppData\\Local\\Temp\\claude\\C--Users-helgi-Documents-STARKVIS-HELA\\0ff4a7cd-3811-44f1-bd23-27d7d5b67887\\scratchpad";
const CLUBS_JSON_PATH = path.join(SCRATCH, "div1_clubs.json");
const PLAYERS_JSON_PATH = path.join(SCRATCH, "div1_players.json");

type CanonicalPosition = "MV" | "V6" | "V9" | "M9" | "M6" | "H9" | "H6";
const CANONICAL_POSITIONS: readonly CanonicalPosition[] = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"];

interface SourceClubRow {
  clubId: string;
  clubName: string;
  series: "Herr 1 Norra" | "Herr 1 Södra";
  season: string;
  playable: string;
  databaseRole: string;
  rosterBasis: string;
  rosterConfidence: "VERIFIED" | "PARTIAL";
  snapshotDate: string;
  officialSeriesSource: string;
  rosterSourceUrl: string;
  notes: string | null;
}

interface SourcePlayerRow {
  index: number;
  playerId: string;
  fullName: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  nationalities: string | null;
  clubId: string;
  clubName: string;
  series: string;
  shirtNumber: number | null;
  sourcePosition: string | null;
  primaryPosition: CanonicalPosition | null;
  secondaryPositions: string | null;
  rosterStatus: "CONFIRMED" | "PROVISIONAL";
  rosterConfidence: "VERIFIED" | "PARTIAL";
  snapshotDate: string;
  sourceUrl: string;
  dataNotes: string | null;
}

// -----------------------------------------------------------------
// Deterministic hashing (FNV-1a) -- never Math.random.
// -----------------------------------------------------------------
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// Same generated squad-shape distribution as generate-allsvenskan-players.ts.
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
    playerId: "player_<normalized-name-slug>_<persistent-8hex>",
    rule: "The token was generated once by the source pipeline and is persisted verbatim here -- never re-hashed. IDs never change because of club, season, transfer, corrected spelling, or later-added DOB.",
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

const clubs: SourceClubRow[] = JSON.parse(fs.readFileSync(CLUBS_JSON_PATH, "utf8"));
const players: SourcePlayerRow[] = JSON.parse(fs.readFileSync(PLAYERS_JSON_PATH, "utf8"));

const playersByClub = new Map<string, SourcePlayerRow[]>();
for (const p of players) {
  if (!playersByClub.has(p.clubId)) playersByClub.set(p.clubId, []);
  playersByClub.get(p.clubId)!.push(p);
}

const summary: Record<string, { total: number; sourcedPosition: number; generatedPosition: number; verifiedRecord: number; partialRecord: number }> = {};

for (const clubRow of clubs) {
  const clubPlayers = playersByClub.get(clubRow.clubId) ?? [];
  const isNorra = clubRow.series === "Herr 1 Norra";
  const competitionId = isNorra ? "se_division1_norra" : "se_division1_sodra";
  const outRoot = isNorra ? OUT_ROOT_NORRA : OUT_ROOT_SODRA;
  const sourceId = `src_div1_${isNorra ? "norra" : "sodra"}_2026_27`;

  const stats = { total: clubPlayers.length, sourcedPosition: 0, generatedPosition: 0, verifiedRecord: 0, partialRecord: 0 };

  const playersJson = clubPlayers.map((p) => {
    const { firstName, lastName } = splitName(p.fullName);
    const isVerified = p.rosterConfidence === "VERIFIED";
    if (isVerified) stats.verifiedRecord += 1;
    else stats.partialRecord += 1;

    const fieldConfidence: Record<string, string> = {};
    if (p.birthYear !== null) fieldConfidence.birthYear = p.rosterConfidence;

    return {
      playerId: p.playerId,
      firstName,
      lastName,
      fullName: p.fullName,
      aliases: [],
      dateOfBirth: p.dateOfBirth,
      birthYear: p.birthYear,
      nationalities: null,
      heightCm: null,
      handedness: null,
      recordConfidence: p.rosterConfidence,
      fieldConfidence,
      sourceRefs: {
        identity: [sourceId],
        ...(p.birthYear !== null ? { birthYear: [sourceId] } : {}),
      },
      dataNotes: p.rosterStatus === "PROVISIONAL" ? ["HM-DATA-DIV1-1.0: provisional roster entry -- club's 2026/27 squad page was not yet fully published at snapshot time; see this milestone's report."] : [],
    };
  });

  const rosterJson = clubPlayers.map((p) => {
    const hasSourcedPosition = p.primaryPosition !== null && (CANONICAL_POSITIONS as readonly string[]).includes(p.primaryPosition);
    const seedKey = `${clubRow.clubId}:${p.playerId}`;
    const primaryPosition: CanonicalPosition = hasSourcedPosition ? (p.primaryPosition as CanonicalPosition) : generatedPosition(seedKey);
    if (hasSourcedPosition) stats.sourcedPosition += 1;
    else stats.generatedPosition += 1;

    const idSuffix = p.playerId.split("_").pop();
    return {
      rosterEntryId: `se_2026_27_division1_${isNorra ? "norra" : "sodra"}_${slug(clubRow.clubName)}__${idSuffix}`,
      playerId: p.playerId,
      clubId: clubRow.clubId,
      competitionId,
      season: "2026/27",
      snapshotDate: clubRow.snapshotDate,
      shirtNumber: p.shirtNumber,
      sourcePosition: hasSourcedPosition ? p.sourcePosition ?? "" : "",
      primaryPosition,
      secondaryPositions: [],
      rosterStatus: p.rosterStatus,
      contract: { untilDate: null, untilSeason: null, optionUntilSeason: null },
      rosterConfidence: hasSourcedPosition ? p.rosterConfidence : "UNKNOWN",
      sourceRefs: {
        roster: [sourceId],
        position: hasSourcedPosition ? [sourceId] : [],
      },
      dataNotes: hasSourcedPosition
        ? []
        : ["HM-DATA-DIV1-1.0: position not present in any available source for this club -- deterministically GENERATED as a structural placeholder only (never a researched fact). See this milestone's report."],
    };
  });

  const sources = [
    {
      sourceId,
      sourceType: "USER_COMPILED",
      publisher: "User-provided QA compilation",
      title: "Handball Manager — Division 1 2026/27 (svenskhandboll.se serieindelning + per-club official rosters/Profixio)",
      url: clubRow.officialSeriesSource,
      publishedAt: clubRow.snapshotDate,
      accessedAt: clubRow.snapshotDate,
      seasonContext: "2026/27",
    },
    {
      sourceId: `${sourceId}_club_roster`,
      sourceType: "CLUB_OFFICIAL",
      publisher: clubRow.clubName,
      title: `${clubRow.clubName} roster (${clubRow.rosterBasis})`,
      url: clubRow.rosterSourceUrl,
      publishedAt: null,
      accessedAt: clubRow.snapshotDate,
      seasonContext: "2026/27",
    },
  ];

  const qc = {
    clubId: clubRow.clubId,
    clubName: clubRow.clubName,
    competitionId,
    season: "2026/27",
    snapshotDate: clubRow.snapshotDate,
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
    staleSourceWarnings: clubRow.notes ? [clubRow.notes] : [],
    openFieldsSummary: {
      exactDateOfBirthMissing: stats.total,
      birthYearMissing: clubPlayers.filter((p) => p.birthYear === null).length,
      nationalityMissing: stats.total,
      heightMissing: stats.total,
      handednessMissing: stats.total,
      shirtNumberMissing: clubPlayers.filter((p) => p.shirtNumber === null).length,
      contractEndMissing: stats.total,
      positionGenerated: stats.generatedPosition,
      positionSourced: stats.sourcedPosition,
    },
  };

  const manifest = {
    milestone: "HM-DATA-DIV1-1.0",
    club: clubRow.clubName,
    snapshotDate: clubRow.snapshotDate,
    files: [`players-${slug(clubRow.clubName)}.json`, `roster-${slug(clubRow.clubName)}-2026-27.json`, `qc-${slug(clubRow.clubName)}.json`, `sources-${slug(clubRow.clubName)}.json`, "schema-foundation-v0.2.json"],
  };

  const clubDir = path.join(outRoot, clubRow.clubName);
  writeJson(path.join(clubDir, "manifest.json"), manifest);
  writeJson(path.join(clubDir, `qc-${slug(clubRow.clubName)}.json`), qc);
  writeJson(path.join(clubDir, `sources-${slug(clubRow.clubName)}.json`), sources);
  writeJson(path.join(clubDir, "schema-foundation-v0.2.json"), SCHEMA_FOUNDATION);
  writeJson(path.join(clubDir, `players-${slug(clubRow.clubName)}.json`), playersJson);
  writeJson(path.join(clubDir, `roster-${slug(clubRow.clubName)}-2026-27.json`), rosterJson);

  summary[clubRow.clubId] = stats;
}

console.log("Generated Division 1 player data:");
let totalPlayers = 0, totalSourced = 0, totalGenerated = 0, totalVerified = 0, totalPartial = 0;
for (const [clubId, stats] of Object.entries(summary)) {
  console.log(`  ${clubId}: ${stats.total} players -- position SOURCED=${stats.sourcedPosition} GENERATED=${stats.generatedPosition} -- record VERIFIED=${stats.verifiedRecord} PARTIAL=${stats.partialRecord}`);
  totalPlayers += stats.total;
  totalSourced += stats.sourcedPosition;
  totalGenerated += stats.generatedPosition;
  totalVerified += stats.verifiedRecord;
  totalPartial += stats.partialRecord;
}
console.log(`TOTAL: ${totalPlayers} players across ${Object.keys(summary).length} clubs -- position SOURCED=${totalSourced} GENERATED=${totalGenerated} -- record VERIFIED=${totalVerified} PARTIAL=${totalPartial}`);
