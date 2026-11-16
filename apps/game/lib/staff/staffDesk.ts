// Arena Nights 231 -- Staff view models: STF-01 A (org & responsibility matrix), STF-01b A (health tree uses
// the same rows), STF-01c A (list view), STF-01d A (mini week grid), STF-03 B / STF-03a A (vacancy cards),
// STF-03b A (negotiation board), STF-03c A (fit range) and STF-04 B (delegation overview + log filter).
// Pure reads over the organisation, employment, delegation, training-week and negotiation state -- no
// staff, contract, hiring or delegation rule is decided here.
import { delegateFor, delegationOf, modeOf, pendingProposals } from "../delegation/delegation";
import { DELEGABLE_AREAS, type DelegationLogEntry, type DelegationMode } from "../delegation/types";
import { daysBetween } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import { getClubStaffCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { mondayOf, resolveTrainingWeek } from "../training/trainingSchedule";
import type { TrainingDayType, TrainingSessionType } from "../training/types";
import { clubOrganisation, RESPONSIBILITY_AREAS, RESPONSIBILITY_OWNER_ROLE, vacancies, type Department, type ResponsibilityArea } from "./organisation";
import { computeRoleSuitability, resolveResponsibleCoach } from "./roleSuitability";
import { marketCandidates, visibleAttribute } from "./staffMarket";
import { staffSpendingLimit, vacancyFunding, type StaffNegotiation } from "./staffNegotiation";
import type { StaffRole } from "./types";

export const DEPARTMENT_ORDER: readonly Department[] = ["LEADERSHIP", "COACHING", "RECRUITMENT", "ACADEMY", "SUPPORT"];
/** Contracts ending within this many days count as "expiring" (same window as the organisation's needs list). */
export const EXPIRING_DAYS = 120;

export type FitTone = "good" | "ok" | "weak";
/** Fit on the 1-20 scale: 15+ good, 10-14 ok, below 10 weak. */
export function fitTone(suitability: number): FitTone {
  return suitability >= 15 ? "good" : suitability >= 10 ? "ok" : "weak";
}

/** A fit shown with the club's uncertainty: exact from 90 % knowledge, otherwise the same range the dossier draws for attributes. */
export function staffFitRange(suitability: number, knowledge: number): { low: number; high: number; exact: boolean } {
  return visibleAttribute(Math.round(suitability), knowledge);
}

export type MatrixState = "filled" | "combined" | "covered" | "vacant" | "manager" | "board";

export interface MatrixRow {
  key: string;
  department: Department;
  role: StaffRole | null;
  slot: number;
  state: MatrixState;
  holderId?: string;
  holderName?: string;
  boardLabel?: string;
  /** 1-20, own staff (fully known). Null for vacant/covered/manager/board rows. */
  fit: number | null;
  tone: FitTone | "vacant" | null;
  wageEurPerMonth: number | null;
  contractEnd: string | null;
  expiring: boolean;
  coveredBy?: StaffRole;
  combinedWith?: StaffRole;
  /** Delegation areas this holder carries, with today's mode. */
  areas: { area: ResponsibilityArea; mode: DelegationMode; delegable: boolean }[];
  /** Training sessions this person leads this week. */
  sessions: number;
}

export interface MatrixGroup { department: Department; rows: MatrixRow[]; vacant: number; weak: number }

const ROW_RANK: Record<string, number> = { vacant: 0, weak: 1 };

/** Every position at the club by department -- vacancies and weak fits first -- with who, how well, cost, delegation and this week's sessions. */
export function organisationMatrix(state: CareerState): MatrixGroup[] {
  const clubId = state.playerClubId;
  const roster = state.staffRoster[clubId] ?? [];
  const week = resolveTrainingWeek(state, mondayOf(state.gameDate));
  const sessionsBy = new Map<string, number>();
  for (const day of week.days) for (const s of day.sessions) { const coach = resolveResponsibleCoach(roster, s.type, s.coachId ?? null); if (coach) sessionsBy.set(coach.id, (sessionsBy.get(coach.id) ?? 0) + 1); }
  const rows: MatrixRow[] = [];
  for (const g of roster.filter((m) => state.staffEmployment[m.id]?.employmentType === "GOVERNANCE")) {
    rows.push({ key: `board-${g.id}`, department: "LEADERSHIP", role: null, slot: 0, state: "board", holderId: g.id, holderName: g.displayName, boardLabel: g.officialRoleLabel ?? "Ideellt uppdrag", fit: null, tone: null, wageEurPerMonth: null, contractEnd: null, expiring: false, areas: [], sessions: 0 });
  }
  for (const p of clubOrganisation(state, clubId)) {
    const e = p.holder ? state.staffEmployment[p.holder.id] : undefined;
    const fit = p.holder ? Math.round(computeRoleSuitability(p.holder, p.role) * 10) / 10 : null;
    const state_: MatrixState = p.holder ? (p.combinedWith ? "combined" : "filled") : p.managerHeld ? "manager" : p.coveredBy ? "covered" : "vacant";
    const salaried = e?.employmentType === "SALARIED";
    rows.push({
      key: `${p.role}-${p.slot}`, department: p.department, role: p.role, slot: p.slot, state: state_,
      holderId: p.holder?.id, holderName: p.holder?.displayName,
      fit, tone: state_ === "vacant" ? "vacant" : fit === null ? null : fitTone(fit),
      wageEurPerMonth: salaried ? e?.wageEurPerMonth ?? 0 : null,
      contractEnd: salaried ? e?.contractEndDate ?? null : null,
      expiring: Boolean(salaried && e?.contractEndDate && daysBetween(state.gameDate, e.contractEndDate) <= EXPIRING_DAYS),
      coveredBy: p.coveredBy, combinedWith: p.combinedWith,
      areas: [], sessions: p.holder ? sessionsBy.get(p.holder.id) ?? 0 : 0,
    });
  }
  // Each area sits on one row: the delegate's row for the owning role, otherwise the delegate's first row.
  for (const area of RESPONSIBILITY_AREAS) {
    const who = delegateFor(state, area);
    if (!who) continue;
    const row = rows.find((r) => r.holderId === who.staffId && r.role === RESPONSIBILITY_OWNER_ROLE[area]) ?? rows.find((r) => r.holderId === who.staffId && r.state !== "board");
    row?.areas.push({ area, mode: modeOf(state, area), delegable: DELEGABLE_AREAS.includes(area) });
  }
  return DEPARTMENT_ORDER.map((department) => {
    const list = rows.filter((r) => r.department === department);
    const rank = (r: MatrixRow) => ROW_RANK[r.tone ?? ""] ?? 2;
    return { department, rows: list.map((r, i) => ({ r, i })).sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i).map((x) => x.r), vacant: list.filter((r) => r.state === "vacant").length, weak: list.filter((r) => r.tone === "weak").length };
  });
}

