// HM-SCOUTING-1.1: the discovery engine behind broad (CLUB/COMPETITION/
// REGION/POSITION/AGE_BAND) scouting assignments -- "the manager should
// not need to know the player's name in advance".
//
// One discovery CYCLE (see scouting.ts's own progressScoutingAssignments,
// the only caller):
//   1. Build the candidate pool for the assignment's scope (never full
//      random selection -- always game-world facts: club/competition/
//      country/position/age).
//   2. Exclude players this SAME assignment has already discovered
//      (Part: "no duplicate discoveries").
//   3. Rank candidates deterministically (seeded, not Math.random()) --
//      ability level (internal only, never exposed raw), geography
//      alignment, and a seeded tiebreak jitter.
//   4. Take a BOUNDED top slice -- bounded by the scout's own NETWORK
//      attribute plus how well the manager already knows this
//      competition/country (Part: "fler spelare upptäcks" as knowledge
//      grows -- this is the one mechanism that makes that true).
//   5. File a ScoutDiscovery per selected player, and grow player/club/
//      competition/country knowledge a small, bounded amount via
//      lib/knowledge's existing write paths -- never a parallel
//      knowledge system.
//
// Deliberately NEVER touches raw CA/PA in any returned/persisted
// discovery data -- getCareerPlayerRating is read here purely as an
// internal ranking signal (which candidates are worth surfacing this
// cycle), exactly the same "engine sees truth, UI sees knowledge-gated
// view" split scouting.ts and lib/knowledge/* already establish.
import type { CareerState } from "./types";
import type { ScoutingAssignment } from "./scouting";
import { computeBroadAssignmentSuitability, NEUTRAL_SUITABILITY } from "./scoutSuitability";
import { findStaffMember } from "../staff/staffCareerIntegration";
import { clubNation } from "../staff/scoutPool";
import { getCareerClubSquad, getExternalCandidateClubs } from "./careerWorld";
import { getCareerPlayerRating } from "./careerRatingNormalization";
import { getClub, getClubsByCompetition, getCompetition } from "../game-data";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { seededOffset } from "../rating/generation/deterministicVariation";
import {
  getClubKnowledgePct,
  getCompetitionKnowledgePct,
  getCountryKnowledgePct,
  getPlayerKnowledgePct,
  setClubKnowledgePct,
  setCompetitionKnowledgePct,
  setCountryKnowledgePct,
  setPlayerKnowledgePct,
} from "../knowledge/knowledgeIntegration";
import { knowledgeTier } from "../knowledge/types";
import type { ResolvedStaffMember } from "../staff/types";

export interface ScoutDiscovery {
  id: string;
  assignmentId: string;
  scoutStaffId: string;
  assignmentType: ScoutingAssignment["assignmentType"];
  playerId: string;
  clubId: string;
  discoveredDate: string;
  cycleIndex: number;
  /** Deterministic Swedish explanation strings -- "explainable", never "the AI decided". */
  reasons: string[];
}

/** Points of knowledge a single discovery adds for the discovered player -- deliberately smaller than a full PLAYER assignment's BASE_KNOWLEDGE_GAIN (40): a discovery means "now on the radar", not "deeply scouted". */
const DISCOVERY_PLAYER_KNOWLEDGE_GAIN = 18;
/** Smaller still -- the discovered player's club becomes marginally more familiar too. */
const DISCOVERY_CLUB_KNOWLEDGE_GAIN = 6;
/** Flat per-cycle growth for the assignment's own scope entity (club/competition/country), even before accounting for any individual discoveries -- this is what makes "skickar scout till Bundesliga -> Germany/Bundesliga knowledge ökar över tid" true independent of exactly how many players were found this cycle. */
const SCOPE_KNOWLEDGE_GAIN_PER_CYCLE = 10;

interface CandidatePlayer {
  playerId: string;
  clubId: string;
  position: string;
  ageYears: number | null;
  nation: string | undefined;
  competitionId: string;
}

