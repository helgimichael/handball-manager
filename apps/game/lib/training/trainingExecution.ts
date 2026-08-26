// HM-TRAINING-1.0 Part 20/21/22: turns a scheduled TrainingDay into an
// actual, persisted result -- the ONE function dailyTick.ts calls from
// its existing "3. Training / Recovery" step. Idempotent by construction
// (Part 20/22): once a day's `executed` flag is true, calling this again
// for the same date is a safe no-op, mirroring dailyTick.ts's own
// `emit()` dedup-gate discipline for CareerEvents.
import { getCareerSquad } from "../career/careerWorld";
import { buildStaminaByPlayerId } from "../career/playerMatchStrength";
import type { CareerState } from "../career/types";
import { ENERGY_START_DEFAULT } from "../matchPlan/physicalModel";
import { applyOvernightRecovery, applyRecoveryDayBonus, applyRestDayBonus, clampTrainingEnergy, computePlayerSessionEnergyDelta } from "./trainingLoad";
import { DEFAULT_WEEKLY_TEMPLATE, mondayOf, resolveTrainingWeek } from "./trainingSchedule";
import type { PlayerPhysicalState, TrainingDay, TrainingSession, TrainingSessionResult, TrainingSessionTarget, TrainingWeek } from "./types";
import { computeStaffTrainingQuality, findHeadCoach, resolveResponsibleCoach } from "../staff/roleSuitability";
import { effectiveTrainingLoadSetting } from "../medical/availability";

/** rating/types.ts's own documented 1-20 attribute-scale midpoint -- the neutral stamina assumption for a player with no snapshotted ENDURANCE (same fallback playerMatchStrength.ts/matchUsageEngine.ts already use). */
const NEUTRAL_STAMINA = 10.5;
/** How much of a prior day's `recentLoad` magnitude survives into the running figure -- a simple decay, not a history log (Part 10's own "do not store every session history"). */
const RECENT_LOAD_DECAY = 0.7;

function isPlayerTargeted(target: TrainingSessionTarget, selectedPlayerIds: readonly string[] | undefined, playerId: string, isGoalkeeper: boolean): boolean {
  switch (target) {
    case "ALL":
      return true;
    case "OUTCOURT":
      return !isGoalkeeper;
    case "GOALKEEPERS":
      return isGoalkeeper;
    case "SELECTED_PLAYERS":
      return (selectedPlayerIds ?? []).includes(playerId);
  }
}

function readEnergy(physicalState: Record<string, PlayerPhysicalState>, playerId: string): number {
  return physicalState[playerId]?.currentEnergy ?? ENERGY_START_DEFAULT;
}

function writeEnergy(physicalState: Record<string, PlayerPhysicalState>, playerId: string, date: string, energy: number, loadDelta: number): Record<string, PlayerPhysicalState> {
  const prior = physicalState[playerId];
  const recentLoad = (prior?.recentLoad ?? 0) * RECENT_LOAD_DECAY + Math.abs(loadDelta);
  return { ...physicalState, [playerId]: { playerId, currentEnergy: clampTrainingEnergy(energy), lastUpdatedDate: date, recentLoad } };
}

function applyDayLevelRecovery(day: TrainingDay, energy: number): number {
  let next = applyOvernightRecovery(energy);
  if (day.dayType === "REST") {
    next = applyRestDayBonus(next);
  } else if (day.dayType === "RECOVERY" && day.sessions.length === 0) {
    next = applyRecoveryDayBonus(next);
  }
  return next;
}

