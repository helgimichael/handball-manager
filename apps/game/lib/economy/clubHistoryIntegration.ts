// HM-CONTRACTS-1.0A: the ONLY module that reads/writes CareerState for
// player club/youth history. Mirrors contractIntegration.ts's own
// ensure/get shape exactly -- newCareer.ts and saveMigration.ts call
// ensureCareerPlayerClubHistory; trainingCompensationIntegration.ts
// (and any future UI) calls getPlayerClubHistory.
import { getCareerClubSquad } from "../career/careerWorld";
import { playerAgeAtDate } from "../development/developmentIntegration";
import type { CareerState } from "../career/types";
import { generatePlayerClubHistory } from "./clubHistoryGeneration";
import type { PlayerClubHistory } from "./types";

/**
 * Part: fills ONLY missing roster-player club histories for `clubId` --
 * exact same idempotency contract as ensureCareerPlayerContracts/
 * ensureCareerGameplayRatings: never touches an existing history, true
 * no-op / same reference when nothing missing.
 */
export function ensureCareerPlayerClubHistory(state: CareerState, clubId: string): CareerState {
  const squad = getCareerClubSquad(state, clubId);
  if (squad.length === 0) return state;

  const existing = state.playerClubHistory;
  const missing = squad.filter((p) => !existing[p.id]);
  if (missing.length === 0) return state;

  const nextHistory: Record<string, PlayerClubHistory> = { ...existing };
  for (const player of missing) {
    const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate);
    nextHistory[player.id] = generatePlayerClubHistory(player, age);
  }
  return { ...state, playerClubHistory: nextHistory };
}

export function getPlayerClubHistory(state: CareerState, playerId: string): PlayerClubHistory | undefined {
  return state.playerClubHistory[playerId];
}
