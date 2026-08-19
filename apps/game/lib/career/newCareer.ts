import { generateDoubleRoundRobin } from "@handball-manager/game-simulation";
import { CLUBS, GAME_CURRENT_DATE } from "../game-data";
import type { CareerState } from "./types";

const ALLSVENSKAN_COMPETITION_ID = "swe-2";

export function createNewCareerState(saveSeed: string, playerClubId: string): CareerState {
  const allsvenskanClubIds = CLUBS.filter((c) => c.competitionId === ALLSVENSKAN_COMPETITION_ID).map((c) => c.id);

  const generated = generateDoubleRoundRobin({
    competitionId: ALLSVENSKAN_COMPETITION_ID,
    clubIds: allsvenskanClubIds,
    seasonStartDate: GAME_CURRENT_DATE,
    daysBetweenRounds: 7,
  });

  return {
    seasonId: "2026/27",
    competitionId: ALLSVENSKAN_COMPETITION_ID,
    playerClubId,
    gameDate: GAME_CURRENT_DATE,
    seasonComplete: false,
    saveSeed,
    fixtures: generated.map((f) => ({
      id: f.id,
      competitionId: f.competitionId,
      round: f.round,
      date: f.date,
      homeClubId: f.homeClubId,
      awayClubId: f.awayClubId,
    })),
    results: {},
    playerSeasonStats: {},
    clubForm: {},
    inbox: [],
  };
}
