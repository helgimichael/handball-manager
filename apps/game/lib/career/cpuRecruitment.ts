// HM-CPU-SQUAD-BUILDING-1.0: the CareerState-level glue for autonomous
// CPU club recruitment -- the ONLY module that reads/writes
// cpuRecruitmentPlans/cpuClubEvaluationSchedule/cpuDecisionLog. Ties
// together cpuSquadNeeds.ts (need assessment) + cpuCandidateEvaluation.ts
// (ranking) + transfers/transferIntegration.ts's own submitTransferOffer
// (the SAME canonical pipeline a human manager's offer goes through --
// Part: "Bypassa aldrig transferregler... Ingen separat forceCpuTransfer()").
import { type HandballPosition } from "../game-data";
import { submitTransferOffer } from "../transfers/transferIntegration";
import { isTransferWindowOpen } from "../transfers/transferWindow";
import { seededOffset } from "../rating/generation/deterministicVariation";
import { addDays, isSameOrBefore } from "./dateUtils";
import { assessPositionNeed, assessSquadNeeds, priorityNeeds, projectedSquadSize, positionEmergencyLevel, isSquadFloorEmergency, isUsableForSquadPlanning, type NeedLevel } from "./cpuSquadNeeds";
import { bestAffordableCandidate, rankCandidates } from "./cpuCandidateEvaluation";
// The SAME constant that decides a player has been "clearly replaced" on the
// release side -- one threshold governs both arrival and departure.
import { CLEARLY_REPLACED_CA_GAP } from "./cpuContractDecisions";
import { careerWorldClubIds } from "./worldCompetitions";
import type { CareerState } from "./types";

// ---------------------------------------------------------------------------
// Pacing constants (mirrors careerRhythmConfig.ts's own "provisional
// scheduling offsets" framing -- game-flow pacing, not real-world truth).
// ---------------------------------------------------------------------------

// HM-CPU-SQUAD-BUILDING-1.0B Part 8: the 1.0A market audit found ~12.5
// offers/club/season (one club up to 46) with the ORIGINAL 21-day normal
// cycle / 0-21 day initial spread -- clearly Football-Manager-grade
// churn, not plausible for professional handball. No specific target
// count is assumed here (the audit explicitly declined to invent one);
// these are the smallest calibration levers to eliminate the obvious
// spam: a longer normal cycle, a later/wider initial spread (avoiding a
// day-1 league-wide burst), and a longer post-failure cooldown. The
// urgent cycle stays materially faster than normal, per instruction.
/** Part: "Kör INTE full world-ranking varje dag" -- a balanced/no-need club is re-checked this rarely. */
export const CPU_RECRUITMENT_NORMAL_CYCLE_DAYS = 45;
/** Part: "ökad aktivitet när transfer/contract timing är relevant" -- a club with a HIGH need, or evaluated while a transfer window is open, is re-checked sooner. */
export const CPU_RECRUITMENT_URGENT_CYCLE_DAYS = 7;
/** Part: "cooldown efter misslyckad deal" -- how long a club waits before trying the SAME position again after a failed offer. */
export const CPU_RECRUITMENT_COOLDOWN_DAYS = 45;
/** Part: "begränsat antal active pursuits" -- a club never has more than this many live (SEARCHING) plans at once. */
export const CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS = 2;
/** Part: no day-1 full-market burst -- every club's very first evaluation lands at least this many days into the career, not on day 0-1. */
const INITIAL_EVALUATION_MIN_OFFSET_DAYS = 14;
/** Spread width added on top of the minimum offset above. */
const INITIAL_EVALUATION_SPREAD_DAYS = 45;

