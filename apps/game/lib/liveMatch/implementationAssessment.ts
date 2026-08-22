// HM-COACHING-0.3: implementation assessment -- makes in-match coaching
// delivery less mechanical WITHOUT adding a final player attribute or a
// single magical "receptiveness" rating.
//
// Extends the existing issued -> pending -> adopted lifecycle
// (HM-TACTICS-0.7/HM-COACHING-0.1) with one extra step, replacing a
// fixed "always lands exactly as asked, exactly at the computed
// minute" outcome with a small, deterministic, SITUATIONAL assessment:
//
//   issued -> pending -> implementation assessment -> FULL / PARTIAL / DELAYED
//
// The assessment is a pure function of already-approved/contextual
// factors only -- never a new player attribute, ATI/TI, or morale/
// psychology system:
//   - Tactical Familiarity (TeamTacticalProfile's own existing field,
//     the SAME CapabilityLevel vocabulary tactical-domain already uses
//     for h2TacticalFamiliarity in tacticalMatchAdjustment.ts)
//   - instruction complexity (how many of the 3 TeamTacticalProfile
//     fields the instruction actually asks to change -- 0 fields is
//     trivial, 3 is a full tactical overhaul)
//   - delivery mode (SIDELINE vs TIMEOUT vs HALFTIME -- each gives the
//     team progressively more attention/time, so it improves DELIVERY
//     RELIABILITY only, never the tactical adjustment's own magnitude;
//     that stays exactly what tacticalMatchAdjustment.ts already
//     computes)
//   - how many other tactical changes (instructions, shouts, 7v6
//     switches -- anything issued through useLiveMatch.ts) happened
//     recently, as a simple recency count within one fixed window
//
// SCOPE (Spec: "smallest extension"): applied to the permanent
// TeamTacticalProfile instruction and to 7v6's ON/OFF switch -- both
// are genuine "instructions" with a real multi-step splice already.
// Sideline shouts (HM-COACHING-0.2) are deliberately left OUT of this
// assessment: they were designed as a fast, minimal, single-field,
// self-expiring "quick call," and layering a situational assessment
// onto them would blur the shout/instruction distinction that
// milestone established rather than shrink this one's diff. Shouts
// still COUNT toward the recent-change pressure other instructions are
// assessed against (spamming shouts is still "recent tactical change"
// pressure on the team), even though they aren't assessed themselves.
//
// PARTIAL only ever applies to the profile instruction (its 3 fields
// give a genuine "some landed, some didn't" outcome to model); a
// single-unit change (7v6's own ON/OFF) can only ever be FULL or
// DELAYED -- there is nothing to partially adopt.
//
// HM-TACTICS-0.9 reuses this exact same `assessImplementation` for two
// more things, both still single-unit (FULL/DELAYED only): halftime
// instructions (a third delivery mode, see tacticalInstruction.ts) and
// the opponent's own adaptation (career/opponentAdaptation.ts) -- the
// opponent "deciding" whether its own reaction lands cleanly or takes
// longer is the same kind of situational assessment, not a new concept.
//
// All numeric calibration below is PROVISIONAL and ISOLATED to this
// file, exactly like tacticalMatchAdjustment.ts's own OUTCOME_ATTACK_
// SCORE table -- never a real-world claim, never duplicated elsewhere.
import { createRng, type Rng } from "@handball-manager/game-simulation";
import type { InstructionDeliveryMode } from "./tacticalInstruction";
import type { CapabilityLevel, TeamTacticalProfile } from "../career/teamTacticalProfile";

export type ImplementationOutcome = "FULL" | "PARTIAL" | "DELAYED";

/** PROVISIONAL: how many simulated match minutes a DELAYED outcome adds on top of the normal (sideline/timeout) delay. A single fixed bump, not a sampled magnitude -- keeps the calibration surface small. */
export const IMPLEMENTATION_DELAY_EXTENSION_MINUTES = 2;

/** PROVISIONAL: the window (in simulated match minutes) "recent" tactical changes are counted over. */
export const RECENT_CHANGE_WINDOW_MINUTES = 8;

/** PROVISIONAL: extra recent changes beyond this stop making things worse -- a bounded, not unlimited, penalty (Spec: directional, never a runaway spiral). */
const MAX_RECENT_CHANGE_PENALTY_STEPS = 4;

// ---------------------------------------------------------------------
// PROVISIONAL, isolated scoring table. Every figure below is a small
// technical weight, not a claim about real coaching psychology.
// ---------------------------------------------------------------------
const FAMILIARITY_SCORE: Record<CapabilityLevel, number> = { LOW: -0.3, MEDIUM: 0, HIGH: 0.3 };
/**
 * HM-TACTICS-0.9: HALFTIME scores strictly better than TIMEOUT -- a
 * proper sit-down team talk with the whole break to work with beats a
 * hurried 60-second stoppage. Still delivery RELIABILITY only, never
 * the tactical adjustment's own magnitude (see tacticalInstruction.ts's
 * module doc).
 */
const DELIVERY_SCORE: Record<InstructionDeliveryMode, number> = { SIDELINE: 0, TIMEOUT: 0.25, HALFTIME: 0.4 };
const COMPLEXITY_PENALTY_PER_EXTRA_FIELD = 0.15;
const RECENT_CHANGE_PENALTY_PER_CHANGE = 0.12;

