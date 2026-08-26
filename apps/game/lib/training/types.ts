// HM-TRAINING-1.0: the training domain's own vocabulary. This module
// defines VAD SPELARNA TRÄNAR (what) + HUR MYCKET DE BELASTAS (how much)
// + NÄR TRÄNINGEN SKER (when) -- see trainingLoad.ts for the load/
// recovery math, trainingSchedule.ts for week generation/editing, and
// trainingExecution.ts for turning a scheduled day into an actual,
// persisted result. Deliberately NOT player development -- see this
// package's own module docs for the explicit non-goals of this
// milestone (no attribute/CA/PA growth, no injuries, no staff effects).

/**
 * TRAINING: a normal day carrying 1-2 real sessions.
 * RECOVERY: a light day -- zero or one low-load/RECOVERY-type session,
 *   net energy-positive regardless.
 * REST: zero sessions, structurally -- the biggest net recovery.
 * MATCH: a fixture day. Never carries a scheduled session (Part 4: "a
 *   matchday cannot accidentally carry a normal hard training load") --
 *   physical load for this day comes entirely from the match simulation
 *   itself (lib/matchPlan/physicalModel.ts), never from this module.
 * TRAVEL: reserved for a future away-fixture-distance model this
 *   codebase does not have yet (the audit found no travel/distance data
 *   anywhere in calendar.ts) -- the manager can still mark a day TRAVEL
 *   by hand, and it behaves like a mild REST day for load purposes, but
 *   nothing in this milestone ever assigns it automatically.
 */
export const TRAINING_DAY_TYPES = ["TRAINING", "RECOVERY", "REST", "MATCH", "TRAVEL"] as const;
export type TrainingDayType = (typeof TRAINING_DAY_TYPES)[number];

/** Part 5: a deliberately small vocabulary -- no per-drill detail. */
export const TRAINING_SESSION_TYPES = [
  "TEAM_TACTICAL",
  "ATTACK",
  "DEFENCE",
  "TRANSITION",
  "SPECIAL_PLAY",
  "TECHNICAL",
  "PHYSICAL",
  "STRENGTH",
  "CONDITIONING",
  "GOALKEEPER",
  "MATCH_PREPARATION",
  "RECOVERY",
] as const;
export type TrainingSessionType = (typeof TRAINING_SESSION_TYPES)[number];

export const TRAINING_INTENSITIES = ["LOW", "NORMAL", "HIGH", "VERY_HIGH"] as const;
export type TrainingIntensity = (typeof TRAINING_INTENSITIES)[number];

export const TRAINING_DURATIONS = ["SHORT", "NORMAL", "LONG"] as const;
export type TrainingDuration = (typeof TRAINING_DURATIONS)[number];

/** Part 14: who a session's physical load/participation applies to. */
export const TRAINING_SESSION_TARGETS = ["ALL", "OUTCOURT", "GOALKEEPERS", "SELECTED_PLAYERS"] as const;
export type TrainingSessionTarget = (typeof TRAINING_SESSION_TARGETS)[number];

/** Part 15/16: which tactical phase a TEAM_TACTICAL or MATCH_PREPARATION session is about -- persisted stimulus only, no familiarity/bonus effect yet (that's HM-TRAINING-1.1's job). */
export const TRAINING_TACTICAL_FOCUSES = ["GENERAL", "ATTACK", "DEFENCE", "TRANSITION", "SPECIAL_PLAY"] as const;
export type TrainingTacticalFocus = (typeof TRAINING_TACTICAL_FOCUSES)[number];

/** Part 12/13: a player's own individual load adjustment -- persistent until changed, same "standing instruction" precedent as `playerMatchDefaults`. */
export const PLAYER_TRAINING_LOAD_SETTINGS = ["FULL", "REDUCED", "RECOVERY_ONLY", "REST"] as const;
export type PlayerTrainingLoadSetting = (typeof PLAYER_TRAINING_LOAD_SETTINGS)[number];

export interface TrainingSession {
  /** Deterministic, date-scoped: `${date}:s${index}`. */
  id: string;
  type: TrainingSessionType;
  intensity: TrainingIntensity;
  duration: TrainingDuration;
  target: TrainingSessionTarget;
  /** Only meaningful when `target === "SELECTED_PLAYERS"`. */
  selectedPlayerIds?: readonly string[];
  /** Only meaningful for TEAM_TACTICAL/MATCH_PREPARATION -- Part 15/16. */
  tacticalFocus?: TrainingTacticalFocus;
  /** Only meaningful for MATCH_PREPARATION -- Part 16: "this training was preparation for fixture X". */
  matchPreparationFixtureId?: string;
  /** Part 23: reserved for a future staff-influence system. Always null in HM-TRAINING-1.0 -- no bonus is ever computed from it yet. */
  coachId: string | null;
}

/** Part 21: what actually happened when a session executed -- compact, per-session, never a full minute-by-minute log. */
export interface TrainingSessionResult {
  sessionId: string;
  date: string;
  participants: readonly string[];
  /** Energy delta actually applied per participant -- negative = load, positive = a RECOVERY-type session's net gain. */
  loadByPlayer: Record<string, number>;
  preEnergyByPlayer: Record<string, number>;
  postEnergyByPlayer: Record<string, number>;
}

export interface TrainingDay {
  date: string;
  dayType: TrainingDayType;
  /** Max 2 (Part 3). Always empty for REST/MATCH/TRAVEL. */
  sessions: readonly TrainingSession[];
  /** Part 20/22: idempotency flag -- once true, executeTrainingDay never re-applies this day's load. */
  executed: boolean;
  /** Present only once `executed` is true. */
  results?: readonly TrainingSessionResult[];
}

export interface TrainingWeek {
  /** Monday, ISO date. */
  weekStart: string;
  /** Always exactly 7 entries, Monday through Sunday. */
  days: readonly TrainingDay[];
}

export const WEEKLY_TRAINING_TEMPLATES = ["BALANCED", "TACTICAL", "PHYSICAL", "RECOVERY", "MATCH_HEAVY"] as const;
export type WeeklyTrainingTemplate = (typeof WEEKLY_TRAINING_TEMPLATES)[number];

/** Part 10/18: a player's persistent physical/readiness state -- the one continuous thread between match energy, training load, and the NEXT match's own starting energy. */
export interface PlayerPhysicalState {
  playerId: string;
  /** 0-100, same scale as lib/matchPlan/physicalModel.ts. */
  currentEnergy: number;
  lastUpdatedDate: string;
  /** A simple decaying magnitude of recent load (not a history log) -- foundation for a future workload/injury-risk system, unused for any effect in HM-TRAINING-1.0 itself. */
  recentLoad: number;
}

/** Part 13: a minimal, future-proof individual-training record. */
export interface PlayerTrainingAssignment {
  playerId: string;
  loadSetting: PlayerTrainingLoadSetting;
  /**
   * HM-TRAINING-1.1: the manager's chosen individual development emphasis
   * (see lib/development/types.ts's IndividualDevelopmentFocus -- a
   * deliberately different, smaller vocabulary from TrainingSessionType,
   * since a focus is a development TARGET, not a session to schedule).
   * Typed as a plain string here (rather than importing IndividualDevelopmentFocus)
   * to avoid lib/training -> lib/development becoming a load-bearing
   * runtime dependency; callers narrow/validate against the real union.
   * Null/omitted means no emphasis (HM-TRAINING-1.0's own default for
   * every existing player, preserved as this milestone's safe default).
   */
  individualFocus?: string | null;
}
