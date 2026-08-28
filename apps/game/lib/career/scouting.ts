// HM-SCOUTING-1.0: the real scouting loop --
//   ASSIGN SCOUT -> TIME PASSES -> KNOWLEDGE INCREASES -> REPORT -> BETTER MANAGER VIEW
//
// Reuses, never duplicates, three already-real systems:
//  - lib/staff's SCOUT role + PLAYER_JUDGEMENT/POTENTIAL_JUDGEMENT
//    attributes + computeRoleSuitability (the ONE staff-quality model --
//    this module builds no new staff-rating system).
//  - lib/knowledge's playerKnowledge store + setPlayerKnowledgePct (the
//    ONE knowledge write path -- real since HM-DATA-ALLSVENSKAN-1.1B,
//    but with zero callers until this module) and resolvePlayerVisibility
//    (the ONE TRUE STATE -> VIEW resolver; this module never re-derives
//    ability/potential stars itself, only feeds it a knowledgePct).
//  - lib/career/careerEvents.ts's existing buildScoutReportReadyEvent +
//    dailyTick.ts's existing emit/inbox plumbing.
//
// A ScoutingAssignment is deliberately its OWN entity, not a repurposed
// CareerTask -- CareerTask's "SCOUTING" variant was a v0.1 stub (one
// hardcoded demo task against lib/game-data/scouting.ts's fictional
// SCOUTED_PLAYERS array, no scout reference, no persisted report) that
// this module supersedes. CareerTask itself is untouched and still
// genuinely used for OPPONENT_ANALYSIS.
import type { CareerState } from "./types";
import { addDays, daysBetween, isSameOrBefore } from "./dateUtils";
import { BROAD_SCOUT_CYCLE_DAYS, BROAD_SCOUT_MAX_CYCLES, SCOUT_TASK_DURATION_DAYS } from "./careerRhythmConfig";
import { findStaffMember } from "../staff/staffCareerIntegration";
import { clubNation } from "../staff/scoutPool";
import type { ResolvedStaffMember, StaffAttribute } from "../staff/types";
import { getPlayerKnowledgePct, setPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { getCareerPlayer } from "./careerWorld";
import { playerAgeAtDate } from "../development/developmentIntegration";

export type ScoutingAssignmentStatus = "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

/**
 * HM-SCOUTING-1.1: the six supported assignment shapes. PLAYER is the
 * original HM-SCOUTING-1.0 flow, unchanged. The other five are "broad"
 * assignments -- see lib/career/scoutDiscovery.ts for how a broad
 * assignment's scope resolves to a candidate pool and produces
 * ScoutDiscovery rows over multiple cycles instead of one ScoutReport.
 */
export type ScoutAssignmentType = "PLAYER" | "CLUB" | "COMPETITION" | "REGION" | "POSITION" | "AGE_BAND";

export interface ScoutingAssignment {
  id: string;
  scoutStaffId: string;
  /** Defaults to "PLAYER" (see createScoutingAssignment) -- existing saves migrate every pre-1.1 assignment to this same default (saveMigration.ts). */
  assignmentType: ScoutAssignmentType;
  /** PLAYER only. Kept required (never null) for full backward compatibility with every existing HM-SCOUTING-1.0 reader -- "" for every other assignmentType. */
  targetPlayerId: string;
  /** PLAYER and CLUB only -- "" otherwise. */
  targetClubId: string;
  /** COMPETITION only -- "" otherwise. */
  targetCompetitionId: string;
  /** REGION only -- a Competition.nation code, "" otherwise. */
  targetNation: string;
  /** POSITION only -- a HandballPosition, "" otherwise. */
  targetPosition: string;
  /** AGE_BAND only -- inclusive max age (e.g. 21 for "U21"), null otherwise. */
  targetMaxAgeYears: number | null;
  /** For PLAYER: the assignment's own start date. For a broad assignment: the CURRENT cycle's start date -- advances each cycle. */
  startDate: string;
  /** For PLAYER: fixed deterministically at creation time from the scout's own suitability -- never rerolled or recomputed afterward. For a broad assignment: the CURRENT cycle's completion date -- advances each cycle until maxCycles is reached. */
  endDate: string;
  status: ScoutingAssignmentStatus;
  /** PLAYER only -- set once the assignment completes. Always null for a broad assignment (see reportId's sibling concept, ScoutDiscovery, in scoutDiscovery.ts). */
  reportId: string | null;
  /** Broad assignments only -- how many discovery cycles have completed so far. Always 0 for PLAYER (irrelevant -- PLAYER has no cycles). */
  cyclesCompleted: number;
  /** Broad assignments only -- the cycle count at which this assignment auto-completes. Always 1 for PLAYER. */
  maxCycles: number;
  /** Broad assignments only -- every playerId already discovered by THIS assignment, so a later cycle never re-discovers the same player (Part: "no duplicate discoveries"). Always empty for PLAYER. */
  discoveredPlayerIds: string[];
}

export interface ScoutReport {
  id: string;
  assignmentId: string;
  scoutStaffId: string;
  targetPlayerId: string;
  createdDate: string;
  /**
   * The manager's knowledge of this player at the moment THIS report was
   * filed. A later, second report on the same player will have a higher
   * value here -- this is a historical snapshot for the report list,
   * never re-read for the LIVE Player Profile view (that always calls
   * getPlayerKnowledgePct fresh, which only ever rises, never falls).
   */
  knowledgePctAtReport: number;
  /** The assigned scout's own 1-20 suitability (computeRoleSuitability, SCOUT role) at assignment time -- drives the report's displayed confidence, never a second staff-quality model. */
  scoutSuitability: number;
}

export { NEUTRAL_SUITABILITY, weightedSuitability, computeBroadAssignmentSuitability } from "./scoutSuitability";
import { NEUTRAL_SUITABILITY, weightedSuitability, computeBroadAssignmentSuitability } from "./scoutSuitability";
import { runDiscoveryCycle, type ScoutDiscovery } from "./scoutDiscovery";

/** Points of knowledge one completed assignment adds for a NEUTRAL-suitability scout. A weak scout contributes meaningfully less, an elite one meaningfully more (qualityMultiplier below). setPlayerKnowledgePct's own clamp to [0,100] is the natural diminishing-returns ceiling near full knowledge -- no separate curve needed. */
const BASE_KNOWLEDGE_GAIN = 40;

/** Scales BASE_KNOWLEDGE_GAIN by scout suitability (1-20 scale): suitability 1 contributes ~0.64x, suitability 20 contributes 1.4x, the 10.5 neutral midpoint contributes ~1.02x (close to 1.0 by design). */
function qualityMultiplier(suitability1to20: number): number {
  return Math.max(0.6, Math.min(1.4, 0.6 + (suitability1to20 / 20) * 0.8));
}

// ---------------------------------------------------------------------------
// HM-STAFF-SCOUT-POOL-1.0 Part: "Implementera INTE bara 'högst OVR = bäst
// scout'... Relevant specialist rating ska påverka uppdraget" -- an
// ASSIGNMENT-SPECIFIC suitability, not the single static SCOUT role
// suitability every other reader (recruitment listing, OVR display)
// still uses UNCHANGED (computeRoleSuitability(scout,"SCOUT"), still
// PLAYER_JUDGEMENT/POTENTIAL_JUDGEMENT 0.5/0.5 -- see roleAttributeMap.ts,
// not touched by this milestone). This function is used ONLY inside
// scouting.ts's own assignment duration/knowledge-gain calculations; it
// intentionally differs from the general OVR blend by also weighting
// TACTICAL_ASSESSMENT and REGIONAL_KNOWLEDGE/INTERNATIONAL_KNOWLEDGE in
// every case, with GOALKEEPER_COACHING/YOUTH_DEVELOPMENT further
// dominating the goalkeeper/youth-target branches -- see each branch's
// own weights, all summing to 1.0. No existing scouting.test.ts
// assertion depends on an exact numeric value (only relative "elite >
// weak" comparisons), so this is a safe, contained behavior change.
// ---------------------------------------------------------------------------

const YOUTH_TARGET_MAX_AGE = 21;

interface ScoutAssignmentContext {
  targetPosition: string | null;
  targetAgeYears: number | null;
  isInternational: boolean;
}

function resolveAssignmentContext(state: CareerState, targetPlayerId: string, targetClubId: string, scoutClubId: string, asOfDate: string): ScoutAssignmentContext {
  const player = getCareerPlayer(state, targetPlayerId);
  const targetNation = clubNation(targetClubId);
  const scoutNation = clubNation(scoutClubId);
  return {
    targetPosition: player?.position ?? null,
    targetAgeYears: player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, asOfDate) : null,
    isInternational: targetNation !== undefined && scoutNation !== undefined && targetNation !== scoutNation,
  };
}

