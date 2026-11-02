// HM-ALPHA3 economy release blocker: per-club snapshot of the inputs that
// drive board budgets and affordability -- for before/after comparison.
// Usage: npx tsx scripts/qa-economy-budget-probe.ts <out.json> [save.json]
//   without a save: a fresh career (Skövde) with every club's ledger activated.
import fs from "node:fs";
import { createNewCareerState } from "../lib/career/newCareer";
import { snapshotGameplayRatings, snapshotWorldSquads } from "../lib/gameWorld/serverSnapshot";
import type { CareerState } from "../lib/career/types";
import { getClubBudgets, getClubEconomyBaseline, getClubFinancialHealth, getClubPlayerWageCostsEurAnnual, getClubStaffCostsEurAnnual } from "../lib/economy/clubEconomyIntegration";
import { ensureClubFinances, projectClubFinances, recurringRevenueEurAnnual } from "../lib/economy/ledger";

const [out, savePath] = process.argv.slice(2);
let state: CareerState;
if (savePath) {
  state = JSON.parse(fs.readFileSync(savePath, "utf8")).careerState;
} else {
  const squads = { ...snapshotWorldSquads("se_handbollsligan_herr"), ...snapshotWorldSquads("swe-2") };
  const ratings = { ...snapshotGameplayRatings("se_handbollsligan_herr"), ...snapshotGameplayRatings("swe-2") };
  state = ensureClubFinances(createNewCareerState("budget-probe", "se_club_ifk_skovde_hk", squads, undefined, ratings), "2026-08-19");
}

const MIN_SIGNING_WAGE_EUR_ANNUAL = 500 * 12; // room for at least a minimal contract
const rows = Object.keys(state.clubEconomies).sort().flatMap((clubId) => {
  const baseline = getClubEconomyBaseline(state, clubId);
  const budgets = getClubBudgets(state, clubId);
  const health = getClubFinancialHealth(state, clubId);
  if (!baseline || !budgets || !health) return [];
  const wages = getClubPlayerWageCostsEurAnnual(state, clubId);
  const staff = getClubStaffCostsEurAnnual(state, clubId);
  const finance = state.clubFinances?.[clubId];
  const projection = projectClubFinances(state, clubId);
  return [{
    clubId,
    revenue: Math.round(recurringRevenueEurAnnual(baseline)),
    bridge: finance?.bridgeEurAnnual ?? null,
    wages: Math.round(wages),
    staff: Math.round(staff),
    ops: Math.round(baseline.operatingCostsBaselineEur),
    cash: Math.round(baseline.cashEur),
    projectedSeasonEndCash: projection.at(-1)?.closingCashEur ?? null,
    status: finance?.status ?? null,
    pressure: health.pressure,
    structural: health.structuralHealth,
    liquidity: health.liquidityHealth,
    wageBudget: budgets.wageBudgetEur,
    staffBudget: budgets.staffBudgetEur,
    transferBudget: budgets.transferBudgetEur,
    wageRoom: Math.round(budgets.wageBudgetEur - wages),
    unableToRecruit: budgets.wageBudgetEur - wages < MIN_SIGNING_WAGE_EUR_ANNUAL,
  }];
});
const summary = {
  date: state.gameDate,
  clubs: rows.length,
  overWageBudget: rows.filter((r) => r.wages > r.wageBudget).length,
  unableToRecruit: rows.filter((r) => r.unableToRecruit).map((r) => r.clubId),
  pressure: rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.pressure]: (a[r.pressure] ?? 0) + 1 }), {}),
  status: rows.reduce<Record<string, number>>((a, r) => ({ ...a, [String(r.status)]: (a[String(r.status)] ?? 0) + 1 }), {}),
  totalWages: rows.reduce((s, r) => s + r.wages, 0),
  totalWageBudget: rows.reduce((s, r) => s + r.wageBudget, 0),
};
fs.writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
console.log(JSON.stringify(summary));
