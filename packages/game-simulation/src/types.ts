// game-simulation: the Fast Match Engine. Framework-free, testable in
// isolation, deliberately separate from packages/handball-engine (the
// detailed physics/2D SIM engine) -- see the HM-GAME-0.2A report's
// architecture section for why career results come from here, not from
// stepping the detailed engine hundreds of times per matchday.

export type ClubStrength = {
  clubId: string;
  /** 1-100 game-balancing scale, not a real-world performance claim. */
  overall: number;
  attack: number;
  defense: number;
  goalkeeper: number;
  /** Squad depth -- dampens variance for deeper squads. */
  depth: number;
};

export type TeamMatchStats = {
  goals: number;
  shots: number;
  shootingPct: number;
  saves: number;
  shotsFaced: number;
  turnovers: number;
  twoMinuteSuspensions: number;
  sevenMetreGoals: number;
  sevenMetreAttempts: number;
};

export type MatchEventType = "GOAL" | "SAVE" | "MISS" | "TURNOVER" | "TWO_MIN" | "SEVEN_M";

export type MatchEvent = {
  minute: number;
  side: "home" | "away";
  type: MatchEventType;
  /** Present for GOAL/MISS/SAVE/SEVEN_M events attributable to a specific Tumba player. */
  playerId?: string;
  /** Running score snapshot AFTER this event, for GOAL events. */
  homeScoreAfter?: number;
  awayScoreAfter?: number;
  /**
   * HM-MATCH-0.1: present only for SEVEN_M events, distinguishing a
   * converted penalty from a missed one. A SEVEN_M/GOAL event does not
   * add its own extra score change -- the goal it represents is already
   * one of the ordinary GOAL events in the timeline (Bible-equivalent
   * invariant: total GOAL events always equal the final score).
   */
  sevenMetreOutcome?: "GOAL" | "MISS";
};

export type PlayerMatchContribution = {
  playerId: string;
  goals: number;
  shots: number;
  /** Goalkeepers only. */
  saves?: number;
  shotsFaced?: number;
  rating: number; // 1-10 match rating
  started: boolean;
};

/**
 * MATCH-EXPERIENCE-2.0 M14: which engine actually produced a result.
 *
 * "FAST" is this package's own probability-first Fast Match Engine. "SPATIAL"
 * is the M1-M13 handball-engine, which plays the match out on a real court and
 * derives every number from what happened there.
 *
 * It exists so a result can never be ambiguous about its own provenance: a
 * career path that has been migrated writes SPATIAL, and a reader can assert
 * that no Fast result was produced for the same fixture. Optional, so every
 * result saved before this milestone still loads unchanged and reads as the
 * Fast Match Engine it was.
 */
export type MatchEngineId = "FAST" | "SPATIAL";

export type FastMatchResult = {
  fixtureId: string;
  /** M14: which engine simulated this match. Absent means the Fast Match Engine. */
  engine?: MatchEngineId;
  seed: number;
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
  homeStats: TeamMatchStats;
  awayStats: TeamMatchStats;
  events: readonly MatchEvent[];
  /** Only populated for the human club's own players (see Section 9 scope note). */
  homePlayerContributions: readonly PlayerMatchContribution[];
  awayPlayerContributions: readonly PlayerMatchContribution[];
};

/**
 * A roster entry the engine needs to distribute goals/minutes across --
 * intentionally minimal, not the full PlayerMock shape (game-simulation
 * must not depend on the game app's game-data types).
 */
export type MatchRosterPlayer = {
  playerId: string;
  isGoalkeeper: boolean;
  /** Relative scoring weight within the outfield roster, e.g. derived from currentAbility + position bias. */
  scoringWeight: number;
  started: boolean;
  /**
   * HM-MATCH-1.1: which of 6 coarse 10-minute match-usage windows (see
   * apps/game's MatchUsageEngine, MATCH_USAGE_WINDOW_COUNT) this player
   * is actually scheduled to be active in attack, so the goal-scorer
   * draw below respects the coach's own substitution schedule instead of
   * a single whole-match aggregate weight. Optional -- omitted means
   * "eligible in every window" (byte-identical to pre-HM-MATCH-1.1
   * behavior), the safe fallback for any side with no resolved
   * MatchUsageTrace.
   */
  activeWindows?: readonly boolean[];
  /**
   * HM-PLAYER-CALIBRATION-1.0 Part C: a goalkeeper's canonical
   * goalkeeper-attribute quality (0-100, blended from CA + the
   * GOALKEEPER_ATTRIBUTES family), when known. Only ever set on the one
   * roster entry with `isGoalkeeper: true`. Used ONLY to give that
   * player's post-match rating a small, bounded skill-based nudge in
   * buildPlayerContributions -- it does NOT feed into the underlying
   * save-count/shots-faced simulation. Undefined means "no canonical
   * rating available", which reproduces the pre-existing pure
   * save-percentage rating byte-for-byte.
   */
  goalkeeperQuality?: number;
};
