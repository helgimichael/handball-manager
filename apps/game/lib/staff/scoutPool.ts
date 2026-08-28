// HM-STAFF-SCOUT-POOL-1.0: the real-profile scout free-agent market.
//
// PROVENANCE RULE (read this before touching anything here): every
// person in SCOUT_POOL_SOURCE (scoutPoolSource.ts) is a REAL, NAMED
// individual. Their name/region is a REAL PERSON / BIOGRAPHICAL IDENTITY
// fact. Every rating (ovr/jca/jpa/yth/tac/net/reg/int/gk) is a FICTIONAL
// GAME INTERPRETATION, explicitly disclosed as such by the source
// document itself -- never a verified claim about the real person's
// actual ability. This module keeps that separation structural, not
// just documentary:
//   - ScoutPoolSourceEntry (this file) = biographical identity + raw
//     source ratings + the source's own eligibility status. Permanent,
//     never mutated by recruitment.
//   - ResolvedStaffMember (built by buildScoutAttributeProfile) = the
//     FICTIONAL GAME PROFILE actually used by gameplay (Scouting 1.0,
//     recruitment, role suitability) -- tagged
//     source: "REAL_PERSON_FICTIONAL_PROFILE" and each mapped attribute
//     tagged origin: "SOURCE_MAPPED_FICTIONAL", so no downstream reader
//     can mistake this for verified real-world evidence.
//
// ATTRIBUTE MAPPING (Part: "Mappa source attributes till canonical
// staff architecture där möjligt"):
//   JCA -> PLAYER_JUDGEMENT      (exact existing canonical attribute)
//   JPA -> POTENTIAL_JUDGEMENT   (exact existing canonical attribute)
//   YTH -> YOUTH_DEVELOPMENT     (closest existing attribute)
//   GK  -> GOALKEEPER_COACHING   (only existing GK-specific attribute)
//   TAC -> TACTICAL_ASSESSMENT   (NEW -- reusing TACTICAL_COACHING would
//          conflate a coach's TEACHING ability with a scout's judgement
//          of tactical fit for any multi-role person)
//   NET -> NETWORK               (NEW -- no existing equivalent)
//   REG -> REGIONAL_KNOWLEDGE    (NEW -- no existing equivalent)
//   INT -> INTERNATIONAL_KNOWLEDGE (NEW -- no existing equivalent)
//   OVR -> NOT stored as an attribute at all -- it is a DERIVED display
//          value (computeRoleSuitability(member, "SCOUT")), never a
//          competing stored truth (Part: "OVR ska helst vara derived/
//          display value"). The raw source OVR stays on
//          ScoutPoolSourceEntry.source.ovr for provenance/recalibration.
// Every attribute NOT covered by the source (coaching/medical/etc.)
// is left at the same NEUTRAL baseline every other GENERATED_PRIOR
// staff attribute uses -- honestly "unknown", never invented.
import { getClub, getCompetition } from "../game-data";
import { getClubBudgets, getClubStaffCostsEurAnnual } from "../economy/clubEconomyIntegration";
import { competitionTierForClub } from "../transfers/transferExecution";
import { evaluateStaffDecision } from "./staffDecision";
import { computeNewStaffContractEndDate, findStaffMember } from "./staffCareerIntegration";
import { SCOUT_POOL_SOURCE } from "./scoutPoolSource";
import { STAFF_ATTRIBUTES, STAFF_ATTRIBUTE_MIN, STAFF_ATTRIBUTE_MAX, type ResolvedStaffMember, type StaffAttribute, type StaffAttributeValue, type StaffEmployment } from "./types";
import type { CareerState } from "../career/types";

export const SOURCE_ELIGIBILITY_STATUSES = ["LIKELY_ELIGIBLE", "CONDITIONAL", "RESEARCH", "IDENTITY_CURRENT_ROLE_CHECK"] as const;
export type SourceEligibilityStatus = (typeof SOURCE_ELIGIBILITY_STATUSES)[number];

export interface ScoutPoolSourceRatings {
  ovr: number;
  jca: number;
  jpa: number;
  yth: number;
  tac: number;
  net: number;
  reg: number;
  int: number;
  gk: number;
}

export interface ScoutPoolSourceEntry {
  index: number;
  personId: string;
  fullName: string;
  region: string;
  tier: string;
  primaryRole: string;
  source: ScoutPoolSourceRatings;
  sourceEligibilityStatus: SourceEligibilityStatus;
}

const NEUTRAL_ATTRIBUTE_VALUE = 10;

