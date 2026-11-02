// HM-ALPHA3-M04: the club's organisation -- departments, how many paid
// positions a club of its size carries, who fills them, and where roles
// are combined.
//
// Swedish handball clubs are small: a typical Handbollsligan club has a
// head coach, an assistant, a goalkeeper coach, a physical coach, a physio
// and a team manager (often voluntary), with a sporting director who also
// does the recruiting. Only the bigger clubs afford a head of recruitment,
// a scouting team, an analyst or a staffed academy. Positions therefore
// scale with the club's economic band (E1 strongest .. E7 smallest), and a
// missing specialist is covered by a combined role where that is how
// Swedish clubs actually work (the sporting director recruits, the head
// coach develops the youngsters).
import type { CareerState } from "../career/types";
import { getClubEconomyBaseline } from "../economy/clubEconomyIntegration";
import type { EconomicBand } from "../economy/clubEconomyTypes";
import { computeRoleSuitability } from "./roleSuitability";
import type { ResolvedStaffMember, StaffRole } from "./types";

export type Department = "LEADERSHIP" | "COACHING" | "RECRUITMENT" | "ACADEMY" | "SUPPORT";

export const DEPARTMENT_LABEL: Record<Department, string> = {
  LEADERSHIP: "Styrelse och sportslig ledning",
  COACHING: "Tränarstab",
  RECRUITMENT: "Rekrytering och scouting",
  ACADEMY: "Akademi och utveckling",
  SUPPORT: "Medicin och lagstöd",
};

export const ROLE_DEPARTMENT: Record<StaffRole, Department> = {
  SPORTING_DIRECTOR: "LEADERSHIP",
  HEAD_COACH: "COACHING",
  ASSISTANT_COACH: "COACHING",
  GOALKEEPER_COACH: "COACHING",
  PHYSICAL_COACH: "COACHING",
  ANALYST: "COACHING",
  HEAD_OF_RECRUITMENT: "RECRUITMENT",
  SCOUT: "RECRUITMENT",
  HEAD_OF_ACADEMY: "ACADEMY",
  DEVELOPMENT_COACH: "ACADEMY",
  PHYSIO: "SUPPORT",
  TEAM_MANAGER: "SUPPORT",
};

/** Paid positions per role by economic band. A design assumption calibrated to Swedish club sizes, not data. */
const SLOTS: Record<StaffRole, Record<"BIG" | "MID" | "SMALL", number>> = {
  SPORTING_DIRECTOR: { BIG: 1, MID: 1, SMALL: 1 },
  HEAD_COACH: { BIG: 1, MID: 1, SMALL: 1 },
  ASSISTANT_COACH: { BIG: 2, MID: 1, SMALL: 1 },
  GOALKEEPER_COACH: { BIG: 1, MID: 1, SMALL: 1 },
  PHYSICAL_COACH: { BIG: 1, MID: 1, SMALL: 1 },
  ANALYST: { BIG: 1, MID: 1, SMALL: 0 },
  HEAD_OF_RECRUITMENT: { BIG: 1, MID: 0, SMALL: 0 },
  SCOUT: { BIG: 3, MID: 2, SMALL: 1 },
  HEAD_OF_ACADEMY: { BIG: 1, MID: 1, SMALL: 0 },
  DEVELOPMENT_COACH: { BIG: 2, MID: 1, SMALL: 1 },
  PHYSIO: { BIG: 2, MID: 1, SMALL: 1 },
  TEAM_MANAGER: { BIG: 1, MID: 1, SMALL: 1 },
};

/** Who covers a role the club has no position for (Swedish practice). */
const COVERED_BY: Partial<Record<StaffRole, StaffRole>> = {
  HEAD_OF_RECRUITMENT: "SPORTING_DIRECTOR",
  HEAD_OF_ACADEMY: "HEAD_COACH",
  ANALYST: "ASSISTANT_COACH",
};

export function clubSize(band: EconomicBand | undefined): "BIG" | "MID" | "SMALL" {
  if (!band) return "SMALL";
  return ["E1", "E2", "E3", "E4"].includes(band) ? "BIG" : band === "E5" || band === "E6" ? "MID" : "SMALL";
}

export function roleSlots(state: CareerState, clubId: string, role: StaffRole): number {
  return SLOTS[role][clubSize(getClubEconomyBaseline(state, clubId)?.band)];
}

export interface Position {
  role: StaffRole;
  department: Department;
  slot: number;
  holder?: ResolvedStaffMember;
  /** Filled by someone whose own main role is another one (combined role). */
  combinedWith?: StaffRole;
  /** No position at this club size; who covers the work instead. */
  coveredBy?: StaffRole;
}

/** Every position the club has (filled or vacant), plus covered roles for those it does not staff. */
export function clubOrganisation(state: CareerState, clubId: string): Position[] {
  const roster = state.staffRoster[clubId] ?? [];
  const used = new Set<string>();
  const out: Position[] = [];
  for (const role of Object.keys(SLOTS) as StaffRole[]) {
    const slots = roleSlots(state, clubId, role);
    const holders = roster.filter((m) => m.roles.includes(role)).sort((a, b) => computeRoleSuitability(b, role) - computeRoleSuitability(a, role));
    if (slots === 0) {
      const holder = holders[0];
      out.push(holder ? { role, department: ROLE_DEPARTMENT[role], slot: 1, holder } : { role, department: ROLE_DEPARTMENT[role], slot: 1, coveredBy: COVERED_BY[role] });
      continue;
    }
    for (let i = 0; i < Math.max(slots, holders.length); i++) {
      const holder = holders[i];
      if (holder) used.add(holder.id);
      out.push({ role, department: ROLE_DEPARTMENT[role], slot: i + 1, holder, combinedWith: holder && holder.roles[0] !== role ? holder.roles[0] : undefined });
    }
  }
  return out;
}