// HM-CPU-SQUAD-BUILDING-1.0C Part 1/5: the squad-size recruitment brake.
// Below `SQUAD_SIZE_LARGE_THRESHOLD` nothing here changes (a genuinely
// thin position can always be pursued, per cpuCandidateEvaluation.ts's
// own softer score-only penalty starting at 20). At or above it, a
// MEDIUM ("normal depth, could still use an upgrade") pursuit is not
// even attempted -- Part: "mycket stor squad -> inga nya LOW/MEDIUM
// luxury pursuits". HIGH need (a real positional hole, a genuine
// contract-risk replacement, a true goalkeeper shortage) is NEVER
// gated by squad size, at any size -- Part: "En klubb med 25 spelare och
// bara 1 MV ska alltså fortfarande kunna söka MV". Deliberately reuses
// the SAME number the audit script's own "squad size >= 24" outlier
// flag uses, rather than inventing a separate figure.
// HM-ALPHA3-M10: defined beside the contract decisions, which now use it too.
export { SQUAD_SIZE_LARGE_THRESHOLD } from "./cpuContractDecisions";
import { SQUAD_SIZE_LARGE_THRESHOLD } from "./cpuContractDecisions";

// HM-CPU-SQUAD-BUILDING-1.0C Part 3/4: successful-signing cooldown --
// "position solved -> längre cooldown; fortfarande HIGH efter recompute
// -> kortare/ingen cooldown; MEDIUM/LOW -> lång cooldown". Deliberately
// longer than one full normal evaluation cycle (45 days) so a completed
// signing gets genuine time to register as solved before the SAME
// position is even reconsidered -- this is what the 1.0A/B audits'
// "same position bought 10/28 times in a season" pattern was missing.
const SIGNING_SOLVED_COOLDOWN_DAYS = 75;

export const CPU_RECRUITMENT_PLAN_STATUSES = ["SEARCHING", "SUCCEEDED", "FAILED", "SATISFIED"] as const;
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
  /**
   * Blocks a NEW pursuit for this same club+position until this date --
   * set after a FAILED deal (Part: "cooldown efter misslyckad deal") AND
   * after a SUCCEEDED one that didn't leave the position genuinely still
   * HIGH (HM-CPU-SQUAD-BUILDING-1.0C Part 3: "position solved -> längre
   * cooldown"). Null means no cooldown is active -- either nothing has
   * been decided yet, or the position is still genuinely HIGH need and
   * reopening immediately is correct.
   */
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

/** Exported so other CPU-decision producers (e.g. cpuContractDecisions.ts's own log, wired in from dailyTick.ts) share the exact same cap/ordering, never a second log-writing convention. */
export function pushLog(log: readonly CpuDecisionLogEntry[], entries: readonly CpuDecisionLogEntry[]): readonly CpuDecisionLogEntry[] {
  if (entries.length === 0) return log;
  return [...entries, ...log].slice(0, DECISION_LOG_CAP);
}

/**
 * HM-MULTI-COMPETITION-WORLD-FOUNDATION-1.0: every club this career
 * treats as a live CPU recruiter -- every world-active club (Part 9:
 * "all eligible CPU-controlled clubs in the career world", via the one
 * shared `careerWorldClubIds` resolver) except the manager's own.
 * Division 1/Allsvenskan clubs now participate on the SAME engine as
 * Handbollsligan (Part 13: "Same engine... not bespoke rules") --
 * `getClubBudgets` (used inside `rankCandidates`/affordability) silently
 * returns no candidates for any club still missing a ClubEconomyBaseline,
 * so this list alone doesn't force premature recruitment for a club
 * whose economy hasn't been initialized yet.
 *
 * Before this milestone: scoped to `getClubsByCompetition(state.competitionId)`
 * only, so whichever Swedish tier ISN'T the manager's own got zero CPU
 * recruitment activity, and Division 1 (already a real candidate SOURCE
 * via `getExternalCandidateClubs`) could never actually buy anything.
 */
export function cpuRecruiterClubIds(state: CareerState): string[] {
  return careerWorldClubIds(state).filter((id) => id !== state.playerClubId);
}

