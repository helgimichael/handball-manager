// HM-TACTICS-1.3: the ONE isolated adapter that makes MatchPlan's
// AttackPlanConfig/DefencePlanConfig/TransitionPlanConfig tactical
// choices measurably affect a match, WITHOUT double-counting player
// ratings (HM-MATCH-RATINGS-0.1's playerMatchStrength.ts) or the usage
// engine (HM-MATCH-1.0's matchUsageEngine.ts) -- both already run
// separately and this adapter's own result is summed alongside theirs,
// never merged into either.
//
//   MatchPlan + MatchUsageTrace (exposure) + GameplayPlayerRating[]
//   + opponent's MatchPlan (for the one supported matchup dimension)
//         -> per-dimension TACTICAL FIT (Part "TACTICAL FIT": a small,
//            curated ATTRIBUTE-ONLY family average of the players
//            actually active in the relevant phase -- CA never enters
//            this calculation at all, see "DO NOT DOUBLE COUNT")
//         -> bounded upside/downside per dimension
//         -> a bounded attack/defence bonus per team
//         -> composed exactly like playerMatchStrength.ts's own
//            "own attack bonus minus opponent's defence bonus" pattern
//         -> game-simulation's homeTacticalAdjustment/awayTacticalAdjustment
//            (the SAME existing additive channel every tactical system
//            already uses -- this module never touches ClubStrength,
//            MatchRosterPlayer, or the engine itself)
//
// AUDIT (Part "AUDIT FIRST"): matchEngine.ts's SimulateMatchInput has
// exactly ONE tunable surface beyond ClubStrength/roster -- a single
// additive expected-goals number per side. TeamMatchStats (shots,
// turnovers, twoMinuteSuspensions, saves) are ALL derived procedurally
// from the final goals count inside buildTeamStats, with no separate
// input channel of their own. This means "turnovers", "2-minute
// suspensions", and "shot quality" are NOT independently steerable --
// only "opponent expected scoring" genuinely is. Every "downside" this
// module represents (turnover risk, suspension risk, disruption risk)
// is therefore honestly modelled the same way tacticalMatchAdjustment.
// ts's own 7v6 risk bonus already does: a small, bounded, ADDITIVE nudge
// to the OPPONENT's own expected goals (a proxy for "gives the other
// side more/easier chances"), never a literal separate stat. This is a
// continuation of an already-accepted idiom, not a new one.
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { TeamUsageTrace } from "./matchUsageEngine";
import type { AttackPlanConfig, DefencePlanConfig, IntensityLevel, MatchPlan, TransitionPlanConfig } from "../matchPlan/types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------------------------------------------------------
// TACTICAL FIT: a small, curated attribute-family average of the
// players ACTUALLY ACTIVE in the relevant phase (weighted by their own
// MatchUsageTrace exposure, never by squad presence alone) -- raw
// 1-20 attribute values ONLY, never CA (Part "DO NOT DOUBLE COUNT").
// Centered on the attribute scale's own neutral midpoint (10.5) so a
// team with no data, or exactly average attributes, contributes a
// fitScore of 0 -- neither a bonus nor a penalty.
// ---------------------------------------------------------------------------

function weightedAttributeFit(attrs: readonly string[], ratingsById: ReadonlyMap<string, GameplayPlayerRating>, weightedPlayers: readonly { playerId: string; weight: number }[]): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const { playerId, weight } of weightedPlayers) {
    if (weight <= 0) continue;
    const rating = ratingsById.get(playerId);
    if (!rating) continue;
    const attributes = rating.branch.attributes as Record<string, { value: number } | undefined>;
    let sum = 0;
    let count = 0;
    for (const attr of attrs) {
      const entry = attributes[attr];
      if (entry) {
        sum += entry.value;
        count += 1;
      }
    }
    if (count === 0) continue;
    weightedSum += (sum / count) * weight;
    weightTotal += weight;
  }
  if (weightTotal <= 0) return 0;
  const avg = weightedSum / weightTotal;
  return clamp((avg - 10.5) / 9.5, -1, 1);
}

