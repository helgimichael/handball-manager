// HM-STAFF-1.0 Part 15/19/20: resolves ONE club's gameplay-facing staff
// roster -- real identity-backed staff (name+role evidence-backed,
// attributes always generated -- Part 15) blended with generated
// fictional staff wherever essential coverage (Part 19) is missing.
// Deterministic; the only caller allowed to invoke this at career-
// creation time is lib/career/newCareer.ts (mirrors worldSquads/
// gameplayRatings' own "resolved once, frozen into CareerState" precedent).
import type { HMStaffRole, StaffAssignment, StaffPerson } from "../identity/types";
import { generateFictionalStaffName, generateStaffAttributeProfile } from "./staffAttributeGeneration";
import { STAFF_ROLES, type ResolvedStaffMember, type StaffRole } from "./types";

/**
 * Part 3: the ONE mapping from the identity system's broad HMStaffRole
 * vocabulary onto this milestone's compact gameplay-relevant roles.
 * Never the reverse (Part 3's own doc comment on STAFF_ROLES). A role
 * with no entry here (CHAIRPERSON, CLUB_DIRECTOR, TEAM_ADMIN,
 * EQUIPMENT_MANAGER, OTHER, ACTIVE_PLAYER, ...) contributes nothing --
 * that person simply isn't eligible for any training assignment, which
 * is correct (an equipment manager should never lead a training session).
 */
const HM_ROLE_TO_STAFF_ROLE: Partial<Record<HMStaffRole, StaffRole>> = {
  HEAD_COACH: "HEAD_COACH",
  ASSISTANT_COACH: "ASSISTANT_COACH",
  COACH: "ASSISTANT_COACH", // Part 3: a generic "Coach" with no further specialization is closest to an assistant coach for training-eligibility purposes.
  GOALKEEPER_COACH: "GOALKEEPER_COACH",
  STRENGTH_CONDITIONING_COACH: "PHYSICAL_COACH",
  ANALYST: "ANALYST",
  SCOUT: "SCOUT",
  PHYSIOTHERAPIST: "PHYSIO",
  DOCTOR: "PHYSIO", // Part 3: folded into the same medical bucket -- HM-STAFF-1.0 does not model DOCTOR separately (no medical gameplay effect exists yet either way, Part 39).
};

function mapHMRolesToStaffRoles(standardRoles: readonly HMStaffRole[]): StaffRole[] {
  const mapped = new Set<StaffRole>();
  for (const role of standardRoles) {
    const staffRole = HM_ROLE_TO_STAFF_ROLE[role];
    if (staffRole) mapped.add(staffRole);
  }
  return [...mapped];
}

/**
 * A real, canonical staff person is ALWAYS included, even when their
 * official title (e.g. Sportchef, Lagledare) has no gameplay-relevant
 * StaffRole mapping -- `roles` is then `[]` (no training eligibility,
 * no role-suitability), and `officialRoleLabel` carries their real title
 * for display instead. Never returns null for a real person -- only a
 * GENERATED_FICTIONAL member is ever synthesized to cover a genuine
 * StaffRole gap (see ESSENTIAL_ROLES below).
 */
function buildFromIdentity(person: StaffPerson, assignment: StaffAssignment, clubId: string): ResolvedStaffMember {
  const roles = mapHMRolesToStaffRoles(assignment.standardRoles);
  return {
    id: person.id,
    clubId,
    displayName: person.displayName,
    roles,
    ...(roles.length === 0 ? { officialRoleLabel: assignment.officialRole } : {}),
    profile: generateStaffAttributeProfile(person.id, roles, `${person.id}:${clubId}`),
    source: "REAL_WORLD_IDENTITY",
  };
}

function buildGenerated(clubId: string, role: StaffRole, seedSuffix: string): ResolvedStaffMember {
  const id = `generated-staff:${clubId}:${role}:${seedSuffix}`;
  return {
    id,
    clubId,
    displayName: generateFictionalStaffName(id),
    roles: [role],
    profile: generateStaffAttributeProfile(id, [role], id),
    source: "GENERATED_FICTIONAL",
  };
}

/** Part 19: the minimum functional coverage every playable club must have -- if real (or already-generated) staff don't already cover a role, a generated fictional member fills exactly that gap, nothing more. */
const ESSENTIAL_ROLES: readonly StaffRole[] = ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "PHYSICAL_COACH"];

export interface RawClubStaffIdentityLike {
  people: readonly StaffPerson[];
  assignments: readonly StaffAssignment[];
}

/**
 * Part 15/19/20: resolves the full roster for one club. `identity` is
 * the real HM-IDENTITY-0.1 data for this club if any exists (already
 * fetched server-side and filtered to CURRENT assignments by the
 * caller -- see career/staffFetch.ts's use of selectCurrentStaffAssignments),
 * or `null`/empty for a club with no identity file (every mock club,
 * Part 20). Essential-role gaps are always filled with generated
 * fictional staff (Part 19), regardless of whether the club has ANY
 * real identity data at all.
 */
export function resolveClubStaffRoster(clubId: string, identity: RawClubStaffIdentityLike | null): ResolvedStaffMember[] {
  const roster: ResolvedStaffMember[] = [];

  if (identity) {
    const peopleById = new Map(identity.people.map((p) => [p.id, p]));
    for (const assignment of identity.assignments) {
      const person = peopleById.get(assignment.personId);
      if (!person) continue;
      roster.push(buildFromIdentity(person, assignment, clubId));
    }
  }

  const coveredRoles = new Set(roster.flatMap((m) => m.roles));
  for (const role of ESSENTIAL_ROLES) {
    if (!coveredRoles.has(role)) {
      roster.push(buildGenerated(clubId, role, "essential"));
    }
  }

  return roster.sort((a, b) => a.id.localeCompare(b.id));
}

export const ALL_STAFF_ROLES = STAFF_ROLES;
