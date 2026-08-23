// HM-TACTICS-1.1: pure, headless "apply one coach edit to a MatchPlan"
// functions -- the Tactics workspace calls these and hands the result
// straight to CareerContext's `updateMatchPlan`. No fs/React; fully
// unit-testable. Every attack/defence slot assignment is a SWAP (the
// player previously in that slot takes the moved player's old slot),
// so a starting unit is always a complete, duplicate-free assignment
// -- there is no "empty slot" representation to fall out of sync with
// HM-TACTICS-1.0's own validation.
import { OUTCOURT_POSITIONS, type OutcourtPositionId } from "../rating/types";
import type {
  AttackFormation,
  AttackPlanConfig,
  AttackUnitSlot,
  DefencePlanConfig,
  MatchPlan,
  MatchRole,
  PlayerPhaseUsage,
  PlayingTimeIntention,
  Position,
  SevenVSixPolicy,
  TransitionPlanConfig,
} from "./types";
import { MATCH_SQUAD_MAX_PLAYERS } from "./types";

/**
 * The shape every Tactics workspace component's `onChange` prop takes.
 * Accepting an updater function (not just a precomputed MatchPlan) lets
 * CareerContext's `updateMatchPlan` always resolve a change against the
 * LATEST committed plan rather than whatever stale `plan` prop a
 * component closed over -- required because a reviewer can fire several
 * onChange calls from the same rendered panel before React re-renders
 * between them (e.g. clicking match role, then playing time, then phase
 * usage on one player in quick succession).
 */
export type MatchPlanUpdater = MatchPlan | ((prev: MatchPlan) => MatchPlan);
export type OnMatchPlanChange = (updater: MatchPlanUpdater) => void;

// ---------------------------------------------------------------------------
// Match squad (Part B)
// ---------------------------------------------------------------------------

export function addPlayerToSquad(plan: MatchPlan, playerId: string, position: Position): MatchPlan {
  if (plan.squad.players.length >= MATCH_SQUAD_MAX_PLAYERS) return plan;
  if (plan.squad.players.some((p) => p.playerId === playerId)) return plan;
  return {
    ...plan,
    squad: { ...plan.squad, players: [...plan.squad.players, { playerId, position }] },
    playerUsage: [...plan.playerUsage, { playerId, matchRole: "ROTATION", playingTimeIntention: "NORMAL", phaseUsage: "BOTH_PHASES" }],
  };
}

/** True if `playerId` currently occupies any attack or defence starting slot -- the UI must block squad removal while this holds (Part B: "no random automatic substitutions"; removal must be an explicit, deliberate coach action, not an implicit one). */
export function isPlayerStarting(plan: MatchPlan, playerId: string): boolean {
  return plan.attackStartingUnit.slots.some((s) => s.playerId === playerId) || plan.defenceStartingUnit.courtSlots.some((s) => s.playerId === playerId) || plan.defenceStartingUnit.goalkeeperId === playerId;
}

/** No-op if the player is currently starting -- callers should check `isPlayerStarting` first to explain why, rather than silently doing nothing. */
export function removePlayerFromSquad(plan: MatchPlan, playerId: string): MatchPlan {
  if (isPlayerStarting(plan, playerId)) return plan;
  return {
    ...plan,
    squad: { ...plan.squad, players: plan.squad.players.filter((p) => p.playerId !== playerId) },
    playerUsage: plan.playerUsage.filter((u) => u.playerId !== playerId),
    substitutionPairs: plan.substitutionPairs.filter((p) => p.attackPlayerId !== playerId && p.defencePlayerId !== playerId),
  };
}

// ---------------------------------------------------------------------------
// Attack starting unit (Part C/D/F)
// ---------------------------------------------------------------------------

export function assignNormalAttackSlot(plan: MatchPlan, targetPosition: Position, playerId: string): MatchPlan {
  if (plan.attackStartingUnit.formation !== "NORMAL") return plan;
  const slots = plan.attackStartingUnit.slots;
  const currentPlayerAtTarget = slots.find((s) => s.position === targetPosition)?.playerId;
  const playerCurrentPosition = slots.find((s) => s.playerId === playerId)?.position;

  const nextSlots = slots.map((s) => {
    if (s.position === targetPosition) return { ...s, playerId };
    if (playerCurrentPosition && s.position === playerCurrentPosition && s.position !== targetPosition) {
      return { ...s, playerId: currentPlayerAtTarget ?? s.playerId };
    }
    return s;
  });
  return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots: nextSlots } };
}