/**
 * Deterministic per-club scheduling seed (Part: "same career seed + same
 * state -> same beslut") -- spreads clubs' very first evaluation date
 * across the normal cycle window so all ~14 clubs don't all evaluate on
 * the same day, without any Math.random.
 */
function initialEvaluationOffset(clubId: string): number {
  return INITIAL_EVALUATION_MIN_OFFSET_DAYS + Math.abs(seededOffset(`${clubId}:cpu-recruitment-initial-offset`, INITIAL_EVALUATION_SPREAD_DAYS));
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

  // HM-CPU-SQUAD-BUILDING-1.0B Part 6/7: any SEARCHING plan whose
  // position is no longer in `needy` (headcount, including projected
  // incoming signings, is now adequate) is cleared to SATISFIED -- Part:
  // "CPU must not create another pursuit for the same position if the
  // need is now satisfied" / "completed deal clears/re-evaluates plan".
  // This also frees its active-pursuit slot for a genuinely still-needy
  // position instead of leaving a solved search parked forever.
  const needyPositions = new Set(needy.map((p) => p.position));
  for (const plan of Object.values(next.cpuRecruitmentPlans)) {
    if (plan.clubId !== clubId || plan.status !== "SEARCHING" || needyPositions.has(plan.targetPosition)) continue;
    next = {
      ...next,
      cpuRecruitmentPlans: { ...next.cpuRecruitmentPlans, [plan.id]: { ...plan, status: "SATISFIED", lastEvaluatedAt: date, reason: "Behovet är löst -- avslutar sökningen." } },
    };
  }

  if (needy.length === 0) {
    // Part: "Balanced squad ska kunna ge NO ACTION" -- no DEPTH pursuit. But a
    // squad with no depth need at all is exactly the population
    // HM-CPU-SQUAD-QUALITY-UPGRADES-1.0 exists for, so the replacement pathway
    // still runs before returning. It logs and pursues only when a materially
    // better player is actually available; a balanced AND strong squad still
    // does nothing, which is what that requirement really protects.
    const upgraded = pursueQualityUpgrades(next, clubId, date, CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS - activePursuitCount(next, clubId));
    return { state: upgraded, urgent: false };
  }

  let slotsRemaining = CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS - activePursuitCount(next, clubId);
  const squadSize = projectedSquadSize(next, clubId);

  for (const need of needy) {
    if (slotsRemaining <= 0) break;
    // Part 1/5: a MEDIUM ("could still use an upgrade") pursuit is not
    // even attempted once the squad is already large -- HIGH need
    // (a real hole/contract-risk replacement/genuine shortage) is never
    // gated by squad size.
    if (need.level === "MEDIUM" && squadSize >= SQUAD_SIZE_LARGE_THRESHOLD) continue;

    const existing = existingPlan(next, clubId, need.position);
    if (existing?.status === "SEARCHING") continue; // Part: "duplicate pursuit prevention" -- already actively pursuing this position.
    if (existing?.cooldownUntil !== null && existing?.cooldownUntil !== undefined && !isSameOrBefore(existing.cooldownUntil, date)) continue; // Part 3/4: cooldown active -- covers both a failed deal AND a recently-solved position, regardless of the existing plan's own status.

    const result = pursuePosition(next, clubId, need.position, need.level, date);
    next = result.state;
    if (result.pursued) slotsRemaining -= 1;
  }

  // HM-CPU-SQUAD-QUALITY-UPGRADES-1.0: replacement recruitment, strictly
  // AFTER every depth need above has had its chance and only with capacity
  // left over -- depth priority is unchanged.
  next = pursueQualityUpgrades(next, clubId, date, slotsRemaining);

  return { state: next, urgent };
}

