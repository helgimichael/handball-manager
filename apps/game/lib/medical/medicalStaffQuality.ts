// HM-INJURIES-1.0 Part 20/21: activates the previously-inert PHYSIO
// role / MEDICAL attribute (lib/staff/types.ts confirms both existed
// but had "no gameplay effect yet" before this milestone). Mirrors
// lib/staff/roleSuitability.ts's own computeStaffTrainingQuality shape
// exactly (same [0.75, 1.25] bounded range, same neutral-when-no-staff
// fallback) -- a second, parallel quality multiplier for a different
// domain (rehab speed), never a modification of coaching quality itself.
import type { ResolvedStaffMember } from "../staff/types";
import { STAFF_ATTRIBUTE_MAX, STAFF_ATTRIBUTE_MIN } from "../staff/types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const QUALITY_MIN = 0.75;
const QUALITY_MAX = 1.25;
const QUALITY_NEUTRAL = 1.0;
const NEUTRAL_ATTRIBUTE = (STAFF_ATTRIBUTE_MIN + STAFF_ATTRIBUTE_MAX) / 2;

function attributeAverageToMultiplier(avg1to20: number): number {
  const t = (avg1to20 - STAFF_ATTRIBUTE_MIN) / (STAFF_ATTRIBUTE_MAX - STAFF_ATTRIBUTE_MIN);
  return clamp(QUALITY_MIN + t * (QUALITY_MAX - QUALITY_MIN), QUALITY_MIN, QUALITY_MAX);
}

/** The club's own best PHYSIO (by MEDICAL attribute), or null if the roster has none. */
export function findBestPhysio(roster: readonly ResolvedStaffMember[]): ResolvedStaffMember | null {
  const physios = roster.filter((m) => m.roles.includes("PHYSIO"));
  if (physios.length === 0) return null;
  return [...physios].sort((a, b) => (b.profile.attributes.MEDICAL?.value ?? NEUTRAL_ATTRIBUTE) - (a.profile.attributes.MEDICAL?.value ?? NEUTRAL_ATTRIBUTE) || a.id.localeCompare(b.id))[0];
}

/**
 * Part 21: rehab-speed quality multiplier -- MEDICAL attribute of the
 * club's own best PHYSIO, bounded [0.75, 1.25] (Part 20: "elite physio
 * should not halve every injury duration absurdly"). Neutral (1.0) when
 * the club has no PHYSIO at all -- never zero/undefined (same "no
 * eligible staff -> neutral, never a penalty" precedent as
 * computeStaffTrainingQuality).
 */
export function computeMedicalRehabQuality(roster: readonly ResolvedStaffMember[]): number {
  const physio = findBestPhysio(roster);
  if (!physio) return QUALITY_NEUTRAL;
  const medical = physio.profile.attributes.MEDICAL?.value ?? NEUTRAL_ATTRIBUTE;
  return attributeAverageToMultiplier(medical);
}
