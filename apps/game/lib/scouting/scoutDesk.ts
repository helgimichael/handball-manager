// Arena Nights 231 -- REC-01 C "Scout Desk" view models (REC-01a/b/d/e/f, REC-01c preview). Pure reads
// over existing scouting, knowledge and recruitment state. Everything shown about another club's player is
// the knowledge-gated view the Recruitment Centre already composes (ranges, confidence, value range) --
// nothing here reads true ability. Previews run the real assignment functions on a throw-away copy of the
// state, so durations and knowledge gains are what the rules would actually produce, never a second model.
import { getCareerClubSquad, getExternalCandidateClubs } from "../career/careerWorld";
import { clubCompetitionId } from "../career/competitionMembership";
import type { NeedLevel } from "../career/cpuSquadNeeds";
import { daysBetween } from "../career/dateUtils";
import type { RecruitmentCandidate, RecruitmentPriority } from "../career/recruitment";
import { NATION_LABEL_SV } from "../career/scoutDiscovery";
import {
  createBroadScoutingAssignment,
  createScoutingAssignment,
  getClubScouts,
  progressScoutingAssignments,
  type BroadScoutAssignmentScope,
  type ScoutAssignmentType,
  type ScoutingAssignment,
} from "../career/scouting";
import type { CareerState } from "../career/types";
import { getCompetition, positionLabel, type HandballPosition } from "../game-data";
import { getCompetitionKnowledgePct, getCountryKnowledgePct, getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import type { StarRange } from "../knowledge/playerVisibility";
import { clubNation } from "../staff/scoutPool";
import { computeRoleSuitability } from "../staff/roleSuitability";
import type { Recommendation } from "./recommendations";

export type BroadType = Exclude<ScoutAssignmentType, "PLAYER">;
export const POSITIONS: readonly HandballPosition[] = ["MV", "V9", "V6", "M9", "M6", "H9", "H6"];

// --- Pipeline strip (REC-01) ---------------------------------------------------------------------

export interface PipelineCounts { discovered: number; scouting: number; reports: number; shortlist: number }

/** Upptäckta · Under scouting · Rapporter · Kortlista -- one count per stage, from the Recruitment Centre's candidates. */
export function pipelineCounts(candidates: readonly RecruitmentCandidate[]): PipelineCounts {
  return {
    discovered: candidates.filter((c) => c.recruitmentStatus === "DISCOVERED").length,
    scouting: candidates.filter((c) => c.activeAssignment).length,
    reports: candidates.filter((c) => c.hasCompletedReport).length,
    shortlist: candidates.filter((c) => c.shortlisted).length,
  };
}

// --- Scout capacity (REC-01b) --------------------------------------------------------------------

export interface ScoutCapacity { id: string; name: string; /** 1-20, own staff (fully known). */ suitability: number; active: number; nextFinish: string | null; free: boolean }

/** The club's own scouts: free ones first, then the best judges. One scale (1-20) everywhere. */
export function scoutCapacity(state: CareerState): ScoutCapacity[] {
  const running = Object.values(state.scoutingAssignments ?? {}).filter((a) => a.status === "IN_PROGRESS");
  return getClubScouts(state)
    .map((s) => {
      const mine = running.filter((a) => a.scoutStaffId === s.id).map((a) => a.endDate).sort();
      return { id: s.id, name: s.displayName, suitability: Math.round(computeRoleSuitability(s, "SCOUT") * 10) / 10, active: mine.length, nextFinish: mine[0] ?? null, free: mine.length === 0 };
    })
    .sort((a, b) => Number(b.free) - Number(a.free) || b.suitability - a.suitability || a.name.localeCompare(b.name, "sv"));
}

// --- Report feed (REC-01) ------------------------------------------------------------------------

export interface ReportCard {
  reportId: string;
  playerId: string;
  createdDate: string;
  scoutId: string;
  /** Knowledge filed by the previous report on the same player (null for the first report). */
  knowledgeFrom: number | null;
  knowledgeTo: number;
  candidate: RecruitmentCandidate;
}

/** Filed scout reports, newest first, each with the knowledge it moved from -> to. */
export function reportFeed(state: CareerState, candidates: readonly RecruitmentCandidate[], limit = 12): ReportCard[] {
  const byPlayer = new Map(candidates.map((c) => [c.playerId, c]));
  const reports = Object.values(state.scoutReports ?? {}).sort((a, b) => b.createdDate.localeCompare(a.createdDate) || b.id.localeCompare(a.id));
  const out: ReportCard[] = [];
  for (const r of reports) {
    const candidate = byPlayer.get(r.targetPlayerId);
    if (!candidate) continue;
    const previous = reports.find((x) => x.targetPlayerId === r.targetPlayerId && (x.createdDate < r.createdDate || (x.createdDate === r.createdDate && x.id < r.id)));
    out.push({ reportId: r.id, playerId: r.targetPlayerId, createdDate: r.createdDate, scoutId: r.scoutStaffId, knowledgeFrom: previous?.knowledgePctAtReport ?? null, knowledgeTo: r.knowledgePctAtReport, candidate });
    if (out.length >= limit) break;
  }
  return out;
}

// --- Single pipeline list (REC-01e) --------------------------------------------------------------

export interface AssignmentGroups { ready: ScoutingAssignment[]; running: ScoutingAssignment[]; sweeps: ScoutingAssignment[] }

/** One pipeline grouped by status -- Klar (newest first), Pågår (finishing soonest first), Svep (running first). */
export function assignmentGroups(state: CareerState, readyLimit = 8, sweepLimit = 8): AssignmentGroups {
  const all = Object.values(state.scoutingAssignments ?? {});
  const player = all.filter((a) => a.assignmentType === "PLAYER");
  return {
    ready: player.filter((a) => a.status === "COMPLETED").sort((a, b) => b.endDate.localeCompare(a.endDate) || a.id.localeCompare(b.id)).slice(0, readyLimit),
    running: player.filter((a) => a.status === "IN_PROGRESS").sort((a, b) => a.endDate.localeCompare(b.endDate) || a.id.localeCompare(b.id)),
    sweeps: all
      .filter((a) => a.assignmentType !== "PLAYER")
      .sort((a, b) => Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS") || b.startDate.localeCompare(a.startDate) || a.id.localeCompare(b.id))
      .slice(0, sweepLimit),
  };
}

// --- Kortlista (REC-01) --------------------------------------------------------------------------

export const PRIORITY_ORDER: readonly RecruitmentPriority[] = ["TOP", "HIGH", "NORMAL", "LOW"];

/** The shortlist ranked by the manager's own priority, then by how well the club knows the player. */
export function rankedShortlist(candidates: readonly RecruitmentCandidate[]): RecruitmentCandidate[] {
  return candidates
    .filter((c) => c.shortlisted)
    .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) || b.knowledgePct - a.knowledgePct || a.lastName.localeCompare(b.lastName, "sv"));
}