/**
 * The specialist-aware scout quality actually used for ONE assignment.
 * A GK specialist (high GOALKEEPER_COACHING/GK) genuinely outperforms a
 * higher-OVR generalist when the target is a goalkeeper; a youth
 * specialist (high YOUTH_DEVELOPMENT/YTH) genuinely outperforms one when
 * the target is 21 or younger. REGIONAL_KNOWLEDGE/INTERNATIONAL_KNOWLEDGE
 * contribute based on whether the target club shares the scout's own
 * club's nation (a real, already-canonical world fact -- Competition.nation).
 */
export function computeScoutAssignmentSuitability(scout: ResolvedStaffMember, ctx: ScoutAssignmentContext): number {
  const geographyAttr: StaffAttribute = ctx.isInternational ? "INTERNATIONAL_KNOWLEDGE" : "REGIONAL_KNOWLEDGE";

  if (ctx.targetPosition === "MV") {
    return weightedSuitability(scout, { PLAYER_JUDGEMENT: 0.2, POTENTIAL_JUDGEMENT: 0.15, GOALKEEPER_COACHING: 0.45, TACTICAL_ASSESSMENT: 0.05, [geographyAttr]: 0.15 });
  }
  if (ctx.targetAgeYears !== null && ctx.targetAgeYears <= YOUTH_TARGET_MAX_AGE) {
    return weightedSuitability(scout, { PLAYER_JUDGEMENT: 0.2, POTENTIAL_JUDGEMENT: 0.3, YOUTH_DEVELOPMENT: 0.25, TACTICAL_ASSESSMENT: 0.05, [geographyAttr]: 0.2 });
  }
  return weightedSuitability(scout, { PLAYER_JUDGEMENT: 0.35, POTENTIAL_JUDGEMENT: 0.3, TACTICAL_ASSESSMENT: 0.15, [geographyAttr]: 0.2 });
}

