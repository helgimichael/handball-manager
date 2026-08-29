// Career-aware world accessors (HM-DATA-0.2).
//
// Every career screen used to read the manager's club/squad via
// zero-argument functions hardcoded to IFK Tumba (game-data's
// getPlayerClub()/getSquad()/getPlayer()). These read the actual career
// snapshot instead: `worldSquads[clubId]` when the club was
// real-world-imported at career creation, falling back to the legacy
// static mock squad (TUMBA_SQUAD) for clubs that still only have mock
// data (i.e. IFK Tumba/Allsvenskan, unchanged by this milestone).
import { CLUBS, TUMBA_CLUB_ID, TUMBA_SQUAD, getClub, getClubsByCompetition, type Club, type PlayerMock } from "../game-data";
import { getCareerWorldCompetitionIds } from "./worldCompetitions";
import type { CareerState } from "./types";

// HM-WORLD-PLAYER-POOL-1.0: the 16 competitions the 100-player
// international pool's clubs belong to (6 reused existing mock
// competitions + 10 new ones) -- always a recruitment/scouting source,
// regardless of the manager's own competition. See CareerContext.tsx's
// fetchWorldPoolWorldSquads.
export const WORLD_POOL_COMPETITION_IDS = [
  "ger-1", "den-1", "nor-1", "esp-1", "hun-1", "isl-1",
  "int-aut-1", "int-fro-1", "int-hun-2b", "int-ita-1", "int-ita-2",
  "int-ned-1", "int-pol-1", "int-por-1", "int-qat-1", "int-che-1",
] as const;

/**
 * HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: every club whose squad is a
 * valid Scouting/Transfers candidate source for this career -- every
 * club across every Swedish world competition (Handbollsligan,
 * Allsvenskan, Division 1 Norra/Södra -- via the one shared
 * `getCareerWorldCompetitionIds` resolver, Part 4/9), plus every
 * international player-pool club, never the manager's own club. Shared
 * by app/career/scouting/page.tsx and app/career/transfers/page.tsx so
 * both surfaces stay in sync.
 *
 * Before this milestone: only `career.competitionId` (the manager's own
 * tier) plus Division 1 -- whichever Swedish tier ISN'T the manager's
 * own (e.g. Allsvenskan, for an HBL career) was never a candidate
 * source at all.
 */
export function getExternalCandidateClubs(career: CareerState): Club[] {
  const swedishClubs = getCareerWorldCompetitionIds(career).flatMap((id) => getClubsByCompetition(id));
  const worldPoolClubs = WORLD_POOL_COMPETITION_IDS.flatMap((id) => getClubsByCompetition(id));
  return [...swedishClubs, ...worldPoolClubs].filter((c) => c.id !== career.playerClubId);
}

/** The manager's own club, resolved from career state rather than assumed to be IFK Tumba. */
export function getCareerClub(career: CareerState): Club {
  const club = getClub(career.playerClubId);
  if (!club) throw new Error(`career.playerClubId "${career.playerClubId}" does not resolve to a known club.`);
  return club;
}

/** Any club's squad as snapshotted into this career, or the legacy mock squad for clubs never imported. */
export function getCareerClubSquad(career: CareerState, clubId: string): readonly PlayerMock[] {
  const snapshot = career.worldSquads[clubId];
  if (snapshot) return snapshot;
  if (clubId === TUMBA_CLUB_ID) return TUMBA_SQUAD;
  return [];
}

/** The manager's own squad. */
export function getCareerSquad(career: CareerState): readonly PlayerMock[] {
  return getCareerClubSquad(career, career.playerClubId);
}

/** A player anywhere in this career's known world (manager's club or any snapshotted opponent), by id. */
export function getCareerPlayer(career: CareerState, playerId: string): PlayerMock | undefined {
  const own = getCareerSquad(career).find((p) => p.id === playerId);
  if (own) return own;
  for (const clubId of Object.keys(career.worldSquads)) {
    const found = career.worldSquads[clubId].find((p) => p.id === playerId);
    if (found) return found;
  }
  return undefined;
}

export { CLUBS };