function allExternalCandidates(state: CareerState, asOfDate: string): CandidatePlayer[] {
  const clubs = getExternalCandidateClubs(state);
  const rows: CandidatePlayer[] = [];
  for (const club of clubs) {
    const squad = getCareerClubSquad(state, club.id);
    for (const p of squad) {
      rows.push({
        playerId: p.id,
        clubId: club.id,
        position: p.position,
        ageYears: playerAgeAtDate(p.dateOfBirth, p.birthYear ?? undefined, asOfDate),
        nation: clubNation(club.id),
        competitionId: club.competitionId,
      });
    }
  }
  return rows;
}

function candidatePoolFor(state: CareerState, assignment: ScoutingAssignment, asOfDate: string): CandidatePlayer[] {
  switch (assignment.assignmentType) {
    case "CLUB": {
      const club = getClub(assignment.targetClubId);
      if (!club) return [];
      return getCareerClubSquad(state, assignment.targetClubId).map((p) => ({
        playerId: p.id,
        clubId: assignment.targetClubId,
        position: p.position,
        ageYears: playerAgeAtDate(p.dateOfBirth, p.birthYear ?? undefined, asOfDate),
        nation: clubNation(assignment.targetClubId),
        competitionId: club.competitionId,
      }));
    }
    case "COMPETITION":
      return getClubsByCompetition(assignment.targetCompetitionId).flatMap((club) =>
        getCareerClubSquad(state, club.id).map((p) => ({
          playerId: p.id,
          clubId: club.id,
          position: p.position,
          ageYears: playerAgeAtDate(p.dateOfBirth, p.birthYear ?? undefined, asOfDate),
          nation: clubNation(club.id),
          competitionId: club.competitionId,
        })),
      );
    case "REGION":
      return allExternalCandidates(state, asOfDate).filter((c) => c.nation === assignment.targetNation);
    case "POSITION":
      return allExternalCandidates(state, asOfDate).filter((c) => c.position === assignment.targetPosition);
    case "AGE_BAND":
      return allExternalCandidates(state, asOfDate).filter((c) => c.ageYears !== null && assignment.targetMaxAgeYears !== null && c.ageYears <= assignment.targetMaxAgeYears);
    default:
      return [];
  }
}

/** NET (discovery reach) drives the base count; the manager's own current knowledge of the assignment's scope raises it further -- "fler spelare upptäcks" as knowledge grows. Bounded to a small, explainable slice, never "hundreds a week". */
function discoveryCountForCycle(scout: ResolvedStaffMember | undefined, scopeKnowledgePct: number): number {
  const net = scout?.profile.attributes.NETWORK?.value ?? NEUTRAL_SUITABILITY;
  const base = 1 + Math.round((net / 20) * 3); // 1..4
  const tier = knowledgeTier(scopeKnowledgePct);
  const knowledgeBonus = tier === "HIGH" ? 2 : tier === "MEDIUM" ? 1 : 0;
  return Math.max(1, Math.min(6, base + knowledgeBonus));
}

function currentScopeKnowledgePct(state: CareerState, assignment: ScoutingAssignment, ownNation: string | undefined): number {
  switch (assignment.assignmentType) {
    case "CLUB":
      return getClubKnowledgePct(state, assignment.targetClubId);
    case "COMPETITION":
      return getCompetitionKnowledgePct(state, assignment.targetCompetitionId);
    case "REGION":
      return getCountryKnowledgePct(state, assignment.targetNation, ownNation);
    default:
      return 50; // POSITION/AGE_BAND cut across many clubs -- no single scope entity to read; a neutral mid value keeps the count formula stable.
  }
}

function reasonsFor(assignment: ScoutingAssignment, candidate: CandidatePlayer): string[] {
  const reasons: string[] = [];
  switch (assignment.assignmentType) {
    case "CLUB": {
      const club = getClub(candidate.clubId);
      reasons.push(`Spelare i ${club?.name ?? candidate.clubId}.`);
      break;
    }
    case "COMPETITION": {
      const competition = getCompetition(candidate.competitionId);
      reasons.push(`Spelare i ${competition?.name ?? candidate.competitionId}.`);
      break;
    }
    case "REGION":
      reasons.push(`Spelare med anknytning till uppdragets land.`);
      break;
    case "POSITION":
      reasons.push(`Position matchar uppdraget (${candidate.position}).`);
      break;
    case "AGE_BAND":
      reasons.push(`Ålder inom uppdragets gräns (≤${assignment.targetMaxAgeYears} år).`);
      break;
  }
  return reasons;
}