/** Elite scouts finish meaningfully faster than weak ones, bounded to a plausible 5-16 day range -- "hur snabbt knowledge ökar" is partly THIS (assignment length) and partly the gain-per-assignment above. */
function assignmentDurationDays(suitability1to20: number): number {
  const adjustment = (suitability1to20 - NEUTRAL_SUITABILITY) * 0.4;
  return Math.max(5, Math.min(16, Math.round(SCOUT_TASK_DURATION_DAYS - adjustment)));
}

export interface CreateScoutingAssignmentResult {
  ok: boolean;
  state: CareerState;
  assignment: ScoutingAssignment | null;
  errors: string[];
}

/**
 * Creates a new IN_PROGRESS assignment for `targetPlayerId`, assigning
 * `scoutStaffId`. The scout MUST be a real, currently-employed SCOUT-role
 * member of the manager's own club -- never a generated/invented one
 * (Part 1: "Om den egna klubben saknar scout: visa det ärligt. Skapa
 * inte en påhittad scout" -- enforced here as a hard validation, not
 * just a UI convention, so no other call site can accidentally bypass
 * it). The completion date is computed once, from the scout's own
 * suitability, and never rerolled afterward (see computeAssignmentProgressPct).
 */
export function createScoutingAssignment(state: CareerState, scoutStaffId: string, targetPlayerId: string, targetClubId: string, startDate: string): CreateScoutingAssignmentResult {
  const scout = findStaffMember(state, scoutStaffId);
  if (!scout || scout.clubId !== state.playerClubId) {
    return { ok: false, state, assignment: null, errors: ["Scouten hittades inte i din klubb."] };
  }
  if (!scout.roles.includes("SCOUT")) {
    return { ok: false, state, assignment: null, errors: ["Den valda personen är ingen scout."] };
  }
  if (targetClubId === state.playerClubId) {
    return { ok: false, state, assignment: null, errors: ["Du kan inte scouta din egen spelare -- den är redan fullt känd."] };
  }
  const alreadyActive = Object.values(state.scoutingAssignments).some(
    (a) => a.status === "IN_PROGRESS" && a.scoutStaffId === scoutStaffId && a.targetPlayerId === targetPlayerId,
  );
  if (alreadyActive) {
    return { ok: false, state, assignment: null, errors: ["Denna scout bevakar redan spelaren."] };
  }

  const ctx = resolveAssignmentContext(state, targetPlayerId, targetClubId, scout.clubId, startDate);
  const suitability = computeScoutAssignmentSuitability(scout, ctx);
  const durationDays = assignmentDurationDays(suitability);
  const id = `scout-${scoutStaffId}-${targetPlayerId}-${startDate}-${Object.keys(state.scoutingAssignments).length}`;
  const assignment: ScoutingAssignment = {
    id,
    scoutStaffId,
    assignmentType: "PLAYER",
    targetPlayerId,
    targetClubId,
    targetCompetitionId: "",
    targetNation: "",
    targetPosition: "",
    targetMaxAgeYears: null,
    startDate,
    endDate: addDays(startDate, durationDays),
    status: "IN_PROGRESS",
    reportId: null,
    cyclesCompleted: 0,
    maxCycles: 1,
    discoveredPlayerIds: [],
  };
  return {
    ok: true,
    state: { ...state, scoutingAssignments: { ...state.scoutingAssignments, [id]: assignment } },
    assignment,
    errors: [],
  };
}

