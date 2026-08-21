// Real-world data catalog (HM-DATA-EDITOR-0.1, Spec S7/S11/S40).
//
// Walks the one allowed data root (nation/season/competition/club) and
// resolves each club's actual manifest.json to find its real
// players/roster/sources/qc filenames -- never assumes a naming
// pattern. This is the ONLY place real filesystem paths are produced;
// every API route resolves a client-supplied clubId against this
// catalog and rejects anything that doesn't match an entry the server
// itself discovered.
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_DATA_ROOT } from "./paths";

export interface EditorClubEntry {
  clubId: string;
  clubName: string;
  competitionId: string;
  nation: string;
  season: string;
  competitionSlug: string;
  /** The real, already-resolved directory for this club -- never derived from client input. */
  clubDir: string;
  playersFile: string;
  rosterFile: string;
  sourcesFile: string | null;
  playerCount: number;
}

export interface EditorCatalog {
  clubs: EditorClubEntry[];
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findManifestFile(manifestFiles: unknown, prefix: string): string | null {
  if (!Array.isArray(manifestFiles)) return null;
  const match = manifestFiles.find((f) => typeof f === "string" && f.startsWith(prefix) && f.endsWith(".json"));
  return typeof match === "string" ? match : null;
}

function listDirs(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** Builds the catalog fresh from disk every call -- the dataset is small (tens of clubs), so a cache is not worth the invalidation risk. */
export function buildCatalog(dataRoot: string = DEFAULT_DATA_ROOT): EditorCatalog {
  const clubs: EditorClubEntry[] = [];

  for (const nation of listDirs(dataRoot)) {
    const nationDir = path.join(dataRoot, nation);
    for (const season of listDirs(nationDir)) {
      const seasonDir = path.join(nationDir, season);
      for (const competitionSlug of listDirs(seasonDir)) {
        const competitionDir = path.join(seasonDir, competitionSlug);
        for (const clubFolder of listDirs(competitionDir)) {
          const clubDir = path.join(competitionDir, clubFolder);
          const manifestPath = path.join(clubDir, "manifest.json");
          if (!fs.existsSync(manifestPath)) continue;

          let manifest: unknown;
          try {
            manifest = readJson(manifestPath);
          } catch {
            continue; // malformed manifest -- skip rather than crash the whole catalog
          }
          if (!isPlainObject(manifest)) continue;

          const playersFileName = findManifestFile(manifest.files, "players-");
          const rosterFileName = findManifestFile(manifest.files, "roster-");
          const sourcesFileName = findManifestFile(manifest.files, "sources-");
          if (!playersFileName || !rosterFileName) continue;

          const qcFileName = findManifestFile(manifest.files, "qc-");
          let clubId = "";
          let competitionId = "";
          let clubName = typeof manifest.club === "string" ? manifest.club : clubFolder;
          if (qcFileName) {
            try {
              const qc = readJson(path.join(clubDir, qcFileName));
              if (isPlainObject(qc)) {
                if (typeof qc.clubId === "string") clubId = qc.clubId;
                if (typeof qc.competitionId === "string") competitionId = qc.competitionId;
                if (typeof qc.clubName === "string") clubName = qc.clubName;
              }
            } catch {
              // fall through with whatever we already have
            }
          }
          if (!clubId) continue; // no reliable stable id -- do not expose an unidentifiable club

          let playerCount = 0;
          try {
            const players = readJson(path.join(clubDir, playersFileName));
            if (Array.isArray(players)) playerCount = players.length;
          } catch {
            // leave playerCount at 0 -- the club still appears, just uncounted
          }

          if (!competitionId) {
            // A number of clubs' qc-*.json files are missing competitionId
            // (a real, pre-existing gap in the source dataset -- not
            // something this editor milestone corrects). Every roster
            // entry DOES carry its own competitionId, so fall back to
            // that rather than surfacing an empty grouping.
            try {
              const roster = readJson(path.join(clubDir, rosterFileName));
              if (Array.isArray(roster) && roster.length > 0 && isPlainObject(roster[0]) && typeof roster[0].competitionId === "string") {
                competitionId = roster[0].competitionId;
              }
            } catch {
              // leave competitionId empty -- caller can still see the club, just ungrouped
            }
          }

          clubs.push({
            clubId,
            clubName,
            competitionId,
            nation,
            season,
            competitionSlug,
            clubDir,
            playersFile: path.join(clubDir, playersFileName),
            rosterFile: path.join(clubDir, rosterFileName),
            sourcesFile: sourcesFileName ? path.join(clubDir, sourcesFileName) : null,
            playerCount,
          });
        }
      }
    }
  }

  return { clubs };
}

/** Resolves a clubId against the catalog. Returns `undefined` for anything not already discovered -- including any path-traversal attempt, since it can never match a real entry. */
export function findClubById(catalog: EditorCatalog, clubId: string): EditorClubEntry | undefined {
  return catalog.clubs.find((c) => c.clubId === clubId);
}