function activeAttackPlayers(plan: MatchPlan, usageTrace: TeamUsageTrace): { playerId: string; weight: number }[] {
  const exposureById = new Map(usageTrace.players.map((p) => [p.playerId, p.attackExposure]));
  return plan.squad.players.filter((p) => p.position !== "GK").map((p) => ({ playerId: p.playerId, weight: exposureById.get(p.playerId) ?? 0 }));
}

function activeDefencePlayers(plan: MatchPlan, usageTrace: TeamUsageTrace): { playerId: string; weight: number }[] {
  const exposureById = new Map(usageTrace.players.map((p) => [p.playerId, p.defenceExposure]));
  return plan.squad.players.filter((p) => p.position !== "GK").map((p) => ({ playerId: p.playerId, weight: exposureById.get(p.playerId) ?? 0 }));
}

function activeGoalkeeper(usageTrace: TeamUsageTrace): { playerId: string; weight: number }[] {
  return usageTrace.players.filter((p) => p.goalkeeperExposure > 0).map((p) => ({ playerId: p.playerId, weight: p.goalkeeperExposure }));
}

// ---------------------------------------------------------------------------
// A tiny, documented trace entry per dimension -- Part "ADAPTER": "which
// tactical choices contributed, relevant player-fit score, upside,
// downside, final bounded adjustment".
// ---------------------------------------------------------------------------

export interface TacticalDimensionContribution {
  dimension: string;
  active: boolean;
  fitScore: number;
  upside: number;
  downside: number;
}

function contribute(contributions: TacticalDimensionContribution[], dimension: string, active: boolean, fitScore: number, upside: number, downside: number): { upside: number; downside: number } {
  contributions.push({ dimension, active, fitScore, upside, downside });
  return { upside, downside };
}

// ---------------------------------------------------------------------------
// ATTACK (Part "ATTACK"): tactic x relevant player capability -> bounded
// effect, never "M6 focus = automatic +X goals". Only the "engaged" end
// of each dial (HIGH/FREE/FAST/PATIENT/DIRECT) carries an effect --
// MEDIUM/BALANCED/STRUCTURED/SLOW are deliberately left neutral (Part
// "Do NOT force every control to affect every stat").
// ---------------------------------------------------------------------------

const TEMPO_FAST_FIT_ATTRS = ["ACCELERATION", "TOP_SPEED", "DECISION_MAKING", "GAME_READING"];
const STRUCTURE_FREE_FIT_ATTRS = ["PLAYMAKING", "DECISION_MAKING", "ADVANTAGE_RECOGNITION", "TWO_V_TWO_READING"];
const PIVOT_FIT_ATTRS = ["PIVOT_PLAY", "SCREENING", "FINISHING"];
const TWO_V_TWO_FIT_ATTRS = ["TWO_V_TWO_READING", "ADVANTAGE_RECOGNITION"];
const BREAKTHROUGH_FIT_ATTRS = ["BREAKTHROUGH", "ACCELERATION", "EXPLOSIVENESS"];
const SHOOTING_FIT_ATTRS = ["SHOOTING_POWER", "SHOOTING_PLACEMENT", "SHOOTING_VARIETY"];
const WING_FIT_ATTRS = ["WING_FINISHING", "TOP_SPEED"];
const CIRCULATION_PATIENT_FIT_ATTRS = ["PASSING", "TEMPO_CONTROL", "GAME_READING"];
const CIRCULATION_DIRECT_FIT_ATTRS = ["SHOOTING_POWER", "BREAKTHROUGH"];