export function vacancies(state: CareerState, clubId: string): Position[] {
  return clubOrganisation(state, clubId).filter((p) => !p.holder && !p.coveredBy);
}

/** The best-suited person at the club for a role (direct holder first, then whoever covers it). */
export function bestFor(state: CareerState, clubId: string, role: StaffRole): ResolvedStaffMember | undefined {
  const roster = state.staffRoster[clubId] ?? [];
  const direct = roster.filter((m) => m.roles.includes(role)).sort((a, b) => computeRoleSuitability(b, role) - computeRoleSuitability(a, role))[0];
  if (direct) return direct;
  const cover = COVERED_BY[role];
  return cover ? roster.filter((m) => m.roles.includes(cover)).sort((a, b) => computeRoleSuitability(b, role) - computeRoleSuitability(a, role))[0] : undefined;
}

/** A role's quality at the club on the 0.75..1.25 multiplier scale used across staff effects (1.0 = an average professional; nobody = 0.9). */
export function departmentQuality(state: CareerState, clubId: string, role: StaffRole): number {
  const member = bestFor(state, clubId, role);
  if (!member) return 0.9;
  const suitability = computeRoleSuitability(member, role); // 1..20
  const covered = !member.roles.includes(role);
  return Math.max(0.75, Math.min(1.25, 0.75 + (suitability - 1) / 38 - (covered ? 0.05 : 0)));
}

// ---------------------------------------------------------------------------
// M06 integration points: responsibilities (no delegation behaviour yet).
// ---------------------------------------------------------------------------

export const RESPONSIBILITY_AREAS = ["PLAYER_RECRUITMENT", "SCOUTING_ASSIGNMENTS", "CONTRACT_RENEWALS", "STAFF_HIRING", "YOUTH_INTAKE", "TRAINING_SCHEDULE", "OPPONENT_ANALYSIS"] as const;
export type ResponsibilityArea = (typeof RESPONSIBILITY_AREAS)[number];

export const RESPONSIBILITY_LABEL: Record<ResponsibilityArea, string> = {
  PLAYER_RECRUITMENT: "Spelarrekrytering",
  SCOUTING_ASSIGNMENTS: "Scoutinguppdrag",
  CONTRACT_RENEWALS: "Kontraktsförlängningar",
  STAFF_HIRING: "Personalrekrytering",
  YOUTH_INTAKE: "Ungdomsintag",
  TRAINING_SCHEDULE: "Träningsplanering",
  OPPONENT_ANALYSIS: "Motståndaranalys",
};

/** The role that would naturally own each area once delegation exists (M06). */
export const RESPONSIBILITY_OWNER_ROLE: Record<ResponsibilityArea, StaffRole> = {
  PLAYER_RECRUITMENT: "HEAD_OF_RECRUITMENT",
  SCOUTING_ASSIGNMENTS: "HEAD_OF_RECRUITMENT",
  CONTRACT_RENEWALS: "SPORTING_DIRECTOR",
  STAFF_HIRING: "SPORTING_DIRECTOR",
  YOUTH_INTAKE: "HEAD_OF_ACADEMY",
  TRAINING_SCHEDULE: "ASSISTANT_COACH",
  OPPONENT_ANALYSIS: "ANALYST",
};

/** Who would carry each responsibility today (today the manager decides everything; M06 adds the delegation itself). */
export function responsibilityCandidates(state: CareerState, clubId: string): { area: ResponsibilityArea; member?: ResolvedStaffMember; quality: number }[] {
  return (Object.keys(RESPONSIBILITY_OWNER_ROLE) as ResponsibilityArea[]).map((area) => {
    const role = RESPONSIBILITY_OWNER_ROLE[area];
    return { area, member: bestFor(state, clubId, role), quality: departmentQuality(state, clubId, role) };
  });
}

// ---------------------------------------------------------------------------
// Staff effects on existing systems. Neutral (1.0) when nobody holds the
// role, so clubs without these specialists behave exactly as before.
// ---------------------------------------------------------------------------

function directQuality(state: CareerState, clubId: string, role: StaffRole): number | null {
  const holder = (state.staffRoster[clubId] ?? []).filter((m) => m.roles.includes(role)).sort((a, b) => computeRoleSuitability(b, role) - computeRoleSuitability(a, role))[0];
  return holder ? departmentQuality(state, clubId, role) : null;
}

/** Development speed for players aged 21 or younger: head of academy and development coach, 0.875..1.125. */
export function academyDevelopmentFactor(state: CareerState, clubId: string): number {
  const qualities = [directQuality(state, clubId, "DEVELOPMENT_COACH"), directQuality(state, clubId, "HEAD_OF_ACADEMY")].filter((q): q is number => q !== null);
  if (qualities.length === 0) return 1;
  const avg = qualities.reduce((s, q) => s + q, 0) / qualities.length;
  return 1 + (avg - 1) * 0.5;
}

/** Knowledge gained per scouting report: a head of recruitment who directs the scouts, 0.9..1.1. */
export function recruitmentDepartmentFactor(state: CareerState, clubId: string): number {
  const q = directQuality(state, clubId, "HEAD_OF_RECRUITMENT");
  return q === null ? 1 : 1 + (q - 1) * 0.4;
}
