// HM-ALPHA3-M04: the staff market -- who could work here, what we know
// about them, and what they would cost.
//
// Discovery reuses the player-scouting principles (lib/knowledge): every
// outside person starts as a partial picture whose precision depends on
// the club's network (sporting director / head of recruitment NETWORK),
// and research by those people narrows it over days. Our own staff are
// fully known. Attributes are shown as ranges until knowledge is high.
//
// The market holds (a) salaried staff at other clubs (approach + their
// club's compensation), (b) the existing free-agent scout pool, and (c) a
// deterministic per-season pool of free agents for every role, plus anyone
// released or dismissed during the season.
import type { CareerState } from "../career/types";
import { addDays } from "../career/dateUtils";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import { estimateStaffMonthlyCostEur } from "../economy/staffCost";
import { clubCompetitionTier } from "../career/competitionMembership";
import { generateFictionalStaffName, generateStaffAttributeProfile } from "./staffAttributeGeneration";
import { bestFor } from "./organisation";
import { computeRoleSuitability } from "./roleSuitability";
import { STAFF_ROLES, type ResolvedStaffMember, type StaffAttribute, type StaffRole } from "./types";
import {
  type Ambition,
  type LeadershipDesire,
  type PrestigeDesire,
  type WageExpectationTier,
  type StaffAmbitionProfile,
  AMBITION_LABEL,
  ambitionOf,
  getStaffAmbitionProfile,
  formatStaffAmbition,
  staffAmbitionDescription,
} from "./staffAmbition";

export type { Ambition, LeadershipDesire, PrestigeDesire, WageExpectationTier, StaffAmbitionProfile };
export { AMBITION_LABEL, ambitionOf, getStaffAmbitionProfile, formatStaffAmbition, staffAmbitionDescription };

