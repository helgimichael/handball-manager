// HM-STAFF-CAREER-1.0: the ONE module that reads/writes CareerState for
// staff roster/employment -- mirrors lib/economy/contractIntegration.ts's
// own "pure resolution below, CareerState glue here" split, and
// lib/transfers/transferExecution.ts's "one place actually moves an
// entity between clubs" precedent (moveStaffMembership below is the
// staff-domain twin of moveSquadMembership/moveGameplayRating).
import { getClub, getClubsByCompetition, getCompetition, GAME_CURRENT_DATE } from "../game-data";
import { selectCurrentStaffAssignments } from "../identity/validators";
import { generateContractEndDate } from "../economy/contractGeneration";
import { estimateStaffMonthlyCostEur } from "../economy/staffCost";
import { generateClubEconomyBaseline } from "../economy/clubEconomyGeneration";
import { resolveClubStaffRoster, type RawClubStaffIdentityLike } from "./staffRosterResolution";
import type { ResolvedStaffMember, StaffEmployment } from "./types";
import type { EconomicBand } from "../economy/clubEconomyTypes";
import type { CareerState } from "../career/types";
import type { StaffClubHistory, StaffClubHistoryEntry } from "./staffHistoryTypes";

/**
 * A club's economic BAND, computed directly via the same pure,
 * deterministic `generateClubEconomyBaseline` formula
 * ensureCareerAllClubEconomies itself uses -- never dependent on
 * `state.clubEconomies` already being populated (the staff roster is
 * resolved BEFORE the economy pipeline runs in newCareer.ts, so reading
 * state here would be a chicken-and-egg problem). Because the formula is
 * pure and seeded only on (clubId, tier), this always agrees with
 * whatever `state.clubEconomies[clubId].band` ends up being once the
 * economy pipeline does run -- same value, computed twice, never
 * diverging.
 */
function clubEconomicBand(clubId: string): EconomicBand {
  const tier = getCompetition(getClub(clubId)?.competitionId ?? "")?.tier;
  return generateClubEconomyBaseline(clubId, tier).band;
}

/**
 * The one place a StaffEmployment entry's INITIAL wage is derived --
 * always `estimateStaffMonthlyCostEur` for a SALARIED member (never for
 * VOLUNTARY/GOVERNANCE, matching contractEndDate's own optionality).
 */
function buildStaffEmploymentEntry(member: ResolvedStaffMember, band: EconomicBand, fallbackYear: number): StaffEmployment {
  return {
    staffId: member.id,
    clubId: member.clubId,
    roles: member.roles,
    employmentType: member.employmentType,
    ...(member.employmentType === "SALARIED"
      ? {
          contractEndDate: generateContractEndDate(member.id, "", fallbackYear),
          wageEurPerMonth: estimateStaffMonthlyCostEur(member, band),
        }
      : {}),
  };
}

/**
 * Resolves EVERY club's own staff roster for `competitionId` -- the same
 * "resolved once, frozen into CareerState for the whole competition"
 * precedent worldSquads/aiTacticalPreferences/gameplayRatings already
 * established (serverSnapshot.ts), extended to staff so recruitment can
 * browse candidates at ANY club, not only the manager's own (HM-STAFF-
 * CAREER-1.0 Part 1: "All staff i alla klubbar ska vara klickbar").
 * `staffIdentityByClub` holds each REAL_WORLD club's raw identity data
 * (or `null`/missing for a club with none) -- already resolved
 * server-side by the caller, exactly like the existing single-club
 * `staffIdentity` param this replaces.
 */
