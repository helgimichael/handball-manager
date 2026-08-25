// HM-TACTICS-1.0 Part B/C/K: attack and defence starting-unit
// validation. Selected independently -- a player can start in one
// phase and not the other, so these two validators never cross-check
// each other.
import { OUTCOURT_POSITIONS } from "../rating/types";
import { matchSquadPlayerIds, type MatchPlanValidationResult } from "./matchSquad";
import type { AttackStartingUnit, DefenceStartingUnit, MatchSquad } from "./types";

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
    if (unit.slots.length !== 7) {
      errors.push(`Normal attack formation must have exactly 7 slots (6 outcourt + 1 goalkeeper), got ${unit.slots.length}.`);
    }
    const gkSlots = unit.slots.filter((s) => s.position === "GK");
    if (gkSlots.length !== 1) {
      errors.push(`Normal attack formation must have exactly 1 goalkeeper slot, got ${gkSlots.length}.`);
    }
    // HM-MATCH-1.3B2 Part 1/5: the tactical SHAPE is no longer fixed to
    // one-of-each-position -- a manager may legitimately run e.g. two
    // pivots + two backcourt players (a snap-zone move on the board
    // relabels a slot's own tactical position, see
    // matchPlanEdits.ts's assignAttackZonePosition). Every outcourt slot
    // must still be a RECOGNIZED outcourt position, but repeats are no
    // longer rejected and no single position is mandatory (Part B's
    // "represented flexibly" rule, previously 7v6-only, now applies to
    // NORMAL too).
    const outcourtSlots = unit.slots.filter((s) => s.position !== "GK");
    for (const slot of outcourtSlots) {
      if (!(OUTCOURT_POSITIONS as readonly string[]).includes(slot.position)) {
        errors.push(`Normal attack formation has an unrecognized outcourt position "${slot.position}".`);
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
