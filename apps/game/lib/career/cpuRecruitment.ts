// HM-CPU-SQUAD-BUILDING-1.0: the CareerState-level glue for autonomous
// CPU club recruitment -- the ONLY module that reads/writes
// cpuRecruitmentPlans/cpuClubEvaluationSchedule/cpuDecisionLog. Ties
// together cpuSquadNeeds.ts (need assessment) + cpuCandidateEvaluation.ts
// (ranking) + transfers/transferIntegration.ts's own submitTransferOffer
// (the SAME canonical pipeline a human manager's offer goes through --
// Part: "Bypassa aldrig transferregler... Ingen separat forceCpuTransfer()").
import { getClubsByCompetition, type HandballPosition } from "../game-data";
import { submitTransferOffer } from "../transfers/transferIntegration";
import { isTransferWindowOpen } from "../transfers/transferWindow";
import { seededOffset } from "../rating/generation/deterministicVariation";
import { addDays, isSameOrBefore } from "./dateUtils";
import { assessSquadNeeds, priorityNeeds, type NeedLevel } from "./cpuSquadNeeds";
import { bestAffordableCandidate, rankCandidates } from "./cpuCandidateEvaluation";
import type { CareerState } from "./types";

// ---------------------------------------------------------------------------
// Pacing constants (mirrors careerRhythmConfig.ts's own "provisional
// scheduling offsets" framing -- game-flow pacing, not real-world truth).
// ---------------------------------------------------------------------------

/** Part: "Kör INTE full world-ranking varje dag" -- a balanced/no-need club is re-checked this rarely. */
export const CPU_RECRUITMENT_NORMAL_CYCLE_DAYS = 21;
/** Part: "ökad aktivitet när transfer/contract timing är relevant" -- a club with a HIGH need, or evaluated while a transfer window is open, is re-checked sooner. */
export const CPU_RECRUITMENT_URGENT_CYCLE_DAYS = 7;
/** Part: "cooldown efter misslyckad deal" -- how long a club waits before trying the SAME position again after a failed offer. */
export const CPU_RECRUITMENT_COOLDOWN_DAYS = 30;
/** Part: "begränsat antal active pursuits" -- a club never has more than this many live (SEARCHING) plans at once. */
export const CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS = 2;

export const CPU_RECRUITMENT_PLAN_STATUSES = ["SEARCHING", "SUCCEEDED", "FAILED"] as const;
export type CpuRecruitmentPlanStatus = (typeof CPU_RECRUITMENT_PLAN_STATUSES)[number];

/**
 * One row per (clubId, targetPosition) -- Part: "Persist endast det
 * management-state som behövs" / "Duplicera INTE transfer offer state"
 * (only `offerId` is a reference, never a copy of the offer's own
 * fields). Re-evaluating the same club+position always upserts this SAME
 * row (the composite id below), which is what makes duplicate-pursuit
 * prevention and cooldown checks a simple single-key lookup rather than
 * a list scan.
 */
export interface CpuRecruitmentPlan {
  id: string;
  clubId: string;
  targetPosition: HandballPosition;
  need: NeedLevel;
  candidatePlayerId: string | null;
  status: CpuRecruitmentPlanStatus;
  createdAt: string;
  lastEvaluatedAt: string;
  offerId: string | null;
  /** Only meaningful when status === "FAILED" -- a new pursuit for this same club+position is blocked until this date. */
  cooldownUntil: string | null;
  reason: string;
}

/** Explainability trail (Part: "Vi måste kunna förstå varför CPU agerar") -- bounded, most-recent-first, never a full unbounded history. */
export interface CpuDecisionLogEntry {
  id: string;
  date: string;
  clubId: string;
  category: "SQUAD_NEED" | "CANDIDATE" | "CONTRACT";
  summary: string;
  reason: string;
}

const DECISION_LOG_CAP = 200;

function planId(clubId: string, position: HandballPosition): string {
  return `${clubId}:${position}`;
}

function pushLog(log: readonly CpuDecisionLogEntry[], entries: readonly CpuDecisionLogEntry[]): readonly CpuDecisionLogEntry[] {
  if (entries.length === 0) return log;
  return [...entries, ...log].slice(0, DECISION_LOG_CAP);
}