// ---------------------------------------------------------------------------
// HM-SCOUTING-1.1: broad (CLUB/COMPETITION/REGION/POSITION/AGE_BAND)
// assignments. The manager no longer needs to know a player's name in
// advance -- a scout can be pointed at a club, a competition, a country,
// a position, or an age band, and will surface relevant candidates over
// several discovery cycles (see scoutDiscovery.ts's runDiscoveryCycle,
// called from progressScoutingAssignments below).
// ---------------------------------------------------------------------------

export interface BroadScoutAssignmentScope {
  targetClubId?: string;
  targetCompetitionId?: string;
  targetNation?: string;
  targetPosition?: string;
  targetMaxAgeYears?: number;
}

const VALID_POSITIONS = new Set(["MV", "V9", "V6", "M9", "M6", "H9", "H6"]);
const MIN_AGE_BAND_YEARS = 15;
const MAX_AGE_BAND_YEARS = 40;

interface ScopeLike {
  targetClubId?: string | null;
  targetCompetitionId?: string | null;
  targetNation?: string | null;
  targetPosition?: string | null;
  targetMaxAgeYears?: number | null;
}

function scopeSignature(assignmentType: ScoutAssignmentType, scope: ScopeLike): string {
  return `${assignmentType}:${scope.targetClubId ?? ""}:${scope.targetCompetitionId ?? ""}:${scope.targetNation ?? ""}:${scope.targetPosition ?? ""}:${scope.targetMaxAgeYears ?? ""}`;
}

/**
 * Creates a new broad discovery assignment. Same hard scout-ownership/
 * role validation as createScoutingAssignment (Part 1's "never invent a
 * scout" rule applies identically here), plus scope-specific validation.
 * The first discovery cycle is NOT run here -- it runs on its own
 * schedule via progressScoutingAssignments/dailyTick, exactly like a
 * PLAYER assignment's report only files once the endDate arrives.
 */
