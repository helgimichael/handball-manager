// HM-CLUB-PARTNERSHIPS-1.0: the Club Partnership domain -- three
// relationship types between two clubs (AFFILIATED_B_TEAM,
// DEVELOPMENT_PARTNERSHIP, INTERNATIONAL_LOAN_PARTNERSHIP). Mirrors
// scouting.ts's own shape exactly: domain types + CareerState glue in
// one file, reusing every existing system rather than inventing a
// parallel one -- daily-tick-driven multi-day search (same pattern as
// ScoutingAssignment), buildClubNewsEvent/"Klubbstyrelsen" for the
// board's own voice (careerEvents.ts/inboxBridge.ts, unchanged),
// adjustClubCash (economy) for recurring cost, playerAgeAtDate
// (development/developmentIntegration.ts) for age semantics, and the
// existing LOAN system (transferExecution.ts's loanPlayerOut, which has
// no fee parameter at all) for the international-loan-partnership rule.
//
// CORE SEPARATION (Part: "Separera CLUB RELATIONSHIP från PLAYER
// MOVEMENT"): everything in this file either (a) describes what two
// CLUBS are allowed to do with each other (a ClubPartnership row), or
// (b) is a pure ELIGIBILITY predicate a future player-movement/
// development system can consult. Nothing here ever moves a player --
// an actual loan still goes through transferExecution.ts's
// loanPlayerOut unchanged; a B-team/development-partnership "exposure"
// has no movement mechanism at all in 1.0 (see isPartnershipExposureEligible's
// own doc for why that is the honest, minimal integration).
import { getClub, getCompetition } from "../game-data";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { getCareerPlayer } from "./careerWorld";
import { buildClubNewsEvent, type CareerEvent } from "./careerEvents";
import { addDays, isSameOrBefore } from "./dateUtils";
import type { CareerState } from "./types";

export const PARTNERSHIP_TYPES = ["AFFILIATED_B_TEAM", "DEVELOPMENT_PARTNERSHIP", "INTERNATIONAL_LOAN_PARTNERSHIP"] as const;
export type PartnershipType = (typeof PARTNERSHIP_TYPES)[number];

export const PARTNERSHIP_STATUSES = ["ACTIVE", "EXPIRED", "TERMINATED"] as const;
export type PartnershipStatus = (typeof PARTNERSHIP_STATUSES)[number];

/**
 * `clubAId` is always the senior/parent/lending club; `clubBId` is the
 * B-team / development partner / borrowing club. `endDate: null` only
 * ever occurs for a `permanent: true` row (AFFILIATED_B_TEAM) -- every
 * other type always has a real end date. `monthlyCostEur: 0` for a
 * permanent B-team (Part: "ingen vanlig partnership fee") and for an
 * INTERNATIONAL_LOAN_PARTNERSHIP (Part: cost there is the per-loan wage
 * share, a totally separate economic line already owned by LoanRecord --
 * never duplicated here).
 */
export interface ClubPartnership {
  id: string;
  type: PartnershipType;
  clubAId: string;
  clubBId: string;
  status: PartnershipStatus;
  startDate: string;
  endDate: string | null;
  permanent: boolean;
  monthlyCostEur: number;
  /** Recurring-billing bookkeeping (progressPartnershipBilling) -- null until the first billing cycle runs. Irrelevant (stays null) for a 0-cost partnership. */
  lastBilledDate: string | null;
}

/**
 * The board's own multi-day search process (Part: "REQUEST -> BOARD
 * SEARCH -> TIME PASSES -> CANDIDATES RETURN -> MANAGER SELECTS ->
 * AGREEMENT STARTS") -- mirrors ScoutingAssignment's own IN_PROGRESS ->
 * COMPLETED shape and progressDay integration exactly.
 */
export interface PartnershipSearchAssignment {
  id: string;
  clubId: string;
  startDate: string;
  endDate: string;
  status: "IN_PROGRESS" | "COMPLETED";
  /** Populated only once COMPLETED -- the board's own short, explainable shortlist (never a random single pick). Empty while IN_PROGRESS. */
  candidateClubIds: string[];
}