/** Every club this milestone treats as a live CPU recruiter -- every OTHER club in the manager's own simulated competition (the only clubs with a real ClubEconomyBaseline, per Economy 1.0's own scope -- Part: "Ingen gratis CPU-ekonomi"). Division 1/World Pool clubs remain candidate SOURCES only, never active buyers themselves (no persisted budget to check). */
export function cpuRecruiterClubIds(state: CareerState): string[] {
  return getClubsByCompetition(state.competitionId)
    .map((c) => c.id)
    .filter((id) => id !== state.playerClubId);
}

/**
 * Deterministic per-club scheduling seed (Part: "same career seed + same
 * state -> same beslut") -- spreads clubs' very first evaluation date
 * across the normal cycle window so all ~14 clubs don't all evaluate on
 * the same day, without any Math.random.
 */
function initialEvaluationOffset(clubId: string): number {
  return Math.abs(seededOffset(`${clubId}:cpu-recruitment-initial-offset`, CPU_RECRUITMENT_NORMAL_CYCLE_DAYS));
}

function ensureSchedule(state: CareerState, clubIds: readonly string[], date: string): CareerState {
  let next = state;
  for (const clubId of clubIds) {
    if (next.cpuClubEvaluationSchedule[clubId] !== undefined) continue;
    next = { ...next, cpuClubEvaluationSchedule: { ...next.cpuClubEvaluationSchedule, [clubId]: addDays(date, initialEvaluationOffset(clubId)) } };
  }
  return next;
}

function activePursuitCount(state: CareerState, clubId: string): number {
  return Object.values(state.cpuRecruitmentPlans).filter((p) => p.clubId === clubId && p.status === "SEARCHING").length;
}

function existingPlan(state: CareerState, clubId: string, position: HandballPosition): CpuRecruitmentPlan | undefined {
  return state.cpuRecruitmentPlans[planId(clubId, position)];
}

/** One club's own evaluation pass: assess needs, log them, then pursue as many HIGH/MEDIUM positions as the active-pursuit cap and cooldowns allow. Returns whether this pass was "urgent" (drives the next scheduling interval). */
function evaluateClub(state: CareerState, clubId: string, date: string): { state: CareerState; urgent: boolean } {
  let next = state;
  const assessment = assessSquadNeeds(next, clubId, date);
  const needy = priorityNeeds(assessment);
  const urgent = needy.some((p) => p.level === "HIGH") || isTransferWindowOpen(date);

  const logEntries: CpuDecisionLogEntry[] = needy.map((p) => ({
    id: `cpu-need-${clubId}-${p.position}-${date}`,
    date,
    clubId,
    category: "SQUAD_NEED",
    summary: `Need: ${p.position} — ${p.level}`,
    reason: p.reason,
  }));
  next = { ...next, cpuDecisionLog: pushLog(next.cpuDecisionLog, logEntries) };

  if (needy.length === 0) {
    return { state: next, urgent: false }; // Part: "Balanced squad ska kunna ge NO ACTION" -- nothing logged as a pursuit, nothing pursued.
  }

  let slotsRemaining = CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS - activePursuitCount(next, clubId);

  for (const need of needy) {
    if (slotsRemaining <= 0) break;
    const existing = existingPlan(next, clubId, need.position);
    if (existing?.status === "SEARCHING") continue; // Part: "duplicate pursuit prevention" -- already actively pursuing this position.
    if (existing?.status === "FAILED" && existing.cooldownUntil !== null && !isSameOrBefore(existing.cooldownUntil, date)) continue; // Part: "cooldown efter misslyckad deal".

    const result = pursuePosition(next, clubId, need.position, need.level, date);
    next = result.state;
    if (result.pursued) slotsRemaining -= 1;
  }

  return { state: next, urgent };
}

/**
 * Ranks candidates for one club+position, and if an affordable one
 * exists, submits a REAL transfer offer through submitTransferOffer
 * (Part: "CPU ska använda canonical transfer/contract pipelines precis
 * som human club"). Always upserts the plan row, whether or not a
 * candidate/offer resulted, so the persisted state honestly reflects
 * "this club is searching for this position" either way.
 */
