// Server-only real-world squad snapshotting (HM-DATA-0.2).
//
// Touches the filesystem (via realWorldLoader.ts, which itself reuses
// lib/editor/catalog.ts's discovery layer) -- this module must NEVER be
// imported from lib/career/newCareer.ts directly, because newCareer.ts
// is reachable from CareerContext.tsx ("use client"), and bundling
// `node:fs` into a client chunk breaks the Next.js build. Only
// app/api/game-world/squad-snapshot/route.ts (a server Route Handler),
// app/api/game-world/ai-tactical-preferences-snapshot/route.ts
// (HM-IDENTITY-0.3, same rule), and this package's own tests may import
// this module.
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import { deriveAiTacticalPreferences } from "../career/aiTacticalPreferences";
import type { TeamTacticalProfile } from "../career/teamTacticalProfile";
import { snapshotGameplayRatingsForClub, type GameplayPlayerRating } from "./gameplayRatingSnapshot";
import { toPlayerMocks } from "./gameWorldAdapter";
import { resolveClubIdentityForMatch } from "./resolveClubIdentity";
import { loadRealWorldClubSquad, validateClubSquad } from "./realWorldLoader";

function snapshotRealWorldSquad(clubId: string): PlayerMock[] {
  const squad = loadRealWorldClubSquad(clubId);
  if (!squad) return [];
  const validation = validateClubSquad(squad);
  if (!validation.ok) return [];
  return toPlayerMocks(squad.players);
}

/**
 * Builds the `worldSquads` snapshot for every real-world-backed club in
 * `competitionId`. Returns `{}` for a competition with no real-world
 * clubs at all -- the caller's existing legacy mock squad fallback (see
 * career/careerWorld.ts) covers that case. As of HM-DATA-ALLSVENSKAN-1.1
 * this is generic across tiers: both Handbollsligan and Allsvenskan
 * clubs are real-world-backed, gated purely on `Club.dataSource`.
 */
export function snapshotWorldSquads(competitionId: string): Record<string, PlayerMock[]> {
  const worldSquads: Record<string, PlayerMock[]> = {};
  for (const club of getClubsByCompetition(competitionId)) {
    if (club.dataSource !== "REAL_WORLD") continue;
    const squad = snapshotRealWorldSquad(club.id);
    if (squad.length > 0) worldSquads[club.id] = squad;
  }
  return worldSquads;
}

/**
 * HM-IDENTITY-0.3: a one-time, career-creation-time snapshot of every
 * REAL_WORLD club's AI-derived TeamTacticalProfile for `competitionId`
 * (see career/aiTacticalPreferences.ts for the resolver -> preferences
 * adapter). Only the resulting TeamTacticalProfile is snapshotted --
 * never the full explanation/contributingClaims payload, which stays a
 * server-only concern computable on demand from the same real source
 * data, not something that needs to round-trip through client state.
 *
 * PROVISIONAL, documented simplification: like `snapshotWorldSquads`,
 * this is computed ONCE at career creation (using `seasonStartDate` as
 * the staff "as of" date) and never re-resolved mid-season -- identity
 * data does not change dynamically within a save today, matching the
 * same fixed-snapshot precedent `worldSquads` already established.
 */
export function snapshotAiTacticalPreferences(competitionId: string, season: string, seasonStartDate: string): Record<string, TeamTacticalProfile> {
  const preferences: Record<string, TeamTacticalProfile> = {};
  for (const club of getClubsByCompetition(competitionId)) {
    if (club.dataSource !== "REAL_WORLD") continue;
    const identity = resolveClubIdentityForMatch(club.id, season, seasonStartDate);
    preferences[club.id] = deriveAiTacticalPreferences(identity).profile;
  }
  return preferences;
}

/**
 * HM-MATCH-RATINGS-0.1: a one-time, career-creation-time snapshot of
 * every REAL_WORLD club's canonical complete gameplay ratings (HM-
 * RATINGS-0.6's own LOCKED > CALIBRATED > ESTIMATED > GENERATED_GAME_
 * PRIOR resolver, gameplayRatingSnapshot.ts -- not a new resolver).
 * Same fixed-snapshot precedent as snapshotWorldSquads/
 * snapshotAiTacticalPreferences, for the same reason: this touches the
 * filesystem (via the rating pipeline's own real-world loader), so it
 * must never be reachable from `CareerContext.tsx` ("use client")
 * directly -- only the gameplay-ratings-snapshot API route and this
 * package's own tests may import it.
 */
export function snapshotGameplayRatings(competitionId: string): Record<string, GameplayPlayerRating[]> {
  const ratings: Record<string, GameplayPlayerRating[]> = {};
  for (const club of getClubsByCompetition(competitionId)) {
    if (club.dataSource !== "REAL_WORLD") continue;
    const snapshot = snapshotGameplayRatingsForClub(club.id);
    if (snapshot.players.length > 0) ratings[club.id] = snapshot.players;
  }
  return ratings;
}