/** Responsibility areas nobody at the club can carry -- the manager does them. */
export function unassignedAreas(state: CareerState): ResponsibilityArea[] {
  return RESPONSIBILITY_AREAS.filter((area) => !delegateFor(state, area));
}

// --- STF-01d mini week grid ----------------------------------------------------------------------

export interface WeekCell { date: string; dayType: TrainingDayType; today: boolean; sessions: { type: TrainingSessionType; coachId: string | null; coachName: string | null }[] }

export function weekGrid(state: CareerState): WeekCell[] {
  const roster = state.staffRoster[state.playerClubId] ?? [];
  return resolveTrainingWeek(state, mondayOf(state.gameDate)).days.map((d) => ({
    date: d.date, dayType: d.dayType, today: d.date === state.gameDate,
    sessions: d.sessions.map((s) => { const c = resolveResponsibleCoach(roster, s.type, s.coachId ?? null); return { type: s.type, coachId: c?.id ?? null, coachName: c?.displayName ?? null }; }),
  }));
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]!.toUpperCase()).slice(0, 2).join("");
}

// --- STF-03 / STF-03a vacancy cards --------------------------------------------------------------

export interface VacancyCard { role: StaffRole; open: number; fundingEurAnnual: number; /** Board limit + funding - today's costs (per year). */ roomEurAnnual: number; candidates: number; freeAgents: number }

