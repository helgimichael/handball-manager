// HM-STAFF-1.0: Staff Roles, Attributes & Training Influence.
//
// This module is a NEW, separate NUMERIC layer alongside lib/identity's
// existing qualitative Club/Coach/Team Identity schema (StaffPerson/
// StaffAssignment/HM_STAFF_ROLES) -- deliberately NOT a duplicate. The
// identity schema is evidence/claim-based and explicitly "no rating
// scales" (lib/identity/types.ts:4-6) -- confirmed by audit that no
// numeric coaching-quality evidence exists anywhere in the source data
// (every coach identity claim is qualitative, e.g. "EXPERIENCED",
// "STRONGLY_DEFENCE_ORIENTED", never a number). This package supplies
// the missing numeric 1-20 attribute layer training/development actually
// needs to compute a quality multiplier, generated deterministically
// (never Math.random) the same way GameplayPlayerRating is generated
// when no numeric evidence exists -- see staffAttributeGeneration.ts.
//
// A real-world identity-backed staff person's NAME and ROLE are real
// (evidence-backed, from lib/identity); their numeric ATTRIBUTES are
// always GENERATED_PRIOR (no numeric evidence exists to derive them
// from) -- this is an honest distinction, not a shortcut: we never claim
// a generated number is "verified".

/**
 * Part 3: a compact, gameplay-relevant canonical staff-role vocabulary --
 * deliberately smaller than lib/identity's HM_STAFF_ROLES (which also
 * covers non-coaching club roles like CHAIRPERSON/TEAM_ADMIN that have
 * no training/development effect and are out of scope here). Every
 * HM_STAFF_ROLES value maps to zero or one of these via
 * mapHMRolesToStaffRoles (staffRosterResolution.ts) -- never the reverse.
 */
export const STAFF_ROLES = ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "PHYSICAL_COACH", "ANALYST", "PHYSIO", "SCOUT"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/**
 * Part 4: a compact 1-20 staff attribute vocabulary -- only what current
 * (and clearly-planned-next: youth development, medical, scouting
 * judgement) roles actually need, not 40 attributes. YOUTH_DEVELOPMENT/
 * MEDICAL/PLAYER_JUDGEMENT/POTENTIAL_JUDGEMENT are reserved (generated
 * and stored like every other attribute, so a future milestone need not
 * re-migrate) but have NO role-suitability or training-quality effect
 * yet (Part 3/33: "not all roles need gameplay effect in 1.0").
 */
export const STAFF_ATTRIBUTES = [
  "TECHNICAL_COACHING",
  "TACTICAL_COACHING",
  "DEFENSIVE_COACHING",
  "ATTACKING_COACHING",
  "GOALKEEPER_COACHING",
  "PHYSICAL_COACHING",
  "PLAYER_DEVELOPMENT",
  "YOUTH_DEVELOPMENT",
  "LEADERSHIP",
  "COMMUNICATION",
  "MOTIVATION",
  "ANALYSIS",
  "MATCH_PREPARATION",
  "MEDICAL",
  "PLAYER_JUDGEMENT",
  "POTENTIAL_JUDGEMENT",
] as const;
export type StaffAttribute = (typeof STAFF_ATTRIBUTES)[number];

export const STAFF_ATTRIBUTE_MIN = 1;
export const STAFF_ATTRIBUTE_MAX = 20;

/** Same EVIDENCE_BACKED/DERIVED/GENERATED_PRIOR philosophy as lib/rating/generation/types.ts's AttributeOrigin, minus EDITOR_OVERRIDE (no staff editor exists yet) and EVIDENCE_BACKED (confirmed by audit: no numeric staff evidence exists anywhere in the source data -- every generated staff attribute is GENERATED_PRIOR). Kept as its own type (not reused from lib/rating) so the two domains can diverge independently. */
export type StaffAttributeOrigin = "GENERATED_PRIOR";

export interface StaffAttributeValue {
  value: number;
  origin: StaffAttributeOrigin;
}

/**
 * Part 17: no single universal "staff CA" -- a staff person's numeric
 * profile is ALWAYS the full attribute set; any "how good is this person
 * at role X" summary is a derived, role-specific suitability score
 * (roleSuitability.ts), never stored here as a second competing number.
 */
export interface StaffAttributeProfile {
  personId: string;
  attributes: Record<StaffAttribute, StaffAttributeValue>;
}

/**
 * Part 21/D: identity is the free-text/evidence layer (lib/identity's
 * StaffPerson/StaffAssignment); this is the resolved, gameplay-facing
 * roster entry HM-STAFF-1.0 actually reads from -- one real (evidence-
 * backed name+role) or generated (fictional, Part 19) staff member, with
 * their canonical role set and numeric profile attached. `source`
 * distinguishes "real identity-backed person, generated attributes" from
 * "entirely generated fictional person" for UI/debug provenance (Part 25)
 * -- never presented to the player as if a generated person were real
 * (Part 19: "do not fabricate them as real people").
 */
export interface ResolvedStaffMember {
  id: string;
  clubId: string;
  displayName: string;
  roles: StaffRole[];
  profile: StaffAttributeProfile;
  source: "REAL_WORLD_IDENTITY" | "GENERATED_FICTIONAL";
}

/**
 * Part 22: the minimal employment-state foundation -- reserved for a
 * future hiring/firing milestone (never mutated by HM-STAFF-1.0 itself;
 * seeded once at career creation, one entry per roster member, and never
 * touched again this milestone). `contract` is a placeholder shape only,
 * never wired to any economy system (Part 39: no salaries/contracts).
 */
export interface StaffEmployment {
  staffId: string;
  clubId: string;
  roles: StaffRole[];
  status: "EMPLOYED";
  contract?: { endSeason: string };
}
