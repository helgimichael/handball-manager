// HM-EDITOR-0.2: rating REVIEW state -- the human reviewer's status/note
// per player, entirely separate from HM-RATINGS-0.3's own proposed
// CA/PA/attributes (which are computed fresh from source data every
// request, never persisted or edited by this module). Reuses the exact
// same safety primitives lib/editor/playerRepository.ts already relies
// on (atomicWriteJsonFile's atomic-rename + rolling backup, the
// catalog's server-discovered clubDir) rather than inventing a new
// persistence mechanism -- but deliberately writes to its OWN sibling
// file (`rating-review.json`) inside each club's data directory, never
// touching the `players-*.json`/`roster-*.json` files
// playerRepository.ts protects. This keeps rating-review state (a
// game-generated review workflow) fully decoupled from the real-world
// identity source-of-truth data.
//
// This module never computes or invents a CA/PA number -- it only
// records WHO reviewed a proposal and WHAT they concluded about its
// status. No route in this milestone allows editing ca/pa/attribute
// values themselves.
import fs from "node:fs";
import path from "node:path";
import { atomicWriteJsonFile } from "./atomicWrite";
import { buildCatalog, findClubById } from "./catalog";
import { DEFAULT_DATA_ROOT } from "./paths";

export const REVIEW_STATUSES = ["UNASSESSED", "PROPOSED", "REVIEWED", "LOCKED"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface RatingReviewEntry {
  status: ReviewStatus;
  note?: string;
  updatedAt: string;
}

/** playerId -> the reviewer's own recorded entry. A player with no entry here has never been explicitly reviewed -- its status falls back to the pipeline-derived default (PROPOSED/UNASSESSED), never silently invented here. */
export type RatingReviewState = Record<string, RatingReviewEntry>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

function reviewFilePath(clubDir: string): string {
  return path.join(clubDir, "rating-review.json");
}

/** Loads the reviewer state for one club. Returns `{}` (never throws) for a club with no review file yet, or an unknown clubId -- an empty review file is the honest starting state, not an error. */
export function loadRatingReviewState(clubId: string, dataRoot: string = DEFAULT_DATA_ROOT): RatingReviewState {
  const club = findClubById(buildCatalog(dataRoot), clubId);
  if (!club) return {};

  const filePath = reviewFilePath(club.clubDir);
  if (!fs.existsSync(filePath)) return {};

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
  if (!isPlainObject(raw)) return {};

  const state: RatingReviewState = {};
  for (const [playerId, entry] of Object.entries(raw)) {
    if (!isPlainObject(entry) || !isReviewStatus(entry.status) || typeof entry.updatedAt !== "string") continue;
    state[playerId] = { status: entry.status, updatedAt: entry.updatedAt, ...(typeof entry.note === "string" ? { note: entry.note } : {}) };
  }
  return state;
}

export interface SetReviewStatusResult {
  ok: boolean;
  errors: string[];
}

/**
 * Records one player's review status/note. A targeted, single-key
 * update -- reads the current file, replaces (or adds) exactly one
 * entry, writes the whole object back atomically. Never touches any
 * other club's file, never touches real-world identity data.
 */
export function setReviewStatus(clubId: string, playerId: string, status: ReviewStatus, note: string | undefined, dataRoot: string = DEFAULT_DATA_ROOT): SetReviewStatusResult {
  if (!isReviewStatus(status)) {
    return { ok: false, errors: [`"${String(status)}" is not a recognized review status -- expected one of ${REVIEW_STATUSES.join(", ")}.`] };
  }
  if (!playerId || playerId.trim().length === 0) {
    return { ok: false, errors: ["playerId must be a non-empty string."] };
  }

  const club = findClubById(buildCatalog(dataRoot), clubId);
  if (!club) {
    return { ok: false, errors: [`Unknown clubId "${clubId}".`] };
  }

  const current = loadRatingReviewState(clubId, dataRoot);
  const next: RatingReviewState = {
    ...current,
    [playerId]: { status, updatedAt: new Date().toISOString(), ...(note ? { note } : {}) },
  };
  atomicWriteJsonFile(reviewFilePath(club.clubDir), next);
  return { ok: true, errors: [] };
}
