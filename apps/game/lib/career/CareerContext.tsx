"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from "react";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import { getActiveSave, saveCareerState, type CareerSave } from "../save/saveRepository";
import { continueCareerRhythm, type ContinueStopReason } from "./continueController";
import { addDays } from "./dateUtils";
import { archiveMessage, markMessageRead, unarchiveMessage } from "./inboxActions";
import { playManagerFixture } from "./matchdayAction";
import { applyMidMatchTacticalChange } from "./tacticalMidMatchChange";
import { applyMidMatchPlanChange } from "./matchPlanMidMatchChange";
import { updateTacticalProfile } from "./tacticalProfileActions";
import { updatePlayerSquadStatus, type SquadStatusTier } from "./squadStatus";
import { setMatchPlan, setPlayerMatchDefault } from "./matchPlanActions";
import { setSpecialPlayPlan } from "./specialPlayActions";
import { startLiveMatchSession, updateLiveMatchSession, clearLiveMatchSession } from "./liveMatchSessionActions";
import {
  addTrainingSessionAction,
  applyWeeklyTemplateAction,
  removeTrainingSessionAction,
  setTrainingDayTypeAction,
  updateTrainingSessionAction,
} from "./trainingScheduleActions";
import { setPlayerIndividualFocus, setPlayerTrainingLoad } from "../training/trainingSchedule";
import { bookFriendly } from "./preseason";
import { submitTransferOffer, type SubmitTransferOfferParams } from "../transfers/transferIntegration";
import { runNegotiationAction, type NegotiationAction, type NegotiationActionResult } from "../transfers/negotiationIntegration";
import type { TransferOffer } from "../transfers/types";
import {
  createScoutingAssignment,
  createBroadScoutingAssignment,
  cancelScoutingAssignment,
  type CreateScoutingAssignmentResult,
  type ScoutAssignmentType,
  type BroadScoutAssignmentScope,
} from "./scouting";
import { addToShortlist, removeFromShortlist, setRecruitmentPriority, setRecruitmentNote, type RecruitmentPriority } from "./recruitment";
import {
  requestPartnershipSearch,
  startDevelopmentPartnership,
  terminatePartnership,
  renewPartnership,
  type RequestPartnershipSearchResult,
  type StartDevelopmentPartnershipResult,
} from "./clubPartnerships";
import { signFreeAgentScout, type SignFreeAgentScoutResult } from "../staff/scoutPool";
import {
  recallPlayerFromPlacement,
  startInternationalPartnershipLoan,
  startPlacement,
  type StartPartnershipLoanResult,
  type StartPlacementResult,
} from "./playerPlacements";
import type { SessionSeed } from "../training/trainingSchedule";
import type { PlayerTrainingLoadSetting, TrainingDayType, TrainingSession, WeeklyTrainingTemplate } from "../training/types";
import type { PlayerMatchDefault } from "../matchPlan/persistentDefaults";
import type { SpecialPlayPlan } from "../matchPlan/specialPlay";
import type { TeamTacticalProfile } from "./teamTacticalProfile";
import type { OpponentAdaptationEffect } from "./opponentAdaptation";
import type { CareerEvent } from "./careerEvents";
import type { CareerState } from "./types";
import type { MatchPlan } from "../matchPlan/types";
import type { MatchPlanChange } from "../liveMatch/matchPlanChange";
import type { LiveMatchSessionState } from "../liveMatch/liveMatchSession";
import { offerStaffContract, type StaffOfferParams, type StaffOfferResult } from "../staff/staffRecruitment";
import { getOrCreateCareerState } from './careerInitialization';
import { withoutReplayPayloads } from './matchArchiveSummary';
import { syncManagementInbox } from './management';
import { afterNextPaint } from '../ui/afterNextPaint';