/**
 * Runs exactly ONE discovery cycle for `assignment` (called once per
 * completed cycle from scouting.ts's progressScoutingAssignments -- never
 * called directly by UI code). Pure aside from the CareerState it
 * returns: same (assignment, date, state) always produces the same
 * discoveries (deterministic, seeded on assignment id + cycle index +
 * candidate id -- never Math.random()).
 */
export function runDiscoveryCycle(state: CareerState, assignment: ScoutingAssignment, date: string): { state: CareerState; discoveries: ScoutDiscovery[] } {
  const scout = findStaffMember(state, assignment.scoutStaffId);
  const ownNation = clubNation(state.playerClubId);
  const cycleIndex = assignment.cyclesCompleted;

  const pool = candidatePoolFor(state, assignment, date).filter((c) => !assignment.discoveredPlayerIds.includes(c.playerId));
  if (pool.length === 0) {
    return { state, discoveries: [] };
  }

  const geographyAttr = assignment.targetNation && assignment.targetNation !== ownNation ? "INTERNATIONAL_KNOWLEDGE" : "REGIONAL_KNOWLEDGE";
  const scopeKnowledge = currentScopeKnowledgePct(state, assignment, ownNation);
  const count = discoveryCountForCycle(scout, scopeKnowledge);

  // The scout's own assignment-specific suitability (JCA/JPA/TAC/NET/
  // REG/INT, plus GK/YTH when the assignment itself targets goalkeepers/
  // a youth age band -- see computeBroadAssignmentSuitability's own
  // weighting) does NOT change how many candidates are returned here
  // (that's NET's job, via discoveryCountForCycle) -- it changes how
  // ACCURATELY the ranking reflects true ability: a highly-suited scout
  // (e.g. a GK specialist on a goalkeeper assignment) gets a small,
  // precise seeded jitter and so reliably surfaces the genuinely
  // strongest candidates; a poorly-suited generalist gets a wide jitter
  // and surfaces a noisier, less relevant slice -- exactly "it doesn't
  // have to mean more players; it can be better accuracy/relevance".
  const suitability = scout ? computeBroadAssignmentSuitability(scout, assignment.assignmentType, geographyAttr, assignment.targetPosition) : NEUTRAL_SUITABILITY;
  const jitterMagnitude = Math.max(2, Math.min(14, Math.round(14 - suitability)));

  const ranked = pool
    .map((c) => {
      const ca = getCareerPlayerRating(state, c.playerId, c.clubId)?.ca ?? 0;
      const jitter = seededOffset(`${assignment.id}:${c.playerId}:cycle:${cycleIndex}`, jitterMagnitude);
      const score = ca + jitter;
      return { candidate: c, score };
    })
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.candidate.playerId.localeCompare(b.candidate.playerId)))
    .slice(0, count);

  const discoveries: ScoutDiscovery[] = ranked.map(({ candidate }, i) => ({
    id: `discovery-${assignment.id}-${cycleIndex}-${i}`,
    assignmentId: assignment.id,
    scoutStaffId: assignment.scoutStaffId,
    assignmentType: assignment.assignmentType,
    playerId: candidate.playerId,
    clubId: candidate.clubId,
    discoveredDate: date,
    cycleIndex,
    reasons: reasonsFor(assignment, candidate),
  }));

  let next = state;
  for (const discovery of discoveries) {
    const currentPlayerKnowledge = getPlayerKnowledgePct(next, discovery.playerId, discovery.clubId);
    next = setPlayerKnowledgePct(next, discovery.playerId, currentPlayerKnowledge + DISCOVERY_PLAYER_KNOWLEDGE_GAIN);
    const currentClubKnowledge = getClubKnowledgePct(next, discovery.clubId);
    next = setClubKnowledgePct(next, discovery.clubId, currentClubKnowledge + DISCOVERY_CLUB_KNOWLEDGE_GAIN);
  }

  if (assignment.assignmentType === "CLUB") {
    next = setClubKnowledgePct(next, assignment.targetClubId, getClubKnowledgePct(next, assignment.targetClubId) + SCOPE_KNOWLEDGE_GAIN_PER_CYCLE);
  } else if (assignment.assignmentType === "COMPETITION") {
    next = setCompetitionKnowledgePct(next, assignment.targetCompetitionId, getCompetitionKnowledgePct(next, assignment.targetCompetitionId) + SCOPE_KNOWLEDGE_GAIN_PER_CYCLE);
  } else if (assignment.assignmentType === "REGION") {
    next = setCountryKnowledgePct(next, assignment.targetNation, getCountryKnowledgePct(next, assignment.targetNation, ownNation) + SCOPE_KNOWLEDGE_GAIN_PER_CYCLE);
  }

  next = {
    ...next,
    scoutDiscoveries: {
      ...next.scoutDiscoveries,
      ...Object.fromEntries(discoveries.map((d) => [d.id, d])),
    },
  };

  return { state: next, discoveries };
}

