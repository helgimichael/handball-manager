// HM-IDENTITY-0.3: composes the existing club/squad/season/coach/staff
// identity loaders (HM-IDENTITY-0.2/0.2B) into one resolved
// CurrentTeamIdentity for a given club, ready for either read-only
// display or the AI tactical preference adapter (career/aiTacticalPreferences.ts).
// Mirrors the same composition already proven in
// lib/gameWorld/currentTeamIdentity.test.ts's own local resolveForClub
// helper -- this is that composition made reusable by production code.
import { resolveCurrentTeamIdentity, type CurrentTacticalSelectionView, type ResolvedCurrentTeamIdentity } from "../identity/resolver";
import { selectCurrentStaffAssignments } from "../identity/validators";
import { loadCoachIdentity } from "./coachIdentityLoader";
import { loadClubIdentity, loadSeasonIdentity, loadSquadIdentity } from "./clubIdentityLoader";
import { loadClubStaffIdentity } from "./staffIdentityLoader";
import { leagueSegmentForClub } from "./leagueSegment";

/** The real head coach's personId currently CONFIRMED at a club as of `asOfDate`, or null if none/unresolvable. */
function currentHeadCoachPersonId(clubId: string, asOfDate: string, leagueSegment: string): string | null {
  const staff = loadClubStaffIdentity(clubId, leagueSegment);
  if (!staff) return null;
  const current = selectCurrentStaffAssignments(staff.assignments, asOfDate);
  const headCoach = current.find((a) => a.standardRoles.includes("HEAD_COACH"));
  return headCoach?.personId ?? null;
}

/**
 * Resolves a club's CurrentTeamIdentity from real imported source data
 * (never invents any of it -- a club with no imported file for a given
 * layer simply contributes nothing from that layer, per resolver.ts's
 * own "absence, not fabrication" guarantee).
 */
export function resolveClubIdentityForMatch(
  clubId: string,
  season: string,
  asOfDate: string,
  tacticalProfile: CurrentTacticalSelectionView | null = null,
): ResolvedCurrentTeamIdentity {
  const leagueSegment = leagueSegmentForClub(clubId);
  const club = loadClubIdentity(clubId, leagueSegment);
  const squad = loadSquadIdentity(clubId, leagueSegment);
  const seasonContext = loadSeasonIdentity(clubId, leagueSegment);
  const coachPersonId = currentHeadCoachPersonId(clubId, asOfDate, leagueSegment);
  const coach = coachPersonId ? loadCoachIdentity(coachPersonId, leagueSegment) : null;

  return resolveCurrentTeamIdentity({
    clubId,
    season,
    clubIdentity: club?.profile ?? null,
    coachPersonId,
    coachIdentity: coach?.profile ?? null,
    squadContext: squad?.context ?? null,
    seasonContext: seasonContext?.context ?? null,
    tacticalProfile,
  });
}
