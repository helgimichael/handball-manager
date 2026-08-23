// HM-MATCH-RATINGS-0.1 / HM-MATCH-1.0: the ONE isolated adapter
// converting a MatchPlan + canonical gameplay ratings into a small,
// bounded expected-goals nudge for the Fast Match Engine -- the
// player-strength counterpart to tacticalMatchAdjustment.ts's tactical
// nudge (Part J: the two stay separate and are summed by the caller,
// never merged into one function or into CA/attributes themselves).
//
//   MatchPlan -> matchUsageEngine.ts's TeamUsageTrace (per-player,
//                per-phase, TEMPORAL exposure -- HM-MATCH-1.0)
//   + GameplayPlayerRating[]
//         -> per-player phase value (attack/defence/goalkeeper, 0-100)
//         -> exposure-weighted team value per phase (HM-MATCH-1.0:
//            exposure already encodes starter-vs-bench dominance
//            temporally, so no separate hardcoded starter/bench split
//            is needed here any more -- see Part J's "avoid double-
//            counting" instruction, which is why this module no longer
//            re-derives MatchRole/PlayingTimeIntention/PhaseUsage
//            weights itself)
//         -> bounded home/away expected-goals adjustment
//         -> game-simulation's homeTacticalAdjustment/awayTacticalAdjustment
//             (the SAME existing channel every tactical system already
//             uses -- see matchEngine.ts's SimulateMatchInput; this
//             module never touches ClubStrength or the engine itself)
//
// Only MatchPlan's SQUAD/STARTING-UNIT/USAGE/SUBSTITUTION/DEPTH data is
// used here (via matchUsageEngine.ts). AttackPlanConfig/
// DefencePlanConfig/TransitionPlanConfig's tactical-instruction fields
// (tempo, structureFreedom, pivotUsage, defensiveDepth, contactIntent,
// etc.) have NO existing, honest mapping into any simulation input
// (confirmed by the HM-TACTICS-1.0 audit: this vocabulary does not
// exist anywhere else in the codebase) and are deliberately left INERT
// this milestone (Part J: "leave it inert and report it, do not invent
// fake effects"). Only `attackPlan.sevenVSixPolicy` is wired, via
// tacticalMatchAdjustment.ts's own existing (intensity-scalable) 7v6
// bonus channel.
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import { computeTeamUsageTrace, type TeamUsageTrace } from "./matchUsageEngine";
import type { PlayerMock } from "../game-data";
import { buildInitialMatchSquad } from "../matchPlan/careerSquadBridge";
import { buildDefaultMatchPlan } from "../matchPlan/defaultMatchPlan";
import type { MatchPlan } from "../matchPlan/types";
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
// HM-MATCH-1.0 Part J: team phase/goalkeeper value is now a plain
// exposure-weighted mean over EVERY squad player -- exposure (from
// matchUsageEngine.ts's TeamUsageTrace) already encodes starter-vs-
// bench temporal dominance (a starter is active most/all of the six
// windows; a low-usage bench player only the last one or two), so no
// separate hardcoded starter/bench structural split is needed any more
// -- that would have double-counted the same MatchRole/
// PlayingTimeIntention/PhaseUsage inputs the usage engine already
// weighted (Part J's own warning).
// ---------------------------------------------------------------------------

function weightedMean(items: readonly { value: number; weight: number }[]): number {
  const totalWeight = items.reduce((sum, i) => sum + i.weight, 0);
  if (totalWeight <= 0) return NEUTRAL_VALUE;
  return items.reduce((sum, i) => sum + i.value * i.weight, 0) / totalWeight;
}

interface PhaseValueResult {
  value: number;
  /** Diagnostic-only: the exposure-weighted mean among players who STARTED this phase, vs everyone else -- never fed back into `value` itself, purely for trace inspection. */
  startingAvg: number;
  benchAvg: number;
}

