// HM-RATINGS-0.5 Part M: the GAME LOADING boundary for LOCKED player
// ratings. Deliberately conservative -- this only reads
// lib/editor/ratingDatabaseRepository.ts's persisted, already-reviewed
// records and proves they round-trip; it does NOT wire into Fast
// Match, player simulation, or (yet) the normal Player Profile. Whether
// to switch the normal Player Profile over to locked data is left as
// this milestone's explicit next step (see the HM-RATINGS-0.5 report).
import { loadRealWorldClubSquad } from "./realWorldLoader";
import { DEFAULT_DATA_ROOT } from "../editor/paths";
import { loadRatingDatabase, type LockedPlayerRating } from "../editor/ratingDatabaseRepository";

export interface LockedRatingSnapshot {
  clubId: string;
  clubName: string | null;
  lockedPlayers: LockedPlayerRating[];
}

/** Returns every locked player rating for `clubId`, or `clubName: null` for an unknown club (never throws). An unknown club and a real club with zero locked players both return an empty `lockedPlayers` array -- the caller distinguishes them via `clubName`. */
export function snapshotLockedRatingsForClub(clubId: string, dataRoot: string = DEFAULT_DATA_ROOT): LockedRatingSnapshot {
  const squad = loadRealWorldClubSquad(clubId, dataRoot);
  const database = loadRatingDatabase(clubId, dataRoot);
  return {
    clubId,
    clubName: squad?.clubName ?? null,
    lockedPlayers: Object.values(database),
  };
}

/** Convenience lookup for exactly one locked player -- `null` if the player isn't locked (or doesn't exist). */
export function snapshotLockedRatingForPlayer(clubId: string, playerId: string, dataRoot: string = DEFAULT_DATA_ROOT): LockedPlayerRating | null {
  const database = loadRatingDatabase(clubId, dataRoot);
  return database[playerId] ?? null;
}
