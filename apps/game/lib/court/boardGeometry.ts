// HM-COURT-GRID-0.3 Part D: derives the real Tactics board's on-screen
// chip position DIRECTLY from a canonical grid cell -- cellNumber ->
// row/column -> cell center -> rendered percentage. No hard-coded x/y
// percentages (the old attackZones.ts/courtLayout.ts model this
// replaces for the live board).
//
// The attack calibration lives on the court's TOP side (rows ~1-9, y
// 0-18m) and defence on the BOTTOM side (rows ~15-19, y 28-38m) -- see
// tacticalPositionCalibration.ts. Each phase is still rendered as its
// own HALF_COURT (20x20m) board, exactly as the pre-existing Tactics
// workspace already does (courtScene.ts's buildAttackScene/
// buildDefenceScene both use courtView:"HALF_COURT", and FIELD's own
// HALF_COURT viewport is documented to show "the TOP goal" of whichever
// scene it's given -- i.e. each phase's OWN goal is always drawn at the
// top of ITS OWN half-court panel). To match that real MasterCourt
// rendering pixel-for-pixel (Part D: never hard-code independently):
//   - ATTACK: cell meters map straight onto the panel (own goal is at
//     y=0 in the full 40m grid, which is already "top" -- no offset).
//   - DEFENCE: cell meters are measured from the BOTTOM of the full
//     40m grid (the defence goal is at y=40), so `40 - yMeters` puts
//     the defence goal at local y=0 ("top of the defence panel"),
//     matching the same "own goal at top" convention FIELD uses for
//     every HALF_COURT scene.
// This is a deliberate visual change from the OLD chip layer
// (courtLayout.ts's `metersToPct`), which artificially Y-flipped so a
// team's own goal appeared near the BOTTOM of the panel -- a
// pre-existing mismatch with FIELD's actual "goal at top" HALF_COURT
// rendering that this milestone's move to authoritative grid cells
// naturally corrects as a side effect.
import { cellCenter, COURT_GRID_DEFINITION } from "./courtGrid";

export interface BoardPct {
  xPct: number;
  yPct: number;
}

const HALF_COURT_METERS = COURT_GRID_DEFINITION.courtWidthMeters; // 20 -- both axes of a HALF_COURT panel span this many meters

export function attackCellToPct(cellNumber: number): BoardPct {
  const { row, column } = rowColumnOf(cellNumber);
  const center = cellCenter(row, column);
  return { xPct: (center.xMeters / HALF_COURT_METERS) * 100, yPct: (center.yMeters / HALF_COURT_METERS) * 100 };
}

export function defenceCellToPct(cellNumber: number): BoardPct {
  const { row, column } = rowColumnOf(cellNumber);
  const center = cellCenter(row, column);
  const localY = COURT_GRID_DEFINITION.courtLengthMeters - center.yMeters;
  return { xPct: (center.xMeters / HALF_COURT_METERS) * 100, yPct: (localY / HALF_COURT_METERS) * 100 };
}

function rowColumnOf(cellNumber: number): { row: number; column: number } {
  const row = Math.floor((cellNumber - 1) / COURT_GRID_DEFINITION.columns) + 1;
  const column = ((cellNumber - 1) % COURT_GRID_DEFINITION.columns) + 1;
  return { row, column };
}

/**
 * Fixed anchors for the goalkeeper, who is explicitly OUT of calibration
 * scope this milestone (tacticalPositionCalibration.ts Part C: "If
 * goalkeeper later needs calibration, that is a separate user-calibrated
 * addition. Do not guess it now."). Each phase's own goal sits at local
 * y=0 (see module doc), so a GK anchored just in front of it at a small
 * positive y reads correctly on both boards without inventing a
 * calibrated cell.
 */
export const ATTACK_GK_ANCHOR_PCT: BoardPct = { xPct: 50, yPct: 4 };
export const DEFENCE_GK_ANCHOR_PCT: BoardPct = { xPct: 50, yPct: 4 };
