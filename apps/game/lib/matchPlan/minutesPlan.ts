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
// POSITION BUDGETS: a 60-minute match has exactly 60 minutes per playing
// position (V6, V9, M9, H9, H6, M6, MV) -- 360 outfield + 60 goalkeeper.
// Players share the budget of the position the MATCH PLAN assigns them
// (their starting slot, otherwise their registered match-squad position),
// never their natural position. Defaults are fitted inside each budget; a
// manager edit that would take a position above 60 is rejected with the
// reason; a saved plan that is already over budget is shown with a warning
// and left exactly as saved -- and the assistant does not use that
// position's planned minutes until the manager corrects it.
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
import type { MatchPlan, PlayerPhaseUsage, Position } from "./types";

export const PLANNED_MINUTES_MAX = 60;
/** Minutes per playing position in one match. */
export const POSITION_BUDGET_MINUTES = 60;
/** Display order of the seven budgets (wing, back, centre, back, wing, pivot, goalkeeper). */
export const BUDGET_POSITIONS: readonly Position[] = ["V6", "V9", "M9", "H9", "H6", "M6", "GK"];
export const positionCode = (position: Position): string => (position === "GK" ? "MV" : position);
/** A budget within this many minutes of full reads as "approaching capacity". */
const NEAR_CAPACITY_MINUTES = 10;

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
const registered = (plan: MatchPlan, playerId: string) => plan.squad.players.some(p => p.playerId === playerId);
const available = (state: CareerState, playerId: string) => isSelectableForMatch(state.playerStatuses, playerId) && !state.playerInjuries?.[playerId]?.activeInjury;

function startingKeeperId(plan: MatchPlan): string | undefined {
  const id = plan.defenceStartingUnit.goalkeeperId || plan.attackStartingUnit.slots.find(s => s.position === "GK")?.playerId;
  return id || undefined;
}
const isStarter = (plan: MatchPlan, playerId: string) =>
  plan.attackStartingUnit.slots.some(s => s.playerId === playerId) || startingKeeperId(plan) === playerId;

/**
 * The position the match plan assigns this player: his starting slot when he
 * starts, otherwise the position he is registered under in the match squad.
 * Not his natural position (a natural V9 registered at M9 shares M9's budget).
 */
export function assignedPosition(plan: MatchPlan, playerId: string): Position | undefined {
  if (startingKeeperId(plan) === playerId) return "GK";
  const slot = plan.attackStartingUnit.formation === "NORMAL" ? plan.attackStartingUnit.slots.find(s => s.playerId === playerId) : undefined;
  return slot?.position ?? plan.squad.players.find(p => p.playerId === playerId)?.position;
}

/** The role-and-selection default before it is fitted into the position's budget. */
function unfittedDefault(state: CareerState, plan: MatchPlan, playerId: string): number {
  const tier = tierFor(state, playerId);
  if (assignedPosition(plan, playerId) === "GK") {
    // Goalkeepers: the starter takes most of the game, one backup a short spell.
    const keepers = plan.squad.players.filter(p => assignedPosition(plan, p.playerId) === "GK" && available(state, p.playerId)).map(p => p.playerId);
    if (keepers.length <= 1) return PLANNED_MINUTES_MAX;
    const starter = startingKeeperId(plan) ?? keepers[0];
    if (playerId === starter) return tier === "KEY_PLAYER" || tier === "FIRST_CHOICE" ? 50 : 45;
    const backups = keepers.filter(id => id !== starter).sort((a, b) => Number(tierFor(state, b) === "TALENT") - Number(tierFor(state, a) === "TALENT") || a.localeCompare(b));
    return backups[0] === playerId ? (tier === "TALENT" ? 15 : 10) : 0;
  }
  const player = getCareerPlayer(state, playerId);
  const age = player ? playerAgeAtDate(player.dateOfBirth, player.birthYear, state.gameDate) : null;
  const reference = expectedCourtMinutes(tier, phaseOf(plan, playerId), age);
  return clampPlannedMinutes(round5(reference * .6 + (isStarter(plan, playerId) ? 24 : 6)));
}

/**
 * Defaults for every available player of one position, fitted inside its 60
 * minutes: the starter first, then the others by their unfitted default
 * (higher first). Never depends on the manager's own figures, so a default
 * never moves because somebody else was edited.
 */
