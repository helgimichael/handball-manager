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
  SevenVSixStructure,
  TransitionPlanConfig,
} from "./types";
import { MATCH_SQUAD_MAX_PLAYERS, SEVEN_V_SIX_STRUCTURE_POSITIONS } from "./types";

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

/**
 * HM-MATCH-1.3B2 Part 6/7: the ONE canonical "who is PÅ PLAN right now"
 * membership set -- tied to a SPECIFIC phase's starting unit, never a
 * cross-phase union. `isPlayerStarting` above answers "is this player
 * starting in ANY phase" (used to gate squad removal); this answers
 * "is this player in THIS displayed unit" (used to split Matchtrupp
 * into PÅ PLAN / BÄNK for whichever board is currently shown). Always
 * exactly 7 members for a NORMAL attack unit or a defence unit (6
 * outcourt + goalkeeper), or 7 for a SEVEN_V_SIX attack unit (7
 * outcourt, no goalkeeper) -- the board's own slot counts are the only
 * source of truth, never re-derived here.
 */
export function currentUnitPlayerIds(plan: MatchPlan, phase: "ATTACK" | "DEFENCE"): ReadonlySet<string> {
  if (phase === "ATTACK") {
    return new Set(plan.attackStartingUnit.slots.map((s) => s.playerId));
  }
  const ids = plan.defenceStartingUnit.courtSlots.map((s) => s.playerId);
  if (plan.defenceStartingUnit.goalkeeperId) ids.push(plan.defenceStartingUnit.goalkeeperId);
  return new Set(ids);
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

/**
 * HM-PLAYTEST-01 1.1: picking a starter in a MANUAL selection. A player who
 * was not in the matchday squad REPLACES the displaced starter, who leaves the
 * squad -- the manager picked seven names and the matchday squad is exactly
 * those seven. (The old swap kept the displaced starter on the bench without
 * telling anybody, so a "seven-player" selection silently carried an eighth
 * man who then came on for a suspended team-mate.) A bench player or another
 * starter still swaps, keeping the squad size the manager chose.
 */
export function assignManualStarter(plan: MatchPlan, targetPosition: Position, playerId: string): { plan: MatchPlan; removedPlayerId: string | null } {
  if (plan.attackStartingUnit.formation !== "NORMAL") return { plan, removedPlayerId: null };
  const wasInSquad = plan.squad.players.some((p) => p.playerId === playerId);
  const displaced = plan.attackStartingUnit.slots.find((s) => s.position === targetPosition)?.playerId || null;
  const added = wasInSquad ? plan : addPlayerToSquad(plan, playerId, targetPosition);
  if (!wasInSquad && added === plan) return { plan, removedPlayerId: null };
  let next = assignNormalAttackSlot(added, targetPosition, playerId);
  if (wasInSquad || !displaced || displaced === playerId) return { plan: next, removedPlayerId: null };
  // The displaced man no longer starts anywhere; take him out of every unit and the squad.
  next = {
    ...next,
    defenceStartingUnit: {
      ...next.defenceStartingUnit,
      goalkeeperId: next.defenceStartingUnit.goalkeeperId === displaced ? playerId : next.defenceStartingUnit.goalkeeperId,
      courtSlots: next.defenceStartingUnit.courtSlots.map((s) => (s.playerId === displaced ? { ...s, playerId } : s)),
    },
  };
  return { plan: removePlayerFromSquad(next, displaced), removedPlayerId: displaced };
}

/**
 * HM-MATCH-1.3B2 Part 1/2/3: the snap-zone board's ONE edit function --
 * moving/swapping a player between board zones changes the tactical
 * SHAPE itself (which zone maps to which slot INDEX is a pure,
 * deterministic UI-layer projection -- see attackZones.ts -- not
 * domain state). `playerId` is who was dragged; `targetPosition` is the
 * tactical position the DESTINATION zone represents (derived from the
 * zone, e.g. a pivot zone always yields "M6"); `targetSlotIndex` is the
 * array index of whichever EXISTING slot the destination zone currently
 * projects onto, or `null` if the destination zone is currently empty
 * (no slot projects there right now).
 *
 * Three cases, matching Part 1/2/8 exactly:
 *  - BENCH -> occupied zone: replaces that slot's player outright (the
 *    displaced player implicitly returns to the bench, same "no empty
 *    slot representation" convention every other assign function here
 *    already uses). A bench player dropped on an EMPTY zone is a no-op
 *    (Part 8's scope: only board-to-board moves may target an empty
 *    zone this milestone -- deciding who a bench addition should bump
 *    is not defined for a zone with no current occupant).
 *  - board player -> EMPTY zone: a pure MOVE -- only the dragged
 *    player's own slot is relabeled to the new zone's position; no
 *    other slot is touched. This is what actually changes the shape
 *    (e.g. moving a backcourt player into a second pivot zone).
 *  - board player -> OCCUPIED zone: a SWAP -- the two slots trade
 *    positions, exactly like assignSevenVSixSlot's existing pattern.
 *
 * Never mutates `playerId`'s own natural squad position (Part R/3) --
 * only `slots[i].position`, the fixture-scoped tactical assignment.
 */
export function assignAttackZonePosition(plan: MatchPlan, playerId: string, targetPosition: Position, targetSlotIndex: number | null): MatchPlan {
  if (plan.attackStartingUnit.formation !== "NORMAL" || !playerId) return plan;
  const slots = [...plan.attackStartingUnit.slots];
  const sourceIndex = slots.findIndex((s) => s.playerId === playerId && s.position !== "GK");

  if (sourceIndex === -1) {
    if (targetSlotIndex === null || slots[targetSlotIndex]?.position === "GK") return plan;
    slots[targetSlotIndex] = { playerId, position: targetPosition };
    return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots } };
  }

  const sourcePosition = slots[sourceIndex].position;
  if (targetSlotIndex === null || targetSlotIndex === sourceIndex) {
    slots[sourceIndex] = { playerId, position: targetPosition };
  } else if (slots[targetSlotIndex]?.position !== "GK") {
    const occupantId = slots[targetSlotIndex].playerId;
    slots[targetSlotIndex] = { playerId, position: targetPosition };
    slots[sourceIndex] = { playerId: occupantId, position: sourcePosition };
  }
  return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots } };
}

