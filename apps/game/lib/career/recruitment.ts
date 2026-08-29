// HM-RECRUITMENT-1.1: the Recruitment Centre's own domain layer --
// unifies Discovery -> Knowledge -> Scout Report -> Shortlist ->
// Recruitment Decision -> Transfer into ONE candidate view, composed
// entirely from already-canonical resolvers (never a second copy of
// player/scouting/transfer state):
//   - identity/position/age/club:      careerWorld.ts's getCareerPlayer
//   - knowledge:                       lib/knowledge/knowledgeIntegration.ts
//   - ability/potential band:          lib/knowledge/playerVisibility.ts
//   - report confidence/market value:  lib/knowledge/scoutReportVisibility.ts
//   - contract:                        lib/economy/contractIntegration.ts
//   - discoveries/reports/assignments: scoutDiscovery.ts / scouting.ts
//   - transfer state:                  career.transferOffers (read-only
//                                       here -- transferIntegration.ts's
//                                       own submitTransferOffer is the
//                                       ONLY writer, never duplicated)
//
// The only NEW state this module owns is `recruitmentTargets` --
// manager INTENT (shortlist/priority/note), never player-data truth
// (Part: "Shortlist är management state, inte player-data truth").
// `RecruitmentStatus` itself is almost entirely DERIVED from the
// systems above; the only stored inputs to it are shortlisted/priority.
import type { CareerState } from "./types";
import { getCareerPlayer } from "./careerWorld";
import { getCareerPlayerRating } from "./careerRatingNormalization";
import { getPlayerKnowledgePct } from "../knowledge/knowledgeIntegration";
import { knowledgeTier, type KnowledgeTier } from "../knowledge/types";
import { resolvePlayerVisibility, type PlayerVisibleView } from "../knowledge/playerVisibility";
import { buildScoutReportView, type ScoutReportView } from "../knowledge/scoutReportVisibility";
import { getPlayerContract, getPlayerContractStatus, getPlayerMarketValueEur } from "../economy/contractIntegration";
import type { ContractStatus } from "../economy/types";
import { getPlayerScoutReports, type ScoutAssignmentType } from "./scouting";
import { getPlayerScoutDiscoveries } from "./scoutDiscovery";
import { getClub, playerAge, type HandballPosition } from "../game-data";
import { findStaffMember } from "../staff/staffCareerIntegration";
import type { TransferOffer, TransferOfferStatus } from "../transfers/types";
import { getFreeAgents, isFreeAgentClubId } from "./contractExpiry";

export const RECRUITMENT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "TOP"] as const;
export type RecruitmentPriority = (typeof RECRUITMENT_PRIORITIES)[number];

export const RECRUITMENT_PRIORITY_LABEL_SV: Record<RecruitmentPriority, string> = {
  LOW: "Låg",
  NORMAL: "Normal",
  HIGH: "Hög",
  TOP: "Toppmål",
};

/** Manager INTENT over one recruitment candidate -- see this module's own header. Sparse: a row exists only once the manager has actually shortlisted/prioritized/annotated the player. */
export interface RecruitmentTarget {
  playerId: string;
  shortlisted: boolean;
  priority: RecruitmentPriority;
  note: string;
  addedDate: string;
}

/**
 * The recruitment-case pipeline stage -- a workflow LAYER over already-
 * canonical state, not a new transfer engine (Part: "Detta ska vara ett
 * workflow-lager"). Priority order (highest wins) mirrors a real
 * recruitment case: a closed/negotiating transfer always outranks
 * scouting progress, which always outranks a bare discovery.
 */
export const RECRUITMENT_STATUSES = ["DISCOVERED", "SCOUTING", "SCOUTED", "SHORTLISTED", "PRIORITIZED", "NEGOTIATING", "CLOSED"] as const;
export type RecruitmentStatus = (typeof RECRUITMENT_STATUSES)[number];