function attackDimensionEffects(plan: MatchPlan, ratingsById: ReadonlyMap<string, GameplayPlayerRating>, usageTrace: TeamUsageTrace, contributions: TacticalDimensionContribution[]): { upside: number; downside: number } {
  const p: AttackPlanConfig = plan.attackPlan;
  const unit = activeAttackPlayers(plan, usageTrace);
  let upside = 0;
  let downside = 0;

  if (p.tempo === "FAST") {
    const fit = weightedAttributeFit(TEMPO_FAST_FIT_ATTRS, ratingsById, unit);
    const r = contribute(contributions, "tempo:FAST", true, fit, 0.25 * fit, 0.15 * (1 - 0.4 * Math.max(0, fit)));
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "tempo", false, 0, 0, 0);
  }

  if (p.structureFreedom === "FREE") {
    const fit = weightedAttributeFit(STRUCTURE_FREE_FIT_ATTRS, ratingsById, unit);
    const r = contribute(contributions, "structureFreedom:FREE", true, fit, 0.2 * fit, 0.15 * (1 - 0.4 * Math.max(0, fit)));
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "structureFreedom", false, 0, 0, 0);
  }

  if (p.pivotUsage === "HIGH") {
    // Part "ATTACK": "high M6 focus should be more useful when the
    // selected M6/backcourt unit has relevant quality" -- reads the
    // SPECIFIC player in the M6 attack slot, not a team-wide average.
    // A SEVEN_V_SIX unit has no fixed M6 slot; this dimension is then
    // honestly left inert (fitScore 0) rather than guessing a proxy.
    const m6Slot = plan.attackStartingUnit.slots.find((s) => s.position === "M6");
    const m6Player = m6Slot ? [{ playerId: m6Slot.playerId, weight: usageTrace.players.find((t) => t.playerId === m6Slot.playerId)?.attackExposure ?? 0 }] : [];
    const fit = weightedAttributeFit(PIVOT_FIT_ATTRS, ratingsById, m6Player);
    const r = contribute(contributions, "pivotUsage:HIGH", true, fit, 0.3 * fit, 0);
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "pivotUsage", false, 0, 0, 0);
  }

  if (p.twoVTwoEmphasis === "HIGH") {
    const fit = weightedAttributeFit(TWO_V_TWO_FIT_ATTRS, ratingsById, unit);
    const r = contribute(contributions, "twoVTwoEmphasis:HIGH", true, fit, 0.2 * fit, 0);
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "twoVTwoEmphasis", false, 0, 0, 0);
  }

  if (p.breakthroughEmphasis === "HIGH") {
    const fit = weightedAttributeFit(BREAKTHROUGH_FIT_ATTRS, ratingsById, unit);
    const r = contribute(contributions, "breakthroughEmphasis:HIGH", true, fit, 0.2 * fit, 0);
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "breakthroughEmphasis", false, 0, 0, 0);
  }

  if (p.shootingEmphasis === "HIGH") {
    const fit = weightedAttributeFit(SHOOTING_FIT_ATTRS, ratingsById, unit);
    const r = contribute(contributions, "shootingEmphasis:HIGH", true, fit, 0.25 * fit, 0);
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "shootingEmphasis", false, 0, 0, 0);
  }

  if (p.wingUsage === "HIGH") {
    const wingSlots = plan.attackStartingUnit.slots.filter((s) => s.position === "V9" || s.position === "H9");
    const wingPlayers = wingSlots.map((s) => ({ playerId: s.playerId, weight: usageTrace.players.find((t) => t.playerId === s.playerId)?.attackExposure ?? 0 }));
    const fit = weightedAttributeFit(WING_FIT_ATTRS, ratingsById, wingPlayers);
    const r = contribute(contributions, "wingUsage:HIGH", true, fit, 0.2 * fit, 0);
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "wingUsage", false, 0, 0, 0);
  }

  if (p.ballCirculation === "PATIENT") {
    const fit = weightedAttributeFit(CIRCULATION_PATIENT_FIT_ATTRS, ratingsById, unit);
    const r = contribute(contributions, "ballCirculation:PATIENT", true, fit, 0.2 * fit, 0.1 * (1 - 0.4 * Math.max(0, fit)));
    upside += r.upside;
    downside += r.downside;
  } else if (p.ballCirculation === "DIRECT") {
    const fit = weightedAttributeFit(CIRCULATION_DIRECT_FIT_ATTRS, ratingsById, unit);
    const r = contribute(contributions, "ballCirculation:DIRECT", true, fit, 0.2 * fit, 0.2 * (1 - 0.4 * Math.max(0, fit)));
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "ballCirculation", false, 0, 0, 0);
  }

  // sevenVSixPolicy is deliberately NOT re-implemented here -- it
  // already has its own, separately-calibrated, isolated effect
  // (tacticalMatchAdjustment.ts's sevenVSixPolicyIntensity, wired in
  // HM-MATCH-RATINGS-0.1 Part K). Duplicating it here would double-
  // count the exact same MatchPlan field through two channels.

  return { upside, downside };
}