function fittedDefaults(state: CareerState, plan: MatchPlan, position: Position): Map<string, number> {
  const ids = plan.squad.players.map(p => p.playerId).filter(id => assignedPosition(plan, id) === position && available(state, id));
  const raw = new Map(ids.map(id => [id, unfittedDefault(state, plan, id)]));
  const order = [...ids].sort((a, b) => Number(isStarter(plan, b)) - Number(isStarter(plan, a)) || raw.get(b)! - raw.get(a)! || a.localeCompare(b));
  let left = POSITION_BUDGET_MINUTES;
  const out = new Map<string, number>();
  for (const id of order) { const n = Math.min(raw.get(id)!, left); out.set(id, n); left -= n; }
  return out;
}

/** The role-based default for one registered player in this plan, inside his position's budget; 0 when unavailable or not registered. */
export function defaultPlannedMinutes(state: CareerState, plan: MatchPlan, playerId: string): number {
  if (!registered(plan, playerId) || !available(state, playerId)) return 0;
  const position = assignedPosition(plan, playerId);
  return position ? fittedDefaults(state, plan, position).get(playerId) ?? 0 : 0;
}

/** A saved figure exactly as saved (never clamped on read); only unreadable values count as 0. */
const savedFigure = (value: number | undefined): number | undefined => value === undefined ? undefined : Number.isFinite(value) && value >= 0 ? value : 0;

/** Planned minutes for one player: the manager's own figure where set, otherwise the default. Unavailable players are always 0. */
export function plannedMinutesFor(state: CareerState, plan: MatchPlan, playerId: string): number {
  if (!registered(plan, playerId) || !available(state, playerId)) return 0;
  return savedFigure(plan.plannedMinutes?.[playerId]) ?? defaultPlannedMinutes(state, plan, playerId);
}

export function resolvePlannedMinutes(state: CareerState, plan: MatchPlan): Record<string, number> {
  return Object.fromEntries(plan.squad.players.map(p => [p.playerId, plannedMinutesFor(state, plan, p.playerId)]));
}

export type BudgetStatus = "OK" | "NEAR" | "FULL" | "OVER";
export type PositionBudget = {
  position: Position;
  code: string;
  planned: number;
  capacity: number;
  /** Minutes still free (0 when full or over). */
  available: number;
  /** Minutes above the budget (0 unless OVER). */
  excess: number;
  status: BudgetStatus;
  playerIds: string[];
};

function budgetFor(state: CareerState, plan: MatchPlan, position: Position, override?: { playerId: string; minutes: number }): PositionBudget {
  const playerIds = plan.squad.players.map(p => p.playerId).filter(id => assignedPosition(plan, id) === position);
  const planned = playerIds.reduce((sum, id) => sum + (override?.playerId === id ? override.minutes : plannedMinutesFor(state, plan, id)), 0);
  const capacity = POSITION_BUDGET_MINUTES;
  const status: BudgetStatus = planned > capacity ? "OVER" : planned === capacity ? "FULL" : planned >= capacity - NEAR_CAPACITY_MINUTES ? "NEAR" : "OK";
  return { position, code: positionCode(position), planned, capacity, available: Math.max(0, capacity - planned), excess: Math.max(0, planned - capacity), status, playerIds };
}

/** All seven position budgets, in display order, each validated on its own. */
export function positionBudgets(state: CareerState, plan: MatchPlan): PositionBudget[] {
  return BUDGET_POSITIONS.map(position => budgetFor(state, plan, position));
}

export type MinutesTotals = { outfield: number; outfieldCapacity: number; goalkeepers: number; goalkeeperCapacity: number };
export function minutesTotals(budgets: readonly PositionBudget[]): MinutesTotals {
  const outfield = budgets.filter(b => b.position !== "GK");
  return { outfield: outfield.reduce((s, b) => s + b.planned, 0), outfieldCapacity: outfield.length * POSITION_BUDGET_MINUTES, goalkeepers: budgets.find(b => b.position === "GK")?.planned ?? 0, goalkeeperCapacity: POSITION_BUDGET_MINUTES };
}

export type MinutesChangeResult = { ok: true; plan: MatchPlan } | { ok: false; error: string; budget?: PositionBudget };

/**
 * The manager's edit, validated: whole minutes 0-60, and no increase may take
 * the player's position above its 60 minutes. A decrease is always accepted
 * (also when the position is still over budget). Only `plannedMinutes`
 * changes -- never roles, expectations or any other plan field, and never
 * any other player's saved figure.
 */
