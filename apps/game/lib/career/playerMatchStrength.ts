// HM-MATCH-RATINGS-0.1: the ONE isolated adapter converting a MatchPlan
// + canonical gameplay ratings into a small, bounded expected-goals
// nudge for the Fast Match Engine -- the player-strength counterpart to
// tacticalMatchAdjustment.ts's tactical nudge (Part J: the two stay
// separate and are summed by the caller, never merged into one
// function or into CA/attributes themselves).
//
//   MatchPlan (squad/starting units/usage) + GameplayPlayerRating[]
//         -> per-player phase value (attack/defence/goalkeeper, 0-100)
//         -> usage-weighted starter+bench team value per phase
//         -> bounded home/away expected-goals adjustment
//         -> game-simulation's homeTacticalAdjustment/awayTacticalAdjustment
//             (the SAME existing channel every tactical system already
//             uses -- see matchEngine.ts's SimulateMatchInput; this
//             module never touches ClubStrength or the engine itself)
//
// Only MatchPlan's SQUAD/STARTING-UNIT/USAGE/SUBSTITUTION/DEPTH data is
// used here. AttackPlanConfig/DefencePlanConfig/TransitionPlanConfig's
// tactical-instruction fields (tempo, structureFreedom, pivotUsage,
// defensiveDepth, contactIntent, etc.) have NO existing, honest mapping
// into any simulation input (confirmed by the HM-TACTICS-1.0 audit:
// this vocabulary does not exist anywhere else in the codebase) and are
// deliberately left INERT this milestone (Part J: "leave it inert and
// report it, do not invent fake effects"). Only `attackPlan.
// sevenVSixPolicy` is wired, via tacticalMatchAdjustment.ts's own
// existing (now intensity-scalable) 7v6 bonus channel -- see Part K.
import type { PlayerMock } from "../game-data";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import type { MatchPlan, MatchRole, PlayerMatchUsage, PlayerPhaseUsage, PlayingTimeIntention } from "../matchPlan/types";
import { GOALKEEPER_ATTRIBUTES, type GoalkeeperAttribute, type OutcourtAttribute } from "../rating/types";

// ---------------------------------------------------------------------------
// Part E: a small, documented attribute-family weighting model -- NOT all
// 56/21 attributes equally, NOT 40 role-specific formulas. One fixed list
// per phase; a player's own attribute values (already role-appropriate,
// since a playmaker naturally scores high on PLAYMAKING/PASSING and a
// defensive specialist naturally scores high on the DEFENSIVE family) do
// the role-differentiation work -- no per-role branching needed here.
// ---------------------------------------------------------------------------

const ATTACK_ATTRIBUTES: readonly OutcourtAttribute[] = [
  "PASSING", "BALL_HANDLING", "SHOOTING_POWER", "SHOOTING_PLACEMENT", "SHOOTING_VARIETY", "BREAKTHROUGH", "FINISHING", "WING_FINISHING", "PIVOT_PLAY",
  "GAME_READING", "DECISION_MAKING", "PLAYMAKING", "TEMPO_CONTROL", "TWO_V_TWO_READING", "ADVANTAGE_RECOGNITION",
];

const DEFENCE_ATTRIBUTES: readonly OutcourtAttribute[] = [
  "CONTACT_ABILITY", "DEFENSIVE_POSITIONING", "DEFENSIVE_TIMING", "LATERAL_DEFENCE", "DEPTH_DEFENCE", "CENTRAL_DEFENCE", "COVERING", "SWITCHING_HANDOVER", "BALL_WINNING", "SHOT_BLOCKING",
  "TACTICAL_UNDERSTANDING", "ROLE_DISCIPLINE", "DISCIPLINE", "RESILIENCE",
];

const GOALKEEPER_VALUE_ATTRIBUTES: readonly GoalkeeperAttribute[] = GOALKEEPER_ATTRIBUTES;

