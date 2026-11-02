// HM-ALPHA2-01: manager-controlled lineup selection for New Game careers
// (CareerState.lineupSelection === "MANUAL"). The first fixture starts
// EMPTY; the manager's own selection is never generated from scratch.
// HM-ALPHA3-M10: once a selection has been saved it carries over to the
// next fixture as the preferred lineup (carriedLineupFor), with
// unavailable starters replaced and reported. CPU clubs keep their
// automatic selection (playerMatchStrength.ts's resolveClubMatchPlanForFixture).
//
// An empty plan keeps the seven NORMAL attack slots, each with playerId "",
// so the existing swap-based editors (matchPlanEdits.ts) fill them in
// place and the existing strict validator rejects any slot still empty.
import { OUTCOURT_POSITIONS } from "../rating/types";
import type { TacticsTemplate } from "../matchPlan/persistentDefaults";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import type { MatchPlan, Position } from "../matchPlan/types";
import { validateCareerLineup } from "./spatialMatch/careerLineup";
import { addPlayerToSquad, assignNormalAttackSlot } from "../matchPlan/matchPlanEdits";
import { linkDefenceStarters } from "../matchPlan/startingUnits";
import { MATCH_SQUAD_MAX_PLAYERS } from "../matchPlan/types";
import { getCareerPlayerRating } from "./careerRatingNormalization";
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
    // HM-PLAYTEST-01 2.3: a situational unit with an unavailable player is dropped, never silently refilled.
    ...(plan.situationUnits ? { situationUnits: {
      ...(plan.situationUnits.ATTACK_6V5?.every((e) => availableIds.has(e.playerId)) ? { ATTACK_6V5: plan.situationUnits.ATTACK_6V5 } : {}),
      ...(plan.situationUnits.DEFENCE_5V6?.every((e) => !e.playerId || availableIds.has(e.playerId)) ? { DEFENCE_5V6: plan.situationUnits.DEFENCE_5V6 } : {}),
    } } : {}),
    ...(plan.sevenVSixPlayerId ? { sevenVSixPlayerId: availableIds.has(plan.sevenVSixPlayerId) ? plan.sevenVSixPlayerId : undefined } : {}),
  };
}

/** Empties one starting position; the player stays in the match squad (on the bench). */
export function clearStartingPosition(plan: MatchPlan, position: Position): MatchPlan {
  if (plan.attackStartingUnit.formation !== "NORMAL") return plan;
  return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots: plan.attackStartingUnit.slots.map((slot) => (slot.position === position ? { ...slot, playerId: EMPTY_SLOT } : slot)) } };
}

/**
 * The manager's selection nearest before `fixtureId`, re-keyed to it. With none
 * before it (a cup tie drawn in ahead of a fixture already picked for), the
 * nearest one after it; then the one carried over the summer.
 */
export function latestSavedPlan(state: CareerState, fixtureId: string): MatchPlan | null {
  const date = state.fixtures.find((f) => f.id === fixtureId)?.date ?? "9999-12-31";
  const saved = state.fixtures.filter((f) => f.id !== fixtureId && state.matchPlans[f.id]?.squad.players.length);
  const before = saved.filter((f) => f.date <= date).sort((a, b) => b.date.localeCompare(a.date) || (b.kickoffTime ?? "").localeCompare(a.kickoffTime ?? ""));
  const after = saved.filter((f) => f.date > date).sort((a, b) => a.date.localeCompare(b.date));
  const nearest = before[0] ?? after[0];
  const source = (nearest && state.matchPlans[nearest.id]) || state.preferredLineup;
  return source ? { ...source, fixtureId, squad: { ...source.squad, fixtureId } } : null;
}

/**
 * The manager's most recent saved selection for another fixture, re-keyed
 * to `fixtureId`. Unavailable players are dropped (their slots left empty).
 */
export function previousLineupFor(state: CareerState, fixtureId: string, availableIds: ReadonlySet<string>): MatchPlan | null {
  const source = latestSavedPlan(state, fixtureId);
  return source ? removeUnavailableFromPlan(source, availableIds) : null;
}

export interface LineupReplacement {
  position: Position;
  outId: string;
  /** Null when no eligible player was left to step in; the slot stays empty. */
  inId: string | null;
}

export interface CarriedLineup {
  plan: MatchPlan;
  replacements: LineupReplacement[];
  /** Squad members of the previous match who are unavailable now (starters and bench). */
  unavailableIds: string[];
}

const naturalCode = (position: Position) => (position === "GK" ? "MV" : position);

/**
 * HM-ALPHA3-M10: the preferred lineup. A MANUAL career's next fixture with
 * no saved selection of its own carries over the most recent one, so the
 * manager picks a seven once and keeps it. A starter who is unavailable now
 * is replaced by an eligible player -- the bench first, natural position
 * before secondary, then highest ability -- and every replacement is
 * reported so the UI can say who stepped in for whom. Goalkeepers only
 * replace goalkeepers. Unavailable bench players are simply dropped.
 * Null when the manager has never saved a selection (the first fixture
 * stays an explicit choice).
 */
export function carriedLineupFor(state: CareerState, fixtureId: string, available: readonly PlayerMock[]): CarriedLineup | null {
  const source = latestSavedPlan(state, fixtureId);
  if (!source || source.attackStartingUnit.formation !== "NORMAL") return null;
  const availableIds = new Set(available.map((p) => p.id));
  const unavailableIds = source.squad.players.map((p) => p.playerId).filter((id) => !availableIds.has(id));
  let plan = removeUnavailableFromPlan(source, availableIds);
  const replacements: LineupReplacement[] = [];
  const ca = (id: string) => getCareerPlayerRating(state, id)?.ca ?? 0;
  for (const slot of source.attackStartingUnit.slots) {
    if (!slot.playerId || availableIds.has(slot.playerId)) continue;
    const starting = new Set(plan.attackStartingUnit.slots.map((s) => s.playerId));
    const inSquad = new Set(plan.squad.players.map((p) => p.playerId));
    const code = naturalCode(slot.position);
    const fits = (p: PlayerMock) => (slot.position === "GK" ? p.position === "MV" : p.position !== "MV");
    const rank = (p: PlayerMock) => (inSquad.has(p.id) ? 0 : 3) + (p.position === code ? 0 : p.secondaryPosition === code || p.secondaryPositions?.includes(code) ? 1 : 2);
    const candidates = available.filter((p) => fits(p) && !starting.has(p.id) && (inSquad.has(p.id) || plan.squad.players.length < MATCH_SQUAD_MAX_PLAYERS))
      .sort((a, b) => rank(a) - rank(b) || ca(b.id) - ca(a.id) || a.id.localeCompare(b.id));
    const pick = candidates[0];
    if (pick) plan = assignNormalAttackSlot(addPlayerToSquad(plan, pick.id, slot.position), slot.position, pick.id);
    replacements.push({ position: slot.position, outId: slot.playerId, inId: pick?.id ?? null });
  }
  return { plan: linkDefenceStarters(plan), replacements, unavailableIds };
}

/** The plan the manager's side uses for a fixture: the saved one, else the carried preferred lineup. */
export function resolveManualMatchPlan(state: CareerState, fixtureId: string, available: readonly PlayerMock[]): MatchPlan | undefined {
  return state.matchPlans[fixtureId] ?? carriedLineupFor(state, fixtureId, available)?.plan;
}
