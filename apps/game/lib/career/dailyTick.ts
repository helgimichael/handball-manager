// Daily World Tick (HM-GAME-0.3, Spec S5-S13).
//
// Processes exactly ONE calendar day in the fixed conceptual order the
// spec requires:
//   1. Date/Calendar   2. Player availability   3. Training/Recovery
//   4. Scouting/Analysis progress   5. Club/Competition world
//   6. Fixtures   7. Table/Statistics
//   8. Career Event generation   9. Inbox delivery   10. Continue stop check
//
// HM-INJURIES-1.0: step 3 (Training/Recovery) now also advances existing
// rehab by one day and rolls new training-injury risk from today's
// executed sessions, immediately after execution -- see
// lib/medical/injuryIntegration.ts. Not a new top-level numbered step;
// injuries are a consequence OF training/recovery, not a separate phase.
//
// Steps 8+9 are folded into a single `emit()` gate used throughout (see
// below) rather than a separate pass, since every step above already
// knows exactly which event it produced. Step 10 (the stop check) is the
// Continue Controller's job (continueController.ts), not this module's --
// processDay only reports what happened; it never decides to keep going.

import {
  getPlayerFixtureOn,
  getNextPlayerFixture,
  checkSeasonComplete,
  simulateAiFixturesForDate,
} from "./calendar";
import {
  buildCompetitionUpdateEvent,
  buildMatchPreparationReadyEvent,
  buildMatchdayReadyEvent,
  buildOpponentReportReadyEvent,
  buildPlayerInjuredEvent,
  buildPlayerStatusChangedEvent,
  buildScoutReportReadyEvent,
  buildScoutDiscoveryReadyEvent,
  buildStaffReportEvent,
  buildTrainingCompletedEvent,
  buildTrainingReportEvent,
  buildPlacementExpiredEvent,
  buildPlayerContractExpiredEvent,
  buildTransferNegotiationEvent,
  type CareerEvent,
} from "./careerEvents";
import { progressContractExpiry } from "./contractExpiry";
import { progressYouthIntake } from "./youthIntake";
import { progressPlayerLifecycle } from "./playerLifecycle";
import { progressWorldDevelopment } from "./worldDevelopment";
import { applyTrainingDayInjuryResolution, progressDailyRehab } from "../medical/injuryIntegration";
import { ensureOpponentAnalysisTask, progressCareerTasks } from "./careerTasks";
import { progressScoutingAssignments } from "./scouting";
import { scopeLabelSv } from "./scoutDiscovery";
import { findStaffMember } from "../staff/staffCareerIntegration";
import {
  buildPartnershipCandidatesReadyEvent,
  buildPartnershipExpiredEvent,
  progressPartnershipBilling,
  progressPartnershipExpiry,
  progressPartnershipSearches,
} from "./clubPartnerships";
import { accrueDailyPlacementExposure, progressPlacementExpiry } from "./playerPlacements";
import { progressCpuRecruitment, progressCpuEmergencyRecruitment, cpuRecruiterClubIds, pushLog as pushCpuDecisionLog, type CpuDecisionLogEntry } from "./cpuRecruitment";
import { progressCpuContractDecisions } from "./cpuContractDecisions";
import { adjustClubCash } from "../economy/clubEconomyIntegration";
import {
  MATCH_PREPARATION_OFFSET_DAYS,
  STAFF_REPORT_INTERVAL_DAYS,
  STAFF_REPORT_OFFSET_DAYS,
  TRAINING_REPORT_INTERVAL_DAYS,
} from "./careerRhythmConfig";
import { addDays, daysBetween, isSameOrBefore } from "./dateUtils";
import { careerEventToInboxMessage } from "./inboxBridge";
import type { CareerState } from "./types";
import { executeTrainingDay } from "../training/trainingExecution";
import { applyCpuDailyCondition } from "./cpuCondition";
import { applyPlacementDevelopmentStimulus, applyTrainingDayDevelopmentStimulus, resolveWeeklyDevelopmentIfDue } from "../development/developmentIntegration";
import { progressDailyTransfers } from "../transfers/transferIntegration";
import { progressClubFinances } from "../economy/financeTick";
import { progressCompetitions } from "../competition/season";
import { progressStaff } from "../staff/staffLifecycle";
import { ensureSeasonCalendar } from "../competition/seasonCalendar";
import { progressTransferNegotiations } from "../transfers/negotiationIntegration";
import { progressPlayerDynamics } from "../players/playerDynamicsTick";

