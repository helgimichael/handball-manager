// HM-MATCH-1.3B2 Part 1/2/3: the snap-zone board model. Replaces "one
// fixed slot per canonical position" with "predefined ZONES the manager
// can move players between" -- a zone's coordinate is fixed, but WHICH
// slot (and therefore which player) currently occupies it is a pure,
// deterministic projection of the MatchPlan's own `attackStartingUnit.
// slots` array, recomputed on every render, never separately persisted
// UI state. Moving a player into a different zone changes their
// TACTICAL POSITION for this MatchPlan (via matchPlanEdits.ts's
// assignAttackZonePosition) -- their natural squad position is never
// touched (Part 3/R).
import type { Position } from "@/lib/matchPlan/types";
import { ATTACK_NORMAL_LAYOUT, type CourtLayoutSlot } from "./courtLayout";

/** Eight outcourt zones (Part 2's own example set, position-named rather than LEFT_WING/RIGHT_WING-style since the corrected board orientation -- Part 4 -- would otherwise make a "LEFT_WING" zone confusingly produce the H6 position). Internal names are ours to choose (Part 2). */
export const ATTACK_ZONE_IDS = ["V6", "V9", "M9", "H9", "H6", "PIVOT_LEFT", "PIVOT_CENTRE", "PIVOT_RIGHT"] as const;
export type AttackZoneId = (typeof ATTACK_ZONE_IDS)[number];

/** The tactical Position label a zone produces once a player is moved into it -- e.g. any of the three pivot zones yields "M6" (Part 3: "pivot zone -> M6"). */
export const ATTACK_ZONE_POSITION: Record<AttackZoneId, Position> = {
  V6: "V6",
  V9: "V9",
  M9: "M9",
  H9: "H9",
  H6: "H6",
  PIVOT_LEFT: "M6",
  PIVOT_CENTRE: "M6",
  PIVOT_RIGHT: "M6",
};

const BY_KEY = new Map(ATTACK_NORMAL_LAYOUT.map((s) => [s.key, s]));
const PIVOT_BASE = BY_KEY.get("M6")!;
const PIVOT_OFFSET_PCT = 15;

function clampPct(v: number): number {
  return Math.min(96, Math.max(4, v));
}

export const ATTACK_ZONE_LAYOUT: Record<AttackZoneId, CourtLayoutSlot> = {
  V6: { key: "V6", xPct: BY_KEY.get("V6")!.xPct, yPct: BY_KEY.get("V6")!.yPct },
  V9: { key: "V9", xPct: BY_KEY.get("V9")!.xPct, yPct: BY_KEY.get("V9")!.yPct },
  M9: { key: "M9", xPct: BY_KEY.get("M9")!.xPct, yPct: BY_KEY.get("M9")!.yPct },
  H9: { key: "H9", xPct: BY_KEY.get("H9")!.xPct, yPct: BY_KEY.get("H9")!.yPct },
  H6: { key: "H6", xPct: BY_KEY.get("H6")!.xPct, yPct: BY_KEY.get("H6")!.yPct },
  PIVOT_CENTRE: { key: "PIVOT_CENTRE", xPct: PIVOT_BASE.xPct, yPct: PIVOT_BASE.yPct },
  PIVOT_LEFT: { key: "PIVOT_LEFT", xPct: clampPct(PIVOT_BASE.xPct + PIVOT_OFFSET_PCT), yPct: PIVOT_BASE.yPct },
  PIVOT_RIGHT: { key: "PIVOT_RIGHT", xPct: clampPct(PIVOT_BASE.xPct - PIVOT_OFFSET_PCT), yPct: PIVOT_BASE.yPct },
};

/**
 * Deterministically projects `attackStartingUnit.slots` (array order,
 * never separate UI state) onto the 8 zones: a slot's OWN home zone if
 * available, otherwise (for a non-standard shape, e.g. a second M6) the
 * next zone that shares its position, in array order. Pure/stateless --
 * the same slots array always projects onto the same zones. Returns the
 * SLOT INDEX occupying each zone, or `null` for a zone nothing
 * currently projects onto (Part 1's "move into an empty snap zone").
 */
export function projectSlotsOntoZones(slots: readonly { playerId: string; position: Position }[]): Record<AttackZoneId, number | null> {
  const result: Record<AttackZoneId, number | null> = {
    V6: null,
    V9: null,
    M9: null,
    H9: null,
    H6: null,
    PIVOT_LEFT: null,
    PIVOT_CENTRE: null,
    PIVOT_RIGHT: null,
  };
  const pivotOrder: AttackZoneId[] = ["PIVOT_CENTRE", "PIVOT_LEFT", "PIVOT_RIGHT"];
  let pivotCursor = 0;

  slots.forEach((slot, index) => {
    if (slot.position === "GK") return;
    if (slot.position === "M6") {
      const zone = pivotOrder[pivotCursor] ?? pivotOrder[pivotOrder.length - 1];
      result[zone] = index;
      pivotCursor += 1;
      return;
    }
    const homeZone = ATTACK_ZONE_IDS.find((z) => z === slot.position);
    if (homeZone && result[homeZone] === null) {
      result[homeZone] = index;
      return;
    }
    // Defensive fallback for a shape this projection didn't anticipate
    // (e.g. more than 3 backcourt duplicates) -- park it in any zone
    // still free rather than silently dropping the slot from display.
    const free = ATTACK_ZONE_IDS.find((z) => result[z] === null);
    if (free) result[free] = index;
  });

  return result;
}
