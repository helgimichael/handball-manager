"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { FastMatchResult } from "@handball-manager/game-simulation";
import { GAME_CURRENT_DATE, getClub, type PlayerMock } from "../game-data";
import { getActiveSave, saveCareerState, type CareerSave } from "../save/saveRepository";
import { createNewCareerState } from "./newCareer";
import { continueCareerRhythm, type ContinueStopReason } from "./continueController";
import { addDays } from "./dateUtils";
import { archiveMessage, markMessageRead, unarchiveMessage } from "./inboxActions";
import { playManagerFixture } from "./matchdayAction";
import { migrateCareerState } from "./saveMigration";
import { applyMidMatchTacticalChange } from "./tacticalMidMatchChange";
import { applyMidMatchPlanChange } from "./matchPlanMidMatchChange";
import { updateTacticalProfile } from "./tacticalProfileActions";
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
import type { SessionSeed } from "../training/trainingSchedule";
import type { PlayerTrainingLoadSetting, TrainingDayType, TrainingSession, WeeklyTrainingTemplate } from "../training/types";
import type { PlayerMatchDefault } from "../matchPlan/persistentDefaults";
import type { SpecialPlayPlan } from "../matchPlan/specialPlay";
import type { TeamTacticalProfile } from "./teamTacticalProfile";
import type { OpponentAdaptationEffect } from "./opponentAdaptation";
import type { CareerEvent } from "./careerEvents";
import type { CareerState } from "./types";
import type { MatchPlan } from "../matchPlan/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { MatchPlanChange } from "../liveMatch/matchPlanChange";
import type { LiveMatchSessionState } from "../liveMatch/liveMatchSession";

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
  /** Marks one Inbox message (and its linked CareerEvent, if any) as read, and persists. */
  markInboxMessageRead: (messageId: string) => void;
  /** Archives one Inbox message. No-ops (and the caller should not assume success) for an unresolved ACTION_REQUIRED message (Spec §25). */
  archiveInboxMessage: (messageId: string) => void;
  /** Restores one archived Inbox message to the active Inbox. */
  unarchiveInboxMessage: (messageId: string) => void;
  /** Updates only the manager's TeamTacticalProfile (HM-TACTICS-0.6A), and persists. Not consumed by Fast Match yet. */
  updateTacticalProfile: (changes: Partial<TeamTacticalProfile>) => void;
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
    patch: Partial<Pick<TrainingSession, "type" | "intensity" | "duration" | "target" | "selectedPlayerIds" | "tacticalFocus">>,
  ) => void;
  /** HM-TRAINING-1.0 Part 17: applies a full weekly template to `weekStart` from scratch (never touching an already-executed day), and persists. */
  applyWeeklyTemplate: (weekStart: string, template: WeeklyTrainingTemplate) => void;
  /** HM-TRAINING-1.0 Part 12: sets one player's persistent individual training-load setting (FULL/REDUCED/RECOVERY_ONLY/REST), and persists. */
  setPlayerTrainingLoad: (playerId: string, loadSetting: PlayerTrainingLoadSetting) => void;
  /** HM-TRAINING-1.1 Part 8/29: sets one player's persistent individual development focus, and persists. Never itself changes any attribute -- see lib/development/developmentIntegration.ts. */
  setPlayerIndividualFocus: (playerId: string, focus: string | null) => void;
};

const CareerContext = createContext<CareerContextValue | null>(null);

/**
 * Migration for HM-GAME-0.1 (schemaVersion 1) saves: they have no
 * `careerState` at all. Rather than crash or silently drop the save, a
 * fresh CareerState is created for it here (seeded from the save's own
 * id, so it is still deterministic) and persisted immediately, folding
 * the old save forward to the current schema on next load. HM-GAME-0.2A
 * (v2) saves are additionally passed through migrateCareerState to
 * backfill HM-GAME-0.3's Career Rhythm fields (Spec S25).
 */
