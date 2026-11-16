// SQUAD-ROLE-MINUTES: the pre-match minutes planner. Planned minutes live on
// the fixture's own MatchPlan as optional manager OVERRIDES
// (`MatchPlan.plannedMinutes`); every player without one gets a role-based
// default computed here, so a save from before this field existed simply
// shows (and plays with) the defaults -- no migration, no schema change.
//
// Planning minutes never changes anything permanent: not the player's squad
// role (CareerState.playerSquadStatus), not his hidden playing-time
// expectation (lib/players/playingTime.ts), not his satisfaction. It is a
// match intention the assistant weighs during the game
// (packages/handball-engine/src/v2/core/minutesRotation.ts), nothing more.
//
// The default is deliberately NOT a readout of the hidden role expectation: it
// mixes the role's reference level with this match's selection (starter or
// substitute) and is rounded to five minutes.
import type { PlannedMinutes } from "@handball-manager/handball-engine/src/v2/core/minutesRotation";
import { getCareerPlayer } from "../career/careerWorld";
import { isSelectableForMatch } from "../career/playerStatus";
import { getPlayerSquadStatus, SQUAD_STATUS_TIER_LABEL_SV, type SquadStatusTier } from "../career/squadStatus";
import type { CareerState } from "../career/types";
import { playerAgeAtDate } from "../development/developmentIntegration";
import { expectedCourtMinutes } from "../players/playingTime";
import type { MatchPlan, PlayerPhaseUsage } from "./types";

export const PLANNED_MINUTES_MAX = 60;

/** How strongly a role asks the assistant to honour the plan (engine input; never shown). */
const ROLE_PLAN_WEIGHT: Record<SquadStatusTier, number> = { KEY_PLAYER: 1, FIRST_CHOICE: .8, ROTATION: .55, SQUAD_PLAYER: .3, TALENT: .35 };

export function clampPlannedMinutes(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(PLANNED_MINUTES_MAX, Math.round(value))) : 0;
}

const round5 = (n: number) => Math.round(n / 5) * 5;

function phaseOf(plan: MatchPlan, playerId: string): PlayerPhaseUsage {
  if (plan.substitutionPairs.some(p => p.defencePlayerId === playerId)) return "DEFENCE_ONLY";
  if (plan.substitutionPairs.some(p => p.attackPlayerId === playerId)) return "ATTACK_ONLY";
  return plan.playerUsage.find(u => u.playerId === playerId)?.phaseUsage ?? "BOTH_PHASES";
}

const tierFor = (state: CareerState, playerId: string): SquadStatusTier => getPlayerSquadStatus(state, playerId) ?? "ROTATION";
const isKeeper = (plan: MatchPlan, playerId: string) => plan.squad.players.find(p => p.playerId === playerId)?.position === "GK";
const available = (state: CareerState, playerId: string) => isSelectableForMatch(state.playerStatuses, playerId) && !state.playerInjuries?.[playerId]?.activeInjury;

function startingKeeperId(plan: MatchPlan): string | undefined {
  const id = plan.defenceStartingUnit.goalkeeperId || plan.attackStartingUnit.slots.find(s => s.position === "GK")?.playerId;
  return id || undefined;
}

/** The role-based default for one registered player in this plan; 0 when unavailable or not registered. */
export function defaultPlannedMinutes(state: CareerState, plan: MatchPlan, playerId: string): number {
  if (!plan.squad.players.some(p => p.playerId === playerId) || !available(state, playerId)) return 0;
  const tier = tierFor(state, playerId);
  if (isKeeper(plan, playerId)) {
    // Goalkeepers are planned on their own: the starter takes most of the game, one backup a short spell.
    const keepers = plan.squad.players.filter(p => p.position === "GK" && available(state, p.playerId)).map(p => p.playerId);
    if (keepers.length <= 1) return PLANNED_MINUTES_MAX;
    const starter = startingKeeperId(plan) ?? keepers[0];
    if (playerId === starter) return tier === "KEY_PLAYER" || tier === "FIRST_CHOICE" ? 50 : 45;
    const backups = keepers.filter(id => id !== starter).sort((a, b) => Number(tierFor(state, b) === "TALENT") - Number(tierFor(state, a) === "TALENT") || a.localeCompare(b));
    return backups[0] === playerId ? (tier === "TALENT" ? 15 : 10) : 0;
  }
  const player = getCareerPlayer(state, playerId);
  const age = player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) : null;
  const reference = expectedCourtMinutes(tier, phaseOf(plan, playerId), age);
  const starter = plan.attackStartingUnit.slots.some(s => s.position !== "GK" && s.playerId === playerId);
  return clampPlannedMinutes(round5(reference * .6 + (starter ? 24 : 6)));
}

