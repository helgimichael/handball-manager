// HM-TACTICS-0.6B: the ONE isolated adapter converting an aggregate
// ATI-001 x TI-001 tactical-domain sample into a small, bounded
// expected-goals nudge for the Fast Match Engine.
//
//   TeamTacticalProfile
//         -> tactical-domain resolver (Monte Carlo, aggregate)
//         -> outcome-count distribution
//         -> ONE provisional numeric scoring table (this file only)
//         -> bounded expected-goals adjustment
//         -> game-simulation's homeTacticalAdjustment/awayTacticalAdjustment
//
// This is NOT a per-attack engine (Spec #2): Fast Match still samples
// one Gaussian total per team per match. The tactical sample is a
// PRE-MATCH aggregate, run once per fixture, exactly like reading a
// club's strength rating once before the match. Nothing here is
// handball truth (Spec #8) -- the outcome->score table is a technical
// convenience isolated to this one file, never presented to the player.
//
// tactical-domain's own resolver/types/calibration are untouched;
// game-simulation never imports tactical-domain (only this file does),
// preserving the "neither system owns the other" boundary from the
// HM-TACTICS-0.6 audit.
import {
  runMonteCarlo,
  type ATI001ProbabilisticConfig,
  type CapabilityLevel,
  type CapabilityProfile,
  type SymbolicModifier,
  type TacticalOutcome,
} from "@handball-manager/tactical-domain";
import { PROVISIONAL_NEUTRAL_CAPABILITY, type TeamTacticalProfile } from "./teamTacticalProfile";

/** Runs per direction, per fixture. Cheap pure computation (no I/O) -- 200 is enough for a stable directional signal without claiming statistical realism (Spec #13: "tests must NOT claim realistic percentages"). */
const MONTE_CARLO_RUNS = 200;

/**
 * The maximum magnitude, in the same "expected goals" units as
 * SimulateMatchInput's existing homeFormAdjustment, this adjustment may
 * ever reach in either direction. Deliberately small relative to
 * BASE_EXPECTED_GOALS (26) and HOME_ADVANTAGE_GOALS (1.4) in
 * matchEngine.ts -- a tactical profile can meaningfully nudge a result,
 * it cannot decide one. Provisional/technical, not a handball claim.
 */
const MAX_TACTICAL_ADJUSTMENT_GOALS = 1.2;

/**
 * HM-TACTICS-0.8: 7v6 (pulling the goalkeeper for an extra outfield
 * attacker) is deliberately a bigger risk/reward lever than a normal
 * tactical-profile nudge, so it gets its own, separately calibrated,
 * still small and provisional bound -- never silently reusing the
 * normal ±1.2 ceiling for what is meant to be a larger swing.
 */
const MAX_SEVEN_V_SIX_ADJUSTMENT_GOALS = 2.4;

/**
 * PROVISIONAL, isolated flat bonus/risk figures for 7v6 (Spec: "keep
 * all numeric risk/reward calibration isolated and explicitly
 * provisional"; "no real-world probability claims"). Numerical
 * superiority (7 attackers vs 6 defenders) is not itself an
 * ATI-001/TI-001 concept, so unlike the profile-driven adjustment
 * above, this is not sampled from tactical-domain's own Monte Carlo --
 * it is a separate, flat, bounded additive expected-goals nudge, added
 * on top of (never instead of) the existing adjustment, using the
 * exact same channel (SimulateMatchInput's homeTacticalAdjustment/
 * awayTacticalAdjustment) every other tactical integration in this
 * project already uses.
 *
 * OFFENSIVE upside: the manager's own side gets an extra attacker.
 * DEFENSIVE/turnover downside: this is NOT literally scaled by the
 * segment's own sampled turnover count -- turnovers are sampled
 * independently in matchEngine.ts's buildTeamStats with no adjustment
 * lever tied to TeamTacticalProfile (the same limitation HM-COACHING-
 * 0.2's own audit found for a turnover-based shout). A flat, bounded
 * proxy for the real handball risk an empty net creates is the most
 * honest thing achievable here without inventing a new mechanism --
 * see tacticalMidMatchChange.ts's module doc for why a distinct
 * EMPTY_GOAL event type is not implemented either, for the same reason.
 */