/**
 * HM-MATCH-1.1 Part 6: a slot's POSITION is fixed by the lineup's
 * `sevenVSixStructure` (never a caller-supplied, freeform value -- the
 * confirmed root cause of the previous "two V6 slots" bug) -- this only
 * ever assigns WHICH PLAYER occupies that already-fixed slot.
 */
export function assignSevenVSixSlot(plan: MatchPlan, slotIndex: number, playerId: string): MatchPlan {
  if (plan.attackStartingUnit.formation !== "SEVEN_V_SIX") return plan;
  const structure = plan.attackStartingUnit.sevenVSixStructure ?? "DOUBLE_PIVOT";
  const position = SEVEN_V_SIX_STRUCTURE_POSITIONS[structure][slotIndex];
  if (!position) return plan;
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
 * HM-MATCH-1.1 Part 6: switches the 7v6 lineup to a different recognized
 * structure while the coach is already in SEVEN_V_SIX -- re-labels each
 * slot's position per the new template (index-preserving; players stay
 * in the same slot index) without reassigning any player. A coach can
 * then use `assignSevenVSixSlot` per-slot afterward if a player needs
 * moving to better fit the new shape.
 */
export function setSevenVSixStructure(plan: MatchPlan, structure: SevenVSixStructure): MatchPlan {
  if (plan.attackStartingUnit.formation !== "SEVEN_V_SIX") return plan;
  const positions = SEVEN_V_SIX_STRUCTURE_POSITIONS[structure];
  const slots = plan.attackStartingUnit.slots.map((slot, i) => ({ playerId: slot.playerId, position: positions[i] ?? slot.position }));
  return { ...plan, attackStartingUnit: { formation: "SEVEN_V_SIX", slots, sevenVSixStructure: structure } };
}

/**
 * Switches between NORMAL and SEVEN_V_SIX (Part F). Deterministic, no
 * randomness: SEVEN_V_SIX builds a lineup from a RECOGNIZED structure
 * template (HM-MATCH-1.1 Part 6, default DOUBLE_PIVOT) -- the 6 shared
 * positions keep exactly the same players the NORMAL lineup already
 * had, and the one duplicated position is filled by the first eligible
 * bench player who plays that position (falling back to any remaining
 * bench outcourt player), never a caller-chosen freeform position. Back
 * to NORMAL keeps the first player seen at each distinct position
 * (de-duplicating any repeats 7v6 allowed) and fills any still-missing
 * position from the bench.
 */