export const RECRUITMENT_STATUS_LABEL_SV: Record<RecruitmentStatus, string> = {
  DISCOVERED: "Upptäckt",
  SCOUTING: "Scoutas",
  SCOUTED: "Scoutad",
  SHORTLISTED: "Kortlistad",
  PRIORITIZED: "Prioriterad",
  NEGOTIATING: "Förhandling",
  CLOSED: "Avslutad",
};

const TRANSFER_STATUS_LABEL_SV: Record<TransferOfferStatus, string> = {
  BLOCKED_UNAFFORDABLE: "Misslyckad -- för dyrt",
  BLOCKED_PENDING_TRANSFER: "Misslyckad -- spelaren har redan en pågående affär",
  REJECTED_BY_CLUB: "Misslyckad -- klubben nekade",
  REJECTED_BY_PLAYER: "Misslyckad -- spelaren nekade",
  AGREED_AWAITING_WINDOW: "Överenskommet -- väntar på transferfönster",
  COMPLETED: "Avslutad",
  CANCELLED_STALE: "Avbruten -- spelaren bytte klubb innan affären slutfördes",
};

/** "Ej kontaktad" (no offer exists) vs the real, existing TransferOfferStatus vocabulary -- never an invented intermediate state (Part: "Mappa BEFINTLIG transfer-state till naturlig svensk copy", not a new negotiation model -- see transfers/types.ts's own doc on why every offer resolves synchronously to a terminal status, no lingering "pending"). */
export function transferStatusLabelSv(offer: TransferOffer | null): string {
  return offer ? TRANSFER_STATUS_LABEL_SV[offer.status] : "Ej kontaktad";
}

/**
 * `nextOfferId` (transferIntegration.ts) suffixes every offer id with
 * `Object.keys(state.transferOffers).length` AT CREATION TIME -- a
 * counter that only ever grows, career-wide. That trailing number is a
 * true creation-order index; `offeredDate` alone is NOT enough to sort
 * "most recent first" by, since two offers made on the SAME game date
 * (a very real case -- a manager re-bidding the same day after a
 * rejection) would otherwise tie and sort arbitrarily.
 */
function offerSequence(offer: TransferOffer): number {
  const match = /-(\d+)$/.exec(offer.id);
  return match ? Number(match[1]) : 0;
}

/** Every transfer offer ever made for `playerId`, most recent first. Read-only filter over the ONE transfer-state source (career.transferOffers) -- never a parallel offer store. */
export function getPlayerTransferOffers(state: CareerState, playerId: string): TransferOffer[] {
  return Object.values(state.transferOffers)
    .filter((o) => o.playerId === playerId)
    .sort((a, b) => offerSequence(b) - offerSequence(a));
}

export function getRecruitmentTarget(state: CareerState, playerId: string): RecruitmentTarget | undefined {
  return state.recruitmentTargets[playerId];
}

export function isShortlisted(state: CareerState, playerId: string): boolean {
  return state.recruitmentTargets[playerId]?.shortlisted ?? false;
}

function defaultTarget(playerId: string, date: string): RecruitmentTarget {
  return { playerId, shortlisted: false, priority: "NORMAL", note: "", addedDate: date };
}

/** Adds `playerId` to the shortlist -- idempotent (re-adding an already-shortlisted player is a no-op, never a duplicate row: `recruitmentTargets` is keyed by playerId, so there is structurally never more than one row per player). */
export function addToShortlist(state: CareerState, playerId: string, date: string): CareerState {
  const existing = state.recruitmentTargets[playerId] ?? defaultTarget(playerId, date);
  if (existing.shortlisted) return state;
  return { ...state, recruitmentTargets: { ...state.recruitmentTargets, [playerId]: { ...existing, shortlisted: true } } };
}

/** Removes `playerId` from the shortlist -- keeps the row (priority/note survive, matching a real manager's expectation that removing-then-re-adding doesn't lose their notes), just flips the flag. A no-op if never shortlisted. */
export function removeFromShortlist(state: CareerState, playerId: string): CareerState {
  const existing = state.recruitmentTargets[playerId];
  if (!existing || !existing.shortlisted) return state;
  return { ...state, recruitmentTargets: { ...state.recruitmentTargets, [playerId]: { ...existing, shortlisted: false } } };
}

