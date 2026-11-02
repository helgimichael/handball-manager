// HM-STAFF-1.0 Part 15/19/20, HM-DATA-ALLSVENSKAN-1.1B Parts 4/5/6:
// resolves ONE club's gameplay-facing staff roster -- real identity-backed
// staff (name+role evidence-backed, attributes always generated -- Part
// 15) blended with generated fictional staff wherever essential coverage
// (Part 19) is missing, but ONLY for a club whose world/data model is
// itself GENERATED/MOCK. A REAL_WORLD club's genuine data gaps stay
// genuine gaps -- UNKNOWN STAFF != GENERATED PERSON (Part 4): if a real
// club's canonical source has no goalkeeper coach, that club simply has
// no goalkeeper coach; every downstream system (training, staff-cost,
// role-suitability) must tolerate that, never paper over it with an
// invented name.
// Deterministic; the only caller allowed to invoke this at career-
// creation time is lib/career/newCareer.ts (mirrors worldSquads/
// gameplayRatings' own "resolved once, frozen into CareerState" precedent).
import type { HMStaffRole, StaffAssignment, StaffPerson } from "../identity/types";
import { generateFictionalStaffName, generateStaffAttributeProfile } from "./staffAttributeGeneration";
import { STAFF_ROLES, type ResolvedStaffMember, type StaffEmploymentType, type StaffRole } from "./types";

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
  // HM-STAFF-CAREER-1.0: these two now get real attributes/suitability
  // (see roleAttributeMap.ts) -- but note this mapping alone does NOT
  // make them SALARIED (see classifyEmploymentType's own
  // ADMINISTRATIVE_STAFF_ROLES carve-out below).
  SPORTING_DIRECTOR: "SPORTING_DIRECTOR",
  TEAM_MANAGER: "TEAM_MANAGER",
};

function mapHMRolesToStaffRoles(standardRoles: readonly HMStaffRole[]): StaffRole[] {
  const mapped = new Set<StaffRole>();
  for (const role of standardRoles) {
    const staffRole = HM_ROLE_TO_STAFF_ROLE[role];
    if (staffRole) mapped.add(staffRole);
  }
  return [...mapped];
}

// ---------------------------------------------------------------------
// Part 5: staff hierarchy -- a reusable rank per broad HMStaffRole,
// lowest number = most senior. A person with several roles is ranked by
// their MOST senior one. Governance/ownership roles rank strictly above
// every coaching/support function -- and, separately (Part 6), are never
// treated as ordinary coaching staff for employment/cost purposes either.
// ---------------------------------------------------------------------
const HM_ROLE_HIERARCHY_RANK: Record<HMStaffRole, number> = {
  CHAIRPERSON: 0,
  CLUB_DIRECTOR: 0,
  SENIOR_DIRECTOR: 0,
  ELITE_DIRECTOR: 0,
  SPORTING_DIRECTOR: 1,
  HEAD_COACH: 2,
  ASSISTANT_COACH: 3,
  COACH: 3,
  GOALKEEPER_COACH: 4,
  STRENGTH_CONDITIONING_COACH: 4,
  ANALYST: 5,
  SCOUT: 5,
  PHYSIOTHERAPIST: 6,
  DOCTOR: 6,
  PERFORMANCE_STAFF: 6,
  TEAM_MANAGER: 7,
  TEAM_ADMIN: 7,
  EQUIPMENT_MANAGER: 8,
  OTHER: 8,
  ACTIVE_PLAYER: 8,
};

function hierarchyRank(hmRoles: readonly HMStaffRole[]): number {
  if (hmRoles.length === 0) return 8;
  return Math.min(...hmRoles.map((r) => HM_ROLE_HIERARCHY_RANK[r]));
}

/** Sports/club leadership+ownership roles -- never ordinary employed coaching staff, regardless of what a future governance-data pass adds. */
const GOVERNANCE_ONLY_HM_ROLES: ReadonlySet<HMStaffRole> = new Set(["CHAIRPERSON", "CLUB_DIRECTOR", "SENIOR_DIRECTOR", "ELITE_DIRECTOR"]);

/**
 * HM-STAFF-CAREER-1.0: SPORTING_DIRECTOR and TEAM_MANAGER now map to a
 * real StaffRole (for attributes/suitability, roleAttributeMap.ts), but
 * that alone must NOT flip a real person to SALARIED -- Swedish
 * semi-pro/Allsvenskan clubs commonly staff these as unpaid/volunteer
 * administrative roles (e.g. one real club's own identity data
 * explicitly documents its sportchef as "ZERO_COST_NON_SALARIED_FIRST_ROLE"),
 * and no structured per-person salary evidence exists to say otherwise
 * for any specific person. Only a genuine coaching/medical/analyst
 * function (the roles staffCost.ts actually prices) implies SALARIED by
 * default; these two stay VOLUNTARY unless a real recruitment
 * negotiation (staffRecruitment.ts) explicitly makes them SALARIED.
 */
const ADMINISTRATIVE_STAFF_ROLES: ReadonlySet<StaffRole> = new Set(["SPORTING_DIRECTOR", "TEAM_MANAGER"]);

/**
 * Part 6: SALARIED for a genuine coaching/medical/analyst function
 * (has a gameplay StaffRole mapping, excluding the administrative-only
 * roles above -- these are exactly the roles staffCost.ts already
 * prices); GOVERNANCE for club leadership/ownership or a collective
 * governance body (a committee is never one "employed" individual);
 * VOLUNTARY for every other real administrative/support title with no
 * priced gameplay-role mapping and no salary evidence (Lagledare,
 * Materialansvarig, Sportchef, ...). Never fabricates a wage/contract
 * for a real person the source doesn't support one for.
 */
