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
import type { MatchFitnessLedger } from "../players/matchFitness";
import type { TeamRoles } from "./teamRoles";
import type { OpponentScoutingState } from "../scouting/opponentScouting";
import type { PreseasonEvent } from "./preseasonPlanning";
import type { LiveMatchSessionState } from "../liveMatch/liveMatchSession";
import type { MatchPhysicalReport } from "../matchPlan/physicalModel";
import type { PlayerPhysicalState, PlayerTrainingAssignment, TrainingWeek } from "../training/types";
import type { WorkloadLedger } from "../training/workloadLedger";
import type { PlayerDevelopmentState } from "../development/types";
import type { ResolvedStaffMember, StaffEmployment } from "../staff/types";
import type { StaffClubHistory } from "../staff/staffHistoryTypes";
import type { PlayerInjuryState } from "../medical/types";
import type { IncomingOffer, PlayerDynamicsState, PreContract, RenewalTalk } from "../players/types";
import type { DelegationState } from "../delegation/types";
import type { MediaState } from "../media/types";
import type { NationalTeamState } from "../nationalTeam/nationalTeam";
import type { BoardState, ManagerCareerState } from "../board/types";
import type { PlayerClubHistory, PlayerContract } from "../economy/types";
import type { ClubEconomyBaseline } from "../economy/clubEconomyTypes";
import type { LoanRecord, TransferNegotiation, TransferOffer } from "../transfers/types";
import type { ScoutingAssignment, ScoutReport } from "./scouting";
import type { ScoutDiscovery } from "./scoutDiscovery";
import type { RecruitmentTarget } from "./recruitment";
import type { ClubPartnership, PartnershipSearchAssignment } from "./clubPartnerships";
import type { PlayerPlacement } from "./playerPlacements";
import type { CpuDecisionLogEntry, CpuRecruitmentPlan } from "./cpuRecruitment";
import type { ScoutPoolSourceEntry } from "../staff/scoutPool";
import type { BudgetPlan, ClubFinanceState } from "../economy/ledgerTypes";
import type { CompetitionTie, SeasonOutcome } from "../competition/types";
import type { StaffMarketState } from "../staff/staffMarket";
import type { StaffNegotiation } from "../staff/staffNegotiation";
import type { StaffRole } from "../staff/types";

/** HM-PRESEASON-1.0: LEAGUE (a simulated league), CUP (the provisional early cup round -- see preseason.ts -- and, from HM-ALPHA3-M03, Svenska cupen ties), or FRIENDLY (manager-booked, never affects standings/season completion). HM-ALPHA3-M03: PLAYOFF (SM-slutspel) and QUALIFIER (kval) games. Only LEAGUE fixtures ever feed a table. */
export type CareerFixtureType = "LEAGUE" | "CUP" | "FRIENDLY" | "PLAYOFF" | "QUALIFIER";

/** HM-ALPHA3-M03: where a knockout or series game belongs. Present only on PLAYOFF / QUALIFIER / tournament CUP fixtures. */
export interface FixtureStage {
  /** The tie (series or two-legged tie) this game belongs to -- see lib/competition/postseason.ts. */
  tieId: string;
  /** 1-based game number within the tie. */
  game: number;
  /** True when this game may not end level (series games; the second leg of a two-legged tie; cup knockout games). */
  mustDecide: boolean;
}

