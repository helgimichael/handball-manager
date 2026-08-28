// HM-DATA-DIV1-1.0: gives every Division 1 Norra/Södra player the SAME
// minimal economic identity (canonical gameplay rating, a contract, a
// club/youth history) every other career club's squad already gets from
// ensureCareerClubEconomy (lib/economy/clubEconomyIntegration.ts) --
// WITHOUT that function's own last step (a persistent ClubEconomyBaseline
// per club), which this milestone explicitly does not need for Division
// 1 ("behöver INTE ... detailed finances"). Without a contract, Transfers
// treats a Division 1 player as unfindable (submitTransferOffer requires
// getPlayerContract to resolve); this is the one thing that actually
// unlocks "DIV1 PLAYER -> transfer target -> offer -> contract".
//
// Reuses the exact same three generators ensureCareerClubEconomy already
// calls, in the same order -- no new generation logic. Fully idempotent
// (every underlying ensure* is fill-only), so calling this on every
// career load is cheap once already populated.
import { getClubsByCompetition } from "../game-data";
import type { CareerState } from "./types";
import { ensureCareerGameplayRatings } from "./careerRatingNormalization";
import { ensureCareerPlayerContracts } from "../economy/contractIntegration";
import { ensureCareerPlayerClubHistory } from "../economy/clubHistoryIntegration";

export const DIVISION_1_COMPETITION_IDS = ["se_division1_norra", "se_division1_sodra"] as const;

export function ensureDivision1PlayerEconomicIdentity(state: CareerState): CareerState {
  let next = state;
  for (const competitionId of DIVISION_1_COMPETITION_IDS) {
    for (const club of getClubsByCompetition(competitionId)) {
      next = ensureCareerGameplayRatings(next, club.id);
      next = ensureCareerPlayerContracts(next, club.id);
      next = ensureCareerPlayerClubHistory(next, club.id);
    }
  }
  return next;
}