const SEVEN_V_SIX_OFFENSIVE_BONUS_GOALS = 0.8;
const SEVEN_V_SIX_OPPONENT_RISK_BONUS_GOALS = 0.6;

/**
 * The one-and-only outcome -> attack-favorability score table (Spec #8:
 * "keep it isolated and documented"). Range [-1, 1]; +1 = cleanly
 * favors the attacking side (V9/M6), -1 = cleanly favors the defending
 * side (H2/H3). Provisional and technical only -- never a claim about
 * real handball outcome value, and never duplicated anywhere else.
 */
const OUTCOME_ATTACK_SCORE: Record<TacticalOutcome, number> = {
  NO_ADVANTAGE: -1,
  CONTINUE_PLAY: 0,
  RESET_ATTACK: -0.6,
  "9M_ATTACK_CONTINUES": 0.5,
  RELATIONSHIP_CHANGED: -0.4,
  NEXT_INTERACTION_AVAILABLE: 0.3,
  TURNOVER: -0.8,
  PRESSURED_SOLUTION: -0.4,
  PIVOT_ACCESS: 1,
};

const NEUTRAL_CAPABILITY_PROFILE: CapabilityProfile = {
  perceive: PROVISIONAL_NEUTRAL_CAPABILITY,
  time: PROVISIONAL_NEUTRAL_CAPABILITY,
  execute: PROVISIONAL_NEUTRAL_CAPABILITY,
  recover: PROVISIONAL_NEUTRAL_CAPABILITY,
};

/** Bible S83: LOW/MEDIUM/HIGH usage tendency expressed as the resolver's own symbolic modifier vocabulary. MEDIUM maps to NEUTRAL (no shaping), matching PROVISIONAL_NEUTRAL_CAPABILITY's own "no-op" choice. */
function usageTendencyToSymbolicModifier(level: CapabilityLevel): SymbolicModifier {
  if (level === "LOW") return "DECREASE";
  if (level === "HIGH") return "INCREASE";
  return "NEUTRAL";
}

function averageOutcomeScore(outcomeCounts: Partial<Record<TacticalOutcome, number>>, totalRuns: number): number {
  let sum = 0;
  for (const [outcome, count] of Object.entries(outcomeCounts) as [TacticalOutcome, number][]) {
    sum += OUTCOME_ATTACK_SCORE[outcome] * count;
  }
  return totalRuns > 0 ? sum / totalRuns : 0;
}

/**
 * Direction 1 (Spec #6): the manager's team attacks (V9/M6) against a
 * neutral opponent defence (H2/H3). Only `ati001UsageTendency` comes
 * from the manager's profile. `sevenVSixActive` (HM-TACTICS-0.8) bumps
 * `opportunityQuality` (LOW/MEDIUM/HIGH/CLEAR) from MEDIUM to HIGH and
 * `opportunityWindow` (SHORT/MEDIUM/SUSTAINED) from MEDIUM to
 * SUSTAINED -- the one existing tactical-domain dimension a numbers-up
 * attack can honestly claim to improve (Spec: "increased access/
 * advantage potential where existing Tactical Domain can support it"),
 * rather than inventing a new one.
 */