// ---------------------------------------------------------------------------
// HM-CPU-SQUAD-QUALITY-UPGRADES-1.0: the quality-upgrade pathway.
//
// THE DEFECT THIS FIXES. cpuSquadNeeds.ts is a DEPTH model: levelForCount
// returns LOW at 3+ players, priorityNeeds pursues only HIGH/MEDIUM, and
// qualityAdjustedLevel hard-gates itself off once effectiveCount reaches
// ADEQUATE_DEPTH_COUNT. So once every position had three bodies a club became
// permanently self-satisfied, however weak it was. Measured over a 30-season
// canonical world: Handbollsligan carried ~84 generated players below CA 98
// while 98 CA130+ generated players played in lower divisions, and the top
// flight settled at mean CA 111.8 against 131.3 under perfect allocation --
// i.e. the world already contained the quality, it simply never moved.
//
// WHY NOT LOW -> MEDIUM. That was the first design and it is provably dead:
// evaluateClub skips MEDIUM entirely once projectedSquadSize reaches
// SQUAD_SIZE_LARGE_THRESHOLD (24), and Handbollsligan squads average exactly
// 24. The branch would never have produced a pursuit for the squads it exists
// to improve. MEDIUM also means "needs another body", which is the opposite of
// what this is -- so it is a separate pathway, not an overloaded need level.
//
// REPLACEMENT, NOT ACCUMULATION. Qualification compares the best AFFORDABLE
// candidate the ordinary ranker returns against the WEAKEST USABLE INCUMBENT
// at that same position, and requires CLEARLY_REPLACED_CA_GAP. That is the
// same constant cpuContractDecisions.ts already uses to decide a player is
// "clearly replaced" (positionRank >= 2 && caGapToPositionBest >= gap), so
// every upgrade this path signs is one the existing release path will act on
// -- one threshold governs both arrival and departure, never two.
//
// WHY IT CANNOT RUN AWAY. The historic failure (clubs with 7-11 goalkeepers)
// came from a rule keyed on a LOW AVERAGE: buying cheap depth lowered the
// average and re-triggered the same rule on its own output. This rule is keyed
// on beating the weakest incumbent by 12, so each successful upgrade RAISES
// that position's floor and the next one needs a strictly better player --
// monotonically convergent rather than divergent. Squad size is additionally
// bounded outright: the club must be under SQUAD_SIZE_LARGE_THRESHOLD + 1, so
// exactly one replacement may be in flight and 24 -> 25 is the only growth
// possible before a displaced incumbent leaves.
// ---------------------------------------------------------------------------

/** Maximum projected squad size at which a quality upgrade may START -- allows exactly one in-flight replacement (24 -> 25), never a second. */
export const UPGRADE_MAX_PROJECTED_SQUAD_SIZE = SQUAD_SIZE_LARGE_THRESHOLD + 1;

/** The weakest usable incumbent's CA at `position`, or undefined when the position has nobody usable (then it is a DEPTH problem, not an upgrade one). */
function weakestUsableIncumbentCA(state: CareerState, clubId: string, position: HandballPosition): number | undefined {
  const ratings = state.gameplayRatings[clubId] ?? [];
  const caById = new Map(ratings.map((r) => [r.playerId, r.ca]));
  let weakest: number | undefined;
  for (const player of state.worldSquads[clubId] ?? []) {
    if (player.position !== position) continue;
    if (!isUsableForSquadPlanning(state, player)) continue;
    const ca = caById.get(player.id) ?? player.currentAbility;
    if (typeof ca !== "number") continue;
    if (weakest === undefined || ca < weakest) weakest = ca;
  }
  return weakest;
}

