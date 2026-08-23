import type { FastMatchResult } from "@handball-manager/game-simulation";
import type { InboxMessage, PlayerMock } from "../game-data";
import type { CareerEvent } from "./careerEvents";
import type { CareerTask } from "./careerTasks";
import type { PlayerCareerStatus } from "./playerStatus";
import type { TeamTacticalProfile } from "./teamTacticalProfile";
import type { MatchPlan } from "../matchPlan/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";

export type CareerFixture = {
  id: string;
  competitionId: string;
  round: number;
  date: string; // ISO date
  homeClubId: string;
  awayClubId: string;
};

export type ClubFormEntry = "W" | "D" | "L";

export type PlayerSeasonStats = {
  playerId: string;
  appearances: number;
  starts: number;
  goals: number;
  shots: number;
  /** Goalkeepers only. */
  saves: number;
  shotsFaced: number;
  ratingSum: number;
};

export function emptyPlayerSeasonStats(playerId: string): PlayerSeasonStats {
  return { playerId, appearances: 0, starts: 0, goals: 0, shots: 0, saves: 0, shotsFaced: 0, ratingSum: 0 };
}

export function averageRating(stats: PlayerSeasonStats): number {
  return stats.appearances > 0 ? Math.round((stats.ratingSum / stats.appearances) * 10) / 10 : 0;
}

/**
 * The authoritative, mutable per-save career/world state. Owns
 * everything HM-GAME-0.2A's simulated Allsvenskan season needs; static
 * mock modules under lib/game-data only ever SEED a new career (see
 * newCareer.ts) and are never mutated themselves.
 */
export type CareerState = {
  seasonId: string; // e.g. "2026/27"
  competitionId: string; // "swe-2" -- the one fully-simulated competition this pass
  playerClubId: string;
  gameDate: string; // ISO date
  seasonComplete: boolean;
  /** The save's own deterministic seed -- match seeds derive from `${saveSeed}:${fixtureId}` (see game-simulation's season.ts). */
  saveSeed: string;
  fixtures: readonly CareerFixture[];
  /** Keyed by fixtureId. Only fixtures with a stored result have been played. */
  results: Record<string, FastMatchResult>;
  /** Keyed by playerId -- IFK Tumba's own squad only (see Section 9 scope note). */
  playerSeasonStats: Record<string, PlayerSeasonStats>;
  /** Keyed by clubId, most recent result last, capped at 5 entries. */
  clubForm: Record<string, ClubFormEntry[]>;
  inbox: InboxMessage[];

  // --- HM-GAME-0.3 Career Rhythm additions (career-state schema v3, see saveMigration.ts) ---

  /** ISO date the season's fixtures begin -- immutable, used for periodic report/task cadence (never weekday-based). */
  seasonStartDate: string;
  /**
   * The latest date for which the Daily World Tick (Spec S5/S21) has
   * fully completed. `gameDate` is the date currently presented to the
   * manager ("currentDate"); the two move together in v0.1 but are kept
   * as distinct fields per the spec so exactly-once processing has an
   * explicit, persisted boundary independent of any future "peek ahead"
   * UI.
   */
  processedThroughDate: string;
  /** The full semantic Career Event log (Spec S14). Source of truth Inbox messages are generated from -- see inboxBridge.ts. */
  careerEvents: CareerEvent[];
  /** Per-save player availability, keyed by playerId (Spec S7/S15). */
  playerStatuses: Record<string, PlayerCareerStatus>;
  /** Scheduled scouting/opponent-analysis tasks (Spec S16). */
  tasks: CareerTask[];

  // --- HM-DATA-0.2 addition (career-state schema v4, see saveMigration.ts) ---

  /**
   * Real-world-identity player snapshot, keyed by clubId, taken ONCE at
   * career creation (newCareer.ts) for every real-world-backed club in
   * this career's competition. This is the career's own copy: later
   * Development Editor corrections to data/real-world/* never reach an
   * already-running career (Spec: "editor changes affect only future new
   * careers"). Clubs without real-world data (e.g. Allsvenskan mocks)
   * simply have no entry here -- their squad still comes from the
   * existing static game-data mock modules (TUMBA_SQUAD etc.).
   */
  worldSquads: Record<string, PlayerMock[]>;

  // --- HM-TACTICS-0.6A addition (career-state schema v6, see saveMigration.ts) ---

  /**
   * The manager's own team-level tactical profile (Spec: minimal
   * TeamTacticalProfile prerequisite for future Fast Match integration).
   * Read-only plumbing in this milestone -- nothing in Fast Match, Live
   * Match, or Analysis Hub consumes it yet.
   */
  tacticalProfile: TeamTacticalProfile;

  // --- HM-IDENTITY-0.3 addition (career-state schema v7, see saveMigration.ts) ---

  /**
   * Every REAL_WORLD club's AI-derived TeamTacticalProfile (see
   * career/aiTacticalPreferences.ts), keyed by clubId, snapshotted ONCE
   * at career creation -- the same fixed-snapshot precedent worldSquads
   * already established, and for the same reason: this module must stay
   * importable from client code ("use client" CareerContext.tsx), so it
   * can never call the fs-based identity loaders directly. A club with
   * no entry here (mock-only clubs, or a career created before this
   * milestone) simply has no AI-derived tactical profile available --
   * matchdayAction.ts falls back to the existing NEUTRAL opponent
   * assumption for it, never inventing one.
   */
  aiTacticalPreferences: Record<string, TeamTacticalProfile>;

  // --- HM-TACTICS-1.1 addition (career-state schema v8, see saveMigration.ts) ---

  /**
   * Fixture-specific Match Plans (HM-TACTICS-1.0's headless domain,
   * lib/matchPlan/), keyed by fixtureId -- same fixture-keyed convention
   * as `results`. Deliberately separate from `tacticalProfile` above
   * (the club's own, non-fixture-keyed permanent tactical identity):
   * editing a fixture's MatchPlan can never rewrite it, because they
   * live in different keyed stores. A fixture with no entry here simply
   * has no saved plan yet -- the Tactics workspace builds one on the fly
   * via lib/matchPlan's own `buildDefaultMatchPlan()` and only writes an
   * entry here once the manager actually edits something.
   */
  matchPlans: Record<string, MatchPlan>;

  // --- HM-MATCH-RATINGS-0.1 addition (career-state schema v9, see saveMigration.ts) ---

  /**
   * Every REAL_WORLD club's canonical complete gameplay ratings (HM-
   * RATINGS-0.6's own LOCKED > CALIBRATED > ESTIMATED > GENERATED_GAME_
   * PRIOR snapshot, gameWorld/gameplayRatingSnapshot.ts), keyed by
   * clubId, snapshotted ONCE at career creation -- the same fixed-
   * snapshot precedent as `worldSquads`/`aiTacticalPreferences`, and for
   * the same reason: this module must stay importable from client code
   * ("use client" CareerContext.tsx), so it can never call the fs-based
   * rating pipeline directly. A club with no entry here (mock-only
   * clubs, or a career created before this milestone) simply has no
   * canonical ratings available -- lib/career/playerMatchStrength.ts's
   * own neutral-value fallback treats a missing rating exactly like a
   * missing MatchPlan, never crashing and never inventing one.
   */
  gameplayRatings: Record<string, GameplayPlayerRating[]>;
};

export type CareerSaveEnvelope = {
  schemaVersion: 2;
  career: CareerState;
};