// ---------------------------------------------------------------------------
// Tuning constants -- deliberately small/simple (Part: "Bygg inte ett
// stort hidden partnership-rating-system i 1.0").
// ---------------------------------------------------------------------------
const SEARCH_DURATION_DAYS = 45; // ~6-7 weeks -- "rimligen veckor/månader"
const CANDIDATE_COUNT = 3;
const BILLING_INTERVAL_DAYS = 30;

// ---------------------------------------------------------------------------
// The five canonical, permanent AFFILIATED_B_TEAM relations.
// ---------------------------------------------------------------------------
export const PERMANENT_B_TEAM_PAIRS: readonly { clubAId: string; clubBId: string }[] = [
  { clubAId: "se_club_hammarby_if_hf", clubBId: "se_club_hk_cliff" },
  { clubAId: "se_club_ik_savehof", clubBId: "se_club_hk_s_hof" },
  { clubAId: "se_club_alingsas_hk", clubBId: "se_club_hp_alingsas" },
  { clubAId: "se_club_ifk_kristianstad", clubBId: "se_club_if_kristianstad" },
  { clubAId: "se_club_onnereds_hk", clubBId: "se_club_hk_onnerediterna" },
];

const PERMANENT_B_TEAM_CLUB_IDS: ReadonlySet<string> = new Set(PERMANENT_B_TEAM_PAIRS.map((p) => p.clubBId));

/** True for one of the five canonical B-team clubs -- these can NEVER be offered as a DEVELOPMENT_PARTNERSHIP candidate to any other club (Part: "kan inte erbjudas till någon annan klubb"), permanently, regardless of any ClubPartnership row's own state. */
export function isPermanentBTeamClub(clubId: string): boolean {
  return PERMANENT_B_TEAM_CLUB_IDS.has(clubId);
}

/** The senior club a permanent B-team club belongs to, or `undefined` if `clubId` isn't one. */
export function getPermanentBTeamParentClubId(clubId: string): string | undefined {
  return PERMANENT_B_TEAM_PAIRS.find((p) => p.clubBId === clubId)?.clubAId;
}

function permanentPartnershipId(pair: { clubAId: string; clubBId: string }): string {
  return `bteam-${pair.clubAId}-${pair.clubBId}`;
}

/**
 * Idempotent (Part: "fresh career seeds permanent B-team relationships"
 * AND "existing saves migreras") -- only ever ADDS a missing permanent
 * row, never touches/duplicates one that already exists. Safe to call on
 * every career creation and every load.
 */