// ---------------------------------------------------------------------------
// DEFENCE (Part "DEFENCE" / "FORMATION"): each dimension's upside
// reduces the OPPONENT's expected goals (the defenceBonus channel,
// composed exactly like playerMatchStrength.ts's own defence value);
// downside nudges the opponent's expected goals back up, honestly
// representing disruption/contact risk through the ONE additive
// channel that exists (see module doc). `riskLevel` is a META dial
// that scales the magnitude of the other risk-carrying dimensions
// (contactIntent, ballOrientedPressure, defensiveDepth:HIGH) rather
// than having an independent effect of its own -- avoiding a redundant
// parallel mechanic for what is explicitly a "how much risk to take"
// control.
// ---------------------------------------------------------------------------

const CONTACT_FIT_ATTRS = ["CONTACT_ABILITY", "CONTACT_BALANCE", "STRENGTH"];
const COVER_BLOCK_FIT_ATTRS = ["SHOT_BLOCKING", "COVERING"];
// AWARENESS lives in the PERCEPTION_DECISION family, not DEFENSIVE -- a legitimate cross-family read for "reads the ball carrier and presses at the right moment", not a defensive-family duplicate.
const PRESSURE_FIT_ATTRS = ["BALL_WINNING", "AWARENESS"];
const DEPTH_HIGH_FIT_ATTRS = ["BALL_WINNING", "COVERING", "LATERAL_DEFENCE"];

const RISK_LEVEL_SCALE: Record<IntensityLevel, number> = { LOW: 0.7, MEDIUM: 1.0, HIGH: 1.3 };

const FORMATION_FIT_ATTRS: Record<string, readonly string[]> = {
  "6-0": ["DEFENSIVE_POSITIONING", "CENTRAL_DEFENCE", "COVERING"],
  "5-1": ["BALL_WINNING", "CONTACT_ABILITY", "LATERAL_DEFENCE"],
  "3-2-1": ["DEFENSIVE_TIMING", "SWITCHING_HANDOVER", "BALL_WINNING"],
  "3-3": ["SWITCHING_HANDOVER", "LATERAL_DEFENCE", "COVERING"],
  "4-2": ["CONTACT_ABILITY", "BALL_WINNING", "SHOT_BLOCKING"],
};

/**
 * Part "FORMATION": the ONE supported matchup dimension -- a small,
 * documented bonus/penalty when the opponent's own attack tempo is
 * FAST, since that is the only opponent attack-style signal this
 * adapter has honest access to (the opponent's own resolved MatchPlan).
 * Richer matchup dimensions (opponent ballCirculation/structureFreedom
 * vs. formation, etc.) are a reported gap, not implemented here (Part
 * "FORMATION": "If opponent attack-style information is insufficient
 * for a meaningful matchup effect, implement only formation-side team
 * behavior now and report the matchup gap").
 */
const FORMATION_VS_FAST_TEMPO_BONUS: Record<string, number> = {
  "6-0": 0,
  "5-1": 0.15,
  "3-2-1": 0.1,
  "3-3": -0.05,
  "4-2": 0.05,
};

