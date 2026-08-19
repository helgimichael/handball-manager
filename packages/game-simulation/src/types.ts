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

export type FastMatchResult = {
  fixtureId: string;
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
};
