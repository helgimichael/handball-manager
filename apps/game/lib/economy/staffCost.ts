// HM-ECONOMY-1.0: staff costs. StaffEmployment.contract is explicitly
// documented as "a placeholder shape only, never wired to any economy
// system" (lib/staff/types.ts) -- no staff member has ever had a salary
// field. This module is the first thing to give staff a real economic
// cost, WITHOUT persisting a new sticky wage field on every staff
// member: the monthly cost is deterministically DERIVED from the
// member's own role(s) and their club's economic band, the same
// "recompute fresh every read, never store" precedent
// computePlayerMarketValueEur established for player market value.
import { seededOffset } from "../rating/generation/deterministicVariation";
import type { EconomicBand } from "./clubEconomyTypes";
import type { ResolvedStaffMember, StaffRole } from "../staff/types";

/** Section 6 PlayerCosts/StaffCosts framing -- HEAD_COACH costs the most, specialist/support roles less, a role-count multiplier reflects a multi-role person (e.g. Assistant+Analyst) costing modestly more than a single-role specialist. */
const ROLE_BASE_MONTHLY_EUR: Record<StaffRole, number> = {
  HEAD_COACH: 3_000,
  ASSISTANT_COACH: 1_600,
  GOALKEEPER_COACH: 1_400,
  PHYSICAL_COACH: 1_400,
  ANALYST: 1_200,
  PHYSIO: 1_300,
  SCOUT: 1_000,
  // HM-STAFF-CAREER-1.0: only ever priced if a real recruitment
  // negotiation (staffRecruitment.ts) explicitly makes one of these two
  // SALARIED -- classifyEmploymentType never does so by default
  // (staffRosterResolution.ts's own ADMINISTRATIVE_STAFF_ROLES note).
  SPORTING_DIRECTOR: 2_400,
  TEAM_MANAGER: 900,
};

const BAND_COST_MULTIPLIER: Record<EconomicBand, number> = {
  E1: 3.0,
  E2: 2.2,
  E3: 1.6,
  E4: 1.2,
  E5: 0.9,
  E6: 0.65,
  E7: 0.45,
};

/**
 * Deterministic monthly cost for one staff member, given their club's
 * own generated economic band. A multi-role member (e.g. HEAD_COACH +
 * ANALYST) is costed on their highest-value role plus a modest 25% per
 * additional role, never a bare sum of every role's own full base rate
 * (Part: "Håll modellen begriplig" -- avoids an implausible stack).
 *
 * HM-DATA-ALLSVENSKAN-1.1B Part 6: zero cost for anyone who isn't
 * SALARIED -- a VOLUNTARY administrative title or a GOVERNANCE/board
 * role is never charged against the Staff Budget (they have no
 * employment contract at all), never merely a side-effect of `roles`
 * happening to be empty.
 */
export function estimateStaffMonthlyCostEur(member: Pick<ResolvedStaffMember, "id" | "roles" | "employmentType">, band: EconomicBand): number {
  if (member.employmentType !== "SALARIED" || member.roles.length === 0) return 0;
  const sortedBaseRates = [...member.roles].map((r) => ROLE_BASE_MONTHLY_EUR[r]).sort((a, b) => b - a);
  const primary = sortedBaseRates[0];
  const additional = sortedBaseRates.slice(1).reduce((sum, rate) => sum + rate * 0.25, 0);
  const variance = 1 + seededOffset(`${member.id}:economy:staffCostVariance`, 15) / 100; // +/- 15% per-person seeded variance, deterministic.
  const raw = (primary + additional) * BAND_COST_MULTIPLIER[band] * variance;
  return Math.max(200, Math.round(raw / 50) * 50);
}
