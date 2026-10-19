// HM-TACTICS-1.0 Part B/C/K: attack and defence starting-unit
// validation. Selected independently -- a player can start in one
// phase and not the other, so these two validators never cross-check
// each other.
import { OUTCOURT_POSITIONS } from "../rating/types";
import { matchSquadPlayerIds, type MatchPlanValidationResult } from "./matchSquad";
import type { AttackStartingUnit, DefenceStartingUnit, MatchPlan, MatchSquad } from "./types";

export const STARTING_SEVEN_POSITION_ERROR = 'Uppställningen måste innehålla exakt en spelare på varje position (MV, V6, V9, M9, H9, H6, M6).';

/** Alpha uses a shared starting seven; preserve defensive roles/locations but
 * show the actual starting people rather than unused independent selections. */
export function linkDefenceStarters(plan: MatchPlan): MatchPlan {
  if (plan.attackStartingUnit.formation !== 'NORMAL') return plan;
  const outfield = plan.attackStartingUnit.slots.filter(slot => slot.position !== 'GK');
  const goalkeeper = plan.attackStartingUnit.slots.find(slot => slot.position === 'GK');
  return { ...plan, defenceStartingUnit: {
    ...plan.defenceStartingUnit,
    goalkeeperId: goalkeeper?.playerId ?? plan.defenceStartingUnit.goalkeeperId,
    courtSlots: plan.defenceStartingUnit.courtSlots.map((slot, index) => ({ ...slot, playerId: outfield[index]?.playerId ?? slot.playerId })),
  } };
}

function ok(): MatchPlanValidationResult {
  return { ok: true, errors: [] };
}
function fail(errors: string[]): MatchPlanValidationResult {
  return { ok: false, errors };
}

/** Every squad player's own recorded position, for goalkeeper-identity checks. */
function positionOf(squad: MatchSquad, playerId: string): string | undefined {
  return squad.players.find((p) => p.playerId === playerId)?.position;
}

export function validateAttackStartingUnit(unit: AttackStartingUnit, squad: MatchSquad): MatchPlanValidationResult {
  const errors: string[] = [];
  const squadIds = matchSquadPlayerIds(squad);

  const seenPlayers = new Set<string>();
  for (const slot of unit.slots) {
    if (!squadIds.has(slot.playerId)) {
      errors.push(`Attack starting unit references "${slot.playerId}", who is not in the match squad.`);
    }
    if (seenPlayers.has(slot.playerId)) {
      errors.push(`Attack starting unit lists "${slot.playerId}" more than once.`);
    }
    seenPlayers.add(slot.playerId);
  }

  if (unit.formation === "NORMAL") {
    const positions = ['GK', ...OUTCOURT_POSITIONS];
    if (unit.slots.length !== 7 || positions.some(position => unit.slots.filter(slot => slot.position === position).length !== 1)) {
      errors.unshift(STARTING_SEVEN_POSITION_ERROR);
    }
    if (unit.slots.length !== 7) {
      errors.push(`Normal attack formation must have exactly 7 slots (6 outcourt + 1 goalkeeper), got ${unit.slots.length}.`);
    }
    const gkSlots = unit.slots.filter((s) => s.position === "GK");
    if (gkSlots.length !== 1) {
      errors.push(`Normal attack formation must have exactly 1 goalkeeper slot, got ${gkSlots.length}.`);
    }
    // Alpha production maps one player into each of V2's six court roles.
    // Natural outfield positions may differ from the assigned tactical slot.
    const outcourtSlots = unit.slots.filter((s) => s.position !== "GK");
    for (const slot of outcourtSlots) {
      if (!(OUTCOURT_POSITIONS as readonly string[]).includes(slot.position)) {
        errors.push(`Normal attack formation has an unrecognized outcourt position "${slot.position}".`);
      }
    }
    for (const slot of unit.slots) {
      if (squadIds.has(slot.playerId) && (slot.position === 'GK') !== (positionOf(squad, slot.playerId) === 'GK')) {
        errors.push('Målvaktsplatsen måste bemannas av en målvakt. Målvakter kan inte väljas som utespelare.');
      }
    }
    // A player's ASSIGNED slot position is deliberately not required to
    // match their own recorded natural position -- a coach may
    // legitimately play someone out of position. Goalkeeper identity
    // (checked above) is the one hard requirement.
  } else {
    // SEVEN_V_SIX: 7 outcourt slots, zero goalkeepers, positions may repeat (Part B: represented flexibly).
    if (unit.slots.length !== 7) {
      errors.push(`7v6 attack formation must have exactly 7 slots, got ${unit.slots.length}.`);
    }
    const gkSlots = unit.slots.filter((s) => s.position === "GK");
    if (gkSlots.length !== 0) {
      errors.push(`7v6 attack formation must have zero goalkeeper slots (the keeper is off for an extra attacker), got ${gkSlots.length}.`);
    }
  }

  return errors.length === 0 ? ok() : fail(errors);
}

export function validateDefenceStartingUnit(unit: DefenceStartingUnit, squad: MatchSquad): MatchPlanValidationResult {
  const errors: string[] = [];
  const squadIds = matchSquadPlayerIds(squad);

  if (!squadIds.has(unit.goalkeeperId)) {
    errors.push(`Defence starting unit's goalkeeper "${unit.goalkeeperId}" is not in the match squad.`);
  } else if (positionOf(squad, unit.goalkeeperId) !== "GK") {
    errors.push(`Defence starting unit's goalkeeper "${unit.goalkeeperId}" is not a goalkeeper in the match squad.`);
  }

  if (unit.courtSlots.length !== 6) {
    errors.push(`Defence starting unit must have exactly 6 court slots, got ${unit.courtSlots.length}.`);
  }

  const seenPlayers = new Set<string>();
  const seenSlots = new Set<number>();
  for (const slot of unit.courtSlots) {
    if (!squadIds.has(slot.playerId)) {
      errors.push(`Defence starting unit references "${slot.playerId}", who is not in the match squad.`);
    }
    if (slot.playerId === unit.goalkeeperId) {
      errors.push(`Defence starting unit's goalkeeper "${unit.goalkeeperId}" cannot also occupy a court slot.`);
    }
    if (seenPlayers.has(slot.playerId)) {
      errors.push(`Defence starting unit lists "${slot.playerId}" more than once.`);
    }
    seenPlayers.add(slot.playerId);

    if (slot.courtSlot < 1 || slot.courtSlot > 6 || !Number.isInteger(slot.courtSlot)) {
      errors.push(`Defence court slot ${slot.courtSlot} is invalid -- must be an integer 1-6.`);
    }
    if (seenSlots.has(slot.courtSlot)) {
      errors.push(`Defence court slot ${slot.courtSlot} is used more than once.`);
    }
    seenSlots.add(slot.courtSlot);
  }

  return errors.length === 0 ? ok() : fail(errors);
}