export function changePlannedMinutes(state: CareerState, plan: MatchPlan, playerId: string, minutes: number): MinutesChangeResult {
  if (!registered(plan, playerId)) return { ok: false, error: "Spelaren är inte uttagen i matchtruppen." };
  if (!available(state, playerId)) return { ok: false, error: "Spelaren är inte tillgänglig och kan inte planeras in." };
  if (!Number.isFinite(minutes) || !Number.isInteger(minutes) || minutes < 0 || minutes > PLANNED_MINUTES_MAX) return { ok: false, error: `Ange hela minuter mellan 0 och ${PLANNED_MINUTES_MAX}.` };
  const position = assignedPosition(plan, playerId);
  const current = plannedMinutesFor(state, plan, playerId);
  if (position && minutes > current) {
    const after = budgetFor(state, plan, position, { playerId, minutes });
    if (after.planned > after.capacity) {
      const before = budgetFor(state, plan, position);
      return { ok: false, budget: before, error: `${before.code} har ${before.capacity} minuter att fördela. ${minutes} min skulle ge ${after.planned}/${after.capacity} min – ${after.excess} min för mycket. Tillgängligt: ${Math.max(0, before.capacity - (before.planned - current))} min för den här spelaren.` };
    }
  }
  if (plan.plannedMinutes?.[playerId] === minutes) return { ok: true, plan };
  return { ok: true, plan: { ...plan, plannedMinutes: { ...(plan.plannedMinutes ?? {}), [playerId]: minutes } } };
}

/** Low-level write used by tests and internal callers that have validated already; clamps to whole minutes 0-60. */
export function setPlannedMinutes(plan: MatchPlan, playerId: string, minutes: number): MatchPlan {
  if (!registered(plan, playerId)) return plan;
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

/**
 * The assistant's input: planned minutes, the role's weight and the assigned
 * position, for every registered player whose position budget is VALID. A
 * position whose plan is over its 60 minutes is left out entirely -- the
 * assistant then rotates those players by its ordinary fatigue logic rather
 * than chasing an impossible allocation.
 */
export function engineMinutesPlan(state: CareerState, plan: MatchPlan | null | undefined): PlannedMinutes | undefined {
  if (!plan || plan.clubId !== state.playerClubId || plan.squad.players.length === 0) return undefined;
  const invalid = new Set(positionBudgets(state, plan).filter(b => b.status === "OVER").map(b => b.position));
  const entries = plan.squad.players
    .map(p => ({ id: p.playerId, position: assignedPosition(plan, p.playerId) }))
    .filter(p => p.position && !invalid.has(p.position))
    .map(p => [p.id, { planned: plannedMinutesFor(state, plan, p.id), weight: ROLE_PLAN_WEIGHT[tierFor(state, p.id)], position: p.position! }] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
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
  /** The position the match plan assigns him (MV for goalkeepers). */
  position: string;
  budgetPosition: Position;
  /** His natural position, shown only when it differs from the assignment. */
  naturalPosition: string | null;
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
  const order = new Map(BUDGET_POSITIONS.map((p, i) => [p, i]));
  return plan.squad.players.map(p => {
    const player = getCareerPlayer(state, p.playerId);
    const assigned = assignedPosition(plan, p.playerId) ?? p.position;
    const code = positionCode(assigned);
    return {
      playerId: p.playerId,
      name: player ? `${player.firstName} ${player.lastName}` : p.playerId,
      position: code,
      budgetPosition: assigned,
      naturalPosition: player?.position && player.position !== code ? player.position : null,
      goalkeeper: assigned === "GK",
      starter: isStarter(plan, p.playerId),
      roleLabel: SQUAD_STATUS_TIER_LABEL_SV[tierFor(state, p.playerId)],
      available: available(state, p.playerId),
      plannedMinutes: plannedMinutesFor(state, plan, p.playerId),
      edited: plan.plannedMinutes?.[p.playerId] !== undefined,
      recentMinutes: recentActualMinutes(state, p.playerId),
    };
  }).sort((a, b) => (order.get(a.budgetPosition) ?? 9) - (order.get(b.budgetPosition) ?? 9) || Number(b.starter) - Number(a.starter) || b.plannedMinutes - a.plannedMinutes || a.name.localeCompare(b.name, "sv"));
}