export interface DailyTickResult {
  state: CareerState;
  /** Every CareerEvent newly created (not deduplicated away) on this call, in generation order. */
  events: CareerEvent[];
}

/**
 * Processes `date`. Callers (continueController.ts) are responsible for
 * only ever calling this with `date === processedThroughDate + 1 day` --
 * that invariant, plus this function's own id-based dedup gate, is what
 * makes exactly-once processing hold (Spec S20/S27) even if a caller
 * accidentally reprocessed a date.
 */
export function processDay(state: CareerState, date: string): DailyTickResult {
  let next = state;
  const events: CareerEvent[] = [];

  function emit(candidate: CareerEvent): void {
    if (next.careerEvents.some((e) => e.id === candidate.id)) {
      return; // Idempotent: the same semantic event never duplicates (Spec S27).
    }
    next = { ...next, careerEvents: [...next.careerEvents, candidate] };
    events.push(candidate);
    if (candidate.type !== "TRAINING_COMPLETED") {
      next = { ...next, inbox: [...next.inbox, careerEventToInboxMessage(candidate, next)] };
    }
  }

  // --- HM-ALPHA3-M02: club ledgers (start missing ones, close ended months) ---
  // Collected, then emitted after the assignment: emit() appends to `next`, which the step's returned state would otherwise overwrite.
  const financeEvents: CareerEvent[] = [];
  next = progressClubFinances(next, date, (event) => financeEvents.push(event));
  financeEvents.forEach(emit);

  // --- 2. Player availability ---------------------------------------------
  for (const status of Object.values(next.playerStatuses)) {
    if (status.availability !== "AVAILABLE" && status.returnDate && isSameOrBefore(status.returnDate, date)) {
      next = {
        ...next,
        playerStatuses: { ...next.playerStatuses, [status.playerId]: { playerId: status.playerId, availability: "AVAILABLE" } },
      };
      emit(buildPlayerStatusChangedEvent(status.playerId, date, true));
    }
  }

  // --- 3. Training / Recovery ---------------------------------------------
  // HM-TRAINING-1.0: executes today's scheduled training day (idempotent
  // -- see executeTrainingDay's own doc) BEFORE the fixtures step below,
  // so a matchday's own morning-of overnight recovery is already applied
  // to `playerPhysicalState` by the time the manager can choose to play
  // the fixture (matchdayAction.ts reads it as each player's own match
  // `startingEnergy`). `executeTrainingDay` itself resolves the day's own
  // `dayType` (MATCH days never carry a scheduled session, see
  // lib/training/trainingSchedule.ts's own fixture-aware builder), so no
  // separate "is this a matchday" branch is needed here.
  next = executeTrainingDay(next, date);
  // HM-ALPHA2-02C/02C.1: CPU squads recover and train through the same
  // recovery model and default training week (once per date, before fixtures).
  next = applyCpuDailyCondition(next, date);
  // HM-INJURIES-1.0 Part 19/34: advance every already-active injury's
  // rehab by one day BEFORE rolling any new injury risk from today's
  // training -- a player who becomes injured today starts accumulating
  // rehab progress from tomorrow, never double-counted the same day.
  next = progressDailyRehab(next, date);
  const trainingInjuryResolution = applyTrainingDayInjuryResolution(next, date);
  next = trainingInjuryResolution.state;
  for (const playerId of trainingInjuryResolution.newlyInjuredPlayerIds) {
    emit(buildPlayerInjuredEvent(playerId, date));
  }
  // HM-TRAINING-1.1 Part 5/14: accumulates today's session stimulus
  // (reading the TrainingSessionResult(s) executeTrainingDay just wrote),
  // then -- only on a Sunday, and only once per player per date -- rolls
  // the week's accumulated stimulus into possible attribute changes. Both
  // are pure additive glue on top of the training/physical steps above;
  // neither can affect physical load or session execution itself.
  next = applyTrainingDayDevelopmentStimulus(next, date);
  // HM-CLUB-PARTNERSHIPS-1.1: a player on an ACTIVE B-team/development-
  // partnership placement develops at the PARTNER club instead (see
  // playerPlacements.ts) -- accumulates that day's stimulus into the
  // SAME playerDevelopmentState pipeline, BEFORE the weekly resolution
  // below, and advances each placement's own honest day-count.
  next = applyPlacementDevelopmentStimulus(next, date);
  next = accrueDailyPlacementExposure(next);
  next = resolveWeeklyDevelopmentIfDue(next, date);
  emit(buildTrainingCompletedEvent(date));
  const daysSinceStart = daysBetween(next.seasonStartDate, date);
  if (daysSinceStart > 0 && daysSinceStart % TRAINING_REPORT_INTERVAL_DAYS === 0) {
    emit(buildTrainingReportEvent(date));
  }
  if (daysSinceStart > 0 && daysSinceStart % STAFF_REPORT_INTERVAL_DAYS === STAFF_REPORT_OFFSET_DAYS) {
    emit(buildStaffReportEvent(date));
  }

  // --- 4. Scouting / Analysis progress ------------------------------------
  const upcomingFixture = getNextPlayerFixture(next);
  if (upcomingFixture) {
    const opponentClubId = upcomingFixture.homeClubId === next.playerClubId ? upcomingFixture.awayClubId : upcomingFixture.homeClubId;
    next = {
      ...next,
      tasks: ensureOpponentAnalysisTask(next.tasks, upcomingFixture.id, opponentClubId, upcomingFixture.date, date),
    };
  }
  const { tasks: progressedTasks, completed } = progressCareerTasks(next.tasks, date);
  next = { ...next, tasks: progressedTasks };
  for (const task of completed) {
    // HM-SCOUTING-1.0: the "SCOUTING" CareerTask variant is legacy/
    // unreachable (see careerTasks.ts's own header) -- every task
    // completing here today is OPPONENT_ANALYSIS. The branch stays for
    // type-safety and in case a legacy save somehow still carries one.
    if (task.type === "SCOUTING") {
      emit(buildScoutReportReadyEvent(task.id, task.targetEntity.entityId, date));
    } else {
      emit(buildOpponentReportReadyEvent(task.id, task.targetEntity.entityId, date));
    }
  }

  // HM-SCOUTING-1.0: the REAL player-scouting loop -- advances every
  // in-progress ScoutingAssignment, raising knowledge and filing a
  // report for any that complete today, reusing the exact same
  // buildScoutReportReadyEvent/emit/inbox plumbing the legacy branch
  // above already established.
  // HM-SCOUTING-1.1: the SAME call now also advances broad (CLUB/
  // COMPETITION/REGION/POSITION/AGE_BAND) assignments one discovery
  // cycle at a time -- `completed` covers BOTH kinds (a PLAYER
  // assignment's single completion, or a broad assignment's FINAL
  // cycle), while `discoveryCycles` covers every cycle that ran today
  // (including non-final ones), each producing its own inbox summary.
  const { state: afterScouting, completed: completedAssignments, discoveryCycles } = progressScoutingAssignments(next, date);
  next = afterScouting;
  for (const assignment of completedAssignments) {
    if (assignment.assignmentType === "PLAYER") {
      emit(buildScoutReportReadyEvent(assignment.id, assignment.targetPlayerId, date));
    }
  }
  for (const cycle of discoveryCycles) {
    const scoutName = findStaffMember(next, cycle.assignment.scoutStaffId)?.displayName ?? "Scouten";
    emit(buildScoutDiscoveryReadyEvent(cycle.assignment.id, cycle.assignment.cyclesCompleted - 1, scoutName, scopeLabelSv(cycle.assignment), cycle.discoveries.length, date));
  }

  // --- 5. Club / Competition world -----------------------------------------
  // HM-PLAYER-CONTRACT-LIFECYCLE-1.0: a world rule, not a CPU action --
  // any player whose contract has genuinely reached its own real end
  // date leaves their club and becomes a free agent. Runs BEFORE
  // progressDailyTransfers below so a same-day stale AGREED_AWAITING_WINDOW
  // offer for a player who just departed is caught by that function's
  // own existing 1.0B ownership guard (CANCELLED_STALE), never executed
  // against a club that no longer owns them.
  // HM-ALPHA3-M05: morale, talks, promises, renewals, incoming bids and pre-contract moves (before the expiry sweep).
  const dynamicsEvents: CareerEvent[] = [];
  next = progressPlayerDynamics(next, date, (event) => dynamicsEvents.push(event));
  dynamicsEvents.forEach(emit);
  const { state: afterContractExpiry, departures } = progressContractExpiry(next, date);
  next = afterContractExpiry;
  for (const departure of departures) {
    if (departure.fromClubId === next.playerClubId) {
      emit(buildPlayerContractExpiredEvent(departure.playerId, date));
    }
  }

  // HM-PLAYER-CAREER-LIFECYCLE-1.0: annual ageing decline + retirement --
  // a world rule, run on its own 15 June date, deliberately AFTER
  // contract expiry (31 May) has fully resolved for the season and
  // BEFORE youth intake (1 July) adds fresh graduates -- see
  // playerLifecycle.ts's own doc on this exact ordering. Silent for
  // every CPU club, one event per human-club player who actually retires.
  // HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B: quarterly world development for every
  // CPU club and the free-agent pool -- the managed club keeps its own weekly
  // training model. Runs BEFORE the lifecycle pass so a player develops before
  // being evaluated for decline/retirement in the same season.
  next = progressWorldDevelopment(next, date);

  const { state: afterLifecycle, events: lifecycleEvents } = progressPlayerLifecycle(next, date);
  next = afterLifecycle;
  for (const event of lifecycleEvents) emit(event);

  // HM-YOUTH-INTAKE-1.0: annual world-lifecycle replenishment -- a world
  // rule, same framing as contract expiry above, run right after it (a
  // fresh graduate is never swept into a stale pending transfer offer
  // below) and before the transfer-window step. Silent for every CPU
  // club (Part 17), one event for the human club's own intake.
  const { state: afterYouthIntake, events: youthIntakeEvents } = progressYouthIntake(next, date);
  next = afterYouthIntake;
  for (const event of youthIntakeEvents) emit(event);

  // HM-TRANSFERS-1.0: completes any PERMANENT deal that was AGREED while
  // the transfer window was closed (once it reopens) and returns any
  // loan whose endDate has been reached -- same "check a stored date,
  // mutate once" idiom as step 2's player-availability return above.
  next = progressDailyTransfers(next, date);
  // HM-ALPHA3-M04: staff market, negotiations, contracts, CPU staff moves.
  const staffEvents: CareerEvent[] = [];
  next = progressStaff(next, date, (event) => staffEvents.push(event));
  staffEvents.forEach(emit);

  // HM-ALPHA2-05B: answers the manager's pending negotiation offers on
  // their response dates, lets rival CPU clubs make their move, and
  // expires talks whose deadline passed -- before CPU recruitment below,
  // so a same-day CPU signing is judged against an up-to-date negotiation.
  const negotiationProgress = progressTransferNegotiations(next, date);
  next = negotiationProgress.state;
  for (const notice of negotiationProgress.notices) emit(buildTransferNegotiationEvent(notice.id, date, notice.subject, notice.summary, notice.playerId));

  // HM-CLUB-PARTNERSHIPS-1.0: the board's own multi-day partner search,
  // recurring partnership billing, and expiry -- same "check a stored
  // date, mutate once" idiom as the transfer-window step above.
  const { state: afterPartnershipSearches, completed: completedSearches } = progressPartnershipSearches(next, date);
  next = afterPartnershipSearches;
  for (const search of completedSearches) {
    emit(buildPartnershipCandidatesReadyEvent(search.id, search.clubId, date));
  }
  next = progressPartnershipBilling(next, date, (s, clubId, delta) => adjustClubCash(s, clubId, delta, { category: "PARTNERSHIPS", label: "Samarbetsavtal", date }));
  const { state: afterPartnershipExpiry, expired: expiredPartnerships } = progressPartnershipExpiry(next, date);
  next = afterPartnershipExpiry;
  for (const partnership of expiredPartnerships) {
    emit(buildPartnershipExpiredEvent(partnership.id, date));
  }

  // HM-CLUB-PARTNERSHIPS-1.1: any ACTIVE placement whose own relation is
  // no longer ACTIVE (just expired/terminated above, or already
  // otherwise inactive) is auto-ended -- the relationship that made the
  // placement possible no longer exists.
  const { state: afterPlacementExpiry, expired: expiredPlacements } = progressPlacementExpiry(next, date);
  next = afterPlacementExpiry;
  for (const placement of expiredPlacements) {
    emit(buildPlacementExpiredEvent(placement.id, placement.playerId, date));
  }

  // HM-CPU-SQUAD-BUILDING-1.0: autonomous CPU club recruitment -- a
  // lightweight, per-club rotating schedule (never a full every-club
  // every-day scan), and the first simple CPU contract RENEW/WAIT/RELEASE
  // decisions for genuinely expiring contracts. Both are silent to the
  // manager's own inbox by design (Part: "ingen transfer spam") --
  // explainability lives in state.cpuDecisionLog, not CareerEvents.
  // Never touches state.playerClubId (Part: "Human-controlled club får
  // aldrig styras av detta").
  next = progressCpuRecruitment(next, date);
  // HM-CPU-SQUAD-RESILIENCE-1.0: a narrow, every-day resilience check on
  // top of the calibrated cadence above -- see cpuRecruitment.ts's own
  // doc on why this is a separate pass rather than a change to the
  // scheduled evaluation cycle itself.
  next = progressCpuEmergencyRecruitment(next, date);
  const contractDecisions = progressCpuContractDecisions(next, date, cpuRecruiterClubIds(next));
  next = contractDecisions.state;
  const contractLogEntries: CpuDecisionLogEntry[] = contractDecisions.log.map((entry) => ({
    id: `cpu-contract-${entry.playerId}-${date}`,
    date,
    clubId: entry.clubId,
    category: "CONTRACT",
    summary: `${entry.decision} ${entry.playerId} (${entry.position})`,
    reason: entry.reason,
  }));
  next = { ...next, cpuDecisionLog: pushCpuDecisionLog(next.cpuDecisionLog, contractLogEntries) };

  // --- 6. Fixtures ---------------------------------------------------------
  const playerFixtureToday = getPlayerFixtureOn(next, date);
  const { state: afterAi, results: aiResults } = simulateAiFixturesForDate(next, date);
  next = afterAi;
  if (playerFixtureToday) {
    emit(buildMatchdayReadyEvent(playerFixtureToday.id, date));
  }

  // Match preparation, a fixed number of days before an unplayed fixture
  // (Spec S17, provisional offset -- see careerRhythmConfig.ts). Never
  // fires ON the fixture's own date -- MATCHDAY_READY owns that date.
  if (upcomingFixture && upcomingFixture.date !== date) {
    const prepDate = addDays(upcomingFixture.date, -MATCH_PREPARATION_OFFSET_DAYS);
    if (prepDate === date) {
      emit(buildMatchPreparationReadyEvent(upcomingFixture.id, date));
    }
  }

  // --- 7. Table / Statistics ------------------------------------------------
  if (aiResults.length > 0) {
    emit(buildCompetitionUpdateEvent(date, next.competitionId));
  }

  // --- HM-ALPHA3-M03: postseason, series, kval, cup, season outcome ---
  const competitionEvents: CareerEvent[] = [];
  next = progressCompetitions(ensureSeasonCalendar(next), date, (event) => competitionEvents.push(event));
  competitionEvents.forEach(emit);

  // --- Season completion (only possible once the manager's own fixtures are also resolved -- see matchdayAction.ts) ---
  next = checkSeasonComplete(next);

  // --- 1. Date / Calendar (bookkeeping close-out) ---------------------------
  next = { ...next, gameDate: date, processedThroughDate: date };

  return { state: next, events };
}
