// HM-RATINGS-0.5 Part K/L: the persistent, LOCKED player-rating
// database. This is the one place a rating profile is ever written as
// final game content -- everything upstream (source evidence, CA
// estimation, HM-RATINGS-0.4 generation) is always recomputed fresh and
// never persisted anywhere else. Deliberately stored OUTSIDE any club's
// own data directory (data/real-world/.../handbollsligan/ratings/,
// sibling to the per-club folders, never inside one) so GAME RATING
// DATA can never be confused with or accidentally overwrite SOURCE
// PLAYER DATA (Part L: "Do not modify the original roster/source files
// to embed ratings").
//
// Locking never deletes the underlying proposal/estimate/evidence --
// this file only ever ADDS a locked snapshot; the review/override state
// (ratingReviewRepository.ts, ratingOverrideRepository.ts) and the
// original source data remain fully intact and independently
// recomputable for audit (Part K).
import fs from "node:fs";
import path from "node:path";
import { atomicWriteJsonFile } from "./atomicWrite";
import { buildCatalog, findClubById } from "./catalog";
import { DEFAULT_DATA_ROOT } from "./paths";
import type { AbilityConfidence, PlausibleRange, Position, RoleProficiency } from "../rating/types";
import type { GeneratedGoalkeeperProfile, GeneratedOutcourtProfile } from "../rating/generation/types";

export type RatingValueSource = "CALIBRATED" | "MODEL_ESTIMATE" | "GENERATED_GAME_PRIOR" | "EDITOR_OVERRIDE";

export interface LockedAbilityValue {
  value: number;
  confidence: AbilityConfidence;
  plausibleRange: PlausibleRange;
  source: RatingValueSource;
}

export interface LockedPlayerRating {
  playerId: string;
  clubId: string;
  position: Position;
  ca: LockedAbilityValue;
  /** `null` when PA remains genuinely unassessed at lock time -- locking a player does not force a PA to exist. */
  pa: (LockedAbilityValue & { value: number }) | null;
  branch: GeneratedOutcourtProfile | GeneratedGoalkeeperProfile;
  attackRoleProficiencies: RoleProficiency[];
  defenceRoleProficiencies: RoleProficiency[];
  /** `null` when ca.source is "CALIBRATED" (no estimation was needed) or "EDITOR_OVERRIDE" (the estimate, if any, was superseded). */
  caEstimationModelVersion: string | null;
  attributeGenerationModelVersion: string;
  lockedAt: string;
  lockedNote?: string;
}

/** clubId -> playerId -> locked record, one JSON file per club. */
export type RatingDatabaseState = Record<string, LockedPlayerRating>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ratingsDir(clubDir: string): string {
  return path.join(path.dirname(clubDir), "ratings");
}

function ratingsFilePath(clubDir: string, clubId: string): string {
  return path.join(ratingsDir(clubDir), `${clubId}.json`);
}

/** Loads the locked-rating database for one club. Returns `{}` (never throws) for a club with no locked players yet, or an unknown clubId. */
export function loadRatingDatabase(clubId: string, dataRoot: string = DEFAULT_DATA_ROOT): RatingDatabaseState {
  const club = findClubById(buildCatalog(dataRoot), clubId);
  if (!club) return {};

  const filePath = ratingsFilePath(club.clubDir, clubId);
  if (!fs.existsSync(filePath)) return {};

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
  if (!isPlainObject(raw)) return {};

  const state: RatingDatabaseState = {};
  for (const [playerId, entry] of Object.entries(raw)) {
    if (isPlainObject(entry) && typeof entry.playerId === "string") {
      state[playerId] = entry as unknown as LockedPlayerRating;
    }
  }
  return state;
}

export function loadLockedPlayerRating(clubId: string, playerId: string, dataRoot: string = DEFAULT_DATA_ROOT): LockedPlayerRating | null {
  return loadRatingDatabase(clubId, dataRoot)[playerId] ?? null;
}

/** Writes (or overwrites) one player's locked record -- a targeted, single-key update, same shape as the review/override repositories. */
export function lockPlayerRating(clubId: string, record: LockedPlayerRating, dataRoot: string = DEFAULT_DATA_ROOT): { ok: boolean; errors: string[] } {
  const club = findClubById(buildCatalog(dataRoot), clubId);
  if (!club) return { ok: false, errors: [`Unknown clubId "${clubId}".`] };

  const dir = ratingsDir(club.clubDir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const current = loadRatingDatabase(clubId, dataRoot);
  const next: RatingDatabaseState = { ...current, [record.playerId]: record };
  atomicWriteJsonFile(ratingsFilePath(club.clubDir, clubId), next);
  return { ok: true, errors: [] };
}

/** Removes one player's locked record (Part K: "Support unlocking if architecturally simple/safe"). The underlying proposal/estimate is unaffected -- it was never stored here in the first place, only this locked snapshot was. */
export function unlockPlayerRating(clubId: string, playerId: string, dataRoot: string = DEFAULT_DATA_ROOT): { ok: boolean; errors: string[] } {
  const club = findClubById(buildCatalog(dataRoot), clubId);
  if (!club) return { ok: false, errors: [`Unknown clubId "${clubId}".`] };

  const current = loadRatingDatabase(clubId, dataRoot);
  if (!(playerId in current)) return { ok: true, errors: [] };
  const next = { ...current };
  delete next[playerId];
  atomicWriteJsonFile(ratingsFilePath(club.clubDir, clubId), next);
  return { ok: true, errors: [] };
}
