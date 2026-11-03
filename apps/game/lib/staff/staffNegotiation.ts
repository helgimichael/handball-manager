// HM-ALPHA3-M04: staff negotiations, appointments, renewals and dismissals.
//
// The same shape as the transfer negotiations (lib/transfers): an offer is
// answered after a day, the other side may accept, counter or reject, at
// most three rounds, and an unanswered offer expires. Two stages:
// - CLUB  (only for someone under contract elsewhere): the employer wants
//         compensation for the months left on the contract;
// - TERMS: wage, contract length and role with the person.
// Renewals of our own staff go straight to TERMS. Money moves through the
// ledger (compensation paid or received, dismissal severance).
import type { CareerState } from "../career/types";
import { addDays, daysBetween } from "../career/dateUtils";
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import { adjustClubCash, getClubBudgets, getClubStaffCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { formatEur } from "../economy/currency";
import { getClub } from "../game-data";
import { departmentQuality, vacancies } from "./organisation";
import { estimateStaffMonthlyCostEur } from "../economy/staffCost";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { STAFF_ROLE_LABEL } from "./labels";
import { addFreeAgent, ambitionOf, getStaffAmbitionProfile, moveAttraction, removeFreeAgent } from "./staffMarket";
import { findStaffMember, recruitStaffMember } from "./staffCareerIntegration";
import type { ResolvedStaffMember, StaffEmployment, StaffRole } from "./types";

export type StaffNegotiationStage = "CLUB" | "TERMS" | "COMPLETED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
export type StaffResponse = "ACCEPT" | "COUNTER" | "REJECT";

export interface StaffOffer {
  wageEurPerMonth?: number;
  years?: number;
  role?: StaffRole;
  compensationEur?: number;
}

export interface StaffNegotiationRound {
  date: string;
  party: "MANAGER" | "CLUB" | "PERSON";
  offer?: StaffOffer;
  response?: StaffResponse;
  counter?: StaffOffer;
  reason?: string;
}

export interface StaffNegotiation {
  id: string;
  staffId: string;
  kind: "HIRE" | "RENEW";
  clubId: string; // the club hiring (the manager's)
  fromClubId?: string; // current employer, if any
  role: StaffRole;
  stage: StaffNegotiationStage;
  rounds: StaffNegotiationRound[];
  /** Date the pending answer arrives (null while it is the manager's move). */
  answerOn: string | null;
  deadline: string;
  agreedCompensationEur?: number;
}

const MAX_ROUNDS = 3;
const ANSWER_DAYS = 1;
const DEADLINE_DAYS = 7;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function monthsLeft(from: string, to?: string): number {
  if (!to) return 0;
  return Math.max(0, Math.round(daysBetween(from, to) / 30.4));
}

/**
 * The board's limit for staff commitments. The generated staff budgets sit
 * below many clubs' actual staff costs, so the board keeps funding the
 * staff it already has and allows new commitments up to 15 % above the
 * larger of the budget and today's costs. Every wage still lands on the
 * monthly ledger, so overspending has its consequence there.
 */
export function staffSpendingLimit(state: CareerState, clubId: string): number {
  const budget = getClubBudgets(state, clubId)?.staffBudgetEur ?? 0;
  if (state.clubFinances?.[clubId]?.status === "CRISIS") return getClubStaffCostsEurAnnual(state, clubId);
  return Math.round(Math.max(budget, getClubStaffCostsEurAnnual(state, clubId)) * 1.15);
}

/** A vacant position comes with its funding: hiring into it may add up to 1.3x the role's typical annual wage on top of the limit. */
export function vacancyFunding(state: CareerState, clubId: string, role: StaffRole, kind: "HIRE" | "RENEW"): number {
  if (kind !== "HIRE" || !vacancies(state, clubId).some((p) => p.role === role)) return 0;
  const band = getClubEconomyBaseline(state, clubId)?.band ?? "E6";
  return Math.round(estimateStaffMonthlyCostEur({ id: role, roles: [role], employmentType: "SALARIED" }, band) * 12 * 1.3);
}

/** What the current employer wants to let the person go: half of the wages left on the contract (capped at a year's wage). */
export function compensationDemand(state: CareerState, staffId: string): number {
  const e = state.staffEmployment[staffId];
  if (!e?.wageEurPerMonth) return 0;
  return Math.round(e.wageEurPerMonth * Math.min(12, monthsLeft(state.gameDate, e.contractEndDate)) * 0.5);
}

/** The wage the person asks for this move -- their current/asking wage, adjusted for how attractive the move is and our sporting director's negotiating. */
export function wageDemand(state: CareerState, staffId: string, toClubId: string, role: StaffRole, kind: "HIRE" | "RENEW"): number {
  const member = findStaffMember(state, staffId) ?? state.staffMarket?.freeAgents[staffId] ?? state.scoutMarket?.[staffId];
  const employment = state.staffEmployment[staffId];
  const base = employment?.wageEurPerMonth ?? state.staffMarket?.asking[staffId] ?? 1000;
  const attraction = kind === "RENEW" ? (ambitionOf(staffId) === "STABILITY" ? 0.1 : -0.05) : moveAttraction(state, staffId, employment?.clubId || undefined, toClubId, role, member?.roles[0]);
  const raise = kind === "RENEW" ? 1.08 : employment?.clubId ? 1.15 : 1.0;
  const negotiator = departmentQuality(state, toClubId, "SPORTING_DIRECTOR"); // 0.75..1.25
  const personal = 0.95 + hash(`${state.saveSeed}:${staffId}:wage`) * 0.1;
  return Math.round((base * raise * (1 - attraction * 0.2) * personal) / (0.94 + negotiator * 0.06));
}

function respond(offered: number, demand: number, round: number): { response: StaffResponse; counter?: number } {
  if (offered >= demand) return { response: "ACCEPT" };
  if (round >= MAX_ROUNDS || offered < demand * 0.7) return { response: "REJECT" };
  return { response: "COUNTER", counter: demand };
}

export function openNegotiationFor(state: CareerState, staffId: string): StaffNegotiation | undefined {
  return Object.values(state.staffNegotiations ?? {}).find((n) => n.staffId === staffId && (n.stage === "CLUB" || n.stage === "TERMS"));
}

export function startStaffNegotiation(state: CareerState, staffId: string, role: StaffRole, kind: "HIRE" | "RENEW" = "HIRE"): { state: CareerState; negotiation: StaffNegotiation } {
  const existing = openNegotiationFor(state, staffId);
  if (existing) return { state, negotiation: existing };
  const member = findStaffMember(state, staffId);
  const employment = state.staffEmployment[staffId];
  const employed = kind === "HIRE" && member && member.clubId !== state.playerClubId && employment?.employmentType === "SALARIED";
  if (kind === "HIRE" && member?.clubId === state.playerClubId) throw new Error("Personen arbetar redan i klubben.");
  if (kind === "HIRE" && !employed && !state.staffMarket?.freeAgents[staffId] && !state.scoutMarket?.[staffId]) throw new Error("Personen är inte tillgänglig.");
  const negotiation: StaffNegotiation = {
    id: `staffneg:${staffId}:${state.gameDate}`,
    staffId,
    kind,
    clubId: state.playerClubId,
    fromClubId: employed ? member!.clubId : undefined,
    role,
    stage: employed ? "CLUB" : "TERMS",
    rounds: [],
    answerOn: null,
    deadline: addDays(state.gameDate, DEADLINE_DAYS),
  };
  return { state: { ...state, staffNegotiations: { ...state.staffNegotiations, [negotiation.id]: negotiation } }, negotiation };
}

/** The manager's offer for the current stage. Budget is checked up front (staff budget, and cash for compensation). */
export function submitStaffOffer(state: CareerState, negotiationId: string, offer: StaffOffer): CareerState {
  const n = state.staffNegotiations?.[negotiationId];
  if (!n || (n.stage !== "CLUB" && n.stage !== "TERMS")) throw new Error("Förhandlingen är inte öppen.");
  if (n.answerOn) throw new Error("Vänta på svaret innan du lägger nästa bud.");
  if (n.stage === "TERMS") {
    const wage = Math.round(offer.wageEurPerMonth ?? 0);
    if (wage <= 0) throw new Error("Ange en månadslön.");
    const current = n.kind === "RENEW" ? (state.staffEmployment[n.staffId]?.wageEurPerMonth ?? 0) * 12 : 0;
    const projected = getClubStaffCostsEurAnnual(state, n.clubId) - current + wage * 12;
    const limit = staffSpendingLimit(state, n.clubId) + vacancyFunding(state, n.clubId, (offer.role ?? n.role), n.kind);
    if (wage * 12 > current && projected > limit) throw new Error(`Personalkostnaden blir ${formatEur(projected)}/år, över styrelsens ram på ${formatEur(limit)}/år.`);
  }
  const round: StaffNegotiationRound = { date: state.gameDate, party: "MANAGER", offer: { ...offer, wageEurPerMonth: offer.wageEurPerMonth && Math.round(offer.wageEurPerMonth), years: offer.years ?? 2, role: offer.role ?? n.role } };
  return { ...state, staffNegotiations: { ...state.staffNegotiations, [n.id]: { ...n, rounds: [...n.rounds, round], answerOn: addDays(state.gameDate, ANSWER_DAYS) } } };
}

export function withdrawStaffNegotiation(state: CareerState, negotiationId: string): CareerState {
  const n = state.staffNegotiations?.[negotiationId];
  if (!n) return state;
  return { ...state, staffNegotiations: { ...state.staffNegotiations, [n.id]: { ...n, stage: "WITHDRAWN", answerOn: null } } };
}

/** Daily: answers due offers, expires stale ones, completes agreements. */
export function progressStaffNegotiations(state: CareerState, date: string, emit: (e: CareerEvent) => void): CareerState {
  let next = state;
  for (const n of Object.values(next.staffNegotiations ?? {})) {
    if (n.stage !== "CLUB" && n.stage !== "TERMS") continue;
    if (!n.answerOn && date > n.deadline) {
      next = { ...next, staffNegotiations: { ...next.staffNegotiations, [n.id]: { ...n, stage: "EXPIRED" } } };
      continue;
    }
    if (!n.answerOn || n.answerOn > date) continue;
    const last = n.rounds.at(-1)!;
    const roundsThisStage = n.rounds.filter((r) => r.party === "MANAGER" && (n.stage === "CLUB" ? r.offer?.compensationEur !== undefined : r.offer?.wageEurPerMonth !== undefined)).length;
    const name = displayName(next, n.staffId);
    if (n.stage === "CLUB") {
      const demand = compensationDemand(next, n.staffId);
      const r = respond(last.offer?.compensationEur ?? 0, demand, roundsThisStage);
      const reply: StaffNegotiationRound = { date, party: "CLUB", response: r.response, counter: r.counter !== undefined ? { compensationEur: r.counter } : undefined, reason: r.response === "ACCEPT" ? `${clubName(n.fromClubId)} släpper ${name} mot ersättning.` : r.response === "COUNTER" ? `${clubName(n.fromClubId)} vill ha ${formatEur(demand)} i ersättning för avtalet.` : `${clubName(n.fromClubId)} vägrar släppa ${name}.` };
      const stage = r.response === "ACCEPT" ? "TERMS" : r.response === "REJECT" ? "REJECTED" : "CLUB";
      next = { ...next, staffNegotiations: { ...next.staffNegotiations, [n.id]: { ...n, rounds: [...n.rounds, reply], stage, answerOn: null, deadline: addDays(date, DEADLINE_DAYS), agreedCompensationEur: r.response === "ACCEPT" ? last.offer?.compensationEur ?? 0 : undefined } } };
      emit(buildClubEvent("STAFF_UPDATE", `${n.id}:${date}:club`, date, "IMPORTANT", r.response === "ACCEPT" ? `${clubName(n.fromClubId)} släpper ${name}` : r.response === "COUNTER" ? `Motbud om ${name}` : `${clubName(n.fromClubId)} säger nej`, reply.reason!, [{ route: "STAFF_MEMBER", staffId: n.staffId }]));
      continue;
    }
    const demand = wageDemand(next, n.staffId, n.clubId, last.offer?.role ?? n.role, n.kind);
    const r = respond(last.offer?.wageEurPerMonth ?? 0, demand, roundsThisStage);
    const reply: StaffNegotiationRound = { date, party: "PERSON", response: r.response, counter: r.counter !== undefined ? { wageEurPerMonth: r.counter } : undefined, reason: r.response === "ACCEPT" ? `${name} accepterar villkoren.` : r.response === "COUNTER" ? `${name} vill ha ${formatEur(demand)} i månaden.` : `${name} tackar nej.` };
    let updated: StaffNegotiation = { ...n, rounds: [...n.rounds, reply], answerOn: null, deadline: addDays(date, DEADLINE_DAYS), stage: r.response === "ACCEPT" ? "COMPLETED" : r.response === "REJECT" ? "REJECTED" : "TERMS" };
    next = { ...next, staffNegotiations: { ...next.staffNegotiations, [n.id]: updated } };
    if (r.response === "ACCEPT") {
      next = completeAgreement(next, updated, last.offer!, date);
      updated = next.staffNegotiations![n.id]!;
    }
    const subject = r.response === "ACCEPT" ? (n.kind === "RENEW" ? `${name} förlänger` : `${name} är klar för klubben`) : r.response === "COUNTER" ? `${name} vill ha mer` : `${name} tackar nej`;
    emit(buildClubEvent("STAFF_UPDATE", `${n.id}:${date}:terms`, date, "IMPORTANT", subject, reply.reason!, [{ route: "STAFF_MEMBER", staffId: n.staffId }]));
  }
  return next;
}

function displayName(state: CareerState, staffId: string): string {
  return (findStaffMember(state, staffId) ?? state.staffMarket?.freeAgents[staffId] ?? state.scoutMarket?.[staffId])?.displayName ?? "Personen";
}

function clubName(id?: string): string {
  return (id && getClub(id)?.shortName) || "Klubben";
}

function contractEnd(date: string, years: number): string {
  const y = Number(date.slice(0, 4)) + (date.slice(5) > "05-31" ? 1 : 0) + Math.max(1, years) - 1;
  return `${y}-05-31`;
}

function appointment(state: CareerState, entry: NonNullable<CareerState["staffAppointments"]>[number]): CareerState {
  return { ...state, staffAppointments: [...(state.staffAppointments ?? []), entry].slice(-40) };
}

function completeAgreement(state: CareerState, n: StaffNegotiation, offer: StaffOffer, date: string): CareerState {
  const wage = offer.wageEurPerMonth!;
  const role = offer.role ?? n.role;
  const end = contractEnd(date, offer.years ?? 2);
  let next = state;
  if (n.kind === "RENEW") {
    const e = next.staffEmployment[n.staffId]!;
    next = { ...next, staffEmployment: { ...next.staffEmployment, [n.staffId]: { ...e, wageEurPerMonth: wage, contractEndDate: end } } };
    return appointment(next, { staffId: n.staffId, clubId: n.clubId, role, date, kind: "RENEWED" });
  }
  if (n.fromClubId) {
    const compensation = n.agreedCompensationEur ?? 0;
    next = adjustClubCash(next, n.clubId, -compensation, { category: "STAFF_COMPENSATION", label: `Ersättning för ${displayName(next, n.staffId)}`, date });
    next = adjustClubCash(next, n.fromClubId, compensation, { category: "STAFF_COMPENSATION", label: `Ersättning för ${displayName(next, n.staffId)}`, date });
    next = recruitStaffMember({ ...next, gameDate: date }, n.staffId, n.fromClubId, n.clubId, wage, end);
    next = { ...next, gameDate: state.gameDate };
  } else {
    next = hireFreeAgent(next, n.staffId, n.clubId, wage, end);
  }
  next = setRole(next, n.staffId, role);
  return appointment({ ...next, staffKnowledge: { ...next.staffKnowledge, [n.staffId]: 100 } }, { staffId: n.staffId, clubId: n.clubId, role, date, kind: "APPOINTED" });
}

/** Adds a free agent (generated pool or scout pool) to a club's roster with a salaried contract. */
export function hireFreeAgent(state: CareerState, staffId: string, clubId: string, wage: number, end: string): CareerState {
  const member = state.staffMarket?.freeAgents[staffId] ?? state.scoutMarket?.[staffId];
  if (!member) return state;
  const signed: ResolvedStaffMember = { ...member, clubId };
  const employment: StaffEmployment = { staffId, clubId, roles: signed.roles, employmentType: "SALARIED", contractEndDate: end, wageEurPerMonth: wage };
  const next = removeFreeAgent(state, staffId);
  return { ...next, staffRoster: { ...next.staffRoster, [clubId]: [...(next.staffRoster[clubId] ?? []), signed] }, staffEmployment: { ...next.staffEmployment, [staffId]: employment } };
}

/** Puts `role` first in the person's roles (the role they were hired for). */
function setRole(state: CareerState, staffId: string, role: StaffRole): CareerState {
  const member = findStaffMember(state, staffId);
  if (!member || member.roles[0] === role) return state;
  const roles = [role, ...member.roles.filter((r) => r !== role)];
  const roster = (state.staffRoster[member.clubId] ?? []).map((m) => (m.id === staffId ? { ...m, roles } : m));
  const e = state.staffEmployment[staffId];
  return { ...state, staffRoster: { ...state.staffRoster, [member.clubId]: roster }, staffEmployment: e ? { ...state.staffEmployment, [staffId]: { ...e, roles } } : state.staffEmployment };
}

/** Severance when the club ends a contract early: the wages left, capped at six months. */
export function dismissalCost(state: CareerState, staffId: string): number {
  const e = state.staffEmployment[staffId];
  if (!e?.wageEurPerMonth || e.employmentType !== "SALARIED") return 0;
  return Math.round(e.wageEurPerMonth * Math.min(6, monthsLeft(state.gameDate, e.contractEndDate)));
}

export function dismissStaff(state: CareerState, staffId: string, date = state.gameDate): CareerState {
  const member = findStaffMember(state, staffId);
  if (!member || member.clubId !== state.playerClubId) throw new Error("Bara klubbens egen personal kan sägas upp.");
  const cost = dismissalCost(state, staffId);
  let next = cost > 0 ? adjustClubCash(state, member.clubId, -cost, { category: "STAFF_COMPENSATION", label: `Avgångsvederlag: ${member.displayName}`, date }) : state;
  next = releaseStaff(next, staffId, date, "DISMISSED");
  return next;
}

/** Removes a person from their club's roster into the free-agent market (contract ended, dismissed, resigned). */
export function releaseStaff(state: CareerState, staffId: string, date: string, kind: "LEFT" | "DISMISSED"): CareerState {
  const member = findStaffMember(state, staffId);
  if (!member) return state;
  const e = state.staffEmployment[staffId];
  const roster = (state.staffRoster[member.clubId] ?? []).filter((m) => m.id !== staffId);
  const { [staffId]: _e, ...employment } = state.staffEmployment;
  let next: CareerState = { ...state, staffRoster: { ...state.staffRoster, [member.clubId]: roster }, staffEmployment: employment };
  // Someone who worked for the manager's club stays fully known to it after leaving.
  if (member.clubId === state.playerClubId) next = { ...next, staffKnowledge: { ...(next.staffKnowledge ?? {}), [staffId]: 100 } };
  if (e?.employmentType === "SALARIED") next = addFreeAgent(next, member, e.wageEurPerMonth ?? 1000);
  return appointment(next, { staffId, clubId: member.clubId, role: member.roles[0] ?? "SCOUT", date, kind });
}

export { STAFF_ROLE_LABEL };
