// HM-WORLD-PLAYER-POOL-1.0: gives every international-pool player the
// same minimal economic identity (canonical gameplay rating, a
// contract, a club/youth history) every other career club's squad
// already gets -- mirrors lib/career/division1Integration.ts exactly
// (same three generators, same order, same "no persistent
// ClubEconomyBaseline needed" scope). Without a contract, Transfers
// treats a player as unfindable (submitTransferOffer requires
// getPlayerContract to resolve); this is the one thing that actually
// unlocks "foreign club -> player -> ... -> transfer offer -> contract".
import { getClubsByCompetition } from "../game-data";
import type { CareerState } from "./types";
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import { ensureCareerPlayerContracts } from "../economy/contractIntegration";
import { ensureCareerPlayerClubHistory } from "../economy/clubHistoryIntegration";
import { WORLD_POOL_COMPETITION_IDS } from "./careerWorld";

export function ensureWorldPoolPlayerEconomicIdentity(state: CareerState): CareerState {
  let next = state;
  for (const competitionId of WORLD_POOL_COMPETITION_IDS) {
    for (const club of getClubsByCompetition(competitionId)) {
      next = ensureCareerGameplayRatings(next, club.id);
      next = ensureCareerPlayerContracts(next, club.id);
      next = ensureCareerPlayerClubHistory(next, club.id);
    }
  }
  return next;
}
