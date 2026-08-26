// HM-MATCH-1.0 Part G/H/I/J/L/M/N, redesigned by HM-MATCH-USAGE-1.4:
// converts a MatchUsagePlan into temporal, per-window player exposure --
// the runtime layer that actually "executes" the coach's plan across
// match time, without simulating individual possessions or substitution
// animations.
//
//   MatchUsagePlan
//         -> per-window active phase unit (ATTACK/DEFENCE, capped to a
//            realistic on-court size: 6, or 7 for a 7v6 attack unit),
//            now resolved WINDOW-BY-WINDOW so each window's ranking can
//            react to each player's own accumulated fatigue from the
//            windows before it (resolveMatchUsageTimeline)
//         -> per-player windows-active tally, derived from the ACTUAL
//            resolved per-window sets (never a separate, divergent
//            "intended fraction" formula -- see this module's own root-
//            cause doc below)
//         -> normalized [0,1] exposure per phase (+ goalkeeper)
//
// Deliberately coarse (Part I): six internal 10-minute windows -- kept
// after HM-MATCH-USAGE-1.4's own audit (Part 13): the actual defect
// was the SELECTION algorithm, not the window count, and finer
// granularity would not have fixed a starter being mechanically
// excluded from a window regardless of their role. Never a
// possession-level simulator and never redesigned UI around.
//
// HM-MATCH-USAGE-1.4 ROOT CAUSE (Part 2's own required audit finding):
// `activeWindowRange`'s old formula capped a STARTING player's own
// eligible-window COUNT directly from their coach-priority weight
// (`usageWeight * MATCH_USAGE_WINDOW_COUNT`, rounded) -- e.g. a
// STARTER+HIGH player (base weight 0.9*0.85=0.765) rounded to 5 of 6
// windows, mechanically excluding them from the match's FINAL window
// regardless of fatigue, tactics, or any real coaching decision, simply
// because 0.765 < 1.0. Every starter sharing a similar weight vacated
// the SAME window simultaneously, sometimes leaving the actual on-
// court unit thinner than 6 players in that window. The fix (Part 6):
// a starting player's window ELIGIBILITY is now always the full match
// -- coach-priority weight still matters, but only for RANKING who
// wins the capped on-court slots each window (resolveActivePhaseUnit),
// now ALSO modulated by each player's own accumulating fatigue
// (fatigueRotationAvailability, lib/matchPlan/physicalModel.ts) so
// real rotation still happens -- driven by tiredness and genuine
// coach-tier differences, never by an arbitrary window-count rounding
// artifact.
import { seedFromString } from "@handball-manager/game-simulation";
import type { MatchPlan } from "../matchPlan/types";
import { buildMatchUsagePlan, type MatchUsagePlan, type PlayerUsagePlan, type SpecialistPairSide } from "./matchUsagePlan";
import { computeStaminaFactor, ENERGY_START_DEFAULT, fatigueRotationAvailability, stepWindowEnergy, type PlayerEnergyTrajectory } from "../matchPlan/physicalModel";

export type MatchUsagePhase = "ATTACK" | "DEFENCE";

/** Part 13: six coarse internal calculation windows across a 60-minute match -- audited and kept (see module doc). Internal only. */
export const MATCH_USAGE_WINDOW_COUNT = 6;

/** rating/types.ts's own documented 1-20 attribute-scale midpoint -- the neutral stamina assumption used whenever a caller doesn't have real ratings to hand (AI-vs-AI fixtures, mid-match coaching's own usage recompute). */
const NEUTRAL_STAMINA = 10.5;

