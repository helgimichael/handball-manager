// Arena Nights TRN-01: projected matchday readiness for a training week.
// A read-only replay of the existing daily pipeline (trainingExecution.ts):
// per remaining day, individual overnight/day-type recovery, then each
// session's energy delta from trainingLoad.ts with the player's effective
// load setting. Nothing is written; the workload ledger is not advanced,
// so the projection is an estimate, labelled as such in the UI.
import { getCareerSquad } from "../career/careerWorld";
import { buildStaminaByPlayerId } from "../career/playerMatchStrength";
import type { CareerState } from "../career/types";
import { ENERGY_START_DEFAULT } from "../matchPlan/physicalModel";
import { effectiveTrainingLoadSetting } from "../medical/availability";
import { applyIndividualRecovery, recoveryProfileFor } from "./individualRecovery";
import { applyDayLevelRecovery, isPlayerTargeted } from "./trainingExecution";
import { clampTrainingEnergy, computePlayerSessionEnergyDelta } from "./trainingLoad";
import type { PlayerTrainingLoadSetting, TrainingWeek } from "./types";
import { NEUTRAL_STAMINA } from "./weekPlanView";

export interface ProjectionTarget {
  date: string;
  kind: "MATCH" | "WEEK_END";
  fixtureId?: string;
  opponentClubId?: string;
  home?: boolean;
}

export interface PlayerProjection {
  now: number;
  projected: number;
}

export interface ReadinessProjection {
  target: ProjectionTarget | null;
  /** Remaining (unprocessed) days replayed up to the target. */
  days: number;
  byPlayer: Record<string, PlayerProjection>;
  averageNow: number | null;
  averageProjected: number | null;
  /** Players projected below READY_THRESHOLD at the target. */
  belowThreshold: number;
}

export const READY_THRESHOLD = 80;

/** The first unplayed own fixture inside the week that the calendar has not processed yet; otherwise the end of the week. */
export function projectionTarget(state: CareerState, week: Pick<TrainingWeek, "days">): ProjectionTarget | null {
  const dates = week.days.map((d) => d.date);
  const processed = state.processedThroughDate ?? "";
  const fixture = state.fixtures
    .filter((f) => (f.homeClubId === state.playerClubId || f.awayClubId === state.playerClubId) && dates.includes(f.date) && f.date > processed && !state.results[f.id])
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (fixture) {
    const home = fixture.homeClubId === state.playerClubId;
    return { date: fixture.date, kind: "MATCH", fixtureId: fixture.id, opponentClubId: home ? fixture.awayClubId : fixture.homeClubId, home };
  }
  const last = dates[dates.length - 1];
  return last && last > processed ? { date: last, kind: "WEEK_END" } : null;
}

export function projectWeekReadiness(
  state: CareerState,
  week: Pick<TrainingWeek, "days">,
  options: { loadOverrides?: Readonly<Record<string, PlayerTrainingLoadSetting>> } = {},
): ReadinessProjection {
  const squad = getCareerSquad(state);
  const target = projectionTarget(state, week);
  const processed = state.processedThroughDate ?? "";
  const days = target ? week.days.filter((d) => !d.executed && d.date > processed && d.date <= target.date).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const stamina = buildStaminaByPlayerId(state.gameplayRatings[state.playerClubId] ?? []);
  const byPlayer: Record<string, PlayerProjection> = {};
  for (const player of squad) {
    const now = state.playerPhysicalState[player.id]?.currentEnergy ?? ENERGY_START_DEFAULT;
    let energy = now;
    const requested = options.loadOverrides?.[player.id] ?? state.playerTrainingAssignments[player.id]?.loadSetting ?? "FULL";
    const loadSetting = effectiveTrainingLoadSetting(state, player.id, requested);
    for (const day of days) {
      energy = applyIndividualRecovery(energy, applyDayLevelRecovery(day, energy), recoveryProfileFor(state, player.id, day.date));
      // Matchday: readiness is the morning value; the match itself owns the day's load.
      if (target?.kind === "MATCH" && day.date === target.date) break;
      if (day.dayType !== "TRAINING" && day.dayType !== "RECOVERY") continue;
      for (const session of day.sessions) {
        if (!isPlayerTargeted(session.target, session.selectedPlayerIds, player.id, player.position === "MV")) continue;
        energy = clampTrainingEnergy(energy + computePlayerSessionEnergyDelta(session, loadSetting, stamina.get(player.id) ?? NEUTRAL_STAMINA));
      }
    }
    byPlayer[player.id] = { now: Math.round(now), projected: Math.round(energy) };
  }
  const values = Object.values(byPlayer);
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  return {
    target,
    days: days.length,
    byPlayer,
    averageNow: mean(values.map((v) => v.now)),
    averageProjected: mean(values.map((v) => v.projected)),
    belowThreshold: values.filter((v) => v.projected < READY_THRESHOLD).length,
  };
}