/** Builds the FICTIONAL GAME SCOUT PROFILE for one source entry -- see this module's own header for the full mapping table and provenance rule. */
export function buildScoutAttributeProfile(entry: ScoutPoolSourceEntry): Record<StaffAttribute, StaffAttributeValue> {
  const mapped: Partial<Record<StaffAttribute, number>> = {
    PLAYER_JUDGEMENT: entry.source.jca,
    POTENTIAL_JUDGEMENT: entry.source.jpa,
    YOUTH_DEVELOPMENT: entry.source.yth,
    GOALKEEPER_COACHING: entry.source.gk,
    TACTICAL_ASSESSMENT: entry.source.tac,
    NETWORK: entry.source.net,
    REGIONAL_KNOWLEDGE: entry.source.reg,
    INTERNATIONAL_KNOWLEDGE: entry.source.int,
  };
  const attributes = {} as Record<StaffAttribute, StaffAttributeValue>;
  for (const attr of STAFF_ATTRIBUTES) {
    const value = mapped[attr];
    attributes[attr] =
      value !== undefined
        ? { value: Math.max(STAFF_ATTRIBUTE_MIN, Math.min(STAFF_ATTRIBUTE_MAX, value)), origin: "SOURCE_MAPPED_FICTIONAL" }
        : { value: NEUTRAL_ATTRIBUTE_VALUE, origin: "GENERATED_PRIOR" };
  }
  return attributes;
}

/** A sentinel, never a real club -- free-agent scoutMarket entries carry this so ResolvedStaffMember.clubId stays a non-nullable string without ever resolving to a real club via getClub(). */
export const FREE_AGENT_MARKET_CLUB_ID = "scout_free_agent_market";

function buildFreeAgentMember(entry: ScoutPoolSourceEntry): ResolvedStaffMember {
  return {
    id: entry.personId,
    clubId: FREE_AGENT_MARKET_CLUB_ID,
    displayName: entry.fullName,
    roles: ["SCOUT"],
    hmRoles: [],
    employmentType: "SALARIED",
    profile: { personId: entry.personId, attributes: buildScoutAttributeProfile(entry) },
    source: "REAL_PERSON_FICTIONAL_PROFILE",
  };
}

/** True if `fullName` already belongs to some canonical staff person currently on ANY club's roster (Part: "Auditera först om personen redan finns... Skapa aldrig duplicate person entities"). Name-based (case/diacritic-insensitive) since a bare full name is the only identifying fact this source document and real club identity data reliably share. */
function nameAlreadyOnAnyRoster(state: CareerState, fullName: string): boolean {
  const normalized = fullName.trim().toLowerCase();
  for (const roster of Object.values(state.staffRoster)) {
    if (roster.some((m) => m.displayName.trim().toLowerCase() === normalized)) return true;
  }
  return false;
}

/**
 * Idempotent (Part: "Fresh career: seed... deterministiskt. Existing
 * saves: backfill idempotent. Ingen duplicate om personen redan finns.
 * Redan anställd person får aldrig återuppstå som free agent."):
 *  - scoutPoolSource: seeds all 100 entries once, permanent, never
 *    removed/mutated afterward regardless of employment state.
 *  - scoutMarket: seeds ALL 100 entries (HM-STAFF-SCOUT-POOL-1.0A:
 *    the source document's own "2026 status" -- Likely eligible/
 *    Conditional/Research/Identity-current-role-check -- is RESEARCH /
 *    PROVENANCE METADATA only, preserved on ScoutPoolSourceEntry for
 *    audit, and must never gate career availability. The only two
 *    reasons a candidate is skipped here are real, in-career facts:
 *    already employed somewhere in THIS career (findStaffMember), or
 *    already a canonical staff person under a different id
 *    (nameAlreadyOnAnyRoster -- never a duplicate person entity).
 */
export function seedScoutPool(state: CareerState): CareerState {
  let nextSource = state.scoutPoolSource;
  let sourceChanged = false;
  for (const entry of SCOUT_POOL_SOURCE) {
    if (nextSource[entry.personId] !== undefined) continue;
    nextSource = { ...nextSource, [entry.personId]: entry };
    sourceChanged = true;
  }

  let nextMarket = state.scoutMarket;
  let marketChanged = false;
  for (const entry of SCOUT_POOL_SOURCE) {
    if (nextMarket[entry.personId] !== undefined) continue;
    if (findStaffMember(state, entry.personId) !== undefined) continue; // already employed (e.g. re-migration after signing)
    if (nameAlreadyOnAnyRoster(state, entry.fullName)) continue; // already a canonical person under a different id -- never a duplicate
    nextMarket = { ...nextMarket, [entry.personId]: buildFreeAgentMember(entry) };
    marketChanged = true;
  }

  if (!sourceChanged && !marketChanged) return state;
  return { ...state, scoutPoolSource: sourceChanged ? nextSource : state.scoutPoolSource, scoutMarket: marketChanged ? nextMarket : state.scoutMarket };
}