export function resolveCompetitionStaffRoster(
  competitionId: string,
  staffIdentityByClub: Record<string, RawClubStaffIdentityLike | null>,
  fallbackYear: number,
): { staffRoster: Record<string, ResolvedStaffMember[]>; staffEmployment: Record<string, StaffEmployment> } {
  const staffRoster: Record<string, ResolvedStaffMember[]> = {};
  const staffEmployment: Record<string, StaffEmployment> = {};

  for (const club of getClubsByCompetition(competitionId)) {
    const isRealWorldClub = club.dataSource === "REAL_WORLD";
    const raw = staffIdentityByClub[club.id] ?? null;
    const currentIdentity: RawClubStaffIdentityLike | null = raw ? { people: raw.people, assignments: selectCurrentStaffAssignments(raw.assignments, GAME_CURRENT_DATE) } : null;
    const roster = resolveClubStaffRoster(club.id, currentIdentity, isRealWorldClub);
    staffRoster[club.id] = roster;
    const band = clubEconomicBand(club.id);
    for (const member of roster) {
      staffEmployment[member.id] = buildStaffEmploymentEntry(member, band, fallbackYear);
    }
  }

  return { staffRoster, staffEmployment };
}

/**
 * Idempotent fill-gaps: resolves and merges IN any club in
 * `competitionId` that `state.staffRoster` doesn't already have an entry
 * for -- used both for a fresh career (nothing exists yet) and to top up
 * an EXISTING save that predates this milestone's whole-competition
 * resolution (it only ever had its own club's roster). True no-op (same
 * state reference) once every competition club is already present.
 */
export function ensureCareerCompetitionStaffRoster(
  state: CareerState,
  competitionId: string,
  staffIdentityByClub: Record<string, RawClubStaffIdentityLike | null>,
  fallbackYear: number,
): CareerState {
  const missingClubIds = getClubsByCompetition(competitionId)
    .map((c) => c.id)
    .filter((id) => state.staffRoster[id] === undefined);
  if (missingClubIds.length === 0) return state;

  let nextRoster = state.staffRoster;
  let nextEmployment = state.staffEmployment;
  for (const clubId of missingClubIds) {
    const isRealWorldClub = getClub(clubId)?.dataSource === "REAL_WORLD";
    const raw = staffIdentityByClub[clubId] ?? null;
    const currentIdentity: RawClubStaffIdentityLike | null = raw ? { people: raw.people, assignments: selectCurrentStaffAssignments(raw.assignments, GAME_CURRENT_DATE) } : null;
    const roster = resolveClubStaffRoster(clubId, currentIdentity, isRealWorldClub);
    nextRoster = { ...nextRoster, [clubId]: roster };
    const band = clubEconomicBand(clubId);
    for (const member of roster) {
      nextEmployment = { ...nextEmployment, [member.id]: buildStaffEmploymentEntry(member, band, fallbackYear) };
    }
  }
  return { ...state, staffRoster: nextRoster, staffEmployment: nextEmployment };
}

/**
 * Additive migration: an existing SALARIED StaffEmployment entry from
 * before `wageEurPerMonth` existed (or one just resolved by
 * ensureCareerCompetitionStaffRoster's own top-up above, which always
 * sets it -- so this only ever fires for a genuinely pre-this-milestone
 * entry) gets the SAME derived value the old always-recompute display
 * used to show, now made a real sticky fact. Never touches an entry that
 * already has one, and never invents a wage for VOLUNTARY/GOVERNANCE.
 */
export function recalibrateStaffEmploymentWages(state: CareerState): CareerState {
  const entries = Object.entries(state.staffEmployment);
  if (entries.length === 0) return state;
  let changed = false;
  const next: Record<string, StaffEmployment> = {};
  for (const [staffId, employment] of entries) {
    if (employment.employmentType !== "SALARIED" || employment.wageEurPerMonth !== undefined) {
      next[staffId] = employment;
      continue;
    }
    const member = (state.staffRoster[employment.clubId] ?? []).find((m) => m.id === staffId);
    next[staffId] = member ? { ...employment, wageEurPerMonth: estimateStaffMonthlyCostEur(member, clubEconomicBand(employment.clubId)) } : employment;
    changed = true;
  }
  return changed ? { ...state, staffEmployment: next } : state;
}

