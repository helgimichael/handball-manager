import { createRng, nextGaussian, type Rng } from "./rng";
import type {
  ClubStrength,
  FastMatchResult,
  MatchEvent,
  MatchRosterPlayer,
  PlayerMatchContribution,
  TeamMatchStats,
} from "./types";

/**
 * Handball-plausible goal model, not a football model: senior men's
 * handball team totals cluster around the mid-20s per team, rarely
 * drop below ~18 or exceed ~38. Tuned as constants (not hardcoded
 * magic numbers scattered through the function) so the HM-GAME-0.2A
 * report's "handball plausibility" batch-test numbers are reproducible
 * against a documented model, and so future tuning has one place to
 * change.
 */
const BASE_EXPECTED_GOALS = 26;
const HOME_ADVANTAGE_GOALS = 1.4;
const STRENGTH_TO_GOALS_SCALE = 14; // tuned so even a large (45-point) strength gap still leaves the weaker side a real (if small) chance -- "stronger teams win more often, but not always" per the brief
const GOAL_STD_DEV_BASE = 3.6;
const GOAL_STD_DEV_DEPTH_DAMPING = 0.018; // higher depth -> slightly more consistent scoring
const MIN_TEAM_GOALS = 16;
const MAX_TEAM_GOALS = 40;

export type SimulateMatchInput = {
  fixtureId: string;
  seed: number;
  homeClubId: string;
  awayClubId: string;
  homeStrength: ClubStrength;
  awayStrength: ClubStrength;
  /** -1 (out of form) .. +1 (in form), applied as a small goal nudge. */
  homeFormAdjustment?: number;
  awayFormAdjustment?: number;
  /**
   * HM-TACTICS-0.6B: a small, bounded expected-goals nudge derived from
   * an aggregate (never per-attack) ATI-001 x TI-001 tactical-domain
   * sample, computed and bounded entirely outside this package (see
   * apps/game/lib/career/tacticalMatchAdjustment.ts) -- this engine
   * never imports tactical-domain and treats the value exactly like
   * homeFormAdjustment/awayFormAdjustment: a plain additive number, not
   * a tactical concept. Provisional/technical only, not handball truth.
   */
  homeTacticalAdjustment?: number;
  awayTacticalAdjustment?: number;
  /** Only ever populated for the human-managed club (see Section 9 scope note in types.ts). */
  homeRoster?: readonly MatchRosterPlayer[];
  awayRoster?: readonly MatchRosterPlayer[];
};

function effectiveDefense(strength: ClubStrength): number {
  return strength.defense * 0.6 + strength.goalkeeper * 0.4;
}

function expectedGoals(
  attacker: ClubStrength,
  defender: ClubStrength,
  homeAdvantage: number,
  formAdjustment: number,
): number {
  const strengthDelta = (attacker.attack - effectiveDefense(defender)) / STRENGTH_TO_GOALS_SCALE;
  return BASE_EXPECTED_GOALS + strengthDelta + homeAdvantage + formAdjustment;
}

/**
 * `minGoals`/`maxGoals`/`stdDevScale` default to the full-60-minute
 * calibration (MIN_TEAM_GOALS/MAX_TEAM_GOALS/1) -- every existing call
 * site is unaffected. HM-TACTICS-0.7's segment simulation is the only
 * caller that overrides them, scaling all three by a segment's duration
 * fraction of a full match.
 */
function sampleTeamGoals(rng: Rng, expected: number, depth: number, minGoals = MIN_TEAM_GOALS, maxGoals = MAX_TEAM_GOALS, stdDevScale = 1): number {
  const stdDev = Math.max(1.8 * stdDevScale, (GOAL_STD_DEV_BASE - depth * GOAL_STD_DEV_DEPTH_DAMPING) * stdDevScale);
  return Math.round(nextGaussian(rng, expected, stdDev, minGoals, maxGoals));
}