/** Neutral baseline on the 0-100 value scale this module works in -- matches game-simulation's own ClubStrength neutral default (clubStrength.ts). A missing rating, missing MatchPlan, or a player whose branch doesn't match the requested phase all resolve here, never to a crash or an invented extreme. */
const NEUTRAL_VALUE = 50;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function averageAttribute(attrs: readonly string[], record: Record<string, { value: number }>): number {
  let sum = 0;
  let count = 0;
  for (const attr of attrs) {
    const entry = record[attr];
    if (entry) {
      sum += entry.value;
      count += 1;
    }
  }
  return count > 0 ? sum / count : 10.5; // 10.5 = midpoint of the 1-20 attribute scale
}

/** Blends CA (overall quality anchor, Part D) with the phase-relevant attribute average (Part E), equally weighted -- both already on independent scales, rescaled onto the same 0-100 value space this module works in. */
function blendedValue(ca: number, attrAvg1to20: number): number {
  const caScaled = clamp((ca / 200) * 100, 0, 100);
  const attrScaled = clamp((attrAvg1to20 / 20) * 100, 0, 100);
  return caScaled * 0.5 + attrScaled * 0.5;
}

function playerAttackValue(rating: GameplayPlayerRating | undefined): number {
  if (!rating || rating.branch.branch !== "OUTCOURT") return NEUTRAL_VALUE;
  return blendedValue(rating.ca, averageAttribute(ATTACK_ATTRIBUTES, rating.branch.attributes));
}

function playerDefenceValue(rating: GameplayPlayerRating | undefined): number {
  if (!rating || rating.branch.branch !== "OUTCOURT") return NEUTRAL_VALUE;
  return blendedValue(rating.ca, averageAttribute(DEFENCE_ATTRIBUTES, rating.branch.attributes));
}

function playerGoalkeeperValue(rating: GameplayPlayerRating | undefined): number {
  if (!rating || rating.branch.branch !== "GOALKEEPER") return NEUTRAL_VALUE;
  return blendedValue(rating.ca, averageAttribute(GOALKEEPER_VALUE_ATTRIBUTES, rating.branch.attributes));
}

// ---------------------------------------------------------------------------
// Part F: MatchRole/PlayingTimeIntention/PlayerPhaseUsage as bounded usage
// weights -- intended usage, never exact minutes (Part F: "do not convert
// these labels into exact real minutes yet").
// ---------------------------------------------------------------------------

/** Exported for direct, precise unit tests of the usage-weighting model (Part L: "debuggable/testable") -- not part of the module's real public API surface otherwise. */
export const MATCH_ROLE_WEIGHT: Record<MatchRole, number> = {
  KEY_PLAYER: 1.0,
  STARTER: 0.9,
  MAJOR_ROTATION: 0.7,
  ROTATION: 0.55,
  SPECIALIST: 0.65,
  DEVELOPMENT: 0.35,
  EMERGENCY: 0.15,
};

export const PLAYING_TIME_MULTIPLIER: Record<PlayingTimeIntention, number> = {
  VERY_HIGH: 1.0,
  HIGH: 0.85,
  NORMAL: 0.65,
  LOW: 0.4,
  VERY_LOW: 0.2,
  EMERGENCY_ONLY: 0.08,
};

/** ATTACK_ONLY/DEFENCE_ONLY zero out the other phase entirely (Part F); *_PREFERRED weight the non-preferred phase down rather than to zero. */
export const PHASE_USAGE_MULTIPLIER: Record<PlayerPhaseUsage, { attack: number; defence: number }> = {
  BOTH_PHASES: { attack: 1, defence: 1 },
  ATTACK_ONLY: { attack: 1, defence: 0 },
  DEFENCE_ONLY: { attack: 0, defence: 1 },
  ATTACK_PREFERRED: { attack: 1, defence: 0.5 },
  DEFENCE_PREFERRED: { attack: 0.5, defence: 1 },
};

function baseUsageWeight(usage: PlayerMatchUsage | undefined): number {
  if (!usage) return MATCH_ROLE_WEIGHT.ROTATION * PLAYING_TIME_MULTIPLIER.NORMAL;
  return MATCH_ROLE_WEIGHT[usage.matchRole] * PLAYING_TIME_MULTIPLIER[usage.playingTimeIntention];
}

function phaseWeight(usage: PlayerMatchUsage | undefined, phase: "attack" | "defence"): number {
  const mult = usage ? PHASE_USAGE_MULTIPLIER[usage.phaseUsage][phase] : 1;
  return baseUsageWeight(usage) * mult;
}

