// HM-ALPHA3-M04: the staff side of the daily tick.
// - the season's market and staff development (once per season);
// - answers in staff negotiations, finished research;
// - our own contracts: a warning 60 days before the end, departure on the
//   day it ends unless renewed;
// - the CPU staff market on the 1st of each month: expiring CPU contracts
//   are renewed or released, core vacancies are filled from free agents,
//   and a club without a head coach may lure an ambitious assistant away --
//   including ours.
import { buildClubEvent, type CareerEvent } from "../career/careerEvents";
import { addDays } from "../career/dateUtils";
import type { CareerState } from "../career/types";
import { adjustClubCash, getClubStaffCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { formatEur } from "../economy/currency";
import { getClub } from "../game-data";
import { STAFF_ROLE_LABEL } from "./labels";
import { computeRoleSuitability } from "./roleSuitability";
import { findStaffMember, recruitStaffMember } from "./staffCareerIntegration";
import { ambitionOf, ensureStaffMarket } from "./staffMarket";
import { compensationDemand, hireFreeAgent, openNegotiationFor, progressStaffNegotiations, releaseStaff, staffSpendingLimit } from "./staffNegotiation";
import type { ResolvedStaffMember, StaffAttribute, StaffRole } from "./types";
import { ROLE_ATTRIBUTE_WEIGHTS } from "./roleAttributeMap";

type Emit = (e: CareerEvent) => void;

const CORE_ROLES: StaffRole[] = ["HEAD_COACH", "ASSISTANT_COACH", "GOALKEEPER_COACH", "PHYSIO"];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

/** Once per season: ambitious staff improve a little in their key attributes; settled veterans may slip. */
function developStaff(state: CareerState): CareerState {
  const roster: CareerState["staffRoster"] = {};
  for (const [clubId, members] of Object.entries(state.staffRoster)) {
    roster[clubId] = members.map((m) => {
      const role = m.roles[0];
      if (!role) return m;
      const keys = Object.keys(ROLE_ATTRIBUTE_WEIGHTS[role]) as StaffAttribute[];
      const ambition = ambitionOf(m.id);
      const attributes = { ...m.profile.attributes };
      for (const key of keys) {
        const r = hash(`${state.saveSeed}:${state.seasonId}:${m.id}:${key}:dev`);
        const delta = r < (ambition === "STABILITY" ? 0.12 : 0.05) ? -1 : r > (ambition === "STABILITY" ? 0.8 : 0.6) ? 1 : 0;
        const a = attributes[key];
        if (a && delta) attributes[key] = { ...a, value: Math.max(1, Math.min(20, a.value + delta)) };
      }
      return { ...m, profile: { ...m.profile, attributes } };
    });
  }
  return { ...state, staffRoster: roster };
}

export function progressStaff(state: CareerState, date: string, emit: Emit): CareerState {
  const newSeason = state.staffMarket !== undefined && state.staffMarket.seasonId !== state.seasonId;
  let next = ensureStaffMarket(state);
  if (newSeason) next = developStaff(next);

  next = progressStaffNegotiations(next, date, emit);

  // Research completes.
  for (const [staffId, research] of Object.entries(next.staffResearch ?? {})) {
    if (research.readyOn > date) continue;
    const { [staffId]: _done, ...rest } = next.staffResearch!;
    const current = next.staffKnowledge?.[staffId] ?? 0;
    next = { ...next, staffResearch: rest, staffKnowledge: { ...next.staffKnowledge, [staffId]: Math.min(95, Math.max(current, 50) + 35) } };
    const member = findStaffMember(next, staffId) ?? next.staffMarket?.freeAgents[staffId];
    emit(buildClubEvent("STAFF_UPDATE", `research:${staffId}:${date}`, date, "INFORMATION", `Referenser klara: ${member?.displayName ?? "kandidaten"}`, "Bilden av kandidatens kvaliteter är nu betydligt skarpare.", [{ route: "STAFF_MEMBER", staffId }]));
  }

  // Our own contracts.
  for (const member of next.staffRoster[next.playerClubId] ?? []) {
    const e = next.staffEmployment[member.id];
    if (e?.employmentType !== "SALARIED" || !e.contractEndDate) continue;
    if (addDays(e.contractEndDate, -60) === date) {
      emit(buildClubEvent("STAFF_UPDATE", `expiry:${member.id}:${e.contractEndDate}`, date, "IMPORTANT", `${member.displayName}s avtal löper ut`, `${STAFF_ROLE_LABEL[member.roles[0] ?? "SCOUT"]} ${member.displayName} har avtal till ${e.contractEndDate}. Förläng eller låt avtalet gå ut.`, [{ route: "STAFF_MEMBER", staffId: member.id }], { entityType: "task", entityId: member.id }));
    }
    if (e.contractEndDate < date && !openNegotiationFor(next, member.id)) {
      next = releaseStaff(next, member.id, date, "LEFT");
      emit(buildClubEvent("STAFF_UPDATE", `left:${member.id}:${e.contractEndDate}`, date, "IMPORTANT", `${member.displayName} har lämnat klubben`, "Avtalet gick ut utan förlängning. Rollen är vakant.", [{ route: "STAFF" }]));
    }
  }

  if (date.endsWith("-01")) next = cpuStaffMarket(next, date, emit);
  return next;
}

function cpuStaffMarket(state: CareerState, date: string, emit: Emit): CareerState {
  let next = state;
  for (const clubId of Object.keys(next.staffRoster)) {
    // HM-M7D: while the manager is out of work his former club is a CPU club and hires its own coach.
    if (clubId === next.playerClubId && !next.managerCareer?.seekingJob) continue;
    // Expiring CPU contracts: most are renewed for two years, some are let go.
    for (const member of next.staffRoster[clubId] ?? []) {
      const e = next.staffEmployment[member.id];
      if (e?.employmentType !== "SALARIED" || !e.contractEndDate || e.contractEndDate >= addDays(date, 31)) continue;
      if (hash(`${next.saveSeed}:${member.id}:${e.contractEndDate}:renew`) < 0.75) {
        next = { ...next, staffEmployment: { ...next.staffEmployment, [member.id]: { ...e, contractEndDate: `${Number(e.contractEndDate.slice(0, 4)) + 2}-05-31`, wageEurPerMonth: Math.round((e.wageEurPerMonth ?? 1000) * 1.04) } } };
      } else {
        next = releaseStaff(next, member.id, date, "LEFT");
      }
    }
    // Core vacancies.
    for (const role of CORE_ROLES) {
      if ((next.staffRoster[clubId] ?? []).some((m) => m.roles.includes(role))) continue;
      // HM-ALPHA3-M07: a head-coach vacancy stays open for applicants (the manager among them) until it closes.
      if (role === "HEAD_COACH" && next.managerCareer?.vacancies.some((v) => v.clubId === clubId && v.closesOn >= date)) continue;
      next = fillVacancy(next, clubId, role, date, emit);
    }
  }
  return next;
}

function fillVacancy(state: CareerState, clubId: string, role: StaffRole, date: string, emit: Emit): CareerState {
  const room = staffSpendingLimit(state, clubId) - getClubStaffCostsEurAnnual(state, clubId);
  const pool = Object.values(state.staffMarket?.freeAgents ?? {}).filter((m) => m.roles.includes(role));
  const best = pool.sort((a, b) => computeRoleSuitability(b, role) - computeRoleSuitability(a, role))[0];
  const freeQuality = best ? computeRoleSuitability(best, role) : 0;
  // A head-coach vacancy may be filled by luring a better assistant who wants their own team.
  if (role === "HEAD_COACH") {
    const target = poachTarget(state, clubId, freeQuality);
    if (target) return poach(state, clubId, target, date, emit);
  }
  if (!best) return state;
  const wage = state.staffMarket!.asking[best.id] ?? 1000;
  if (wage * 12 > Math.max(room, 0) && role !== "HEAD_COACH") return state;
  const next = hireFreeAgent(state, best.id, clubId, wage, `${Number(date.slice(0, 4)) + 2}-05-31`);
  return { ...next, staffAppointments: [...(next.staffAppointments ?? []), { staffId: best.id, clubId, role, date, kind: "APPOINTED" as const }].slice(-40) };
}

function poachTarget(state: CareerState, clubId: string, freeQuality: number): ResolvedStaffMember | undefined {
  const candidates: ResolvedStaffMember[] = [];
  for (const [otherId, roster] of Object.entries(state.staffRoster)) {
    if (otherId === clubId) continue;
    for (const m of roster) if (m.roles[0] === "ASSISTANT_COACH" && ambitionOf(m.id) === "HEAD_ROLE" && state.staffEmployment[m.id]?.employmentType === "SALARIED") candidates.push(m);
  }
  return candidates.filter((m) => computeRoleSuitability(m, "HEAD_COACH") > freeQuality + 1).sort((a, b) => computeRoleSuitability(b, "HEAD_COACH") - computeRoleSuitability(a, "HEAD_COACH"))[0];
}

function poach(state: CareerState, clubId: string, target: ResolvedStaffMember, date: string, emit: Emit): CareerState {
  const from = target.clubId;
  const compensation = compensationDemand(state, target.id);
  const wage = Math.round((state.staffEmployment[target.id]?.wageEurPerMonth ?? 1500) * 1.4);
  let next = adjustClubCash(state, clubId, -compensation, { category: "STAFF_COMPENSATION", label: `Ersättning för ${target.displayName}`, date });
  next = adjustClubCash(next, from, compensation, { category: "STAFF_COMPENSATION", label: `Ersättning för ${target.displayName}`, date });
  next = recruitStaffMember({ ...next, gameDate: date }, target.id, from, clubId, wage, `${Number(date.slice(0, 4)) + 2}-05-31`);
  next = { ...next, gameDate: state.gameDate };
  const roster = (next.staffRoster[clubId] ?? []).map((m) => (m.id === target.id ? { ...m, roles: ["HEAD_COACH" as StaffRole, ...m.roles.filter((r) => r !== "HEAD_COACH")] } : m));
  next = { ...next, staffRoster: { ...next.staffRoster, [clubId]: roster }, staffAppointments: [...(next.staffAppointments ?? []), { staffId: target.id, clubId, role: "HEAD_COACH" as StaffRole, date, kind: "APPOINTED" as const }].slice(-40) };
  if (from === state.playerClubId) {
    emit(buildClubEvent("STAFF_UPDATE", `poached:${target.id}:${date}`, date, "IMPORTANT", `${target.displayName} blir huvudtränare i ${getClub(clubId)?.shortName ?? "en annan klubb"}`,
      `Din assisterande tränare tog chansen till en egen huvudroll. Klubben får ${formatEur(compensation)} i ersättning. Rollen som assisterande tränare är nu vakant.`, [{ route: "STAFF" }]));
  }
  return next;
}
