// HM-DATA-ALLSVENSKAN-1.0: server-only club identity snapshotting,
// mirroring staffIdentitySnapshot.ts/coachIdentitySnapshot.ts's shape
// exactly.
//
// Touches the filesystem (via clubIdentityLoader.ts/coachIdentityLoader.ts/
// staffIdentityLoader.ts) -- must NEVER be imported from client-bundled
// code. Only app/api/game-world/club-identity-snapshot/route.ts (a
// server Route Handler) and this package's own tests may import this
// module.
//
// Deliberately keeps ClubIdentityProfile and CoachIdentityProfile as two
// separate fields on the snapshot (never merged into one blended
// description) -- Part: "Club Identity != Coach Philosophy != Current
// Team Identity". Never gated by Club.dataSource: identity data should
// be visible for any club that has it, real-world or not.
import { getClub } from "../game-data";
import { validateClubIdentityProfile, validateCoachIdentityProfile, selectCurrentStaffAssignments } from "../identity/validators";
import { loadClubIdentity } from "./clubIdentityLoader";
import { loadClubStaffIdentity } from "./staffIdentityLoader";
import { loadCoachIdentity } from "./coachIdentityLoader";
import { leagueSegmentForClub } from "./leagueSegment";
import type { ClubIdentityProfile, CoachIdentityProfile } from "../identity/types";

export interface ClubIdentitySnapshot {
  clubId: string;
  clubIdentity: ClubIdentityProfile | null;
  coachIdentity: (CoachIdentityProfile & { personId: string }) | null;
}

/**
 * Loads and validates one club's long-term Club Identity profile, plus
 * (separately) its current head coach's portable Coach Identity profile
 * if one exists. Returns `null` only for an unknown clubId -- an unknown
 * club has no valid `clubId` to snapshot under at all. A known club with
 * no imported identity file yet returns `{clubId, clubIdentity: null,
 * coachIdentity: null}` (absence, not fabrication -- same rule as
 * resolver.ts). Fails closed on validation failure exactly like the
 * staff/coach snapshot precedents: an invalid file is treated the same
 * as a missing one, never exposed to the game.
 */
export function snapshotClubIdentity(clubId: string, asOfDate: string): ClubIdentitySnapshot | null {
  if (!getClub(clubId)) return null;
  const leagueSegment = leagueSegmentForClub(clubId);

  const rawClub = loadClubIdentity(clubId, leagueSegment);
  const clubIdentity = rawClub && validateClubIdentityProfile(rawClub.profile).ok ? rawClub.profile : null;

  let coachIdentity: (CoachIdentityProfile & { personId: string }) | null = null;
  const staff = loadClubStaffIdentity(clubId, leagueSegment);
  if (staff) {
    const current = selectCurrentStaffAssignments(staff.assignments, asOfDate);
    const headCoachPersonId = current.find((a) => a.standardRoles.includes("HEAD_COACH"))?.personId ?? null;
    if (headCoachPersonId) {
      const rawCoach = loadCoachIdentity(headCoachPersonId, leagueSegment);
      if (rawCoach && rawCoach.personId === headCoachPersonId && validateCoachIdentityProfile(rawCoach.profile).ok) {
        coachIdentity = { ...rawCoach.profile, personId: headCoachPersonId };
      }
    }
  }

  return { clubId, clubIdentity, coachIdentity };
}
