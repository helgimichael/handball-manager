// Player load/edit/save repository (HM-DATA-EDITOR-0.1, Spec S17/S23/S24).
//
// A "player" for editing purposes is two records, matched by playerId:
// the person (players-<slug>.json) and this season's roster entry
// (roster-<slug>-<season>.json). This module is the only place that
// merges them for the UI and the only place that writes them back --
// always by replacing exactly one array element in place (targeted
// write, Spec S23), never touching any other player's record.
import fs from "node:fs";
import { atomicWriteJsonFile } from "./atomicWrite";
import type { EditorCatalog, EditorClubEntry } from "./catalog";
import { findClubById } from "./catalog";
import { diffFields, type FieldDiffEntry } from "./diff";
import {
  validatePlayerEdit,
  validateRosterEdit,
  type Confidence,
  type PlayerEditableFields,
  type RosterEditableFields,
} from "./schema";

const PLAYER_FIELDS: readonly (keyof PlayerEditableFields)[] = [
  "firstName",
  "lastName",
  "fullName",
  "dateOfBirth",
  "birthYear",
  "nationalities",
  "heightCm",
  "handedness",
  "recordConfidence",
];
const ROSTER_FIELDS: readonly (keyof RosterEditableFields)[] = [
  "shirtNumber",
  "sourcePosition",
  "primaryPosition",
  "secondaryPositions",
  "rosterStatus",
  "contract",
  "rosterConfidence",
];

function readJsonArray(filePath: string): Record<string, unknown>[] {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`expected an array in ${filePath}`);
  }
  return raw as Record<string, unknown>[];
}

export interface EditorPlayerRow {
  playerId: string;
  fullName: string;
  clubId: string;
  clubName: string;
  primaryPosition: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  nationalities: string[] | null;
  shirtNumber: number | null;
  recordConfidence: Confidence | null;
  rosterConfidence: Confidence | null;
}

/** Lists every player on one club's roster, merged with identity data, for the Player Browser table. */
export function listClubPlayers(catalog: EditorCatalog, clubId: string): EditorPlayerRow[] | null {
  const club = findClubById(catalog, clubId);
  if (!club) return null;

  const players = readJsonArray(club.playersFile);
  const roster = readJsonArray(club.rosterFile);
  const rosterByPlayerId = new Map(roster.map((r) => [String(r.playerId), r]));

  return players.map((p) => {
    const rosterEntry = rosterByPlayerId.get(String(p.playerId));
    return {
      playerId: String(p.playerId),
      fullName: String(p.fullName ?? ""),
      clubId: club.clubId,
      clubName: club.clubName,
      primaryPosition: rosterEntry ? String(rosterEntry.primaryPosition ?? "") : "",
      dateOfBirth: (p.dateOfBirth as string | null) ?? null,
      birthYear: (p.birthYear as number | null) ?? null,
      nationalities: (p.nationalities as string[] | null) ?? null,
      shirtNumber: rosterEntry ? ((rosterEntry.shirtNumber as number | null) ?? null) : null,
      recordConfidence: (p.recordConfidence as Confidence | undefined) ?? null,
      rosterConfidence: rosterEntry ? ((rosterEntry.rosterConfidence as Confidence | undefined) ?? null) : null,
    };
  });
}

export interface ResolvedSource {
  sourceId: string;
  sourceType?: string;
  publisher?: string;
  title?: string;
  url?: string;
}

export interface EditorPlayerRecord {
  playerId: string;
  clubId: string;
  clubName: string;
  player: PlayerEditableFields;
  roster: RosterEditableFields;
  readOnly: {
    aliases: string[];
    dataNotes: string[];
    rosterEntryId: string;
    competitionId: string;
    season: string;
    snapshotDate: string;
    sources: ResolvedSource[];
  };
}

function toEditablePlayer(raw: Record<string, unknown>): PlayerEditableFields {
  return {
    firstName: String(raw.firstName ?? ""),
    lastName: String(raw.lastName ?? ""),
    fullName: String(raw.fullName ?? ""),
    dateOfBirth: (raw.dateOfBirth as string | null) ?? null,
    birthYear: (raw.birthYear as number | null) ?? null,
    nationalities: (raw.nationalities as string[] | null) ?? null,
    heightCm: (raw.heightCm as number | null) ?? null,
    handedness: (raw.handedness as PlayerEditableFields["handedness"]) ?? null,
    recordConfidence: (raw.recordConfidence as Confidence) ?? "UNKNOWN",
  };
}

function toEditableRoster(raw: Record<string, unknown>): RosterEditableFields {
  const contract = (raw.contract ?? {}) as Record<string, unknown>;
  return {
    shirtNumber: (raw.shirtNumber as number | null) ?? null,
    sourcePosition: String(raw.sourcePosition ?? ""),
    primaryPosition: raw.primaryPosition as RosterEditableFields["primaryPosition"],
    secondaryPositions: (raw.secondaryPositions as RosterEditableFields["secondaryPositions"]) ?? [],
    rosterStatus: raw.rosterStatus as RosterEditableFields["rosterStatus"],
    contract: {
      untilDate: (contract.untilDate as string | null) ?? null,
      untilSeason: (contract.untilSeason as string | null) ?? null,
      optionUntilSeason: (contract.optionUntilSeason as string | null) ?? null,
    },
    rosterConfidence: (raw.rosterConfidence as Confidence) ?? "UNKNOWN",
  };
}

function collectSourceIds(sourceRefs: unknown): Set<string> {
  const ids = new Set<string>();
  if (!sourceRefs || typeof sourceRefs !== "object") return ids;
  for (const value of Object.values(sourceRefs as Record<string, unknown>)) {
    if (Array.isArray(value)) {
      for (const id of value) {
        if (typeof id === "string") ids.add(id);
      }
    }
  }
  return ids;
}