// ---------------------------------------------------------------------------
// Part G/H: substitution-pair specialist evidence and depth-hierarchy
// priority as small, bounded bench-weight multipliers -- never a
// simulated substitution or transition-failure penalty (Part G: "do not
// simulate actual substitution timing yet").
// ---------------------------------------------------------------------------

/** A bench player named as the phase-specialist half of a SubstitutionPair is specifically groomed to contribute in that phase -- a bounded bench-weight boost, not a guarantee of playing time (Part G). */
function substitutionSpecialistMultiplier(plan: MatchPlan, playerId: string, phase: "attack" | "defence"): number {
  const isPaired = plan.substitutionPairs.some((p) => (phase === "attack" ? p.attackPlayerId === playerId : p.defencePlayerId === playerId));
  return isPaired ? 1.5 : 1.0;
}

/** A player's own recorded depth-hierarchy priority (Part H, "where available") -- priority 1 gets a small boost, 3+ a small reduction; a player not listed in any group is unaffected. */
function depthPriorityMultiplier(plan: MatchPlan, playerId: string): number {
  for (const group of plan.depthHierarchy) {
    const entry = group.entries.find((e) => e.playerId === playerId);
    if (entry) {
      if (entry.priority <= 1) return 1.2;
      if (entry.priority === 2) return 1.0;
      return 0.85;
    }
  }
  return 1.0;
}

function weightedMean(items: readonly { value: number; weight: number }[]): number {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0) return NEUTRAL_VALUE;
  return items.reduce((sum, i) => sum + i.value * i.weight, 0) / totalWeight;
}

// ---------------------------------------------------------------------------
// Part C/H: starting unit dominates, bench contributes modestly but is
// never ignored -- a fixed 80/20 structural split between the starting-
// unit weighted average and the bench weighted average, per phase.
// ---------------------------------------------------------------------------

const STARTER_SHARE = 0.8;
const BENCH_SHARE = 0.2;

interface PhaseValueResult {
  value: number;
  startingAvg: number;
  benchAvg: number;
}

function computePhaseValue(
  plan: MatchPlan,
  ratingsById: Map<string, GameplayPlayerRating>,
  startingIds: ReadonlySet<string>,
  phase: "attack" | "defence",
  valueOf: (rating: GameplayPlayerRating | undefined) => number,
): PhaseValueResult {
  const usageById = new Map(plan.playerUsage.map((u) => [u.playerId, u]));
  const gkIds = new Set(plan.squad.players.filter((p) => p.position === "GK").map((p) => p.playerId));

  const starters = plan.squad.players
    .filter((p) => startingIds.has(p.playerId))
    .map((p) => ({ value: valueOf(ratingsById.get(p.playerId)), weight: phaseWeight(usageById.get(p.playerId), phase) }));

  const bench = plan.squad.players
    .filter((p) => !startingIds.has(p.playerId) && !gkIds.has(p.playerId))
    .map((p) => ({
      value: valueOf(ratingsById.get(p.playerId)),
      weight: phaseWeight(usageById.get(p.playerId), phase) * depthPriorityMultiplier(plan, p.playerId) * substitutionSpecialistMultiplier(plan, p.playerId, phase),
    }));

  const startingAvg = starters.length > 0 ? weightedMean(starters) : NEUTRAL_VALUE;
  const benchAvg = bench.length > 0 ? weightedMean(bench) : startingAvg;
  const value = starters.length === 0 ? NEUTRAL_VALUE : bench.length === 0 ? startingAvg : STARTER_SHARE * startingAvg + BENCH_SHARE * benchAvg;
  return { value, startingAvg, benchAvg };
}

// ---------------------------------------------------------------------------
// Part I: goalkeeper is a distinct value channel -- the starting
// (defence-unit) goalkeeper dominates; a backup's contribution is bounded
// by their own PlayingTimeIntention/MatchRole, never equal to the starter.
// ---------------------------------------------------------------------------

const GK_STARTER_SHARE = 0.85;
const GK_BACKUP_SHARE = 0.15;

