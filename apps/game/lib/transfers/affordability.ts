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
import type { ClubBudgets } from "../economy/clubEconomyTypes";

export interface TransferAffordabilityResult {
  affordable: boolean;
  reasons: string[];
}

/**
 * HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0 performance fix: `budgets`
 * and `currentWageCostsEurAnnual` depend ONLY on `state` + `buyingClubId`
 * -- never on the candidate/fee/wage being assessed. A caller evaluating
 * many candidates for the SAME buying club against the SAME state (e.g.
 * cpuCandidateEvaluation.ts's own `rankCandidates`, which can call this
 * hundreds of times per invocation) may compute both ONCE and pass them
 * here to skip the two redundant O(total-contracts) rescans this
 * function would otherwise repeat for every single candidate. Omitting
 * this is byte-identical to before -- every existing caller keeps
 * calling `getClubBudgets`/`getClubPlayerWageCostsEurAnnual` internally,
 * unchanged. This must never become a second source of truth: it is
 * ONLY ever a same-invocation memoization of the exact same values this
 * function would otherwise derive itself, never a distinct/adjusted view.
 */
export interface PrecomputedBuyerAffordabilityInputs {
  budgets: ClubBudgets;
  currentWageCostsEurAnnual: number;
}

/**
 * `wageShareBorrowingPct` should be 100 for a PERMANENT deal (the buyer
 * carries the full new wage) or the loan's own borrowing share for a
 * LOAN (the borrowing club only carries that share -- see
 * transferExecution.ts's own wage-share doc).
 */
export function assessTransferAffordability(
  state: CareerState,
  buyingClubId: string,
  transferFeeEur: number,
  trainingCompensationEur: number,
  newWageEurPerMonth: number,
  wageShareBorrowingPct: number = 100,
  precomputed?: PrecomputedBuyerAffordabilityInputs,
): TransferAffordabilityResult {
  const budgets = precomputed?.budgets ?? getClubBudgets(state, buyingClubId);
  if (!budgets) return { affordable: false, reasons: ["Ingen ekonomidata finns för klubben."] };

  const reasons: string[] = [];

  const totalAcquisitionCostEur = transferFeeEur + trainingCompensationEur;
  if (totalAcquisitionCostEur > budgets.transferBudgetEur) {
    reasons.push(`Total övergångskostnad (${Math.round(totalAcquisitionCostEur)} €) överstiger transferbudgeten (${Math.round(budgets.transferBudgetEur)} €).`);
  }

  const borrowingShareWageEurPerMonth = newWageEurPerMonth * (wageShareBorrowingPct / 100);
  const currentWageCostsEurAnnual = precomputed?.currentWageCostsEurAnnual ?? getClubPlayerWageCostsEurAnnual(state, buyingClubId);
  const projectedAnnualWageCosts = currentWageCostsEurAnnual + borrowingShareWageEurPerMonth * 12;
  if (projectedAnnualWageCosts > budgets.wageBudgetEur) {
    reasons.push(`Ny total lönekostnad (${Math.round(projectedAnnualWageCosts)} €/år) skulle överstiga lönebudgeten (${Math.round(budgets.wageBudgetEur)} €/år).`);
  }

  return { affordable: reasons.length === 0, reasons };
}

/**
 * HM-ALPHA3-M10: a renewal is weighed against NEXT season's wage commitments --
 * the contracts that run past this player's current end date, plus his new
 * wage. Weighing it against the whole current wage bill counted every other
 * contract expiring the same summer, so in a year when much of a squad was
 * out of contract no renewal could ever fit and the whole group left.
 */
export function assessRenewalAffordability(state: CareerState, clubId: string, playerId: string, newWageEurPerMonth: number): TransferAffordabilityResult {
  const budgets = getClubBudgets(state, clubId);
  if (!budgets) return { affordable: false, reasons: ["Ingen ekonomidata finns för klubben."] };
  const from = state.playerContracts[playerId]?.contractEndDate ?? state.gameDate;
  let committed = 0;
  for (const c of Object.values(state.playerContracts)) if (c.clubId === clubId && c.playerId !== playerId && c.contractEndDate > from) committed += c.wageEurPerMonth * 12;
  const projected = committed + newWageEurPerMonth * 12;
  if (projected > budgets.wageBudgetEur) return { affordable: false, reasons: [`Lönekostnaden nästa säsong (${Math.round(projected)} €/år) skulle överstiga lönebudgeten (${Math.round(budgets.wageBudgetEur)} €/år).`] };
  return { affordable: true, reasons: [] };
}