function buildAttackConfig(profile: TeamTacticalProfile, sevenVSixActive: boolean): ATI001ProbabilisticConfig {
  return {
    threatCreationTendency: usageTendencyToSymbolicModifier(profile.ati001UsageTendency),
    h2TacticalIntent: "H2_STEPS", // neutral opponent defensive intent -- the same default a fresh profile itself uses
    h2ResponseIntentStrength: "NEUTRAL",
    h2TacticalFamiliarity: PROVISIONAL_NEUTRAL_CAPABILITY,
    h2Capability: NEUTRAL_CAPABILITY_PROFILE,
    h3Capability: NEUTRAL_CAPABILITY_PROFILE,
    h2h3TacticalFamiliarity: PROVISIONAL_NEUTRAL_CAPABILITY,
    h2h3RelationshipQuality: PROVISIONAL_NEUTRAL_CAPABILITY,
    opportunityQuality: sevenVSixActive ? "HIGH" : "MEDIUM",
    opportunityWindow: sevenVSixActive ? "SUSTAINED" : "MEDIUM",
    v9RecognitionCapability: PROVISIONAL_NEUTRAL_CAPABILITY,
    m6RecognitionCapability: PROVISIONAL_NEUTRAL_CAPABILITY,
    v9m6RelationshipQuality: PROVISIONAL_NEUTRAL_CAPABILITY,
    v9m6TacticalFamiliarity: PROVISIONAL_NEUTRAL_CAPABILITY,
    decisionQualityTendency: "NEUTRAL",
    exploitationCapability: {
      passer: PROVISIONAL_NEUTRAL_CAPABILITY,
      receiver: PROVISIONAL_NEUTRAL_CAPABILITY,
      sharedTiming: PROVISIONAL_NEUTRAL_CAPABILITY,
    },
    postResponseAdvantageTendency: "NEUTRAL",
  };
}

/** Direction 2 (Spec #6): a neutral opponent attacks (V9/M6) against the manager's team defence (H2/H3). `h2ResponsePreference` and `tacticalFamiliarity` come from the manager's profile. */
function buildDefenseConfig(profile: TeamTacticalProfile): ATI001ProbabilisticConfig {
  return {
    threatCreationTendency: "NEUTRAL",
    h2TacticalIntent: profile.h2ResponsePreference,
    h2ResponseIntentStrength: "NEUTRAL",
    h2TacticalFamiliarity: profile.tacticalFamiliarity,
    h2Capability: NEUTRAL_CAPABILITY_PROFILE,
    h3Capability: NEUTRAL_CAPABILITY_PROFILE,
    // Minimal-scope simplification, documented here: the profile holds
    // one team-level tacticalFamiliarity scalar, reused for both the
    // individual H2 dimension above and the H2<->H3 collective
    // dimension below, rather than splitting into the two Bible-
    // distinct-but-not-yet-separately-input concepts.
    h2h3TacticalFamiliarity: profile.tacticalFamiliarity,
    h2h3RelationshipQuality: PROVISIONAL_NEUTRAL_CAPABILITY,
    opportunityQuality: "MEDIUM",
    opportunityWindow: "MEDIUM",
    v9RecognitionCapability: PROVISIONAL_NEUTRAL_CAPABILITY,
    m6RecognitionCapability: PROVISIONAL_NEUTRAL_CAPABILITY,
    v9m6RelationshipQuality: PROVISIONAL_NEUTRAL_CAPABILITY,
    v9m6TacticalFamiliarity: PROVISIONAL_NEUTRAL_CAPABILITY,
    decisionQualityTendency: "NEUTRAL",
    exploitationCapability: {
      passer: PROVISIONAL_NEUTRAL_CAPABILITY,
      receiver: PROVISIONAL_NEUTRAL_CAPABILITY,
      sharedTiming: PROVISIONAL_NEUTRAL_CAPABILITY,
    },
    postResponseAdvantageTendency: "NEUTRAL",
  };
}

export interface TacticalDirectionTrace {
  outcomeCounts: Partial<Record<TacticalOutcome, number>>;
  score: number;
  adjustment: number;
}

/** Small debug/trace result proving the full causal chain (Spec: "add a small tactical integration trace/debug result if needed"). Never shown in player-facing UI. */
export interface TacticalMatchAdjustmentTrace {
  managerClubId: string;
  managerIsHome: boolean;
  profile: TeamTacticalProfile;
  attack: TacticalDirectionTrace;
  defense: TacticalDirectionTrace;
}

