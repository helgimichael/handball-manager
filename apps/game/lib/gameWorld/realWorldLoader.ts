// Real-world → game-world loader (HM-DATA-0.2).
//
// Server-only. Reuses lib/editor/catalog.ts's discovery layer (the one
// module allowed to touch real filesystem paths) but reads the RAW
// players/roster JSON directly, rather than lib/editor/playerRepository's
// editable-field-narrowed accessors -- the game world needs read-only
// access to the full identity record, not an edit form's subset.
//
// This module never writes. Only the Development Editor (lib/editor/)
// is allowed to mutate data/real-world/*.

import { readDataFile } from "./dataFiles";
import { buildCatalog, findClubById, type EditorCatalog } from "../editor/catalog";
import { DEFAULT_DATA_ROOT } from "../editor/paths";

export interface RealWorldContract {
  untilDate: string | null;
  untilSeason: string | null;
  optionUntilSeason: string | null;
}

export interface RealWorldPlayer {
  playerId: string;
  clubId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  /** Alternate names the source data itself records (e.g. a shorter club-roster display name for a player whose official full name is longer) -- see the source `dataNotes` field for why a given alias exists. Empty when the source lists none. */
  aliases: string[];
  dateOfBirth: string | null;
  birthYear: number | null;
  nationalities: string[] | null;
  heightCm: number | null;
  handedness: "LEFT" | "RIGHT" | "AMBIDEXTROUS" | null;
  shirtNumber: number | null;
  sourcePosition: string;
  primaryPosition: string;
  secondaryPositions: string[];
  rosterStatus: string;
  contract: RealWorldContract;
  /** HM-PLAYER-DATA-EDITOR-1.0: editor-calibrated permanent squad-role default (roster-*.json's `defaultSquadStatus`), or `null` if nobody has calibrated one yet. */
  defaultSquadStatus: string | null;
  /** HM-PLAYER-DATA-EDITOR-1.0: editor-calibrated special tags (roster-*.json's `specialTags`). Empty when none have been calibrated. */
  specialTags: string[];
  /**
   * HM-WORLD-PLAYER-POOL-1.0: GAME-DESIGN METADATA from the 100-player
   * international pool source workbook -- `undefined` for every player
   * outside that pool (Swedish/Division 1 imports never carry this).
   * HM Level/Wonderkid feed the game-prior CA/PA generator as a bounded
   * signal only (see lib/rating/gamePrior) -- never a second CA/PA, and
   * never shown in normal UI as a verified real-world fact.
   */
  worldPoolMetadata?: RealWorldPlayerWorldPoolMetadata | null;
}

export interface RealWorldPlayerWorldPoolMetadata {
  workbookId: string;
  poolRegion: string;
  leagueCountry: string;
  sourceNationality: string;
  hmLevel: string;
  prospect: boolean;
  wonderkidCandidate: boolean;
  confidence: string;
  notes: string | null;
}

export interface RealWorldClubSquad {
  clubId: string;
  clubName: string;
  competitionId: string;
  players: RealWorldPlayer[];
}

function readJsonArray(filePath: string): Record<string, unknown>[] {
  const raw = JSON.parse(readDataFile(filePath));
  if (!Array.isArray(raw)) throw new Error(`expected an array in ${filePath}`);
  return raw as Record<string, unknown>[];
}

/** Every real-world club currently importable (has a catalog entry with both players + roster files). Rebuilt from disk each call -- see catalog.ts's own note on why this is fine at this dataset size. */
export function listImportableClubIds(dataRoot: string = DEFAULT_DATA_ROOT): string[] {
  return buildCatalog(dataRoot).clubs.map((c) => c.clubId);
}