/** Every discovery for the manager's own career, most recent first -- the "Upptäckta spelare" view's own data source. */
export function getAllScoutDiscoveries(state: CareerState): ScoutDiscovery[] {
  return Object.values(state.scoutDiscoveries).sort((a, b) => (a.discoveredDate < b.discoveredDate ? 1 : a.discoveredDate > b.discoveredDate ? -1 : 0));
}

/** Every discovery for one player, most recent first. */
export function getPlayerScoutDiscoveries(state: CareerState, playerId: string): ScoutDiscovery[] {
  return Object.values(state.scoutDiscoveries)
    .filter((d) => d.playerId === playerId)
    .sort((a, b) => (a.discoveredDate < b.discoveredDate ? 1 : a.discoveredDate > b.discoveredDate ? -1 : 0));
}

/** Swedish label for every NationCode a scoutable competition can carry -- lib/game-data/nations.ts's own NATIONS only lists the 8 New-Game-selectable nations, not the 8 international-pool-only ones (HM-WORLD-PLAYER-POOL-1.0), so this is a superset kept here rather than widening NATIONS itself (NATIONS' own New-Game-gate meaning must not change). */
export const NATION_LABEL_SV: Record<string, string> = {
  SWE: "Sverige",
  DEN: "Danmark",
  NOR: "Norge",
  GER: "Tyskland",
  ESP: "Spanien",
  HUN: "Ungern",
  SVN: "Slovenien",
  ISL: "Island",
  AUT: "Österrike",
  FRO: "Färöarna",
  ITA: "Italien",
  NED: "Nederländerna",
  POL: "Polen",
  POR: "Portugal",
  QAT: "Qatar",
  CHE: "Schweiz",
  // HM-BIO-NATIONALITY-1.0: the rest of the observed real-world nationality set.
  FRA: "Frankrike",
  SRB: "Serbien",
  HRV: "Kroatien",
  BIH: "Bosnien och Hercegovina",
  FIN: "Finland",
  ARG: "Argentina",
  LTU: "Litauen",
  ROU: "Rumänien",
  DZA: "Algeriet",
  EST: "Estland",
  KOS: "Kosovo",
  GBR: "Storbritannien",
  CHL: "Chile",
  USA: "USA",
  UNK: "Okänd",
};

/** Deterministic, template-based Swedish scope description for an assignment -- used by both the inbox summary (careerEvents.ts's buildScoutDiscoveryReadyEvent) and the Scouting UI. */
export function scopeLabelSv(assignment: ScoutingAssignment): string {
  switch (assignment.assignmentType) {
    case "CLUB":
      return `hos ${getClub(assignment.targetClubId)?.name ?? assignment.targetClubId}`;
    case "COMPETITION":
      return `i ${getCompetition(assignment.targetCompetitionId)?.name ?? assignment.targetCompetitionId}`;
    case "REGION":
      return `i ${NATION_LABEL_SV[assignment.targetNation] ?? assignment.targetNation}`;
    case "POSITION":
      return `på position ${assignment.targetPosition}`;
    case "AGE_BAND":
      return `i åldersgruppen ≤${assignment.targetMaxAgeYears} år`;
    default:
      return "";
  }
}
