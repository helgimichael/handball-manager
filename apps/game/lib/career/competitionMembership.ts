// HM-ALPHA3-M02/M03 + Club Identity C3: which competition a club plays in
// THIS career, in a given season. The one career-aware league resolver --
// everything that asks "what league is this club in now?" asks here, never
// `Club.competitionId` directly (that field is the frozen legacy baseline).
//
// Resolution order (MIGRATION-STRATEGY §3.2):
//   1. state.competitionMembership[clubId]: the career's own simulation always wins.
//   2. Swedish clubs: their starting league (the career's own promotion and
//      relegation engine owns every later move; real-world data never applies).
//   3. Legacy career (no clubWorldBaseline) in its start season: the frozen v8
//      league, so a season in progress never changes under an existing save.
//      Records added by a later data epoch do not exist there yet.
//   4. Otherwise: the real-world league for that season from the append-only
//      competitionHistory (last known season carried forward).
// Foreign leagues are not simulated, so steps 3-4 are deterministic: the same
// static data gives the same answer for the same season.
import { CLUBS, CLUB_WORLD_START_SEASON, getClub, getCompetition, isSwedishClub, realWorldCompetitionForSeason, type Club } from "../game-data";
import type { CareerState } from "./types";

export type MembershipState = Pick<CareerState, "competitionMembership"> & Partial<Pick<CareerState, "seasonId" | "clubWorldBaseline">>;

/** True for every save created before the club-world marker existed (all v8 careers up to Club Identity C3). */
export function isLegacyClubWorld(state: Partial<Pick<CareerState, "clubWorldBaseline">>): boolean {
  return !state.clubWorldBaseline;
}

export function clubCompetitionForSeason(state: MembershipState, clubId: string, seasonId: string = state.seasonId ?? CLUB_WORLD_START_SEASON): string | undefined {
  const override = state.competitionMembership?.[clubId];
  if (override) return override;
  const club = getClub(clubId);
  if (!club) return undefined;
  const legacyStart = isLegacyClubWorld(state) && seasonId <= CLUB_WORLD_START_SEASON;
  if (legacyStart && club.addedInWorld) return undefined;
  if (isSwedishClub(club.id) || legacyStart) return club.competitionId;
  return realWorldCompetitionForSeason(club, seasonId);
}

/** The club's league in the career's CURRENT season. */
export function clubCompetitionId(state: MembershipState, clubId: string): string | undefined {
  return clubCompetitionForSeason(state, clubId);
}

/** 1 = Handbollsligan, 2 = Allsvenskan (Division 1 is also tier 2 in the static data; see competitions.ts). */
export function clubCompetitionTier(state: MembershipState, clubId: string): number | undefined {
  const competitionId = clubCompetitionId(state, clubId);
  return competitionId ? getCompetition(competitionId)?.tier : undefined;
}

/**
 * Members of `competitionId` in this career's season, in CLUBS order (the
 * same order as the legacy getClubsByCompetition, so deterministic picks by
 * index are identical for a legacy career before its first rollover).
 */
export function careerClubsInCompetition(state: MembershipState, competitionId: string, seasonId?: string): Club[] {
  return CLUBS.filter((c) => clubCompetitionForSeason(state, c.id, seasonId) === competitionId);
}
