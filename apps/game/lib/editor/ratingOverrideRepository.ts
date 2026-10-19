// HM-RATINGS-0.5 Part J: reviewer OVERRIDE state -- a draft manual
// CA/PA/attribute decision, kept fully separate from both the source
// evidence (lib/rating/pipeline) and the model estimate (lib/rating/
// caEstimation, lib/rating/generation). An override wins for display/
// locking purposes, but it never rewrites or deletes the underlying
// proposal -- that stays recomputed fresh on every load, exactly like
// ratingReviewRepository.ts's existing review-status pattern (same
// atomicWriteJsonFile + catalog-resolved clubDir safety primitives,
// its own sibling file so it never touches real-world identity data).
import { dataFileExists, readDataFile } from "../gameWorld/dataFiles";
import path from "node:path";
import { atomicWriteJsonFile } from "./atomicWrite";
import { buildCatalog, findClubById } from "./catalog";
import { DEFAULT_DATA_ROOT } from "./paths";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, CA_MAX, CA_MIN, GOALKEEPER_ATTRIBUTES, OUTCOURT_ATTRIBUTES, PA_MAX, PA_MIN, type Position } from "../rating/types";

export interface PlayerRatingOverride {
  ca?: number;
  pa?: number;
  /** attribute key (OutcourtAttribute or GoalkeeperAttribute, depending on the player's own position) -> manually chosen 1-20 value. */
  attributeOverrides?: Record<string, number>;
  updatedAt: string;
}

/** playerId -> the reviewer's draft override. A player with no entry here has no manual override -- the model estimate/calibration stands. */
export type RatingOverrideState = Record<string, PlayerRatingOverride>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function overrideFilePath(clubDir: string): string {
  return path.join(clubDir, "rating-overrides.json");
}

export function loadRatingOverrideState(clubId: string, dataRoot: string = DEFAULT_DATA_ROOT): RatingOverrideState {
  const club = findClubById(buildCatalog(dataRoot), clubId);
  if (!club) return {};

  const filePath = overrideFilePath(club.clubDir);
  if (!dataFileExists(filePath)) return {};

  let raw: unknown;
  try {
    raw = JSON.parse(readDataFile(filePath));
  } catch {
    return {};
  }
  if (!isPlainObject(raw)) return {};

  const state: RatingOverrideState = {};
  for (const [playerId, entry] of Object.entries(raw)) {
    if (!isPlainObject(entry) || typeof entry.updatedAt !== "string") continue;
    const override: PlayerRatingOverride = { updatedAt: entry.updatedAt };
    if (typeof entry.ca === "number") override.ca = entry.ca;
    if (typeof entry.pa === "number") override.pa = entry.pa;
    if (isPlainObject(entry.attributeOverrides)) {
      const attrs: Record<string, number> = {};
      for (const [k, v] of Object.entries(entry.attributeOverrides)) {
        if (typeof v === "number") attrs[k] = v;
      }
      if (Object.keys(attrs).length > 0) override.attributeOverrides = attrs;
    }
    state[playerId] = override;
  }
  return state;
}

export interface SetRatingOverrideInput {
  clubId: string;
  playerId: string;
  position: Position;
  ca?: number;
  pa?: number;
  attributeOverrides?: Record<string, number>;
}

export interface SetRatingOverrideResult {
  ok: boolean;
  errors: string[];
}

/**
 * Validates and merges ONE player's override on top of whatever draft
 * override already existed (a targeted update, same pattern as
 * setReviewStatus -- fields omitted from `input` leave the existing
 * override value, if any, untouched; this lets the Editor save a CA
 * override now and an attribute override later without clobbering the
 * first). Rejects out-of-range CA/PA/attribute values and any attribute
 * key that doesn't belong to the player's own branch (outcourt vs
 * goalkeeper) -- an override can never smuggle in an impossible value
 * the source/model layers themselves are validated against.
 */
export function setRatingOverride(input: SetRatingOverrideInput, dataRoot: string = DEFAULT_DATA_ROOT): SetRatingOverrideResult {
  const errors: string[] = [];
  if (!input.playerId || input.playerId.trim().length === 0) errors.push("playerId must be a non-empty string.");
  if (input.ca !== undefined && (!Number.isFinite(input.ca) || input.ca < CA_MIN || input.ca > CA_MAX)) {
    errors.push(`ca must be between ${CA_MIN} and ${CA_MAX}.`);
  }
  if (input.pa !== undefined && (!Number.isFinite(input.pa) || input.pa < PA_MIN || input.pa > PA_MAX)) {
    errors.push(`pa must be between ${PA_MIN} and ${PA_MAX}.`);
  }
  if (input.ca !== undefined && input.pa !== undefined && input.pa < input.ca) {
    errors.push("pa cannot be lower than ca.");
  }
  if (input.attributeOverrides) {
    const validKeys: readonly string[] = input.position === "GK" ? GOALKEEPER_ATTRIBUTES : OUTCOURT_ATTRIBUTES;
    for (const [key, value] of Object.entries(input.attributeOverrides)) {
      if (!validKeys.includes(key)) {
        errors.push(`"${key}" is not a valid ${input.position === "GK" ? "goalkeeper" : "outcourt"} attribute for this player's position.`);
        continue;
      }
      if (!Number.isFinite(value) || value < ATTRIBUTE_MIN || value > ATTRIBUTE_MAX) {
        errors.push(`attribute "${key}" must be between ${ATTRIBUTE_MIN} and ${ATTRIBUTE_MAX}.`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const club = findClubById(buildCatalog(dataRoot), input.clubId);
  if (!club) return { ok: false, errors: [`Unknown clubId "${input.clubId}".`] };

  const current = loadRatingOverrideState(input.clubId, dataRoot);
  const existing = current[input.playerId];
  const next: RatingOverrideState = {
    ...current,
    [input.playerId]: {
      ca: input.ca ?? existing?.ca,
      pa: input.pa ?? existing?.pa,
      attributeOverrides: input.attributeOverrides || existing?.attributeOverrides ? { ...existing?.attributeOverrides, ...input.attributeOverrides } : undefined,
      updatedAt: new Date().toISOString(),
    },
  };
  atomicWriteJsonFile(overrideFilePath(club.clubDir), next);
  return { ok: true, errors: [] };
}

/** Clears a player's entire draft override (both CA/PA and all attribute overrides) -- reverting to whatever the model estimate/calibration proposes. */
export function clearRatingOverride(clubId: string, playerId: string, dataRoot: string = DEFAULT_DATA_ROOT): SetRatingOverrideResult {
  const club = findClubById(buildCatalog(dataRoot), clubId);
  if (!club) return { ok: false, errors: [`Unknown clubId "${clubId}".`] };
  const current = loadRatingOverrideState(clubId, dataRoot);
  if (!(playerId in current)) return { ok: true, errors: [] };
  const next = { ...current };
  delete next[playerId];
  atomicWriteJsonFile(overrideFilePath(club.clubDir), next);
  return { ok: true, errors: [] };
}
