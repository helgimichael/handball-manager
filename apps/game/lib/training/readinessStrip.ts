// Arena Nights TRN-01c: one readiness language for the training page's
// player list -- the same readings the squad matrix uses (readiness,
// match fitness, 7-day workload, trend, recovery outlook; see
// lib/career/squadMatrix.ts) plus the projected matchday value. Own squad
// only; reads, never writes.
import { getCareerSquad } from "../career/careerWorld";
import type { CareerState } from "../career/types";
import { getPlayerAvailability, effectiveTrainingLoadSetting } from "../medical/availability";
import { matchFitnessOf } from "../players/matchFitness";
import type { PlayerMock } from "../game-data";
import { readinessSummary, type RecoveryOutlook, type WorkloadTrend } from "./readinessSummary";
import type { ReadinessProjection } from "./readinessProjection";
import { PLAYER_TRAINING_LOAD_SETTINGS, type PlayerTrainingLoadSetting } from "./types";

export type Tone = "pos" | "warn" | "neg" | "neutral";

export interface ReadinessRow {
  player: PlayerMock;
  readiness: number;
  readinessTone: Tone;
  matchFitness: number;
  matchFitnessTone: Tone;
  /** Workload points over the last 7 days; null until the ledger covers the window. */
  load7: number | null;
  trend: WorkloadTrend | null;
  trendTone: Tone;
  outlook: RecoveryOutlook;
  outlookTone: Tone;
  projected: number | null;
  projectedTone: Tone;
  availability: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  onPlacement: boolean;
  loadSetting: PlayerTrainingLoadSetting;
  allowedSettings: PlayerTrainingLoadSetting[];
  /** Visible reason when some load settings are not allowed. */
  constraint: string | null;
  focus: string;
  /** Lower = needs attention first. */
  risk: number;
}

export const readinessTone = (v: number): Tone => (v >= 80 ? "pos" : v >= 55 ? "warn" : "neg");
export const matchFitnessTone = (v: number): Tone => (v >= 75 ? "pos" : v >= 50 ? "warn" : "neg");

export function loadConstraint(availability: ReadinessRow["availability"], onPlacement: boolean): string | null {
  if (onPlacement) return "Tränar hos partnerklubben – ingen belastning här.";
  if (availability === "UNAVAILABLE") return "Skadad – endast vila tillåten.";
  if (availability === "LIMITED") return "Under återgång – högst reducerad belastning.";
  return null;
}

export function buildReadinessRows(state: CareerState, projection: ReadinessProjection | null): ReadinessRow[] {
  return getCareerSquad(state)
    .map((player): ReadinessRow => {
      const summary = readinessSummary(state, player.id);
      const readiness = Math.round(summary.readiness);
      const matchFitness = Math.round(matchFitnessOf(state, player.id));
      const availability = getPlayerAvailability(state, player.id);
      const onPlacement = state.playerStatuses[player.id]?.availability === "ON_PLACEMENT";
      const requested = state.playerTrainingAssignments[player.id]?.loadSetting ?? "FULL";
      const allowedSettings = availability === "AVAILABLE" ? [...PLAYER_TRAINING_LOAD_SETTINGS] : PLAYER_TRAINING_LOAD_SETTINGS.filter((l) => effectiveTrainingLoadSetting(state, player.id, l) === l);
      const projected = projection?.byPlayer[player.id]?.projected ?? null;
      const outlookTone: Tone = summary.outlook === "GOOD" ? "pos" : summary.outlook === "REDUCED" ? "warn" : "neutral";
      const risk = (projected ?? readiness) - (availability === "UNAVAILABLE" ? 200 : availability === "LIMITED" ? 50 : 0) - (summary.outlook === "REDUCED" ? 5 : 0);
      return {
        player,
        readiness,
        readinessTone: readinessTone(readiness),
        matchFitness,
        matchFitnessTone: matchFitnessTone(matchFitness),
        load7: summary.week.complete ? Math.round(summary.week.total) : null,
        trend: summary.trend,
        trendTone: summary.trend === "RISING" ? "warn" : "neutral",
        outlook: summary.outlook,
        outlookTone,
        projected,
        projectedTone: projected === null ? "neutral" : readinessTone(projected),
        availability,
        onPlacement,
        loadSetting: effectiveTrainingLoadSetting(state, player.id, requested),
        allowedSettings,
        constraint: loadConstraint(availability, onPlacement),
        focus: state.playerTrainingAssignments[player.id]?.individualFocus ?? "NORMAL",
        risk,
      };
    })
    .sort((a, b) => a.risk - b.risk || `${a.player.lastName}${a.player.firstName}`.localeCompare(`${b.player.lastName}${b.player.firstName}`, "sv"));
}

/** Bulk "set load" across selected rows: which players accept the setting and which are skipped (with the visible reason). */
export function planBulkLoad(rows: readonly ReadinessRow[], ids: readonly string[], setting: PlayerTrainingLoadSetting): { apply: string[]; skipped: { playerId: string; reason: string }[] } {
  const apply: string[] = [];
  const skipped: { playerId: string; reason: string }[] = [];
  for (const id of ids) {
    const row = rows.find((r) => r.player.id === id);
    if (!row) continue;
    if (row.availability === "UNAVAILABLE" || !row.allowedSettings.includes(setting)) skipped.push({ playerId: id, reason: row.constraint ?? "Inställningen är inte tillåten." });
    else apply.push(id);
  }
  return { apply, skipped };
}