function clampWindowCount(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/**
 * Part 6/9: a STARTING player is ALWAYS window-eligible for the entire
 * match -- their coach-priority weight no longer caps eligibility
 * itself (see this module's own root-cause doc above); it still drives
 * RANKING via rotationPriority in resolveActivePhaseUnit. A BENCH
 * player's range still ends at the final window and starts earlier in
 * proportion to their own usage weight -- higher usage (MAJOR_ROTATION
 * + HIGH) becomes eligible earlier and gets real minutes; near-zero
 * usage (EMERGENCY/EMERGENCY_ONLY, hard-zeroed in matchUsagePlan.ts)
 * never becomes eligible at all (Part 16). Ties in RANKING are resolved
 * by a seeded hash, see resolveActivePhaseUnit.
 */
function activeWindowRange(usageWeight: number, isStarting: boolean): { start: number; end: number } {
  if (usageWeight <= 0) return { start: MATCH_USAGE_WINDOW_COUNT, end: MATCH_USAGE_WINDOW_COUNT };
  if (isStarting) return { start: 0, end: MATCH_USAGE_WINDOW_COUNT };
  const activeCount = clampWindowCount(usageWeight * MATCH_USAGE_WINDOW_COUNT, 0, MATCH_USAGE_WINDOW_COUNT);
  if (activeCount <= 0) return { start: MATCH_USAGE_WINDOW_COUNT, end: MATCH_USAGE_WINDOW_COUNT };
  return { start: MATCH_USAGE_WINDOW_COUNT - activeCount, end: MATCH_USAGE_WINDOW_COUNT };
}

function isActiveInWindow(range: { start: number; end: number }, window: number): boolean {
  return window >= range.start && window < range.end;
}

/** A cheap, deterministic tiebreak for equal-priority players within one window -- reuses game-simulation's own seedFromString (Part A: no second hashing/PRNG scheme). */
function tiebreak(seed: string, playerId: string): number {
  return seedFromString(`${seed}:${playerId}`);
}

/**
 * HM-MATCH-USAGE-1.4A Part 2/3/4: an EXPLICIT substitution pair is a
 * deliberate handball instruction ("A prioritized in attack, B
 * prioritized in defence"), not ordinary rotation -- it must reliably
 * beat a same-tier or lower-tier generic rotation competitor (Part 6's
 * own required test: "MAJOR_ROTATION generalist kan inte helt blockera
 * ett HIGH explicit specialistpar") even when squad-specific depth-
 * hierarchy multipliers would otherwise let a plain MAJOR_ROTATION
 * player's raw weight edge out the pair's own modest matchUsagePlan.ts
 * pair multiplier (1.3x) -- the browser QA root cause: a SPECIALIST/
 * HIGH pair (weight ~0.61 at low depth-priority) lost every contested
 * window to a MAJOR_ROTATION/HIGH bench player (weight ~0.68 at high
 * depth-priority) purely from depth-chart luck, receiving 0/0 usage
 * despite being an explicit coach pairing.
 *
 * Deliberately a RANKING-only boost, never applied to `activeWindowRange`
 * eligibility sizing (matchUsagePlan.ts's own attackUsageWeight/
 * defenceUsageWeight, which already bakes in the existing 1.3x pair
 * multiplier, are read UNCHANGED for eligibility) -- so a paired
 * specialist's own eligibility window still opens no earlier than their
 * plain weight already implies, and kickoff (window 0) still belongs
 * exclusively to the selected starting unit (Part 24 #1/#2), regardless
 * of how large this ranking boost is. Only players who are ALREADY
 * eligible for a window compete on this ranking number; a boost here
 * can never retroactively make an ineligible bench player selectable.
 */
const SPECIALIST_PAIR_RANKING_BOOST = 1.5;

function pairRankingBoost(p: PlayerUsagePlan, phase: MatchUsagePhase): number {
  if (!p.specialistPair) return 1;
  const preferredPhase: MatchUsagePhase = p.specialistPair.side === "ATTACK_SIDE" ? "ATTACK" : "DEFENCE";
  return phase === preferredPhase ? SPECIALIST_PAIR_RANKING_BOOST : 1;
}

/**
 * HM-MATCH-USAGE-1.4 Part 10/11/12: the effective ranking number used
 * to select who wins a window's capped on-court slots -- the player's
 * PHASE-SPECIFIC coach-priority weight (attackUsageWeight or
 * defenceUsageWeight, from matchUsagePlan.ts -- already carrying that
 * player's role/intention/phase-usage/specialist-pair/depth-hierarchy
 * multipliers for THIS phase), further boosted for an explicit pair's
 * preferred phase (see pairRankingBoost's own doc), inverted (lower =
 * better) and divided by the player's own current fatigue availability
 * (also [something,1], lower availability = worse effective priority =
 * more likely to be rotated out). `energyByPlayerId` is OPTIONAL:
 * omitting it (no known energy state) reproduces the exact pre-fatigue
 * ranking, unchanged -- every caller that doesn't have a running energy
 * state (AI-vs-AI, mid-match coaching's own recompute) keeps working
 * exactly as before. Part 11's own bound (fatigueRotationAvailability's
 * floor is 0.12, not 0) keeps a fatigued top-tier player from ever
 * being outranked by a fresh bottom-tier one -- see matchUsageEngine.
 * test.ts's own proof.
 */
function effectivePhaseRotationPriority(phaseWeight: number, p: PlayerUsagePlan, phase: MatchUsagePhase, energyByPlayerId?: ReadonlyMap<string, number>): number {
  // HM-MATCH-USAGE-1.4: rank by the PHASE-SPECIFIC weight (not the
  // generic, phase-agnostic `rotationPriority`) -- a specialist pair's
  // preferred/other-side multiplier (matchUsagePlan.ts) and
  // ATTACK_ONLY/DEFENCE_ONLY/*_PREFERRED phase multipliers must move
  // actual on-court RANKING for that phase, not merely the size of the
  // player's eligibility window. Using the generic rotationPriority
  // here was a real bug: it made a specialist pair's "preferred side"
  // boost affect eligibility only, never who actually wins the capped
  // on-court slots -- so a pair could show identical attack/defence
  // exposure despite being configured as strict specialists.
  const basePriority = 1 / Math.max(0.001, phaseWeight * pairRankingBoost(p, phase));
  if (!energyByPlayerId) return basePriority;
  const energy = energyByPlayerId.get(p.playerId) ?? ENERGY_START_DEFAULT;
  return basePriority / fatigueRotationAvailability(energy);
}

/**
 * Part G: the players intended to be on court for `phase` during
 * `window`, ranked by (fatigue-adjusted) rotation priority (seeded
 * tiebreak for ties) and capped at `slotCount` -- the realistic
 * on-court size (6 outfield players for NORMAL attack/defence, 7 for a
 * SEVEN_V_SIX attack unit). Goalkeepers are never included here -- see
 * computeGoalkeeperWindowCounts/resolveActiveGoalkeeperForWindow.
 */
export function resolveActivePhaseUnit(usagePlan: MatchUsagePlan, phase: MatchUsagePhase, window: number, slotCount: number, seed: string, energyByPlayerId?: ReadonlyMap<string, number>): readonly string[] {
  const eligible = usagePlan.players.filter((p) => {
    if (p.isGoalkeeper) return false;
    const weight = phase === "ATTACK" ? p.attackUsageWeight : p.defenceUsageWeight;
    if (weight <= 0) return false;
    const isStarting = phase === "ATTACK" ? p.startingInAttack : p.startingInDefence;
    return isActiveInWindow(activeWindowRange(weight, isStarting), window);
  });

  return eligible
    .slice()
    .sort((a, b) => {
      const weightA = phase === "ATTACK" ? a.attackUsageWeight : a.defenceUsageWeight;
      const weightB = phase === "ATTACK" ? b.attackUsageWeight : b.defenceUsageWeight;
      const priorityA = effectivePhaseRotationPriority(weightA, a, phase, energyByPlayerId);
      const priorityB = effectivePhaseRotationPriority(weightB, b, phase, energyByPlayerId);
      return priorityA !== priorityB ? priorityA - priorityB : tiebreak(seed, a.playerId) - tiebreak(seed, b.playerId);
    })
    .slice(0, slotCount)
    .map((p) => p.playerId);
}

/**
 * Part 15: the starting (defence-unit) goalkeeper NORMALLY dominates --
 * a structural guarantee, not merely a coincidence of relative usage
 * numbers: a backup's own windows still come from their own usage
 * weight, but are capped so backups collectively can never claim more
 * than `1 - PRIMARY_GK_MIN_SHARE` of the match, regardless of how their
 * own MatchRole/PlayingTimeIntention happens to compare to the
 * primary's. Deliberately NOT fatigue-driven (Part 15: "avoid weird
 * automatic GK swaps just because the backup is fresher" -- goalkeeper
 * energy drain is already far lower than an outfield player's, so
 * fatigue alone should never be the reason a backup takes over).
 */
const PRIMARY_GK_MIN_SHARE = 0.6;

/**
 * HM-MATCH-USAGE-1.4A Part 8/9: unlike outfield bench rotation,
 * goalkeeper rotation must be MORE coach-driven -- a backup's default
 * ROTATION/NORMAL role/intention (matchUsagePlan.ts's own fallback for
 * any GK with no explicit usage entry, weight 0.3575) must NOT, by
 * itself, claim any of the `1 - PRIMARY_GK_MIN_SHARE` allowance; browser
 * QA's own root cause was that the plain outfield-bench formula
 * (`weight * MATCH_USAGE_WINDOW_COUNT`) already crossed the allowance's
 * own ceiling at that default weight, silently granting a fresh 20-
 * minute backup share nobody asked for. This threshold shifts the
 * formula's own zero point above the default (0.3575) and below a
 * genuinely elevated backup (MAJOR_ROTATION/HIGH = 0.595, or an
 * explicit STARTER/HIGH co-goalkeeper = 0.765) -- so a coach who never
 * touches the backup's usage sees a fully dominant starter, while one
 * who explicitly raises the backup's role/intention (Part 10) still
 * gets a real, proportionate share up to the same outer cap.
 */
const GOALKEEPER_BACKUP_USAGE_BASELINE = 0.45;

function computeGoalkeeperWindowCounts(usagePlan: MatchUsagePlan): Map<string, number> {
  const counts = new Map<string, number>();
  const goalkeepers = usagePlan.players.filter((p) => p.isGoalkeeper);
  const primary = goalkeepers.find((p) => p.startingInDefence) ?? goalkeepers[0];
  if (!primary) return counts;

  const backups = goalkeepers.filter((p) => p.playerId !== primary.playerId);
  const maxBackupWindowsTotal = Math.floor(MATCH_USAGE_WINDOW_COUNT * (1 - PRIMARY_GK_MIN_SHARE));
  let backupWindowsUsed = 0;
  for (const backup of backups) {
    const requested = clampWindowCount((backup.goalkeeperUsageWeight - GOALKEEPER_BACKUP_USAGE_BASELINE) * MATCH_USAGE_WINDOW_COUNT, 0, MATCH_USAGE_WINDOW_COUNT);
    const granted = Math.max(0, Math.min(requested, maxBackupWindowsTotal - backupWindowsUsed));
    counts.set(backup.playerId, granted);
    backupWindowsUsed += granted;
  }
  counts.set(primary.playerId, MATCH_USAGE_WINDOW_COUNT - backupWindowsUsed);
  return counts;
}

/**
 * HM-MATCH-1.3B Part N: which SINGLE goalkeeper is active for a given
 * window -- reuses `computeGoalkeeperWindowCounts`'s own totals
 * verbatim (never a second GK-share calculation), just resolving WHICH
 * of the six windows each backup's granted count actually covers.
 * Backup windows are assigned from the END of the match backward, so
 * window 0 (kickoff) is always the primary/starting goalkeeper, never
 * a backup.
 */
export function resolveActiveGoalkeeperForWindow(usagePlan: MatchUsagePlan, window: number): string | null {
  const goalkeepers = usagePlan.players.filter((p) => p.isGoalkeeper);
  const primary = goalkeepers.find((p) => p.startingInDefence) ?? goalkeepers[0];
  if (!primary) return null;

  const counts = computeGoalkeeperWindowCounts(usagePlan);
  const backups = goalkeepers.filter((p) => p.playerId !== primary.playerId);
  let cursor = MATCH_USAGE_WINDOW_COUNT;
  for (const backup of backups) {
    const granted = counts.get(backup.playerId) ?? 0;
    const start = cursor - granted;
    if (window >= start && window < cursor) return backup.playerId;
    cursor = start;
  }
  return primary.playerId;
}

// ---------------------------------------------------------------------------
// HM-MATCH-USAGE-1.4 Part 10/14/21: the canonical, unified, fatigue-
// aware timeline resolver -- ONE window-by-window pass that decides
// each window's attack/defence unit (via resolveActivePhaseUnit, now
// energy-aware) and steps every player's own energy (via
// lib/matchPlan/physicalModel.ts's stepWindowEnergy) using THAT
// window's actual outcome, before moving to the next window. This
// replaces the old two-divergent-mechanisms problem (a capped/ranked
// on-court resolver for Live Match display, vs. an UNCAPPED, purely
// weight-derived "exposure" number for fatigue/strength purposes) with
// ONE source of truth: exposure IS the actual resolved on-court
// history now, nothing else. currentUnit.ts (Live Match "PÅ PLAN"),
// playerMatchStrength.ts (fatigue-weighted team value), and
// matchdayAction.ts (persisted physicalReports + Match Engine scorer
// eligibility) all read from THIS ONE computation for the manager's own
// fixture (Part 24: Direct Result and Live Match already share one
// simulation pass, so they mechanically share this too).
// ---------------------------------------------------------------------------

export interface MatchUsageTimeline {
  fixtureId: string;
  clubId: string;
  /** Index = window (0-5). The realistic, capped on-court attack unit for that window (6, or 7 for SEVEN_V_SIX). */
  attackUnitByWindow: readonly (readonly string[])[];
  /** Index = window (0-5). The realistic, capped on-court defence unit for that window (always 6 outfield players). */
  defenceUnitByWindow: readonly (readonly string[])[];
  /** Index = window (0-5). The single active goalkeeper for that window, or null if the squad has none. */
  goalkeeperByWindow: readonly (string | null)[];
  /** Every squad player's own full-match energy trajectory, stepped window-by-window using THIS timeline's own resolved units (lib/matchPlan/physicalModel.ts). */
  trajectories: ReadonlyMap<string, PlayerEnergyTrajectory>;
}

/**
 * Part 21/22: resolves the full match usage timeline for one team.
 * `staminaByPlayerId` is OPTIONAL -- a player missing from the map (or
 * the map omitted entirely) uses the neutral 10.5 midpoint, exactly as
 * HM-PHYSICAL-1.0's own playerMatchStrength.ts staminaOf() already
 * falls back for goalkeepers (who have no ENDURANCE attribute).
 * Deterministic and pure: the same (MatchPlan, stamina, seed) always
 * produces the exact same timeline (Part 24 #20).
 *
 * HM-TRAINING-1.0 Part 11: `startingEnergyByPlayerId` is ALSO OPTIONAL --
 * a player missing from the map (or the map omitted entirely) still
 * starts at `ENERGY_START_DEFAULT` (100), byte-identical to every
 * caller before this milestone (AI-vs-AI fixtures, mid-match coaching's
 * own recompute -- neither tracks persistent player condition). Only
 * matchdayAction.ts, for the manager's own squad, passes a real map --
 * closing the match -> recovery -> training -> next-match loop.
 */
export function resolveMatchUsageTimeline(plan: MatchPlan, seed: string, staminaByPlayerId?: ReadonlyMap<string, number>, startingEnergyByPlayerId?: ReadonlyMap<string, number>): MatchUsageTimeline {
  const usagePlan = buildMatchUsagePlan(plan);
  const attackSlotCount = plan.attackStartingUnit.formation === "SEVEN_V_SIX" ? 7 : 6;
  const defenceSlotCount = 6;
  const halftimeWindowIndex = MATCH_USAGE_WINDOW_COUNT / 2;

  const energyByPlayerId = new Map<string, number>();
  const staminaFactorByPlayerId = new Map<string, number>();
  const checkpointsByPlayerId = new Map<string, number[]>();
  const attackWindowsActiveById = new Map<string, number>();
  const defenceWindowsActiveById = new Map<string, number>();
  const goalkeeperWindowsActiveById = new Map<string, number>();

  for (const p of usagePlan.players) {
    const startingEnergy = startingEnergyByPlayerId?.get(p.playerId) ?? ENERGY_START_DEFAULT;
    energyByPlayerId.set(p.playerId, startingEnergy);
    staminaFactorByPlayerId.set(p.playerId, computeStaminaFactor(staminaByPlayerId?.get(p.playerId) ?? NEUTRAL_STAMINA));
    checkpointsByPlayerId.set(p.playerId, [startingEnergy]);
    attackWindowsActiveById.set(p.playerId, 0);
    defenceWindowsActiveById.set(p.playerId, 0);
    goalkeeperWindowsActiveById.set(p.playerId, 0);
  }

  const attackUnitByWindow: (readonly string[])[] = [];
  const defenceUnitByWindow: (readonly string[])[] = [];
  const goalkeeperByWindow: (string | null)[] = [];

  for (let window = 0; window < MATCH_USAGE_WINDOW_COUNT; window += 1) {
    const attackUnit = resolveActivePhaseUnit(usagePlan, "ATTACK", window, attackSlotCount, seed, energyByPlayerId);
    const defenceUnit = resolveActivePhaseUnit(usagePlan, "DEFENCE", window, defenceSlotCount, seed, energyByPlayerId);
    const goalkeeper = resolveActiveGoalkeeperForWindow(usagePlan, window);
    attackUnitByWindow.push(attackUnit);
    defenceUnitByWindow.push(defenceUnit);
    goalkeeperByWindow.push(goalkeeper);

    const attackSet = new Set(attackUnit);
    const defenceSet = new Set(defenceUnit);
    const isHalftimeBoundary = window + 1 === halftimeWindowIndex;

    for (const p of usagePlan.players) {
      const attack = attackSet.has(p.playerId);
      const defence = defenceSet.has(p.playerId);
      const goalkeeperActive = goalkeeper === p.playerId;
      if (attack) attackWindowsActiveById.set(p.playerId, attackWindowsActiveById.get(p.playerId)! + 1);
      if (defence) defenceWindowsActiveById.set(p.playerId, defenceWindowsActiveById.get(p.playerId)! + 1);
      if (goalkeeperActive) goalkeeperWindowsActiveById.set(p.playerId, goalkeeperWindowsActiveById.get(p.playerId)! + 1);

      const currentEnergy = energyByPlayerId.get(p.playerId)!;
      const nextEnergy = stepWindowEnergy(currentEnergy, { attack, defence, goalkeeper: goalkeeperActive }, staminaFactorByPlayerId.get(p.playerId)!, p.isGoalkeeper, isHalftimeBoundary);
      energyByPlayerId.set(p.playerId, nextEnergy);
      checkpointsByPlayerId.get(p.playerId)!.push(nextEnergy);
    }
  }

  const trajectories = new Map<string, PlayerEnergyTrajectory>();
  for (const p of usagePlan.players) {
    const checkpoints = checkpointsByPlayerId.get(p.playerId)!;
    trajectories.set(p.playerId, {
      playerId: p.playerId,
      checkpoints,
      startingEnergy: checkpoints[0],
      finishingEnergy: checkpoints[checkpoints.length - 1],
      attackWindowsActive: attackWindowsActiveById.get(p.playerId)!,
      defenceWindowsActive: defenceWindowsActiveById.get(p.playerId)!,
      goalkeeperWindowsActive: goalkeeperWindowsActiveById.get(p.playerId)!,
    });
  }

  return { fixtureId: plan.fixtureId, clubId: plan.clubId, attackUnitByWindow, defenceUnitByWindow, goalkeeperByWindow, trajectories };
}

/**
 * HM-MATCH-1.1 Part 10/11, rebuilt on resolveMatchUsageTimeline: per-
 * window ATTACK eligibility per outfield player, now the ACTUAL
 * resolved on-court set (never a separate, potentially divergent
 * "intended fraction" -- see this module's own root-cause doc). The
 * Match Engine (packages/game-simulation) uses this to gate WHICH
 * player can be drawn as a goal's scorer for a given minute's window.
 */
export function computeAttackActiveWindows(plan: MatchPlan, seed = "matchUsageEngine", staminaByPlayerId?: ReadonlyMap<string, number>): ReadonlyMap<string, readonly boolean[]> {
  const timeline = resolveMatchUsageTimeline(plan, seed, staminaByPlayerId);
  const map = new Map<string, boolean[]>();
  for (const trajectory of timeline.trajectories.values()) map.set(trajectory.playerId, new Array(MATCH_USAGE_WINDOW_COUNT).fill(false));
  timeline.attackUnitByWindow.forEach((unit, window) => {
    for (const playerId of unit) {
      const windows = map.get(playerId);
      if (windows) windows[window] = true;
    }
  });
  return map;
}

// ---------------------------------------------------------------------------
// HM-PHYSICAL-1.0 Part 4/11, rebuilt by HM-MATCH-USAGE-1.4 on top of
// resolveMatchUsageTimeline: per-player, per-window ATTACK/DEFENCE/
// GOALKEEPER activity booleans -- the exact input the physical/fatigue
// model (lib/matchPlan/physicalModel.ts) consumes. Now the ACTUAL
// resolved on-court set per window, matching exactly what
// resolveMatchUsageTimeline itself used to step energy -- never a
// second, divergent lineup/minutes algorithm.
// ---------------------------------------------------------------------------

export interface PlayerWindowActivity {
  playerId: string;
  isGoalkeeper: boolean;
  /** Length MATCH_USAGE_WINDOW_COUNT. Always all-false for a goalkeeper (see goalkeeperActive instead). */
  attackActive: readonly boolean[];
  /** Length MATCH_USAGE_WINDOW_COUNT. Always all-false for a goalkeeper. */
  defenceActive: readonly boolean[];
  /** Length MATCH_USAGE_WINDOW_COUNT. Always all-false for an outcourt player. */
  goalkeeperActive: readonly boolean[];
}

export function computePlayerWindowActivity(plan: MatchPlan, seed = "matchUsageEngine", staminaByPlayerId?: ReadonlyMap<string, number>): readonly PlayerWindowActivity[] {
  const usagePlan = buildMatchUsagePlan(plan);
  const timeline = resolveMatchUsageTimeline(plan, seed, staminaByPlayerId);
  const attackSets = timeline.attackUnitByWindow.map((unit) => new Set(unit));
  const defenceSets = timeline.defenceUnitByWindow.map((unit) => new Set(unit));

  return usagePlan.players.map((p) => {
    if (p.isGoalkeeper) {
      const goalkeeperActive = timeline.goalkeeperByWindow.map((gk) => gk === p.playerId);
      return { playerId: p.playerId, isGoalkeeper: true, attackActive: new Array(MATCH_USAGE_WINDOW_COUNT).fill(false), defenceActive: new Array(MATCH_USAGE_WINDOW_COUNT).fill(false), goalkeeperActive };
    }
    const attackActive = attackSets.map((set) => set.has(p.playerId));
    const defenceActive = defenceSets.map((set) => set.has(p.playerId));
    return { playerId: p.playerId, isGoalkeeper: false, attackActive, defenceActive, goalkeeperActive: new Array(MATCH_USAGE_WINDOW_COUNT).fill(false) };
  });
}

export interface PlayerUsageTrace {
  playerId: string;
  /** 0-1, normalized: fraction of match windows this player was ACTUALLY resolved on court in ATTACK. */
  attackExposure: number;
  /** 0-1, normalized: fraction of match windows this player was ACTUALLY resolved on court in DEFENCE (outfield). 0 for goalkeepers -- see goalkeeperExposure. */
  defenceExposure: number;
  /** 0-1, normalized: fraction of match windows this player was ACTUALLY the active goalkeeper. 0 for outcourt players. */
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
 * Part J, rebuilt by HM-MATCH-USAGE-1.4 on resolveMatchUsageTimeline:
 * the full per-player usage trace for one team -- the actual input
 * playerMatchStrength.ts consumes. `attackExposure`/`defenceExposure`/
 * `goalkeeperExposure` now come directly from the SAME window-by-window
 * resolution that decides Live Match's "PÅ PLAN" and steps energy --
 * one source of truth, never a separately-derived "intended fraction"
 * (this module's own root-cause doc explains why that used to diverge
 * and mechanically under-count starters). `staminaByPlayerId` is
 * OPTIONAL, same fallback as resolveMatchUsageTimeline.
 */
export function computeTeamUsageTrace(plan: MatchPlan, seed: string, staminaByPlayerId?: ReadonlyMap<string, number>): TeamUsageTrace {
  const usagePlan = buildMatchUsagePlan(plan);
  const timeline = resolveMatchUsageTimeline(plan, seed, staminaByPlayerId);

  let phaseSubstitutionCount = 0;
  for (let window = 1; window < MATCH_USAGE_WINDOW_COUNT; window += 1) {
    phaseSubstitutionCount += symmetricDifferenceSize(new Set(timeline.attackUnitByWindow[window - 1]), new Set(timeline.attackUnitByWindow[window]));
    phaseSubstitutionCount += symmetricDifferenceSize(new Set(timeline.defenceUnitByWindow[window - 1]), new Set(timeline.defenceUnitByWindow[window]));
  }

  const players: PlayerUsageTrace[] = usagePlan.players.map((p) => {
    const trajectory = timeline.trajectories.get(p.playerId);
    const attackWindows = trajectory?.attackWindowsActive ?? 0;
    const defenceWindows = trajectory?.defenceWindowsActive ?? 0;
    const goalkeeperWindows = trajectory?.goalkeeperWindowsActive ?? 0;
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

// ---------------------------------------------------------------------------
// HM-MATCH-USAGE-1.4 Part 21/22: a human-readable USAGE REPORT --
// internally the model works entirely in windows/exposure fractions,
// but "roughly 30 attack minutes, 20 defence minutes" is what a manager
// actually wants to read. Derived directly from computePlayerWindowActivity's
// own per-window booleans (never a separate estimate) -- `courtMinutes`
// is the UNION of attack/defence/goalkeeper windows, deliberately NOT
// `attackMinutes + defenceMinutes`: a phase specialist (e.g. an
// ATTACK_ONLY/DEFENCE_ONLY substitution pair) can be exposed in a
// DIFFERENT phase during the SAME chronological window as their
// partner, so summing would double-count that shared match time.
// ---------------------------------------------------------------------------

const MINUTES_PER_WINDOW = 60 / MATCH_USAGE_WINDOW_COUNT;

export interface PlayerUsageMinutes {
  playerId: string;
  attackMinutes: number;
  defenceMinutes: number;
  goalkeeperMinutes: number;
  /** Union of attack/defence/goalkeeper windows -- total chronological time actually on court, never attackMinutes + defenceMinutes + goalkeeperMinutes (see module doc). */
  courtMinutes: number;
}

/** Part 21/24 #28: an understandable per-player minutes report, derived from the exact same resolved timeline every other consumer of this fixture's MatchUsage reads. */
export function computeUsageMinutesReport(plan: MatchPlan, seed = "matchUsageEngine", staminaByPlayerId?: ReadonlyMap<string, number>): readonly PlayerUsageMinutes[] {
  const activities = computePlayerWindowActivity(plan, seed, staminaByPlayerId);
  return activities.map((a) => {
    const attackMinutes = a.attackActive.filter(Boolean).length * MINUTES_PER_WINDOW;
    const defenceMinutes = a.defenceActive.filter(Boolean).length * MINUTES_PER_WINDOW;
    const goalkeeperMinutes = a.goalkeeperActive.filter(Boolean).length * MINUTES_PER_WINDOW;
    const courtWindows = a.attackActive.filter((_, w) => a.attackActive[w] || a.defenceActive[w] || a.goalkeeperActive[w]).length;
    return { playerId: a.playerId, attackMinutes, defenceMinutes, goalkeeperMinutes, courtMinutes: courtWindows * MINUTES_PER_WINDOW };
  });
}
