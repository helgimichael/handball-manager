// HM-STAFF-DATA-0.1: server-only staff identity snapshotting, mirroring
// serverSnapshot.ts's shape exactly.
//
// Touches the filesystem (via staffIdentityLoader.ts) -- must NEVER be
// imported from client-bundled code. Only app/api/game-world/staff-
// snapshot/route.ts (a server Route Handler) and this package's own
// tests may import this module.
import { getClub, getClubsByCompetition } from "../game-data";
import { validateStaffAssignment, validateStaffPerson } from "../identity/validators";
import { loadClubStaffIdentity } from "./staffIdentityLoader";
import { leagueSegmentForClub } from "./leagueSegment";
import type { StaffAssignment, StaffPerson } from "../identity/types";

export interface ClubStaffSnapshot {
  clubId: string;
  people: StaffPerson[];
  assignments: StaffAssignment[];
}

/**
 * Loads and validates one club's staff identity data. Returns `null` if
 * the clubId isn't a known canonical club (this is also what keeps
 * filesystem path construction safe -- see staffIdentityLoader.ts's own
 * note), if no identity file exists for it yet, or if the file fails
 * HM-IDENTITY-0.1 validation (never expose invalid staff data to the
 * game -- fail closed, not open).
 */
export function snapshotClubStaff(clubId: string): ClubStaffSnapshot | null {
  if (!getClub(clubId)) return null;
  const raw = loadClubStaffIdentity(clubId, leagueSegmentForClub(clubId));
  if (!raw) return null;

  const knownPersonIds = new Set(raw.people.map((p) => p.id));
  for (const person of raw.people) {
    if (!validateStaffPerson(person).ok) return null;
  }
  for (const assignment of raw.assignments) {
    if (!validateStaffAssignment(assignment, knownPersonIds).ok) return null;
  }

  return { clubId, people: raw.people, assignments: raw.assignments };
}

/**
 * HM-STAFF-CAREER-1.0: snapshots every REAL_WORLD club's own staff
 * identity for `competitionId` in one call -- the staff-domain twin of
 * serverSnapshot.ts's `snapshotWorldSquads`, needed now that staff
 * recruitment/browsing requires EVERY club's roster, not only the
 * manager's own. A club with no identity file (or one that fails
 * validation) simply has no entry in the result, exactly like a missing
 * `clubId` key means for `snapshotClubStaff` returning `null` -- never a
 * thrown error for one bad/missing club file.
 */
export function snapshotAllClubsStaff(competitionId: string): Record<string, ClubStaffSnapshot> {
  const result: Record<string, ClubStaffSnapshot> = {};
  for (const club of getClubsByCompetition(competitionId)) {
    if (club.dataSource !== "REAL_WORLD") continue;
    const snapshot = snapshotClubStaff(club.id);
    if (snapshot) result[club.id] = snapshot;
  }
  return result;
}
