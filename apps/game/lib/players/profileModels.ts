// Arena Nights -- pure read models for the player profile chapters:
//   SQD-02p rehab timeline, SQD-02e deal-sheet budget bar, SQD-02f career ribbon, SQD-02b match chart.
// Everything is read from stored career state through existing helpers; no rule is recomputed.
import type { CareerState } from "../career/types";
import type { RehabPhase } from "../medical/types";
import { getClub } from "../game-data";
import { getClubBudgets, getClubPlayerWageCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { getPlayerTrainingCompensation } from "../economy/trainingCompensationIntegration";
import type { DossierMatch } from "./playerDossier";

const DAY_MS = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);

// ---------------------------------------------------------------- SQD-02p rehab timeline
export const REHAB_PHASES: readonly RehabPhase[] = ["ACUTE", "REHAB", "RETURN_TO_TRAINING", "RETURN_TO_PLAY"];
export interface RehabTimeline {
  active: null | {
    phaseIndex: number; progressPct: number; occurredDate: string; returnDate: string; daysToReturn: number;
    /** Own-club fixtures from today until a little past the expected return, flagged when they fall before it. */
    fixtures: { id: string; date: string; opponent: string; missed: boolean; pct: number }[];
    missedCount: number;
    returnPct: number;
  };
  history: { id: string; occurredDate: string; returnDate: string; daysOut: number; type: string; severity: string }[];
}

export function rehabTimeline(state: CareerState, playerId: string): RehabTimeline {
  const s = state.playerInjuries[playerId];
  const history = [...(s?.injuryHistory ?? [])].sort((a, b) => b.occurredDate.localeCompare(a.occurredDate)).slice(0, 6)
    .map((h) => ({ id: h.injuryId, occurredDate: h.occurredDate, returnDate: h.returnDate, daysOut: Math.max(0, days(h.occurredDate, h.returnDate)), type: h.injuryType, severity: h.severity }));
  const inj = s?.activeInjury;
  if (!inj) return { active: null, history };
  const today = state.gameDate;
  const daysToReturn = Math.max(0, days(today, inj.expectedReturnDate));
  const horizon = Math.max(daysToReturn + 10, 14);
  const ours = state.fixtures
    .filter((f) => (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId) && f.date >= today && !state.results[f.id] && days(today, f.date) <= horizon)
    .sort((a, b) => a.date.localeCompare(b.date));
  const fixtures = ours.map((f) => {
    const opp = f.homeClubId === state.playerClubId ? f.awayClubId : f.homeClubId;
    return { id: f.id, date: f.date, opponent: getClub(opp)?.shortName ?? opp, missed: f.date < inj.expectedReturnDate, pct: Math.round((days(today, f.date) / horizon) * 1000) / 10 };
  });
  return {
    active: {
      phaseIndex: Math.max(0, REHAB_PHASES.indexOf(inj.currentPhase)),
      progressPct: Math.round(Math.max(0, Math.min(1, inj.rehabProgress)) * 100),
      occurredDate: inj.occurredDate, returnDate: inj.expectedReturnDate, daysToReturn,
      fixtures, missedCount: fixtures.filter((f) => f.missed).length,
      returnPct: Math.round((daysToReturn / horizon) * 1000) / 10,
    },
    history,
  };
}

// ---------------------------------------------------------------- SQD-02e deal sheet budget bar
export interface DealBudget { payrollEur: number; budgetEur: number; playerAnnualEur: number; sharePct: number; payrollPct: number; roomEur: number; over: boolean }
/** Annual payroll vs wage budget and this player's slice (existing economy read helpers only). */
export function dealBudget(state: CareerState, playerId: string): DealBudget | null {
  const c = state.playerContracts[playerId];
  const budgets = getClubBudgets(state, state.playerClubId);
  if (!c || !budgets) return null;
  const payrollEur = getClubPlayerWageCostsEurAnnual(state, state.playerClubId);
  const budgetEur = budgets.wageBudgetEur;
  const scale = Math.max(budgetEur, payrollEur, 1);
  const playerAnnualEur = c.wageEurPerMonth * 12;
  return {
    payrollEur, budgetEur, playerAnnualEur,
    sharePct: Math.round((playerAnnualEur / scale) * 1000) / 10,
    payrollPct: Math.round((payrollEur / scale) * 1000) / 10,
    roomEur: budgetEur - payrollEur, over: payrollEur > budgetEur,
  };
}

// ---------------------------------------------------------------- SQD-02f career ribbon
export interface RibbonSegment { clubId: string; name: string; shortName: string; fromAge: number; toAge: number; widthPct: number; compensationEur: number | null; compensationYears: number | null; current: boolean }
/** Clubs by age as ribbon segments, with the training-compensation share for each club where it applies. */
export function careerRibbon(state: CareerState, playerId: string, currentClubId: string | null, currentAge: number | null): RibbonSegment[] {
  const entries = [...(state.playerClubHistory[playerId]?.entries ?? [])].sort((a, b) => a.fromAge - b.fromAge);
  const comp = getPlayerTrainingCompensation(state, playerId);
  const share = new Map((comp?.perClub ?? []).map((s) => [s.clubId, s]));
  const segs = entries.map((e) => ({ clubId: e.clubId, fromAge: e.fromAge, toAge: e.toAge }));
  const last = segs.at(-1);
  if (currentClubId && currentAge != null && (!last || last.clubId !== currentClubId)) {
    const fromAge = last?.toAge ?? currentAge;
    segs.push({ clubId: currentClubId, fromAge, toAge: Math.max(fromAge, currentAge) });
  }
  const minAge = segs[0]?.fromAge ?? 0, maxAge = Math.max(...segs.map((s) => s.toAge), minAge + 1);
  const span = Math.max(1, maxAge - minAge);
  return segs.map((s) => {
    const club = getClub(s.clubId);
    const sh = share.get(s.clubId);
    return {
      clubId: s.clubId, name: club?.name ?? s.clubId, shortName: club?.shortName ?? s.clubId, fromAge: s.fromAge, toAge: s.toAge,
      widthPct: Math.max(6, Math.round(((Math.max(1, s.toAge - s.fromAge)) / span) * 1000) / 10),
      compensationEur: sh ? sh.amountEur : null, compensationYears: sh ? sh.years : null,
      current: s.clubId === currentClubId && s === segs.at(-1),
    };
  });
}

// ---------------------------------------------------------------- SQD-02b match chart
export interface MatchChartPoint { fixtureId: string; x: number; y: number; barPct: number; rating: number; label: string; outcome: "W" | "D" | "L" }
/** Last up to 12 matches oldest -> newest: rating line points (0-10 scale) and goal/save bars relative to the max. */
export function matchChart(matches: readonly DossierMatch[], goalkeeper: boolean, limit = 12): MatchChartPoint[] {
  const list = matches.slice(0, limit).reverse();
  const val = (m: DossierMatch) => goalkeeper ? m.saves ?? 0 : m.goals;
  const max = Math.max(1, ...list.map(val));
  return list.map((m, i) => ({
    fixtureId: m.fixtureId,
    x: list.length === 1 ? 50 : Math.round((i / (list.length - 1)) * 1000) / 10,
    y: Math.round(Math.max(0, Math.min(10, m.rating)) * 10) / 10,
    barPct: Math.round((val(m) / max) * 1000) / 10,
    rating: m.rating, label: `${m.date} ${m.home ? "mot" : "@"} ${m.opponent}`, outcome: m.outcome,
  }));
}
