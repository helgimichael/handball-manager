import type { FastMatchResult } from "@handball-manager/game-simulation";
import type { InboxMessage, PlayerMock } from "../game-data";
import type { CareerEvent } from "./careerEvents";
import type { CareerTask } from "./careerTasks";
import type { PlayerCareerStatus } from "./playerStatus";
import type { TeamTacticalProfile } from "./teamTacticalProfile";
import type { MatchPlan } from "../matchPlan/types";
import type { GameplayPlayerRating } from "../gameWorld/gameplayRatingSnapshot";
import type { MatchPlanChangeHistoryEntry } from "../liveMatch/matchPlanChange";
import type { PlayerMatchDefault, TacticsTemplate } from "../matchPlan/persistentDefaults";
import type { SpecialPlayPlan } from "../matchPlan/specialPlay";
import type { LiveMatchSessionState } from "../liveMatch/liveMatchSession";
import type { MatchPhysicalReport } from "../matchPlan/physicalModel";
import type { PlayerPhysicalState, PlayerTrainingAssignment, TrainingWeek } from "../training/types";
import type { PlayerDevelopmentState } from "../development/types";

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
  /**
   * HM-PHYSICAL-1.0 (career-state schema v14): keyed by fixtureId,
   * alongside `results` -- one MatchPhysicalReport per played fixture,
   * recording each squad player's starting/finishing energy and full
   * per-window trajectory (lib/matchPlan/physicalModel.ts). Deliberately
   * a SIBLING map, never a field bolted onto FastMatchResult itself
   * (packages/game-simulation's own type) -- keeps the physical model
   * entirely an apps/game-side concern, matching `results`'s own
   * established fixtureId-keyed convention (Part 21: this is what
   * future recovery/training/injury/workload systems will read from).
   */
  physicalReports: Record<string, MatchPhysicalReport>;
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

  // --- HM-COACHING-1.0 addition (career-state schema v10, see saveMigration.ts) ---

  /**
   * The MatchPlan actually in effect for a fixture RIGHT NOW, keyed by
   * fixtureId -- deliberately separate from `matchPlans` above (the
   * saved PRE-MATCH plan) so a live coaching change during the match
   * can never overwrite what the manager originally planned. Empty
   * (no entry) until the manager's first live coaching change is
   * adopted; `lib/career/matchPlanMidMatchChange.ts`'s
   * `resolveCurrentMatchPlan()` falls back to `matchPlans[fixtureId]`
   * (or the same deterministic default plan helper every other
   * unresolved-plan case already uses) whenever no entry exists here.
   */
  liveMatchPlans: Record<string, MatchPlan>;

  /**
   * A simple, structured record of every ADOPTED live MatchPlan
   * coaching change for a fixture, in order -- "what did the coach
   * change, when did they ask for it, when did it actually take
   * effect" (Part N/O: future-proofing for Match Analysis, never
   * evaluated as good/bad here). Keyed by fixtureId, one growing list
   * per match; empty (no entry) for a fixture with no live changes.
   */
  matchPlanChangeHistory: Record<string, MatchPlanChangeHistoryEntry[]>;

  // --- HM-MATCH-1.1 addition (career-state schema v11, see saveMigration.ts) ---

  /**
   * Part 1: the manager's own PERSISTENT tactical identity -- "how does
   * this club generally play" -- keyed by clubId (today, only ever the
   * manager's own `playerClubId`; the shape is club-keyed rather than a
   * single top-level value so a future multi-club-managed-career never
   * needs a second field). Deliberately separate from `matchPlans`
   * above: a fixture's own attackPlan/defencePlan/transitionPlan may
   * still diverge from this for one match, and only an explicit
   * pre-match Tactics workspace edit (never a live in-match coaching
   * change) syncs a new value back here -- see
   * lib/career/matchPlanActions.ts's own doc for the one write path.
   * Empty (no entry) for a club that has never had a Tactics edit yet --
   * `lib/matchPlan/defaultMatchPlan.ts`'s own hardcoded neutral defaults
   * are used until then, exactly as before this milestone.
   */
  tactics: Record<string, TacticsTemplate>;

  /**
   * Part 2: a player's own PERSISTENT squad standing / intended usage --
   * "Gustav is normally a KEY_PLAYER" -- keyed by playerId (globally
   * unique, the same flat convention `playerStatuses` already uses).
   * Same persistence rule as `tactics` above: only a pre-match Tactics
   * workspace edit syncs a new value here; a live coaching change or a
   * one-off fixture-specific override never does. A player with no
   * entry here simply has no persisted standing yet -- the same
   * STARTER/ROTATION heuristic `buildDefaultMatchPlan` always used is
   * the fallback, exactly as before this milestone.
   */
  playerMatchDefaults: Record<string, PlayerMatchDefault>;

  // --- HM-MATCH-1.2 addition (career-state schema v12, see saveMigration.ts) ---

  /**
   * Part H: SPECIALSPEL -- the club's own persistent tactical intent for
   * numerical-mismatch situations (6v5, 5v6, and the defensive response
   * to an opponent's 7v6/6v5/5v6), keyed by clubId. Same persistence
   * rule as `tactics`: only an explicit pre-match Tactics workspace edit
   * changes this. Part M (audited): NONE of this currently reaches Fast
   * Match -- see lib/matchPlan/specialPlay.ts's own module doc for why
   * -- so this is PERSISTED FOR FUTURE SIMULATION only, never a fake
   * effect. A club with no entry here gets `defaultSpecialPlayPlan()`'s
   * neutral values until the manager configures something else.
   */
  specialPlay: Record<string, SpecialPlayPlan>;

  // --- HM-MATCH-1.3A addition (career-state schema v13, see saveMigration.ts) ---

  /**
   * CORE PRINCIPLE: "a live match is not a page -- a live match is a
   * persistent career session." The one, currently-in-progress Live
   * Match's clock/coaching state (see lib/liveMatch/liveMatchSession.ts
   * for exactly what it does and does NOT carry -- the full simulated
   * timeline stays in `results`, MatchPlan coaching state stays in
   * `liveMatchPlans`/`matchPlanChangeHistory`; this only holds the
   * clock/profile/7v6/opponent-adaptation state that was previously
   * ONLY React component-local `useState`, silently resetting on every
   * navigation). `null` whenever no match is currently in progress --
   * a single nullable field, not fixture-keyed, since the manager only
   * ever has one fixture live at a time. Written only via
   * lib/career/liveMatchSessionActions.ts's three functions -- never
   * mutated ad hoc elsewhere.
   */
  activeMatchSession: LiveMatchSessionState | null;

  // --- HM-TRAINING-1.0 addition (career-state schema v15, see saveMigration.ts) ---

  /**
   * Part 3/20: the scheduled+executed training week, keyed by its own
   * Monday ISO date (`lib/training/trainingSchedule.ts`'s `mondayOf`).
   * A week with no entry here simply hasn't been touched yet -- every
   * reader resolves it deterministically on the fly via
   * `resolveTrainingWeek` (same "generate on demand, persist on first
   * real write" precedent as MatchPlan's own `buildDefaultMatchPlan`
   * fallback), so an empty object here is always a safe, observably-
   * identical starting point.
   */
  trainingWeeks: Record<string, TrainingWeek>;
  /**
   * Part 10/11: the ONE continuous per-player physical/readiness thread
   * between matches -- keyed by playerId (the same flat, globally-
   * unique convention `playerStatuses`/`playerMatchDefaults` already
   * use). A player with no entry here has simply never had their energy
   * touched by a match or training day yet, and every reader (training
   * execution, matchdayAction.ts's own starting-energy lookup) already
   * treats that as the same neutral 100 lib/matchPlan/physicalModel.ts's
   * own `ENERGY_START_DEFAULT` always meant before this milestone -- an
   * empty object here changes nothing observable for an old save.
   */
  playerPhysicalState: Record<string, PlayerPhysicalState>;
  /**
   * Part 12/13: a player's own persistent individual training-load
   * setting -- keyed by playerId, same "standing instruction until
   * explicitly changed" precedent as `playerMatchDefaults`. A player
   * with no entry here trains at the default `FULL` load, exactly as
   * every player implicitly did before this milestone.
   */
  playerTrainingAssignments: Record<string, PlayerTrainingAssignment>;

  // --- HM-TRAINING-1.1 addition (career-state schema v16, see saveMigration.ts) ---

  /**
   * Part 3: the ONE continuous per-player development thread -- keyed by
   * playerId, same flat convention as `playerPhysicalState`. A player
   * with no entry here has simply never accumulated any training/match
   * development stimulus yet (every reader treats that as "nothing to
   * resolve", never a fabricated starting state). See
   * lib/development/types.ts's own doc comment for the accumulator/
   * progress/history split, and lib/development/developmentIntegration.ts
   * for the only code that ever reads or writes this field.
   */
  playerDevelopmentState: Record<string, PlayerDevelopmentState>;
};

export type CareerSaveEnvelope = {
  schemaVersion: 2;
  career: CareerState;
};
