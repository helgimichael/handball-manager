// HM-STAFF-1.0 Part 6/9/10/17: role suitability, training-quality
// multiplier, and deterministic fallback coach resolution. Pure
// functions only -- no CareerState reads/writes here (staffTraining.ts
// is the integration layer that calls these against real rosters).
import type { TrainingSessionType } from "../training/types";
import { ROLE_ATTRIBUTE_WEIGHTS, SESSION_ELIGIBLE_ROLES, SESSION_QUALITY_ATTRIBUTES } from "./roleAttributeMap";
import { STAFF_ATTRIBUTE_MAX, STAFF_ATTRIBUTE_MIN, type ResolvedStaffMember, type StaffRole } from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Part 17: a role-specific suitability score (1-20 scale, same as the underlying attributes) -- weighted average of that role's relevant attributes. 10.5 (neutral midpoint) if the role has no weighted attributes defined. */
export function computeRoleSuitability(member: Pick<ResolvedStaffMember, "profile">, role: StaffRole): number {
  const weights = ROLE_ATTRIBUTE_WEIGHTS[role];
  const entries = Object.entries(weights) as [keyof typeof weights, number][];
  if (entries.length === 0) return (STAFF_ATTRIBUTE_MIN + STAFF_ATTRIBUTE_MAX) / 2;
  let sum = 0;
  let totalWeight = 0;
  for (const [attr, weight] of entries) {
    const attrValue = member.profile.attributes[attr as keyof typeof member.profile.attributes];
    if (!attrValue || weight === undefined) continue;
    sum += attrValue.value * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? sum / totalWeight : (STAFF_ATTRIBUTE_MIN + STAFF_ATTRIBUTE_MAX) / 2;
}

/** Part 8: eligible staff (this session's own eligible-role list, Part 7) from a club's resolved roster, sorted deterministically for stable fallback tie-breaking (by id). */
export function eligibleStaffForSession(roster: readonly ResolvedStaffMember[], sessionType: TrainingSessionType): ResolvedStaffMember[] {
  const eligibleRoles = new Set(SESSION_ELIGIBLE_ROLES[sessionType]);
  if (eligibleRoles.size === 0) return [];
  return roster.filter((m) => m.roles.some((r) => eligibleRoles.has(r))).sort((a, b) => a.id.localeCompare(b.id));
}

/** Average of a session's own quality-relevant attributes (Part 7) for one staff member -- 10.5 (neutral) if the session has no quality-relevant attributes (RECOVERY) or the member lacks all of them. */
function sessionAttributeAverage(member: ResolvedStaffMember, sessionType: TrainingSessionType): number {
  const attrs = SESSION_QUALITY_ATTRIBUTES[sessionType];
  if (attrs.length === 0) return (STAFF_ATTRIBUTE_MIN + STAFF_ATTRIBUTE_MAX) / 2;
  let sum = 0;
  let count = 0;
  for (const attr of attrs) {
    const entry = member.profile.attributes[attr];
    if (entry) {
      sum += entry.value;
      count += 1;
    }
  }
  return count > 0 ? sum / count : (STAFF_ATTRIBUTE_MIN + STAFF_ATTRIBUTE_MAX) / 2;
}

/**
 * Part 9: deterministic fallback -- the assigned coach if they exist AND
 * are eligible for this session type (Part 8: an ineligible manual
 * assignment, e.g. a stale id after a roster change, is never honored
 * silently); otherwise the single BEST eligible staff member by this
 * session's own quality-relevant attribute average (ties broken by id).
 * `null` only when the roster has literally no eligible staff at all
 * (e.g. a session type with no eligible roles, or a club missing that
 * specialism entirely) -- callers must treat `null` as "use the neutral
 * quality multiplier", never as an error (Part 9: "do not leave training
 * with zero quality simply because assignment is null").
 */
export function resolveResponsibleCoach(roster: readonly ResolvedStaffMember[], sessionType: TrainingSessionType, assignedCoachId: string | null): ResolvedStaffMember | null {
  const eligible = eligibleStaffForSession(roster, sessionType);
  if (eligible.length === 0) return null;

  if (assignedCoachId) {
    const assigned = eligible.find((m) => m.id === assignedCoachId);
    if (assigned) return assigned;
  }

  let best = eligible[0];
  let bestScore = sessionAttributeAverage(best, sessionType);
  for (const candidate of eligible.slice(1)) {
    const score = sessionAttributeAverage(candidate, sessionType);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Part 6/10: the training-quality multiplier itself.
// ---------------------------------------------------------------------------

const QUALITY_MIN = 0.75;
const QUALITY_MAX = 1.25;
const QUALITY_NEUTRAL = 1.0;

/** Rescales a 1-20 attribute average onto the [QUALITY_MIN, QUALITY_MAX] multiplier range -- the 10.5 midpoint maps to exactly QUALITY_NEUTRAL. */
function attributeAverageToMultiplier(avg1to20: number): number {
  const t = (avg1to20 - STAFF_ATTRIBUTE_MIN) / (STAFF_ATTRIBUTE_MAX - STAFF_ATTRIBUTE_MIN);
  return clamp(QUALITY_MIN + t * (QUALITY_MAX - QUALITY_MIN), QUALITY_MIN, QUALITY_MAX);
}

/** Part 10: the head coach's own small umbrella contribution -- LEADERSHIP only (never the specialist's own domain, so it can never itself create "elite goalkeeper development from a great Head Coach + poor GK coaching"). Zero weight when the resolved specialist coach IS the head coach already (Part 10: avoid double-counting the same person's own influence). */
const HEAD_COACH_UMBRELLA_WEIGHT = 0.15;

/**
 * Part 6/10/12: the central pure helper. `resolvedCoach` is whichever
 * staff member resolveResponsibleCoach picked (or null); `headCoach` is
 * the club's own head coach (may be the same person as `resolvedCoach`,
 * or null if the club has none). Bounded to [0.75, 1.25] -- neutral 1.0
 * competent coaching, never a doubling regardless of how elite the staff
 * is (Part 6/12).
 */
export function computeStaffTrainingQuality(sessionType: TrainingSessionType, resolvedCoach: ResolvedStaffMember | null, headCoach: ResolvedStaffMember | null): number {
  if (SESSION_QUALITY_ATTRIBUTES[sessionType].length === 0) return QUALITY_NEUTRAL; // RECOVERY: no coaching-quality effect at all (Part 7/30).
  if (!resolvedCoach) return QUALITY_NEUTRAL; // Part 9: no eligible staff at all -- neutral, never zero/undefined.

  const specialistAvg = sessionAttributeAverage(resolvedCoach, sessionType);
  const isHeadCoachAlreadyResolved = headCoach !== null && headCoach.id === resolvedCoach.id;
  if (!headCoach || isHeadCoachAlreadyResolved) {
    return attributeAverageToMultiplier(specialistAvg);
  }

  const headCoachLeadership = headCoach.profile.attributes.LEADERSHIP?.value ?? (STAFF_ATTRIBUTE_MIN + STAFF_ATTRIBUTE_MAX) / 2;
  const blendedAvg = specialistAvg * (1 - HEAD_COACH_UMBRELLA_WEIGHT) + headCoachLeadership * HEAD_COACH_UMBRELLA_WEIGHT;
  return attributeAverageToMultiplier(blendedAvg);
}

/** Part 23: a coarse, UI-facing label for a quality multiplier -- the raw number is never shown to the manager directly. */
export type StaffQualityLabel = "LÅG" | "NORMAL" | "BRA" | "UTMÄRKT";

export function staffQualityLabel(multiplier: number): StaffQualityLabel {
  if (multiplier >= 1.15) return "UTMÄRKT";
  if (multiplier >= 1.05) return "BRA";
  if (multiplier >= 0.9) return "NORMAL";
  return "LÅG";
}

/** The club's own head coach, if the roster has one (first by id for determinism if somehow more than one holds the role). */
export function findHeadCoach(roster: readonly ResolvedStaffMember[]): ResolvedStaffMember | null {
  const headCoaches = roster.filter((m) => m.roles.includes("HEAD_COACH")).sort((a, b) => a.id.localeCompare(b.id));
  return headCoaches[0] ?? null;
}