const BASE_FULL_PROBABILITY = 0.55;
const MIN_FULL_PROBABILITY = 0.15;
const MAX_FULL_PROBABILITY = 0.85;
const BASE_DELAYED_PROBABILITY = 0.25;
const DELAYED_PROBABILITY_SENSITIVITY = 0.5;
const MIN_DELAYED_PROBABILITY = 0.05;
const MAX_DELAYED_PROBABILITY = 0.5;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export interface ImplementationContext {
  /** The manager's TeamTacticalProfile.tacticalFamiliarity in effect when the change was issued. */
  tacticalFamiliarity: CapabilityLevel;
  deliveryMode: InstructionDeliveryMode;
  /** How many of the instruction's "units" (TeamTacticalProfile fields, or 1 for a single-unit switch like 7v6) are actually being changed. */
  changedUnitCount: number;
  /** Other tactical changes issued within RECENT_CHANGE_WINDOW_MINUTES before this one (see useLiveMatch.ts's recent-issuance tracking). */
  recentChangeCount: number;
}

export interface ImplementationAssessment {
  outcome: ImplementationOutcome;
  /** Length equals `context.changedUnitCount`. All `true` unless outcome is PARTIAL (in which case at least one, but not all, are true -- see selectPartialMask). FULL and DELAYED both eventually apply every requested unit; only PARTIAL leaves some behind. */
  adoptedUnitMask: boolean[];
}

/**
 * Deterministic: the same `seed` and `context` always produce the same
 * assessment (Spec: "same seed + same context + same instruction
 * timing = same implementation result"). The seed is expected to be
 * derived from the fixture's own result seed plus the instruction's
 * issued minute/delivery mode/kind (see useLiveMatch.ts's call sites) --
 * this function itself has no notion of "which match" it's in.
 */
export function assessImplementation(seed: number, context: ImplementationContext): ImplementationAssessment {
  const rng = createRng(seed);

  const familiarityScore = FAMILIARITY_SCORE[context.tacticalFamiliarity];
  const deliveryScore = DELIVERY_SCORE[context.deliveryMode];
  const complexityPenalty = Math.max(0, context.changedUnitCount - 1) * COMPLEXITY_PENALTY_PER_EXTRA_FIELD;
  const recentChangePenalty = Math.min(context.recentChangeCount, MAX_RECENT_CHANGE_PENALTY_STEPS) * RECENT_CHANGE_PENALTY_PER_CHANGE;

  const qualityScore = familiarityScore + deliveryScore - complexityPenalty - recentChangePenalty;

  const pFull = clamp(BASE_FULL_PROBABILITY + qualityScore, MIN_FULL_PROBABILITY, MAX_FULL_PROBABILITY);
  const pDelayed = clamp(BASE_DELAYED_PROBABILITY - qualityScore * DELAYED_PROBABILITY_SENSITIVITY, MIN_DELAYED_PROBABILITY, MAX_DELAYED_PROBABILITY);
  const canPartial = context.changedUnitCount > 1;
  const pPartialRaw = canPartial ? Math.max(0, 1 - pFull - pDelayed) : 0;
  const total = pFull + pDelayed + pPartialRaw;

  const roll = rng.nextFloat();
  let outcome: ImplementationOutcome;
  if (roll < pFull / total) {
    outcome = "FULL";
  } else if (roll < (pFull + pPartialRaw) / total) {
    outcome = "PARTIAL";
  } else {
    outcome = "DELAYED";
  }

  const adoptedUnitMask =
    outcome === "PARTIAL" ? selectPartialMask(rng, context.changedUnitCount) : new Array(context.changedUnitCount).fill(true);

  return { outcome, adoptedUnitMask };
}

/** Fisher-Yates-shuffle-and-keep-a-prefix (the same shuffle technique matchEngine.ts's buildEventTimeline already uses), guaranteeing at least one unit lands and at least one doesn't -- otherwise this would just be FULL or a full miss, not a genuine partial. */
function selectPartialMask(rng: Rng, unitCount: number): boolean[] {
  const keepCount = rng.nextInt(1, unitCount - 1);
  const indices = Array.from({ length: unitCount }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const mask = new Array(unitCount).fill(false);
  for (let i = 0; i < keepCount; i += 1) {
    mask[indices[i]] = true;
  }
  return mask;
}

/** Fixed, deterministic field order -- both this and applyProfileMask below must agree on it. */
export const PROFILE_FIELD_ORDER: readonly (keyof TeamTacticalProfile)[] = ["ati001UsageTendency", "h2ResponsePreference", "tacticalFamiliarity"];

/** Which of the 3 TeamTacticalProfile fields does `requested` actually ask to change, relative to `baseline`? */
export function changedProfileFields(baseline: TeamTacticalProfile, requested: TeamTacticalProfile): (keyof TeamTacticalProfile)[] {
  return PROFILE_FIELD_ORDER.filter((field) => baseline[field] !== requested[field]);
}

/** Applies an assessment's `adoptedUnitMask` to a set of changed fields: masked-in fields take the requested value, masked-out fields keep the baseline's. For FULL/DELAYED (mask all-true) this is exactly `requested`; for PARTIAL, a genuine mix. */
export function applyProfileMask(
  baseline: TeamTacticalProfile,
  requested: TeamTacticalProfile,
  changedFields: readonly (keyof TeamTacticalProfile)[],
  adoptedUnitMask: readonly boolean[],
): TeamTacticalProfile {
  const result: TeamTacticalProfile = { ...baseline };
  changedFields.forEach((field, i) => {
    if (!adoptedUnitMask[i]) {
      return;
    }
    switch (field) {
      case "ati001UsageTendency":
        result.ati001UsageTendency = requested.ati001UsageTendency;
        break;
      case "h2ResponsePreference":
        result.h2ResponsePreference = requested.h2ResponsePreference;
        break;
      case "tacticalFamiliarity":
        result.tacticalFamiliarity = requested.tacticalFamiliarity;
        break;
    }
  });
  return result;
}
