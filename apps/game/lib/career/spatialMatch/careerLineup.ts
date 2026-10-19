/**
 * MATCH-EXPERIENCE-2.0 M14: turning a career club into a line-up the spatial
 * engine can play with.
 *
 * WHAT THIS IS NOT. It is not a second formation model. The canonical 6v6
 * shape, the court, the roles and every coordinate still come from the engine's
 * own `createFullCourt6v6State`, exactly as they do for a dev match. All this
 * module does is decide WHICH REAL PLAYER stands in each of those existing
 * slots, and then hand the engine back the same state with real career
 * `playerId`s on it. No career player is ever duplicated under an invented
 * identity, and the engine never learns that careers exist.
 *
 * SELECTION ORDER. A saved MatchPlan is the coach's own selection and wins
 * outright when one exists. Without one, the squad is picked the way a
 * reasonable default XI is picked anywhere else in the game: the best available
 * player for each of the six outcourt positions and the goal, by current
 * ability, with the rest of the squad becoming the bench. Both paths are
 * deterministic and tie-break on `playerId`.
 */
import { createFullCourt6v6State } from "@handball-manager/handball-engine/src/scenarios/fullCourt6v6.ts";
import type { AttackRole, Player } from "@handball-manager/handball-engine/src/domain/handball/player.ts";
import type { AttackingGoalSide, FullCourtMatchState } from "@handball-manager/handball-engine/src/domain/match/possession.ts";
import type { PlayerMock, HandballPosition } from "../../game-data/types";
import type { MatchPlan } from "../../matchPlan/types";
import type { Position } from "../../rating/types";
import { MATCH_SQUAD_MAX_PLAYERS } from '../../matchPlan/types';
import { validateMatchSquad, type MatchPlanValidationResult } from '../../matchPlan/matchSquad';
import { STARTING_SEVEN_POSITION_ERROR, validateAttackStartingUnit } from '../../matchPlan/startingUnits';

/**
 * The engine role each handball position plays in the organized attack.
 *
 * A straight one-to-one correspondence -- the game's own position vocabulary
 * (V/M/H at 9 and 6 metres) and the engine's canonical attacking roles describe
 * the same six places on a handball court, so nothing is interpreted here.
 */
export const ENGINE_ROLE_BY_POSITION: Readonly<Record<Exclude<HandballPosition, "MV">, CourtAttackRole>> = Object.freeze({
  V6: "LEFT_WING",
  V9: "LEFT_BACK",
  M9: "CENTER_BACK",
  H9: "RIGHT_BACK",
  H6: "RIGHT_WING",
  M6: "PIVOT",
});

/** The same map the other way, for reading a career position off an engine role. */
type CourtAttackRole = Exclude<AttackRole, "EXTRA_ATTACKER">;

/** The six court roles, left to right, matching the canonical formation order. */
export const POSITION_BY_ENGINE_ROLE: Readonly<Record<CourtAttackRole, HandballPosition>> = Object.freeze({
  LEFT_WING: "V6",
  LEFT_BACK: "V9",
  CENTER_BACK: "M9",
  RIGHT_BACK: "H9",
  RIGHT_WING: "H6",
  PIVOT: "M6",
});

/** MatchPlan speaks `Position` ("GK" plus the six outcourt ids); PlayerMock speaks `HandballPosition` ("MV" plus the same six). */
function handballPositionOf(position: Position): HandballPosition {
  return position === "GK" ? "MV" : position;
}

/** One side's selected players, in the shape the spatial engine needs them. */
export type CareerLineup = {
  readonly clubId: string;
  /** The goalkeeper who starts. */
  readonly goalkeeperId: string;
  /** Exactly six outcourt starters, one per engine role. */
  readonly startersByRole: Readonly<Record<CourtAttackRole, string>>;
  /** Everybody else selected for the match, in selection order. */
  readonly bench: readonly { readonly playerId: string; readonly isGoalkeeper: boolean }[];
  /** Every id in the match squad, starters first. Used for roster identity and stats. */
  readonly squadIds: readonly string[];
  /** How this line-up was arrived at, so a caller can report it honestly. */
  readonly source: "MATCH_PLAN" | "BEST_AVAILABLE";
};

const ROLE_ORDER: readonly CourtAttackRole[] = ["LEFT_WING", "LEFT_BACK", "CENTER_BACK", "RIGHT_BACK", "RIGHT_WING", "PIVOT"];

/** Deterministic: better ability first, ties broken on id so the same squad always yields the same XI. */
function byAbility(a: PlayerMock, b: PlayerMock): number {
  return b.currentAbility - a.currentAbility || a.id.localeCompare(b.id);
}

/** How well a player suits a position: his own first, then a declared secondary, then anything. */
function positionFit(player: PlayerMock, position: HandballPosition): number {
  if (player.position === position) return 2;
  if (player.secondaryPosition === position || player.secondaryPositions?.includes(position)) return 1;
  return 0;
}

