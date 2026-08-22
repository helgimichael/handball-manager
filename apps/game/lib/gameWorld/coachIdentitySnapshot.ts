// HM-COACH-IDENTITY-0.1: server-only coach identity snapshotting,
// mirroring staffIdentitySnapshot.ts's shape exactly.
//
// Touches the filesystem (via coachIdentityLoader.ts/staffIdentityLoader.ts)
// -- must NEVER be imported from client-bundled code. Only
// app/api/game-world/coach-identity-snapshot/route.ts (a server Route
// Handler) and this package's own tests may import this module.
import { getClub } from "../game-data";
import { validateCoachIdentityProfile } from "../identity/validators";
import { loadCoachIdentity } from "./coachIdentityLoader";
import { loadClubStaffIdentity } from "./staffIdentityLoader";
import type { CoachIdentityProfile } from "../identity/types";

export interface CoachIdentitySnapshot {
  personId: string;
  clubId: string;
  profile: CoachIdentityProfile;
}

/**
 * Loads and validates one coach's portable identity. Fails closed (`null`)
 * if: the personId has no identity file, its declared clubId isn't a
 * known canonical club, that club's own staff roster doesn't actually
 * list this personId (Spec invariant: claims attach to the correct,
 * real StaffPerson -- never a dangling reference), or the profile fails
 * HM-IDENTITY-0.1 validation. Never expose invalid or unattached coach
 * data to the game.
 */
export function snapshotCoachIdentity(personId: string): CoachIdentitySnapshot | null {
  const raw = loadCoachIdentity(personId);
  if (!raw) return null;
  if (raw.personId !== personId) return null;
  if (!getClub(raw.clubId)) return null;

  const staff = loadClubStaffIdentity(raw.clubId);
  if (!staff || !staff.people.some((p) => p.id === personId)) return null;

  if (!validateCoachIdentityProfile(raw.profile).ok) return null;

  return { personId, clubId: raw.clubId, profile: raw.profile };
}