export function createBroadScoutingAssignment(
  state: CareerState,
  scoutStaffId: string,
  assignmentType: Exclude<ScoutAssignmentType, "PLAYER">,
  scope: BroadScoutAssignmentScope,
  startDate: string,
): CreateScoutingAssignmentResult {
  const scout = findStaffMember(state, scoutStaffId);
  if (!scout || scout.clubId !== state.playerClubId) {
    return { ok: false, state, assignment: null, errors: ["Scouten hittades inte i din klubb."] };
  }
  if (!scout.roles.includes("SCOUT")) {
    return { ok: false, state, assignment: null, errors: ["Den valda personen är ingen scout."] };
  }

  const errors: string[] = [];
  if (assignmentType === "CLUB") {
    if (!scope.targetClubId) errors.push("Ingen klubb vald.");
    else if (scope.targetClubId === state.playerClubId) errors.push("Du kan inte scouta din egen klubb -- den är redan fullt känd.");
  } else if (assignmentType === "COMPETITION") {
    if (!scope.targetCompetitionId) errors.push("Ingen liga vald.");
    else if (scope.targetCompetitionId === state.competitionId) errors.push("Du kan inte scouta din egen liga -- den är redan fullt känd.");
  } else if (assignmentType === "REGION") {
    if (!scope.targetNation) errors.push("Inget land valt.");
  } else if (assignmentType === "POSITION") {
    if (!scope.targetPosition || !VALID_POSITIONS.has(scope.targetPosition)) errors.push("Ingen giltig position vald.");
  } else if (assignmentType === "AGE_BAND") {
    if (!scope.targetMaxAgeYears || scope.targetMaxAgeYears < MIN_AGE_BAND_YEARS || scope.targetMaxAgeYears > MAX_AGE_BAND_YEARS) {
      errors.push(`Ogiltig åldersgräns (${MIN_AGE_BAND_YEARS}-${MAX_AGE_BAND_YEARS} år).`);
    }
  }
  if (errors.length > 0) {
    return { ok: false, state, assignment: null, errors };
  }

  const signature = scopeSignature(assignmentType, scope);
  const alreadyActive = Object.values(state.scoutingAssignments).some(
    (a) => a.status === "IN_PROGRESS" && a.scoutStaffId === scoutStaffId && scopeSignature(a.assignmentType, a) === signature,
  );
  if (alreadyActive) {
    return { ok: false, state, assignment: null, errors: ["Denna scout har redan ett pågående uppdrag med samma inriktning."] };
  }

  const geographyAttr: StaffAttribute =
    assignmentType === "REGION" || assignmentType === "COMPETITION"
      ? scope.targetNation && scope.targetNation !== clubNation(scout.clubId)
        ? "INTERNATIONAL_KNOWLEDGE"
        : "REGIONAL_KNOWLEDGE"
      : "REGIONAL_KNOWLEDGE";
  const suitability = computeBroadAssignmentSuitability(scout, assignmentType, geographyAttr, scope.targetPosition);
  const cycleDays = broadCycleLengthDays(suitability);
  const id = `broad-${assignmentType}-${scoutStaffId}-${startDate}-${Object.keys(state.scoutingAssignments).length}`;
  const assignment: ScoutingAssignment = {
    id,
    scoutStaffId,
    assignmentType,
    targetPlayerId: "",
    targetClubId: scope.targetClubId ?? "",
    targetCompetitionId: scope.targetCompetitionId ?? "",
    targetNation: scope.targetNation ?? "",
    targetPosition: scope.targetPosition ?? "",
    targetMaxAgeYears: scope.targetMaxAgeYears ?? null,
    startDate,
    endDate: addDays(startDate, cycleDays),
    status: "IN_PROGRESS",
    reportId: null,
    cyclesCompleted: 0,
    maxCycles: BROAD_SCOUT_MAX_CYCLES,
    discoveredPlayerIds: [],
  };
  return {
    ok: true,
    state: { ...state, scoutingAssignments: { ...state.scoutingAssignments, [id]: assignment } },
    assignment,
    errors: [],
  };
}

