// HM-PHYSICAL-1.0: the ONE deterministic Energy/Fatigue/Performance
// domain module. Deliberately engine-agnostic and headless -- it takes
// plain per-window activity booleans (from
// lib/career/matchUsageEngine.ts's `computePlayerWindowActivity`, the
// SAME MatchUsage temporal-exposure resolution every other match-
// strength system already uses -- no second lineup/minutes algorithm
// is built here) and a player's own ENDURANCE attribute, and produces
// an energy trajectory plus a bounded performance modifier.
//
// Product principle (Part 15/27): fatigue is a MODIFIER, never a
// replacement for player quality. A world-class player at low energy
// must still outperform a weak reserve at full energy -- see
// PERFORMANCE_CURVE's own floor (0.65, not 0). This is a management-
// game model: plausible, understandable, deterministic, tunable --
// never a sports-science simulation.
//
// Determinism (Part 6/24 #20): the SAME (windowActivity, stamina,
// startingEnergy) always produces the exact SAME trajectory. No
// randomness anywhere in this module.

// ---------------------------------------------------------------------------
// Part 3: energy scale.
// ---------------------------------------------------------------------------

export const ENERGY_MIN = 0;
export const ENERGY_MAX = 100;
/** Part 3: "a healthy, fully recovered player should normally start near 100" -- the API accepts a lower `startingEnergy` explicitly so a FUTURE recovery/training/injury system can feed one in; this milestone always calls with the default. */
export const ENERGY_START_DEFAULT = 100;

function clampEnergy(n: number): number {
  return Math.max(ENERGY_MIN, Math.min(ENERGY_MAX, n));
}

// ---------------------------------------------------------------------------
// Part 22: every tuning constant lives here, nowhere else. Calibration
// questions (Part 26) are answered by adjusting THESE numbers, never by
// scattering magic numbers through the model's own logic.
// ---------------------------------------------------------------------------

export const PHYSICAL_MODEL_TUNING = {
  /** Mirrors matchUsageEngine.ts's own MATCH_USAGE_WINDOW_COUNT -- duplicated as a plain constant (not imported) so this module stays free of any MatchUsage/career dependency; lib/career/matchUsageEngine.ts's window count is the actual source of truth callers must keep in sync with (asserted by this module's own tests). */
  windowCount: 6,
  minutesPerWindow: 10,
  /** Energy lost per 10-minute window a player is ACTIVE in that phase (Part 6: base load, before stamina scaling). Additive when a player is active in both attack and defence within the same window (a genuine two-way player did more physical work that window than a one-way player). */
  baseLoadPerWindow: {
    ATTACK: 6,
    DEFENCE: 5,
    /** Part 11: a goalkeeper's load profile is deliberately much lower than an outfield player's -- positioning/reflexes, not repeated sprinting/contact. Applied instead of ATTACK/DEFENCE whenever the player's role for this trajectory is goalkeeper. */
    GOALKEEPER: 2,
  },
  /** Part 9: a benched player's loss stops, and they recover a small, bounded amount per window -- never enough to approach a full reset (Part 9: "10 min play, 5 min rest -> NOT back to 100"). */
  benchRecoveryPerWindow: 3,
  /**
   * Part 8: how strongly the ENDURANCE attribute (1-20, midpoint 10.5)
   * scales load. A factor of 1.0 at the neutral midpoint; higher
   * endurance scales load down, lower endurance scales it up, clamped
   * to a deliberately modest band (Part 8: "noticeable but not absurd",
   * "avoid making stamina a super-stat").
   */
  staminaLoadScale: 0.35,
  staminaFactorMin: 0.7,
  staminaFactorMax: 1.25,
  /** Part 10: halftime gives a limited, deterministic recovery bump -- a flat amount plus a fraction of the remaining gap to full, never a reset. */
  halftimeRecoveryFlat: 5,
  halftimeRecoveryFraction: 0.12,
} as const;

/** The 1-20 attribute scale's own documented midpoint (rating/types.ts: ATTRIBUTE_MIN=1, ATTRIBUTE_MAX=20) -- reused here as the "neutral" stamina reference point, not re-derived. */
const ATTRIBUTE_NEUTRAL_MIDPOINT = 10.5;
const ATTRIBUTE_SPAN_HALF = 9.5; // (20 - 1) / 2, rounded consistently with the 10.5 midpoint above

/** Part 8: higher ENDURANCE -> lower load multiplier (more resistant to fatigue); lower ENDURANCE -> higher load multiplier. Clamped to a modest band so stamina meaningfully differentiates players without becoming a super-stat. */
export function computeStaminaFactor(staminaAttribute1to20: number): number {
  const deviation = (staminaAttribute1to20 - ATTRIBUTE_NEUTRAL_MIDPOINT) / ATTRIBUTE_SPAN_HALF; // -1..1
  const factor = 1 - deviation * PHYSICAL_MODEL_TUNING.staminaLoadScale;
  return Math.max(PHYSICAL_MODEL_TUNING.staminaFactorMin, Math.min(PHYSICAL_MODEL_TUNING.staminaFactorMax, factor));
}

