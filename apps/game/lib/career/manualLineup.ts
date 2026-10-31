// HM-ALPHA2-01: manager-controlled lineup selection for New Game careers
// (CareerState.lineupSelection === "MANUAL"). The manager's own starting
// seven and bench start EMPTY for every fixture; nothing here (or in any
// caller) ever fills them in automatically. CPU clubs keep their automatic
// selection (playerMatchStrength.ts's resolveClubMatchPlanForFixture).
//
// An empty plan keeps the seven NORMAL attack slots, each with playerId "",
// so the existing swap-based editors (matchPlanEdits.ts) fill them in
// place and the existing strict validator rejects any slot still empty.
import { OUTCOURT_POSITIONS } from "../rating/types";
import type { TacticsTemplate } from "../matchPlan/persistentDefaults";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import type { MatchPlan, Position } from "../matchPlan/types";
import { validateCareerLineup } from "./spatialMatch/careerLineup";
import type { PlayerMock } from "../game-data";
import type { CareerState } from "./types";

export const STARTING_SEVEN_POSITIONS: readonly Position[] = ["GK", ...OUTCOURT_POSITIONS];
export const EMPTY_SLOT = "";

export function isManualLineupCareer(state: Pick<CareerState, "lineupSelection">): boolean {
  return state.lineupSelection === "MANUAL";
}

/** An empty match plan: no squad, no starters, the manager's own last tactics (if any). */
export function buildEmptyMatchPlan(fixtureId: string, clubId: string, tacticsTemplate?: TacticsTemplate): MatchPlan {
  // Reuse the canonical builder only for its tactical-config defaults,
  // using a placeholder squad that is discarded straight away.
  const placeholder = buildDefaultMatchPlan({
    fixtureId,
    clubId,
    players: [{ playerId: "_gk", position: "GK" }, ...OUTCOURT_POSITIONS.map((position) => ({ playerId: `_${position}`, position }))],
  }, tacticsTemplate).plan!;
  return {
    ...placeholder,
    squad: { fixtureId, clubId, players: [] },
    attackStartingUnit: { formation: "NORMAL", slots: STARTING_SEVEN_POSITIONS.map((position) => ({ playerId: EMPTY_SLOT, position })) },
    defenceStartingUnit: { ...placeholder.defenceStartingUnit, goalkeeperId: EMPTY_SLOT, courtSlots: placeholder.defenceStartingUnit.courtSlots.map((slot) => ({ ...slot, playerId: EMPTY_SLOT })) },
    playerUsage: [],
    substitutionPairs: [],
    depthHierarchy: [],
  };
}

/** Starting positions with no player in a NORMAL starting seven (all seven when there is no plan). */
export function missingStartingPositions(plan: MatchPlan | undefined): Position[] {
  if (!plan || plan.attackStartingUnit.formation !== "NORMAL") return [...STARTING_SEVEN_POSITIONS];
  return STARTING_SEVEN_POSITIONS.filter((position) => !plan.attackStartingUnit.slots.find((slot) => slot.position === position)?.playerId);
}

const positionLabel = (position: Position) => (position === "GK" ? "MV" : position);

/**
 * Every reason the manager's own lineup cannot start this fixture, in plain
 * Swedish; empty when it is a complete, valid selection. Shared by Match
 * Preview (disables STARTA MATCH) and createProductionSession (refuses
 * kickoff), so the two can never disagree.
 */
export function manualLineupIssues(plan: MatchPlan | undefined, availableSquad: readonly PlayerMock[]): string[] {
  if (!plan || plan.squad.players.length === 0) return ["Ingen startsju är vald. Välj målvakt och sex utespelare i Taktik innan matchstart."];
  const missing = missingStartingPositions(plan);
  if (missing.length > 0) return [`Startsjuan är inte komplett: ${7 - missing.length} av 7 valda. Välj spelare till ${missing.map(positionLabel).join(", ")} i Taktik.`];
  return validateCareerLineup(plan, availableSquad).errors;
}

/** Removes unavailable players from the squad and empties their starting slots -- an explicit manager action, never automatic. */
export function removeUnavailableFromPlan(plan: MatchPlan, availableIds: ReadonlySet<string>): MatchPlan {
  const keep = (id: string) => id === EMPTY_SLOT || availableIds.has(id);
  return {
    ...plan,
    squad: { ...plan.squad, players: plan.squad.players.filter((p) => availableIds.has(p.playerId)) },
    attackStartingUnit: { ...plan.attackStartingUnit, slots: plan.attackStartingUnit.slots.map((slot) => (keep(slot.playerId) ? slot : { ...slot, playerId: EMPTY_SLOT })) },
    defenceStartingUnit: {
      ...plan.defenceStartingUnit,
      goalkeeperId: keep(plan.defenceStartingUnit.goalkeeperId) ? plan.defenceStartingUnit.goalkeeperId : EMPTY_SLOT,
      courtSlots: plan.defenceStartingUnit.courtSlots.map((slot) => (keep(slot.playerId) ? slot : { ...slot, playerId: EMPTY_SLOT })),
    },
    playerUsage: plan.playerUsage.filter((u) => availableIds.has(u.playerId)),
    substitutionPairs: plan.substitutionPairs.filter((p) => availableIds.has(p.attackPlayerId) && availableIds.has(p.defencePlayerId)),
  };
}

/** Empties one starting position; the player stays in the match squad (on the bench). */
export function clearStartingPosition(plan: MatchPlan, position: Position): MatchPlan {
  if (plan.attackStartingUnit.formation !== "NORMAL") return plan;
  return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots: plan.attackStartingUnit.slots.map((slot) => (slot.position === position ? { ...slot, playerId: EMPTY_SLOT } : slot)) } };
}

/**
 * The manager's most recent saved selection for another fixture, re-keyed
 * to `fixtureId` -- offered only behind an explicit "use last lineup"
 * button. Unavailable players are dropped (their slots left empty).
 */
export function previousLineupFor(state: CareerState, fixtureId: string, availableIds: ReadonlySet<string>): MatchPlan | null {
  const playedOrder = state.fixtures.filter((f) => f.id !== fixtureId && state.matchPlans[f.id]?.squad.players.length).sort((a, b) => b.date.localeCompare(a.date) || (b.kickoffTime ?? "").localeCompare(a.kickoffTime ?? ""));
  const source = playedOrder[0] && state.matchPlans[playedOrder[0].id];
  if (!source) return null;
  const rekeyed: MatchPlan = { ...source, fixtureId, squad: { ...source.squad, fixtureId } };
  return removeUnavailableFromPlan(rekeyed, availableIds);
}