/** Elite scouts complete a discovery cycle meaningfully faster than weak ones, bounded to a plausible 12-24 day range (broad assignments are deliberately slower than a PLAYER assignment's whole 5-16 day span, per cycle). */
function broadCycleLengthDays(suitability1to20: number): number {
  const adjustment = (suitability1to20 - NEUTRAL_SUITABILITY) * 0.5;
  return Math.max(12, Math.min(24, Math.round(BROAD_SCOUT_CYCLE_DAYS - adjustment)));
}

/** Cancels an IN_PROGRESS assignment -- no report/discoveries are produced for the cycle in flight; already-filed reports/discoveries from earlier cycles are untouched (they already happened). A no-op (never an error) if the assignment is already COMPLETED/CANCELLED or does not exist, matching this codebase's own "idempotent, honest no-op" precedent. */
export function cancelScoutingAssignment(state: CareerState, assignmentId: string): CareerState {
  const assignment = state.scoutingAssignments[assignmentId];
  if (!assignment || assignment.status !== "IN_PROGRESS") return state;
  return {
    ...state,
    scoutingAssignments: { ...state.scoutingAssignments, [assignmentId]: { ...assignment, status: "CANCELLED" } },
  };
}

/** UI-facing 0-100 progress for an assignment -- pure date arithmetic against the fixed start/end dates, deterministic, never stored/advanced incrementally (mirrors careerTasks.ts's own completion-date-driven model, not injury rehab's incremental one -- a scouting assignment's own duration is short and fixed, so date arithmetic alone is sufficient and simpler). */
export function computeAssignmentProgressPct(assignment: ScoutingAssignment, today: string): number {
  if (assignment.status === "COMPLETED") return 100;
  const totalDays = Math.max(1, daysBetween(assignment.startDate, assignment.endDate));
  const elapsedDays = Math.max(0, daysBetween(assignment.startDate, today));
  return Math.max(0, Math.min(100, Math.round((elapsedDays / totalDays) * 100)));
}

export interface DiscoveryCycleResult {
  assignment: ScoutingAssignment;
  discoveries: ScoutDiscovery[];
}

/**
 * Advances every IN_PROGRESS assignment whose endDate has arrived (called
 * once per day from dailyTick.ts, mirroring progressCareerTasks' own
 * "advance by date, return what completed" contract).
 *
 * PLAYER assignments: unchanged HM-SCOUTING-1.0 behavior -- raises the
 * target player's knowledge via lib/knowledge's ONE write path, files a
 * persistent ScoutReport, and marks the assignment COMPLETED. If the
 * assigned scout has since left the club (e.g. sold/fired mid-assignment),
 * the assignment still completes -- using a neutral suitability rather
 * than failing the whole assignment (Part 9's own "null = neutral,
 * never an error" precedent in lib/staff/roleSuitability.ts).
 *
 * Broad (CLUB/COMPETITION/REGION/POSITION/AGE_BAND) assignments (HM-
 * SCOUTING-1.1): delegates to scoutDiscovery.ts's runDiscoveryCycle for
 * ONE cycle, then either advances to the next cycle's start/end dates or,
 * once maxCycles is reached, marks the assignment COMPLETED. If the
 * scout has left, the cycle still runs at neutral suitability, same
 * "never an error" precedent as PLAYER above.
 */
