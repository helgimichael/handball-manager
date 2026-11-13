// Club Identity C1: the static identity layer (MIGRATION-STRATEGY §1), keyed
// by storage id. It is merged into each record when CLUBS is assembled
// (clubs.ts), so the club record stays the ONE source of truth -- this file
// only keeps metadata out of the long one-line `club({...})` literals.
//
// Rules (locked L10 / D1):
// - Never change what an id means; correct identity through metadata here.
// - Never merge on name similarity; link with `relations` instead.
// - `competitionHistory` is append-only. Never edit `Club.competitionId`.
import type { ClubIdentityFields } from "./types";

/** The data epoch new careers start from. Saves without CareerState.clubWorldBaseline are legacy (v8 world). */
export const CLUB_WORLD_EPOCH = "cid-2026-27-v1";
/** The season every legacy career started in, and the first season of CLUB_WORLD_EPOCH. */
export const CLUB_WORLD_START_SEASON = "2026/27";

export const CLUB_IDENTITY_METADATA: Readonly<Record<string, ClubIdentityFields>> = {};