function loadOne(catalog: EditorCatalog, clubId: string): RealWorldClubSquad | null {
  const club = findClubById(catalog, clubId);
  if (!club) return null;

  const players = readJsonArray(club.playersFile);
  const roster = readJsonArray(club.rosterFile);
  const playersById = new Map(players.map((p) => [String(p.playerId), p]));

  const result: RealWorldPlayer[] = [];
  for (const r of roster) {
    const playerId = String(r.playerId);
    const p = playersById.get(playerId);
    if (!p) continue; // orphaned roster entry -- reported by validateClubSquad, not silently coerced here
    const contract = (r.contract ?? {}) as Record<string, unknown>;
    result.push({
      playerId,
      clubId: club.clubId,
      firstName: String(p.firstName ?? ""),
      lastName: String(p.lastName ?? ""),
      fullName: String(p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim()),
      aliases: Array.isArray(p.aliases) ? (p.aliases as string[]) : [],
      dateOfBirth: (p.dateOfBirth as string | null) ?? null,
      birthYear: (p.birthYear as number | null) ?? null,
      nationalities: (p.nationalities as string[] | null) ?? null,
      heightCm: (p.heightCm as number | null) ?? null,
      handedness: (p.handedness as RealWorldPlayer["handedness"]) ?? null,
      shirtNumber: (r.shirtNumber as number | null) ?? null,
      sourcePosition: String(r.sourcePosition ?? ""),
      primaryPosition: String(r.primaryPosition ?? ""),
      secondaryPositions: Array.isArray(r.secondaryPositions) ? (r.secondaryPositions as string[]) : [],
      rosterStatus: String(r.rosterStatus ?? ""),
      contract: {
        untilDate: (contract.untilDate as string | null) ?? null,
        untilSeason: (contract.untilSeason as string | null) ?? null,
        optionUntilSeason: (contract.optionUntilSeason as string | null) ?? null,
      },
      defaultSquadStatus: (r.defaultSquadStatus as string | null) ?? null,
      specialTags: Array.isArray(r.specialTags) ? (r.specialTags as string[]) : [],
      worldPoolMetadata: typeof p.worldPoolMetadata === "object" && p.worldPoolMetadata !== null ? (p.worldPoolMetadata as unknown as RealWorldPlayerWorldPoolMetadata) : null,
    });
  }

  return { clubId: club.clubId, clubName: club.clubName, competitionId: club.competitionId, players: result };
}

/** Loads one club's real-world roster, joined by playerId. Returns `null` if the clubId isn't a catalog-discovered real-world club. */
export function loadRealWorldClubSquad(clubId: string, dataRoot: string = DEFAULT_DATA_ROOT): RealWorldClubSquad | null {
  return loadOne(buildCatalog(dataRoot), clubId);
}

export interface ClubSquadValidationResult {
  ok: boolean;
  errors: string[];
  playerCount: number;
  duplicatePlayerIdCount: number;
  nullFieldCounts: Record<string, number>;
}

const CANONICAL_POSITIONS = new Set(["MV", "V6", "V9", "M9", "M6", "H9", "H6"]);

/** Pre-playability validation (HM-DATA-0.2 Spec: unique playerIds, valid positions, non-empty roster). Null optional fields are never errors. */
export function validateClubSquad(squad: RealWorldClubSquad): ClubSquadValidationResult {
  const errors: string[] = [];
  const seen = new Set<string>();
  let duplicatePlayerIdCount = 0;
  const nullFieldCounts: Record<string, number> = { dateOfBirth: 0, heightCm: 0, handedness: 0, shirtNumber: 0, nationalities: 0 };

  for (const p of squad.players) {
    if (seen.has(p.playerId)) duplicatePlayerIdCount += 1;
    seen.add(p.playerId);
    if (!CANONICAL_POSITIONS.has(p.primaryPosition)) {
      errors.push(`${squad.clubName}/${p.playerId}: invalid primaryPosition "${p.primaryPosition}"`);
    }
    if (p.dateOfBirth === null) nullFieldCounts.dateOfBirth += 1;
    if (p.heightCm === null) nullFieldCounts.heightCm += 1;
    if (p.handedness === null) nullFieldCounts.handedness += 1;
    if (p.shirtNumber === null) nullFieldCounts.shirtNumber += 1;
    if (!p.nationalities || p.nationalities.length === 0) nullFieldCounts.nationalities += 1;
  }

  if (duplicatePlayerIdCount > 0) errors.push(`${squad.clubName}: ${duplicatePlayerIdCount} duplicate playerId(s)`);
  if (squad.players.length === 0) errors.push(`${squad.clubName}: no players resolved from roster join`);

  return { ok: errors.length === 0, errors, playerCount: squad.players.length, duplicatePlayerIdCount, nullFieldCounts };
}
