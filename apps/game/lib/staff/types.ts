// HM-STAFF-1.0: Staff Roles, Attributes & Training Influence.
import type { HMStaffRole } from "../identity/types";
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
/**
 * HM-STAFF-CAREER-1.0: SPORTING_DIRECTOR (sportchef) and TEAM_MANAGER
 * (lagledare) were previously unmapped identity titles -- a real person
 * holding one of these got `roles: []` (no attributes, no suitability,
 * Part: "Sportchef — —" in the Staff list). They now get real,
 * role-shaped attribute profiles and suitability like every coaching
 * role, WITHOUT automatically becoming a SALARIED employment relationship
 * (see staffRosterResolution.ts's own classifyEmploymentType note --
 * mapping to a StaffRole and being an employed, salaried worker are two
 * separate questions for these two administrative roles specifically).
 */
export const STAFF_ROLES = ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "PHYSICAL_COACH", "ANALYST", "PHYSIO", "SCOUT", "SPORTING_DIRECTOR", "TEAM_MANAGER"] as const;
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
/**
 * HM-STAFF-CAREER-1.0: seven attributes added for the two new
 * administrative roles above -- RECRUITMENT/NEGOTIATION/SQUAD_PLANNING/
 * FINANCIAL_JUDGEMENT (sportchef: rekrytering, förhandling, truppplanering,
 * ekonomiskt omdöme) and ORGANISATION/LOGISTICS/TEAM_ENVIRONMENT
 * (lagledare: organisation, logistik, lagmiljö). "Talangbedömning"
 * (sportchef) and "kommunikation" (lagledare) deliberately reuse the
 * already-existing POTENTIAL_JUDGEMENT/COMMUNICATION attributes rather
 * than adding near-duplicates.
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
  "RECRUITMENT",
  "NEGOTIATION",
  "SQUAD_PLANNING",
  "FINANCIAL_JUDGEMENT",
  "ORGANISATION",
  "LOGISTICS",
  "TEAM_ENVIRONMENT",
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
/**
 * HM-DATA-ALLSVENSKAN-1.1B Part 6: not every real staff person is an
 * employed, salaried club worker -- a board/committee member has no
 * ordinary employment contract at all, and several real clubs'
 * identity data explicitly documents a role as unpaid (e.g. Kungälv's
 * sportingDirectorResourcing claim: "ZERO_COST_NON_SALARIED_FIRST_ROLE").
 * - SALARIED: a coaching/medical/analyst function -- costed by
 *   staffCost.ts, carries a derived contractEndDate (see StaffEmployment).
 * - VOLUNTARY: a real administrative/team-support title (Lagledare,
 *   Materialansvarig, Sportchef with no explicit salary evidence, ...)
 *   with no gameplay StaffRole mapping and no wage/contract.
 * - GOVERNANCE: club leadership/ownership (Ordförande, styrelse, a
 *   collective "Sportkommitté" body) -- never treated as ordinary
 *   coaching staff, never costed as staff, never given a contract.
 * GENERATED_FICTIONAL members are always SALARIED -- they only ever
 * exist to cover a genuine, costed gameplay-role gap (see ESSENTIAL_ROLES).
 */
export const STAFF_EMPLOYMENT_TYPES = ["SALARIED", "VOLUNTARY", "GOVERNANCE"] as const;
export type StaffEmploymentType = (typeof STAFF_EMPLOYMENT_TYPES)[number];

export interface ResolvedStaffMember {
  id: string;
  clubId: string;
  displayName: string;
  roles: StaffRole[];
  /**
   * HM-DATA-ALLSVENSKAN-1.2/1.1B: the person's real, free-text official
   * title from source identity data (e.g. "Sportchef", "Lagledare"), for
   * a REAL_WORLD_IDENTITY member whose title has no gameplay-relevant
   * StaffRole mapping (`roles` is then `[]`) -- a real, canonical staff
   * person must never be silently dropped from the roster just because
   * this milestone's narrow training-role vocabulary has no slot for
   * them (Part: "VERIFIED/CANONICAL REAL STAFF > generated filler
   * staff"). Always undefined for GENERATED_FICTIONAL members (a
   * generated person only ever exists to cover one specific StaffRole
   * gap, never a governance/administrative title).
   */
  officialRoleLabel?: string;
  /**
   * HM-DATA-ALLSVENSKAN-1.1B Part 5: the ORIGINAL, broad lib/identity
   * HM_STAFF_ROLES this person actually holds (governance included) --
   * the source hierarchy-sort/employment-classification input, since the
   * narrow `roles: StaffRole[]` above deliberately drops governance/
   * administrative roles entirely. A single synthesized entry (matching
   * `roles[0]`'s coaching/gameplay function) for a GENERATED_FICTIONAL
   * member, since they were only ever created to cover one such role.
   */
  hmRoles: HMStaffRole[];
  employmentType: StaffEmploymentType;
  profile: StaffAttributeProfile;
  source: "REAL_WORLD_IDENTITY" | "GENERATED_FICTIONAL";
}

/**
 * Part 22/HM-DATA-ALLSVENSKAN-1.1B Part 6: the employment-state
 * foundation, now actually wired to the Staff Budget (economy/staffCost.ts)
 * rather than a placeholder. `contractEndDate` follows the exact same
 * Swedish 1 June -> 31 May contract-year rule as player contracts
 * (economy/contractGeneration.ts) -- present ONLY for SALARIED members;
 * VOLUNTARY/GOVERNANCE members have no employment contract at all, so
 * the field stays undefined for them (never a fabricated date/wage).
 * Reserved for a future hiring/firing milestone otherwise -- never
 * mutated after career creation by this milestone itself.
 */
/**
 * HM-STAFF-CAREER-1.0: `wageEurPerMonth` moves staff wage from a
 * recompute-fresh-every-read derivation (estimateStaffMonthlyCostEur,
 * economy/staffCost.ts) to a real, persisted contract field -- the same
 * "generated once, then a sticky fact" precedent PlayerContract.wageEurPerMonth
 * already established. Present ONLY for SALARIED members (never
 * fabricated for a VOLUNTARY/GOVERNANCE person, same rule as
 * contractEndDate). `estimateStaffMonthlyCostEur` remains the ONE
 * formula that derives the INITIAL value (at career creation and for
 * any pre-this-milestone save migrated here) -- once set, this field is
 * canonical and only a real recruitment negotiation (staffRecruitment.ts)
 * ever changes it again.
 */
export interface StaffEmployment {
  staffId: string;
  clubId: string;
  roles: StaffRole[];
  employmentType: StaffEmploymentType;
  contractEndDate?: string;
  wageEurPerMonth?: number;
}
