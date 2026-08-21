// Career-aware world accessors (HM-DATA-0.2).
//
// Every career screen used to read the manager's club/squad via
// zero-argument functions hardcoded to IFK Tumba (game-data's
// getPlayerClub()/getSquad()/getPlayer()). These read the actual career
// snapshot instead: `worldSquads[clubId]` when the club was
// real-world-imported at career creation, falling back to the legacy
// static mock squad (TUMBA_SQUAD) for clubs that still only have mock
// data (i.e. IFK Tumba/Allsvenskan, unchanged by this milestone).
import { CLUBS, TUMBA_CLUB_ID, TUMBA_SQUAD, getClub, type Club, type PlayerMock } from "../game-data";
import type { CareerState } from "./types";

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
