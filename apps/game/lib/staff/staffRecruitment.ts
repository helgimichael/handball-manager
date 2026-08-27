// HM-STAFF-CAREER-1.0 Part 4: the ONE manager-facing entry point for
// staff recruitment -- mirrors lib/transfers/transferIntegration.ts's
// submitTransferOffer exactly in shape (affordability -> candidate
// decision -> execution, resolved synchronously in one call, no
// multi-day negotiation), deliberately WITHOUT a persisted offer queue
// like TransferOffer -- staff hires are simpler (no selling-club veto,
// no transfer fee/window gating) and this milestone's own instruction
// is "avoid building an enormous transfer system for staff". The result
// is returned directly to the caller to show/discard; only a COMPLETED
// hire is ever persisted into CareerState (staffRoster/staffEmployment/
// staffClubHistory, via recruitStaffMember).
import type { CareerState } from "../career/types";
import { getClubBudgets, getClubFinancialHealth, getClubStaffCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { competitionTierForClub } from "../transfers/transferExecution";
import { evaluateStaffDecision } from "./staffDecision";
import { computeNewStaffContractEndDate, findStaffMember, recruitStaffMember } from "./staffCareerIntegration";

export interface StaffOfferParams {
  staffId: string;
  toClubId: string;
  offeredWageEurPerMonth: number;
  /** Length of the fresh contract offered, default 2 seasons. */
  contractYears?: number;
}

export type StaffOfferOutcome = "COMPLETED" | "REJECTED_BY_CANDIDATE" | "BLOCKED_UNAFFORDABLE" | "NOT_RECRUITABLE" | "NOT_FOUND";

export interface StaffOfferResult {
  outcome: StaffOfferOutcome;
  reason: string;
}

/**
 * Only a currently SALARIED staff member is a recruitable candidate
 * (HM-STAFF-CAREER-1.0 report requirement 5: "vilka roller som är/inte
 * är rekryteringsbara") -- a VOLUNTARY/GOVERNANCE person (Lagledare,
 * Materialansvarig, board/committee members, an unpaid Sportchef) has no
 * employment relationship or wage baseline to poach them from, and this
 * milestone does not model persuading a volunteer to leave their
 * unrelated real-world commitment. Recruiting the manager's OWN current
 * staff is meaningless and explicitly excluded too.
 */
export function isStaffRecruitable(state: CareerState, staffId: string): boolean {
  const member = findStaffMember(state, staffId);
  if (!member || member.clubId === state.playerClubId) return false;
  return state.staffEmployment[staffId]?.employmentType === "SALARIED";
}

/**
 * Resolves the whole negotiation synchronously: affordability (the
 * BUYING club's own Staff Budget, Economy 1.0's existing derivation,
 * never a parallel economy) -> the candidate's own decision (wage delta,
 * competition-tier change, their current club's financial pressure) ->
 * execution (recruitStaffMember). Every terminal StaffOfferOutcome
 * carries a human-readable reason, mirroring submitTransferOffer's own
 * "the UI can show exactly why an offer failed" precedent.
 */
export function offerStaffContract(state: CareerState, params: StaffOfferParams): { state: CareerState; result: StaffOfferResult } {
  const { staffId, toClubId, offeredWageEurPerMonth } = params;

  const member = findStaffMember(state, staffId);
  if (!member) {
    return { state, result: { outcome: "NOT_FOUND", reason: "Personen kunde inte hittas." } };
  }
  const fromClubId = member.clubId;
  if (fromClubId === toClubId) {
    return { state, result: { outcome: "NOT_RECRUITABLE", reason: "Personen arbetar redan för klubben." } };
  }
  if (!isStaffRecruitable(state, staffId)) {
    return { state, result: { outcome: "NOT_RECRUITABLE", reason: "Personen har ingen avlönad anställning att värva från (frivillig eller styrelseliknande roll)." } };
  }

  const budgets = getClubBudgets(state, toClubId);
  if (!budgets) {
    return { state, result: { outcome: "BLOCKED_UNAFFORDABLE", reason: "Ingen ekonomidata finns för klubben." } };
  }
  const projectedAnnualStaffCosts = getClubStaffCostsEurAnnual(state, toClubId) + offeredWageEurPerMonth * 12;
  if (projectedAnnualStaffCosts > budgets.staffBudgetEur) {
    return {
      state,
      result: {
        outcome: "BLOCKED_UNAFFORDABLE",
        reason: `Ny total personalkostnad (${Math.round(projectedAnnualStaffCosts)} €/år) skulle överstiga personalbudgeten (${Math.round(budgets.staffBudgetEur)} €/år).`,
      },
    };
  }

  const currentEmployment = state.staffEmployment[staffId];
  const decision = evaluateStaffDecision({
    staffId,
    currentWageEurPerMonth: currentEmployment?.wageEurPerMonth ?? 0,
    offeredWageEurPerMonth,
    currentClubTier: competitionTierForClub(fromClubId),
    newClubTier: competitionTierForClub(toClubId),
    currentClubPressure: getClubFinancialHealth(state, fromClubId)?.pressure ?? "NONE",
  });
  if (!decision.accept) {
    return { state, result: { outcome: "REJECTED_BY_CANDIDATE", reason: decision.reason } };
  }

  const contractEndDate = computeNewStaffContractEndDate(staffId, state.gameDate, params.contractYears ?? 2);
  const next = recruitStaffMember(state, staffId, fromClubId, toClubId, offeredWageEurPerMonth, contractEndDate);
  return { state: next, result: { outcome: "COMPLETED", reason: decision.reason } };
}