/**
 * True while a permanent signing this club has already committed to has not
 * physically joined yet (an AGREED_AWAITING_WINDOW deal). Starting a second
 * quality upgrade before the first one lands would commit the club to two
 * bodies against one piece of capacity.
 *
 * This is the whole safety condition, and it is deliberately narrow. An earlier
 * design also tried to infer "the arrival HAS joined but the incumbent it
 * outclasses is still here" from positionStanding + CLEARLY_REPLACED_CA_GAP.
 * That was WRONG, and measurably so: **52 of 52 CPU clubs already satisfy it at
 * S0, before any upgrade has ever happened**, because an ordinary squad has a
 * starter and a weaker backup at the same position (Alingsås carried a keeper
 * 29 CA behind their best; Ymo an M6 38 behind). It classified normal squad
 * structure as an unresolved replacement and switched the whole feature off for
 * every club permanently -- that, not the contract lifecycle, is what cut
 * arrivals from 8 to 2.
 *
 * Runaway accumulation is prevented by size, which is what the historic 7-11
 * goalkeeper failure was actually about: projected permanent squad size may
 * never exceed UPGRADE_MAX_PROJECTED_SQUAD_SIZE, and one evaluation pass may
 * start at most one upgrade.
 */
function hasCommittedIncomingArrival(state: CareerState, clubId: string): boolean {
  const usable = (state.worldSquads[clubId] ?? []).filter((p) => isUsableForSquadPlanning(state, p));
  return projectedSquadSize(state, clubId) > usable.length;
}

/**
 * Considers every ADEQUATE-DEPTH position for a replacement signing. Depth
 * needs have already been served by the caller; `slotsRemaining` is whatever
 * the active-pursuit cap left behind.
 */