export function assignSevenVSixSlot(plan: MatchPlan, slotIndex: number, playerId: string, position: Position): MatchPlan {
  if (plan.attackStartingUnit.formation !== "SEVEN_V_SIX") return plan;
  const slots = [...plan.attackStartingUnit.slots];
  const existingIndex = slots.findIndex((s) => s.playerId === playerId);
  const displaced = slots[slotIndex]?.playerId;
  slots[slotIndex] = { playerId, position };
  if (existingIndex !== -1 && existingIndex !== slotIndex && displaced) {
    slots[existingIndex] = { playerId: displaced, position: slots[existingIndex].position };
  }
  return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots } };
}

/**
 * Switches between NORMAL and SEVEN_V_SIX (Part F). Deterministic, no
 * randomness: SEVEN_V_SIX adds the first eligible bench outcourt
 * player as the 7th attacker; back to NORMAL keeps the first player
 * seen at each position (de-duplicating any repeats 7v6 allowed) and
 * fills any still-missing position from the bench.
 */
export function setAttackFormation(plan: MatchPlan, formation: AttackFormation): MatchPlan {
  if (plan.attackStartingUnit.formation === formation) return plan;

  if (formation === "SEVEN_V_SIX") {
    const outcourtSlots = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK");
    const usedIds = new Set(outcourtSlots.map((s) => s.playerId));
    const extra = plan.squad.players.find((p) => p.position !== "GK" && !usedIds.has(p.playerId));
    const slots: AttackUnitSlot[] = extra ? [...outcourtSlots, { playerId: extra.playerId, position: extra.position }] : outcourtSlots;
    return { ...plan, attackStartingUnit: { formation: "SEVEN_V_SIX", slots } };
  }

  const seenPositions = new Set<Position>();
  const kept: AttackUnitSlot[] = [];
  for (const slot of plan.attackStartingUnit.slots) {
    if (slot.position !== "GK" && !seenPositions.has(slot.position)) {
      seenPositions.add(slot.position);
      kept.push(slot);
    }
  }
  for (const position of OUTCOURT_POSITIONS as readonly OutcourtPositionId[]) {
    if (seenPositions.has(position)) continue;
    const usedIds = new Set(kept.map((s) => s.playerId));
    const fill = plan.squad.players.find((p) => p.position === position && !usedIds.has(p.playerId)) ?? plan.squad.players.find((p) => p.position !== "GK" && !usedIds.has(p.playerId));
    if (fill) {
      kept.push({ playerId: fill.playerId, position });
      seenPositions.add(position);
    }
  }
  const gk = plan.squad.players.find((p) => p.position === "GK");
  const gkSlot: AttackUnitSlot = { playerId: gk?.playerId ?? plan.defenceStartingUnit.goalkeeperId, position: "GK" };
  return { ...plan, attackStartingUnit: { formation: "NORMAL", slots: [gkSlot, ...kept] } };
}

// ---------------------------------------------------------------------------
// Defence starting unit (Part E)
// ---------------------------------------------------------------------------

export function assignDefenceCourtSlot(plan: MatchPlan, courtSlot: number, playerId: string): MatchPlan {
  const slots = plan.defenceStartingUnit.courtSlots;
  const currentAtTarget = slots.find((s) => s.courtSlot === courtSlot)?.playerId;
  const playerCurrentSlot = slots.find((s) => s.playerId === playerId)?.courtSlot;

  const nextSlots = slots.map((s) => {
    if (s.courtSlot === courtSlot) return { ...s, playerId };
    if (playerCurrentSlot !== undefined && s.courtSlot === playerCurrentSlot && s.courtSlot !== courtSlot) {
      return { ...s, playerId: currentAtTarget ?? s.playerId };
    }
    return s;
  });
  return { ...plan, defenceStartingUnit: { ...plan.defenceStartingUnit, courtSlots: nextSlots } };
}

