// HM-ALPHA3-M02: the daily-tick step for club finances. Starts missing
// ledgers, closes ended months and turns the manager's own closes and
// status changes into inbox events. Runs first in processDay, so every
// later step that day (transfers, CPU recruitment) sees the closed books.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import type { CareerState } from "../career/types";
import { formatEur } from "./currency";
import { closeDueMonths, ensureClubFinances, overdraftLimitEur, sumLines } from "./ledger";
import { getClubEconomyBaseline } from "./clubEconomyIntegration";

const MONTH_NAME_SV = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];

export function monthLabelSv(month: string): string {
  return `${MONTH_NAME_SV[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

export function progressClubFinances(state: CareerState, date: string, emit: (event: CareerEvent) => void): CareerState {
  const isNewLedger = !state.clubFinances?.[state.playerClubId];
  let next = ensureClubFinances(state, date);
  if (isNewLedger && next.clubFinances?.[next.playerClubId]) {
    emit(buildClubEvent("CLUB_FINANCE", `budget:${next.seasonId}`, date, "IMPORTANT", `Styrelsen har fastställt budgeten för ${next.seasonId}`,
      "Klubbens bokföring är igång. Styrelsens budget för lönerna och transfermarknaden gäller nu, och du kan flytta pengar mellan dem inom ramarna.", [{ route: "FINANCE", tab: "budget" }]));
  }
  const outcome = closeDueMonths(next, date);
  next = outcome.state;

  for (const { clubId, statement } of outcome.closed) {
    if (clubId !== next.playerClubId) continue;
    const income = sumLines(statement.lines, "in") + statement.transactions.filter((t) => t.amountEur > 0).reduce((s, t) => s + t.amountEur, 0);
    const expenses = -(sumLines(statement.lines, "out") + statement.transactions.filter((t) => t.amountEur < 0).reduce((s, t) => s + t.amountEur, 0));
    const result = statement.closingCashEur - statement.openingCashEur;
    // Rule-generated EUR text; the inbox converts it to the display currency at render time.
    emit(buildClubEvent("CLUB_FINANCE", `month:${statement.month}`, date, "INFORMATION", `Månadsbokslut ${monthLabelSv(statement.month)}`,
      `Intäkter ${formatEur(income)}, kostnader ${formatEur(expenses)}. Månadens resultat ${formatEur(result)}; kassan är nu ${formatEur(statement.closingCashEur)}.`, [{ route: "FINANCE", tab: "ledger" }]));
  }
  for (const change of outcome.statusChanges) {
    if (change.clubId !== next.playerClubId) continue;
    const baseline = getClubEconomyBaseline(next, change.clubId)!;
    const limit = formatEur(overdraftLimitEur(baseline));
    const text =
      change.to === "CRISIS"
        ? { priority: "ACTION_REQUIRED" as const, subject: "Ekonomisk kris -- styrelsen fryser budgetarna", summary: `Kassan ligger under krediten på ${limit}. Inga nya löneåtaganden och ingen transferbudget förrän ekonomin är i balans. Sälj, låna ut eller sänk lönekostnaderna.` }
        : change.to === "OVERDRAFT"
          ? { priority: "IMPORTANT" as const, subject: "Klubben har övertrasserat kassan", summary: `Kassan är negativ men inom krediten på ${limit}. Transferbudgeten är stängd tills kassan är positiv igen.` }
          : { priority: "INFORMATION" as const, subject: "Kassan är positiv igen", summary: "Ekonomin är tillbaka i balans och styrelsens budgetar gäller som vanligt." };
    emit(buildClubEvent("CLUB_FINANCE", `status:${change.month}:${change.to}`, date, text.priority, text.subject, text.summary, [{ route: "FINANCE" }]));
  }
  return next;
}