export type CareerFixture = {
  id: string;
  competitionId: string;
  round: number;
  date: string; // ISO date
  homeClubId: string;
  awayClubId: string;
  type: CareerFixtureType;
  /** HM-ALPHA2-01: local (Europe/Stockholm) kickoff "HH:MM" -- only real Profixio schedule fixtures carry one. */
  kickoffTime?: string;
  /** HM-ALPHA2-01: the original Profixio match id of a real schedule fixture. */
  sourceMatchId?: string;
  /** Original date when an unplayed league fixture is coordinated with a fixed cup slot. */
  originalDate?: string;
  scheduleNote?: string;
  stage?: FixtureStage;
  /** HM-PLAYTEST-01 3.1: a friendly at a neutral venue names its location. */
  location?: string;
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
  productionMatch?: import('./productionMatch').ProductionMatchSession | null;
  matchArchives?: Record<string, import('./productionMatch').PlayedMatchArchive>;
  matchArchiveIds?: string[];
  matchArchiveSummaries?: Record<string, import('./matchArchiveSummary').MatchArchiveSummary>;
  /** Additive optional receipt: older saves require no inferred transition evidence. */
  swedishContinuity?: import('../competition/transition/gameContinuity').SwedishContinuityState;
  lastSeasonTransition?: import('./seasonTransition').SeasonTransitionReceipt;
  /** Reviewed inputs for the existing planner/gate, preserved verbatim across save/load. Never inferred from club strength. */
  seasonTransitionRequest?: import('./seasonTransition').SeasonTransitionRequest;
  seasonHistory?: { seasonId: string; competitionId: string; table: import('@handball-manager/game-simulation').StandingRow[]; stats: Record<string, PlayerSeasonStats>; /** HM-ALPHA3-M03 */ outcome?: SeasonOutcome; tables?: Record<string, import('@handball-manager/game-simulation').StandingRow[]>; ties?: CompetitionTie[]; fixtures?: readonly CareerFixture[]; results?: Readonly<Record<string, FastMatchResult>>; transition?: { receipt: import('./seasonTransition').SeasonTransitionReceipt; preview: import('../competition/transition/preview').SeasonTransitionPreview; evidence: import('./seasonTransition').SeasonTransitionEvidence } }[];
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

  /**
   * HM-ALPHA2-01: "MANUAL" for careers created through New Game from this
   * milestone on -- the manager's own starting seven and bench start
   * empty for every fixture and are never filled in automatically (see
   * lib/career/manualLineup.ts). Absent on every older save, which keeps
   * the legacy behaviour of a generated default plan when no plan was
   * saved, so existing careers keep the selections they already had.
   * CPU clubs always use automatic selection either way.
   */
  lineupSelection?: "MANUAL";

  /** HM-ALPHA3-M10: the manager's last saved selection of the previous season, carried into the new one (seasonRollover). */
  preferredLineup?: MatchPlan;

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
   * HM-ALPHA2-02A: bounded per-player match + training workload history in
   * one unit (lib/training/workloadLedger.ts). Absent on older saves and
   * created lazily on the first recorded day or match -- no migration.
   */
  workloadLedger?: WorkloadLedger;
  /** HM-PLAYTEST-01 3.2: match fitness (matchträning), separate from energy and form. See lib/players/matchFitness.ts. */
  playerMatchFitness?: MatchFitnessLedger;
  /**
   * HM-PLAYTEST-01 2.4/2.5: standing team responsibilities, kept across
   * matches and seasons: captain, vice-captain and the 7-metre order.
   */
  teamRoles?: TeamRoles;
  /** HM-PLAYTEST-01 4.1: opponent scouting requests, delegation and reports (lib/scouting/opponentScouting.ts). */
  opponentScouting?: OpponentScoutingState;
  /** HM-PLAYTEST-01 3.1: booked training camps, trips abroad and friendly tournaments. */
  preseasonEvents?: PreseasonEvent[];
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
   * Sweden 2026/27 -- Herrallsvenskan 2026-09-17, Handbollsligan
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

  // --- HM-ALPHA3-M02: monthly club ledger (optional; started lazily by the daily tick, never retroactively) ---
  /** Per-club ledger state: closed monthly statements, pending one-off transactions, financial status. Absent on older saves until the first processed day. */
  clubFinances?: Record<string, ClubFinanceState>;
  /** The manager's own adjustments to the board's season budget, keyed by club id. */
  budgetPlans?: Record<string, BudgetPlan>;
  /** HM-ALPHA3-M03: competition membership after promotion/relegation, keyed by club id. Absent = the static league in lib/game-data. Read through lib/career/competitionMembership.ts. */
  competitionMembership?: Record<string, string>;
  /** HM-ALPHA3-M03: SM-slutspel, kval and Svenska cupen ties of the current season (lib/competition). */
  competitionTies?: Record<string, CompetitionTie>;
  /** HM-ALPHA3-M03: the current season's competitive state -- phase, winners, promotion/relegation, awards. */
  seasonOutcome?: SeasonOutcome;
  // --- HM-ALPHA3-M04: staff market, knowledge, negotiations (lib/staff) ---
  staffMarket?: StaffMarketState;
  /** Researched knowledge (0-100) of people outside the club. */
  staffKnowledge?: Record<string, number>;
  staffResearch?: Record<string, { startedOn: string; readyOn: string; byStaffId: string }>;
  staffNegotiations?: Record<string, StaffNegotiation>;
  /** Recent appointments and departures for Moments and the organisation timeline. */
  staffAppointments?: { staffId: string; clubId: string; role: StaffRole; date: string; kind: "APPOINTED" | "RENEWED" | "LEFT" | "DISMISSED" }[];
  // --- HM-ALPHA3-M05: player dynamics and the selling side of the market (lib/players) ---
  /** Morale, promises, player talks, transfer requests, the transfer list and recent departures of the manager's players. */
  playerDynamics?: PlayerDynamicsState;
  /** Bids from other clubs for the manager's players, keyed by id. */
  incomingOffers?: Record<string, IncomingOffer>;
  /** HM-PLAYTEST-IMPROVEMENT-05: Require final manager approval before completing outgoing transfers. Defaults to true. */
  requireFinalTransferApproval?: boolean;
  /** Contract renewal negotiations with the manager's players, keyed by id. */
  renewalTalks?: Record<string, RenewalTalk>;
  /** Pre-contract agreements: the player leaves for another club when his contract ends. Keyed by player id. */
  preContracts?: Record<string, PreContract>;
  // --- HM-ALPHA3-M06: delegation of responsibilities (lib/delegation) ---
  delegation?: DelegationState;
  // --- HM-ALPHA3-M08: the living world's media -- stories, press conferences, relationships, discipline (lib/media) ---
  media?: MediaState;
  // --- HM-ALPHA3-M08 (8E): national-team windows -- call-ups, results, returns (lib/nationalTeam) ---
  nationalTeam?: NationalTeamState;
  // --- HM-ALPHA3-M10: salary formula version the unnegotiated wages were set against (lib/economy/contractIntegration migrateContractWages) ---
  contractWageFormulaVersion?: number;
  // --- HM-ALPHA3-M07: the board and the manager's own career (lib/board, lib/manager) ---
  /** The current employer's board: objectives, confidence, meetings. Rebuilt when the manager changes club. */
  board?: BoardState;
  /** Reputation, contract, history, job market. Created lazily for older saves. */
  managerCareer?: ManagerCareerState;

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
  /**
   * HM-ALPHA2-05A: the manager's two-stage permanent-transfer
   * negotiations (lib/transfers/negotiationIntegration.ts), keyed by id
   * and kept as history once closed. Optional -- a pre-05A save simply
   * has none, and every reader treats `undefined` as empty.
   */
  transferNegotiations?: Record<string, TransferNegotiation>;

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

  // --- HM-SCOUTING-1.1 addition: widens the same knowledge foundation
  // to competition and country/nation entities -- see
  // lib/knowledge/knowledgeIntegration.ts's own doc. Same sparse-storage
  // convention as above. ---
  competitionKnowledge: Record<string, number>;
  countryKnowledge: Record<string, number>;

  // --- HM-SCOUTING-1.0 addition ---

  /**
   * The real scouting loop this milestone builds: ASSIGN SCOUT -> TIME
   * PASSES -> KNOWLEDGE INCREASES -> REPORT -> BETTER MANAGER VIEW (see
   * lib/career/scouting.ts's own header). Keyed by assignment id.
   */
  scoutingAssignments: Record<string, ScoutingAssignment>;
  /** Persistent, historical scout reports -- never regenerated/rerolled on read, only ever appended by progressScoutingAssignments. Keyed by report id. */
  scoutReports: Record<string, ScoutReport>;

  // --- HM-SCOUTING-1.1 addition ---

  /**
   * Discovery/recruitment extension of the same loop: a broad (CLUB/
   * COMPETITION/REGION/POSITION/AGE_BAND) assignment produces
   * ScoutDiscovery rows over time instead of a single ScoutReport --
   * see lib/career/scoutDiscovery.ts. Keyed by discovery id. Deliberately
   * a SEPARATE, lighter-weight entity from ScoutReport: a discovery only
   * ever means "this player now exists on the manager's radar", never a
   * substitute for the deeper PLAYER-assignment report/confidence.
   */
  scoutDiscoveries: Record<string, ScoutDiscovery>;

  // --- HM-CLUB-PARTNERSHIPS-1.0 addition ---

  /**
   * Every club-to-club partnership row (permanent B-team, development,
   * or international loan), keyed by id. The five canonical
   * AFFILIATED_B_TEAM rows are seeded once, idempotently, by
   * seedPermanentBTeamPartnerships (newCareer.ts / saveMigration.ts) and
   * never removed. See lib/career/clubPartnerships.ts for the full
   * domain.
   */
  clubPartnerships: Record<string, ClubPartnership>;
  /** The board's own multi-day "search for a development partner" process, keyed by id. */
  partnershipSearches: Record<string, PartnershipSearchAssignment>;

  // --- HM-STAFF-SCOUT-POOL-1.0 addition ---

  /**
   * The full, permanent 100-entry real-person scout source pool (see
   * lib/staff/scoutPool.ts's own provenance-separation doc), keyed by
   * personId. Seeded once by seedScoutPool and never mutated afterward
   * regardless of employment state -- this is the audit/eligibility
   * record, independent of `scoutMarket` below.
   */
  scoutPoolSource: Record<string, ScoutPoolSourceEntry>;
  /**
   * Only the CURRENTLY AVAILABLE free-agent scouts (LIKELY_ELIGIBLE at
   * seed time, not yet signed by any club), keyed by personId. Signing
   * one (signFreeAgentScout) removes them from here and adds them to
   * staffRoster/staffEmployment like any other staff member -- this map
   * only ever holds unemployed candidates.
   */
  scoutMarket: Record<string, ResolvedStaffMember>;

  // --- HM-RECRUITMENT-1.1 addition ---

  /**
   * Manager INTENT over a recruitment candidate -- shortlist/priority/
   * note -- never player-data truth (see lib/career/recruitment.ts's own
   * doc). Deliberately SPARSE: a row is only ever created the first time
   * a manager actually shortlists/prioritizes/annotates a player; a
   * player who is merely discovered/scouted has no row here at all until
   * the manager takes one of those actions. Keyed by playerId.
   */
  recruitmentTargets: Record<string, RecruitmentTarget>;

  // --- HM-CLUB-PARTNERSHIPS-1.1 addition ---

  /**
   * Player Development Placements -- the actual movement mechanism for
   * AFFILIATED_B_TEAM/DEVELOPMENT_PARTNERSHIP exposure (HM-CLUB-
   * PARTNERSHIPS-1.0's own isPartnershipExposureEligible never moved
   * anyone). Keyed by id. See lib/career/playerPlacements.ts for the
   * full domain -- the player's contract/wage/owning club/worldSquads
   * membership never change for a domestic placement; only
   * PlayerAvailability (ON_PLACEMENT) and playerDevelopmentState do.
   */
  playerPlacements: Record<string, PlayerPlacement>;

  // --- HM-CPU-SQUAD-BUILDING-1.0 addition ---

  /**
   * Autonomous CPU club recruitment -- one row per (clubId, position)
   * pursuit, keyed by `${clubId}:${position}`. Never duplicates
   * TransferOffer state (only `offerId` references it). See
   * lib/career/cpuRecruitment.ts for the full domain. Never contains a
   * row for `playerClubId` (the human manager's own club is never
   * CPU-controlled).
   */
  cpuRecruitmentPlans: Record<string, CpuRecruitmentPlan>;
  /** Per-CPU-club next squad-review date (ISO), so recruitment scoring runs as a lightweight rotating schedule, never a full every-club-every-day scan. */
  cpuClubEvaluationSchedule: Record<string, string>;
  /** Bounded (most-recent-first, capped), explainable trail of CPU squad-need/candidate/contract decisions -- see lib/career/cpuRecruitment.ts's own doc. Debug/explainability only, never read by game logic. */
  cpuDecisionLog: readonly CpuDecisionLogEntry[];

  // --- HM-YOUTH-INTAKE-1.0 addition ---

  /**
   * The most recent intake YEAR (as `"YYYY"`) already generated for each
   * eligible clubId -- the sole guard against generating two intakes for
   * the same club in the same season (see lib/career/youthIntake.ts's
   * own `progressYouthIntake`). Never backfilled retroactively for a
   * migrated old save (Part 19: "Do not retroactively generate five
   * missed intakes on load") -- a club simply becomes eligible again the
   * next time 1 July passes after migration.
   */
  youthIntakeClubYears: Record<string, string>;

  // --- HM-PLAYER-CAREER-LIFECYCLE-1.0 addition ---

  /**
   * The most recent YEAR (as `"YYYY"`) each playerId was already
   * evaluated for ageing decline / retirement -- the sole guard against
   * double-processing the same player in the same annual lifecycle
   * evaluation (see lib/career/playerLifecycle.ts's own
   * `progressPlayerLifecycle`). Never backfilled retroactively for a
   * migrated old save, same conservative precedent as
   * `youthIntakeClubYears` -- a player simply becomes eligible again the
   * next time the evaluation date passes after migration.
   */
  playerLifecycleYears: Record<string, string>;
  /**
   * HM-PLAYER-DEVELOPMENT-2.0 PHASE 1B: the last world-development period
   * (e.g. "2027-Q2") each player was developed in. The idempotency identity is
   * PLAYER + PERIOD, deliberately not player + club, so a mid-season transfer
   * neither develops a player twice nor drops them out of development because
   * their club changed. Same shape and lifecycle as `playerLifecycleYears`.
   * Absent on pre-1B saves; saveMigration defaults it to {}.
   */
  worldDevelopmentPeriods: Record<string, string>;
};

export type CareerSaveEnvelope = {
  schemaVersion: 2;
  career: CareerState;
};