type CareerContextValue = {
  save: CareerSave;
  career: CareerState;
  /**
   * CONTINUE (HM-GAME-0.3): advances the Career Rhythm world through
   * unprocessed days until a stop condition is reached, and persists.
   * Returns every CareerEvent generated this press, and why it stopped,
   * so the caller can navigate appropriately (e.g. to Match Preview on
   * MATCHDAY_READY, or to the Inbox on an IMPORTANT stop).
   */
  continueCareer: () => { events: CareerEvent[]; stopReason: ContinueStopReason; daysProcessed: number; startDate: string };
  /** Resolves the manager's own MATCHDAY_READY fixture for the current date and persists. */
  playManagerFixture: () => { result: FastMatchResult | null };
  updateCareer: (update: (state: CareerState) => CareerState) => void;
  /** Marks one Inbox message (and its linked CareerEvent, if any) as read, and persists. */
  markInboxMessageRead: (messageId: string) => void;
  /** Archives one Inbox message. No-ops (and the caller should not assume success) for an unresolved ACTION_REQUIRED message (Spec §25). */
  archiveInboxMessage: (messageId: string) => void;
  /** Restores one archived Inbox message to the active Inbox. */
  unarchiveInboxMessage: (messageId: string) => void;
  /** Updates only the manager's TeamTacticalProfile (HM-TACTICS-0.6A), and persists. Not consumed by Fast Match yet. */
  updateTacticalProfile: (changes: Partial<TeamTacticalProfile>) => void;
  /** HM-DATA-ALLSVENSKAN-1.1B Part 3: the manager's explicit edit of one player's persistent SquadStatusTier, and persists. Separate from MatchUsage/MatchPlan and from live medical/discipline availability. */
  updateSquadStatus: (playerId: string, tier: SquadStatusTier) => void;
  /** HM-STAFF-CAREER-1.0 Part 4: resolves one staff recruitment offer synchronously (affordability -> candidate decision -> execution) and persists on COMPLETED. Never throws -- every outcome (including a rejection) is returned in the result. */
  offerStaffContract: (params: StaffOfferParams) => StaffOfferResult;
  /**
   * Saves (or replaces) one fixture's MatchPlan (HM-TACTICS-1.1), and
   * persists. Accepts either a complete plan or an updater function
   * `(prev) => next` -- prefer the updater form when the new plan is
   * derived from the current one, so rapid sequential edits from the
   * same panel always apply against the latest state rather than a
   * stale prop snapshot. Never touches TeamTacticalProfile or any other
   * fixture's plan. Not consumed by Fast Match yet.
   */
  updateMatchPlan: (fixtureId: string, planOrUpdater: MatchPlan | ((prev: MatchPlan) => MatchPlan)) => void;
  /** HM-MATCH-1.2 Part C: promotes a player's current match usage into their persistent standard -- "Använd som standard". */
  setPlayerMatchDefault: (playerId: string, value: PlayerMatchDefault) => void;
  /** HM-MATCH-1.2 Part H: updates the club's persistent Specialspel plan (6v5/5v6/defensive special situations). */
  updateSpecialPlay: (clubId: string, plan: SpecialPlayPlan) => void;
  /**
   * HM-TACTICS-0.7: splices an ADOPTED in-match tactical instruction onto
   * a fixture's already-stored FastMatchResult (preserving the prefix
   * already revealed by Live Match) and persists. Callers must only
   * invoke this once an instruction's headless adoption delay has
   * elapsed (see lib/liveMatch/tacticalInstruction.ts) -- it does not
   * itself gate on any delay.
   */
  applyMidMatchTacticalChange: (
    fixtureId: string,
    adoptionMinute: number,
    profile: TeamTacticalProfile,
    sevenVSixActive: boolean,
    opponentAdaptation: OpponentAdaptationEffect | null,
  ) => void;
  /**
   * HM-COACHING-1.0: splices an ADOPTED live MatchPlan coaching change
   * onto a fixture's already-stored FastMatchResult (same prefix-
   * preservation invariant as applyMidMatchTacticalChange above), and
   * records the fixture's new current live plan + a change-history
   * entry. Callers must only invoke this once the change's own
   * (deterministic) adoption delay has elapsed -- see
   * lib/liveMatch/matchPlanChange.ts.
   */
  applyMidMatchPlanChange: (
    fixtureId: string,
    adoptionMinute: number,
    requestedMinute: number,
    change: MatchPlanChange,
    currentProfile: TeamTacticalProfile,
    sevenVSixActive: boolean,
    opponentAdaptation: OpponentAdaptationEffect | null,
  ) => void;
  /**
   * HM-MATCH-1.3A Part C: the ONE action that may transition a fixture
   * from "not yet started" to a live session at kickoff. Idempotent --
   * calling it again for a fixture that already has a session RESUMES
   * (no-op), never resets, the in-progress match (see
   * liveMatchSessionActions.ts's own doc).
   */
  startLiveMatchSession: (fixtureId: string) => void;
  /** Part D/E: persists the live match's current clock/coaching snapshot so navigation never resets it. A no-op if `fixtureId` isn't the currently active session. */
  updateLiveMatchSession: (fixtureId: string, session: LiveMatchSessionState) => void;
  /** Part I: called once the manager explicitly leaves a finished match (MATCHRAPPORT / FORTSÄTT) -- never automatically at FULL_TIME itself. */
  endLiveMatchSession: (fixtureId: string) => void;
  /** HM-TRAINING-1.0 Part 24: changes one training day's dayType (e.g. TRAINING -> REST), and persists. */
  setTrainingDayType: (weekStart: string, date: string, dayType: TrainingDayType) => void;
  /** HM-TRAINING-1.0 Part 24: adds one training session to a day (no-ops past MAX_SESSIONS_PER_DAY), and persists. */
  addTrainingSession: (weekStart: string, date: string, seed: SessionSeed) => void;
  /** HM-TRAINING-1.0 Part 24: removes one training session from a day, and persists. */
  removeTrainingSession: (weekStart: string, date: string, sessionId: string) => void;
  /** HM-TRAINING-1.0 Part 24: edits one training session's type/intensity/duration/target/focus in place, and persists. */
  updateTrainingSession: (
    weekStart: string,
    date: string,
    sessionId: string,
    patch: Partial<Pick<TrainingSession, "type" | "intensity" | "duration" | "target" | "selectedPlayerIds" | "tacticalFocus" | "coachId">>,
  ) => void;
  /** HM-TRAINING-1.0 Part 17: applies a full weekly template to `weekStart` from scratch (never touching an already-executed day), and persists. */
  applyWeeklyTemplate: (weekStart: string, template: WeeklyTrainingTemplate) => void;
  /** HM-TRAINING-1.0 Part 12: sets one player's persistent individual training-load setting (FULL/REDUCED/RECOVERY_ONLY/REST), and persists. */
  setPlayerTrainingLoad: (playerId: string, loadSetting: PlayerTrainingLoadSetting) => void;
  /** HM-TRAINING-1.1 Part 8/29: sets one player's persistent individual development focus, and persists. Never itself changes any attribute -- see lib/development/developmentIntegration.ts. */
  setPlayerIndividualFocus: (playerId: string, focus: string | null) => void;
  /** HM-PRESEASON-1.0: books a friendly fixture against `opponentClubId` on `date` -- validates conflicts (see lib/career/preseason.ts's bookFriendly), persists on success, returns the outcome so the booking UI can show a real error instead of a silent no-op. */
  bookFriendly: (date: string, opponentClubId: string) => { ok: boolean; error?: string };
  /** HM-TRANSFERS-1.0: resolves a whole transfer/loan negotiation synchronously (affordability -> club decision -> player decision -> completion) and persists. Returns the fully-resolved TransferOffer so the UI can show its terminal status/reason immediately. */
  submitTransferOffer: (params: SubmitTransferOfferParams) => TransferOffer;
  /** HM-ALPHA2-05A: two-stage permanent-transfer negotiation (club fee -> player terms). Each call persists on success and returns the updated negotiation, or the reason it was refused. */
  negotiateTransfer: (action: NegotiationAction) => NegotiationActionResult;
  /** HM-SCOUTING-1.0: creates a new scouting assignment (validates the scout is a real, employed SCOUT at the manager's own club) and persists on success. Returns the full result (including validation errors) so the UI can show exactly why an assignment was refused. */
  createScoutingAssignment: (scoutStaffId: string, targetPlayerId: string, targetClubId: string) => CreateScoutingAssignmentResult;
  /** HM-SCOUTING-1.1: creates a new broad (CLUB/COMPETITION/REGION/POSITION/AGE_BAND) discovery assignment and persists on success. Same validated-scout precondition as createScoutingAssignment. */
  createBroadScoutingAssignment: (scoutStaffId: string, assignmentType: Exclude<ScoutAssignmentType, "PLAYER">, scope: BroadScoutAssignmentScope) => CreateScoutingAssignmentResult;
  /** HM-SCOUTING-1.1: cancels an IN_PROGRESS assignment (PLAYER or broad) and persists. No-op if already completed/cancelled. */
  cancelScoutingAssignment: (assignmentId: string) => void;
  /** HM-RECRUITMENT-1.1: adds/removes a player from the persistent shortlist (idempotent) and persists. */
  addToShortlist: (playerId: string) => void;
  removeFromShortlist: (playerId: string) => void;
  /** HM-RECRUITMENT-1.1: sets manager INTENT (priority/note) for a recruitment candidate and persists -- never a player rating. */
  setRecruitmentPriority: (playerId: string, priority: RecruitmentPriority) => void;
  setRecruitmentNote: (playerId: string, note: string) => void;
  /** HM-CLUB-PARTNERSHIPS-1.0: starts the board's own multi-day search for a Division 1 development partner and persists on success. */
  requestPartnershipSearch: () => RequestPartnershipSearchResult;
  /** HM-CLUB-PARTNERSHIPS-1.0: agrees a DEVELOPMENT_PARTNERSHIP with one of a completed search's own candidate clubs and persists on success. */
  startDevelopmentPartnership: (searchId: string, chosenClubId: string, monthlyCostEur: number, durationMonths: number) => StartDevelopmentPartnershipResult;
  /** HM-CLUB-PARTNERSHIPS-1.0: ends a non-permanent partnership early and persists. No-op for a permanent B-team row. */
  terminatePartnership: (partnershipId: string) => void;
  /** HM-CLUB-PARTNERSHIPS-1.0: extends an active partnership's end date by `additionalMonths` and persists. */
  renewPartnership: (partnershipId: string, additionalMonths: number) => void;
  /** HM-STAFF-SCOUT-POOL-1.0: signs a LIKELY_ELIGIBLE free-agent scout from scoutMarket to the manager's own club and persists on success. */
  signFreeAgentScout: (personId: string, offeredWageEurPerMonth: number, contractYears?: number) => SignFreeAgentScoutResult;
  /** HM-CLUB-PARTNERSHIPS-1.1: places an eligible player at a real partner club (B-team or active development partnership) for development exposure and persists on success. Never moves contract/wage/owning club. */
  startPlacement: (playerId: string, partnerClubId: string) => StartPlacementResult;
  /** HM-CLUB-PARTNERSHIPS-1.1: recalls a placed player back to normal A-squad status and persists. Idempotent -- no-op if the player has no active placement. */
  recallPlayerFromPlacement: (playerId: string) => void;
  /** HM-CLUB-PARTNERSHIPS-1.1: starts a real loan under an active INTERNATIONAL_LOAN_PARTNERSHIP (minimal integration -- reuses the existing loan mechanism unchanged) and persists on success. */
  startInternationalPartnershipLoan: (partnershipId: string, playerId: string, wageShareBorrowingPct: number, endDate: string) => StartPartnershipLoanResult;
};