/** Planned minutes for one player: the manager's own figure where set, otherwise the default. Unavailable players are always 0. */
export function plannedMinutesFor(state: CareerState, plan: MatchPlan, playerId: string): number {
  if (!plan.squad.players.some(p => p.playerId === playerId) || !available(state, playerId)) return 0;
  const own = plan.plannedMinutes?.[playerId];
  return own === undefined ? defaultPlannedMinutes(state, plan, playerId) : clampPlannedMinutes(own);
}

export function resolvePlannedMinutes(state: CareerState, plan: MatchPlan): Record<string, number> {
  return Object.fromEntries(plan.squad.players.map(p => [p.playerId, plannedMinutesFor(state, plan, p.playerId)]));
}

/** The manager's edit: only `plannedMinutes` changes -- never roles, expectations or any other plan field. */
export function setPlannedMinutes(plan: MatchPlan, playerId: string, minutes: number): MatchPlan {
  if (!plan.squad.players.some(p => p.playerId === playerId)) return plan;
  const value = clampPlannedMinutes(minutes);
  if (plan.plannedMinutes?.[playerId] === value) return plan;
  return { ...plan, plannedMinutes: { ...(plan.plannedMinutes ?? {}), [playerId]: value } };
}

/** Back to the role-based default (one player, or everybody). */
export function resetPlannedMinutes(plan: MatchPlan, playerId?: string): MatchPlan {
  if (!plan.plannedMinutes) return plan;
  if (playerId === undefined) { const { plannedMinutes: _drop, ...rest } = plan; void _drop; return rest; }
  if (!(playerId in plan.plannedMinutes)) return plan;
  const { [playerId]: _gone, ...left } = plan.plannedMinutes; void _gone;
  return { ...plan, plannedMinutes: left };
}

/** The assistant's input: planned minutes plus the role's weight, for every registered player. */
export function engineMinutesPlan(state: CareerState, plan: MatchPlan | null | undefined): PlannedMinutes | undefined {
  if (!plan || plan.clubId !== state.playerClubId || plan.squad.players.length === 0) return undefined;
  return Object.fromEntries(plan.squad.players.map(p => [p.playerId, { planned: plannedMinutesFor(state, plan, p.playerId), weight: ROLE_PLAN_WEIGHT[tierFor(state, p.playerId)] }]));
}

/** Actual court minutes in the player's most recent recorded competitive matches (newest first), from the existing playing-time record. */
export function recentActualMinutes(state: CareerState, playerId: string, count = 3): number[] {
  return Object.values(state.playerDynamics?.playingTime ?? {})
    .filter(m => m.clubId === state.playerClubId && m.players[playerId]?.available)
    .sort((a, b) => b.date.localeCompare(a.date) || b.fixtureId.localeCompare(a.fixtureId))
    .slice(0, count)
    .map(m => Math.round(m.players[playerId]!.courtMinutes));
}

export type MinutesPlannerRow = {
  playerId: string;
  name: string;
  position: string;
  goalkeeper: boolean;
  starter: boolean;
  roleLabel: string;
  available: boolean;
  plannedMinutes: number;
  /** True when the figure is the manager's own, not the default. */
  edited: boolean;
  recentMinutes: number[];
};

export function minutesPlannerRows(state: CareerState, plan: MatchPlan): MinutesPlannerRow[] {
  const starters = new Set([...plan.attackStartingUnit.slots.map(s => s.playerId), plan.defenceStartingUnit.goalkeeperId].filter(Boolean));
  return plan.squad.players.map(p => {
    const player = getCareerPlayer(state, p.playerId);
    return {
      playerId: p.playerId,
      name: player ? `${player.firstName} ${player.lastName}` : p.playerId,
      position: player?.position ?? (p.position === "GK" ? "MV" : p.position),
      goalkeeper: p.position === "GK",
      starter: starters.has(p.playerId),
      roleLabel: SQUAD_STATUS_TIER_LABEL_SV[tierFor(state, p.playerId)],
      available: available(state, p.playerId),
      plannedMinutes: plannedMinutesFor(state, plan, p.playerId),
      edited: plan.plannedMinutes?.[p.playerId] !== undefined,
      recentMinutes: recentActualMinutes(state, p.playerId),
    };
  }).sort((a, b) => Number(a.goalkeeper) - Number(b.goalkeeper) || Number(b.starter) - Number(a.starter) || b.plannedMinutes - a.plannedMinutes || a.name.localeCompare(b.name, "sv"));
}