/** Loads one player's full merged, editable record. Returns `null` if the club or player id does not resolve to a real, catalog-discovered record. */
export function loadPlayerRecord(catalog: EditorCatalog, clubId: string, playerId: string): EditorPlayerRecord | null {
  const club = findClubById(catalog, clubId);
  if (!club) return null;

  const players = readJsonArray(club.playersFile);
  const roster = readJsonArray(club.rosterFile);
  const playerRaw = players.find((p) => p.playerId === playerId);
  const rosterRaw = roster.find((r) => r.playerId === playerId);
  if (!playerRaw || !rosterRaw) return null;

  const sourceIds = new Set<string>([...collectSourceIds(playerRaw.sourceRefs), ...collectSourceIds(rosterRaw.sourceRefs)]);
  let sources: ResolvedSource[] = [];
  if (club.sourcesFile && fs.existsSync(club.sourcesFile) && sourceIds.size > 0) {
    try {
      const allSources = readJsonArray(club.sourcesFile);
      sources = allSources.filter((s) => sourceIds.has(String(s.sourceId))) as unknown as ResolvedSource[];
    } catch {
      sources = [];
    }
  }

  return {
    playerId,
    clubId: club.clubId,
    clubName: club.clubName,
    player: toEditablePlayer(playerRaw),
    roster: toEditableRoster(rosterRaw),
    readOnly: {
      aliases: Array.isArray(playerRaw.aliases) ? (playerRaw.aliases as string[]) : [],
      dataNotes: Array.isArray(playerRaw.dataNotes) ? (playerRaw.dataNotes as string[]) : [],
      rosterEntryId: String(rosterRaw.rosterEntryId ?? ""),
      competitionId: String(rosterRaw.competitionId ?? ""),
      season: String(rosterRaw.season ?? ""),
      snapshotDate: String(rosterRaw.snapshotDate ?? ""),
      sources,
    },
  };
}

export type SavePlayerResult = { ok: true; diff: FieldDiffEntry[] } | { ok: false; errors: string[] };

/**
 * Validates, diffs, and atomically writes one player's edits. Only the
 * one matching array element in each file is replaced (via object
 * spread, which preserves the original's key order for unchanged keys
 * -- Spec S22/S23); every other player's record is untouched.
 */
export function savePlayerEdit(
  catalog: EditorCatalog,
  clubId: string,
  playerId: string,
  playerInput: unknown,
  rosterInput: unknown,
): SavePlayerResult {
  const club = findClubById(catalog, clubId);
  if (!club) {
    return { ok: false, errors: ["unknown clubId"] };
  }

  const playerValidation = validatePlayerEdit(playerInput);
  const rosterValidation = validateRosterEdit(rosterInput);
  const errors = [...(playerValidation.ok ? [] : playerValidation.errors), ...(rosterValidation.ok ? [] : rosterValidation.errors)];
  if (!playerValidation.ok || !rosterValidation.ok) {
    return { ok: false, errors };
  }

  const players = readJsonArray(club.playersFile);
  const roster = readJsonArray(club.rosterFile);

  const playerMatches = players.filter((p) => p.playerId === playerId);
  const rosterMatches = roster.filter((r) => r.playerId === playerId);
  if (playerMatches.length === 0 || rosterMatches.length === 0) {
    return { ok: false, errors: [`playerId ${playerId} not found in ${club.clubName}'s source data`] };
  }
  if (playerMatches.length > 1 || rosterMatches.length > 1) {
    return { ok: false, errors: [`duplicate playerId ${playerId} already present in source data -- refusing to save`] };
  }

  const playerIndex = players.findIndex((p) => p.playerId === playerId);
  const rosterIndex = roster.findIndex((r) => r.playerId === playerId);
  const beforePlayer = players[playerIndex];
  const beforeRoster = roster[rosterIndex];

  const afterPlayer: Record<string, unknown> = { ...beforePlayer, ...playerValidation.value };
  const afterRoster: Record<string, unknown> = { ...beforeRoster, ...rosterValidation.value };

  const playerDiff = diffFields(beforePlayer, afterPlayer, PLAYER_FIELDS);
  const rosterDiff = diffFields(beforeRoster, afterRoster, ROSTER_FIELDS);
  const diff = [...playerDiff, ...rosterDiff];

  if (diff.length === 0) {
    return { ok: true, diff: [] };
  }

  const nextPlayers = [...players];
  nextPlayers[playerIndex] = afterPlayer;
  const nextRoster = [...roster];
  nextRoster[rosterIndex] = afterRoster;

  // Duplicate-id invariant re-checked against the file we are about to write (Spec S24).
  const idsAfter = nextPlayers.map((p) => p.playerId);
  if (new Set(idsAfter).size !== idsAfter.length) {
    return { ok: false, errors: ["resulting player file would contain a duplicate playerId -- refusing to save"] };
  }

  // Only write (and back up) the file that actually has a changed
  // field -- editing purely player-entity fields must not touch the
  // roster file's bytes at all, and vice versa (Spec S23).
  if (playerDiff.length > 0) {
    atomicWriteJsonFile(club.playersFile, nextPlayers);
  }
  if (rosterDiff.length > 0) {
    atomicWriteJsonFile(club.rosterFile, nextRoster);
  }

  return { ok: true, diff };
}

export function getClubEntry(catalog: EditorCatalog, clubId: string): EditorClubEntry | undefined {
  return findClubById(catalog, clubId);
}
