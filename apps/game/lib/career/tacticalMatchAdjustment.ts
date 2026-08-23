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
import { defaultTeamTacticalProfile, PROVISIONAL_NEUTRAL_CAPABILITY, type TeamTacticalProfile } from "./teamTacticalProfile";
import type { OpponentAdaptationEffect } from "./opponentAdaptation";
import type { SevenVSixPolicyLevel } from "../matchPlan/types";

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
 * HM-MATCH-RATINGS-0.1 Part K: MatchPlan's PRE-MATCH `SevenVSixPolicy`
 * (lib/matchPlan/types.ts -- how readily the coach intends to use 7v6
 * over the course of the match) is a coarser signal than the live,
 * minute-by-minute `sevenVSixActive` toggle above, so it does not simply
 * flip the same flat bonus/risk figures fully on. Instead it scales
 * them by how much of the match the policy implies the extra attacker
 * will actually be on the court -- NEVER an exact activation-minute
 * simulation (explicitly out of scope), just a bounded fraction of the
 * existing, already-approved flat bonus/risk pair. NEVER touches
 * lib/liveMatch/sevenVSixMode.ts's live mechanics -- this is read only
 * by the PRE-MATCH full-game simulation call (matchdayAction.ts/
 * calendar.ts), never by tacticalMidMatchChange.ts's live segment
 * re-simulation.
 */
const SEVEN_V_SIX_POLICY_INTENSITY: Record<SevenVSixPolicyLevel, number> = {
  NEVER: 0,
  SITUATIONAL: 0.25,
  FREQUENT: 0.55,
  PRIMARY: 0.9,
};