/**
 * Reporting-only helper (Part: "Report any such collisions explicitly")
 * -- every source candidate whose name already matches a canonical
 * staff person on some club's roster, so a caller (report/QA script)
 * can list them without re-deriving seedScoutPool's own skip logic.
 * Never mutates state.
 */
export function findCanonicalCollisions(state: CareerState): ScoutPoolSourceEntry[] {
  return SCOUT_POOL_SOURCE.filter((entry) => nameAlreadyOnAnyRoster(state, entry.fullName));
}

/** Every currently-available free-agent scout, sorted by name for a stable UI order. */
export function getScoutMarket(state: CareerState): ResolvedStaffMember[] {
  return Object.values(state.scoutMarket).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function getScoutPoolSourceEntry(state: CareerState, personId: string): ScoutPoolSourceEntry | undefined {
  return state.scoutPoolSource[personId];
}

export interface SignFreeAgentScoutResult {
  outcome: "COMPLETED" | "REJECTED_BY_CANDIDATE" | "BLOCKED_UNAFFORDABLE" | "NOT_AVAILABLE";
  reason: string;
}

/**
 * Signs a free agent from scoutMarket to `toClubId` -- the free-agent
 * twin of staffRecruitment.ts's offerStaffContract, reusing the exact
 * same affordability check and evaluateStaffDecision candidate-decision
 * rule (Part: no parallel recruitment system). The candidate has no
 * current club/wage to compare against (a genuinely unemployed free
 * agent), so currentWageEurPerMonth is 0 and currentClubTier is
 * undefined -- evaluateStaffDecision already treats both honestly.
 */
export function signFreeAgentScout(state: CareerState, personId: string, toClubId: string, offeredWageEurPerMonth: number, contractYears: number | undefined, gameDate: string): { state: CareerState; result: SignFreeAgentScoutResult } {
  const candidate = state.scoutMarket[personId];
  if (!candidate) {
    return { state, result: { outcome: "NOT_AVAILABLE", reason: "Kandidaten är inte tillgänglig på marknaden." } };
  }

  const budgets = getClubBudgets(state, toClubId);
  if (!budgets) {
    return { state, result: { outcome: "BLOCKED_UNAFFORDABLE", reason: "Ingen ekonomidata finns för klubben." } };
  }
  const projectedAnnualStaffCosts = getClubStaffCostsEurAnnual(state, toClubId) + offeredWageEurPerMonth * 12;
  if (projectedAnnualStaffCosts > budgets.staffBudgetEur) {
    return {
      state,
      result: {
        outcome: "BLOCKED_UNAFFORDABLE",
        reason: `Ny total personalkostnad (${Math.round(projectedAnnualStaffCosts)} €/år) skulle överstiga personalbudgeten (${Math.round(budgets.staffBudgetEur)} €/år).`,
      },
    };
  }

  const decision = evaluateStaffDecision({
    staffId: personId,
    currentWageEurPerMonth: 0,
    offeredWageEurPerMonth,
    currentClubTier: undefined,
    newClubTier: competitionTierForClub(toClubId),
    currentClubPressure: "NONE",
  });
  if (!decision.accept) {
    return { state, result: { outcome: "REJECTED_BY_CANDIDATE", reason: decision.reason } };
  }

  const contractEndDate = computeNewStaffContractEndDate(personId, gameDate, contractYears ?? 2);
  const signed: ResolvedStaffMember = { ...candidate, clubId: toClubId };
  const employment: StaffEmployment = { staffId: personId, clubId: toClubId, roles: signed.roles, employmentType: "SALARIED", contractEndDate, wageEurPerMonth: offeredWageEurPerMonth };

  const remainingMarket = Object.fromEntries(Object.entries(state.scoutMarket).filter(([id]) => id !== personId));
  const next: CareerState = {
    ...state,
    scoutMarket: remainingMarket,
    staffRoster: { ...state.staffRoster, [toClubId]: [...(state.staffRoster[toClubId] ?? []), signed] },
    staffEmployment: { ...state.staffEmployment, [personId]: employment },
  };
  return { state: next, result: { outcome: "COMPLETED", reason: decision.reason } };
}

/** True only for a genuinely recruitable free agent (Part: "unverified candidates unavailable" -- enforced structurally: a non-LIKELY_ELIGIBLE person is never in scoutMarket at all, so this is simply "does scoutMarket contain them"). */
export function isFreeAgentScoutAvailable(state: CareerState, personId: string): boolean {
  return state.scoutMarket[personId] !== undefined;
}

/** club/nation lookup reused by scouting.ts's assignment-suitability geography hook -- kept here so both modules share one definition of "what nation is this club in". */
export function clubNation(clubId: string): string | undefined {
  const club = getClub(clubId);
  return club ? getCompetition(club.competitionId)?.nation : undefined;
}