function defenceDimensionEffects(
  plan: MatchPlan,
  ratingsById: ReadonlyMap<string, GameplayPlayerRating>,
  usageTrace: TeamUsageTrace,
  opponentPlan: MatchPlan | null,
  contributions: TacticalDimensionContribution[],
): { upside: number; downside: number } {
  const p: DefencePlanConfig = plan.defencePlan;
  const unit = activeDefencePlayers(plan, usageTrace);
  const riskScale = RISK_LEVEL_SCALE[p.riskLevel];
  let upside = 0;
  let downside = 0;

  // Formation: own-unit fit is always evaluated; the opponent-tempo
  // matchup bonus/penalty only applies when the opponent's own
  // AttackPlanConfig is actually known.
  {
    const attrs = FORMATION_FIT_ATTRS[p.baseFormation] ?? FORMATION_FIT_ATTRS["6-0"];
    const fit = weightedAttributeFit(attrs, ratingsById, unit);
    let formationUpside = 0.2 * fit;
    if (opponentPlan?.attackPlan.tempo === "FAST") {
      formationUpside += FORMATION_VS_FAST_TEMPO_BONUS[p.baseFormation] ?? 0;
    }
    const r = contribute(contributions, `baseFormation:${p.baseFormation}`, true, fit, formationUpside, 0);
    upside += r.upside;
    downside += r.downside;
  }

  if (p.defensiveDepth === "HIGH") {
    const fit = weightedAttributeFit(DEPTH_HIGH_FIT_ATTRS, ratingsById, unit);
    const scale = riskScale;
    const r = contribute(contributions, "defensiveDepth:HIGH", true, fit, 0.2 * fit * scale, 0.15 * (1 - 0.4 * Math.max(0, fit)) * scale);
    upside += r.upside;
    downside += r.downside;
  } else if (p.defensiveDepth === "DEEP") {
    // A safer, low-variance baseline -- a small guaranteed reduction, no fit-scaling, no risk scaling (deliberately the "cautious" option).
    const r = contribute(contributions, "defensiveDepth:DEEP", true, 0, 0.1, 0);
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "defensiveDepth", false, 0, 0, 0);
  }

  if (p.contactIntent === "HIGH") {
    const fit = weightedAttributeFit(CONTACT_FIT_ATTRS, ratingsById, unit);
    const scale = riskScale;
    const r = contribute(contributions, "contactIntent:HIGH", true, fit, 0.25 * fit * scale, 0.2 * (1 - 0.4 * Math.max(0, fit)) * scale);
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "contactIntent", false, 0, 0, 0);
  }

  if (p.coverBlockingEmphasis === "HIGH") {
    const fit = weightedAttributeFit(COVER_BLOCK_FIT_ATTRS, ratingsById, unit);
    const r = contribute(contributions, "coverBlockingEmphasis:HIGH", true, fit, 0.2 * fit, 0.05 * (1 - 0.4 * Math.max(0, fit)));
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "coverBlockingEmphasis", false, 0, 0, 0);
  }

  if (p.ballOrientedPressure === "HIGH") {
    const fit = weightedAttributeFit(PRESSURE_FIT_ATTRS, ratingsById, unit);
    const scale = riskScale;
    const r = contribute(contributions, "ballOrientedPressure:HIGH", true, fit, 0.2 * fit * scale, 0.15 * (1 - 0.4 * Math.max(0, fit)) * scale);
    upside += r.upside;
    downside += r.downside;
  } else {
    contribute(contributions, "ballOrientedPressure", false, 0, 0, 0);
  }

  contribute(contributions, `riskLevel:${p.riskLevel}`, p.riskLevel !== "MEDIUM", 0, 0, 0); // diagnostic-only entry documenting the scale meta-dial itself

  return { upside, downside };
}

// ---------------------------------------------------------------------------
// TRANSITION (Part "TRANSITION"): the required trade-off between FAST
// TRANSITION and PRIORITIZING SPECIALIST SUBSTITUTIONS -- a real,
// bounded interaction with HM-MATCH-1.0's own specialistPairCount/
// substitutionPriority, not a cosmetic control.
// ---------------------------------------------------------------------------

const FAST_TRANSITION_FIT_ATTRS = ["TRANSITION_UNDERSTANDING", "ACCELERATION", "GAME_READING"];
const RETREAT_FIT_ATTRS = ["DEFENSIVE_POSITIONING", "DEFENSIVE_TIMING", "REPEAT_SPRINT_ABILITY"];
const GK_INITIATION_FIT_ATTRS = ["OUTLET_PASSING", "RESTART_SPEED", "TRANSITION_DECISION"];