export function sevenVSixPolicyIntensity(level: SevenVSixPolicyLevel): number {
  return SEVEN_V_SIX_POLICY_INTENSITY[level];
}

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
 * Direction 1 (Spec #6): the manager's team attacks (V9/M6) against the
 * opponent's defence (H2/H3). Only `ati001UsageTendency` comes from the
 * manager's profile. `sevenVSixActive` (HM-TACTICS-0.8) bumps
 * `opportunityQuality` (LOW/MEDIUM/HIGH/CLEAR) from MEDIUM to HIGH and
 * `opportunityWindow` (SHORT/MEDIUM/SUSTAINED) from MEDIUM to
 * SUSTAINED -- the one existing tactical-domain dimension a numbers-up
 * attack can honestly claim to improve (Spec: "increased access/
 * advantage potential where existing Tactical Domain can support it"),
 * rather than inventing a new one.
 *
 * HM-IDENTITY-0.3: `opponentProfile` (optional, default null) fills the
 * opponent's own h2TacticalIntent/h2TacticalFamiliarity from their real
 * AI-derived TeamTacticalProfile when the caller has one (see
 * career/aiTacticalPreferences.ts) -- replacing the previously
 * hardcoded NEUTRAL placeholders these two fields always used. When
 * null (every pre-HM-IDENTITY-0.3 call site, and any future call site
 * that still has no opponent identity resolved), behavior is
 * byte-identical to before this milestone.
 */
function buildAttackConfig(profile: TeamTacticalProfile, sevenVSixActive: boolean, opponentProfile: TeamTacticalProfile | null): ATI001ProbabilisticConfig {
  return {
    threatCreationTendency: usageTendencyToSymbolicModifier(profile.ati001UsageTendency),
    h2TacticalIntent: opponentProfile?.h2ResponsePreference ?? "H2_STEPS", // the opponent's own defensive intent when known, else the same neutral default a fresh profile itself uses
    h2ResponseIntentStrength: "NEUTRAL",
    h2TacticalFamiliarity: opponentProfile?.tacticalFamiliarity ?? PROVISIONAL_NEUTRAL_CAPABILITY,
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

/**
 * Direction 2 (Spec #6): the opponent attacks (V9/M6) against the
 * manager's team defence (H2/H3). `h2ResponsePreference` and
 * `tacticalFamiliarity` come from the manager's profile.
 *
 * HM-IDENTITY-0.3: `opponentProfile` fills `threatCreationTendency` from
 * the opponent's own real `ati001UsageTendency` when known, replacing
 * the previously hardcoded NEUTRAL threat assumption -- null preserves
 * the exact prior behavior.
 */
function buildDefenseConfig(profile: TeamTacticalProfile, opponentProfile: TeamTacticalProfile | null): ATI001ProbabilisticConfig {
  return {
    threatCreationTendency: opponentProfile ? usageTendencyToSymbolicModifier(opponentProfile.ati001UsageTendency) : "NEUTRAL",
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
  /** HM-IDENTITY-0.3: the AI-derived opponent profile actually used, or null when none was supplied (NEUTRAL opponent assumption, pre-HM-IDENTITY-0.3 behavior). */
  opponentProfile: TeamTacticalProfile | null;
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
 * sevenVSixActive, opponentAdaptation) always produces the same result
 * (Spec #12), since the Monte Carlo seed is derived only from those
 * inputs.
 *
 * `sevenVSixActive` (HM-TACTICS-0.8, default false so every pre-
 * HM-TACTICS-0.8 call site is unaffected) layers the flat, isolated
 * 7v6 offensive bonus/opponent risk bonus on top of this same profile-
 * driven adjustment -- see the constants' doc comments above for why
 * this is flat rather than Monte Carlo-sampled, and why it gets its
 * own wider bound.
 *
 * `opponentAdaptation` (HM-TACTICS-0.9, default null) DAMPENS -- never
 * adds to -- exactly one of the two existing bonus channels above,
 * once the opponent has noticed a sustained pattern (see
 * opponentAdaptation.ts): ATI001_HIGH dampens the profile-driven
 * attack bonus (the opponent's defence has adjusted to the V9/M6
 * pattern); SEVEN_V_SIX dampens only the flat opponent-risk bonus (the
 * opponent has tightened up against the exposed net), never the
 * manager's own numerical-superiority bonus, which is a fact of
 * headcount the opponent's own adaptation cannot undo.
 *
 * `opponentProfile` (HM-IDENTITY-0.3, default null) is the AI-derived
 * TeamTacticalProfile for the opponent club (see
 * career/aiTacticalPreferences.ts), when the caller has resolved one --
 * it replaces the previously hardcoded NEUTRAL opponent assumption in
 * both directions with the opponent's own real identity-derived
 * tendencies. Every call site that omits it (or passes null) behaves
 * exactly as it did before this milestone -- this never changes the
 * manager's own profile or any manager-controlled tactic.
 *
 * `sevenVSixIntensity` (HM-MATCH-RATINGS-0.1, default 1 = the full
 * original flat bonus/risk magnitude) scales ONLY the flat 7v6 bonus/
 * risk figures. Every pre-HM-MATCH-RATINGS-0.1 call site omits it and
 * gets byte-identical behavior to before this milestone. Pass
 * `sevenVSixPolicyIntensity(policy.level)` for a MatchPlan-derived
 * pre-match call (Part K); the existing live mid-match `sevenVSixActive`
 * toggle keeps meaning "fully active right now" (its own call site
 * never passes this parameter).
 */
export function computeTacticalMatchAdjustment(
  saveSeed: string,
  fixtureId: string,
  managerClubId: string,
  homeClubId: string,
  profile: TeamTacticalProfile,
  sevenVSixActive = false,
  opponentAdaptation: OpponentAdaptationEffect | null = null,
  opponentProfile: TeamTacticalProfile | null = null,
  sevenVSixIntensity = 1,
): TacticalMatchAdjustment {
  const managerIsHome = homeClubId === managerClubId;

  const attackResult = runMonteCarlo(buildAttackConfig(profile, sevenVSixActive, opponentProfile), {
    seed: `${saveSeed}:${fixtureId}:ati001:attack${sevenVSixActive ? ":7v6" : ""}`,
    runs: MONTE_CARLO_RUNS,
  });
  const defenseResult = runMonteCarlo(buildDefenseConfig(profile, opponentProfile), { seed: `${saveSeed}:${fixtureId}:ati001:defense`, runs: MONTE_CARLO_RUNS });

  const attackScore = averageOutcomeScore(attackResult.outcomeCounts, attackResult.runs);
  const defenseScore = averageOutcomeScore(defenseResult.outcomeCounts, defenseResult.runs);

  const clamp = (n: number) => Math.max(-MAX_TACTICAL_ADJUSTMENT_GOALS, Math.min(MAX_TACTICAL_ADJUSTMENT_GOALS, n));
  const clampSevenVSix = (n: number) => Math.max(-MAX_SEVEN_V_SIX_ADJUSTMENT_GOALS, Math.min(MAX_SEVEN_V_SIX_ADJUSTMENT_GOALS, n));

  // Direction 1 (attack): bumps the MANAGER's own expected goals.
  // Positive attackScore = favors the attacking side = the manager here.
  const rawAttackAdjustment = clamp(attackScore * MAX_TACTICAL_ADJUSTMENT_GOALS);
  const baseAttackAdjustment =
    opponentAdaptation?.trigger === "ATI001_HIGH" ? rawAttackAdjustment * (1 - opponentAdaptation.dampeningFraction) : rawAttackAdjustment;
  // Direction 2 (defense): buildDefenseConfig models the OPPONENT as the
  // attacker and the manager as the defender, so OUTCOME_ATTACK_SCORE's
  // "positive favors the attacker" already means "positive favors the
  // OPPONENT's own expected goals" here -- no sign flip. A manager
  // defensive profile that shifts outcomes toward TURNOVER/
  // PRESSURED_SOLUTION (negative scores) correctly REDUCES the
  // opponent's expected goals.
  const baseOpponentAdjustment = clamp(defenseScore * MAX_TACTICAL_ADJUSTMENT_GOALS);

  const scaledOffensiveBonus = SEVEN_V_SIX_OFFENSIVE_BONUS_GOALS * sevenVSixIntensity;
  const sevenVSixRiskBonus = (opponentAdaptation?.trigger === "SEVEN_V_SIX" ? SEVEN_V_SIX_OPPONENT_RISK_BONUS_GOALS * (1 - opponentAdaptation.dampeningFraction) : SEVEN_V_SIX_OPPONENT_RISK_BONUS_GOALS) * sevenVSixIntensity;

  const attackAdjustment = sevenVSixActive ? clampSevenVSix(baseAttackAdjustment + scaledOffensiveBonus) : baseAttackAdjustment;
  const opponentAdjustment = sevenVSixActive ? clampSevenVSix(baseOpponentAdjustment + sevenVSixRiskBonus) : baseOpponentAdjustment;

  const home = managerIsHome ? attackAdjustment : opponentAdjustment;
  const away = managerIsHome ? opponentAdjustment : attackAdjustment;

  return {
    home,
    away,
    trace: {
      managerClubId,
      managerIsHome,
      profile,
      opponentProfile,
      attack: { outcomeCounts: attackResult.outcomeCounts, score: attackScore, adjustment: attackAdjustment },
      defense: { outcomeCounts: defenseResult.outcomeCounts, score: defenseScore, adjustment: opponentAdjustment },
    },
  };
}

/**
 * HM-TACTICS-0.10: symmetric two-sided tactical adjustment for an
 * AI-vs-AI fixture (no manager involved on either side). Reuses
 * computeTacticalMatchAdjustment's own two-direction mechanism verbatim
 * -- no new function body, no new tactical-domain concept -- by simply
 * treating the home club as the "profile" side (managerClubId :=
 * homeClubId, so managerIsHome is always true): the home club's own
 * ati001UsageTendency attacks against the away club's
 * h2ResponsePreference/tacticalFamiliarity (direction 1, same as
 * before), and the away club's own ati001UsageTendency attacks against
 * the home club's h2ResponsePreference/tacticalFamiliarity (direction
 * 2, "opponentProfile"). sevenVSixActive and opponentAdaptation are
 * always false/null -- both are manager-only, in-match mechanics with
 * no AI-vs-AI equivalent.
 *
 * Returns `undefined` (skip the adjustment entirely -- byte-identical
 * to pre-HM-TACTICS-0.10 AI-vs-AI behavior, which never computed a
 * tactical adjustment at all) when NEITHER club has a real AI-derived
 * profile in `aiTacticalPreferences`. Running the Monte Carlo sampler
 * for a fixture where both sides would resolve to the exact same
 * designed-neutral default config (MEDIUM/H2_STEPS/MEDIUM) has zero
 * honest effect and is pure overhead across an entire league's
 * AI-vs-AI schedule -- this is the "missing/unknown identity -> safe
 * neutral fallback" rule applied at the whole-fixture level, on top of
 * the fallback the adapter itself already applies at the per-claim
 * level (see career/aiTacticalPreferences.ts). When only ONE side has
 * a real profile, the other side gets the same designed-neutral
 * default a fresh manager career's own TeamTacticalProfile already
 * uses -- not a special case, the same neutral baseline this codebase
 * already relies on elsewhere.
 */
export function computeAiVsAiTacticalAdjustment(
  saveSeed: string,
  fixtureId: string,
  homeClubId: string,
  awayClubId: string,
  aiTacticalPreferences: Record<string, TeamTacticalProfile>,
): TacticalMatchAdjustment | undefined {
  const homeProfile = aiTacticalPreferences[homeClubId] ?? null;
  const awayProfile = aiTacticalPreferences[awayClubId] ?? null;
  if (!homeProfile && !awayProfile) {
    return undefined;
  }
  return computeTacticalMatchAdjustment(
    saveSeed,
    fixtureId,
    homeClubId,
    homeClubId,
    homeProfile ?? defaultTeamTacticalProfile(),
    false,
    null,
    awayProfile ?? defaultTeamTacticalProfile(),
  );
}