function classifyEmploymentType(hmRoles: readonly HMStaffRole[], staffRoles: readonly StaffRole[], personKind: StaffPerson["personKind"]): StaffEmploymentType {
  if (personKind === "COLLECTIVE_GROUP") return "GOVERNANCE";
  if (hmRoles.length > 0 && hmRoles.every((r) => GOVERNANCE_ONLY_HM_ROLES.has(r))) return "GOVERNANCE";
  if (staffRoles.some((r) => !ADMINISTRATIVE_STAFF_ROLES.has(r))) return "SALARIED";
  return "VOLUNTARY";
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
    hmRoles: assignment.standardRoles,
    employmentType: classifyEmploymentType(assignment.standardRoles, roles, person.personKind),
    profile: generateStaffAttributeProfile(person.id, roles, `${person.id}:${clubId}`),
    source: "REAL_WORLD_IDENTITY",
  };
}

/** The single HMStaffRole a generated fictional member's StaffRole maps back onto, for hierarchy sorting -- the exact reverse of HM_ROLE_TO_STAFF_ROLE (only ever one direction is needed since a generated member always has exactly one role). */
const STAFF_ROLE_TO_HM_ROLE: Record<StaffRole, HMStaffRole> = {
  HEAD_COACH: "HEAD_COACH",
  ASSISTANT_COACH: "ASSISTANT_COACH",
  GOALKEEPER_COACH: "GOALKEEPER_COACH",
  PHYSICAL_COACH: "STRENGTH_CONDITIONING_COACH",
  ANALYST: "ANALYST",
  PHYSIO: "PHYSIOTHERAPIST",
  SCOUT: "SCOUT",
  SPORTING_DIRECTOR: "SPORTING_DIRECTOR",
  TEAM_MANAGER: "TEAM_MANAGER",
  HEAD_OF_RECRUITMENT: "SCOUT",
  HEAD_OF_ACADEMY: "ELITE_DIRECTOR",
  DEVELOPMENT_COACH: "COACH",
};

function buildGenerated(clubId: string, role: StaffRole, seedSuffix: string): ResolvedStaffMember {
  const id = `generated-staff:${clubId}:${role}:${seedSuffix}`;
  return {
    id,
    clubId,
    displayName: generateFictionalStaffName(id),
    roles: [role],
    hmRoles: [STAFF_ROLE_TO_HM_ROLE[role]],
    employmentType: "SALARIED",
    profile: generateStaffAttributeProfile(id, [role], id),
    source: "GENERATED_FICTIONAL",
  };
}

/** Part 19: the minimum functional coverage a GENERATED/MOCK club must have -- if real (or already-generated) staff don't already cover a role, a generated fictional member fills exactly that gap, nothing more. NEVER applied to a REAL_WORLD club (Part 4) -- see resolveClubStaffRoster's own `isRealWorldClub` parameter. */
const ESSENTIAL_ROLES: readonly StaffRole[] = ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "PHYSICAL_COACH"];

export interface RawClubStaffIdentityLike {
  people: readonly StaffPerson[];
  assignments: readonly StaffAssignment[];
}

/**
 * Part 15/19/20/HM-DATA-ALLSVENSKAN-1.1B Part 4: resolves the full
 * roster for one club. `identity` is the real HM-IDENTITY-0.1 data for
 * this club if any exists (already fetched server-side and filtered to
 * CURRENT assignments by the caller -- see career/staffFetch.ts's use of
 * selectCurrentStaffAssignments), or `null`/empty for a club with no
 * identity file.
 *
 * `isRealWorldClub` (Club.dataSource === "REAL_WORLD") gates the
 * essential-role generated-fallback entirely: a REAL_WORLD club's
 * genuine staffing gap (e.g. no goalkeeper coach in its canonical
 * source) stays a genuine gap -- UNKNOWN STAFF != GENERATED PERSON.
 * Generated fictional filler is only ever synthesized for a club whose
 * world/data model is itself GENERATED/MOCK (every non-real-world club,
 * where there is no real staffing truth to misrepresent).
 */
export function resolveClubStaffRoster(clubId: string, identity: RawClubStaffIdentityLike | null, isRealWorldClub: boolean): ResolvedStaffMember[] {
  const roster: ResolvedStaffMember[] = [];

  if (identity) {
    const peopleById = new Map(identity.people.map((p) => [p.id, p]));
    for (const assignment of identity.assignments) {
      const person = peopleById.get(assignment.personId);
      if (!person) continue;
      roster.push(buildFromIdentity(person, assignment, clubId));
    }
  }

  if (!isRealWorldClub) {
    const coveredRoles = new Set(roster.flatMap((m) => m.roles));
    for (const role of ESSENTIAL_ROLES) {
      if (!coveredRoles.has(role)) {
        roster.push(buildGenerated(clubId, role, "essential"));
      }
    }
  }

  return roster.sort((a, b) => {
    const rankDiff = hierarchyRank(a.hmRoles) - hierarchyRank(b.hmRoles);
    return rankDiff !== 0 ? rankDiff : a.displayName.localeCompare(b.displayName);
  });
}

export const ALL_STAFF_ROLES = STAFF_ROLES;
