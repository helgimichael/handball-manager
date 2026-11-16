// Arena Nights -- SQD-02n "Offer with consequence preview". Pure, read-only. Uses ONLY existing calculations:
// the club's wage budget (getClubBudgets), today's player wage costs (getClubPlayerWageCostsEurAnnual), the
// renewal affordability rule (assessRenewalAffordability -- the same check submitRenewalOffer runs), and the
// stored demand + demand factors of the open talk. Nothing here changes or predicts the player's answer.
import type { CareerState } from "../career/types";
import { getClubBudgets, getClubPlayerWageCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { assessRenewalAffordability } from "../transfers/affordability";
import { openTalkFor } from "./renewals";

export interface RenewalPreview {
  currentWageEurPerMonth: number;
  offerWageEurPerMonth: number;
  /** (offer - current) * 12. */
  annualDeltaEur: number;
  /** Today's annual player wage costs for the club. */
  payrollAnnualEur: number;
  payrollAfterAnnualEur: number;
  /** Annual wage budget, null when the club has no economy data. */
  wageBudgetEur: number | null;
  /** Budget room left after this offer (budget - payroll after), null without a budget. */
  roomAfterEur: number | null;
  /** The renewal affordability rule's verdict and reasons (only checked for a raise, like submitRenewalOffer). */
  affordable: boolean;
  reasons: string[];
  /** Demand context from the open talk, null when no talk is open. */
  demand: { demandEurPerMonth: number; gapEurPerMonth: number; offerPctOfDemand: number; factors: { label: string; effectPct: number }[] } | null;
  /** Bar geometry, all in % of a shared scale. */
  bar: { payrollPct: number; deltaPct: number; budgetPct: number | null };
}

export function renewalPreview(state: CareerState, playerId: string, offerWageEurPerMonth: number): RenewalPreview | null {
  const contract = state.playerContracts[playerId];
  if (!contract || contract.clubId !== state.playerClubId) return null;
  const clubId = state.playerClubId;
  const current = contract.wageEurPerMonth;
  const offer = Math.max(0, Math.round(offerWageEurPerMonth));
  const annualDeltaEur = (offer - current) * 12;
  const payrollAnnualEur = Math.round(getClubPlayerWageCostsEurAnnual(state, clubId));
  const payrollAfterAnnualEur = payrollAnnualEur + annualDeltaEur;
  const budget = getClubBudgets(state, clubId);
  const wageBudgetEur = budget ? budget.wageBudgetEur : null;
  const verdict = offer > current ? assessRenewalAffordability(state, clubId, playerId, offer) : { affordable: true, reasons: [] as string[] };
  const talk = openTalkFor(state, playerId);
  const demand = talk ? {
    demandEurPerMonth: talk.demandEurPerMonth,
    gapEurPerMonth: offer - talk.demandEurPerMonth,
    offerPctOfDemand: talk.demandEurPerMonth > 0 ? Math.round((offer / talk.demandEurPerMonth) * 100) : 100,
    factors: talk.demandFactors.map((f) => ({ label: f.label, effectPct: f.effectPct })),
  } : null;
  const scale = Math.max(1, wageBudgetEur ?? 0, payrollAfterAnnualEur, payrollAnnualEur) * 1.08;
  const pct = (n: number) => Math.round((Math.max(0, n) / scale) * 1000) / 10;
  return {
    currentWageEurPerMonth: current,
    offerWageEurPerMonth: offer,
    annualDeltaEur,
    payrollAnnualEur,
    payrollAfterAnnualEur,
    wageBudgetEur,
    roomAfterEur: wageBudgetEur == null ? null : wageBudgetEur - payrollAfterAnnualEur,
    affordable: verdict.affordable,
    reasons: verdict.reasons,
    demand,
    bar: { payrollPct: pct(Math.min(payrollAnnualEur, payrollAfterAnnualEur)), deltaPct: pct(Math.abs(annualDeltaEur)), budgetPct: wageBudgetEur == null ? null : pct(wageBudgetEur) },
  };
}