export function progressScoutingAssignments(
  state: CareerState,
  date: string,
): { state: CareerState; completed: ScoutingAssignment[]; discoveryCycles: DiscoveryCycleResult[] } {
  let next = state;
  const completed: ScoutingAssignment[] = [];
  const discoveryCycles: DiscoveryCycleResult[] = [];

  for (const assignment of Object.values(state.scoutingAssignments)) {
    if (assignment.status !== "IN_PROGRESS" || !isSameOrBefore(assignment.endDate, date)) continue;

    if (assignment.assignmentType === "PLAYER") {
      const scout = findStaffMember(next, assignment.scoutStaffId);
      const suitability = scout
        ? computeScoutAssignmentSuitability(scout, resolveAssignmentContext(next, assignment.targetPlayerId, assignment.targetClubId, scout.clubId, date))
        : NEUTRAL_SUITABILITY;
      const currentKnowledge = getPlayerKnowledgePct(next, assignment.targetPlayerId, assignment.targetClubId);
      const gain = BASE_KNOWLEDGE_GAIN * qualityMultiplier(suitability);
      next = setPlayerKnowledgePct(next, assignment.targetPlayerId, currentKnowledge + gain);

      const reportId = `report-${assignment.id}`;
      const report: ScoutReport = {
        id: reportId,
        assignmentId: assignment.id,
        scoutStaffId: assignment.scoutStaffId,
        targetPlayerId: assignment.targetPlayerId,
        createdDate: date,
        knowledgePctAtReport: getPlayerKnowledgePct(next, assignment.targetPlayerId, assignment.targetClubId),
        scoutSuitability: suitability,
      };
      const updatedAssignment: ScoutingAssignment = { ...assignment, status: "COMPLETED", reportId };
      next = {
        ...next,
        scoutingAssignments: { ...next.scoutingAssignments, [assignment.id]: updatedAssignment },
        scoutReports: { ...next.scoutReports, [reportId]: report },
      };
      completed.push(updatedAssignment);
      continue;
    }

    const { state: afterCycle, discoveries } = runDiscoveryCycle(next, assignment, date);
    next = afterCycle;
    const cyclesCompleted = assignment.cyclesCompleted + 1;
    const isFinalCycle = cyclesCompleted >= assignment.maxCycles;
    const scoutForDuration = findStaffMember(next, assignment.scoutStaffId);
    const durationSuitability = scoutForDuration
      ? computeBroadAssignmentSuitability(
          scoutForDuration,
          assignment.assignmentType,
          assignment.targetNation && assignment.targetNation !== clubNation(scoutForDuration.clubId) ? "INTERNATIONAL_KNOWLEDGE" : "REGIONAL_KNOWLEDGE",
          assignment.targetPosition,
        )
      : NEUTRAL_SUITABILITY;
    const nextCycleDays = broadCycleLengthDays(durationSuitability);
    const updatedAssignment: ScoutingAssignment = {
      ...assignment,
      status: isFinalCycle ? "COMPLETED" : "IN_PROGRESS",
      cyclesCompleted,
      startDate: date,
      endDate: isFinalCycle ? date : addDays(date, nextCycleDays),
      discoveredPlayerIds: [...assignment.discoveredPlayerIds, ...discoveries.map((d) => d.playerId)],
    };
    next = { ...next, scoutingAssignments: { ...next.scoutingAssignments, [assignment.id]: updatedAssignment } };
    if (isFinalCycle) completed.push(updatedAssignment);
    discoveryCycles.push({ assignment: updatedAssignment, discoveries });
  }

  return { state: next, completed, discoveryCycles };
}

/** Every report filed for one player, most recent first. */
export function getPlayerScoutReports(state: CareerState, playerId: string): ScoutReport[] {
  return Object.values(state.scoutReports)
    .filter((r) => r.targetPlayerId === playerId)
    .sort((a, b) => (a.createdDate < b.createdDate ? 1 : a.createdDate > b.createdDate ? -1 : 0));
}

/** The manager's own club's SCOUT-role staff -- empty (never invented/generated) if the club genuinely has none (Part 1). */
export function getClubScouts(state: CareerState): ResolvedStaffMember[] {
  return (state.staffRoster[state.playerClubId] ?? []).filter((m) => m.roles.includes("SCOUT"));
}

/** All of the manager's own scouting assignments, most recently started first. */
export function getAllScoutingAssignments(state: CareerState): ScoutingAssignment[] {
  return Object.values(state.scoutingAssignments).sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
}