/**
 * Picks a starting seven and a bench from an available squad.
 *
 * Greedy and deterministic: each of the six outcourt places is filled by the
 * best remaining player who actually plays there, falling back to the best
 * remaining outfielder when nobody does -- a real squad will not always have a
 * specialist for every slot, and a match must still be playable.
 */
export function selectBestAvailableLineup(clubId: string, squad: readonly PlayerMock[]): CareerLineup | null {
  const outfield = squad.filter((p) => p.position !== "MV").sort(byAbility);
  const keepers = squad.filter((p) => p.position === "MV").sort(byAbility);
  if (outfield.length < 6 || keepers.length < 1) return null;

  const taken = new Set<string>();
  const startersByRole: Partial<Record<CourtAttackRole, string>> = {};
  for (const role of ROLE_ORDER) {
    const position = POSITION_BY_ENGINE_ROLE[role];
    const candidates = outfield.filter((p) => !taken.has(p.id));
    const best =
      [...candidates].sort((a, b) => positionFit(b, position) - positionFit(a, position) || byAbility(a, b))[0] ?? null;
    if (!best) return null;
    taken.add(best.id);
    startersByRole[role] = best.id;
  }
  const goalkeeper = keepers[0];
  taken.add(goalkeeper.id);

  const bench = squad
    .filter((p) => !taken.has(p.id))
    .sort(byAbility)
    .slice(0, MATCH_SQUAD_MAX_PLAYERS - taken.size)
    .map((p) => ({ playerId: p.id, isGoalkeeper: p.position === "MV" }));

  return {
    clubId,
    goalkeeperId: goalkeeper.id,
    startersByRole: startersByRole as Record<CourtAttackRole, string>,
    bench,
    squadIds: [goalkeeper.id, ...ROLE_ORDER.map((r) => startersByRole[r]!), ...bench.map((b) => b.playerId)],
    source: "BEST_AVAILABLE",
  };
}

/**
 * The coach's own selection, when he made one.
 *
 * Only a NORMAL attacking formation is read: a 7v6 starting unit has no
 * goalkeeper slot and is explicitly out of this milestone. Invalid selections
 * are rejected; they must never be replaced with a different squad.
 */
export function validateCareerLineup(plan: MatchPlan, squad: readonly PlayerMock[]): MatchPlanValidationResult {
  const errors = [
    ...validateMatchSquad(plan.squad, squad.map(p => p.id)).errors,
    ...validateAttackStartingUnit(plan.attackStartingUnit, plan.squad).errors,
  ];
  if (plan.attackStartingUnit.formation !== 'NORMAL') errors.unshift(STARTING_SEVEN_POSITION_ERROR);
  const byId = new Map(squad.map(p => [p.id, p]));
  for (const selected of plan.squad.players) {
    const player = byId.get(selected.playerId);
    if (player && (selected.position === 'GK') !== (player.position === 'MV')) {
      errors.push('Matchtruppens målvakter och utespelare måste stämma med spelarregistret.');
    }
  }
  return { ok: errors.length === 0, errors };
}

export function selectLineupFromMatchPlan(plan: MatchPlan, squad: readonly PlayerMock[]): CareerLineup | null {
  if (!validateCareerLineup(plan, squad).ok) return null;
  const byId = new Map(squad.map((p) => [p.id, p]));
  const startersByRole: Partial<Record<CourtAttackRole, string>> = {};
  for (const slot of plan.attackStartingUnit.slots) {
    if (slot.position === "GK") continue;
    const role = ENGINE_ROLE_BY_POSITION[handballPositionOf(slot.position) as Exclude<HandballPosition, "MV">];
    if (!role || startersByRole[role] || !byId.has(slot.playerId)) continue;
    startersByRole[role] = slot.playerId;
  }
  if (ROLE_ORDER.some((role) => !startersByRole[role])) return null;

  const goalkeeperId = plan.attackStartingUnit.slots.find(slot => slot.position === 'GK')!.playerId;
  if (!byId.has(goalkeeperId)) return null;

  const taken = new Set<string>([goalkeeperId, ...ROLE_ORDER.map((r) => startersByRole[r]!)]);
  // The bench is the rest of the coach's own 16, in the order he selected them.
  const bench = plan.squad.players
    .filter((p) => !taken.has(p.playerId) && byId.has(p.playerId))
    .map((p) => ({ playerId: p.playerId, isGoalkeeper: p.position === "GK" }));

  return {
    clubId: plan.clubId,
    goalkeeperId,
    startersByRole: startersByRole as Record<CourtAttackRole, string>,
    bench,
    squadIds: [goalkeeperId, ...ROLE_ORDER.map((r) => startersByRole[r]!), ...bench.map((b) => b.playerId)],
    source: "MATCH_PLAN",
  };
}

