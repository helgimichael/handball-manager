import { generateDoubleRoundRobin } from "@handball-manager/game-simulation";
import { CLUBS, GAME_CURRENT_DATE } from "../game-data";
import { addDays } from "./dateUtils";
import { seedCareerTasks } from "./careerTasks";
import { seedPlayerStatuses } from "./playerStatus";
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
    seasonStartDate: GAME_CURRENT_DATE,
    // The first CONTINUE press should process the season's actual first
    // day, so processedThroughDate starts one day BEHIND it.
    processedThroughDate: addDays(GAME_CURRENT_DATE, -1),
    careerEvents: [],
    playerStatuses: seedPlayerStatuses(GAME_CURRENT_DATE),
    tasks: seedCareerTasks(GAME_CURRENT_DATE),
  };
}