function buildTeamStats(rng: Rng, goals: number, opponentGoalkeeperStrength: number): TeamMatchStats {
  const shootingPct = 0.56 + rng.nextFloat() * 0.1; // 56-66%, typical senior handball range
  const shots = Math.max(goals, Math.round(goals / shootingPct));
  const nonScoringShots = shots - goals;
  const savedFraction = Math.max(0.35, Math.min(0.75, 0.55 + (opponentGoalkeeperStrength - 50) / 200));
  const sevenMetreAttempts = rng.nextInt(2, 6);
  const sevenMetreGoals = Math.min(goals, Math.round(sevenMetreAttempts * (0.68 + rng.nextFloat() * 0.15)));

  return {
    goals,
    shots,
    shootingPct: Math.round((goals / shots) * 1000) / 10,
    saves: Math.round(nonScoringShots * savedFraction),
    shotsFaced: 0, // filled in by the opposing team's shots once both sides are computed
    turnovers: rng.nextInt(8, 16),
    twoMinuteSuspensions: rng.nextInt(0, 4),
    sevenMetreGoals,
    sevenMetreAttempts,
  };
}

/**
 * Weighted multinomial-style distribution: draws `total` times from
 * `weights`, each draw independently weighted, deterministic given rng.
 * Used both for goal distribution across a roster and for building the
 * event timeline's scorer sequence -- guaranteeing the sum of individual
 * contributions always equals the team total by construction (see
 * types.ts's FastMatchResult contract and the report's Section 15 test).
 */
function weightedPick(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) {
    return rng.nextInt(0, weights.length - 1);
  }
  let roll = rng.nextFloat() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) {
      return i;
    }
  }
  return weights.length - 1;
}

function distributeGoalsToRoster(
  rng: Rng,
  totalGoals: number,
  roster: readonly MatchRosterPlayer[],
): Map<string, number> {
  const outfield = roster.filter((p) => !p.isGoalkeeper);
  const counts = new Map<string, number>();
  if (outfield.length === 0) {
    return counts;
  }
  const weights = outfield.map((p) => Math.max(0.1, p.scoringWeight));
  for (let i = 0; i < totalGoals; i += 1) {
    const idx = weightedPick(rng, weights);
    const playerId = outfield[idx].playerId;
    counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
  }
  return counts;
}

function buildPlayerContributions(
  rng: Rng,
  roster: readonly MatchRosterPlayer[] | undefined,
  goalCounts: Map<string, number>,
  teamGoals: number,
  shotsFaced: number,
  saves: number,
): PlayerMatchContribution[] {
  if (!roster || roster.length === 0) {
    return [];
  }
  return roster.map((p) => {
    if (p.isGoalkeeper) {
      const rating = Math.max(1, Math.min(10, 6 + (saves / Math.max(1, shotsFaced)) * 5 + (rng.nextFloat() - 0.5)));
      return {
        playerId: p.playerId,
        goals: 0,
        shots: 0,
        saves,
        shotsFaced,
        rating: Math.round(rating * 10) / 10,
        started: p.started,
      };
    }
    const goals = goalCounts.get(p.playerId) ?? 0;
    const shots = goals + rng.nextInt(0, 3);
    const shareOfTeamGoals = teamGoals > 0 ? goals / teamGoals : 0;
    const rating = Math.max(1, Math.min(10, 5.5 + shareOfTeamGoals * 8 + (rng.nextFloat() - 0.5) * 1.5));
    return {
      playerId: p.playerId,
      goals,
      shots,
      rating: Math.round(rating * 10) / 10,
      started: p.started,
    };
  });
}

/**
 * Emits exactly the non-scoring flavour events (MISS/SAVE/TURNOVER/
 * TWO_MIN/SEVEN_M) needed for `stats` to be exactly reconstructable by
 * counting revealed events (HM-MATCH-0.1's live-stats hard gate: at full
 * time, event-accumulated stats must equal FastMatchResult's stats).
 * Never changes `stats` itself -- purely an additive presentation layer
 * over already-computed final numbers.
 *
 *   non-scoring shots (this side)      = stats.shots - stats.goals
 *   MISS count                         = non-scoring shots - stats.saves
 *   SAVE count                         = stats.saves
 *   TURNOVER / TWO_MIN count           = stats.turnovers / stats.twoMinuteSuspensions
 *   SEVEN_M(GOAL) / SEVEN_M(MISS) count = stats.sevenMetreGoals / (stats.sevenMetreAttempts - stats.sevenMetreGoals)
 *
 * `stats.saves` is always <= non-scoring shots by construction in
 * buildTeamStats (the saved fraction is capped well under 1), so MISS
 * count can never go negative.
 */