/** One step up (-1) or down (+1) the priority ladder; null at the end of it. */
export function shiftPriority(priority: RecruitmentPriority, step: -1 | 1): RecruitmentPriority | null {
  return PRIORITY_ORDER[PRIORITY_ORDER.indexOf(priority) + step] ?? null;
}

// --- Need-driven recommendations (REC-01a) -------------------------------------------------------

export interface NeedCard { position: HandballPosition; level: NeedLevel; projectedDepth: number; candidates: Recommendation[]; more: number }

/** Positions where the squad is thin (HIGH before MEDIUM), each with its best recommended candidates. */
export function needCards(recs: readonly Recommendation[], needs: readonly { position: HandballPosition; level: NeedLevel; projectedDepth: number }[], perCard = 3, maxCards = 4): NeedCard[] {
  const rank: Record<NeedLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
  return needs
    .filter((n) => n.level === "HIGH" || n.level === "MEDIUM")
    .sort((a, b) => rank[a.level] - rank[b.level] || a.projectedDepth - b.projectedDepth || POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position))
    .slice(0, maxCards)
    .map((n) => {
      const all = recs.filter((r) => r.player.position === n.position);
      return { position: n.position, level: n.level, projectedDepth: n.projectedDepth, candidates: all.slice(0, perCard), more: Math.max(0, all.length - perCard) };
    });
}

// --- Ranked discoveries (REC-01f) ----------------------------------------------------------------

export type DiscoverySort = "KNOWN" | "ABILITY" | "NEED" | "NEWEST";
export interface DiscoveryRowLike { knowledgePct: number; abilityRange: StarRange | null; potentialRange: StarRange | null; needLevel: NeedLevel; discoveredDate: string; name: string }

const mid = (r: StarRange | null) => (r ? (r.min + r.max) / 2 : -1);
const NEED_RANK: Record<NeedLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