function computeGoalkeeperValue(plan: MatchPlan, ratingsById: Map<string, GameplayPlayerRating>): number {
  const primaryId = plan.defenceStartingUnit.goalkeeperId;
  const goalkeepers = plan.squad.players.filter((p) => p.position === "GK");
  if (!primaryId || !goalkeepers.some((p) => p.playerId === primaryId)) return NEUTRAL_VALUE;

  const usageById = new Map(plan.playerUsage.map((u) => [u.playerId, u]));
  const primaryValue = playerGoalkeeperValue(ratingsById.get(primaryId));
  const backups = goalkeepers
    .filter((p) => p.playerId !== primaryId)
    .map((p) => ({ value: playerGoalkeeperValue(ratingsById.get(p.playerId)), weight: phaseWeight(usageById.get(p.playerId), "defence") }));

  if (backups.length === 0) return primaryValue;
  return GK_STARTER_SHARE * primaryValue + GK_BACKUP_SHARE * weightedMean(backups);
}

// ---------------------------------------------------------------------------
// Part L: the debuggable trace, mirroring tacticalMatchAdjustment.ts's own
// "numeric result + sibling trace" convention. Never shown in normal
// gameplay UI (Part S).
// ---------------------------------------------------------------------------

export interface TeamStrengthTrace {
  clubId: string;
  squadSize: number;
  attackValue: number;
  startingAttackAvg: number;
  benchAttackAvg: number;
  outfieldDefenceValue: number;
  startingDefenceAvg: number;
  benchDefenceAvg: number;
  goalkeeperValue: number;
  /** 0.7 * outfieldDefenceValue + 0.3 * goalkeeperValue -- the combined defence-side value used against the opponent's expected goals. */
  defenceValue: number;
}

const OUTFIELD_DEFENCE_SHARE = 0.7;
const GOALKEEPER_DEFENCE_SHARE = 0.3;

const NEUTRAL_TRACE: TeamStrengthTrace = {
  clubId: "",
  squadSize: 0,
  attackValue: NEUTRAL_VALUE,
  startingAttackAvg: NEUTRAL_VALUE,
  benchAttackAvg: NEUTRAL_VALUE,
  outfieldDefenceValue: NEUTRAL_VALUE,
  startingDefenceAvg: NEUTRAL_VALUE,
  benchDefenceAvg: NEUTRAL_VALUE,
  goalkeeperValue: NEUTRAL_VALUE,
  defenceValue: NEUTRAL_VALUE,
};

/**
 * Part B: only `plan.squad.players` (the fixture's own max-16 MatchSquad)
 * is ever read -- a player who exists in the club's full roster but was
 * not selected into this MatchSquad has no entry in `plan.squad.players`
 * and therefore mechanically cannot appear in any starter/bench group
 * below, regardless of their rating.
 *
 * `plan: null` (no resolvable MatchPlan, e.g. a squad too small to build
 * a default one) returns the neutral trace -- never throws.
 */
export function computeTeamStrengthTrace(plan: MatchPlan | null, ratings: readonly GameplayPlayerRating[]): TeamStrengthTrace {
  if (!plan) return NEUTRAL_TRACE;

  const ratingsById = new Map(ratings.map((r) => [r.playerId, r]));
  const attackStartingIds = new Set(plan.attackStartingUnit.slots.filter((s) => s.position !== "GK").map((s) => s.playerId));
  const defenceStartingIds = new Set(plan.defenceStartingUnit.courtSlots.map((s) => s.playerId));

  const attack = computePhaseValue(plan, ratingsById, attackStartingIds, "attack", playerAttackValue);
  const defenceOutfield = computePhaseValue(plan, ratingsById, defenceStartingIds, "defence", playerDefenceValue);
  const goalkeeperValue = computeGoalkeeperValue(plan, ratingsById);
  const defenceValue = OUTFIELD_DEFENCE_SHARE * defenceOutfield.value + GOALKEEPER_DEFENCE_SHARE * goalkeeperValue;

  return {
    clubId: plan.clubId,
    squadSize: plan.squad.players.length,
    attackValue: attack.value,
    startingAttackAvg: attack.startingAvg,
    benchAttackAvg: attack.benchAvg,
    outfieldDefenceValue: defenceOutfield.value,
    startingDefenceAvg: defenceOutfield.startingAvg,
    benchDefenceAvg: defenceOutfield.benchAvg,
    goalkeeperValue,
    defenceValue,
  };
}