export function seedPermanentBTeamPartnerships(state: CareerState, date: string): CareerState {
  const existingIds = new Set(Object.values(state.clubPartnerships).map((p) => p.id));
  const missing = PERMANENT_B_TEAM_PAIRS.filter((p) => !existingIds.has(permanentPartnershipId(p)));
  if (missing.length === 0) return state;

  const next: Record<string, ClubPartnership> = { ...state.clubPartnerships };
  for (const pair of missing) {
    const id = permanentPartnershipId(pair);
    next[id] = {
      id,
      type: "AFFILIATED_B_TEAM",
      clubAId: pair.clubAId,
      clubBId: pair.clubBId,
      status: "ACTIVE",
      startDate: date,
      endDate: null,
      permanent: true,
      monthlyCostEur: 0,
      lastBilledDate: null,
    };
  }
  return { ...state, clubPartnerships: next };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getClubPartnerships(state: CareerState, clubId: string): ClubPartnership[] {
  return Object.values(state.clubPartnerships).filter((p) => p.clubAId === clubId || p.clubBId === clubId);
}

/** Every club currently tied up as SOMEONE's exclusive partner -- a permanent B-team club (always) or the `clubBId` of any ACTIVE DEVELOPMENT_PARTNERSHIP (Part: "En Division 1-klubb får endast ha ETT aktivt development partnership"). */
export function isClubExclusivelyPartnered(state: CareerState, clubId: string): boolean {
  if (isPermanentBTeamClub(clubId)) return true;
  return Object.values(state.clubPartnerships).some((p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE" && p.clubBId === clubId);
}

// ---------------------------------------------------------------------------
// Board search lifecycle
// ---------------------------------------------------------------------------

export interface RequestPartnershipSearchResult {
  ok: boolean;
  errors: string[];
  assignment?: PartnershipSearchAssignment;
}

export function canRequestPartnershipSearch(state: CareerState, clubId: string): string[] {
  const errors: string[] = [];
  const hasActiveDevelopmentPartnership = Object.values(state.clubPartnerships).some(
    (p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE" && p.clubAId === clubId,
  );
  if (hasActiveDevelopmentPartnership) errors.push("Klubben har redan ett aktivt samarbete.");
  const hasSearchInProgress = Object.values(state.partnershipSearches).some((s) => s.clubId === clubId && s.status === "IN_PROGRESS");
  if (hasSearchInProgress) errors.push("En sökning efter samarbetsklubb pågår redan.");
  return errors;
}

function nextPartnershipSearchId(state: CareerState, clubId: string, date: string): string {
  return `pship-search-${clubId}-${date}-${Object.keys(state.partnershipSearches).length}`;
}

/** Part: "REQUEST -> BOARD SEARCH -> TIME PASSES" -- creates the assignment; candidates are resolved later by progressPartnershipSearches, never at request time (the search genuinely takes career time). */
export function requestPartnershipSearch(state: CareerState, clubId: string, date: string): RequestPartnershipSearchResult {
  const errors = canRequestPartnershipSearch(state, clubId);
  if (errors.length > 0) return { ok: false, errors };

  const assignment: PartnershipSearchAssignment = {
    id: nextPartnershipSearchId(state, clubId, date),
    clubId,
    startDate: date,
    endDate: addDays(date, SEARCH_DURATION_DAYS),
    status: "IN_PROGRESS",
    candidateClubIds: [],
  };
  return { ok: true, errors: [], assignment };
}

/**
 * Part: "Använd enkla befintliga world facts... tillgänglighet,
 * competition level, exclusivity" -- deterministic, explainable, no
 * hidden rating system. Pool: every Division 1 Norra/Södra club, minus
 * the permanent B-teams (never available) and any club already
 * exclusively partnered (Part: exclusivity). Ranked by squad size
 * (a real, already-known world fact -- bigger recorded squad reads as
 * "more available capacity") descending, clubId ascending as a stable
 * tiebreak, capped at CANDIDATE_COUNT.
 */
export function selectCandidateClubs(state: CareerState, requestingClubId: string): string[] {
  const div1ClubIds = Object.keys(state.worldSquads).filter((id) => {
    const club = getClub(id);
    return club && (club.competitionId === "se_division1_norra" || club.competitionId === "se_division1_sodra");
  });

  const eligible = div1ClubIds.filter((id) => id !== requestingClubId && !isClubExclusivelyPartnered(state, id));

  return eligible
    .map((id) => ({ id, squadSize: state.worldSquads[id]?.length ?? 0 }))
    .sort((a, b) => (b.squadSize !== a.squadSize ? b.squadSize - a.squadSize : a.id.localeCompare(b.id)))
    .slice(0, CANDIDATE_COUNT)
    .map((c) => c.id);
}

/** Called from dailyTick.ts, mirrors progressScoutingAssignments exactly. */
export function progressPartnershipSearches(state: CareerState, date: string): { state: CareerState; completed: PartnershipSearchAssignment[] } {
  const inProgress = Object.values(state.partnershipSearches).filter((s) => s.status === "IN_PROGRESS" && isSameOrBefore(s.endDate, date));
  if (inProgress.length === 0) return { state, completed: [] };

  let next = state;
  const completed: PartnershipSearchAssignment[] = [];
  for (const search of inProgress) {
    const candidateClubIds = selectCandidateClubs(next, search.clubId);
    const resolved: PartnershipSearchAssignment = { ...search, status: "COMPLETED", candidateClubIds };
    next = { ...next, partnershipSearches: { ...next.partnershipSearches, [search.id]: resolved } };
    completed.push(resolved);
  }
  return { state: next, completed };
}

export function buildPartnershipCandidatesReadyEvent(searchId: string, clubId: string, date: string): CareerEvent {
  return buildClubNewsEvent(
    `partnership-candidates-${searchId}`,
    date,
    "Styrelsen har hittat samarbetsklubbar",
    "Sökningen efter en samarbetsklubb är klar -- styrelsen föreslår ett fåtal tillgängliga alternativ.",
  );
}

// ---------------------------------------------------------------------------
// Development partnership: start / renew / terminate / expire / bill
// ---------------------------------------------------------------------------

export interface StartDevelopmentPartnershipResult {
  ok: boolean;
  errors: string[];
  partnership?: ClubPartnership;
}

function nextPartnershipId(state: CareerState, clubAId: string, clubBId: string, date: string): string {
  return `pship-${clubAId}-${clubBId}-${date}-${Object.keys(state.clubPartnerships).length}`;
}

/**
 * Part: "MANAGER SELECTS -> AGREEMENT STARTS". `chosenClubId` must be
 * one of the search's OWN returned candidates -- never an arbitrary
 * club, so the board-search step can never be bypassed. `monthlyCostEur`
 * is manager/caller-supplied (Part: "Hårdkoda inte ekonomiska belopp
 * direkt i UI" -- the UI reads/writes this value, never a literal).
 */
export function startDevelopmentPartnership(
  state: CareerState,
  searchId: string,
  chosenClubId: string,
  monthlyCostEur: number,
  durationMonths: number,
  date: string,
): StartDevelopmentPartnershipResult {
  const search = state.partnershipSearches[searchId];
  if (!search) return { ok: false, errors: ["Sökningen hittades inte."] };
  if (search.status !== "COMPLETED") return { ok: false, errors: ["Sökningen är inte klar än."] };
  if (!search.candidateClubIds.includes(chosenClubId)) return { ok: false, errors: ["Klubben är inte en av de föreslagna kandidaterna."] };
  if (isClubExclusivelyPartnered(state, chosenClubId)) return { ok: false, errors: ["Klubben är redan exklusivt bunden till ett annat samarbete."] };
  if (monthlyCostEur < 0) return { ok: false, errors: ["Kostnaden kan inte vara negativ."] };
  if (durationMonths < 1) return { ok: false, errors: ["Avtalslängden måste vara minst en månad."] };

  const partnership: ClubPartnership = {
    id: nextPartnershipId(state, search.clubId, chosenClubId, date),
    type: "DEVELOPMENT_PARTNERSHIP",
    clubAId: search.clubId,
    clubBId: chosenClubId,
    status: "ACTIVE",
    startDate: date,
    endDate: addMonths(date, durationMonths),
    permanent: false,
    monthlyCostEur,
    lastBilledDate: null,
  };
  return { ok: true, errors: [], partnership };
}

function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Manager-initiated early end -- never available for a `permanent` row (Part: "kan inte sägas upp"). */
export function terminatePartnership(state: CareerState, partnershipId: string, date: string): CareerState {
  const partnership = state.clubPartnerships[partnershipId];
  if (!partnership || partnership.permanent || partnership.status !== "ACTIVE") return state;
  return {
    ...state,
    clubPartnerships: { ...state.clubPartnerships, [partnershipId]: { ...partnership, status: "TERMINATED", endDate: date } },
  };
}

/** Simple 1.0 renewal: extends `endDate` by `additionalMonths` from its own current end date. Never available for a permanent or already-inactive row. */
export function renewPartnership(state: CareerState, partnershipId: string, additionalMonths: number): CareerState {
  const partnership = state.clubPartnerships[partnershipId];
  if (!partnership || partnership.permanent || partnership.status !== "ACTIVE" || !partnership.endDate || additionalMonths < 1) return state;
  return {
    ...state,
    clubPartnerships: { ...state.clubPartnerships, [partnershipId]: { ...partnership, endDate: addMonths(partnership.endDate, additionalMonths) } },
  };
}

/** Called from dailyTick.ts -- flips any ACTIVE, non-permanent partnership whose endDate has passed to EXPIRED, freeing up exclusivity. */
export function progressPartnershipExpiry(state: CareerState, date: string): { state: CareerState; expired: ClubPartnership[] } {
  const due = Object.values(state.clubPartnerships).filter((p) => !p.permanent && p.status === "ACTIVE" && p.endDate !== null && isSameOrBefore(p.endDate, date));
  if (due.length === 0) return { state, expired: [] };

  let next = state;
  const expired: ClubPartnership[] = [];
  for (const partnership of due) {
    const updated: ClubPartnership = { ...partnership, status: "EXPIRED" };
    next = { ...next, clubPartnerships: { ...next.clubPartnerships, [partnership.id]: updated } };
    expired.push(updated);
  }
  return { state: next, expired };
}

export function buildPartnershipExpiredEvent(partnershipId: string, date: string): CareerEvent {
  return buildClubNewsEvent(`partnership-expired-${partnershipId}`, date, "Samarbetsavtal har löpt ut", "Ett samarbetsavtal med en partnerklubb har löpt ut.");
}

/**
 * Called from dailyTick.ts -- deducts `monthlyCostEur` from the paying
 * club's (`clubAId`'s) cash every BILLING_INTERVAL_DAYS, via the
 * existing, unmodified adjustClubCash (Part: "påverka club economy via
 * befintligt ekonomisystem"). A club with no ClubEconomyBaseline yet
 * (adjustClubCash's own existing no-op) is simply skipped -- never
 * invents one. A 0-cost partnership (permanent B-team) is never billed.
 */
export function progressPartnershipBilling(state: CareerState, date: string, adjustClubCash: (state: CareerState, clubId: string, deltaEur: number) => CareerState): CareerState {
  let next = state;
  for (const partnership of Object.values(next.clubPartnerships)) {
    if (partnership.status !== "ACTIVE" || partnership.monthlyCostEur <= 0) continue;
    const sinceDate = partnership.lastBilledDate ?? partnership.startDate;
    const dueDate = addDays(sinceDate, BILLING_INTERVAL_DAYS);
    if (!isSameOrBefore(dueDate, date)) continue;
    next = adjustClubCash(next, partnership.clubAId, -partnership.monthlyCostEur);
    next = { ...next, clubPartnerships: { ...next.clubPartnerships, [partnership.id]: { ...next.clubPartnerships[partnership.id], lastBilledDate: date } } };
  }
  return next;
}

// ---------------------------------------------------------------------------
// Player eligibility (Part: "Separera CLUB RELATIONSHIP från PLAYER
// MOVEMENT" -- pure predicates only, nothing here moves anyone)
// ---------------------------------------------------------------------------

const B_TEAM_EXPOSURE_MAX_AGE = 19;

/**
 * Part: "Spelare... 19 år eller yngre ska kunna få spelmöjlighet genom
 * B-laget... utan att permanent lämna A-klubben" / development-
 * partnership's own identical age rule. Checks: `clubBId` is a real
 * partner of the player's OWN current club (permanent B-team or an
 * ACTIVE DEVELOPMENT_PARTNERSHIP), the player is still owned by that
 * parent club (canonical ownership never implied to move), and the
 * player is 19 or younger AS OF `state.gameDate` (same age/date
 * semantics as the rest of the career system -- playerAgeAtDate).
 *
 * THIS FUNCTION NEVER MOVES A PLAYER OR GENERATES DEVELOPMENT STIMULUS.
 * Division 1 has no real match simulation yet (Part: "simulerar ännu
 * inga riktiga matcher... Skapa inte fejkade Division 1-matchresultat"),
 * so the honest, minimal integration in 1.0 is this single eligibility
 * gate -- a future Division 1 simulation or manual match-exposure
 * action can call it before crediting any development stimulus; nothing
 * does yet, and nothing here fabricates one.
 */
export function isPartnershipExposureEligible(state: CareerState, playerId: string, clubBId: string): { eligible: boolean; reason?: string } {
  const player = getCareerPlayer(state, playerId);
  if (!player) return { eligible: false, reason: "Spelaren hittades inte." };

  const parentClubId = player.clubId;
  const isPermanentLink = PERMANENT_B_TEAM_PAIRS.some((p) => p.clubAId === parentClubId && p.clubBId === clubBId);
  const isDevelopmentLink = Object.values(state.clubPartnerships).some(
    (p) => p.type === "DEVELOPMENT_PARTNERSHIP" && p.status === "ACTIVE" && p.clubAId === parentClubId && p.clubBId === clubBId,
  );
  if (!isPermanentLink && !isDevelopmentLink) return { eligible: false, reason: "Ingen aktiv partnerskapsrelation mellan spelarens klubb och denna klubb." };

  const age = playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate);
  if (age === null) return { eligible: false, reason: "Spelarens ålder är okänd." };
  if (age > B_TEAM_EXPOSURE_MAX_AGE) return { eligible: false, reason: `Spelaren är ${age} år -- gränsen för B-lag/samarbetsklubb-spel är ${B_TEAM_EXPOSURE_MAX_AGE} år.` };

  return { eligible: true };
}

// ---------------------------------------------------------------------------
// International loan partnership (Part: "Bygg domänen nu så den är
// redo för World Pool/internationella klubbar senare" -- rule +
// creation function only; no instance is ever seeded for 2026/27, and
// no UI calls this yet, since no real international partner club exists
// in canonical data today).
// ---------------------------------------------------------------------------

function nationOf(clubId: string): string | undefined {
  const club = getClub(clubId);
  if (!club) return undefined;
  return getCompetition(club.competitionId)?.nation;
}

/** Part: "klubbarna måste ligga i olika länder... ingen U19-gräns". Pure club-level rule -- no player involved. */
export function canFormInternationalLoanPartnership(clubAId: string, clubBId: string): { ok: boolean; reason?: string } {
  const nationA = nationOf(clubAId);
  const nationB = nationOf(clubBId);
  if (!nationA || !nationB) return { ok: false, reason: "Okänd klubb." };
  if (nationA === nationB) return { ok: false, reason: "Klubbarna måste ligga i olika länder för ett internationellt låneavtal." };
  return { ok: true };
}

export function createInternationalLoanPartnership(state: CareerState, clubAId: string, clubBId: string, date: string, endDate: string): { ok: boolean; errors: string[]; partnership?: ClubPartnership } {
  const check = canFormInternationalLoanPartnership(clubAId, clubBId);
  if (!check.ok) return { ok: false, errors: [check.reason!] };

  const partnership: ClubPartnership = {
    id: nextPartnershipId(state, clubAId, clubBId, date),
    type: "INTERNATIONAL_LOAN_PARTNERSHIP",
    clubAId,
    clubBId,
    status: "ACTIVE",
    startDate: date,
    endDate,
    permanent: false,
    // Part: "loan fee = 0 för lån mellan partnerklubbarna" -- the
    // partnership ROW itself carries no fee at all (loanPlayerOut,
    // transferExecution.ts, has no fee parameter to begin with; a
    // partnership loan reuses it completely unmodified). This 0 is the
    // partnership's own recurring cost line (mirrors the permanent
    // B-team's own "ingen vanlig partnership fee"), NOT the per-loan
    // wageShareBorrowingPct -- that stays whatever the caller of
    // loanPlayerOut supplies, never forced to 0 by this module (Part:
    // "salary contribution är separat och ska inte automatiskt bli 0").
    monthlyCostEur: 0,
    lastBilledDate: null,
  };
  return { ok: true, errors: [], partnership };
}