/** Sorts discoveries by what the club believes (range midpoints), never by a hidden value. */
export function sortDiscoveries<T extends DiscoveryRowLike>(rows: readonly T[], sort: DiscoverySort): T[] {
  const tie = (a: T, b: T) => a.name.localeCompare(b.name, "sv");
  const cmp: Record<DiscoverySort, (a: T, b: T) => number> = {
    KNOWN: (a, b) => b.knowledgePct - a.knowledgePct || mid(b.abilityRange) - mid(a.abilityRange) || tie(a, b),
    ABILITY: (a, b) => mid(b.abilityRange) - mid(a.abilityRange) || mid(b.potentialRange) - mid(a.potentialRange) || b.knowledgePct - a.knowledgePct || tie(a, b),
    NEED: (a, b) => NEED_RANK[b.needLevel] - NEED_RANK[a.needLevel] || mid(b.abilityRange) - mid(a.abilityRange) || tie(a, b),
    NEWEST: (a, b) => b.discoveredDate.localeCompare(a.discoveredDate) || tie(a, b),
  };
  return [...rows].sort(cmp[sort]);
}

// --- "Ge ett uppdrag" typeahead (REC-01) ---------------------------------------------------------

export type AssignTarget =
  | { kind: "PLAYER"; key: string; label: string; detail: string; playerId: string; clubId: string }
  | { kind: "CLUB"; key: string; label: string; detail: string; clubId: string }
  | { kind: "COMPETITION"; key: string; label: string; detail: string; competitionId: string }
  | { kind: "REGION"; key: string; label: string; detail: string; nation: string }
  | { kind: "POSITION"; key: string; label: string; detail: string; position: HandballPosition }
  | { kind: "AGE_BAND"; key: string; label: string; detail: string; maxAge: number };

const norm = (s: string) => s.toLocaleLowerCase("sv").normalize("NFD").replace(/[̀-ͯ]/g, "");

/** One field, every assignment shape: a player, a club, a league, a country, a position or an age band ("U21"). */
export function assignmentSuggestions(state: CareerState, query: string, limit = 8): AssignTarget[] {
  const q = norm(query.trim());
  if (q.length < 2) return [];
  const out: AssignTarget[] = [];
  const age = /^u?\s?(\d{2})$/.exec(q);
  if (age) {
    const maxAge = Number(age[1]);
    if (maxAge >= 15 && maxAge <= 40) out.push({ kind: "AGE_BAND", key: `age-${maxAge}`, label: `U${maxAge}`, detail: `Spelare ${maxAge} år eller yngre`, maxAge });
  }
  for (const p of POSITIONS) if (norm(p) === q || norm(positionLabel(p)).includes(q)) out.push({ kind: "POSITION", key: `pos-${p}`, label: `${p} · ${positionLabel(p)}`, detail: "Alla klubbar", position: p });
  const clubs = getExternalCandidateClubs(state);
  const competitions = new Map<string, string>();
  const nations = new Set<string>();
  for (const club of clubs) {
    const competitionId = clubCompetitionId(state, club.id);
    if (competitionId) competitions.set(competitionId, getCompetition(competitionId)?.name ?? competitionId);
    const nation = clubNation(club.id);
    if (nation) nations.add(nation);
  }
  for (const [id, name] of competitions) if (norm(name).includes(q)) out.push({ kind: "COMPETITION", key: `comp-${id}`, label: name, detail: "Liga", competitionId: id });
  for (const n of nations) { const label = NATION_LABEL_SV[n] ?? n; if (norm(label).includes(q) || norm(n) === q) out.push({ kind: "REGION", key: `nation-${n}`, label, detail: "Land", nation: n }); }
  for (const club of clubs) if (norm(club.name).includes(q) || norm(club.shortName).includes(q)) out.push({ kind: "CLUB", key: `club-${club.id}`, label: club.name, detail: "Klubb", clubId: club.id });
  if (q.length >= 3) {
    for (const club of clubs) {
      for (const p of getCareerClubSquad(state, club.id)) {
        if (!norm(`${p.firstName} ${p.lastName}`).includes(q)) continue;
        out.push({ kind: "PLAYER", key: `player-${p.id}`, label: `${p.firstName} ${p.lastName}`, detail: `${p.position} · ${club.shortName}`, playerId: p.id, clubId: club.id });
        if (out.length >= limit * 3) break;
      }
    }
  }
  return out.slice(0, limit);
}

/** The scope object createBroadScoutingAssignment expects for a non-player target. */
export function broadScope(target: Exclude<AssignTarget, { kind: "PLAYER" }>): { type: BroadType; scope: BroadScoutAssignmentScope } {
  switch (target.kind) {
    case "CLUB": return { type: "CLUB", scope: { targetClubId: target.clubId } };
    case "COMPETITION": return { type: "COMPETITION", scope: { targetCompetitionId: target.competitionId } };
    case "REGION": return { type: "REGION", scope: { targetNation: target.nation } };
    case "POSITION": return { type: "POSITION", scope: { targetPosition: target.position } };
    case "AGE_BAND": return { type: "AGE_BAND", scope: { targetMaxAgeYears: target.maxAge } };
  }
}

