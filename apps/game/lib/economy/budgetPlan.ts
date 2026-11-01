// HM-ALPHA3-M02: the manager's decision on the board's season budget --
// move money between the wage budget and the transfer budget (1:1), within
// the board's limits (clampBudgetShift). One plan per season; a new season
// starts from the board's own split again.
import type { CareerState } from "../career/types";
import { clampBudgetShift, getClubBudgets } from "./clubEconomyIntegration";

/** The board's budget before the manager's adjustment (the plan removed). */
export function boardBudgets(state: CareerState, clubId: string) {
  const { [clubId]: _ignored, ...rest } = state.budgetPlans ?? {};
  return getClubBudgets({ ...state, budgetPlans: rest }, clubId);
}

export function setBudgetPlan(state: CareerState, wageToTransferEur: number, date: string = state.gameDate): CareerState {
  const board = boardBudgets(state, state.playerClubId);
  if (!board) throw new Error("Klubben saknar ekonomi och kan inte planera budgeten.");
  if (state.clubFinances?.[state.playerClubId]?.status === "CRISIS") throw new Error("Styrelsen har fryst budgetarna under krisen. Ingen omfördelning tillåts förrän kassan är i balans.");
  const shift = clampBudgetShift(Math.round(wageToTransferEur), board.wageBudgetEur, board.transferBudgetEur);
  return { ...state, budgetPlans: { ...state.budgetPlans, [state.playerClubId]: { seasonId: state.seasonId, wageToTransferEur: shift, approvedOn: date } } };
}
