// HM-STAFF-1.0 Part 15/16/19: deterministic staff attribute + fictional-
// person generation. Reuses lib/rating/generation/deterministicVariation.ts's
// seeded-hash primitive (the one clearly provider-agnostic building block
// found in the ratings generation package, per audit) -- never
// Math.random, so identical (personId, role, clubId) inputs always
// reproduce identical output (Part 15/40).
import { seededOffset } from "../rating/generation/deterministicVariation";
import { STAFF_ATTRIBUTES, STAFF_ATTRIBUTE_MAX, STAFF_ATTRIBUTE_MIN, type StaffAttribute, type StaffAttributeProfile, type StaffAttributeValue, type StaffRole } from "./types";

/**
 * Part 16: each role's own baseline shape -- higher priors for the
 * attributes that role's own suitability weights actually use (Part 5),
 * neutral(ish) for everything else, so a GK coach's profile is visibly
 * GK-shaped rather than a uniform clone with a random label. Deliberately
 * NOT identical to ROLE_ATTRIBUTE_WEIGHTS' weights -- this is a
 * generation prior (what a plausible person in this role looks like
 * BEFORE seeded variation), not the suitability formula itself.
 */
const ROLE_BASELINE: Record<StaffRole, Partial<Record<StaffAttribute, number>>> = {
  HEAD_COACH: { TACTICAL_COACHING: 14, LEADERSHIP: 14, COMMUNICATION: 13, PLAYER_DEVELOPMENT: 12, ATTACKING_COACHING: 11, DEFENSIVE_COACHING: 11, MATCH_PREPARATION: 11 },
  ASSISTANT_COACH: { TECHNICAL_COACHING: 13, TACTICAL_COACHING: 12, PLAYER_DEVELOPMENT: 12, COMMUNICATION: 11 },
  GOALKEEPER_COACH: { GOALKEEPER_COACHING: 15, PLAYER_DEVELOPMENT: 11 },
  PHYSICAL_COACH: { PHYSICAL_COACHING: 15, PLAYER_DEVELOPMENT: 11 },
  ANALYST: { ANALYSIS: 14, MATCH_PREPARATION: 13 },
  PHYSIO: { MEDICAL: 15 },
  SCOUT: { PLAYER_JUDGEMENT: 13, POTENTIAL_JUDGEMENT: 13 },
  SPORTING_DIRECTOR: { RECRUITMENT: 14, NEGOTIATION: 13, SQUAD_PLANNING: 13, FINANCIAL_JUDGEMENT: 12, POTENTIAL_JUDGEMENT: 12, LEADERSHIP: 11 },
  TEAM_MANAGER: { ORGANISATION: 14, LOGISTICS: 13, COMMUNICATION: 12, TEAM_ENVIRONMENT: 12 },
  HEAD_OF_RECRUITMENT: { PLAYER_JUDGEMENT: 14, RECRUITMENT: 14, NETWORK: 13, POTENTIAL_JUDGEMENT: 13, NEGOTIATION: 11 },
  HEAD_OF_ACADEMY: { YOUTH_DEVELOPMENT: 15, POTENTIAL_JUDGEMENT: 13, ORGANISATION: 12, LEADERSHIP: 12, PLAYER_DEVELOPMENT: 12 },
  DEVELOPMENT_COACH: { PLAYER_DEVELOPMENT: 14, YOUTH_DEVELOPMENT: 14, TECHNICAL_COACHING: 12, COMMUNICATION: 11 },
};

const NEUTRAL_BASELINE = 10;
const VARIATION_MAGNITUDE = 3; // Part 16: enough spread that two same-role staff are never exact clones.

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Part 15/16: generates a COMPLETE StaffAttributeProfile (every canonical
 * attribute present, never partial) for one person, given their primary
 * roles and a stable seed key (typically `${personId}:${clubId}`).
 * Multi-role staff (rare, but StaffAssignment allows it) blend every
 * held role's baseline evenly.
 */
export function generateStaffAttributeProfile(personId: string, roles: readonly StaffRole[], seedKey: string): StaffAttributeProfile {
  const attributes = {} as Record<StaffAttribute, StaffAttributeValue>;
  for (const attr of STAFF_ATTRIBUTES) {
    const roleBaselines = roles.map((r) => ROLE_BASELINE[r]?.[attr] ?? NEUTRAL_BASELINE);
    const baseline = roleBaselines.length > 0 ? roleBaselines.reduce((a, b) => a + b, 0) / roleBaselines.length : NEUTRAL_BASELINE;
    const offset = seededOffset(`staff:${seedKey}:${attr}`, VARIATION_MAGNITUDE);
    attributes[attr] = { value: clamp(Math.round(baseline + offset), STAFF_ATTRIBUTE_MIN, STAFF_ATTRIBUTE_MAX), origin: "GENERATED_PRIOR" };
  }
  return { personId, attributes };
}

// ---------------------------------------------------------------------------
// Part 19: fictional name generation for generated staff -- a small,
// clearly-fictional pool (never a real person's name), combined
// deterministically so different clubs/roles get different combinations.
// ---------------------------------------------------------------------------

const GENERATED_FIRST_NAMES = ["Erik", "Lars", "Anders", "Karin", "Maria", "Johan", "Sara", "Peter", "Anna", "Mikael", "Emma", "Fredrik"];
const GENERATED_LAST_NAMES = ["Berg", "Lund", "Ström", "Holm", "Åberg", "Sjögren", "Nyström", "Falk", "Wiik", "Ekman", "Dahl", "Sund"];

export function generateFictionalStaffName(seedKey: string): string {
  const firstIdx = Math.abs(seededOffset(`staff-name-first:${seedKey}`, 1000)) % GENERATED_FIRST_NAMES.length;
  const lastIdx = Math.abs(seededOffset(`staff-name-last:${seedKey}`, 1000)) % GENERATED_LAST_NAMES.length;
  return `${GENERATED_FIRST_NAMES[firstIdx]} ${GENERATED_LAST_NAMES[lastIdx]}`;
}