/** Part "TRANSITION": prioritizing specialist substitutions costs some transition fluidity -- a bounded, documented friction factor, never a hard substitution-failure simulation. */
const SPECIALIST_SUBSTITUTION_FRICTION = 0.4;
/** The corresponding upside of prioritizing specialists: their own phase gets a small reliability bonus. */
const SPECIALIST_PRIORITY_BONUS = 0.1;

function transitionDimensionEffects(
  plan: MatchPlan,
  ratingsById: ReadonlyMap<string, GameplayPlayerRating>,
  usageTrace: TeamUsageTrace,
  contributions: TacticalDimensionContribution[],
): { attackUpside: number; attackDownside: number; defenceUpside: number; defenceDownside: number } {
  const p: TransitionPlanConfig = plan.transitionPlan;
  const attackUnit = activeAttackPlayers(plan, usageTrace);
  const defenceUnit = activeDefencePlayers(plan, usageTrace);

  let attackUpside = 0;
  let attackDownside = 0;
  let defenceUpside = 0;
  let defenceDownside = 0;

  const fastTransitionActive = p.offensiveTransitionIntent === "HIGH" || p.firstWaveAggression === "HIGH";
  if (fastTransitionActive) {
    const intensity = (p.offensiveTransitionIntent === "HIGH" ? 1 : 0.5) + (p.firstWaveAggression === "HIGH" ? 1 : 0.5);
    const fit = weightedAttributeFit(FAST_TRANSITION_FIT_ATTRS, ratingsById, attackUnit);

    const hasSpecialistFriction = usageTrace.specialistPairCount > 0 && p.substitutionPriority !== "BALANCED";
    const frictionMultiplier = hasSpecialistFriction ? 1 - SPECIALIST_SUBSTITUTION_FRICTION : 1;

    const baseUpside = 0.15 * intensity * fit;
    const baseDownside = 0.1 * intensity * (1 - 0.4 * Math.max(0, fit));
    const r = contribute(contributions, "fastTransition", true, fit, baseUpside * frictionMultiplier, baseDownside);
    attackUpside += r.upside;
    attackDownside += r.downside;
  } else {
    contribute(contributions, "fastTransition", false, 0, 0, 0);
  }

  if (p.goalkeeperInitiation === "HIGH") {
    const gk = activeGoalkeeper(usageTrace);
    const fit = weightedAttributeFit(GK_INITIATION_FIT_ATTRS, ratingsById, gk);
    const r = contribute(contributions, "goalkeeperInitiation:HIGH", true, fit, 0.15 * fit, 0);
    attackUpside += r.upside;
    attackDownside += r.downside;
  } else {
    contribute(contributions, "goalkeeperInitiation", false, 0, 0, 0);
  }

  if (p.defensiveRetreatIntent === "HIGH") {
    const fit = weightedAttributeFit(RETREAT_FIT_ATTRS, ratingsById, defenceUnit);
    const r = contribute(contributions, "defensiveRetreatIntent:HIGH", true, fit, 0.15 * fit, 0);
    defenceUpside += r.upside;
    defenceDownside += r.downside;
  } else {
    contribute(contributions, "defensiveRetreatIntent", false, 0, 0, 0);
  }

  // Part "TRANSITION": the specialist-priority side of the trade-off --
  // choosing ATTACK_FIRST/DEFENCE_FIRST (with real specialist pairs in
  // play) gives up some of the fastTransition upside above in exchange
  // for a small reliability bonus in the prioritized phase.
  if (usageTrace.specialistPairCount > 0 && p.substitutionPriority !== "BALANCED") {
    if (p.substitutionPriority === "ATTACK_FIRST") {
      contribute(contributions, "substitutionPriority:ATTACK_FIRST", true, 0, SPECIALIST_PRIORITY_BONUS, 0);
      attackUpside += SPECIALIST_PRIORITY_BONUS;
    } else {
      contribute(contributions, "substitutionPriority:DEFENCE_FIRST", true, 0, SPECIALIST_PRIORITY_BONUS, 0);
      defenceUpside += SPECIALIST_PRIORITY_BONUS;
    }
  } else {
    contribute(contributions, "substitutionPriority", false, 0, 0, 0);
  }

  return { attackUpside, attackDownside, defenceUpside, defenceDownside };
}