// ---------------------------------------------------------------------------
// Part 4/5/11: per-window activity input -- built once per fixture by
// lib/career/matchUsageEngine.ts's computePlayerWindowActivity, never
// re-derived here. A player may legally be active in BOTH attack and
// defence within the same window (a genuine two-way player); goalkeeper
// activity is mutually exclusive with attack/defence for the SAME
// player (a goalkeeper is never also an outcourt attacker/defender --
// HM-COURT-GRID-0.3's own board already enforces this structurally).
// ---------------------------------------------------------------------------

export interface WindowActivity {
  attackActive: readonly boolean[];
  defenceActive: readonly boolean[];
  goalkeeperActive: readonly boolean[];
}

export interface PlayerEnergyTrajectory {
  playerId: string;
  /** Length windowCount+1 -- energy at minute 0, 10, 20, ..., 60 (Part 26's own checkpoint granularity). */
  checkpoints: readonly number[];
  startingEnergy: number;
  finishingEnergy: number;
  attackWindowsActive: number;
  defenceWindowsActive: number;
  goalkeeperWindowsActive: number;
}

/** Part 4/5: the load for ONE window, given which phase(s) the player was active in and whether this trajectory is being computed for a goalkeeper (Part 11: goalkeeper load is a wholly separate profile, never "outfield load because MatchUsage says they're on court"). */
function windowLoad(activity: { attack: boolean; defence: boolean; goalkeeper: boolean }, staminaFactor: number, isGoalkeeperRole: boolean): number {
  if (isGoalkeeperRole) {
    return activity.goalkeeper ? PHYSICAL_MODEL_TUNING.baseLoadPerWindow.GOALKEEPER * staminaFactor : 0;
  }
  let load = 0;
  if (activity.attack) load += PHYSICAL_MODEL_TUNING.baseLoadPerWindow.ATTACK;
  if (activity.defence) load += PHYSICAL_MODEL_TUNING.baseLoadPerWindow.DEFENCE;
  return load * staminaFactor;
}

/**
 * Part 3/6/9/10/11: the one function building a full-match energy
 * trajectory for one player. Deterministic (Part 24 #20): the same
 * inputs always produce the same checkpoints array.
 */
/**
 * HM-MATCH-USAGE-1.4: the single per-window energy step -- extracted
 * out of computeEnergyTrajectory's own loop (below) so
 * lib/career/matchUsageEngine.ts's new fatigue-AWARE rotation resolver
 * can step the SAME physical model window-by-window WHILE deciding who
 * is on court, instead of only being able to compute a trajectory
 * AFTER usage is already fully decided (the ordering problem that made
 * fatigue-driven rotation impossible before this milestone). Pure,
 * deterministic -- same inputs, same output.
 */
export function stepWindowEnergy(currentEnergy: number, activity: { attack: boolean; defence: boolean; goalkeeper: boolean }, staminaFactor: number, isGoalkeeperRole: boolean, isHalftimeBoundary: boolean): number {
  const active = isGoalkeeperRole ? activity.goalkeeper : activity.attack || activity.defence;
  let energy = active ? clampEnergy(currentEnergy - windowLoad(activity, staminaFactor, isGoalkeeperRole)) : clampEnergy(currentEnergy + PHYSICAL_MODEL_TUNING.benchRecoveryPerWindow);
  if (isHalftimeBoundary) {
    energy = clampEnergy(energy + PHYSICAL_MODEL_TUNING.halftimeRecoveryFlat + (ENERGY_MAX - energy) * PHYSICAL_MODEL_TUNING.halftimeRecoveryFraction);
  }
  return energy;
}

export function computeEnergyTrajectory(playerId: string, isGoalkeeperRole: boolean, activity: WindowActivity, staminaAttribute1to20: number, startingEnergy: number = ENERGY_START_DEFAULT): PlayerEnergyTrajectory {
  const staminaFactor = computeStaminaFactor(staminaAttribute1to20);
  const halftimeWindowIndex = PHYSICAL_MODEL_TUNING.windowCount / 2;

  const checkpoints: number[] = [clampEnergy(startingEnergy)];
  let energy = checkpoints[0];
  let attackWindowsActive = 0;
  let defenceWindowsActive = 0;
  let goalkeeperWindowsActive = 0;

  for (let w = 0; w < PHYSICAL_MODEL_TUNING.windowCount; w++) {
    const attack = activity.attackActive[w] ?? false;
    const defence = activity.defenceActive[w] ?? false;
    const goalkeeper = activity.goalkeeperActive[w] ?? false;
    if (attack) attackWindowsActive += 1;
    if (defence) defenceWindowsActive += 1;
    if (goalkeeper) goalkeeperWindowsActive += 1;

    energy = stepWindowEnergy(energy, { attack, defence, goalkeeper }, staminaFactor, isGoalkeeperRole, w + 1 === halftimeWindowIndex);
    checkpoints.push(energy);
  }

  return {
    playerId,
    checkpoints,
    startingEnergy: checkpoints[0],
    finishingEnergy: checkpoints[checkpoints.length - 1],
    attackWindowsActive,
    defenceWindowsActive,
    goalkeeperWindowsActive,
  };
}