function pursueQualityUpgrades(state: CareerState, clubId: string, date: string, slotsRemaining: number): CareerState {
  if (slotsRemaining <= 0) return state;
  // Absolute temporary ceiling -- retained as a safety net.
  if (projectedSquadSize(state, clubId) >= UPGRADE_MAX_PROJECTED_SQUAD_SIZE) return state;
  // ...and never a second commitment against the same capacity.
  if (hasCommittedIncomingArrival(state, clubId)) return state;

  let next = state;
  const assessment = assessSquadNeeds(next, clubId, date);
  // Only positions the depth model considers adequately staffed -- a HIGH or
  // MEDIUM position is a shortage and was already handled as one.
  const adequate = assessment.positions.filter((p) => p.level === "LOW" || p.level === "NONE");

  for (const position of adequate) {
    if (slotsRemaining <= 0) break;
    if (projectedSquadSize(next, clubId) >= UPGRADE_MAX_PROJECTED_SQUAD_SIZE) break;
    // A saturated position is explicitly full, not merely low-need -- exactly
    // what assessPositionNeed's own `saturated` flag was exposed for. Without
    // this the whole-squad size ceiling alone permits POSITIONAL runaway: an
    // adversarial stress fixture (goalkeepers at CA 60 behind outfielders at
    // CA 130, so a keeper is always the best available upgrade) drove clubs to
    // SEVEN goalkeepers inside the 25-player ceiling -- squarely back in the
    // historic 7-11 failure range this pathway must never reopen.
    if (position.saturated) continue;

    const existing = existingPlan(next, clubId, position.position);
    if (existing?.status === "SEARCHING") continue; // duplicate-pursuit prevention, exactly as for depth needs.
    if (existing?.cooldownUntil !== null && existing?.cooldownUntil !== undefined && !isSameOrBefore(existing.cooldownUntil, date)) continue;

    const weakest = weakestUsableIncumbentCA(next, clubId, position.position);
    if (weakest === undefined) continue;

    // The REAL candidate the ordinary pipeline would sign -- same ranking,
    // same affordability, same reach, same scouting gates. Never a
    // hypothetical global best, and never an unaffordable one.
    const chosen = bestAffordableCandidate(rankCandidates(next, clubId, position.position, date));
    if (!chosen || chosen.ca - weakest < CLEARLY_REPLACED_CA_GAP) continue;

    next = {
      ...next,
      cpuDecisionLog: pushLog(next.cpuDecisionLog, [{
        id: `cpu-upgrade-${clubId}-${position.position}-${date}`,
        date,
        clubId,
        category: "SQUAD_NEED",
        summary: `Upgrade: ${position.position} — +${Math.round(chosen.ca - weakest)} CA`,
        reason: `Djupet räcker, men en klart bättre spelare (nivå ${Math.round(chosen.ca)}) kan ersätta klubbens svagaste på positionen (nivå ${Math.round(weakest)}).`,
      }]),
    };

    const result = pursuePosition(next, clubId, position.position, "MEDIUM", date);
    next = result.state;
    if (result.pursued) {
      // A pursued upgrade IS an unresolved replacement by definition, so this
      // club is done considering upgrades until the displaced incumbent goes.
      // Without this break the loop would keep walking the remaining positions
      // and stack one replacement per position in a single pass.
      break;
    }
  }

  return next;
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

  // HM-CPU-SQUAD-BUILDING-1.0C Part 3/4: after a successful signing,
  // recompute the position's own need on the POST-offer state (an
  // AGREED_AWAITING_WINDOW signee already counts via pendingIncoming --
  // Part 6/7 -- so this reflects the deal that JUST happened, not a
  // stale pre-signing view). Still genuinely HIGH -> no cooldown, reopen
  // immediately (a real hole one signing didn't fully close). Anything
  // else (solved, or only partially solved down to MEDIUM/LOW) -> a long
  // cooldown, giving the signing real time to matter before the SAME
  // position is reconsidered.
  let cooldownUntil: string | null;
  if (!succeeded) {
    cooldownUntil = addDays(date, CPU_RECRUITMENT_COOLDOWN_DAYS);
  } else {
    const postSquad = afterOffer.worldSquads[clubId] ?? [];
    const postNeed = assessPositionNeed(afterOffer, clubId, position, postSquad);
    cooldownUntil = postNeed.level === "HIGH" ? null : addDays(date, SIGNING_SOLVED_COOLDOWN_DAYS);
  }

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
    cooldownUntil,
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

// ---------------------------------------------------------------------------
// HM-CPU-SQUAD-RESILIENCE-1.0: a narrow, EVERY-DAY resilience pass, kept
// entirely separate from the calibrated 1.0C evaluation cadence above
// (Part 3: "Emergency should override only timing" -- never the
// underlying pursuit/candidate/cooldown/affordability machinery, all
// reused completely unmodified via the SAME pursuePosition/existingPlan/
// activePursuitCount helpers above). Exists because 1.0C's own "already
// SEARCHING -> skip forever" duplicate-pursuit guard (correct for
// ordinary churn, Part: prevents re-spamming an unaffordable candidate
// search daily) has a real timing gap for a genuine acute hole: once the
// very first pursuit attempt finds no affordable/available candidate,
// that exact position is never retried again until it stops being needy
// entirely -- a club can sit with 0-1 usable goalkeepers for weeks simply
// because nothing ever re-checks whether the candidate pool has since
// improved (a free agent appeared, another club released a keeper). This
// pass runs unconditionally for every CPU club every day (cheap: one
// assessSquadNeeds pass per club) specifically so a sudden hole -- e.g. a
// 31 May contract-expiry wave (Part 8) -- is detected the very next day,
// not whenever the club's own pre-existing, pre-emergency
// cpuClubEvaluationSchedule entry next happens to fall due.
// ---------------------------------------------------------------------------

/** Part 3: "a few days, not same-day" -- deliberately much shorter than the normal 45-day cycle but not literally daily, so a genuinely stuck emergency retries the market a handful of times before resolving, never every single day (Part: "Do not return to daily market spam"). */
export const CPU_EMERGENCY_RETRY_DAYS = 3;

function daysBetweenIso(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000);
}