// ---------------------------------------------------------------------------
// Public trace + entry point
// ---------------------------------------------------------------------------

export interface TeamTacticalPlanTrace {
  clubId: string;
  contributions: readonly TacticalDimensionContribution[];
  attackBonus: number;
  defenceBonus: number;
}

export interface TacticalMatchPlanAdjustment {
  home: number;
  away: number;
  trace: { home: TeamTacticalPlanTrace; away: TeamTacticalPlanTrace };
}

const MAX_TACTICAL_PLAN_BONUS_GOALS = 1.0;

const NEUTRAL_TEAM_TRACE: TeamTacticalPlanTrace = { clubId: "", contributions: [], attackBonus: 0, defenceBonus: 0 };

/**
 * Part "ADAPTER": MatchPlan + MatchUsageTrace + GameplayRatings +
 * opponent context -> a bounded team-level attack/defence tactical
 * bonus, fully traced. `plan: null` (no resolvable MatchPlan) or
 * `usageTrace: null` returns the neutral trace -- never throws.
 */
export function computeTeamTacticalPlanTrace(
  plan: MatchPlan | null,
  ratings: readonly GameplayPlayerRating[],
  usageTrace: TeamUsageTrace | null,
  opponentPlan: MatchPlan | null,
): TeamTacticalPlanTrace {
  if (!plan || !usageTrace) return NEUTRAL_TEAM_TRACE;

  const ratingsById = new Map(ratings.map((r) => [r.playerId, r]));
  const contributions: TacticalDimensionContribution[] = [];

  const attack = attackDimensionEffects(plan, ratingsById, usageTrace, contributions);
  const defence = defenceDimensionEffects(plan, ratingsById, usageTrace, opponentPlan, contributions);
  const transition = transitionDimensionEffects(plan, ratingsById, usageTrace, contributions);

  const attackBonus = clamp(attack.upside - attack.downside + transition.attackUpside - transition.attackDownside, -MAX_TACTICAL_PLAN_BONUS_GOALS, MAX_TACTICAL_PLAN_BONUS_GOALS);
  const defenceBonus = clamp(defence.upside - defence.downside + transition.defenceUpside - transition.defenceDownside, -MAX_TACTICAL_PLAN_BONUS_GOALS, MAX_TACTICAL_PLAN_BONUS_GOALS);

  return { clubId: plan.clubId, contributions, attackBonus, defenceBonus };
}

/**
 * The one public entry point: both sides' MatchPlan/usage/ratings ->
 * a bounded home/away expected-goals adjustment, composed exactly like
 * playerMatchStrength.ts's own "own attack minus opponent's defence"
 * pattern -- ready to sum alongside tacticalMatchAdjustment.ts's and
 * playerMatchStrength.ts's own results (Part "ADAPTER": never merged
 * into either). Deterministic and pure.
 */
export function computeTacticalMatchPlanAdjustment(
  homePlan: MatchPlan | null,
  homeRatings: readonly GameplayPlayerRating[],
  homeUsageTrace: TeamUsageTrace | null,
  awayPlan: MatchPlan | null,
  awayRatings: readonly GameplayPlayerRating[],
  awayUsageTrace: TeamUsageTrace | null,
): TacticalMatchPlanAdjustment {
  const home = computeTeamTacticalPlanTrace(homePlan, homeRatings, homeUsageTrace, awayPlan);
  const away = computeTeamTacticalPlanTrace(awayPlan, awayRatings, awayUsageTrace, homePlan);

  const homeAdjustment = home.attackBonus - away.defenceBonus;
  const awayAdjustment = away.attackBonus - home.defenceBonus;

  return { home: homeAdjustment, away: awayAdjustment, trace: { home, away } };
}