export function setAttackFormation(plan: MatchPlan, formation: AttackFormation, structure: SevenVSixStructure = "DOUBLE_PIVOT"): MatchPlan {
  if (plan.attackStartingUnit.formation === formation) return plan;

  if (formation === "SEVEN_V_SIX") {
    const outcourtSlots = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK");
    const playerIdByPosition = new Map(outcourtSlots.map((s) => [s.position, s.playerId]));
    const usedIds = new Set(outcourtSlots.map((s) => s.playerId));
    const positions = SEVEN_V_SIX_STRUCTURE_POSITIONS[structure];

    const slots: AttackUnitSlot[] = [];
    for (const position of positions) {
      const existing = playerIdByPosition.get(position);
      if (existing && !slots.some((s) => s.playerId === existing)) {
        slots.push({ playerId: existing, position });
        continue;
      }
      // Either this is the structure's duplicated slot, or the shared
      // position's player was already placed -- fill from the bench,
      // preferring a player whose OWN position matches this slot.
      const benchMatch = plan.squad.players.find((p) => p.position === position && !usedIds.has(p.playerId));
      const benchAny = benchMatch ?? plan.squad.players.find((p) => p.position !== "GK" && !usedIds.has(p.playerId));
      if (benchAny) {
        slots.push({ playerId: benchAny.playerId, position });
        usedIds.add(benchAny.playerId);
      }
    }
    return { ...plan, attackStartingUnit: { formation: "SEVEN_V_SIX", slots, sevenVSixStructure: structure } };
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

/** HM-MATCH-1.2 Part C: "Återställ till standard" -- overwrites one player's matchRole/playingTimeIntention/phaseUsage for THIS fixture with their persistent default in one call, rather than three separate edits. */
export function applyPlayerMatchDefault(plan: MatchPlan, playerId: string, matchDefault: { matchRole: MatchRole; playingTimeIntention: PlayingTimeIntention; phaseUsage: PlayerPhaseUsage }): MatchPlan {
  return { ...plan, playerUsage: plan.playerUsage.map((u) => (u.playerId === playerId ? { ...u, ...matchDefault } : u)) };
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

/**
 * HM-MATCH-USAGE-1.4A Part 2/3/20: which side of a SubstitutionPair
 * (attackPlayerId vs defencePlayerId) each of two players being linked
 * should be recorded as -- read from each player's OWN PhaseUsage,
 * never simply "whichever player initiated the edit". This is the
 * confirmed root cause of browser QA's own "explicit SPECIALIST/HIGH
 * pair received 0/0 minutes": the UI's own "Byter med" control used to
 * always call `setSubstitutionPair(plan, currentPlayerId, partnerId)`,
 * treating whichever player's panel was open as the attack side
 * regardless of their actual phase -- a coach setting up the pair from
 * BOTH players' own panels (the natural workflow: open the attack
 * specialist and link the defence specialist, then later open the
 * defence specialist to confirm) silently recorded the pair BACKWARDS
 * on the second edit, so matchUsagePlan.ts's own preferred/other-side
 * pair boost was applied to whichever phase that player structurally
 * has ZERO usage weight in.
 */
export function resolveSubstitutionPairOrder(currentPlayerId: string, currentPhaseUsage: PlayerPhaseUsage, partnerPlayerId: string, partnerPhaseUsage: PlayerPhaseUsage | undefined): { attackPlayerId: string; defencePlayerId: string } {
  const isDefenceLeaning = (phase: PlayerPhaseUsage) => phase === "DEFENCE_ONLY" || phase === "DEFENCE_PREFERRED";
  const isAttackLeaning = (phase: PlayerPhaseUsage) => phase === "ATTACK_ONLY" || phase === "ATTACK_PREFERRED";

  if (isDefenceLeaning(currentPhaseUsage) && (!partnerPhaseUsage || !isDefenceLeaning(partnerPhaseUsage))) {
    return { attackPlayerId: partnerPlayerId, defencePlayerId: currentPlayerId };
  }
  if (partnerPhaseUsage && isDefenceLeaning(partnerPhaseUsage) && isAttackLeaning(currentPhaseUsage)) {
    return { attackPlayerId: currentPlayerId, defencePlayerId: partnerPlayerId };
  }
  // Neither player's own PhaseUsage declares a clear side (both
  // BOTH_PHASES, or an otherwise ambiguous combination) -- default to
  // the pre-existing behavior (current player as attack side) so a
  // plain, non-specialist pairing keeps working exactly as before.
  return { attackPlayerId: currentPlayerId, defencePlayerId: partnerPlayerId };
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
