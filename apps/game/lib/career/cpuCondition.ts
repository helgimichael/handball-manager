// HM-ALPHA2-02C: CPU workload & recovery. CPU players use the SAME
// workload ledger, the SAME individual-recovery model and the SAME
// career->match energy contract as the manager's squad; nothing here is a
// CPU-only fatigue formula. What differs is only the source of match
// workload: full-engine (v2) matches are MEASURED by productionMatch.ts,
// quick-simulated AI-vs-AI fixtures are ESTIMATED here from the quick
// simulation's own court minutes.
//
// HM-ALPHA2-02C.1: CPU clubs also train, on the SAME default weekly
// template the manager's club starts from (trainingSchedule.ts's
// fixture-aware buildTrainingWeek: MATCH day, light MATCH_PREPARATION the
// day before, the template's REST/RECOVERY days), with the SAME per-session
// energy cost, targeting and day-level recovery -- no CPU-specific numbers.
//
// State starts on the first processed day for every CPU squad player
// (older saves: from the first day processed after this change -- no
// history is invented).
import { computePlayerWindowActivity } from "./matchUsageEngine";
import { buildStaminaByPlayerId } from "./playerMatchStrength";
import { getCareerClubSquad } from "./careerWorld";
import { clampTrainingEnergy, computePlayerSessionEnergyDelta } from "../training/trainingLoad";
import { applyDayLevelRecovery, isPlayerTargeted } from "../training/trainingExecution";
import { buildTrainingWeek, DEFAULT_WEEKLY_TEMPLATE, mondayOf } from "../training/trainingSchedule";
import { applyIndividualRecovery, recoveryProfileFor } from "../training/individualRecovery";
import { decayedRecentWorkload, recordWorkload, startWorkloadLedger, trainingWorkload, type WorkloadEntry, type WorkloadLedger } from "../training/workloadLedger";
import { MATCH_KICKOFF_ENERGY_FLOOR } from "./productionMatch";
import type { MatchPlan } from "../matchPlan/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { PlayerPhysicalState, TrainingDay } from "../training/types";
import type { CareerFixture, CareerState } from "./types";

/**
 * Workload points per court minute, by squad position, MEASURED from 12
 * full v2 production matches (240 player-appearances, both teams; see
 * C:\DEV\QA\reports\HM-ALPHA2-02C\v2-rate-calibration.json). MV is the
 * goalkeeper net-energy-drop basis the engine itself exposes.
 */
export const QUICKSIM_WP_PER_MINUTE: Readonly<Record<string, number>> = { MV: 0.28, M6: 1.37, V6: 1.25, M9: 1.24, H6: 1.22, V9: 1.15, H9: 1.15 };
const DEFAULT_FIELD_WP_PER_MINUTE = 1.23;
/** Same v2 data: ENDURANCE <=11 averaged 1.37 WP/min, >=15 1.15 -> ~3% per point around a squad mean of ~14 (outfield only). */
export function quickSimEnduranceFactor(endurance: number | undefined): number {
  if (endurance === undefined) return 1;
  return Math.max(0.85, Math.min(1.2, 1 + 0.03 * (14 - endurance)));
}
/** Same v2 data: readiness lost per WP of match demand (bench/stoppage/halftime recovery returns the rest). Goalkeepers' basis already is net drop. */
export const QUICKSIM_ENERGY_DROP_PER_WP = { field: 0.61, goalkeeper: 1 } as const;

export type QuickSimParticipation = { playerId: string; position: string; minutes: number; load: number; endEnergy: number };

/** Deterministic estimate for one quick-simulated player; null when they did not take the court. */
export function estimateQuickSimPlayerMatch(position: string, courtMinutes: number, endurance: number | undefined, startEnergy: number): Omit<QuickSimParticipation, "playerId" | "position"> | null {
  if (!(courtMinutes > 0)) return null;
  const goalkeeper = position === "MV";
  const rate = (QUICKSIM_WP_PER_MINUTE[position] ?? DEFAULT_FIELD_WP_PER_MINUTE) * (goalkeeper ? 1 : quickSimEnduranceFactor(endurance));
  const load = Math.round(courtMinutes * rate * 10) / 10;
  const drop = load * (goalkeeper ? QUICKSIM_ENERGY_DROP_PER_WP.goalkeeper : QUICKSIM_ENERGY_DROP_PER_WP.field);
  return { minutes: courtMinutes, load, endEnergy: Math.max(MATCH_KICKOFF_ENERGY_FLOOR, startEnergy - drop) };
}

/** Kickoff readiness for the given CPU squads (only players with tracked state). */
export function cpuStartingEnergies(state: CareerState, clubIds: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const clubId of clubIds) {
    if (clubId === state.playerClubId) continue;
    for (const p of getCareerClubSquad(state, clubId)) {
      const e = state.playerPhysicalState[p.id]?.currentEnergy;
      if (e !== undefined) map.set(p.id, Math.max(MATCH_KICKOFF_ENERGY_FLOOR, Math.min(100, e)));
    }
  }
  return map;
}

/**
 * Court minutes come from the quick simulation's own usage timeline -- the
 * exact seed, stamina and starting energies its player-strength trace used
 * (`${seedPrefix}:home|away`), so the minutes are the ones that shaped the
 * result, not a second guess.
 */