function computePhaseValue(
  plan: MatchPlan,
  ratingsById: Map<string, GameplayPlayerRating>,
  usageTrace: TeamUsageTrace,
  phase: "attack" | "defence",
  valueOf: (rating: GameplayPlayerRating | undefined) => number,
): PhaseValueResult {
  const traceById = new Map(usageTrace.players.map((t) => [t.playerId, t]));
  const gkIds = new Set(plan.squad.players.filter((p) => p.position === "GK").map((p) => p.playerId));

  const outcourt = plan.squad.players.filter((p) => !gkIds.has(p.playerId));
  const items = outcourt.map((p) => {
    const trace = traceById.get(p.playerId);
    const exposure = phase === "attack" ? (trace?.attackExposure ?? 0) : (trace?.defenceExposure ?? 0);
    const started = phase === "attack" ? (trace?.startedAttack ?? false) : (trace?.startedDefence ?? false);
    return { value: valueOf(ratingsById.get(p.playerId)), weight: exposure, started };
  });

  const value = items.length > 0 ? weightedMean(items) : NEUTRAL_VALUE;
  const starters = items.filter((i) => i.started);
  const bench = items.filter((i) => !i.started);
  const startingAvg = starters.length > 0 ? weightedMean(starters) : value;
  const benchAvg = bench.length > 0 ? weightedMean(bench) : value;
  return { value, startingAvg, benchAvg };
}

// ---------------------------------------------------------------------------
// Part I/L: goalkeeper is a distinct value channel -- `goalkeeperExposure`
// already gives the starting GK ~all six windows and a backup only
// whatever their own usage weight earns them at the end of the match
// (matchUsageEngine.ts's computeGoalkeeperWindowCounts), so a plain
// exposure-weighted mean here is sufficient; no separate hardcoded
// 85/15 split is needed any more.
// ---------------------------------------------------------------------------

function computeGoalkeeperValue(plan: MatchPlan, ratingsById: Map<string, GameplayPlayerRating>, usageTrace: TeamUsageTrace): number {
  const traceById = new Map(usageTrace.players.map((t) => [t.playerId, t]));
  const goalkeepers = plan.squad.players.filter((p) => p.position === "GK");
  if (goalkeepers.length === 0) return NEUTRAL_VALUE;

  const items = goalkeepers.map((p) => ({ value: playerGoalkeeperValue(ratingsById.get(p.playerId)), weight: traceById.get(p.playerId)?.goalkeeperExposure ?? 0 }));
  return weightedMean(items);
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
 *
 * `usageSeed` (HM-MATCH-1.0) namespaces the deterministic tiebreak
 * matchUsageEngine.ts uses when ranking equal-priority players within
 * one window's capped on-court set -- pass `` `${saveSeed}:${fixtureId}:usage:${clubId}` ``
 * from a real call site so it stays consistent with this codebase's
 * existing seeding scheme; any fixed string is fine for tests that
 * don't care about tiebreak ordering (the default here).
 */
export function computeTeamStrengthTrace(plan: MatchPlan | null, ratings: readonly GameplayPlayerRating[], usageSeed = "playerMatchStrength"): TeamStrengthTrace {
  if (!plan) return NEUTRAL_TRACE;

  const ratingsById = new Map(ratings.map((r) => [r.playerId, r]));
  const usageTrace = computeTeamUsageTrace(plan, usageSeed);

  const attack = computePhaseValue(plan, ratingsById, usageTrace, "attack", playerAttackValue);
  const defenceOutfield = computePhaseValue(plan, ratingsById, usageTrace, "defence", playerDefenceValue);
  const goalkeeperValue = computeGoalkeeperValue(plan, ratingsById, usageTrace);
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

/**
 * The one public entry point: MatchPlan + GameplayRatings for both sides
 * -> a bounded home/away expected-goals adjustment, ready to sum with
 * tacticalMatchAdjustment.ts's own result before passing to
 * simulateFixture (Part J/N/O). Deterministic and pure -- no I/O, no
 * randomness of its own (matchUsageEngine.ts's own tiebreak is a pure
 * hash, not an rng stream).
 *
 * `seedPrefix` (HM-MATCH-1.0, default a fixed string) namespaces the two
 * sides' independent usage-tiebreak seeds -- pass `` `${saveSeed}:${fixtureId}` ``
 * from a real call site.
 */
export function computePlayerMatchStrengthAdjustment(
  homePlan: MatchPlan | null,
  homeRatings: readonly GameplayPlayerRating[],
  awayPlan: MatchPlan | null,
  awayRatings: readonly GameplayPlayerRating[],
  seedPrefix = "playerMatchStrength",
): PlayerMatchStrengthAdjustment {
  const home = computeTeamStrengthTrace(homePlan, homeRatings, `${seedPrefix}:home`);
  const away = computeTeamStrengthTrace(awayPlan, awayRatings, `${seedPrefix}:away`);

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
