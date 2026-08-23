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

/** The primary, always-visible attack starting unit (Part 2: normal attack is the default view, no formation toggle here). */
export const ATTACK_NORMAL_LAYOUT: readonly CourtLayoutSlot[] = [
  { key: "GK", xPct: 50, yPct: 90 },
  { key: "V6", xPct: 20, yPct: 58 },
  { key: "V9", xPct: 6, yPct: 26 },
  { key: "M9", xPct: 50, yPct: 10 },
  { key: "H9", xPct: 94, yPct: 26 },
  { key: "H6", xPct: 80, yPct: 58 },
  { key: "M6", xPct: 50, yPct: 40 },
];

/** SEVEN_V_SIX has no goalkeeper and no fixed distinct positions (HM-TACTICS-1.0's own domain doc: "do not assume one fixed 7v6 structure") -- an even arc of `count` slots along the attacking line. */
export function sevenVSixAttackLayout(count: number): CourtLayoutSlot[] {
  const layout: CourtLayoutSlot[] = [];
  for (let i = 0; i < count; i++) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    layout.push({ key: String(i), xPct: 6 + t * 88, yPct: 12 + Math.sin(t * Math.PI) * 34 });
  }
  return layout;
}

const DEFENCE_SLOT_X: Record<number, number> = { 1: 8, 2: 24, 3: 40, 4: 60, 5: 76, 6: 92 };

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
