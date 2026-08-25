// HM-COURT-GRID-0.2 Part A: manually supplied tactical-position
// calibration, encoded EXACTLY as provided (see the milestone's own
// spec) -- not derived, not "corrected" toward general handball
// knowledge, not merged with any existing hard-coded tactical
// coordinates (attackZones.ts, courtLayout.ts, StartingUnitEditor,
// MatchPlan positions). This module sits on TOP of the canonical
// courtGrid.ts as a separate, parallel mapping layer; it never mutates
// courtGrid.ts and courtGrid.ts never imports from here.
//
// Domain principle (Part "IMPORTANT DOMAIN PRINCIPLE"): a grid CELL
// describes WHERE. A tactical POSITION describes WHAT ROLE a coach
// means in a specific tactical CONTEXT (attack, or one named defence
// formation). The same cell number can legally carry a different
// tactical meaning in a different context -- e.g. cell 165 is V3 in
// 6:0 but CH in 5:1/3:2:1, and MB in 3:3. Nothing here attaches one
// permanent tactical meaning to a cell; every lookup is always
// (context, position) or (context, cell), never position/cell alone.
import { COURT_GRID_DEFINITION } from "./courtGrid";

export interface PositionCalibration {
  /** Stable id for this tactical position within its context (e.g. "V9", "CH", "M6_LEFT"). */
  id: string;
  /** Swedish display label, as supplied. */
  label: string;
  /**
   * Every canonical grid cell (1..200) accepted as a valid snap
   * location for this tactical position, in this context. Part D:
   * multi-cell positions preserve every supplied cell -- never
   * collapsed to an average or an arbitrarily chosen single cell.
   */
  acceptedCells: readonly number[];
  /**
   * HM-COURT-GRID-0.3 Part N: the ONE cell an old MatchPlan (saved
   * before cellNumber existed, or any slot otherwise missing one)
   * deterministically migrates to for this position -- always one of
   * `acceptedCells`, never invented. Defaults to `acceptedCells[0]`
   * when not explicitly set.
   */
  preferredCell?: number;
}

export type AttackPositionCalibration = PositionCalibration;

export type DefenceFormationId = "6-0" | "5-1" | "3-2-1" | "3-3" | "4-2";

export interface DefenceFormationCalibration {
  formation: DefenceFormationId;
  /** Swedish display label for the formation itself, as supplied. */
  label: string;
  positions: readonly PositionCalibration[];
}

/** Either the single attack context, or one named defence formation -- the "tactical context" every lookup in this module is scoped by. */
export type CalibrationContext = "ATTACK" | DefenceFormationId;

// -- Part B (HM-COURT-GRID-0.2) + Part B (HM-COURT-GRID-0.3 refinement,
// approved and folded in directly) -- ATTACK, TOP SIDE (rows 1-7 area,
// per courtGrid.ts's own "row 1 = top goal" convention -- consistent
// with this milestone's "attack at top, defence at bottom" orientation,
// no remapping done).
//
// LEFT_M9 / M9 / RIGHT_M9 are DISTINCT tactical positions -- never
// collapsed into one generic "M9" role (0.3 Part B/J/I). All three
// still report the SAME engine-facing Position ("M9", see
// ATTACK_TACTICAL_TO_ENGINE_POSITION below) so Match Engine inputs keep
// their exact prior meaning (0.3 Part V/T#27) -- only the finer-grained
// on-board CELL distinguishes them, enabling custom shapes like
// 3x9M+1xM6, 2x9M+2xM6, 4x9M or no-M6 structures (0.3 Part I) without
// any new Match Engine vocabulary.
export const ATTACK_POSITION_CALIBRATION: readonly AttackPositionCalibration[] = Object.freeze([
  { id: "V6", label: "Vänstersexa", acceptedCells: [1] },
  { id: "H6", label: "Högersexa", acceptedCells: [10] },
  { id: "V9", label: "Vänsternia", acceptedCells: [41, 51, 52], preferredCell: 51 },
  { id: "H9", label: "Högernia", acceptedCells: [50, 59, 60], preferredCell: 60 },
  { id: "M6_LEFT", label: "M6 vänster", acceptedCells: [34] },
  { id: "M6_RIGHT", label: "M6 höger", acceptedCells: [37] },
  { id: "LEFT_M9", label: "Vänster M9", acceptedCells: [64] },
  { id: "M9", label: "M9 / Mittnia", acceptedCells: [65, 66], preferredCell: 65 },
  { id: "RIGHT_M9", label: "Höger M9", acceptedCells: [67] },
]);