export function assignDefenceGoalkeeper(plan: MatchPlan, playerId: string): MatchPlan {
  return { ...plan, defenceStartingUnit: { ...plan.defenceStartingUnit, goalkeeperId: playerId } };
}

export function assignAttackGoalkeeper(plan: MatchPlan, playerId: string): MatchPlan {
  const slots = plan.attackStartingUnit.slots.map((s) => (s.position === "GK" ? { ...s, playerId } : s));
  return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots } };
}

// ---------------------------------------------------------------------------
// Player match usage (Part G)
// ---------------------------------------------------------------------------

export function setPlayerMatchRole(plan: MatchPlan, playerId: string, matchRole: MatchRole): MatchPlan {
  return { ...plan, playerUsage: plan.playerUsage.map((u) => (u.playerId === playerId ? { ...u, matchRole } : u)) };
}

export function setPlayerPlayingTime(plan: MatchPlan, playerId: string, playingTimeIntention: PlayingTimeIntention): MatchPlan {
  return { ...plan, playerUsage: plan.playerUsage.map((u) => (u.playerId === playerId ? { ...u, playingTimeIntention } : u)) };
}

export function setPlayerPhaseUsage(plan: MatchPlan, playerId: string, phaseUsage: PlayerPhaseUsage): MatchPlan {
  return { ...plan, playerUsage: plan.playerUsage.map((u) => (u.playerId === playerId ? { ...u, phaseUsage } : u)) };
}

// ---------------------------------------------------------------------------
// Substitution pairs (Part H)
// ---------------------------------------------------------------------------

/** Removes either player from any existing pair, then adds the new pair. Domain validation (validateSubstitutionPairs) still runs before persisting -- this only keeps the common "re-pair" edit a single call. */
export function setSubstitutionPair(plan: MatchPlan, attackPlayerId: string, defencePlayerId: string): MatchPlan {
  const withoutEither = plan.substitutionPairs.filter((p) => p.attackPlayerId !== attackPlayerId && p.defencePlayerId !== attackPlayerId && p.attackPlayerId !== defencePlayerId && p.defencePlayerId !== defencePlayerId);
  return { ...plan, substitutionPairs: [...withoutEither, { attackPlayerId, defencePlayerId }] };
}

export function clearSubstitutionPairFor(plan: MatchPlan, playerId: string): MatchPlan {
  return { ...plan, substitutionPairs: plan.substitutionPairs.filter((p) => p.attackPlayerId !== playerId && p.defencePlayerId !== playerId) };
}

export function substitutionPartnerOf(plan: MatchPlan, playerId: string): string | null {
  const pair = plan.substitutionPairs.find((p) => p.attackPlayerId === playerId || p.defencePlayerId === playerId);
  if (!pair) return null;
  return pair.attackPlayerId === playerId ? pair.defencePlayerId : pair.attackPlayerId;
}

// ---------------------------------------------------------------------------
// Tactical configuration (Part J/K/L)
// ---------------------------------------------------------------------------

export function updateAttackPlan(plan: MatchPlan, changes: Partial<Omit<AttackPlanConfig, "sevenVSixPolicy">>): MatchPlan {
  return { ...plan, attackPlan: { ...plan.attackPlan, ...changes } };
}

export function updateSevenVSixPolicy(plan: MatchPlan, changes: Partial<SevenVSixPolicy>): MatchPlan {
  return { ...plan, attackPlan: { ...plan.attackPlan, sevenVSixPolicy: { ...plan.attackPlan.sevenVSixPolicy, ...changes } } };
}

export function updateDefencePlan(plan: MatchPlan, changes: Partial<DefencePlanConfig>): MatchPlan {
  return { ...plan, defencePlan: { ...plan.defencePlan, ...changes } };
}

export function updateTransitionPlan(plan: MatchPlan, changes: Partial<TransitionPlanConfig>): MatchPlan {
  return { ...plan, transitionPlan: { ...plan.transitionPlan, ...changes } };
}
