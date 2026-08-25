// HM-COURT-GRID-0.3 Part D/F/G/I/J: the canonical-grid-cell-based
// attack board domain -- replaces attackZones.ts's fixed 8-zone model
// as the LIVE Tactics board's authority (attackZones.ts/courtLayout.ts
// are left in place, still covered by their own tests, but are no
// longer wired into StartingUnitEditor.tsx).
//
// A slot's tactical identity is now `cellNumber` (which calibrated
// board cell it occupies) -- the finer LEFT_M9/M9/RIGHT_M9 and
// M6_LEFT/M6_RIGHT distinction lives ENTIRELY in which cell a slot
// resolves to, never in `position` (the Match Engine input, which
// keeps its pre-existing meaning -- see tacticalPositionCalibration.ts's
// ATTACK_TACTICAL_TO_ENGINE_POSITION). This is what makes custom shapes
// (two pivots, four backcourt players, no-M6 structures) possible
// without any new Match Engine vocabulary (Part I).
import { attackTacticalPositionForCell, ATTACK_TACTICAL_TO_ENGINE_POSITION, preferredCellForPosition, type AttackPositionCalibration } from "@/lib/court/tacticalPositionCalibration";
import type { AttackUnitSlot, MatchPlan, Position } from "./types";

/** Part N: the deterministic default cell for a slot that has no `cellNumber` yet (old saves) -- keyed by engine Position AND how many prior slots in the array already claimed that position, so e.g. a lineup's first M6 defaults to M6_LEFT's cell and a second (7v6 double pivot) to M6_RIGHT's. Always one of the position's own approved calibration cells (never invented). */
function defaultAttackCellFor(position: Position, occurrenceIndex: number): number | null {
  if (position === "GK") return null;
  if (position === "M6") return preferredCellForPosition("ATTACK", occurrenceIndex === 0 ? "M6_LEFT" : "M6_RIGHT");
  if (position === "M9") return preferredCellForPosition("ATTACK", occurrenceIndex === 0 ? "M9" : occurrenceIndex === 1 ? "RIGHT_M9" : "M9");
  // V6/V9/H9/H6 -- each has exactly one canonical engine Position and a single preferred cell regardless of occurrence.
  return preferredCellForPosition("ATTACK", position);
}

/**
 * The resolved cellNumber for every slot, in array order -- `null` for
 * a GK slot (rendered at a fixed anchor, out of calibration scope).
 * Trusts an already-set `slot.cellNumber` outright; only derives a
 * default for a slot missing one (Part N's migration path). Pure,
 * deterministic, recomputed fresh every call -- never persisted UI
 * state, same principle attackZones.ts's projectSlotsOntoZones already
 * established.
 *
 * The occurrence counter used for the M6/M9 default fallback (Part N)
 * only advances for slots that ACTUALLY consume a default -- a slot
 * with an explicit `cellNumber` is trusted outright and never counted,
 * so it can never be silently collided with by a later same-position
 * slot's own fallback default (a real bug found via browser QA: moving
 * one M6 slot onto the M6_RIGHT cell while a second, still-default M6
 * slot existed made BOTH resolve to the same cell, since the second
 * slot's fallback index was computed from ALL same-position slots
 * rather than only the ones still needing a default).
 */
export function resolveAttackSlotCells(slots: readonly AttackUnitSlot[]): readonly (number | null)[] {
  const occurrence = new Map<Position, number>();
  return slots.map((slot) => {
    if (slot.position === "GK") return null;
    if (slot.cellNumber != null) return slot.cellNumber;
    const index = occurrence.get(slot.position) ?? 0;
    occurrence.set(slot.position, index + 1);
    return defaultAttackCellFor(slot.position, index);
  });
}

/** The tactical position (LEFT_M9/M9/RIGHT_M9/M6_LEFT/M6_RIGHT/V6/V9/H9/H6) a resolved slot cell currently represents, or null for GK/an unresolved cell. */
export function attackSlotTacticalPosition(cellNumber: number | null): AttackPositionCalibration | null {
  if (cellNumber === null) return null;
  return attackTacticalPositionForCell(cellNumber);
}

/**
 * The ONE edit function for the grid-cell attack board (Part F/G):
 * dragging a player onto `targetCellNumber` --
 *  - bench player -> occupied cell: replaces the occupant (who returns
 *    to the bench, same "no empty slot representation" convention every
 *    other assign function in this domain already uses).
 *  - bench player -> empty calibrated cell: unsupported this milestone
 *    (no-op), same documented scope limit attackZones.ts's own
 *    predecessor function already had.
 *  - board player -> empty calibrated cell: a pure MOVE -- only the
 *    dragged player's own slot changes (position relabeled via
 *    ATTACK_TACTICAL_TO_ENGINE_POSITION, cellNumber updated). This is
 *    what actually changes the shape (Part F/I).
 *  - board player -> occupied cell: a SWAP -- the two slots trade
 *    position AND cellNumber.
 * Works for BOTH formations (NORMAL and SEVEN_V_SIX) since attack
 * calibration is one context regardless of formation (Part M: 7v6 uses
 * the same calibrated attack cells, no parallel geometry).
 * Rejects a `targetCellNumber` that isn't part of the attack
 * calibration outright (Part C: never invents a snap cell).
 */
export function assignAttackCellPosition(plan: MatchPlan, playerId: string, targetCellNumber: number): MatchPlan {
  if (!playerId) return plan;
  const targetPosition = attackTacticalPositionForCell(targetCellNumber);
  if (!targetPosition) return plan;
  const targetEnginePosition = (ATTACK_TACTICAL_TO_ENGINE_POSITION[targetPosition.id] as Position | undefined) ?? null;
  if (!targetEnginePosition) return plan;

  const slots = [...plan.attackStartingUnit.slots];
  const resolvedCells = resolveAttackSlotCells(slots);
  const sourceIndex = slots.findIndex((s, i) => s.playerId === playerId && resolvedCells[i] !== null);
  const targetIndex = resolvedCells.findIndex((cell) => cell === targetCellNumber);

  if (sourceIndex === -1) {
    if (targetIndex === -1) return plan; // bench -> empty cell: unsupported this milestone
    slots[targetIndex] = { playerId, position: targetEnginePosition, cellNumber: targetCellNumber };
    return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots } };
  }

  if (targetIndex === -1 || targetIndex === sourceIndex) {
    slots[sourceIndex] = { playerId, position: targetEnginePosition, cellNumber: targetCellNumber };
    return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots } };
  }

  const sourceCell = resolvedCells[sourceIndex]!;
  const sourcePosition = slots[sourceIndex].position;
  const occupantId = slots[targetIndex].playerId;
  slots[targetIndex] = { playerId, position: targetEnginePosition, cellNumber: targetCellNumber };
  slots[sourceIndex] = { playerId: occupantId, position: sourcePosition, cellNumber: sourceCell };
  return { ...plan, attackStartingUnit: { ...plan.attackStartingUnit, slots } };
}