function buildFlavourEvents(rng: Rng, side: "home" | "away", stats: TeamMatchStats, minuteMin = 1, minuteMax = 60): MatchEvent[] {
  const events: MatchEvent[] = [];
  const push = (type: MatchEvent["type"], sevenMetreOutcome?: MatchEvent["sevenMetreOutcome"]) => {
    events.push({ minute: rng.nextInt(minuteMin, minuteMax), side, type, sevenMetreOutcome });
  };

  const nonScoringShots = Math.max(0, stats.shots - stats.goals);
  const missCount = Math.max(0, nonScoringShots - stats.saves);
  for (let i = 0; i < missCount; i += 1) push("MISS");
  for (let i = 0; i < stats.saves; i += 1) push("SAVE");
  for (let i = 0; i < stats.turnovers; i += 1) push("TURNOVER");
  for (let i = 0; i < stats.twoMinuteSuspensions; i += 1) push("TWO_MIN");

  const sevenGoals = Math.min(stats.sevenMetreGoals, stats.sevenMetreAttempts);
  for (let i = 0; i < sevenGoals; i += 1) push("SEVEN_M", "GOAL");
  for (let i = 0; i < stats.sevenMetreAttempts - sevenGoals; i += 1) push("SEVEN_M", "MISS");

  return events;
}

/** Expands a goal-count map into an ordered scorer sequence for the event timeline. */
function expandScorers(counts: Map<string, number>): string[] {
  const sequence: string[] = [];
  for (const [playerId, count] of counts) {
    for (let i = 0; i < count; i += 1) {
      sequence.push(playerId);
    }
  }
  return sequence;
}

/**
 * Builds an internally-consistent minute-by-minute event timeline whose
 * GOAL event count exactly matches the final score. `minuteMin`/
 * `minuteMax` default to the full match (1-60); `homeScoreStart`/
 * `awayScoreStart` default to 0-0. HM-TACTICS-0.7's segment simulation
 * is the only caller that overrides any of these -- every existing call
 * site is byte-for-byte unaffected.
 */
function buildEventTimeline(
  rng: Rng,
  homeGoals: number,
  awayGoals: number,
  homeGoalScorers: readonly string[],
  awayGoalScorers: readonly string[],
  homeStats: TeamMatchStats,
  awayStats: TeamMatchStats,
  minuteMin = 1,
  minuteMax = 60,
  homeScoreStart = 0,
  awayScoreStart = 0,
): MatchEvent[] {
  const events: MatchEvent[] = [];

  // Exactly homeGoals "home" slots and awayGoals "away" slots, by
  // construction -- shuffling (Fisher-Yates, using the same seeded rng)
  // only changes ORDER, never the count per side, so the final tally
  // can never drift from the simulated score regardless of shuffle
  // outcome.
  const sides: Array<"home" | "away"> = [
    ...Array<"home">(homeGoals).fill("home"),
    ...Array<"away">(awayGoals).fill("away"),
  ];
  for (let i = sides.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(0, i);
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }

  const minutes = sides.map(() => rng.nextInt(minuteMin, minuteMax)).sort((a, b) => a - b);

  let homeScore = homeScoreStart;
  let awayScore = awayScoreStart;
  let homeScorerIdx = 0;
  let awayScorerIdx = 0;

  sides.forEach((side, i) => {
    const minute = minutes[i];
    if (side === "home") {
      homeScore += 1;
      events.push({
        minute,
        side: "home",
        type: "GOAL",
        playerId: homeGoalScorers[homeScorerIdx],
        homeScoreAfter: homeScore,
        awayScoreAfter: awayScore,
      });
      homeScorerIdx = Math.min(homeScorerIdx + 1, Math.max(0, homeGoalScorers.length - 1));
    } else {
      awayScore += 1;
      events.push({
        minute,
        side: "away",
        type: "GOAL",
        playerId: awayGoalScorers[awayScorerIdx],
        homeScoreAfter: homeScore,
        awayScoreAfter: awayScore,
      });
      awayScorerIdx = Math.min(awayScorerIdx + 1, Math.max(0, awayGoalScorers.length - 1));
    }
  });

  // Non-scoring flavour events (SAVE/MISS/TURNOVER/TWO_MIN/SEVEN_M),
  // counted exactly to match homeStats/awayStats (HM-MATCH-0.1) -- never
  // affects the score, but IS now exactly reconstructable per-stat.
  events.push(...buildFlavourEvents(rng, "home", homeStats, minuteMin, minuteMax));
  events.push(...buildFlavourEvents(rng, "away", awayStats, minuteMin, minuteMax));

  events.sort((a, b) => a.minute - b.minute);
  return events;
}