export interface TacticalMatchAdjustment {
  home: number;
  away: number;
  trace: TacticalMatchAdjustmentTrace;
}

/**
 * Computes the manager team's tactical adjustment for one fixture.
 * Deterministic: the same (saveSeed, fixtureId, profile,
 * sevenVSixActive) always produces the same result (Spec #12), since
 * the Monte Carlo seed is derived only from those inputs.
 *
 * `sevenVSixActive` (HM-TACTICS-0.8, default false so every pre-
 * HM-TACTICS-0.8 call site is unaffected) layers the flat, isolated
 * 7v6 offensive bonus/opponent risk bonus on top of this same profile-
 * driven adjustment -- see the constants' doc comments above for why
 * this is flat rather than Monte Carlo-sampled, and why it gets its
 * own wider bound.
 */
export function computeTacticalMatchAdjustment(
  saveSeed: string,
  fixtureId: string,
  managerClubId: string,
  homeClubId: string,
  profile: TeamTacticalProfile,
  sevenVSixActive = false,
): TacticalMatchAdjustment {
  const managerIsHome = homeClubId === managerClubId;

  const attackResult = runMonteCarlo(buildAttackConfig(profile, sevenVSixActive), {
    seed: `${saveSeed}:${fixtureId}:ati001:attack${sevenVSixActive ? ":7v6" : ""}`,
    runs: MONTE_CARLO_RUNS,
  });
  const defenseResult = runMonteCarlo(buildDefenseConfig(profile), { seed: `${saveSeed}:${fixtureId}:ati001:defense`, runs: MONTE_CARLO_RUNS });

  const attackScore = averageOutcomeScore(attackResult.outcomeCounts, attackResult.runs);
  const defenseScore = averageOutcomeScore(defenseResult.outcomeCounts, defenseResult.runs);

  const clamp = (n: number) => Math.max(-MAX_TACTICAL_ADJUSTMENT_GOALS, Math.min(MAX_TACTICAL_ADJUSTMENT_GOALS, n));
  const clampSevenVSix = (n: number) => Math.max(-MAX_SEVEN_V_SIX_ADJUSTMENT_GOALS, Math.min(MAX_SEVEN_V_SIX_ADJUSTMENT_GOALS, n));

  // Direction 1 (attack): bumps the MANAGER's own expected goals.
  // Positive attackScore = favors the attacking side = the manager here.
  const baseAttackAdjustment = clamp(attackScore * MAX_TACTICAL_ADJUSTMENT_GOALS);
  // Direction 2 (defense): buildDefenseConfig models the OPPONENT as the
  // attacker and the manager as the defender, so OUTCOME_ATTACK_SCORE's
  // "positive favors the attacker" already means "positive favors the
  // OPPONENT's own expected goals" here -- no sign flip. A manager
  // defensive profile that shifts outcomes toward TURNOVER/
  // PRESSURED_SOLUTION (negative scores) correctly REDUCES the
  // opponent's expected goals.
  const baseOpponentAdjustment = clamp(defenseScore * MAX_TACTICAL_ADJUSTMENT_GOALS);

  const attackAdjustment = sevenVSixActive ? clampSevenVSix(baseAttackAdjustment + SEVEN_V_SIX_OFFENSIVE_BONUS_GOALS) : baseAttackAdjustment;
  const opponentAdjustment = sevenVSixActive ? clampSevenVSix(baseOpponentAdjustment + SEVEN_V_SIX_OPPONENT_RISK_BONUS_GOALS) : baseOpponentAdjustment;

  const home = managerIsHome ? attackAdjustment : opponentAdjustment;
  const away = managerIsHome ? opponentAdjustment : attackAdjustment;

  return {
    home,
    away,
    trace: {
      managerClubId,
      managerIsHome,
      profile,
      attack: { outcomeCounts: attackResult.outcomeCounts, score: attackScore, adjustment: attackAdjustment },
      defense: { outcomeCounts: defenseResult.outcomeCounts, score: defenseScore, adjustment: opponentAdjustment },
    },
  };
}