/**
 * Fetches the real-world squad snapshot (HM-DATA-0.2) for a new career's
 * competition from the one server route allowed to touch
 * data/real-world/*. Only needed for a club whose data comes from that
 * database -- Allsvenskan/IFK Tumba careers skip the request entirely
 * and keep using their existing mock squad, unchanged from before this
 * milestone. Never throws: a fetch failure just means an empty
 * snapshot, which the career gracefully treats as "no real-world data
 * for this club" (see career/careerWorld.ts's fallback).
 */
async function fetchWorldSquads(competitionId: string): Promise<Record<string, PlayerMock[]>> {
  try {
    const res = await fetch(`/api/game-world/squad-snapshot?competitionId=${encodeURIComponent(competitionId)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.worldSquads ?? {};
  } catch {
    return {};
  }
}

/**
 * HM-IDENTITY-0.3: mirrors fetchWorldSquads exactly, for the same reason
 * -- the AI-derived TeamTacticalProfile snapshot is resolved server-side
 * (identity data touches the filesystem) and fetched once at career
 * creation. A fetch failure just means no AI-derived tactical
 * preferences for this career, which matchdayAction.ts's existing
 * NEUTRAL-opponent fallback already handles safely.
 */
async function fetchAiTacticalPreferences(competitionId: string, season: string, seasonStartDate: string): Promise<Record<string, TeamTacticalProfile>> {
  try {
    const params = new URLSearchParams({ competitionId, season, seasonStartDate });
    const res = await fetch(`/api/game-world/ai-tactical-preferences-snapshot?${params.toString()}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.aiTacticalPreferences ?? {};
  } catch {
    return {};
  }
}

/**
 * HM-MATCH-RATINGS-0.1: mirrors fetchWorldSquads/fetchAiTacticalPreferences
 * exactly -- the canonical gameplay-ratings snapshot is resolved
 * server-side (the rating pipeline touches the filesystem) and fetched
 * once at career creation. A fetch failure just means no canonical
 * ratings for this career, which playerMatchStrength.ts's own
 * neutral-value fallback already handles safely.
 */
async function fetchGameplayRatings(competitionId: string): Promise<Record<string, GameplayPlayerRating[]>> {
  try {
    const res = await fetch(`/api/game-world/gameplay-ratings-snapshot?competitionId=${encodeURIComponent(competitionId)}`);
    if (!res.ok) return {};
    const data = await res.json();
    return data.gameplayRatings ?? {};
  } catch {
    return {};
  }
}

async function getOrCreateCareerState(save: CareerSave): Promise<CareerState> {
  if (save.careerState) {
    const migrated = migrateCareerState(save.careerState);
    if (migrated !== save.careerState) {
      saveCareerState(save.saveId, migrated);
    }
    return migrated;
  }
  const club = getClub(save.clubId);
  const isRealWorld = club?.dataSource === "REAL_WORLD";
  const worldSquads = isRealWorld ? await fetchWorldSquads(club.competitionId) : {};
  const aiTacticalPreferences = isRealWorld ? await fetchAiTacticalPreferences(club.competitionId, "2026/27", GAME_CURRENT_DATE) : {};
  const gameplayRatings = isRealWorld ? await fetchGameplayRatings(club.competitionId) : {};
  const fresh = createNewCareerState(save.saveId, save.clubId, worldSquads, aiTacticalPreferences, gameplayRatings);
  saveCareerState(save.saveId, fresh);
  return fresh;
}

export function CareerProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<{ save: CareerSave; career: CareerState } | null>(null);

  useEffect(() => {
    const save = getActiveSave();
    if (!save) {
      return;
    }
    let cancelled = false;
    getOrCreateCareerState(save).then((career) => {
      if (cancelled) return;
      setValue({ save, career });
    });
    return () => {
      cancelled = true;
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
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }, []);

  const updateLiveMatchSessionAction = useCallback((fixtureId: string, session: LiveMatchSessionState) => {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = updateLiveMatchSession(current.career, fixtureId, session);
      if (nextCareer === current.career) return current;
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }, []);

  const endLiveMatchSessionAction = useCallback((fixtureId: string) => {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = clearLiveMatchSession(current.career, fixtureId);
      if (nextCareer === current.career) return current;
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }, []);

  if (!value) {
    return null;
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
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
    return { events, stopReason, daysProcessed, startDate };
  }

  function playManagerFixtureAction() {
    const { state: nextCareer, result } = playManagerFixture(value!.career);
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
    return { result };
  }

  function markInboxMessageRead(messageId: string) {
    const nextCareer = markMessageRead(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function archiveInboxMessage(messageId: string) {
    const nextCareer = archiveMessage(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function unarchiveInboxMessage(messageId: string) {
    const nextCareer = unarchiveMessage(value!.career, messageId);
    if (nextCareer === value!.career) {
      return;
    }
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
  }

  function updateTacticalProfileAction(changes: Partial<TeamTacticalProfile>) {
    const nextCareer = updateTacticalProfile(value!.career, changes);
    saveCareerState(value!.save.saveId, nextCareer);
    setValue({ save: value!.save, career: nextCareer });
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
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  /** HM-MATCH-1.2 Part C: "Använd som standard" -- the ONE explicit action that promotes a player's current match usage into their persistent standard. Never fired implicitly by updateMatchPlanAction. */
  function setPlayerMatchDefaultAction(playerId: string, value: PlayerMatchDefault) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setPlayerMatchDefault(current.career, playerId, value);
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function updateSpecialPlayAction(clubId: string, plan: SpecialPlayPlan) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setSpecialPlayPlan(current.career, clubId, plan);
      saveCareerState(current.save.saveId, nextCareer);
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
      saveCareerState(current.save.saveId, nextCareer);
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
      saveCareerState(current.save.saveId, nextCareer);
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
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function addTrainingSessionActionWrapper(weekStart: string, date: string, seed: SessionSeed) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = addTrainingSessionAction(current.career, weekStart, date, seed);
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function removeTrainingSessionActionWrapper(weekStart: string, date: string, sessionId: string) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = removeTrainingSessionAction(current.career, weekStart, date, sessionId);
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function updateTrainingSessionActionWrapper(
    weekStart: string,
    date: string,
    sessionId: string,
    patch: Partial<Pick<TrainingSession, "type" | "intensity" | "duration" | "target" | "selectedPlayerIds" | "tacticalFocus">>,
  ) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = updateTrainingSessionAction(current.career, weekStart, date, sessionId, patch);
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function applyWeeklyTemplateActionWrapper(weekStart: string, template: WeeklyTrainingTemplate) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = applyWeeklyTemplateAction(current.career, weekStart, template);
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function setPlayerTrainingLoadActionWrapper(playerId: string, loadSetting: PlayerTrainingLoadSetting) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setPlayerTrainingLoad(current.career, playerId, loadSetting);
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  function setPlayerIndividualFocusActionWrapper(playerId: string, focus: string | null) {
    setValue((current) => {
      if (!current) return current;
      const nextCareer = setPlayerIndividualFocus(current.career, playerId, focus);
      saveCareerState(current.save.saveId, nextCareer);
      return { save: current.save, career: nextCareer };
    });
  }

  return (
    <CareerContext.Provider
      value={{
        save: value.save,
        career: value.career,
        continueCareer,
        playManagerFixture: playManagerFixtureAction,
        markInboxMessageRead,
        archiveInboxMessage,
        unarchiveInboxMessage,
        updateTacticalProfile: updateTacticalProfileAction,
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
      }}
    >
      {children}
    </CareerContext.Provider>
  );
}

export function useCareer(): CareerContextValue {
  const ctx = useContext(CareerContext);
  if (!ctx) {
    throw new Error("useCareer() must be used within a CareerProvider");
  }
  return ctx;
}