/** A custom selection is authoritative, including when it is invalid. */
export function resolveCareerLineup(clubId: string, squad: readonly PlayerMock[], plan: MatchPlan | null): CareerLineup | null {
  if (plan) return plan.clubId === clubId ? selectLineupFromMatchPlan(plan, squad) : null;
  return selectBestAvailableLineup(clubId, squad);
}

// ---------------------------------------------------------------------------
// Putting the real players onto the canonical court
// ---------------------------------------------------------------------------

/**
 * The canonical 6v6 state with real career identities on it.
 *
 * The HOME club takes the ATTACK side (the engine's HOME is whoever starts in
 * possession) and the AWAY club the DEFENSE side. Every position, role, facing
 * and movement profile is the engine's own -- only `id` changes, and only to a
 * real career `playerId`.
 *
 * The engine's defenders carry 6:0 court roles (L1..R1) rather than attacking
 * ones, so a defending side's players are matched to those slots through the
 * SAME left-to-right ordering the canonical formation itself uses. That keeps a
 * left wing defending on the left.
 */
export function buildCareerMatchState(home: CareerLineup, away: CareerLineup, attackingGoalSide: AttackingGoalSide): FullCourtMatchState {
  const canonical = createFullCourt6v6State({ attackingGoalSide });
  const players = canonical.handball.players;

  // The canonical attack, in the engine's own role order.
  const attackRoleOf = new Map<string, CourtAttackRole>();
  for (const p of players) {
    if (p.team === "ATTACK" && p.kind === "FIELD_PLAYER") attackRoleOf.set(p.id, p.role as CourtAttackRole);
  }
  // The canonical defence, ordered across the court so L1..R1 lines up with the
  // attacking role order and a wing keeps his side.
  const defenceOrder: readonly string[] = ["L1", "L2", "L3", "R3", "R2", "R1"];

  const renamed: Player[] = players.map((player) => {
    if (player.kind === "GOALKEEPER") {
      return { ...player, id: player.team === "ATTACK" ? home.goalkeeperId : away.goalkeeperId };
    }
    if (player.team === "ATTACK") {
      const role = attackRoleOf.get(player.id);
      return role ? { ...player, id: home.startersByRole[role] } : player;
    }
    const index = defenceOrder.indexOf(player.role as string);
    if (index < 0) return player;
    return { ...player, id: away.startersByRole[ROLE_ORDER[index]] };
  });

  // The ball is held by a player, and that player has just been renamed. The
  // possessor id has to follow him: leaving it pointing at a canonical id that
  // no longer exists on the court left the engine with no carrier at the
  // opening throw-off, which it correctly resolved as a lost ball attributed to
  // a player nobody had ever heard of.
  const idByCanonical = new Map(players.map((p, i) => [p.id, renamed[i].id]));
  const possessorId = canonical.handball.ball.possessorId;
  const ball = possessorId ? { ...canonical.handball.ball, possessorId: idByCanonical.get(possessorId) ?? possessorId } : canonical.handball.ball;

  // The 6:0 home positions are keyed by defender id as well, so they are
  // re-keyed rather than left describing players who are no longer there.
  const homePositions = canonical.handball.defense.homePositions.map((home) => ({ ...home, playerId: idByCanonical.get(home.playerId) ?? home.playerId }));

  return {
    ...canonical,
    handball: { ...canonical.handball, players: renamed, ball, defense: { ...canonical.handball.defense, homePositions } },
  };
}

/**
 * The bench entities for both sides, in the shape M11 holds a bench in.
 *
 * Built by cloning a real starter of the same kind -- so a substitute inherits
 * the engine's own movement profile and canonical shape rather than a second,
 * invented player template -- and then giving him his real career id.
 */
export function buildCareerBench(
  state: FullCourtMatchState,
  home: CareerLineup,
  away: CareerLineup,
): Record<"HOME" | "AWAY", readonly Player[]> {
  const build = (side: "ATTACK" | "DEFENSE", lineup: CareerLineup): Player[] => {
    const onCourt = state.handball.players.filter((p) => p.team === side);
    const outfieldTemplate = onCourt.find((p) => p.kind === "FIELD_PLAYER");
    const keeperTemplate = onCourt.find((p) => p.kind === "GOALKEEPER") ?? outfieldTemplate;
    if (!outfieldTemplate || !keeperTemplate) return [];
    return lineup.bench.map((entry) => {
      const template = entry.isGoalkeeper ? keeperTemplate : outfieldTemplate;
      return {
        ...template,
        id: entry.playerId,
        kind: entry.isGoalkeeper ? ("GOALKEEPER" as const) : ("FIELD_PLAYER" as const),
        role: entry.isGoalkeeper ? ("GOALKEEPER" as const) : template.role,
        velocity: { x: 0, y: 0 },
        intent: { type: "IDLE" as const },
      };
    });
  };
  return { HOME: build("ATTACK", home), AWAY: build("DEFENSE", away) };
}