/** Manager INTENT, not a player rating (Part: "Detta är manager intent, inte player rating"). */
export function setRecruitmentPriority(state: CareerState, playerId: string, priority: RecruitmentPriority, date: string): CareerState {
  const existing = state.recruitmentTargets[playerId] ?? defaultTarget(playerId, date);
  if (existing.priority === priority) return state;
  return { ...state, recruitmentTargets: { ...state.recruitmentTargets, [playerId]: { ...existing, priority } } };
}

export function setRecruitmentNote(state: CareerState, playerId: string, note: string, date: string): CareerState {
  const existing = state.recruitmentTargets[playerId] ?? defaultTarget(playerId, date);
  if (existing.note === note) return state;
  return { ...state, recruitmentTargets: { ...state.recruitmentTargets, [playerId]: { ...existing, note } } };
}

function hasActivePlayerAssignment(state: CareerState, playerId: string): boolean {
  return Object.values(state.scoutingAssignments).some((a) => a.assignmentType === "PLAYER" && a.targetPlayerId === playerId && a.status === "IN_PROGRESS");
}

/** Derives the recruitment-case pipeline stage purely from already-canonical state (transfer offers, shortlist/priority, scout reports, active assignments) -- see this module's own header on priority order. */
export function getRecruitmentStatus(state: CareerState, playerId: string): RecruitmentStatus {
  const offers = getPlayerTransferOffers(state, playerId);
  if (offers.some((o) => o.status === "COMPLETED")) return "CLOSED";
  if (offers.some((o) => o.status === "AGREED_AWAITING_WINDOW")) return "NEGOTIATING";

  const target = state.recruitmentTargets[playerId];
  if (target?.shortlisted) {
    return target.priority === "HIGH" || target.priority === "TOP" ? "PRIORITIZED" : "SHORTLISTED";
  }
  if (getPlayerScoutReports(state, playerId).length > 0) return "SCOUTED";
  if (hasActivePlayerAssignment(state, playerId)) return "SCOUTING";
  return "DISCOVERED";
}

export interface RecruitmentCandidate {
  playerId: string;
  firstName: string;
  lastName: string;
  clubId: string;
  clubName: string;
  competitionId: string;
  position: HandballPosition;
  ageYears: number | null;
  nationality: string;
  knowledgeTier: KnowledgeTier;
  knowledgePct: number;
  /** Ability/potential star bands, strengths/weaknesses -- knowledge-gated, raw CA/PA NEVER present (structurally: PlayerVisibleView has no ca/pa field). Null only while no rating row can be resolved at all (should not normally happen for a scoutable candidate). */
  visibility: PlayerVisibleView | null;
  /** Report confidence/market value range/recommendation -- same knowledge-gated composition the Player Profile page already uses. */
  scoutReportView: ScoutReportView | null;
  contractEndDate: string | null;
  contractStatus: ContractStatus | null;
  wageEurPerMonth: number | null;
  /** How this candidate most recently reached the manager's radar. */
  discoverySource: ScoutAssignmentType | null;
  discoveryReasons: readonly string[];
  scoutDisplayName: string | null;
  hasCompletedReport: boolean;
  activeAssignment: boolean;
  shortlisted: boolean;
  priority: RecruitmentPriority;
  note: string;
  recruitmentStatus: RecruitmentStatus;
  latestTransferOffer: TransferOffer | null;
  transferStatusLabel: string;
}

