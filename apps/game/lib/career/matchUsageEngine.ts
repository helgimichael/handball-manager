// HM-MATCH-1.0 Part G/H/I/J/L/M/N: converts a MatchUsagePlan into
// temporal, per-window player exposure -- the runtime layer that
// actually "executes" the coach's plan across match time, without
// simulating individual possessions or substitution animations.
//
//   MatchUsagePlan
//         -> per-window active phase unit (ATTACK/DEFENCE, capped to a
//            realistic on-court size: 6, or 7 for a 7v6 attack unit)
//         -> per-player windows-active tally
//         -> normalized [0,1] exposure per phase (+ goalkeeper)
//
// Deliberately coarse (Part I): six internal 10-minute windows, never a
// possession-level simulator and never redesigned UI around. A
// player's own active window RANGE (see activeWindowRange) is a pure
// function of (starting?, usage weight) -- no rng needed for the
// exposure NUMBER itself; the only place determinism needs an explicit
// seed is breaking ties when ranking equal-priority players within one
// window's capped on-court set (Part H), which reuses game-simulation's
// own seedFromString rather than inventing a second hashing scheme
// (Part A).
import { seedFromString } from "@handball-manager/game-simulation";
import type { MatchPlan } from "../matchPlan/types";
import { buildMatchUsagePlan, type MatchUsagePlan, type PlayerUsagePlan, type SpecialistPairSide } from "./matchUsagePlan";

export type MatchUsagePhase = "ATTACK" | "DEFENCE";

/** Part I: six coarse internal calculation windows across a 60-minute match. Internal only. */
export const MATCH_USAGE_WINDOW_COUNT = 6;