export function simulateMatch(input: SimulateMatchInput): FastMatchResult {
  const rng = createRng(input.seed);

  const homeExpected = expectedGoals(
    input.homeStrength,
    input.awayStrength,
    HOME_ADVANTAGE_GOALS,
    (input.homeFormAdjustment ?? 0) + (input.homeTacticalAdjustment ?? 0),
  );
  const awayExpected = expectedGoals(
    input.awayStrength,
    input.homeStrength,
    -HOME_ADVANTAGE_GOALS * 0.3,
    (input.awayFormAdjustment ?? 0) + (input.awayTacticalAdjustment ?? 0),
  );

  const homeGoals = sampleTeamGoals(rng, homeExpected, input.homeStrength.depth);
  const awayGoals = sampleTeamGoals(rng, awayExpected, input.awayStrength.depth);

  const homeStats = buildTeamStats(rng, homeGoals, input.awayStrength.goalkeeper);
  const awayStats = buildTeamStats(rng, awayGoals, input.homeStrength.goalkeeper);
  // Cross-fill shotsFaced now that both sides' shot counts are known.
  const homeStatsFinal: TeamMatchStats = { ...homeStats, shotsFaced: awayStats.shots };
  const awayStatsFinal: TeamMatchStats = { ...awayStats, shotsFaced: homeStats.shots };

  const homeGoalCounts = input.homeRoster ? distributeGoalsToRoster(rng, homeGoals, input.homeRoster) : new Map<string, number>();
  const awayGoalCounts = input.awayRoster ? distributeGoalsToRoster(rng, awayGoals, input.awayRoster) : new Map<string, number>();

  const events = buildEventTimeline(
    rng,
    homeGoals,
    awayGoals,
    expandScorers(homeGoalCounts),
    expandScorers(awayGoalCounts),
    homeStatsFinal,
    awayStatsFinal,
  );

  const homePlayerContributions = buildPlayerContributions(
    rng,
    input.homeRoster,
    homeGoalCounts,
    homeGoals,
    homeStatsFinal.shotsFaced,
    homeStatsFinal.saves,
  );
  const awayPlayerContributions = buildPlayerContributions(
    rng,
    input.awayRoster,
    awayGoalCounts,
    awayGoals,
    awayStatsFinal.shotsFaced,
    awayStatsFinal.saves,
  );

  return {
    fixtureId: input.fixtureId,
    seed: input.seed,
    homeClubId: input.homeClubId,
    awayClubId: input.awayClubId,
    homeGoals,
    awayGoals,
    homeStats: homeStatsFinal,
    awayStats: awayStatsFinal,
    events,
    homePlayerContributions,
    awayPlayerContributions,
  };
}

// ---------------------------------------------------------------------------
// HM-TACTICS-0.7: partial-match ("segment") simulation.
//
// Used ONLY when an in-match tactical instruction is adopted -- never by
// the normal simulateMatch path above, which remains completely
// untouched (Spec: "no instruction = existing HM-TACTICS-0.6 behavior").
// A segment simulates a sub-duration of the match (e.g. minute 24-60)
// in isolation, using its own seed and its own share of expected goals
// scaled by the segment's fraction of a full 60-minute match. The
// caller (apps/game/lib/liveMatch/tacticalMidMatchChange.ts) is
// responsible for splicing this onto the untouched, already-revealed
// prefix of the original result -- this function has no knowledge of
// any "original" match and never regenerates one.
// ---------------------------------------------------------------------------