function buildCandidate(state: CareerState, playerId: string): RecruitmentCandidate | null {
  const player = getCareerPlayer(state, playerId);
  if (!player) return null; // a stale/unresolvable id must never crash the centre -- just excluded, honestly.

  const clubId = player.clubId;
  const club = getClub(clubId);
  const knowledgePct = getPlayerKnowledgePct(state, playerId, clubId);
  const tier = knowledgeTier(knowledgePct);
  const rating = getCareerPlayerRating(state, playerId, clubId);
  const visibility = rating ? resolvePlayerVisibility(rating, knowledgePct) : null;

  const contract = getPlayerContract(state, playerId);
  const contractStatus = getPlayerContractStatus(state, playerId) ?? null;
  const marketValue = getPlayerMarketValueEur(state, playerId);
  const reports = getPlayerScoutReports(state, playerId);
  const latestReport = reports[0] ?? null;
  const scoutReportView = rating ? buildScoutReportView(rating, knowledgePct, marketValue, latestReport?.scoutSuitability ?? null) : null;

  const discoveries = getPlayerScoutDiscoveries(state, playerId);
  const latestDiscovery = discoveries[0] ?? null;
  const scoutStaffId = latestReport?.scoutStaffId ?? latestDiscovery?.scoutStaffId ?? null;
  const scoutDisplayName = scoutStaffId ? (findStaffMember(state, scoutStaffId)?.displayName ?? "Okänd scout") : null;

  const target = state.recruitmentTargets[playerId];
  const offers = getPlayerTransferOffers(state, playerId);
  const latestOffer = offers[0] ?? null;

  return {
    playerId,
    firstName: player.firstName,
    lastName: player.lastName,
    clubId,
    clubName: club?.name ?? (isFreeAgentClubId(clubId) ? "Fri agent" : clubId),
    competitionId: club?.competitionId ?? "",
    position: player.position,
    ageYears: playerAge(player.dateOfBirth, player.birthYear),
    nationality: player.nationality,
    knowledgeTier: tier,
    knowledgePct,
    visibility,
    scoutReportView,
    contractEndDate: contract?.contractEndDate ?? null,
    contractStatus,
    wageEurPerMonth: contract?.wageEurPerMonth ?? null,
    discoverySource: latestDiscovery?.assignmentType ?? null,
    discoveryReasons: latestDiscovery?.reasons ?? [],
    scoutDisplayName,
    hasCompletedReport: reports.length > 0,
    activeAssignment: hasActivePlayerAssignment(state, playerId),
    shortlisted: target?.shortlisted ?? false,
    priority: target?.priority ?? "NORMAL",
    note: target?.note ?? "",
    recruitmentStatus: getRecruitmentStatus(state, playerId),
    latestTransferOffer: latestOffer,
    transferStatusLabel: transferStatusLabelSv(latestOffer),
  };
}

/**
 * Every candidate the manager has ANY reason to see in the Recruitment
 * Centre -- the union of everyone discovered, everyone ever put under a
 * PLAYER assignment, everyone with a filed report, everyone on the
 * shortlist/with a note, and everyone ever offered a transfer. Deduped
 * by playerId (a plain Set, so structurally impossible to list the same
 * candidate twice), most-recently-relevant first.
 */
export function getRecruitmentCandidates(state: CareerState): RecruitmentCandidate[] {
  const playerIds = new Set<string>();
  for (const d of Object.values(state.scoutDiscoveries)) playerIds.add(d.playerId);
  for (const a of Object.values(state.scoutingAssignments)) {
    if (a.assignmentType === "PLAYER") playerIds.add(a.targetPlayerId);
  }
  for (const r of Object.values(state.scoutReports)) playerIds.add(r.targetPlayerId);
  for (const playerId of Object.keys(state.recruitmentTargets)) playerIds.add(playerId);
  for (const o of Object.values(state.transferOffers)) playerIds.add(o.playerId);
  // HM-PLAYER-CONTRACT-LIFECYCLE-1.0 Part 6: a free agent is openly
  // available -- no scout discovery needed to know they exist, exactly
  // like the CPU candidate pool's own treatment (cpuCandidateEvaluation.ts).
  for (const p of getFreeAgents(state)) playerIds.add(p.id);

  const candidates: RecruitmentCandidate[] = [];
  for (const playerId of playerIds) {
    const candidate = buildCandidate(state, playerId);
    if (candidate) candidates.push(candidate);
  }
  return candidates.sort((a, b) => a.lastName.localeCompare(b.lastName));
}
