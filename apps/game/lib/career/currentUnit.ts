// HM-MATCH-1.3B Part N/O/P: "who is actually on court right now" --
// reuses MatchUsageEngine's own `resolveMatchUsageTimeline` as the sole
// source of WHO is active (never a second lineup algorithm); this
// module only adds the thin, deterministic layer MatchUsageEngine has
// no concept of at all: WHICH TACTICAL SLOT (V6/V9/M9/H9/H6/M6, or
// defence courtSlot 1-6) each currently-active player is shown in, for
// display.
//
// Slot assignment rule (pure, deterministic): a slot's ORIGINAL starter
// keeps that slot for as long as they remain active; once they rotate
// out, the slot is filled by a still-active player not yet claiming a
// slot, preferring one whose OWN natural squad position matches that
// slot's label, falling back to the next remaining active player in a
// stable order. This never invents WHO is on court -- it only labels
// the already-decided active set.
import { resolveMatchUsageTimeline, MATCH_USAGE_WINDOW_COUNT } from "./matchUsageEngine";
import type { MatchPlan, MatchSquadPlayer, Position } from "../matchPlan/types";

const MATCH_DURATION_MINUTES = 60;

/** Part N: maps a live simulated clock minute onto one of MatchUsageEngine's six coarse windows -- the one piece of glue MatchUsageEngine itself doesn't need (it only ever works in window space), reused nowhere else. */
export function minuteToUsageWindow(clockMinute: number): number {
  const minutesPerWindow = MATCH_DURATION_MINUTES / MATCH_USAGE_WINDOW_COUNT;
  return Math.max(0, Math.min(MATCH_USAGE_WINDOW_COUNT - 1, Math.floor(clockMinute / minutesPerWindow)));
}

interface KeyedSlot<K> {
  playerId: string;
  key: K;
}

/**
 * Fills each ORIGINAL slot instance (by array position, not by
 * deduplicated key -- a 7v6 lineup legitimately has two slots sharing
 * the same M6 key) with whichever currently-active player best fits,
 * preferring the original occupant if still active.
 */
function projectActiveUnitOntoSlots<K>(startingSlots: readonly KeyedSlot<K>[], activePlayerIds: readonly string[], naturalKeyOf: (playerId: string) => K | undefined): KeyedSlot<K>[] {
  const activeSet = new Set(activePlayerIds);
  const claimed = new Set<string>();
  const bySlotIndex: (KeyedSlot<K> | null)[] = startingSlots.map((slot) => {
    if (!activeSet.has(slot.playerId)) return null;
    claimed.add(slot.playerId);
    return slot;
  });

  const remaining = activePlayerIds.filter((id) => !claimed.has(id));
  for (let i = 0; i < bySlotIndex.length; i += 1) {
    if (bySlotIndex[i]) continue;
    const key = startingSlots[i].key;
    const naturalIndex = remaining.findIndex((id) => naturalKeyOf(id) === key);
    const pickIndex = naturalIndex !== -1 ? naturalIndex : 0;
    const playerId = remaining[pickIndex];
    if (playerId === undefined) continue;
    bySlotIndex[i] = { playerId, key };
    remaining.splice(pickIndex, 1);
  }

  return bySlotIndex.filter((s): s is KeyedSlot<K> => s !== null);
}

export interface CurrentAttackUnitSlot {
  playerId: string;
  position: Position;
}

/**
 * HM-MATCH-USAGE-1.4 Part 14/24 #23: `persistedUnitByWindow`, when
 * given (matchdayAction.ts's own MatchPhysicalReport.
 * home/awayAttackUnitByWindow -- the EXACT per-window on-court set the
 * fatigue-aware resolveMatchUsageTimeline resolved for this fixture),
 * is used as a pure LOOKUP instead of a fresh recompute. This is
 * necessary, not cosmetic: a single window's fatigue-aware ranking
 * depends on every player's ACCUMULATED energy from all prior windows,
 * so this only agrees with the Fast Match Engine's own scorer-
 * eligibility gating and the persisted physical report when it reads
 * the SAME resolved timeline those used (real per-player stamina
 * included), rather than recomputing one fresh (neutral-stamina) here.
 * Omit it (e.g. after a live coaching change spliced a different plan
 * onto future windows, where no matching persisted timeline exists) to
 * fall back to a fresh resolveMatchUsageTimeline call against the
 * CURRENT plan -- an accepted, documented simplification for the live-
 * coaching path only (Part 20: reuse existing mechanisms, do not build
 * a second, ratings-threaded iterative resolver for mid-match splices).
 */
export function resolveCurrentAttackUnit(plan: MatchPlan, clockMinute: number, seed: string, persistedUnitByWindow?: readonly (readonly string[])[]): readonly CurrentAttackUnitSlot[] {
  const window = minuteToUsageWindow(clockMinute);
  const activeIds = persistedUnitByWindow?.[window] ?? resolveMatchUsageTimeline(plan, seed).attackUnitByWindow[window];
  const startingSlots = plan.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => ({ playerId: s.playerId, key: s.position }));
  const naturalPositionOf = (playerId: string) => plan.squad.players.find((p: MatchSquadPlayer) => p.playerId === playerId)?.position;
  return projectActiveUnitOntoSlots(startingSlots, activeIds, naturalPositionOf).map((s) => ({ playerId: s.playerId, position: s.key }));
}

export interface CurrentDefenceUnitSlot {
  playerId: string;
  courtSlot: number;
}

/** Part N/P, HM-MATCH-USAGE-1.4 Part 14/24 #23: the six outfield defenders literally active right now (goalkeeper handled separately -- resolveCurrentGoalkeeper). See resolveCurrentAttackUnit's own doc for `persistedUnitByWindow`. */
export function resolveCurrentDefenceUnit(plan: MatchPlan, clockMinute: number, seed: string, persistedUnitByWindow?: readonly (readonly string[])[]): readonly CurrentDefenceUnitSlot[] {
  const window = minuteToUsageWindow(clockMinute);
  const activeIds = persistedUnitByWindow?.[window] ?? resolveMatchUsageTimeline(plan, seed).defenceUnitByWindow[window];
  const startingSlots = plan.defenceStartingUnit.courtSlots.map((s) => ({ playerId: s.playerId, key: s.courtSlot }));
  // Defence has no natural-position-to-courtSlot mapping (courtSlot is
  // formation-agnostic, per types.ts's own doc) -- a rotated-in
  // defender simply fills the next vacated slot in original order.
  return projectActiveUnitOntoSlots(startingSlots, activeIds, () => undefined).map((s) => ({ playerId: s.playerId, courtSlot: s.key }));
}

/** Part N/P, HM-MATCH-USAGE-1.4 Part 14/24 #23: the single goalkeeper literally active right now. See resolveCurrentAttackUnit's own doc for `persistedGoalkeeperByWindow`. */
export function resolveCurrentGoalkeeper(plan: MatchPlan, clockMinute: number, seed: string, persistedGoalkeeperByWindow?: readonly (string | null)[]): string | null {
  const window = minuteToUsageWindow(clockMinute);
  const persisted = persistedGoalkeeperByWindow?.[window];
  if (persisted !== undefined) return persisted;
  return resolveMatchUsageTimeline(plan, seed).goalkeeperByWindow[window];
}