/**
 * Runs for every CPU club every day. Only ACTS (a real pursuit attempt)
 * when a genuine emergency exists (Part 2: 0-1 usable goalkeepers, an
 * outright-empty field position, or a critically small whole squad with
 * no single position individually flagged -- Part 7's own "pick the most
 * severe actual positional need" fallback, never every position at
 * once), and even then throttled to CPU_EMERGENCY_RETRY_DAYS via the SAME
 * CpuRecruitmentPlan.lastEvaluatedAt every position already persists --
 * no new CareerState field, no second scheduling truth. A retry of an
 * already-SEARCHING plan never consumes a fresh active-pursuit slot (it
 * was already counted); a genuinely NEW pursuit still respects the same
 * CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS cap and cooldownUntil guard as the
 * calibrated cadence above (Part 4). Never touches `state.playerClubId`
 * (cpuRecruiterClubIds already excludes it, same as progressCpuRecruitment).
 *
 * WHICH clubs/positions count as emergency today is decided ONCE, from
 * `state` as it stood at the START of this pass -- deliberately never
 * re-derived against the evolving `next` mid-loop. Without this, one
 * club's own emergency purchase can create a genuine, fresh emergency for
 * the SELLING club (e.g. a thin club selling its last spare goalkeeper),
 * and since that seller is processed later in the very same daily pass,
 * it would immediately buy the exact same scarce candidate back --
 * a same-day ping-pong confirmed during this milestone's own testing.
 * Freezing today's target list to pass-start means that knock-on
 * emergency is still caught -- on TOMORROW's pass, once -- rather than
 * the same player bouncing between two clubs within a single day. Candidate
 * ranking/affordability/cooldowns themselves still always read the fully
 * up-to-date `next` (no staleness there, only in "is this club emergency
 * today").
 */
export function progressCpuEmergencyRecruitment(state: CareerState, date: string): CareerState {
  let next = state;

  const clubTargets = new Map<string, ReturnType<typeof priorityNeeds>>();
  for (const clubId of cpuRecruiterClubIds(state)) {
    const squad = state.worldSquads[clubId] ?? [];
    if (squad.length === 0) continue;
    const assessment = assessSquadNeeds(state, clubId, date);
    let targets = assessment.positions.filter((p) => positionEmergencyLevel(p.position, p.projectedDepth) !== "NONE");
    if (targets.length === 0 && isSquadFloorEmergency(projectedSquadSize(state, clubId))) {
      const worst = priorityNeeds(assessment)[0];
      if (worst) targets = [worst];
    }
    if (targets.length > 0) clubTargets.set(clubId, targets);
  }

  for (const [clubId, targets] of clubTargets) {
    let slotsRemaining = CPU_RECRUITMENT_MAX_ACTIVE_PURSUITS - activePursuitCount(next, clubId);
    for (const target of targets) {
      const existing = existingPlan(next, clubId, target.position);
      const isRetry = existing?.status === "SEARCHING";
      if (isRetry) {
        if (existing.lastEvaluatedAt && daysBetweenIso(existing.lastEvaluatedAt, date) < CPU_EMERGENCY_RETRY_DAYS) continue;
      } else if (slotsRemaining <= 0) {
        continue; // a genuinely new pursuit still respects the active-pursuit cap (Part 4).
      }
      if (existing?.cooldownUntil !== null && existing?.cooldownUntil !== undefined && !isSameOrBefore(existing.cooldownUntil, date)) continue; // cooldown still respected (Part 4).

      const result = pursuePosition(next, clubId, target.position, target.level, date);
      next = result.state;
      if (result.pursued && !isRetry) slotsRemaining -= 1;
    }
  }

  return next;
}

export function getCpuRecruitmentPlansForClub(state: CareerState, clubId: string): CpuRecruitmentPlan[] {
  return Object.values(state.cpuRecruitmentPlans).filter((p) => p.clubId === clubId);
}

export function getCpuDecisionLogForClub(state: CareerState, clubId: string, limit = 30): CpuDecisionLogEntry[] {
  return state.cpuDecisionLog.filter((e) => e.clubId === clubId).slice(0, limit);
}
