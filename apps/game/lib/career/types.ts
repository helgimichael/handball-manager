import type { FastMatchResult } from "@handball-manager/game-simulation";
import type { InboxMessage, PlayerMock } from "../game-data";
import type { CareerEvent } from "./careerEvents";
import type { CareerTask } from "./careerTasks";
import type { PlayerCareerStatus } from "./playerStatus";
import type { SquadStatusTier } from "./squadStatus";
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
import type { ResolvedStaffMember, StaffEmployment } from "../staff/types";
import type { StaffClubHistory } from "../staff/staffHistoryTypes";
import type { PlayerInjuryState } from "../medical/types";
import type { PlayerClubHistory, PlayerContract } from "../economy/types";
import type { ClubEconomyBaseline } from "../economy/clubEconomyTypes";
import type { LoanRecord, TransferOffer } from "../transfers/types";

/** HM-PRESEASON-1.0: LEAGUE (the manager's own simulated competition), CUP (the provisional early cup round -- see preseason.ts), or FRIENDLY (manager-booked, never affects standings/season completion). */
export type CareerFixtureType = "LEAGUE" | "CUP" | "FRIENDLY";

export type CareerFixture = {
  id: string;
  competitionId: string;
  round: number;
  date: string; // ISO date
  homeClubId: string;
  awayClubId: string;
  type: CareerFixtureType;
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

  /**
   * ISO date this CAREER (this save) begins -- immutable, used for
   * periodic report/task cadence (never weekday-based). HM-PRESEASON-1.0:
   * this is the manager's own chosen preseason-start date (may be weeks
   * before the league's own first fixture) -- NOT necessarily the
   * league's own kickoff date any more (see `leagueKickoffDate` below for
   * that). Its only real consumer (report-cadence day-counting in
   * dailyTick.ts) never assumed the two were the same thing beyond
   * historical coincidence, so this redefinition is additive/safe.
   */
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

  // --- HM-STAFF-1.0 addition (career-state schema v17, see saveMigration.ts) ---

  /**
   * Part 15/19/21, HM-STAFF-CAREER-1.0: every club's resolved, gameplay-
   * facing staff roster (real identity-backed staff blended with
   * generated essential-coverage fictional staff for a non-real-world
   * club -- lib/staff/staffRosterResolution.ts), keyed by clubId.
   * HM-STAFF-CAREER-1.0 resolves this for the WHOLE competition at
   * career creation (staffCareerIntegration.ts's resolveCompetitionStaffRoster,
   * the same "resolved once for every club, frozen into CareerState"
   * precedent worldSquads/gameplayRatings already established) so any
   * club's staff is browsable/recruitable, not only the manager's own.
   * A club with no entry here (a career created before this milestone,
   * not yet topped up) is filled in on load by
   * ensureCareerCompetitionStaffRoster, never left permanently missing.
   * A staff member's OWN entry moves between two clubs' arrays on a
   * completed recruitment (recruitStaffMember) -- this is a real,
   * career-persistent identity, not a per-club static snapshot.
   */
  staffRoster: Record<string, ResolvedStaffMember[]>;
  /**
   * Part 21/22, HM-STAFF-CAREER-1.0: the employment-state layer, now a
   * real contract (wage/end date for SALARIED members) rather than a
   * placeholder -- keyed by staffId, one entry per roster member across
   * EVERY club (not only the manager's own). Updated on a completed
   * recruitment (recruitStaffMember); otherwise seeded once at creation/
   * migration-time top-up and left alone.
   */
  staffEmployment: Record<string, StaffEmployment>;
  /**
   * HM-STAFF-CAREER-1.0 Part 5: a staff member's CAREER-TRACKED club
   * history (staff/staffHistoryTypes.ts) -- only ever grows when a real
   * recruitment move happens during THIS career (recruitStaffMember);
   * a person who has never changed clubs during the career simply has no
   * entry here, which every reader treats as "no tracked move history",
   * never a fabricated backstory.
   */
  staffClubHistory: Record<string, StaffClubHistory>;

  // --- HM-INJURIES-1.0 addition (career-state schema v19, see saveMigration.ts) ---

  /**
   * Part 3: the ONE continuous per-player injury/rehab thread -- keyed
   * by playerId, same flat convention as `playerPhysicalState`/
   * `playerDevelopmentState`. A player with no entry here has simply
   * never had an injury resolved against them yet (every reader treats
   * that as "healthy, no history", never a fabricated state). See
   * lib/medical/types.ts for the PlayerInjuryState shape and
   * lib/medical/injuryIntegration.ts for the only code that reads or
   * writes this field. `playerStatuses` (above) remains the coarse,
   * EXTERNAL availability signal every other system already reads --
   * this field is the detailed INTERNAL driver behind it, never a
   * second competing availability concept.
   */
  playerInjuries: Record<string, PlayerInjuryState>;

  // --- HM-PRESEASON-1.0 addition (career-state schema v20, see saveMigration.ts) ---

  /**
   * The REAL date `competitionId`'s own league fixtures begin (Part:
   * Sweden 2026/27 -- IFK Tumba/Allsvenskan 2026-09-20, Handbollsligan
   * 2026-09-23; see lib/career/preseason.ts's REAL_LEAGUE_KICKOFF_DATES).
   * Immutable once set. `getSeasonPhase(state)` (preseason.ts) is a pure
   * comparison of `gameDate` against this field -- never a separately
   * mutated/stored phase flag that could drift out of sync (Part:
   * "PRESEASON ska inte betyda 'inga tävlingsmatcher'" -- cup/friendly
   * fixtures may freely exist and be played on either side of this date).
   * A career created before this milestone, or without an explicit
   * preseason-start choice, gets this set equal to its own `gameDate`
   * (Career Rhythm's pre-existing single-date assumption -- see
   * newCareer.ts), so `getSeasonPhase` always resolves COMPETITIVE_SEASON
   * for it, byte-identical to "this concept didn't exist yet."
   */
  leagueKickoffDate: string;

  // --- HM-CONTRACTS-1.0 addition (career-state schema v21, see saveMigration.ts) ---

  /**
   * Part 4: the ONE persistent economic-identity thread -- keyed by
   * playerId, same flat convention as `playerPhysicalState`/
   * `playerInjuries`. Only the two genuinely STICKY facts live here
   * (contractEndDate, wageEurPerMonth, set once at generation and never
   * silently rerolled); market VALUE is deliberately NOT stored --
   * lib/economy/marketValue.ts recomputes it fresh from CA/PA/age/role/
   * contract every read, so a developed player's value updates
   * automatically with zero extra bookkeeping. See
   * lib/economy/contractIntegration.ts for the only code that reads or
   * writes this field. HM-CONTRACTS-1.0A: EUR is the canonical currency
   * (`wageEurPerMonth`, previously `wageSekPerMonth` -- see
   * lib/economy/currency.ts for the one display-formatting boundary).
   */
  playerContracts: Record<string, PlayerContract>;

  // --- HM-CONTRACTS-1.0A addition (career-state schema v22, see saveMigration.ts) ---

  /**
   * Part: "en kompakt, persistent klubb-/utbildningshistorik" -- keyed
   * by playerId, same flat convention as `playerContracts`. Only PAST
   * (departed) clubs are stored here -- the player's current club is
   * already known via their own `clubId`. Deliberately generated,
   * provisional data (no real transfer/youth history exists for any
   * player in this project's sources) -- see
   * lib/economy/clubHistoryGeneration.ts. Feeds
   * lib/economy/trainingCompensationIntegration.ts's training-
   * compensation calculation ONLY -- never market value or any future
   * transfer fee.
   */
  playerClubHistory: Record<string, PlayerClubHistory>;

  // --- HM-ECONOMY-1.0 addition (career-state schema v23, see saveMigration.ts) ---

  /**
   * Part: "Alla klubbar som finns i career world ska få en persistent
   * ekonomisk baseline" -- keyed by clubId, one entry per club in this
   * career's own simulated competition (getClubsByCompetition(state.
   * competitionId), same enumeration newCareer.ts uses for fixtures).
   * Only the generated revenue/cash/owner-funding/academy/operating-cost
   * BASELINE is stored here -- the genuinely sticky facts, same
   * philosophy as PlayerContract. Actual wage/staff costs, financial
   * health, and every manager-facing budget (wage/transfer/staff/
   * academy) are deliberately NOT persisted -- they are recomputed fresh
   * from this baseline plus the club's own current contracts/staff every
   * read (lib/economy/clubEconomyIntegration.ts's `getClubEconomySnapshot`),
   * the same "never store what can be derived" precedent
   * computePlayerMarketValueEur established.
   */
  clubEconomies: Record<string, ClubEconomyBaseline>;

  // --- HM-TRANSFERS-1.0 addition (career-state schema v24, see saveMigration.ts) ---

  /**
   * Every submitted transfer/loan offer, keyed by its own id -- a full
   * negotiation history, not just the currently-open ones (Part: "det
   * ska gå att skilja på deal agreed / transfer completed / registered
   * / future arrival" -- the terminal `status` on each entry IS that
   * distinction). Resolved synchronously by
   * lib/transfers/transferIntegration.ts's `submitTransferOffer` in a
   * single call; `AGREED_AWAITING_WINDOW` entries are later completed
   * by that module's own `progressDailyTransfers` (called from
   * dailyTick.ts), same "check a stored date, mutate once" idiom as
   * player-availability returns.
   */
  transferOffers: Record<string, TransferOffer>;
  /**
   * Every loan ever created, keyed by its own id (== the originating
   * TransferOffer's id) -- `active: false` entries are history, not
   * deleted (Part: "det ska gå att skilja på..."). `progressDailyTransfers`
   * returns a player to `parentClubId` and flips `active` false once
   * `endDate` is reached.
   */
  loans: Record<string, LoanRecord>;

  // --- HM-DATA-ALLSVENSKAN-1.1B addition (career-state schema v25, see saveMigration.ts) ---

  /**
   * Part 3: Persistent Squad Status -- a manager-controlled, LONG-TERM
   * squad-role tier (see career/squadStatus.ts's SquadStatusTier),
   * keyed by playerId, same flat convention as `playerStatuses`/
   * `playerMatchDefaults`. Deliberately SEPARATE from `playerMatchDefaults`
   * (per-fixture MatchUsage/starting-lineup intent) and from
   * `playerStatuses` (medical/discipline availability) -- this is the
   * coach's own persistent opinion of a player's standing, editable at
   * any time, never re-derived by any other system after its initial
   * seed. Reserved for future consumers (contracts, morale, player
   * decisions, playing-time expectations) -- none of those consequences
   * exist yet.
   */
  playerSquadStatus: Record<string, SquadStatusTier>;

  // --- HM-DATA-ALLSVENSKAN-1.1B Parts 11/12/13 addition (career-state schema v25) ---

  /**
   * Knowledge / Fog-of-War foundation -- TRUE WORLD STATE -> MANAGER
   * KNOWLEDGE -> PLAYER-FACING VIEW (lib/knowledge/*). Deliberately
   * SPARSE: only carries a row for a club/player whose familiarity has
   * moved away from the default (see knowledgeIntegration.ts's own doc
   * -- the manager's own club/players never need a row at all, and an
   * external club/player nobody has specifically learned about reads as
   * DEFAULT_EXTERNAL_KNOWLEDGE_PCT with no stored entry either). Never a
   * second copy of canonical player/club data -- purely a 0-100
   * familiarity score per club/player, read by lib/knowledge's pure
   * resolver functions to redact/fuzz the real data for display.
   */
  clubKnowledge: Record<string, number>;
  playerKnowledge: Record<string, number>;
};

export type CareerSaveEnvelope = {
  schemaVersion: 2;
  career: CareerState;
};
