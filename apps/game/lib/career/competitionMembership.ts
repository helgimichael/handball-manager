// HM-ALPHA3-M02/M03: which competition a club plays in THIS career.
//
// lib/game-data/clubs.ts carries each club's static 2026/27 league. Once
// promotion and relegation exist (M03), membership is career state: the
// override map below wins, and everything that asks "what tier is this
// club in now?" should ask here rather than read the static data.
import { getClub, getCompetition } from "../game-data";
import type { CareerState } from "./types";

export function clubCompetitionId(state: Pick<CareerState, "competitionMembership">, clubId: string): string | undefined {
  return state.competitionMembership?.[clubId] ?? getClub(clubId)?.competitionId;
}

/** 1 = Handbollsligan, 2 = Allsvenskan (Division 1 is also tier 2 in the static data; see competitions.ts). */
export function clubCompetitionTier(state: Pick<CareerState, "competitionMembership">, clubId: string): number | undefined {
  const competitionId = clubCompetitionId(state, clubId);
  return competitionId ? getCompetition(competitionId)?.tier : undefined;
}