const CareerContext = createContext<CareerContextValue | null>(null);

/**
 * HM-SAVE-STORAGE-1.0: `saveCareerState` became async when persistence
 * moved to IndexedDB, but the ~40 call sites below are inside React
 * state updaters and event handlers where awaiting is not possible --
 * and making them awaitable would mean reworking the whole career
 * action flow, which is exactly the domain risk this storage-only
 * milestone is meant to avoid.
 *
 * So the write stays fire-and-forget, as it effectively was before, but
 * its rejection is NEVER dropped: it is logged and pushed to the
 * provider, which renders a persistent banner. A silent write failure
 * would let the manager keep playing a career that is no longer being
 * saved -- the precise failure mode this milestone exists to remove.
 */
let persistenceFailureListener: ((message: string) => void) | null = null;

function CareerPersistenceError({ message }: { message: string }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--hm-bg-app)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="hm-panel" style={{ maxWidth: 560 }}>
        <div className="hm-panel-body">
          <strong>Karriären kunde inte sparas eller läsas</strong>
          <p className="hm-text-muted" style={{ marginTop: 8 }}>{message}</p>
          <p className="hm-text-muted" style={{ marginTop: 8, fontSize: "12px" }}>
            Ingen sparad data har raderats. Stäng andra flikar med spelet öppet och försök igen.
          </p>
        </div>
      </div>
    </div>
  );
}