export function vacancyCards(state: CareerState): VacancyCard[] {
  const clubId = state.playerClubId;
  const costs = getClubStaffCostsEurAnnual(state, clubId);
  const limit = staffSpendingLimit(state, clubId);
  const market = marketCandidates(state);
  const byRole = new Map<StaffRole, number>();
  for (const p of vacancies(state, clubId)) byRole.set(p.role, (byRole.get(p.role) ?? 0) + 1);
  return [...byRole].map(([role, open]) => {
    const funding = vacancyFunding(state, clubId, role, "HIRE");
    const pool = market.filter((c) => c.role === role);
    return { role, open, fundingEurAnnual: funding, roomEurAnnual: limit + funding - costs, candidates: pool.length, freeAgents: pool.filter((c) => c.status === "FREE_AGENT").length };
  });
}

// --- STF-03b negotiation board -------------------------------------------------------------------

export type NegotiationColumn = "YOUR_MOVE" | "WAITING" | "DONE";
export const NEGOTIATION_COLUMN_LABEL: Record<NegotiationColumn, string> = { YOUR_MOVE: "Väntar på dig", WAITING: "Väntar på svar", DONE: "Klar" };

export function negotiationColumn(n: Pick<StaffNegotiation, "stage" | "answerOn">): NegotiationColumn {
  if (n.stage !== "CLUB" && n.stage !== "TERMS") return "DONE";
  return n.answerOn ? "WAITING" : "YOUR_MOVE";
}

/** Staff negotiations by whose move it is; open ones by deadline, closed ones newest first (last 12). */
export function negotiationBoard(state: CareerState): Record<NegotiationColumn, StaffNegotiation[]> {
  const all = Object.values(state.staffNegotiations ?? {});
  const last = (n: StaffNegotiation) => n.rounds.at(-1)?.date ?? "";
  return {
    YOUR_MOVE: all.filter((n) => negotiationColumn(n) === "YOUR_MOVE").sort((a, b) => a.deadline.localeCompare(b.deadline) || a.id.localeCompare(b.id)),
    WAITING: all.filter((n) => negotiationColumn(n) === "WAITING").sort((a, b) => (a.answerOn ?? "").localeCompare(b.answerOn ?? "") || a.id.localeCompare(b.id)),
    DONE: all.filter((n) => negotiationColumn(n) === "DONE").sort((a, b) => last(b).localeCompare(last(a)) || b.id.localeCompare(a.id)).slice(0, 12),
  };
}

// --- STF-04 delegation overview ------------------------------------------------------------------

export interface AreaSummary { area: ResponsibilityArea; mode: DelegationMode; delegable: boolean; who: { staffId: string; name: string } | null; pending: number }

export function delegationSummary(state: CareerState): AreaSummary[] {
  const pending = pendingProposals(state);
  return RESPONSIBILITY_AREAS.map((area) => ({ area, mode: modeOf(state, area), delegable: DELEGABLE_AREAS.includes(area), who: delegateFor(state, area), pending: pending.filter((p) => p.area === area).length }));
}

/** The activity log, newest first, filtered by area and/or staff member. */
export function filterDelegationLog(state: CareerState, filter: { area?: ResponsibilityArea | "ALL"; staffId?: string | "ALL" }, limit = 40): DelegationLogEntry[] {
  return [...delegationOf(state).log]
    .reverse()
    .filter((l) => (!filter.area || filter.area === "ALL" || l.area === filter.area) && (!filter.staffId || filter.staffId === "ALL" || l.staffId === filter.staffId))
    .slice(0, limit);
}
