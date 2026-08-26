// HM-TRAINING-1.0 Part 8/9: physical load math. Reuses HM-PHYSICAL-1.0's
// own energy scale and stamina model (lib/matchPlan/physicalModel.ts)
// rather than inventing a second energy universe -- ENERGY_MIN/MAX and
// `computeStaminaFactor` are the SAME ones the match engine itself
// uses. Deliberately headless/pure, same discipline as physicalModel.ts
// itself: no CareerState, no React, no randomness.
import { ENERGY_MAX, ENERGY_MIN, computeStaminaFactor } from "../matchPlan/physicalModel";
import type { PlayerTrainingLoadSetting, TrainingDuration, TrainingIntensity, TrainingSessionType } from "./types";

function clampEnergy(n: number): number {
  return Math.max(ENERGY_MIN, Math.min(ENERGY_MAX, n));
}

// ---------------------------------------------------------------------------
// Part 22: every tuning constant lives here, nowhere else -- same
// discipline as PHYSICAL_MODEL_TUNING. Calibration questions are
// answered by adjusting THESE numbers.
// ---------------------------------------------------------------------------

export const TRAINING_TUNING = {
  /** Applied to every player, every day, before any session/day-type effect (Part 9: "a player who finishes at 45 energy should NOT automatically start next morning at 100"). */
  overnightRecoveryFlat: 6,
  overnightRecoveryFraction: 0.08,
  /** REST day: zero sessions, the single biggest net recovery (Part 4). */
  restDayBonusFlat: 12,
  restDayBonusFraction: 0.1,
  /** RECOVERY day with no scheduled session still recovers more than a bare overnight, but less than a full REST day. */
  recoveryDayBonusFlat: 6,
  recoveryDayBonusFraction: 0.06,
  /**
   * Part 8's own worked example ordering: RECOVERY is a net GAIN
   * (negative base = energy added, never subtracted); CONDITIONING is
   * the heaviest outfield load; GOALKEEPER load is deliberately lighter
   * than outfield PHYSICAL/CONDITIONING, mirroring HM-PHYSICAL-1.0's own
   * "goalkeeper load is a wholly separate, lighter profile" precedent.
   */
  sessionBaseLoad: {
    RECOVERY: -8,
    TEAM_TACTICAL: 5,
    TECHNICAL: 5,
    MATCH_PREPARATION: 5,
    GOALKEEPER: 5,
    SPECIAL_PLAY: 6,
    ATTACK: 7,
    DEFENCE: 7,
    TRANSITION: 9,
    PHYSICAL: 10,
    STRENGTH: 10,
    CONDITIONING: 12,
  } satisfies Record<TrainingSessionType, number>,
  intensityMultiplier: {
    LOW: 0.6,
    NORMAL: 1.0,
    HIGH: 1.4,
    VERY_HIGH: 1.8,
  } satisfies Record<TrainingIntensity, number>,
  durationMultiplier: {
    SHORT: 0.7,
    NORMAL: 1.0,
    LONG: 1.3,
  } satisfies Record<TrainingDuration, number>,
  /** Part 12: FULL/REDUCED scale the session's own magnitude; RECOVERY_ONLY/REST are handled structurally (see computePlayerSessionEnergyDelta), not via this multiplier. */
  loadSettingMultiplier: {
    FULL: 1.0,
    REDUCED: 0.5,
    RECOVERY_ONLY: 1.0,
    REST: 0,
  } satisfies Record<PlayerTrainingLoadSetting, number>,
} as const;

export { clampEnergy as clampTrainingEnergy };

/**
 * Part 8: `load = session type × intensity × duration`, further scaled
 * by the player's own stamina (ENDURANCE, same [0.7, 1.25] factor
 * HM-PHYSICAL-1.0 uses for match load) -- but ONLY for a genuine load
 * (positive base). A RECOVERY session's net gain is intensity/duration-
 * scaled the same way (a longer, more focused recovery session helps
 * more) but is NEVER reduced by a tired player's own stamina -- fatigue
 * should never make recovery itself less effective.
 * Returns an ENERGY DELTA: negative = load (energy lost), positive =
 * net gain (a RECOVERY-type session).
 */
export function computeSessionEnergyDelta(type: TrainingSessionType, intensity: TrainingIntensity, duration: TrainingDuration, staminaAttribute1to20: number): number {
  const base = TRAINING_TUNING.sessionBaseLoad[type];
  const intensityMult = TRAINING_TUNING.intensityMultiplier[intensity];
  const durationMult = TRAINING_TUNING.durationMultiplier[duration];
  const magnitude = Math.abs(base) * intensityMult * durationMult;
  if (base < 0) {
    return magnitude; // recovery bonus: positive, stamina-independent
  }
  return -(magnitude * computeStaminaFactor(staminaAttribute1to20));
}

/**
 * Part 12/13: one player's own effective delta for a scheduled session,
 * after their individual PlayerTrainingLoadSetting is applied.
 * REST: the player skips this session entirely (0 delta) -- they are
 *   simply not among today's participants for load purposes.
 * RECOVERY_ONLY: regardless of what was actually scheduled, this
 *   player does a plain RECOVERY/NORMAL/NORMAL session instead --
 *   returning from a heavy period never means "do the hard session
 *   anyway, just a bit less".
 * FULL/REDUCED: the actual scheduled session, scaled by 1.0 or 0.5.
 */
export function computePlayerSessionEnergyDelta(session: { type: TrainingSessionType; intensity: TrainingIntensity; duration: TrainingDuration }, loadSetting: PlayerTrainingLoadSetting, staminaAttribute1to20: number): number {
  if (loadSetting === "REST") return 0;
  if (loadSetting === "RECOVERY_ONLY") {
    return computeSessionEnergyDelta("RECOVERY", "NORMAL", "NORMAL", staminaAttribute1to20);
  }
  const raw = computeSessionEnergyDelta(session.type, session.intensity, session.duration, staminaAttribute1to20);
  return raw * TRAINING_TUNING.loadSettingMultiplier[loadSetting];
}

/** Part 9: every player, every day, before any session or day-type bonus. */
export function applyOvernightRecovery(energy: number): number {
  const gap = ENERGY_MAX - energy;
  return clampEnergy(energy + TRAINING_TUNING.overnightRecoveryFlat + gap * TRAINING_TUNING.overnightRecoveryFraction);
}

/** REST day type only -- applied ON TOP OF overnight recovery. */
export function applyRestDayBonus(energy: number): number {
  const gap = ENERGY_MAX - energy;
  return clampEnergy(energy + TRAINING_TUNING.restDayBonusFlat + gap * TRAINING_TUNING.restDayBonusFraction);
}

/** RECOVERY day type with zero scheduled sessions -- smaller than REST's own bonus, applied ON TOP OF overnight recovery. */
export function applyRecoveryDayBonus(energy: number): number {
  const gap = ENERGY_MAX - energy;
  return clampEnergy(energy + TRAINING_TUNING.recoveryDayBonusFlat + gap * TRAINING_TUNING.recoveryDayBonusFraction);
}