// ---------------------------------------------------------------------------
// Part L/M: the bounded home/away adjustment. Mirrors
// tacticalMatchAdjustment.ts's own "own attack helps own score; the
// OPPONENT's defence reduces own score" composition exactly, using the
// same additive SimulateMatchInput channel -- own attack value nudges own
// side's expected goals up; the opponent's defence value nudges it back
// down, so a strong defence/goalkeeper measurably suppresses what the
// OTHER side scores (Part P test 5), not what the defending side itself
// scores.
// ---------------------------------------------------------------------------

const MAX_PLAYER_ATTACK_ADJUSTMENT_GOALS = 1.8;
const MAX_PLAYER_DEFENCE_ADJUSTMENT_GOALS = 1.8;
/** A value delta of one full PLAYER_VALUE_TO_GOALS_SCALE point (on the 0-100 value scale) nudges expected goals by 1, before the ± bound clamps extreme cases. Tuned so the observed CA 96-168 spread (per the milestone brief) produces a meaningful but controlled team difference, never a 25-25 vs 45-12 swing from one player. */
const PLAYER_VALUE_TO_GOALS_SCALE = 18;

function attackAdjustmentFor(value: number): number {
  return clamp((value - NEUTRAL_VALUE) / PLAYER_VALUE_TO_GOALS_SCALE, -MAX_PLAYER_ATTACK_ADJUSTMENT_GOALS, MAX_PLAYER_ATTACK_ADJUSTMENT_GOALS);
}

function defenceAdjustmentFor(value: number): number {
  return clamp((value - NEUTRAL_VALUE) / PLAYER_VALUE_TO_GOALS_SCALE, -MAX_PLAYER_DEFENCE_ADJUSTMENT_GOALS, MAX_PLAYER_DEFENCE_ADJUSTMENT_GOALS);
}

export interface PlayerMatchStrengthAdjustment {
  home: number;
  away: number;
  trace: { home: TeamStrengthTrace; away: TeamStrengthTrace };
}

/** The one public entry point: MatchPlan + GameplayRatings for both sides -> a bounded home/away expected-goals adjustment, ready to sum with tacticalMatchAdjustment.ts's own result before passing to simulateFixture (Part J/N/O). Deterministic and pure -- no I/O, no randomness. */
export function computePlayerMatchStrengthAdjustment(
  homePlan: MatchPlan | null,
  homeRatings: readonly GameplayPlayerRating[],
  awayPlan: MatchPlan | null,
  awayRatings: readonly GameplayPlayerRating[],
): PlayerMatchStrengthAdjustment {
  const home = computeTeamStrengthTrace(homePlan, homeRatings);
  const away = computeTeamStrengthTrace(awayPlan, awayRatings);

  const homeAdjustment = attackAdjustmentFor(home.attackValue) - defenceAdjustmentFor(away.defenceValue);
  const awayAdjustment = attackAdjustmentFor(away.attackValue) - defenceAdjustmentFor(home.defenceValue);

  return { home: homeAdjustment, away: awayAdjustment, trace: { home, away } };
}

// ---------------------------------------------------------------------------
// Part N/O: resolves the MatchPlan actually used for one club's side of a
// fixture -- the manager's own saved plan when one exists, otherwise
// HM-TACTICS-1.0's own deterministic default-plan helper (never a second
// default algorithm, per Part O). Used identically for the manager's AI
// opponent and for every AI-vs-AI fixture -- no AI "coaching" is added,
// only the same default any fixture without a saved plan already gets.
export function resolveClubMatchPlanForFixture(clubId: string, fixtureId: string, squad: readonly PlayerMock[], savedPlan: MatchPlan | undefined): MatchPlan | null {
  if (savedPlan) return savedPlan;
  const initialSquad = buildInitialMatchSquad(squad, fixtureId, clubId);
  const result = buildDefaultMatchPlan(initialSquad);
  return result.ok && result.plan ? result.plan : null;
}