// --- Coverage (REC-01d) --------------------------------------------------------------------------

export interface CoverageTile { kind: "COMPETITION" | "REGION"; id: string; label: string; clubs: number; /** The club's stored knowledge of the league / country (0-100). */ coverage: number; /** Players there the club knows at least a little (>= 30 % knowledge). */ knownPlayers: number; players: number; activeSweeps: number }

/** Leagues and countries the scouts can be sent to, least covered first. */
export function coverageTiles(state: CareerState): CoverageTile[] {
  const clubs = getExternalCandidateClubs(state);
  const ownNation = clubNation(state.playerClubId);
  const running = Object.values(state.scoutingAssignments ?? {}).filter((a) => a.status === "IN_PROGRESS" && a.assignmentType !== "PLAYER");
  const comp = new Map<string, { clubs: number; players: number; known: number }>();
  const nat = new Map<string, { clubs: number; players: number; known: number }>();
  for (const club of clubs) {
    const squad = getCareerClubSquad(state, club.id);
    const known = squad.filter((p) => getPlayerKnowledgePct(state, p.id, club.id) >= 30).length;
    // Career-aware league membership only (Club Identity C3); a club without a league this season is skipped.
    const competitionId = clubCompetitionId(state, club.id);
    if (competitionId) {
      const c = comp.get(competitionId) ?? { clubs: 0, players: 0, known: 0 };
      comp.set(competitionId, { clubs: c.clubs + 1, players: c.players + squad.length, known: c.known + known });
    }
    const nation = clubNation(club.id);
    if (nation && nation !== ownNation) {
      const n = nat.get(nation) ?? { clubs: 0, players: 0, known: 0 };
      nat.set(nation, { clubs: n.clubs + 1, players: n.players + squad.length, known: n.known + known });
    }
  }
  const tiles: CoverageTile[] = [
    ...[...comp].map(([id, v]) => ({ kind: "COMPETITION" as const, id, label: getCompetition(id)?.name ?? id, clubs: v.clubs, coverage: getCompetitionKnowledgePct(state, id), knownPlayers: v.known, players: v.players, activeSweeps: running.filter((a) => a.targetCompetitionId === id || (a.assignmentType === "CLUB" && clubCompetitionId(state, a.targetClubId) === id)).length })),
    ...[...nat].map(([id, v]) => ({ kind: "REGION" as const, id, label: NATION_LABEL_SV[id] ?? id, clubs: v.clubs, coverage: getCountryKnowledgePct(state, id, ownNation), knownPlayers: v.known, players: v.players, activeSweeps: running.filter((a) => a.targetNation === id).length })),
  ];
  return tiles.sort((a, b) => a.coverage - b.coverage || a.knownPlayers / Math.max(1, a.players) - b.knownPlayers / Math.max(1, b.players) || a.label.localeCompare(b.label, "sv"));
}

// --- Previews (REC-01c sheet, REC-01 "expected duration") ----------------------------------------

export type PlayerAssignmentPreview = { ok: true; days: number; endDate: string; knowledgeNow: number; knowledgeAfter: number } | { ok: false; errors: string[] };

/** What sending this scout would produce: the real assignment and report functions, run on a copy. */
export function previewPlayerAssignment(state: CareerState, scoutId: string, playerId: string, clubId: string): PlayerAssignmentPreview {
  const created = createScoutingAssignment(state, scoutId, playerId, clubId, state.gameDate);
  if (!created.ok || !created.assignment) return { ok: false, errors: created.errors };
  const a = created.assignment;
  const isolated: CareerState = { ...created.state, scoutingAssignments: { [a.id]: a } };
  const after = progressScoutingAssignments(isolated, a.endDate).state;
  return { ok: true, days: daysBetween(state.gameDate, a.endDate), endDate: a.endDate, knowledgeNow: getPlayerKnowledgePct(state, playerId, clubId), knowledgeAfter: getPlayerKnowledgePct(after, playerId, clubId) };
}

export type BroadAssignmentPreview = { ok: true; cycleDays: number; cycles: number } | { ok: false; errors: string[] };

/** The first cycle's length and the number of cycles a sweep would run, from the real create function. */
export function previewBroadAssignment(state: CareerState, scoutId: string, type: BroadType, scope: BroadScoutAssignmentScope): BroadAssignmentPreview {
  const created = createBroadScoutingAssignment(state, scoutId, type, scope, state.gameDate);
  if (!created.ok || !created.assignment) return { ok: false, errors: created.errors };
  return { ok: true, cycleDays: daysBetween(state.gameDate, created.assignment.endDate), cycles: created.assignment.maxCycles };
}