/**
 * HM-COURT-GRID-0.3 Part D/E/J: the engine-facing `Position` each
 * attack tactical position resolves to -- the ONLY thing Match Engine
 * ever reads. LEFT_M9/M9/RIGHT_M9 all resolve to "M9"; M6_LEFT/
 * M6_RIGHT both resolve to "M6" -- Match Engine inputs keep their exact
 * prior meaning (Part T#27), only the board's own cell identity is new.
 */
export const ATTACK_TACTICAL_TO_ENGINE_POSITION: Readonly<Record<string, "GK" | "V6" | "V9" | "M9" | "H9" | "H6" | "M6">> = Object.freeze({
  V6: "V6",
  H6: "H6",
  V9: "V9",
  H9: "H9",
  M6_LEFT: "M6",
  M6_RIGHT: "M6",
  LEFT_M9: "M9",
  M9: "M9",
  RIGHT_M9: "M9",
});

// -- Part B: DEFENCE -- BOTTOM SIDE, one calibration per named
// formation. Encoded exactly as supplied; CH/Center labels kept as
// given (Part B: "Do not rename the tactical concept unless a current
// project convention already has a clearly approved human-facing
// equivalent" -- none was supplied here, so the given labels stand).
export const DEFENCE_FORMATION_CALIBRATIONS: Readonly<Record<DefenceFormationId, DefenceFormationCalibration>> = Object.freeze({
  "6-0": {
    formation: "6-0",
    label: "6:0",
    positions: Object.freeze([
      { id: "V1", label: "V1", acceptedCells: [181] },
      { id: "H1", label: "H1", acceptedCells: [190] },
      { id: "V2", label: "V2", acceptedCells: [163] },
      { id: "H2", label: "H2", acceptedCells: [168] },
      { id: "V3", label: "V3", acceptedCells: [165] },
      { id: "H3", label: "H3", acceptedCells: [166] },
    ]),
  },
  "5-1": {
    formation: "5-1",
    label: "5:1",
    positions: Object.freeze([
      { id: "V1", label: "V1", acceptedCells: [181] },
      { id: "H1", label: "H1", acceptedCells: [190] },
      { id: "V2", label: "V2", acceptedCells: [163] },
      { id: "H2", label: "H2", acceptedCells: [168] },
      { id: "CH", label: "CH", acceptedCells: [165, 166] },
      { id: "CENTER", label: "Center", acceptedCells: [145, 146] },
    ]),
  },
  "3-2-1": {
    formation: "3-2-1",
    label: "3:2:1",
    positions: Object.freeze([
      { id: "VB", label: "VB", acceptedCells: [181] },
      { id: "HB", label: "HB", acceptedCells: [190] },
      { id: "VHB", label: "VHB", acceptedCells: [153] },
      { id: "HHB", label: "HHB", acceptedCells: [158] },
      { id: "CH", label: "CH", acceptedCells: [165, 166] },
      { id: "CENTER", label: "Center", acceptedCells: [145, 146] },
    ]),
  },
  "3-3": {
    formation: "3-3",
    label: "3:3",
    positions: Object.freeze([
      { id: "VB", label: "VB", acceptedCells: [172] },
      { id: "HB", label: "HB", acceptedCells: [179] },
      { id: "MB", label: "MB", acceptedCells: [165, 166] },
      { id: "VF", label: "VF", acceptedCells: [152] },
      { id: "HF", label: "HF", acceptedCells: [159] },
      { id: "MITTEN_FRAM", label: "Mitten fram", acceptedCells: [145, 146] },
    ]),
  },
  "4-2": {
    formation: "4-2",
    label: "4:2",
    positions: Object.freeze([
      { id: "V1", label: "V1", acceptedCells: [172] },
      { id: "H1", label: "H1", acceptedCells: [179] },
      { id: "V2", label: "V2", acceptedCells: [163] },
      { id: "H2", label: "H2", acceptedCells: [168] },
      { id: "VF", label: "VF", acceptedCells: [144] },
      { id: "HF", label: "HF", acceptedCells: [147] },
    ]),
  },
});

export const DEFENCE_FORMATION_IDS: readonly DefenceFormationId[] = Object.freeze(["6-0", "5-1", "3-2-1", "3-3", "4-2"]);

// -- Part K: pure helpers, no React dependency --

export function getAttackPositionCalibration(): readonly AttackPositionCalibration[] {
  return ATTACK_POSITION_CALIBRATION;
}

export function getDefenceFormationCalibration(formation: DefenceFormationId): DefenceFormationCalibration {
  return DEFENCE_FORMATION_CALIBRATIONS[formation];
}