export function quickSimParticipation(state: CareerState, clubId: string, plan: MatchPlan | null, seed: string, startingEnergy: ReadonlyMap<string, number>): QuickSimParticipation[] {
  if (!plan) return [];
  const ratings: readonly GameplayPlayerRating[] = state.gameplayRatings[clubId] ?? [];
  const ratingById = new Map(ratings.map((r) => [r.playerId, r]));
  const squadById = new Map(getCareerClubSquad(state, clubId).map((p) => [p.id, p]));
  const out: QuickSimParticipation[] = [];
  for (const a of computePlayerWindowActivity(plan, seed, buildStaminaByPlayerId(ratings), startingEnergy)) {
    const windows = a.attackActive.filter((_, w) => a.attackActive[w] || a.defenceActive[w] || a.goalkeeperActive[w]).length;
    const player = squadById.get(a.playerId);
    if (!player) continue;
    const r = ratingById.get(a.playerId);
    const endurance = r && r.branch.branch === "OUTCOURT" ? r.branch.attributes.ENDURANCE?.value : undefined;
    const est = estimateQuickSimPlayerMatch(player.position, windows * 10, endurance, startingEnergy.get(a.playerId) ?? 100);
    if (est) out.push({ playerId: a.playerId, position: player.position, ...est });
  }
  return out;
}

export function quickSimWorkloadRecords(fixture: CareerFixture, participants: readonly QuickSimParticipation[]): (WorkloadEntry & { playerId: string })[] {
  return participants.map((p) => ({ playerId: p.playerId, id: `match:${fixture.id}`, date: fixture.date, source: "MATCH", load: p.load, quality: "ESTIMATED", basis: "QUICKSIM_MINUTES_ESTIMATE", minutes: p.minutes, ref: fixture.id }));
}

/** Post-match readiness for CPU participants (end energy), recent load re-derived from the ledger. */
export function writeCpuMatchCondition(physical: Record<string, PlayerPhysicalState>, ledger: WorkloadLedger, date: string, endEnergyById: ReadonlyMap<string, number>): Record<string, PlayerPhysicalState> {
  const next = { ...physical };
  for (const [playerId, endEnergy] of endEnergyById) {
    next[playerId] = { ...physical[playerId], playerId, currentEnergy: endEnergy, lastUpdatedDate: date, recentLoad: decayedRecentWorkload(ledger, playerId, date) };
  }
  return next;
}

/** CPU clubs whose players can be tracked: every club in the career's fixture list except the manager's. */
export function cpuClubIds(state: CareerState): string[] {
  return [...new Set(state.fixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))].filter((c) => c !== state.playerClubId).sort();
}

/** A CPU club's training day: that date of its own fixture-aware default week (never persisted -- regenerated deterministically). */
export function cpuTrainingDay(state: CareerState, clubId: string, date: string): TrainingDay {
  return buildTrainingWeek(mondayOf(date), state.fixtures, clubId, DEFAULT_WEEKLY_TEMPLATE).days.find((d) => d.date === date)!;
}

/**
 * The CPU daily condition step, once per CPU player per calendar date
 * (`lastRecoveryDate` guard): exactly what executeTrainingDay does for the
 * manager's squad -- day-level recovery (overnight + REST/RECOVERY bonus)
 * scaled/capped by the player's individual profile, then each targeted
 * session's own energy cost at FULL load (CPU clubs have no injury model
 * or per-player load settings) -- with the session costs recorded in the
 * workload ledger as MODELLED training load (idempotent ids).
 */
export function applyCpuDailyCondition(state: CareerState, date: string): CareerState {
  let physical: Record<string, PlayerPhysicalState> | null = null;
  const records: (WorkloadEntry & { playerId: string })[] = [];
  const touched: string[] = [];
  for (const clubId of cpuClubIds(state)) {
    const squad = getCareerClubSquad(state, clubId);
    if (squad.length === 0) continue;
    const day = cpuTrainingDay(state, clubId, date);
    const stamina = buildStaminaByPlayerId(state.gameplayRatings[clubId] ?? []);
    for (const player of squad) {
      const current = state.playerPhysicalState[player.id];
      if (current?.lastRecoveryDate !== undefined && current.lastRecoveryDate >= date) continue;
      const before = current?.currentEnergy ?? 100;
      let energy = applyIndividualRecovery(before, applyDayLevelRecovery(day, before), recoveryProfileFor(state, player.id, date, clubId));
      if (day.dayType === "TRAINING" || day.dayType === "RECOVERY") {
        for (const session of day.sessions) {
          if (!isPlayerTargeted(session.target, session.selectedPlayerIds, player.id, player.position === "MV")) continue;
          const delta = computePlayerSessionEnergyDelta(session, "FULL", stamina.get(player.id) ?? 10.5);
          energy = clampTrainingEnergy(energy + delta);
          const w = trainingWorkload(delta);
          if (w) records.push({ playerId: player.id, id: `training:${date}:${session.id}`, date, source: "TRAINING", ref: session.id, ...w });
        }
      }
      physical ??= { ...state.playerPhysicalState };
      physical[player.id] = { ...(current ?? { playerId: player.id, recentLoad: 0 }), currentEnergy: energy, lastUpdatedDate: date, lastRecoveryDate: date };
      touched.push(player.id);
    }
  }
  if (!physical) return state;
  const ledger = recordWorkload(state.workloadLedger ?? startWorkloadLedger(state, date), records, date);
  for (const id of touched) physical[id] = { ...physical[id], recentLoad: decayedRecentWorkload(ledger, id, date) };
  return { ...state, playerPhysicalState: physical, workloadLedger: ledger };
}