function pursuePosition(state: CareerState, clubId: string, position: HandballPosition, need: NeedLevel, date: string): { state: CareerState; pursued: boolean } {
  const candidates = rankCandidates(state, clubId, position, date);
  const chosen = bestAffordableCandidate(candidates);
  const id = planId(clubId, position);

  const candidateLog: CpuDecisionLogEntry[] = candidates.slice(0, 3).map((c, i) => ({
    id: `cpu-candidate-${clubId}-${position}-${date}-${i}`,
    date,
    clubId,
    category: "CANDIDATE",
    summary: `Candidate: ${c.playerId}${i === 0 && chosen?.playerId === c.playerId ? " (vald)" : ""}`,
    reason: c.reason,
  }));

  if (!chosen) {
    const plan: CpuRecruitmentPlan = {
      id,
      clubId,
      targetPosition: position,
      need,
      candidatePlayerId: null,
      status: "SEARCHING",
      createdAt: state.cpuRecruitmentPlans[id]?.createdAt ?? date,
      lastEvaluatedAt: date,
      offerId: null,
      cooldownUntil: null,
      reason: candidates.length === 0 ? "Inga verkliga kandidater hittades på positionen." : "Ingen kandidat inom budget just nu.",
    };
    const next = {
      ...state,
      cpuRecruitmentPlans: { ...state.cpuRecruitmentPlans, [id]: plan },
      cpuDecisionLog: pushLog(state.cpuDecisionLog, candidateLog),
    };
    return { state: next, pursued: false };
  }

  const { state: afterOffer, offer } = submitTransferOffer(state, {
    dealType: "PERMANENT",
    playerId: chosen.playerId,
    toClubId: clubId,
    transferFeeEur: chosen.estimatedFeeEur,
    newWageEurPerMonth: chosen.estimatedWageEurPerMonth,
    contractYears: 3,
  });

  const succeeded = offer.status === "COMPLETED" || offer.status === "AGREED_AWAITING_WINDOW";
  const plan: CpuRecruitmentPlan = {
    id,
    clubId,
    targetPosition: position,
    need,
    candidatePlayerId: chosen.playerId,
    status: succeeded ? "SUCCEEDED" : "FAILED",
    createdAt: state.cpuRecruitmentPlans[id]?.createdAt ?? date,
    lastEvaluatedAt: date,
    offerId: offer.id,
    cooldownUntil: succeeded ? null : addDays(date, CPU_RECRUITMENT_COOLDOWN_DAYS),
    reason: offer.clubDecisionReason ?? offer.playerDecisionReason ?? (succeeded ? "Erbjudandet accepterades." : `Affären gick inte igenom (${offer.status}).`),
  };

  const next = {
    ...afterOffer,
    cpuRecruitmentPlans: { ...afterOffer.cpuRecruitmentPlans, [id]: plan },
    cpuDecisionLog: pushLog(afterOffer.cpuDecisionLog, [
      ...candidateLog,
      { id: `cpu-offer-${offer.id}`, date, clubId, category: "CANDIDATE" as const, summary: `Offer ${succeeded ? "succeeded" : "failed"}: ${chosen.playerId} (${position})`, reason: plan.reason },
    ]),
  };
  return { state: next, pursued: true };
}

/**
 * dailyTick.ts step-5 hook -- processes every CPU club whose own
 * `nextEvaluationDate` is due, each on its own independent schedule
 * (Part: "rotating batches eller scheduled evaluation" -- mirrors
 * scouting.ts's own per-entity end-date progression, never a full
 * every-club-every-day scan). Never touches `state.playerClubId` (Part:
 * "Human-controlled club får aldrig styras av detta").
 */
export function progressCpuRecruitment(state: CareerState, date: string): CareerState {
  const clubIds = cpuRecruiterClubIds(state);
  let next = ensureSchedule(state, clubIds, date);

  const due = clubIds.filter((id) => isSameOrBefore(next.cpuClubEvaluationSchedule[id], date));
  for (const clubId of due) {
    const result = evaluateClub(next, clubId, date);
    next = result.state;
    const interval = result.urgent ? CPU_RECRUITMENT_URGENT_CYCLE_DAYS : CPU_RECRUITMENT_NORMAL_CYCLE_DAYS;
    next = { ...next, cpuClubEvaluationSchedule: { ...next.cpuClubEvaluationSchedule, [clubId]: addDays(date, interval) } };
  }

  return next;
}

export function getCpuRecruitmentPlansForClub(state: CareerState, clubId: string): CpuRecruitmentPlan[] {
  return Object.values(state.cpuRecruitmentPlans).filter((p) => p.clubId === clubId);
}

export function getCpuDecisionLogForClub(state: CareerState, clubId: string, limit = 30): CpuDecisionLogEntry[] {
  return state.cpuDecisionLog.filter((e) => e.clubId === clubId).slice(0, limit);
}
