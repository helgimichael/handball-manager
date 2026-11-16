// HM-TRANSFER-REALISM-1.0: a career over the FULL world a real career has --
// the Swedish pyramid plus the international world pool. Shared by the
// transfer-realism simulation and its integration tests.
import { createNewCareerState } from "../../lib/career/newCareer";
import { snapshotWorldSquads, snapshotGameplayRatings } from "../../lib/gameWorld/serverSnapshot";
import { SWEDISH_WORLD_COMPETITION_IDS } from "../../lib/career/worldCompetitions";
import { WORLD_POOL_COMPETITION_IDS } from "../../lib/career/careerWorld";
import type { PlayerMock } from "../../lib/game-data";
import type { CareerState } from "../../lib/career/types";
import type { GameplayPlayerRating } from "../../lib/gameWorld/gameplayRatingSnapshot";

let cached: { worldSquads: Record<string, PlayerMock[]>; gameplayRatings: Record<string, GameplayPlayerRating[]> } | undefined;

export function buildFullWorld() {
  if (cached) return cached;
  const worldSquads: Record<string, PlayerMock[]> = {};
  const gameplayRatings: Record<string, GameplayPlayerRating[]> = {};
  for (const competitionId of [...SWEDISH_WORLD_COMPETITION_IDS, ...WORLD_POOL_COMPETITION_IDS]) {
    Object.assign(worldSquads, snapshotWorldSquads(competitionId));
    Object.assign(gameplayRatings, snapshotGameplayRatings(competitionId));
  }
  cached = { worldSquads, gameplayRatings };
  return cached;
}

export function createFullWorldCareer(seed: string, managerClubId = "se_club_hammarby_if_hf"): CareerState {
  const world = buildFullWorld();
  return createNewCareerState(seed, managerClubId, world.worldSquads, {}, world.gameplayRatings);
}
