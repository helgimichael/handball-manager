// HM-TRANSFERS-1.0: transfer affordability, built entirely on Economy
// 1.0's own existing budget derivation (Part: "Återanvänd Economy 1.0
// affordability-principer") -- no parallel economy concept, no new
// generation formula. A club cannot buy just because the fee fits in
// cash: transferFeeEur + trainingCompensationEur is checked against the
// derived TRANSFER budget (liquidity-based, never cash directly), and
// the resulting wage commitment is checked against the derived WAGE
// budget -- both real Economy 1.0 outputs, unmodified.
import type { CareerState } from "../career/types";
import { getClubBudgets, getClubPlayerWageCostsEurAnnual } from "../economy/clubEconomyIntegration";

export interface TransferAffordabilityResult {
  affordable: boolean;
  reasons: string[];
}

/**
 * `wageShareBorrowingPct` should be 100 for a PERMANENT deal (the buyer
 * carries the full new wage) or the loan's own borrowing share for a
 * LOAN (the borrowing club only carries that share -- see
 * transferExecution.ts's own wage-share doc).
 */
export function assessTransferAffordability(state: CareerState, buyingClubId: string, transferFeeEur: number, trainingCompensationEur: number, newWageEurPerMonth: number, wageShareBorrowingPct: number = 100): TransferAffordabilityResult {
  const budgets = getClubBudgets(state, buyingClubId);
  if (!budgets) return { affordable: false, reasons: ["Ingen ekonomidata finns för klubben."] };

  const reasons: string[] = [];

  const totalAcquisitionCostEur = transferFeeEur + trainingCompensationEur;
  if (totalAcquisitionCostEur > budgets.transferBudgetEur) {
    reasons.push(`Total övergångskostnad (${Math.round(totalAcquisitionCostEur)} €) överstiger transferbudgeten (${Math.round(budgets.transferBudgetEur)} €).`);
  }

  const borrowingShareWageEurPerMonth = newWageEurPerMonth * (wageShareBorrowingPct / 100);
  const projectedAnnualWageCosts = getClubPlayerWageCostsEurAnnual(state, buyingClubId) + borrowingShareWageEurPerMonth * 12;
  if (projectedAnnualWageCosts > budgets.wageBudgetEur) {
    reasons.push(`Ny total lönekostnad (${Math.round(projectedAnnualWageCosts)} €/år) skulle överstiga lönebudgeten (${Math.round(budgets.wageBudgetEur)} €/år).`);
  }

  return { affordable: reasons.length === 0, reasons };
}
