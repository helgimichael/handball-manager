// HM-TACTICS-1.2 Part 3/4: UI-ONLY percentage positions for the
// clickable player chips overlaid on the court backdrop. Deliberately
// NOT FIELD's own meter-based BoardObject coordinates -- these are a
// simple, self-contained layout scoped to this workspace only, so no
// FIELD-package coordinate math or court-engine changes were needed to
// make the starting units clickable (Part 3: "no FIELD migration, no
// big court-engine refactor"). Approximate handball shapes, not a
// tactical simulator (Part 4 explicitly allows this).
import type { DefenceFormationOption } from "./courtScene";

export interface CourtLayoutSlot {
  key: string;
  xPct: number;
  yPct: number;
}

// HM-MATCH-1.2 Part E: HALF_COURT's own 20x20m bounds (courtScene.ts) --
// converts FIELD's raw meter coordinates (FormationLibrary.ts) into this
// layer's percentage space, using the SAME goal-near-bottom convention
// this workspace already established (attack building upward toward a
// goal drawn at the bottom of the panel) so the chip overlay's relative
// geometry stays consistent with itself across every formation, even
// though it is not pixel-locked to MasterCourt's own internal camera.
const HALF_COURT_METERS = 20;
function metersToPct(x: number, y: number): { xPct: number; yPct: number } {
  return { xPct: (x / HALF_COURT_METERS) * 100, yPct: 100 - (y / HALF_COURT_METERS) * 100 };
}

/**
 * The primary, always-visible attack starting unit (Part 2: normal
 * attack is the default view, no formation toggle here). HM-MATCH-1.2
 * Part E: derived from FIELD's own real "attack-6"/"defence-6-0"
 * formation coordinates (courtScene.ts's data source) rather than
 * hand-guessed percentages -- V6/H6 sit on the goal line at the wings,
 * V9/H9 out at the 9m backs, M9 at the apex of the 9m arc, M6 just
 * inside it as the pivot, matching real handball shape.
 *
 * HM-MATCH-1.3B2 Part 4 (orientation correction): FIELD's raw
 * "attack-6" meter coordinates put V6/V9 on the geometrically LEFT
 * side and H6/H9 on the RIGHT -- backwards from the accepted
 * coach-facing handball convention (confirmed visually in-browser),
 * where "vänster"/"höger" are named from the attacking PLAYER's own
 * perspective facing the opponent's goal (i.e. facing the same "up"
 * direction the board itself is drawn in), which mirrors left/right
 * relative to the coach/viewer looking at the board. The fix swaps
 * which raw meter coordinate each V/H label renders at (V6<->H6,
 * V9<->H9) -- a presentation-only remap; the underlying FIELD formation
 * data and every domain Position identifier are untouched.
 */
export const ATTACK_NORMAL_LAYOUT: readonly CourtLayoutSlot[] = [
  { key: "GK", ...metersToPct(9.888641, 0.517817) },
  { key: "V6", ...metersToPct(19.398663, 0.540089) },
  { key: "V9", ...metersToPct(19.220488, 8.379733) },
  { key: "M9", ...metersToPct(9.08686, 11.854121) },
  { key: "H9", ...metersToPct(0.935412, 9.292875) },
  { key: "H6", ...metersToPct(0.601336, 0.562361) },
  { key: "M6", ...metersToPct(10.801781, 6.687082) },
];

const ATTACK_LAYOUT_BY_POSITION = new Map(ATTACK_NORMAL_LAYOUT.map((s) => [s.key, s]));

/**
 * HM-MATCH-1.2 Part I: a 7v6 lineup's structure (DOUBLE_PIVOT/
 * EXTRA_BACKCOURT, see matchPlan/types.ts) fixes each slot to a REAL
 * position, so this reuses ATTACK_NORMAL_LAYOUT's own coordinates for
 * each slot -- "the same board logic as normal attack" -- rather than a
 * generic arc. A structure's one duplicated position (two M6, or two
 * M9) gets a small symmetric offset so both chips stay visible instead
 * of rendering on top of each other.
 */
export function sevenVSixAttackLayout(positions: readonly string[]): CourtLayoutSlot[] {
  const seen = new Map<string, number>();
  return positions.map((position, i) => {
    const base = ATTACK_LAYOUT_BY_POSITION.get(position) ?? { xPct: 50, yPct: 50 };
    const occurrence = seen.get(position) ?? 0;
    seen.set(position, occurrence + 1);
    const offset = occurrence * 12; // nudges the SECOND occurrence of a duplicated position sideways so both chips stay readable
    return { key: String(i), xPct: Math.min(96, Math.max(4, base.xPct + offset)), yPct: base.yPct };
  });
}

// HM-MATCH-1.3B2 Part 4: mirrored for the same orientation correction as
// ATTACK_NORMAL_LAYOUT above -- courtSlot 1 (V1, "vänster") now renders
// on the same side V6/V9 do, courtSlot 6 (H1, "höger") on the same side
// H6/H9 do, so the whole board uses one consistent left/right
// convention (Part 4: "ensure the entire project uses one consistent
// coach-facing handball perspective"). Only the X positions are
// mirrored -- courtSlot NUMBER -> role LABEL (matchPlanLabels.ts's
// DEFENCE_COURT_SLOT_LABELS_SV) and depth-per-formation are untouched.
const DEFENCE_SLOT_X: Record<number, number> = { 1: 92, 2: 76, 3: 60, 4: 40, 5: 24, 6: 8 };

/** One depth (0-100, higher = deeper/closer to own goal) per courtSlot 1-6, per named base formation -- a simplified, decorative visual difference between formations (Part 4: "does not need to be an advanced tactics simulator"), not tactically authoritative. */
const DEFENCE_FORMATION_DEPTH: Record<DefenceFormationOption, Record<number, number>> = {
  "6-0": { 1: 55, 2: 55, 3: 55, 4: 55, 5: 55, 6: 55 },
  "5-1": { 1: 60, 2: 60, 3: 60, 4: 22, 5: 60, 6: 60 },
  "3-2-1": { 1: 68, 2: 68, 3: 68, 4: 44, 5: 44, 6: 20 },
  "3-3": { 1: 65, 2: 38, 3: 65, 4: 38, 5: 65, 6: 38 },
  "4-2": { 1: 60, 2: 28, 3: 60, 4: 60, 5: 28, 6: 60 },
};

export function defenceLayout(baseFormation: string): readonly CourtLayoutSlot[] {
  const depths = DEFENCE_FORMATION_DEPTH[baseFormation as DefenceFormationOption] ?? DEFENCE_FORMATION_DEPTH["6-0"];
  const slots: CourtLayoutSlot[] = [{ key: "GK", xPct: 50, yPct: 92 }];
  for (let courtSlot = 1; courtSlot <= 6; courtSlot++) {
    slots.push({ key: String(courtSlot), xPct: DEFENCE_SLOT_X[courtSlot], yPct: depths[courtSlot] });
  }
  return slots;
}