function positionsForContext(context: CalibrationContext): readonly PositionCalibration[] {
  return context === "ATTACK" ? ATTACK_POSITION_CALIBRATION : DEFENCE_FORMATION_CALIBRATIONS[context].positions;
}

/** Every calibrated position that accepts the given cell, in the given context. Usually zero or one entry -- multi-cell positions are the only case where a cell maps to more than one position within the same context, and that never happens here (no cell is shared by two positions in the same context). */
export function getPositionsForCell(context: CalibrationContext, cell: number): readonly PositionCalibration[] {
  return positionsForContext(context).filter((p) => p.acceptedCells.includes(cell));
}

export function getAcceptedCellsForPosition(context: CalibrationContext, positionId: string): readonly number[] {
  const position = positionsForContext(context).find((p) => p.id === positionId);
  return position ? position.acceptedCells : [];
}

export function isCellValidForPosition(context: CalibrationContext, positionId: string, cell: number): boolean {
  return getAcceptedCellsForPosition(context, positionId).includes(cell);
}

/** Every cell number referenced anywhere in the calibration, deduplicated -- used to prove every referenced cell is a real canonical cell (Part M item 38). */
export function allCalibratedCells(): readonly number[] {
  const cells = new Set<number>();
  for (const p of ATTACK_POSITION_CALIBRATION) for (const c of p.acceptedCells) cells.add(c);
  for (const formation of DEFENCE_FORMATION_IDS) {
    for (const p of DEFENCE_FORMATION_CALIBRATIONS[formation].positions) {
      for (const c of p.acceptedCells) cells.add(c);
    }
  }
  return Object.freeze([...cells]);
}

export function isValidCanonicalCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 1 && cell <= COURT_GRID_DEFINITION.rows * COURT_GRID_DEFINITION.columns;
}

/** The single deterministic default cell for a position (Part N migration target) -- `preferredCell` if set, else the first accepted cell. Always one of `acceptedCells`. */
export function preferredCellForPosition(context: CalibrationContext, positionId: string): number | null {
  const position = positionsForContext(context).find((p) => p.id === positionId);
  if (!position) return null;
  return position.preferredCell ?? position.acceptedCells[0] ?? null;
}

/** ATTACK-only convenience: the single tactical position calibrated to accept this cell, or null if the cell isn't part of the attack calibration. Safe because attack positions never share a cell (asserted by tests). */
export function attackTacticalPositionForCell(cell: number): AttackPositionCalibration | null {
  return getPositionsForCell("ATTACK", cell)[0] ?? null;
}

/**
 * HM-COURT-GRID-0.3 Part K/L: `DefenceUnitSlot.courtSlot` (1-6) stays
 * the engine-facing, formation-agnostic identity it always was (see
 * matchPlan/types.ts's own doc) -- this derives a STABLE courtSlot
 * number for each of a formation's 6 calibrated positions by sorting
 * them left-to-right (ascending column, using each position's
 * preferred cell), so courtSlot assignment is deterministic and never
 * hand-maintained per formation. For 6:0 this reproduces the existing
 * DEFENCE_COURT_SLOT_LABELS_SV numbering exactly (V1=1, V2=2, V3=3,
 * H3=4, H2=5, H1=6) by construction, since that numbering was itself
 * already a left-to-right convention.
 */
function courtSlotOrderedPositions(formation: DefenceFormationId): readonly PositionCalibration[] {
  const positions = DEFENCE_FORMATION_CALIBRATIONS[formation].positions;
  return [...positions].sort((a, b) => {
    const cellA = a.preferredCell ?? a.acceptedCells[0] ?? 0;
    const cellB = b.preferredCell ?? b.acceptedCells[0] ?? 0;
    const colA = ((cellA - 1) % COURT_GRID_DEFINITION.columns) + 1;
    const colB = ((cellB - 1) % COURT_GRID_DEFINITION.columns) + 1;
    return colA - colB;
  });
}

export function defenceCourtSlotForPosition(formation: DefenceFormationId, positionId: string): number | null {
  const ordered = courtSlotOrderedPositions(formation);
  const index = ordered.findIndex((p) => p.id === positionId);
  return index === -1 ? null : index + 1;
}

export function defencePositionForCourtSlot(formation: DefenceFormationId, courtSlot: number): PositionCalibration | null {
  return courtSlotOrderedPositions(formation)[courtSlot - 1] ?? null;
}

/** DEFENCE-only convenience: the calibrated position accepting this cell within a formation, or null. */
export function defenceTacticalPositionForCell(formation: DefenceFormationId, cell: number): PositionCalibration | null {
  return getPositionsForCell(formation, cell)[0] ?? null;
}
