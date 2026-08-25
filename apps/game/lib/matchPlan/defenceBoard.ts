// HM-COURT-GRID-0.3 Part D/K/L: the canonical-grid-cell-based defence
// board domain. `courtSlot` (1-6) stays the engine-facing,
// formation-agnostic identity it always was (types.ts's own doc,
// unchanged) -- `cellNumber` is the new, purely additional board
// coordinate, and the formation-specific label (V1/CH/VB/MB/etc.) is
// derived from calibration, never hard-coded per formation here.
import { defenceCourtSlotForPosition, defencePositionForCourtSlot, defenceTacticalPositionForCell, preferredCellForPosition, type DefenceFormationId, type PositionCalibration } from "@/lib/court/tacticalPositionCalibration";
import type { DefenceUnitSlot, MatchPlan } from "./types";

/** Part N: the deterministic default cell for a defence slot missing `cellNumber` (old saves) -- the formation's own preferred cell for whichever position that courtSlot represents. */
function defaultDefenceCellFor(formation: DefenceFormationId, courtSlot: number): number | null {
  const position = defencePositionForCourtSlot(formation, courtSlot);
  return position ? (preferredCellForPosition(formation, position.id) ?? null) : null;
}

/** Resolved cellNumber for every court slot, in array order -- parallels resolveAttackSlotCells. Trusts an existing `slot.cellNumber`; derives a default only when absent. */
export function resolveDefenceSlotCells(formation: DefenceFormationId, courtSlots: readonly DefenceUnitSlot[]): readonly (number | null)[] {
  return courtSlots.map((slot) => slot.cellNumber ?? defaultDefenceCellFor(formation, slot.courtSlot));
}

/** The calibrated position (with its human-approved label -- CH/Center/VB/etc.) a court slot currently represents in this formation. */
export function defenceSlotTacticalPosition(formation: DefenceFormationId, courtSlot: number): PositionCalibration | null {
  return defencePositionForCourtSlot(formation, courtSlot);
}

/**
 * The ONE edit function for the grid-cell defence board (Part K/L):
 * dragging a player onto `targetCellNumber` within the CURRENTLY
 * selected formation's own calibrated cells only (Part K: "Do not
 * allow unrelated attack cells while editing defence" -- structurally
 * guaranteed here since `defenceTacticalPositionForCell` is scoped to
 * exactly one formation). Same move/swap/bench-replace semantics as
 * assignAttackCellPosition, but defence has no "empty court slot"
 * case: all 6 courtSlots always exist (Part G: exactly one occupant
 * per slot, structurally guaranteed by validateDefenceStartingUnit),
 * so a board player dragged onto an alternate cell of their OWN
 * position (e.g. CH's 165 -> 166) simply updates cellNumber in place.
 */
export function assignDefenceCellPosition(plan: MatchPlan, playerId: string, targetCellNumber: number): MatchPlan {
  if (!playerId) return plan;
  const formation = plan.defencePlan.baseFormation as DefenceFormationId;
  const targetPosition = defenceTacticalPositionForCell(formation, targetCellNumber);
  if (!targetPosition) return plan;
  const targetCourtSlot = defenceCourtSlotForPosition(formation, targetPosition.id);
  if (targetCourtSlot === null) return plan;

  const slots = [...plan.defenceStartingUnit.courtSlots];
  const targetIndex = slots.findIndex((s) => s.courtSlot === targetCourtSlot);
  if (targetIndex === -1) return plan;
  const sourceIndex = slots.findIndex((s) => s.playerId === playerId);

  if (sourceIndex === -1) {
    // bench -> occupied slot: replace, displaced player returns to bench.
    slots[targetIndex] = { ...slots[targetIndex], playerId, cellNumber: targetCellNumber };
    return { ...plan, defenceStartingUnit: { ...plan.defenceStartingUnit, courtSlots: slots } };
  }

  if (sourceIndex === targetIndex) {
    slots[sourceIndex] = { ...slots[sourceIndex], cellNumber: targetCellNumber };
    return { ...plan, defenceStartingUnit: { ...plan.defenceStartingUnit, courtSlots: slots } };
  }

  const resolvedCells = resolveDefenceSlotCells(formation, slots);
  const sourceCell = resolvedCells[sourceIndex]!;
  const sourceCourtSlot = slots[sourceIndex].courtSlot;
  const occupantId = slots[targetIndex].playerId;
  slots[targetIndex] = { ...slots[targetIndex], playerId, cellNumber: targetCellNumber };
  slots[sourceIndex] = { ...slots[sourceIndex], playerId: occupantId, courtSlot: sourceCourtSlot, cellNumber: sourceCell };
  return { ...plan, defenceStartingUnit: { ...plan.defenceStartingUnit, courtSlots: slots } };
}