function executeSession(state: CareerState, date: string, session: TrainingSession, physicalStateIn: Record<string, PlayerPhysicalState>): { physicalState: Record<string, PlayerPhysicalState>; result: TrainingSessionResult } {
  const squad = getCareerSquad(state);
  const staminaByPlayerId = buildStaminaByPlayerId(state.gameplayRatings[state.playerClubId] ?? []);
  let physicalState = physicalStateIn;
  const participants: string[] = [];
  const loadByPlayer: Record<string, number> = {};
  const preEnergyByPlayer: Record<string, number> = {};
  const postEnergyByPlayer: Record<string, number> = {};

  for (const player of squad) {
    const isGoalkeeper = player.position === "MV";
    if (!isPlayerTargeted(session.target, session.selectedPlayerIds, player.id, isGoalkeeper)) continue;

    // HM-INJURIES-1.0 Part 18/22/23: an injured/limited player's own
    // requested load is automatically capped by their injury status --
    // the manager never has to remember to change it by hand.
    const loadSetting = effectiveTrainingLoadSetting(state, player.id, state.playerTrainingAssignments[player.id]?.loadSetting ?? "FULL");
    const pre = readEnergy(physicalState, player.id);
    const stamina = staminaByPlayerId.get(player.id) ?? NEUTRAL_STAMINA;
    const delta = computePlayerSessionEnergyDelta(session, loadSetting, stamina);
    const post = clampTrainingEnergy(pre + delta);

    physicalState = writeEnergy(physicalState, player.id, date, post, delta);
    participants.push(player.id);
    loadByPlayer[player.id] = delta;
    preEnergyByPlayer[player.id] = pre;
    postEnergyByPlayer[player.id] = post;
  }

  // HM-STAFF-1.0 Part 8/9/27: resolves who ACTUALLY led this session
  // (manual assignment if eligible, otherwise a deterministic best-
  // eligible-staff fallback -- never zero quality merely because no
  // manager assignment exists) and the resulting quality multiplier,
  // persisted onto the result for provenance (Part 27) and for
  // lib/development/developmentIntegration.ts to weight this session's
  // own development stimulus by (Part 11).
  const roster = state.staffRoster[state.playerClubId] ?? [];
  const resolvedCoach = resolveResponsibleCoach(roster, session.type, session.coachId);
  const resolvedStaffQuality = computeStaffTrainingQuality(session.type, resolvedCoach, findHeadCoach(roster));

  return {
    physicalState,
    result: { sessionId: session.id, date, participants, loadByPlayer, preEnergyByPlayer, postEnergyByPlayer, resolvedCoachId: resolvedCoach?.id ?? null, resolvedStaffQuality },
  };
}

/**
 * Part 20: executes `date`'s scheduled training day -- applies overnight
 * (and, for REST/empty-RECOVERY days, an additional day-type) recovery
 * to every squad player, then each of the day's up-to-2 sessions in
 * order, updating `state.playerPhysicalState` and marking the day
 * `executed` with its `results`. A MATCH day only ever receives
 * overnight recovery here (Part 4/11): the match simulation itself
 * (matchdayAction.ts) is the sole owner of physical load for that day,
 * this function just ensures the player's morning-of-matchday energy
 * reflects the training week that led up to it.
 *
 * Idempotent (Part 20/22): a day whose `executed` flag is already true
 * is returned completely unchanged -- calling this twice for the same
 * date, or revisiting a page that calls it, never double-applies load
 * (Part 23).
 */
export function executeTrainingDay(state: CareerState, date: string): CareerState {
  const weekStart = mondayOf(date);
  const week: TrainingWeek = resolveTrainingWeek(state, weekStart, DEFAULT_WEEKLY_TEMPLATE);
  const day = week.days.find((d) => d.date === date);
  if (!day || day.executed) {
    // Nothing to execute (unknown date, or already done) -- still
    // persist a freshly-generated week the first time it's touched, so
    // later reads/edits act on a stable stored object (Part 3/28).
    if (state.trainingWeeks[weekStart]) return state;
    return { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
  }

  const squad = getCareerSquad(state);
  let physicalState = state.playerPhysicalState;

  for (const player of squad) {
    const pre = readEnergy(physicalState, player.id);
    const post = applyDayLevelRecovery(day, pre);
    physicalState = writeEnergy(physicalState, player.id, date, post, 0);
  }

  const results: TrainingSessionResult[] = [];
  if (day.dayType === "TRAINING" || day.dayType === "RECOVERY") {
    for (const session of day.sessions) {
      const executed = executeSession(state, date, session, physicalState);
      physicalState = executed.physicalState;
      results.push(executed.result);
    }
  }

  const executedDay: TrainingDay = { ...day, executed: true, results };
  const updatedWeek: TrainingWeek = { ...week, days: week.days.map((d) => (d.date === date ? executedDay : d)) };

  return {
    ...state,
    playerPhysicalState: physicalState,
    trainingWeeks: { ...state.trainingWeeks, [weekStart]: updatedWeek },
  };
}