function persistCareerState(saveId: string, careerState: CareerState): void {
  void saveCareerState(saveId, careerState).catch((cause: unknown) => {
    console.error("[save] Failed to persist career state", cause);
    persistenceFailureListener?.(cause instanceof Error ? cause.message : "Karriären kunde inte sparas.");
  });
}

export function CareerProvider({ children, loadingFallback, initializationErrorFallback }: { children: ReactNode; loadingFallback?: ReactNode; initializationErrorFallback?: ReactNode }) {
  const lastMatchAutoSave = useRef(0);
  type ProviderValue = { save: CareerSave; career: CareerState } | null;
  const [value, setRawValue] = useState<ProviderValue>(null);
  const [persistError, setPersistError] = useState<string | null>(null);
  // A completed replay is needed briefly for its durable archive write. Once
  // committed, release it from the long-lived provider, retaining summaries.
  useEffect(() => {
    if (!value || !Object.keys(value.career.matchArchives ?? {}).length) return;
    let cancelled = false;
    void saveCareerState(value.save.saveId, value.career).then(() => {
      if (!cancelled) setRawValue(current => current === value ? { ...value, career: withoutReplayPayloads(value.career) } : current);
    }).catch((cause: unknown) => {
      if (!cancelled) setPersistError(cause instanceof Error ? cause.message : 'Matcharkivet kunde inte sparas.');
    });
    return () => { cancelled = true; };
  }, [value]);
  // Reconcile actual management events at the state commit boundary, including load.
  // No render/effect loop and no reconciliation during live simulation advances.
  const setValue = useCallback((action: SetStateAction<ProviderValue>) => {
    setRawValue(current => {
      const next = typeof action === 'function' ? action(current) : action;
      if (!next || next === current || next.career.productionMatch) return next;
      const career = syncManagementInbox(next.career);
      if (career === next.career) return next;
      persistCareerState(next.save.saveId, career);
      return { ...next, career };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    // HM-SAVE-STORAGE-1.0: both the active-save read and the career
    // load/creation are async now. A rejection here is a real
    // persistence fault (not "no career") and is surfaced, never
    // swallowed into a permanent loading state.
    getActiveSave()
      .then(async (save) => {
        if (cancelled || !save) return null;
        await afterNextPaint();
        if (cancelled) return null;
        return getOrCreateCareerState(save).then((career) => {
          if (cancelled) return null;
          // The provider owns the current domain state separately. Keeping the
          // loaded envelope's snapshot would retain an old live match forever.
          setValue({ save: { ...save, careerState: undefined }, career });
          return null;
        });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        console.error('[career] Career initialization failed', cause);
        setPersistError(cause instanceof Error ? cause.message : "Karriären kunde inte läsas eller sparas.");
      });
    return () => {
      cancelled = true;
    };
  }, [setValue]);

  // Every background persist (see persistCareerState) reports here.
  useEffect(() => {
    persistenceFailureListener = (message) => setPersistError(message);
    return () => {
      persistenceFailureListener = null;
    };
  }, []);

  // HM-MATCH-1.3A: these three MUST be reference-stable across renders
  // (useCallback with an empty dependency array -- they use the
  // functional setValue form exclusively, never closing over `value`, so
  // nothing needs to be in the dependency list). Declared BEFORE the
  // `if (!value) return null` guard below -- hooks may never be called
  // conditionally. `updateLiveMatchSession` in particular is called from
  // a `useEffect` dependency array in match-day/[fixtureId]/page.tsx --
  // confirmed by browser QA that an unstable (plain-function, recreated-
  // every-render) reference there causes a genuine infinite render loop:
  // persisting a session change triggers a CareerProvider re-render,
  // which recreates the callback, which re-fires the effect, forever.
  // Every other action in this file is only ever called imperatively
  // from onClick handlers, never placed in a dependency array, which is
  // why this instability was latent until now.
  const startLiveMatchSessionAction = useCallback((fixtureId: string) => {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = startLiveMatchSession(current.career, fixtureId, current.career.tacticalProfile);
      if (nextCareer === current.career) return current;
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }, [setValue]);

  const updateLiveMatchSessionAction = useCallback((fixtureId: string, session: LiveMatchSessionState) => {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = updateLiveMatchSession(current.career, fixtureId, session);
      if (nextCareer === current.career) return current;
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }, [setValue]);

  const endLiveMatchSessionAction = useCallback((fixtureId: string) => {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = clearLiveMatchSession(current.career, fixtureId);
      if (nextCareer === current.career) return current;
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }, [setValue]);

  if (!value) {
    // A persistence fault must not present as an endless blank load.
    return persistError ? initializationErrorFallback ?? <CareerPersistenceError message={persistError} /> : loadingFallback ?? null;
  }

  function continueCareer() {
    // HM-CAREER-0.5: `startDate` is captured from the OLD, pre-press
    // processedThroughDate, before continueCareerRhythm runs -- this is
    // the exact same "already-committed, exactly-once" boundary the
    // engine itself uses (dailyTick.ts advances processedThroughDate by
    // exactly one day per iteration), so the caller can reconstruct which
    // literal calendar dates this press covered (startDate .. startDate +
    // daysProcessed - 1) purely for DISPLAY -- grouping the already-
    // decided `events` by their own `.date` field -- without ever
    // re-deciding or re-processing anything itself.
    const startDate = addDays(value!.career.processedThroughDate, 1);
    const { state: nextCareer, events, stopReason, daysProcessed } = continueCareerRhythm(value!.career);
    persistCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
    return { events, stopReason, daysProcessed, startDate };
  }

  function playManagerFixtureAction() {
    const { state: nextCareer, result } = playManagerFixture(value!.career);
    persistCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
    return { result };
  }

  function updateCareer(update: (state: CareerState) => CareerState) {
    // Apply queued decisions to the latest domain state so rapid clicks cannot
    // execute against the same pre-sale snapshot or overwrite a completed sale.
    setValue(current => {
      if (!current) return current;
      const nextCareer = update(current.career);
      if (nextCareer === current.career) return current;
      const advancing = nextCareer.productionMatch && current.career.productionMatch && nextCareer.productionMatch.core.tick !== current.career.productionMatch.core.tick && nextCareer.productionMatch.core.status === 'RUNNING' && !nextCareer.productionMatch.pausedAtHalf;
      // Wall time schedules storage only; it never enters the simulation or RNG.
      if (!advancing || performance.now() - lastMatchAutoSave.current >= 1000) {
        persistCareerState(current.save.saveId, nextCareer);
        lastMatchAutoSave.current = performance.now();
      }
      return { save: current.save, career: nextCareer };
    });
  }

  function markInboxMessageRead(messageId: string) {
    const nextCareer = markMessageRead(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    persistCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function archiveInboxMessage(messageId: string) {
    const nextCareer = archiveMessage(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    persistCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function unarchiveInboxMessage(messageId: string) {
    const nextCareer = unarchiveMessage(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    persistCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function updateTacticalProfileAction(changes: Partial<TeamTacticalProfile>) {
    const nextCareer = updateTacticalProfile(value!.career, changes);
    persistCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function updateSquadStatusAction(playerId: string, tier: SquadStatusTier) {
    const nextCareer = updatePlayerSquadStatus(value!.career, playerId, tier);
    if (nextCareer === value!.career) return;
    persistCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function offerStaffContractAction(params: StaffOfferParams): StaffOfferResult {
    const { state: nextCareer, result } = offerStaffContract(value!.career, params);
    if (nextCareer !== value!.career) {
      persistCareerState(value!.save.saveId, nextCareer);
      setValue({ save: value!.save, career: nextCareer });
    }
    return result;
  }

  function updateMatchPlanAction(fixtureId: string, planOrUpdater: MatchPlan | ((prev: MatchPlan) => MatchPlan)) {
    // HM-TACTICS-1.1: the Tactics workspace fires several onChange calls
    // from the SAME already-rendered panel in quick succession (e.g. a
    // reviewer clicking match role, then playing time, then phase usage
    // on one player). Each call site only knows the `plan` prop it was
    // rendered with; if two calls land before React re-renders between
    // them, a plain `setValue({...})` would let the second call silently
    // overwrite the first using a stale plan. The functional setValue
    // form (already established for exactly this reason by
    // applyMidMatchTacticalChangeAction below) guarantees every call
    // resolves against whatever the LATEST committed matchPlans entry
    // actually is, so no edit is ever silently lost.
    setValue((current) => {
      if (!current) return current;
      const prevPlan = current.career.matchPlans[fixtureId];
      const nextPlan = typeof planOrUpdater === "function" ? planOrUpdater(prevPlan) : planOrUpdater;
      const nextCareer = setMatchPlan(current.career, fixtureId, nextPlan);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  /** HM-MATCH-1.2 Part C: "Använd som standard" -- the ONE explicit action that promotes a player's current match usage into their persistent standard. Never fired implicitly by updateMatchPlanAction. */
  function setPlayerMatchDefaultAction(playerId: string, value: PlayerMatchDefault) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setPlayerMatchDefault(current.career, playerId, value);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function updateSpecialPlayAction(clubId: string, plan: SpecialPlayPlan) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setSpecialPlayPlan(current.career, clubId, plan);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function applyMidMatchTacticalChangeAction(
    fixtureId: string,
    adoptionMinute: number,
    profile: TeamTacticalProfile,
    sevenVSixActive: boolean,
    opponentAdaptation: OpponentAdaptationEffect | null,
  ) {
    // HM-COACHING-0.2: a shout's delivery and expiry can both fire back
    // to back within the same microtask (e.g. the manager presses DIREKT
    // RESULTAT while a shout is still pending -- see sidelineShout.ts's
    // caller). Using the functional setValue form (rather than reading
    // the `value` closure directly) means the second call always sees
    // the first call's already-spliced result, instead of both computing
    // against the same stale pre-splice snapshot.
    setValue((current) => {
      if (!current) {
        return current;
      }
      const nextCareer = applyMidMatchTacticalChange(current.career, fixtureId, adoptionMinute, profile, sevenVSixActive, opponentAdaptation);
      if (nextCareer === current.career) {
        return current;
      }
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function applyMidMatchPlanChangeAction(
    fixtureId: string,
    adoptionMinute: number,
    requestedMinute: number,
    change: MatchPlanChange,
    currentProfile: TeamTacticalProfile,
    sevenVSixActive: boolean,
    opponentAdaptation: OpponentAdaptationEffect | null,
  ) {
    // Same functional-update race-avoidance pattern as
    // applyMidMatchTacticalChangeAction above -- required for the exact
    // same reason (a change adoption and, e.g., a shout expiry, could in
    // principle land in the same microtask).
    setValue((current) => {
      if (!current) {
        return current;
      }
      const nextCareer = applyMidMatchPlanChange(current.career, fixtureId, adoptionMinute, requestedMinute, change, currentProfile, sevenVSixActive, opponentAdaptation);
      if (nextCareer === current.career) {
        return current;
      }
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  // HM-TRAINING-1.0 Part 24: the Training week table fires several
  // sequential edits from one already-rendered panel (e.g. changing a
  // session's intensity right after adding it) -- same rapid-sequential-
  // edit risk updateMatchPlanAction documents above, so every Training
  // mutator below uses the same functional setValue form.
  function setTrainingDayTypeActionWrapper(weekStart: string, date: string, dayType: TrainingDayType) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setTrainingDayTypeAction(current.career, weekStart, date, dayType);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function addTrainingSessionActionWrapper(weekStart: string, date: string, seed: SessionSeed) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = addTrainingSessionAction(current.career, weekStart, date, seed);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function removeTrainingSessionActionWrapper(weekStart: string, date: string, sessionId: string) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = removeTrainingSessionAction(current.career, weekStart, date, sessionId);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function updateTrainingSessionActionWrapper(
    weekStart: string,
    date: string,
    sessionId: string,
    patch: Partial<Pick<TrainingSession, "type" | "intensity" | "duration" | "target" | "selectedPlayerIds" | "tacticalFocus" | "coachId">>,
  ) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = updateTrainingSessionAction(current.career, weekStart, date, sessionId, patch);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function applyWeeklyTemplateActionWrapper(weekStart: string, template: WeeklyTrainingTemplate) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = applyWeeklyTemplateAction(current.career, weekStart, template);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function setPlayerTrainingLoadActionWrapper(playerId: string, loadSetting: PlayerTrainingLoadSetting) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setPlayerTrainingLoad(current.career, playerId, loadSetting);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function setPlayerIndividualFocusActionWrapper(playerId: string, focus: string | null) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setPlayerIndividualFocus(current.career, playerId, focus);
      persistCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function bookFriendlyActionWrapper(date: string, opponentClubId: string): { ok: boolean; error?: string } {
    if (!value) return { ok: false, error: "Ingen aktiv karriär." };
    const result = bookFriendly(value.career, date, opponentClubId);
    if (result.ok) {
      persistCareerState(value.save.saveId, result.state);
      setValue({ save: value.save, career: result.state });
    }
    return { ok: result.ok, error: result.error };
  }

  function submitTransferOfferActionWrapper(params: SubmitTransferOfferParams): TransferOffer {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const result = submitTransferOffer(value.career, params);
    persistCareerState(value.save.saveId, result.state);
    setValue({ save: value.save, career: result.state });
    return result.offer;
  }

  function negotiateTransferActionWrapper(action: NegotiationAction): NegotiationActionResult {
    if (!value) return { ok: false, error: "Ingen aktiv karriär." };
    const result = runNegotiationAction(value.career, action);
    if (result.ok) {
      persistCareerState(value.save.saveId, result.state);
      setValue({ save: value.save, career: result.state });
    }
    return result;
  }

  function createScoutingAssignmentActionWrapper(scoutStaffId: string, targetPlayerId: string, targetClubId: string): CreateScoutingAssignmentResult {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const result = createScoutingAssignment(value.career, scoutStaffId, targetPlayerId, targetClubId, value.career.gameDate);
    if (result.ok) {
      persistCareerState(value.save.saveId, result.state);
      setValue({ save: value.save, career: result.state });
    }
    return result;
  }

  function createBroadScoutingAssignmentActionWrapper(
    scoutStaffId: string,
    assignmentType: Exclude<ScoutAssignmentType, "PLAYER">,
    scope: BroadScoutAssignmentScope,
  ): CreateScoutingAssignmentResult {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const result = createBroadScoutingAssignment(value.career, scoutStaffId, assignmentType, scope, value.career.gameDate);
    if (result.ok) {
      persistCareerState(value.save.saveId, result.state);
      setValue({ save: value.save, career: result.state });
    }
    return result;
  }

  function cancelScoutingAssignmentActionWrapper(assignmentId: string): void {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const nextState = cancelScoutingAssignment(value.career, assignmentId);
    persistCareerState(value.save.saveId, nextState);
    setValue({ save: value.save, career: nextState });
  }

  function addToShortlistActionWrapper(playerId: string): void {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const nextState = addToShortlist(value.career, playerId, value.career.gameDate);
    persistCareerState(value.save.saveId, nextState);
    setValue({ save: value.save, career: nextState });
  }

  function removeFromShortlistActionWrapper(playerId: string): void {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const nextState = removeFromShortlist(value.career, playerId);
    persistCareerState(value.save.saveId, nextState);
    setValue({ save: value.save, career: nextState });
  }

  function setRecruitmentPriorityActionWrapper(playerId: string, priority: RecruitmentPriority): void {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const nextState = setRecruitmentPriority(value.career, playerId, priority, value.career.gameDate);
    persistCareerState(value.save.saveId, nextState);
    setValue({ save: value.save, career: nextState });
  }

  function setRecruitmentNoteActionWrapper(playerId: string, note: string): void {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const nextState = setRecruitmentNote(value.career, playerId, note, value.career.gameDate);
    persistCareerState(value.save.saveId, nextState);
    setValue({ save: value.save, career: nextState });
  }

  function requestPartnershipSearchActionWrapper(): RequestPartnershipSearchResult {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const result = requestPartnershipSearch(value.career, value.career.playerClubId, value.career.gameDate);
    if (result.ok && result.assignment) {
      const nextCareer = { ...value.career, partnershipSearches: { ...value.career.partnershipSearches, [result.assignment.id]: result.assignment } };
      persistCareerState(value.save.saveId, nextCareer);
      setValue({ save: value.save, career: nextCareer });
    }
    return result;
  }

  function startDevelopmentPartnershipActionWrapper(searchId: string, chosenClubId: string, monthlyCostEur: number, durationMonths: number): StartDevelopmentPartnershipResult {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const result = startDevelopmentPartnership(value.career, searchId, chosenClubId, monthlyCostEur, durationMonths, value.career.gameDate);
    if (result.ok && result.partnership) {
      const nextCareer = { ...value.career, clubPartnerships: { ...value.career.clubPartnerships, [result.partnership.id]: result.partnership } };
      persistCareerState(value.save.saveId, nextCareer);
      setValue({ save: value.save, career: nextCareer });
    }
    return result;
  }

  function terminatePartnershipActionWrapper(partnershipId: string): void {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const nextCareer = terminatePartnership(value.career, partnershipId, value.career.gameDate);
    if (nextCareer === value.career) return;
    persistCareerState(value.save.saveId, nextCareer);
    setValue({ save: value.save, career: nextCareer });
  }

  function renewPartnershipActionWrapper(partnershipId: string, additionalMonths: number): void {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const nextCareer = renewPartnership(value.career, partnershipId, additionalMonths);
    if (nextCareer === value.career) return;
    persistCareerState(value.save.saveId, nextCareer);
    setValue({ save: value.save, career: nextCareer });
  }

  function startPlacementActionWrapper(playerId: string, partnerClubId: string): StartPlacementResult {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const result = startPlacement(value.career, playerId, partnerClubId, value.career.gameDate);
    if (result.ok && result.placement) {
      const nextCareer: CareerState = {
        ...value.career,
        playerPlacements: { ...value.career.playerPlacements, [result.placement.id]: result.placement },
        playerStatuses: { ...value.career.playerStatuses, [playerId]: { playerId, availability: "ON_PLACEMENT" } },
      };
      persistCareerState(value.save.saveId, nextCareer);
      setValue({ save: value.save, career: nextCareer });
    }
    return result;
  }

  function recallPlayerFromPlacementActionWrapper(playerId: string): void {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const nextCareer = recallPlayerFromPlacement(value.career, playerId, value.career.gameDate);
    if (nextCareer === value.career) return;
    persistCareerState(value.save.saveId, nextCareer);
    setValue({ save: value.save, career: nextCareer });
  }

  function startInternationalPartnershipLoanActionWrapper(partnershipId: string, playerId: string, wageShareBorrowingPct: number, endDate: string): StartPartnershipLoanResult {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const result = startInternationalPartnershipLoan(value.career, partnershipId, playerId, wageShareBorrowingPct, endDate, value.career.gameDate);
    if (result.ok && result.state) {
      persistCareerState(value.save.saveId, result.state);
      setValue({ save: value.save, career: result.state });
    }
    return result;
  }

  function signFreeAgentScoutActionWrapper(personId: string, offeredWageEurPerMonth: number, contractYears?: number): SignFreeAgentScoutResult {
    if (!value) throw new Error("Ingen aktiv karriär.");
    const { state: nextCareer, result } = signFreeAgentScout(value.career, personId, value.career.playerClubId, offeredWageEurPerMonth, contractYears, value.career.gameDate);
    if (result.outcome === "COMPLETED") {
      persistCareerState(value.save.saveId, nextCareer);
      setValue({ save: value.save, career: nextCareer });
    }
    return result;
  }

  return (
    <CareerContext.Provider
      value={{
        save: value.save,
        career: value.career,
        continueCareer,
        playManagerFixture: playManagerFixtureAction,
        updateCareer,
        markInboxMessageRead,
        archiveInboxMessage,
        unarchiveInboxMessage,
        updateTacticalProfile: updateTacticalProfileAction,
        updateSquadStatus: updateSquadStatusAction,
        offerStaffContract: offerStaffContractAction,
        updateMatchPlan: updateMatchPlanAction,
        setPlayerMatchDefault: setPlayerMatchDefaultAction,
        updateSpecialPlay: updateSpecialPlayAction,
        applyMidMatchTacticalChange: applyMidMatchTacticalChangeAction,
        applyMidMatchPlanChange: applyMidMatchPlanChangeAction,
        startLiveMatchSession: startLiveMatchSessionAction,
        updateLiveMatchSession: updateLiveMatchSessionAction,
        endLiveMatchSession: endLiveMatchSessionAction,
        setTrainingDayType: setTrainingDayTypeActionWrapper,
        addTrainingSession: addTrainingSessionActionWrapper,
        removeTrainingSession: removeTrainingSessionActionWrapper,
        updateTrainingSession: updateTrainingSessionActionWrapper,
        applyWeeklyTemplate: applyWeeklyTemplateActionWrapper,
        setPlayerTrainingLoad: setPlayerTrainingLoadActionWrapper,
        setPlayerIndividualFocus: setPlayerIndividualFocusActionWrapper,
        bookFriendly: bookFriendlyActionWrapper,
        submitTransferOffer: submitTransferOfferActionWrapper,
        negotiateTransfer: negotiateTransferActionWrapper,
        createScoutingAssignment: createScoutingAssignmentActionWrapper,
        createBroadScoutingAssignment: createBroadScoutingAssignmentActionWrapper,
        cancelScoutingAssignment: cancelScoutingAssignmentActionWrapper,
        addToShortlist: addToShortlistActionWrapper,
        removeFromShortlist: removeFromShortlistActionWrapper,
        setRecruitmentPriority: setRecruitmentPriorityActionWrapper,
        setRecruitmentNote: setRecruitmentNoteActionWrapper,
        requestPartnershipSearch: requestPartnershipSearchActionWrapper,
        startDevelopmentPartnership: startDevelopmentPartnershipActionWrapper,
        terminatePartnership: terminatePartnershipActionWrapper,
        renewPartnership: renewPartnershipActionWrapper,
        signFreeAgentScout: signFreeAgentScoutActionWrapper,
        startPlacement: startPlacementActionWrapper,
        recallPlayerFromPlacement: recallPlayerFromPlacementActionWrapper,
        startInternationalPartnershipLoan: startInternationalPartnershipLoanActionWrapper,
      }}
    >
      {/* A write that failed AFTER the career loaded: the manager keeps
          playing, but must be told their progress is not being saved. */}
      {persistError ? <CareerPersistenceBanner message={persistError} /> : null}
      {children}
    </CareerContext.Provider>
  );
}

function CareerPersistenceBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed", bottom: 12, left: "50%", transform: "translateX(-50%)", zIndex: 1000,
        maxWidth: 620, padding: "10px 14px", borderRadius: 6,
        background: "var(--hm-bg-panel)", border: "1px solid var(--hm-accent-strong)",
        color: "var(--hm-text-primary)", fontSize: "12px",
      }}
    >
      <strong>Karriären sparas inte längre.</strong> {message}
    </div>
  );
}

export function useCareer(): CareerContextValue {
  const ctx = useContext(CareerContext);
  if (!ctx) {
    throw new Error("useCareer() must be used within a CareerProvider");
  }
  return ctx;
}
