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

// -- Part B: ATTACK -- TOP SIDE (rows 1-7, per courtGrid.ts's own
// "row 1 = top goal" convention -- consistent with this milestone's
// "attack at top, defence at bottom" orientation, no remapping done).
export const ATTACK_POSITION_CALIBRATION: readonly AttackPositionCalibration[] = Object.freeze([
  { id: "V6", label: "Vänstersexa", acceptedCells: [1] },
  { id: "H6", label: "Högersexa", acceptedCells: [10] },
  { id: "V9", label: "Vänsternia", acceptedCells: [51] },
  { id: "H9", label: "Högernia", acceptedCells: [60] },
  { id: "M6_LEFT", label: "M6 vänster", acceptedCells: [34] },
  { id: "M6_RIGHT", label: "M6 höger", acceptedCells: [37] },
  { id: "M9", label: "Mittnia", acceptedCells: [65, 66] },
]);

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