export type SimulateMatchSegmentInput = {
  /** A seed distinct from the original match's seed (see the splicing module for its derivation) -- this is a genuinely separate sub-simulation, not a continuation of the original rng stream. */
  seed: number;
  /** Inclusive. Typically the instruction's adoption minute. */
  startMinute: number;
  /** Inclusive. Typically 60 (full time). */
  endMinute: number;
  homeClubId: string;
  awayClubId: string;
  homeStrength: ClubStrength;
  awayStrength: ClubStrength;
  homeFormAdjustment?: number;
  awayFormAdjustment?: number;
  homeTacticalAdjustment?: number;
  awayTacticalAdjustment?: number;
  homeRoster?: readonly MatchRosterPlayer[];
  awayRoster?: readonly MatchRosterPlayer[];
};

export type MatchSegmentResult = {
  homeGoals: number;
  awayGoals: number;
  /** This segment's own stats only -- the caller sums these with the preserved prefix's own tallied stats. */
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  /** Minutes fall within [startMinute, endMinute]. `homeScoreAfter`/`awayScoreAfter` on GOAL events are LOCAL to this segment (start counting from 0-0) -- the caller must add the prefix's carried-forward score before splicing. */
  events: MatchEvent[];
  homePlayerContributions: PlayerMatchContribution[];
  awayPlayerContributions: PlayerMatchContribution[];
};

/** Simulates one sub-duration segment of a match in isolation. See the module note above for why/when this is used instead of simulateMatch. */
export function simulateMatchSegment(input: SimulateMatchSegmentInput): MatchSegmentResult {
  const rng = createRng(input.seed);
  const duration = Math.max(0, input.endMinute - input.startMinute);
  const durationFraction = Math.max(0, Math.min(1, duration / 60));

  const homeExpectedFull = expectedGoals(
    input.homeStrength,
    input.awayStrength,
    HOME_ADVANTAGE_GOALS,
    (input.homeFormAdjustment ?? 0) + (input.homeTacticalAdjustment ?? 0),
  );
  const awayExpectedFull = expectedGoals(
    input.awayStrength,
    input.homeStrength,
    -HOME_ADVANTAGE_GOALS * 0.3,
    (input.awayFormAdjustment ?? 0) + (input.awayTacticalAdjustment ?? 0),
  );

  const minGoals = Math.round(MIN_TEAM_GOALS * durationFraction);
  const maxGoals = Math.max(minGoals, Math.round(MAX_TEAM_GOALS * durationFraction));
  const stdDevScale = Math.sqrt(durationFraction);

  const homeGoals = sampleTeamGoals(rng, homeExpectedFull * durationFraction, input.homeStrength.depth, minGoals, maxGoals, stdDevScale);
  const awayGoals = sampleTeamGoals(rng, awayExpectedFull * durationFraction, input.awayStrength.depth, minGoals, maxGoals, stdDevScale);

  const homeStats = buildTeamStats(rng, homeGoals, input.awayStrength.goalkeeper);
  const awayStats = buildTeamStats(rng, awayGoals, input.homeStrength.goalkeeper);
  const homeStatsFinal: TeamMatchStats = { ...homeStats, shotsFaced: awayStats.shots };
  const awayStatsFinal: TeamMatchStats = { ...awayStats, shotsFaced: homeStats.shots };

  const homeGoalCounts = input.homeRoster ? distributeGoalsToRoster(rng, homeGoals, input.homeRoster) : new Map<string, number>();
  const awayGoalCounts = input.awayRoster ? distributeGoalsToRoster(rng, awayGoals, input.awayRoster) : new Map<string, number>();

  const events = buildEventTimeline(
    rng,
    homeGoals,
    awayGoals,
    expandScorers(homeGoalCounts),
    expandScorers(awayGoalCounts),
    homeStatsFinal,
    awayStatsFinal,
    Math.max(1, input.startMinute),
    Math.max(input.startMinute, input.endMinute),
    0,
    0,
  );

  const homePlayerContributions = buildPlayerContributions(
    rng,
    input.homeRoster,
    homeGoalCounts,
    homeGoals,
    homeStatsFinal.shotsFaced,
    homeStatsFinal.saves,
  );
  const awayPlayerContributions = buildPlayerContributions(
    rng,
    input.awayRoster,
    awayGoalCounts,
    awayGoals,
    awayStatsFinal.shotsFaced,
    awayStatsFinal.saves,
  );

  return {
    homeGoals,
    awayGoals,
    homeStats: homeStatsFinal,
    awayStats: awayStatsFinal,
    events,
    homePlayerContributions,
    awayPlayerContributions,
  };
}