/** Energy at an arbitrary clock minute (0-60), linearly interpolated between the two nearest checkpoints -- for Live Match's minute-by-minute display (Part 16), which reveals an already-computed trajectory rather than deciding one live (see matchdayAction.ts's own doc: the Fast Match Engine runs once, up front). */
export function energyAtMinute(trajectory: PlayerEnergyTrajectory, clockMinute: number): number {
  const minute = Math.max(0, Math.min(PHYSICAL_MODEL_TUNING.windowCount * PHYSICAL_MODEL_TUNING.minutesPerWindow, clockMinute));
  const windowPosition = minute / PHYSICAL_MODEL_TUNING.minutesPerWindow;
  const lowerIndex = Math.floor(windowPosition);
  const upperIndex = Math.min(trajectory.checkpoints.length - 1, lowerIndex + 1);
  const t = windowPosition - lowerIndex;
  const lower = trajectory.checkpoints[lowerIndex];
  const upper = trajectory.checkpoints[upperIndex];
  return clampEnergy(lower + (upper - lower) * t);
}

// ---------------------------------------------------------------------------
// Part 12/13: energy -> performance. Non-linear (Part 13), bounded
// (Part 15/27) so fatigue can never make a world-class player worse
// than a weak reserve at full energy -- see this module's own tests
// for the exact worked-example proof.
// ---------------------------------------------------------------------------

/**
 * Breakpoints (energy, modifier), descending -- linearly interpolated
 * between neighbours. Part 13's own described curve: "100-80 almost no
 * effect, 80-60 small, 60-40 clearer, 40-20 large, <20 severe". The
 * floor (0.65 at energy 0) is deliberately NOT closer to 0 -- Part 15's
 * own worked requirement ("a world-class player at 55 energy must still
 * be able to outperform a weak reserve at 100") needs real headroom;
 * see this module's test file for the exact numeric proof this floor
 * satisfies it.
 */
const PERFORMANCE_CURVE: readonly (readonly [energy: number, modifier: number])[] = [
  [100, 1.0],
  [80, 0.985],
  [60, 0.95],
  [40, 0.88],
  [20, 0.78],
  [0, 0.65],
];

function interpolateCurve(curve: readonly (readonly [energy: number, modifier: number])[], energy: number): number {
  const e = clampEnergy(energy);
  for (let i = 0; i < curve.length - 1; i++) {
    const [hiEnergy, hiModifier] = curve[i];
    const [loEnergy, loModifier] = curve[i + 1];
    if (e <= hiEnergy && e >= loEnergy) {
      const t = hiEnergy === loEnergy ? 0 : (e - loEnergy) / (hiEnergy - loEnergy);
      return loModifier + t * (hiModifier - loModifier);
    }
  }
  return curve[curve.length - 1][1];
}

/** Part 12/13: energy -> a bounded [0.65, 1.0] performance multiplier. Never mutates any permanent attribute (Part 12/19) -- purely a multiplier the CALLER applies to a temporary, per-match value. */
export function fatiguePerformanceModifier(energy: number): number {
  return interpolateCurve(PERFORMANCE_CURVE, energy);
}

/** Part 12: a convenience wrapper -- `effectiveAttribute = baseAttribute * modifier`. The base attribute itself is NEVER touched (Part 12/19); this returns a new, temporary number only. */
export function effectiveAttributeValue(baseAttribute: number, energy: number): number {
  return baseAttribute * fatiguePerformanceModifier(energy);
}

