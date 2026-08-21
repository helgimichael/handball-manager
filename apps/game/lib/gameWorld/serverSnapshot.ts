// Server-only real-world squad snapshotting (HM-DATA-0.2).
//
// Touches the filesystem (via realWorldLoader.ts, which itself reuses
// lib/editor/catalog.ts's discovery layer) -- this module must NEVER be
// imported from lib/career/newCareer.ts directly, because newCareer.ts
// is reachable from CareerContext.tsx ("use client"), and bundling
// `node:fs` into a client chunk breaks the Next.js build. Only
// app/api/game-world/squad-snapshot/route.ts (a server Route Handler)
// and this package's own tests may import this module.
import { getClubsByCompetition, type PlayerMock } from "../game-data";
import { toPlayerMocks } from "./gameWorldAdapter";
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
 * clubs (e.g. Allsvenskan) -- the caller's existing legacy mock squad
 * fallback (see career/careerWorld.ts) covers that case.
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