/** Finds one staff member by id across EVERY club's roster (a bare staffId carries no club information) -- `undefined` if not currently on any club's roster. */
export function findStaffMember(state: CareerState, staffId: string): ResolvedStaffMember | undefined {
  for (const roster of Object.values(state.staffRoster)) {
    const found = roster.find((m) => m.id === staffId);
    if (found) return found;
  }
  return undefined;
}

/** A fresh multi-year staff deal, anchored `years` seasons out -- mirrors transferExecution.ts's own computeNewContractEndDate exactly (same deterministic Swedish 1 June -> 31 May rule). */
export function computeNewStaffContractEndDate(staffId: string, gameDate: string, years: number): string {
  const currentYear = Number(gameDate.slice(0, 4));
  const fallbackYear = currentYear + years;
  return generateContractEndDate(staffId, `${fallbackYear - 1}/${String(fallbackYear).slice(-2)}`, fallbackYear);
}

/** Splices `member` out of `fromClubId`'s roster array and into `toClubId`'s, with `clubId` reassigned. */
function moveStaffRosterMembership(state: CareerState, member: ResolvedStaffMember, fromClubId: string, toClubId: string): CareerState {
  const moved: ResolvedStaffMember = { ...member, clubId: toClubId };
  const fromRoster = (state.staffRoster[fromClubId] ?? []).filter((m) => m.id !== member.id);
  const toRoster = [...(state.staffRoster[toClubId] ?? []), moved];
  return { ...state, staffRoster: { ...state.staffRoster, [fromClubId]: fromRoster, [toClubId]: toRoster } };
}

/** Appends a real, career-tracked club-history entry for the club the staff member is LEAVING, and opens a fresh entry for the club they're joining -- never inventing pre-career backstory (Part 5: "Historik ska inte försvinna" -- this only ever tracks REAL moves that happened during this career). */
function moveStaffClubHistory(state: CareerState, staffId: string, fromClubId: string, toClubId: string, moveDate: string): CareerState {
  const existing = state.staffClubHistory[staffId] ?? ({ staffId, entries: [] } satisfies StaffClubHistory);
  const closedEntries = existing.entries.map((e) => (e.clubId === fromClubId && e.toDate === undefined ? { ...e, toDate: moveDate } : e));
  const hasOpenEntryForOrigin = existing.entries.some((e) => e.clubId === fromClubId && e.toDate === undefined);
  const withClosed = hasOpenEntryForOrigin ? closedEntries : [...closedEntries, { clubId: fromClubId, fromDate: moveDate, toDate: moveDate } satisfies StaffClubHistoryEntry];
  const newEntry: StaffClubHistoryEntry = { clubId: toClubId, fromDate: moveDate };
  return { ...state, staffClubHistory: { ...state.staffClubHistory, [staffId]: { staffId, entries: [...withClosed, newEntry] } } };
}

/**
 * The ONE mutation path that actually moves a staff member between
 * clubs (HM-STAFF-CAREER-1.0 Part 4/5) -- reused by the recruitment
 * execution flow. Roster membership, employment (new club, new wage/
 * contract end date), and club history all move/update together, the
 * same "everything moves in one place" shape transferPlayerPermanently
 * already established for players.
 */
export function recruitStaffMember(state: CareerState, staffId: string, fromClubId: string, toClubId: string, newWageEurPerMonth: number, newContractEndDate: string): CareerState {
  const member = (state.staffRoster[fromClubId] ?? []).find((m) => m.id === staffId);
  if (!member) return state;

  let next = moveStaffRosterMembership(state, member, fromClubId, toClubId);

  const newEmployment: StaffEmployment = { staffId, clubId: toClubId, roles: member.roles, employmentType: "SALARIED", contractEndDate: newContractEndDate, wageEurPerMonth: newWageEurPerMonth };
  next = { ...next, staffEmployment: { ...next.staffEmployment, [staffId]: newEmployment } };

  next = moveStaffClubHistory(next, staffId, fromClubId, toClubId, state.gameDate);

  return next;
}