// ---------------------------------------------------------------------------
// HM-MATCH-USAGE-1.4 Part 10/12: a SEPARATE, additive curve -- energy's
// effect on a player's ROTATION availability, never a retuning of
// PERFORMANCE_CURVE above (Part 23: "DO NOT RETUNE PHYSICAL MODEL YET"
// means the existing energy-loss/performance tuning stays untouched;
// this is a genuinely new concept, not a retune). Deliberately STEEPER
// than the performance curve -- a performance penalty must stay gentle
// so quality persists (Part 15 of HM-PHYSICAL-1.0), but a ROTATION
// decision needs real responsiveness, or fatigue could never actually
// create a reason to substitute (Part 10's own "then a rotation can
// happen" requirement). Still bounded well above zero (floor 0.3, not
// 0) so fatigue alone can never let a low-tier player outrank a
// high-tier one purely by tiredness (Part 11's own worked example) --
// see matchUsageEngine.ts's own tests for the exact numeric proof.
// Floor is 0.12 (not 0.3): calibrated so that a full 60-minute two-way
// STARTER/HIGH player genuinely CAN be overtaken even by a plain
// ROTATION/NORMAL bench player (the DEFAULT bench profile) by the
// match's closing window -- Part 9's own wording is explicit that even
// ROTATION/NORMAL "ska få mindre men tydlig användning" (smaller but
// CLEAR usage), not zero, so a bare default bench player must be able
// to break through a fully tied six-starter XI by full time. A large
// role/intention TIER gap (e.g. KEY_PLAYER/VERY_HIGH vs a fresh
// DEVELOPMENT player) still can never be closed by fatigue alone --
// see matchUsageEngine.test.ts's own numeric proof for both bounds.
// ---------------------------------------------------------------------------

const ROTATION_AVAILABILITY_CURVE: readonly (readonly [energy: number, availability: number])[] = [
  [100, 1.0],
  [80, 0.8],
  [60, 0.45],
  [40, 0.25],
  [20, 0.18],
  [0, 0.12],
];

/** Part 10/12: energy -> a bounded [0.12, 1.0] rotation-priority availability multiplier -- used ONLY to rank who gets selected on court, never to scale attribute/performance values (see fatiguePerformanceModifier for that, separate concept). */
export function fatigueRotationAvailability(energy: number): number {
  return interpolateCurve(ROTATION_AVAILABILITY_CURVE, energy);
}

// ---------------------------------------------------------------------------
// Part 21: the persisted match-physical report -- one per fixture,
// alongside CareerState.results (see career/types.ts's own doc). Keyed
// by playerId so future recovery/training/injury/workload systems can
// look up any squad player's starting/finishing energy and full
// trajectory for a played fixture.
// ---------------------------------------------------------------------------

export interface MatchPhysicalReport {
  fixtureId: string;
  home: Readonly<Record<string, PlayerEnergyTrajectory>>;
  away: Readonly<Record<string, PlayerEnergyTrajectory>>;
  // HM-MATCH-USAGE-1.4 Part 14/24 #23: the EXACT per-window on-court
  // units the fatigue-aware MatchUsage timeline resolved for this
  // fixture (lib/career/matchUsageEngine.ts's resolveMatchUsageTimeline)
  // -- persisted so Live Match's "PÅ PLAN" panel (lib/career/
  // currentUnit.ts) becomes a pure LOOKUP into the same resolution the
  // Fast Match Engine's scorer-eligibility gating and this report's own
  // trajectories already used, never a second, freshly-recomputed
  // lineup engine that could silently disagree (Part 14: "no second
  // lineup/minutes algorithm"). Optional-shaped (`?? []` at every read
  // site) so a MatchPhysicalReport persisted by an earlier build of this
  // milestone (before these fields existed) still loads safely.
  homeAttackUnitByWindow?: readonly (readonly string[])[];
  homeDefenceUnitByWindow?: readonly (readonly string[])[];
  homeGoalkeeperByWindow?: readonly (string | null)[];
  awayAttackUnitByWindow?: readonly (readonly string[])[];
  awayDefenceUnitByWindow?: readonly (readonly string[])[];
  awayGoalkeeperByWindow?: readonly (string | null)[];
}

/**
 * Part 14: the exposure-weighted average fatigue modifier for one
 * player across whichever windows they were actually active in a given
 * phase -- what playerMatchStrength.ts multiplies into its existing
 * attack/defence/goalkeeper value BEFORE that value is exposure-
 * weighted across the squad (Part 15: a player never active in this
 * phase returns 1.0 -- no penalty, since fatigue only ever applies to
 * actual usage, never a phantom one).
 */
export function computeAveragePhaseFatigueModifier(trajectory: PlayerEnergyTrajectory, phaseActiveFlags: readonly boolean[]): number {
  let sum = 0;
  let count = 0;
  for (let w = 0; w < phaseActiveFlags.length; w++) {
    if (!phaseActiveFlags[w]) continue;
    const windowStartEnergy = trajectory.checkpoints[w];
    const windowEndEnergy = trajectory.checkpoints[w + 1];
    const averageEnergyThisWindow = (windowStartEnergy + windowEndEnergy) / 2;
    sum += fatiguePerformanceModifier(averageEnergyThisWindow);
    count += 1;
  }
  return count > 0 ? sum / count : 1;
}