export interface StaffMarketState {
  seasonId: string;
  freeAgents: Record<string, ResolvedStaffMember>;
  /** Asking monthly wage for free agents (EUR). */
  asking: Record<string, number>;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

const FREE_AGENTS_PER_ROLE = 3;

function generateFreeAgent(state: CareerState, role: StaffRole, i: number): { member: ResolvedStaffMember; asking: number } {
  const seed = `${state.saveSeed}:${state.seasonId}:staff-fa:${role}:${i}`;
  const id = `fa-staff:${state.seasonId.slice(0, 4)}:${role}:${i}`;
  const profile = generateStaffAttributeProfile(id, [role], seed);
  // Quality spread: some free agents are clearly better than others (-3..+3 on the role's key attributes).
  const level = Math.round((hash(`${seed}:level`) - 0.5) * 6);
  const attributes = { ...profile.attributes };
  for (const key of Object.keys(attributes) as StaffAttribute[]) {
    const a = attributes[key];
    attributes[key] = { ...a, value: Math.max(1, Math.min(20, a.value + level)) };
  }
  const member: ResolvedStaffMember = { id, clubId: "", displayName: generateFictionalStaffName(seed), roles: [role], hmRoles: [], employmentType: "SALARIED", profile: { ...profile, attributes }, source: "GENERATED_FICTIONAL" };
  const asking = Math.round(estimateStaffMonthlyCostEur(member, "E6") * (0.85 + (level + 3) * 0.06));
  return { member, asking };
}

/** Builds this season's free-agent pool once per season (deterministic); keeps people released during the season. */
export function ensureStaffMarket(state: CareerState): CareerState {
  if (state.staffMarket?.seasonId === state.seasonId) return state;
  const freeAgents: Record<string, ResolvedStaffMember> = {};
  const asking: Record<string, number> = {};
  for (const role of STAFF_ROLES) {
    if (role === "HEAD_COACH") continue; // the manager is the head coach of their own club; CPU head coaches come from the market below
    for (let i = 0; i < FREE_AGENTS_PER_ROLE; i++) {
      const { member, asking: a } = generateFreeAgent(state, role, i);
      freeAgents[member.id] = member;
      asking[member.id] = a;
    }
  }
  for (let i = 0; i < 4; i++) {
    const { member, asking: a } = generateFreeAgent(state, "HEAD_COACH", i);
    freeAgents[member.id] = member;
    asking[member.id] = a;
  }
  // People released last season stay available.
  for (const [id, m] of Object.entries(state.staffMarket?.freeAgents ?? {})) {
    if (!id.startsWith("fa-staff:")) {
      freeAgents[id] = m;
      asking[id] = state.staffMarket!.asking[id] ?? 1200;
    }
  }
  return { ...state, staffMarket: { seasonId: state.seasonId, freeAgents, asking } };
}

export function addFreeAgent(state: CareerState, member: ResolvedStaffMember, askingEur: number): CareerState {
  const market = state.staffMarket ?? { seasonId: state.seasonId, freeAgents: {}, asking: {} };
  return { ...state, staffMarket: { ...market, freeAgents: { ...market.freeAgents, [member.id]: { ...member, clubId: "" } }, asking: { ...market.asking, [member.id]: askingEur } } };
}

export function removeFreeAgent(state: CareerState, staffId: string): CareerState {
  const market = state.staffMarket;
  const scoutMarket = state.scoutMarket?.[staffId] ? Object.fromEntries(Object.entries(state.scoutMarket).filter(([id]) => id !== staffId)) : state.scoutMarket;
  if (!market?.freeAgents[staffId]) return { ...state, scoutMarket };
  const { [staffId]: _m, ...freeAgents } = market.freeAgents;
  const { [staffId]: _a, ...asking } = market.asking;
  return { ...state, scoutMarket, staffMarket: { ...market, freeAgents, asking } };
}

// ---------------------------------------------------------------------------
// Knowledge
// ---------------------------------------------------------------------------

/** What the club knows about a person (0-100): own staff fully; others from the network, raised by research. */
export function staffKnowledge(state: CareerState, staffId: string, clubId = state.playerClubId): number {
  if ((state.staffRoster[clubId] ?? []).some((m) => m.id === staffId)) return 100;
  const researched = state.staffKnowledge?.[staffId] ?? 0;
  const networker = bestFor(state, clubId, "HEAD_OF_RECRUITMENT") ?? bestFor(state, clubId, "SPORTING_DIRECTOR");
  const network = networker?.profile.attributes.NETWORK?.value ?? 8;
  const base = Math.round(15 + network * 1.6); // 17..47
  return Math.min(100, Math.max(base, researched));
}

/** A displayed attribute: exact at high knowledge, a range otherwise. */
export function visibleAttribute(value: number, knowledge: number): { low: number; high: number; exact: boolean } {
  if (knowledge >= 90) return { low: value, high: value, exact: true };
  const half = Math.max(1, Math.round((100 - knowledge) / 14));
  return { low: Math.max(1, value - half), high: Math.min(20, value + half), exact: false };
}

/** Starts research on a person: done after 5-12 days depending on the researcher's network and recruitment judgement. */
export function startStaffResearch(state: CareerState, staffId: string): CareerState {
  if (state.staffResearch?.[staffId]) return state;
  const researcher = bestFor(state, state.playerClubId, "HEAD_OF_RECRUITMENT") ?? bestFor(state, state.playerClubId, "SPORTING_DIRECTOR");
  if (!researcher) throw new Error("Klubben har ingen sportchef eller rekryteringschef som kan ta referenser.");
  const skill = ((researcher.profile.attributes.NETWORK?.value ?? 10) + (researcher.profile.attributes.RECRUITMENT?.value ?? 10)) / 2;
  const days = Math.round(12 - (skill - 1) * (7 / 19));
  return { ...state, staffResearch: { ...state.staffResearch, [staffId]: { startedOn: state.gameDate, readyOn: addDays(state.gameDate, days), byStaffId: researcher.id } } };
}

// ---------------------------------------------------------------------------
// Candidates
// ---------------------------------------------------------------------------

export interface StaffCandidate {
  member: ResolvedStaffMember;
  status: "FREE_AGENT" | "EMPLOYED";
  currentClubId?: string;
  role: StaffRole;
  /** Expected monthly wage (EUR): asking for free agents, current wage + a step for employed staff. */
  expectedWageEur: number;
  knowledge: number;
  suitability: number;
  ambition: Ambition;
  contractEndDate?: string;
}

export function marketCandidates(state: CareerState, clubId = state.playerClubId): StaffCandidate[] {
  const out: StaffCandidate[] = [];
  const market = state.staffMarket;
  const freeAgents = { ...(market?.freeAgents ?? {}), ...(state.scoutMarket ?? {}) };
  for (const member of Object.values(freeAgents)) {
    const role = member.roles[0] ?? "SCOUT";
    out.push({ member, status: "FREE_AGENT", role, expectedWageEur: market?.asking[member.id] ?? 1000, knowledge: staffKnowledge(state, member.id, clubId), suitability: computeRoleSuitability(member, role), ambition: ambitionOf(member.id, role) });
  }
  for (const [otherClubId, roster] of Object.entries(state.staffRoster)) {
    if (otherClubId === clubId) continue;
    for (const member of roster) {
      const employment = state.staffEmployment[member.id];
      if (employment?.employmentType !== "SALARIED") continue;
      const role = member.roles[0];
      if (!role) continue;
      out.push({ member, status: "EMPLOYED", currentClubId: otherClubId, role, expectedWageEur: Math.round((employment.wageEurPerMonth ?? 1000) * 1.15), knowledge: staffKnowledge(state, member.id, clubId), suitability: computeRoleSuitability(member, role), ambition: ambitionOf(member.id, role), contractEndDate: employment.contractEndDate });
    }
  }
  return out;
}

/** How attractive a move is for the person: higher tier, bigger club, a step up in role. -1..+1. */
export function moveAttraction(state: CareerState, staffId: string, fromClubId: string | undefined, toClubId: string, newRole: StaffRole, oldRole?: StaffRole): number {
  const tierTo = clubCompetitionTier(state, toClubId) ?? 2;
  const tierFrom = fromClubId ? clubCompetitionTier(state, fromClubId) ?? 2 : 3;
  const bandRank = (id?: string) => (id ? Number(getClubEconomyBaseline(state, id)?.band.slice(1) ?? 7) : 8);
  let score = (tierFrom - tierTo) * 0.35 + (bandRank(fromClubId) - bandRank(toClubId)) * 0.06;
  
  const profile = getStaffAmbitionProfile(staffId, oldRole ?? newRole);
  const headRoles: StaffRole[] = ["HEAD_COACH", "SPORTING_DIRECTOR", "HEAD_OF_RECRUITMENT", "HEAD_OF_ACADEMY"];
  if (headRoles.includes(newRole) && (!oldRole || !headRoles.includes(oldRole))) {
    score += profile.leadershipDesire === "ORGANISATION_HEAD" || profile.ambition === "HEAD_ROLE" ? 0.45 : 0.2;
  }
  if (profile.ambition === "STABILITY" && fromClubId) score -= 0.15;
  if (profile.prestigeDesire === "NATIONAL_ELITE" && tierTo === 1) score += 0.1;
  return Math.max(-1, Math.min(1, score));
}