function clampWindowCount(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Part C/H: a STARTING player's active window range begins at window 0
 * and runs for a length proportional to their usage weight -- high
 * usage (e.g. KEY_PLAYER + VERY_HIGH) stays on essentially the whole
 * match; lower usage (STARTER + NORMAL) is rotated out in the later
 * windows. A BENCH player's range ends at the final window and starts
 * later, proportional to usage weight -- higher usage (MAJOR_ROTATION +
 * HIGH) comes on earlier and gets real minutes; near-zero usage
 * (EMERGENCY_ONLY) rounds to an empty range, so they never enter
 * (Part O/Part S #8). A pure function of (isStarting, usageWeight);
 * ties in RANKING (not in this range) are resolved by a seeded hash,
 * see resolveActivePhaseUnit.
 */
function activeWindowRange(usageWeight: number, isStarting: boolean): { start: number; end: number } {
  const activeCount = clampWindowCount(usageWeight * MATCH_USAGE_WINDOW_COUNT, isStarting ? 1 : 0, MATCH_USAGE_WINDOW_COUNT);
  if (activeCount <= 0) return { start: MATCH_USAGE_WINDOW_COUNT, end: MATCH_USAGE_WINDOW_COUNT };
  if (isStarting) return { start: 0, end: activeCount };
  return { start: MATCH_USAGE_WINDOW_COUNT - activeCount, end: MATCH_USAGE_WINDOW_COUNT };
}

function windowsActiveCount(range: { start: number; end: number }): number {
  return Math.max(0, range.end - range.start);
}

function isActiveInWindow(range: { start: number; end: number }, window: number): boolean {
  return window >= range.start && window < range.end;
}

/** A cheap, deterministic tiebreak for equal-priority players within one window -- reuses game-simulation's own seedFromString (Part A: no second hashing/PRNG scheme). */
function tiebreak(seed: string, playerId: string): number {
  return seedFromString(`${seed}:${playerId}`);
}

/**
 * Part G: the players intended to be on court for `phase` during
 * `window`, ranked by rotation priority (seeded tiebreak for ties) and
 * capped at `slotCount` -- the realistic on-court size (6 outfield
 * players for NORMAL attack/defence, 7 for a SEVEN_V_SIX attack unit;
 * see computeTeamUsageTrace for how slotCount is chosen). Goalkeepers
 * are never included here -- see computeGoalkeeperWindowCounts.
 */
export function resolveActivePhaseUnit(usagePlan: MatchUsagePlan, phase: MatchUsagePhase, window: number, slotCount: number, seed: string): readonly string[] {
  const eligible = usagePlan.players.filter((p) => {
    if (p.isGoalkeeper) return false;
    const weight = phase === "ATTACK" ? p.attackUsageWeight : p.defenceUsageWeight;
    if (weight <= 0) return false;
    const isStarting = phase === "ATTACK" ? p.startingInAttack : p.startingInDefence;
    return isActiveInWindow(activeWindowRange(weight, isStarting), window);
  });

  return eligible
    .slice()
    .sort((a, b) => (a.rotationPriority !== b.rotationPriority ? a.rotationPriority - b.rotationPriority : tiebreak(seed, a.playerId) - tiebreak(seed, b.playerId)))
    .slice(0, slotCount)
    .map((p) => p.playerId);
}

/**
 * Part L: the starting (defence-unit) goalkeeper NORMALLY dominates --
 * a structural guarantee, not merely a coincidence of relative usage
 * numbers: a backup's own windows still come from their own usage
 * weight (the exact same bench formula as outfield rotation), but are
 * capped so backups collectively can never claim more than
 * `1 - PRIMARY_GK_MIN_SHARE` of the match, regardless of how their own
 * MatchRole/PlayingTimeIntention happens to compare to the primary's.
 * Without this floor, a backup who (inconsistently) still carries a
 * high default MatchRole/PlayingTimeIntention from before being
 * demoted could out-claim the actual starter, which would contradict
 * Part L's own "should normally dominate" requirement. No save-
 * percentage-driven substitution logic (Part L: "that belongs to Live
 * Coaching later") -- purely PlayingTimeIntention/MatchRole/depth-
 * hierarchy driven, same as every other rotation weight in this module.
 */
const PRIMARY_GK_MIN_SHARE = 0.6;

function computeGoalkeeperWindowCounts(usagePlan: MatchUsagePlan): Map<string, number> {
  const counts = new Map<string, number>();
  const goalkeepers = usagePlan.players.filter((p) => p.isGoalkeeper);
  const primary = goalkeepers.find((p) => p.startingInDefence) ?? goalkeepers[0];
  if (!primary) return counts;

  const backups = goalkeepers.filter((p) => p.playerId !== primary.playerId);
  const maxBackupWindowsTotal = Math.floor(MATCH_USAGE_WINDOW_COUNT * (1 - PRIMARY_GK_MIN_SHARE));
  let backupWindowsUsed = 0;
  for (const backup of backups) {
    const requested = windowsActiveCount(activeWindowRange(backup.goalkeeperUsageWeight, false));
    const granted = Math.max(0, Math.min(requested, maxBackupWindowsTotal - backupWindowsUsed));
    counts.set(backup.playerId, granted);
    backupWindowsUsed += granted;
  }
  counts.set(primary.playerId, MATCH_USAGE_WINDOW_COUNT - backupWindowsUsed);
  return counts;
}

export interface PlayerUsageTrace {
  playerId: string;
  /** 0-1, normalized: fraction of match windows this player is intended to be on court in ATTACK. */
  attackExposure: number;
  /** 0-1, normalized: fraction of match windows this player is intended to be on court in DEFENCE (outfield). 0 for goalkeepers -- see goalkeeperExposure. */
  defenceExposure: number;
  /** 0-1, normalized: fraction of match windows this player is intended to be the active goalkeeper. 0 for outcourt players. */
  goalkeeperExposure: number;
  startedAttack: boolean;
  startedDefence: boolean;
  attackWindowsActive: number;
  defenceWindowsActive: number;
  goalkeeperWindowsActive: number;
  matchRole: PlayerUsagePlan["matchRole"];
  playingTimeIntention: PlayerUsagePlan["playingTimeIntention"];
  phaseUsage: PlayerUsagePlan["phaseUsage"];
  specialistPair: { partnerId: string; side: SpecialistPairSide } | null;
}

export interface TeamUsageTrace {
  fixtureId: string;
  clubId: string;
  players: readonly PlayerUsageTrace[];
  /** Part N: diagnostic-only counters (no gameplay effect this milestone) -- how many times the active ATTACK/DEFENCE unit's membership actually changed window-to-window, and how many specialist pairs are in play. */
  phaseSubstitutionCount: number;
  specialistPairCount: number;
}

function symmetricDifferenceSize(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let count = 0;
  for (const x of a) if (!b.has(x)) count += 1;
  for (const x of b) if (!a.has(x)) count += 1;
  return count;
}

/**
 * Part J: the full per-player usage trace for one team -- the actual
 * input HM-MATCH-RATINGS-0.1's strength adapter now consumes, instead
 * of re-deriving MatchRole/PlayingTimeIntention/PhaseUsage weights
 * itself a second time (avoiding the double-count Part J warns about).
 * Deterministic and pure: the exact same (MatchPlan, seed) always
 * produces the exact same trace (Part S #13).
 */
export function computeTeamUsageTrace(plan: MatchPlan, seed: string): TeamUsageTrace {
  const usagePlan = buildMatchUsagePlan(plan);
  const attackSlotCount = plan.attackStartingUnit.formation === "SEVEN_V_SIX" ? 7 : 6;
  const defenceSlotCount = 6;

  // Part G's capped, ranked resolveActivePhaseUnit answers "who is
  // literally on court this window" (a realistic, bounded 6/7-player
  // unit) -- but tallying exposure FROM that capped set creates a
  // ranking-competition artifact whenever several starters share
  // identical usage weight (the common case for a freshly-built
  // default plan): they all vacate the SAME window simultaneously,
  // since none individually outranks another, which hides any real
  // differentiation between bench players' own usage weights (Part S
  // #8's VERY_HIGH-vs-LOW comparison would otherwise read identical).
  // Exposure is therefore computed directly from each player's OWN
  // activeWindowRange (independent, uncapped, [0,1]-normalized -- Part
  // J: "exposure should be normalized/bounded", not "must sum to a
  // fixed on-court count"), while resolveActivePhaseUnit remains the
  // separate, capped answer to Part G's literal on-court-unit question
  // and still drives the diagnostic phaseSubstitutionCount below.
  let phaseSubstitutionCount = 0;
  let prevAttackSet: Set<string> | null = null;
  let prevDefenceSet: Set<string> | null = null;
  for (let window = 0; window < MATCH_USAGE_WINDOW_COUNT; window += 1) {
    const attackSet = new Set(resolveActivePhaseUnit(usagePlan, "ATTACK", window, attackSlotCount, seed));
    const defenceSet = new Set(resolveActivePhaseUnit(usagePlan, "DEFENCE", window, defenceSlotCount, seed));
    if (prevAttackSet) phaseSubstitutionCount += symmetricDifferenceSize(prevAttackSet, attackSet);
    if (prevDefenceSet) phaseSubstitutionCount += symmetricDifferenceSize(prevDefenceSet, defenceSet);
    prevAttackSet = attackSet;
    prevDefenceSet = defenceSet;
  }

  const gkWindowCounts = computeGoalkeeperWindowCounts(usagePlan);

  const players: PlayerUsageTrace[] = usagePlan.players.map((p) => {
    const attackWindows = p.isGoalkeeper ? 0 : windowsActiveCount(activeWindowRange(p.attackUsageWeight, p.startingInAttack));
    const defenceWindows = p.isGoalkeeper ? 0 : windowsActiveCount(activeWindowRange(p.defenceUsageWeight, p.startingInDefence));
    const goalkeeperWindows = gkWindowCounts.get(p.playerId) ?? 0;
    return {
      playerId: p.playerId,
      attackExposure: attackWindows / MATCH_USAGE_WINDOW_COUNT,
      defenceExposure: defenceWindows / MATCH_USAGE_WINDOW_COUNT,
      goalkeeperExposure: goalkeeperWindows / MATCH_USAGE_WINDOW_COUNT,
      startedAttack: p.startingInAttack,
      startedDefence: p.startingInDefence,
      attackWindowsActive: attackWindows,
      defenceWindowsActive: defenceWindows,
      goalkeeperWindowsActive: goalkeeperWindows,
      matchRole: p.matchRole,
      playingTimeIntention: p.playingTimeIntention,
      phaseUsage: p.phaseUsage,
      specialistPair: p.specialistPair,
    };
  });

  return {
    fixtureId: plan.fixtureId,
    clubId: plan.clubId,
    players,
    phaseSubstitutionCount,
    specialistPairCount: plan.substitutionPairs.length,
  };
}
