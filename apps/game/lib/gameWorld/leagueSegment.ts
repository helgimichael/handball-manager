// HM-DATA-ALLSVENSKAN-1.0: the one place that maps a clubId to which
// real-world data directory segment ("handbollsligan" vs "allsvenskan")
// its identity files live under -- see clubIdentityLoader.ts/
// staffIdentityLoader.ts/coachIdentityLoader.ts's own `leagueSegment`
// parameter. Derived from Competition.tier (1 -> handbollsligan, 2 ->
// allsvenskan) rather than a hardcoded id list, so it stays correct if
// the club roster changes again. Fictional/unknown clubIds resolve to
// the "handbollsligan" default (matches every loader's own default,
// never a hard failure).
import { getClub, getCompetition } from "../game-data";

export function leagueSegmentForClub(clubId: string): string {
  const club = getClub(clubId);
  const tier = club ? getCompetition(club.competitionId)?.tier : undefined;
  return tier === 2 ? "allsvenskan" : "handbollsligan";
}
