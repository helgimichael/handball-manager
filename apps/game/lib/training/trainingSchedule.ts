// HM-TRAINING-1.0 Part 3/17/18/19: the training WEEK -- deterministic
// template generation, fixture-aware adjustment, and the small set of
// pure edit operations the Training workspace UI drives. Mirrors
// lib/matchPlan/defaultMatchPlan.ts's own "one deterministic builder,
// never a second parallel one" discipline.
import { addDays } from "../career/dateUtils";
import type { CareerFixture, CareerState } from "../career/types";
import {
  type PlayerTrainingLoadSetting,
  type TrainingDay,
  type TrainingDayType,
  type TrainingSession,
  type TrainingSessionTarget,
  type TrainingSessionType,
  type TrainingIntensity,
  type TrainingDuration,
  type TrainingTacticalFocus,
  type TrainingWeek,
  type WeeklyTrainingTemplate,
} from "./types";

export const MAX_SESSIONS_PER_DAY = 2;

/** Monday of the ISO week containing `date` (Part 3: a canonical Monday-Sunday week). */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const offsetFromMonday = dow === 0 ? 6 : dow - 1;
  return addDays(date, -offsetFromMonday);
}

export interface SessionSeed {
  type: TrainingSessionType;
  intensity: TrainingIntensity;
  duration: TrainingDuration;
  target: TrainingSessionTarget;
  tacticalFocus?: TrainingTacticalFocus;
}

interface DayPlanSeed {
  dayType: TrainingDayType;
  sessions: readonly SessionSeed[];
}

const GK = (seed: SessionSeed): SessionSeed => seed; // no-op, readability marker for goalkeeper-targeted seeds below

/**
 * Part 17: five deterministic weekly templates, Monday(0)..Sunday(6).
 * The manager applies one, then edits individual days -- never a
 * schedule wizard. Fixture-awareness (Part 18/19) is layered on top in
 * `buildTrainingWeek`, never baked into these seeds themselves (a
 * template must stay a pure, fixture-agnostic "shape").
 */
const WEEKLY_TEMPLATE_SEEDS: Record<WeeklyTrainingTemplate, readonly DayPlanSeed[]> = {
  BALANCED: [
    { dayType: "TRAINING", sessions: [{ type: "TEAM_TACTICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL", tacticalFocus: "GENERAL" }] },
    { dayType: "TRAINING", sessions: [{ type: "PHYSICAL", intensity: "NORMAL", duration: "NORMAL", target: "OUTCOURT" }, GK({ type: "GOALKEEPER", intensity: "NORMAL", duration: "NORMAL", target: "GOALKEEPERS" })] },
    { dayType: "RECOVERY", sessions: [] },
    { dayType: "TRAINING", sessions: [{ type: "ATTACK", intensity: "NORMAL", duration: "NORMAL", target: "ALL", tacticalFocus: "ATTACK" }, { type: "DEFENCE", intensity: "NORMAL", duration: "NORMAL", target: "ALL", tacticalFocus: "DEFENCE" }] },
    { dayType: "TRAINING", sessions: [{ type: "TECHNICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL" }] },
    { dayType: "MATCH", sessions: [] },
    { dayType: "REST", sessions: [] },
  ],
  TACTICAL: [
    { dayType: "TRAINING", sessions: [{ type: "TEAM_TACTICAL", intensity: "NORMAL", duration: "LONG", target: "ALL", tacticalFocus: "ATTACK" }] },
    { dayType: "TRAINING", sessions: [{ type: "TEAM_TACTICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL", tacticalFocus: "DEFENCE" }] },
    { dayType: "RECOVERY", sessions: [] },
    { dayType: "TRAINING", sessions: [{ type: "TRANSITION", intensity: "NORMAL", duration: "NORMAL", target: "ALL", tacticalFocus: "TRANSITION" }, { type: "SPECIAL_PLAY", intensity: "LOW", duration: "SHORT", target: "ALL", tacticalFocus: "SPECIAL_PLAY" }] },
    { dayType: "TRAINING", sessions: [{ type: "TEAM_TACTICAL", intensity: "NORMAL", duration: "NORMAL", target: "ALL", tacticalFocus: "GENERAL" }] },
    { dayType: "MATCH", sessions: [] },
    { dayType: "REST", sessions: [] },
  ],
  PHYSICAL: [
    { dayType: "TRAINING", sessions: [{ type: "CONDITIONING", intensity: "HIGH", duration: "NORMAL", target: "OUTCOURT" }, GK({ type: "GOALKEEPER", intensity: "NORMAL", duration: "NORMAL", target: "GOALKEEPERS" })] },
    { dayType: "TRAINING", sessions: [{ type: "STRENGTH", intensity: "HIGH", duration: "NORMAL", target: "OUTCOURT" }] },
    { dayType: "RECOVERY", sessions: [{ type: "RECOVERY", intensity: "LOW", duration: "SHORT", target: "ALL" }] },
    { dayType: "TRAINING", sessions: [{ type: "CONDITIONING", intensity: "NORMAL", duration: "NORMAL", target: "ALL" }, { type: "TECHNICAL", intensity: "LOW", duration: "SHORT", target: "ALL" }] },
    { dayType: "TRAINING", sessions: [{ type: "STRENGTH", intensity: "NORMAL", duration: "SHORT", target: "OUTCOURT" }] },
    { dayType: "MATCH", sessions: [] },
    { dayType: "REST", sessions: [] },
  ],
  RECOVERY: [
    { dayType: "RECOVERY", sessions: [{ type: "RECOVERY", intensity: "LOW", duration: "NORMAL", target: "ALL" }] },
    { dayType: "TRAINING", sessions: [{ type: "TECHNICAL", intensity: "LOW", duration: "SHORT", target: "ALL" }] },
    { dayType: "REST", sessions: [] },
    { dayType: "RECOVERY", sessions: [{ type: "RECOVERY", intensity: "LOW", duration: "NORMAL", target: "ALL" }] },
    { dayType: "TRAINING", sessions: [{ type: "TEAM_TACTICAL", intensity: "LOW", duration: "SHORT", target: "ALL", tacticalFocus: "GENERAL" }] },
    { dayType: "MATCH", sessions: [] },
    { dayType: "REST", sessions: [] },
  ],
  MATCH_HEAVY: [
    { dayType: "RECOVERY", sessions: [{ type: "RECOVERY", intensity: "LOW", duration: "SHORT", target: "ALL" }] },
    { dayType: "TRAINING", sessions: [{ type: "MATCH_PREPARATION", intensity: "LOW", duration: "NORMAL", target: "ALL", tacticalFocus: "GENERAL" }] },
    { dayType: "MATCH", sessions: [] },
    { dayType: "RECOVERY", sessions: [{ type: "RECOVERY", intensity: "LOW", duration: "SHORT", target: "ALL" }] },
    { dayType: "TRAINING", sessions: [{ type: "MATCH_PREPARATION", intensity: "LOW", duration: "NORMAL", target: "ALL", tacticalFocus: "GENERAL" }] },
    { dayType: "MATCH", sessions: [] },
    { dayType: "REST", sessions: [] },
  ],
};

export const DEFAULT_WEEKLY_TEMPLATE: WeeklyTrainingTemplate = "BALANCED";

function toSession(date: string, index: number, seed: SessionSeed, matchPreparationFixtureId?: string): TrainingSession {
  return {
    id: `${date}:s${index}`,
    type: seed.type,
    intensity: seed.intensity,
    duration: seed.duration,
    target: seed.target,
    tacticalFocus: seed.tacticalFocus,
    matchPreparationFixtureId: seed.type === "MATCH_PREPARATION" ? matchPreparationFixtureId : undefined,
    coachId: null,
  };
}

function fixtureOn(fixtures: readonly CareerFixture[], clubId: string, date: string): CareerFixture | undefined {
  return fixtures.find((f) => f.date === date && (f.homeClubId === clubId || f.awayClubId === clubId));
}

/**
 * Part 3/17/18/19: builds one deterministic TrainingWeek for `weekStart`
 * (must be a Monday). Any day that is itself a fixture day for `clubId`
 * is forced to `dayType: "MATCH"` with zero sessions, regardless of the
 * template (Part 4). Any day IMMEDIATELY BEFORE such a fixture is
 * downgraded to a single low-intensity MATCH_PREPARATION session,
 * regardless of what the template would otherwise schedule there (Part
 * 18: "Friday should not remain HIGH CONDITIONING if a match is
 * Saturday") -- this also correctly handles a two-match week (Part 19),
 * since the check runs independently for every day.
 */
export function buildTrainingWeek(weekStart: string, fixtures: readonly CareerFixture[], clubId: string, template: WeeklyTrainingTemplate = DEFAULT_WEEKLY_TEMPLATE): TrainingWeek {
  const seeds = WEEKLY_TEMPLATE_SEEDS[template];
  const days: TrainingDay[] = [];

  for (let i = 0; i < 7; i += 1) {
    const date = addDays(weekStart, i);
    const fixtureToday = fixtureOn(fixtures, clubId, date);

    if (fixtureToday) {
      days.push({ date, dayType: "MATCH", sessions: [], executed: false });
      continue;
    }

    const fixtureTomorrow = fixtureOn(fixtures, clubId, addDays(date, 1));
    if (fixtureTomorrow) {
      const prepSeed: SessionSeed = { type: "MATCH_PREPARATION", intensity: "LOW", duration: "NORMAL", target: "ALL", tacticalFocus: "GENERAL" };
      days.push({ date, dayType: "TRAINING", sessions: [toSession(date, 0, prepSeed, fixtureTomorrow.id)], executed: false });
      continue;
    }

    const seed = seeds[i];
    const sessions = seed.sessions.slice(0, MAX_SESSIONS_PER_DAY).map((s, idx) => toSession(date, idx, s));
    days.push({ date, dayType: seed.dayType, sessions, executed: false });
  }

  return { weekStart, days };
}

/**
 * Part 3/20: pure, read-only resolution -- returns the STORED week if
 * one exists, otherwise deterministically generates one (never
 * persisting it). Used by the Training UI so a brand-new career (before
 * the first CONTINUE press has ever executed a training day) still
 * shows a real, non-empty week (Part 28) rather than requiring a write
 * first.
 */
export function resolveTrainingWeek(state: CareerState, weekStart: string, template: WeeklyTrainingTemplate = DEFAULT_WEEKLY_TEMPLATE): TrainingWeek {
  return state.trainingWeeks[weekStart] ?? buildTrainingWeek(weekStart, state.fixtures, state.playerClubId, template);
}

/** Persists `resolveTrainingWeek`'s result into `state.trainingWeeks` if it wasn't already stored -- the write half of the read/write pair above. Never overwrites an existing (possibly edited/executed) week. */
export function ensureTrainingWeek(state: CareerState, weekStart: string, template: WeeklyTrainingTemplate = DEFAULT_WEEKLY_TEMPLATE): CareerState {
  if (state.trainingWeeks[weekStart]) return state;
  const week = buildTrainingWeek(weekStart, state.fixtures, state.playerClubId, template);
  return { ...state, trainingWeeks: { ...state.trainingWeeks, [weekStart]: week } };
}

// ---------------------------------------------------------------------------
// Part 24: the small set of pure edit operations the Training workspace
// UI drives. Every function takes and returns a whole TrainingWeek --
// callers persist via CareerState.trainingWeeks, same "pure edit,
// caller writes it back" discipline as lib/matchPlan/matchPlanEdits.ts.
// ---------------------------------------------------------------------------

/** `fn` is never invoked for a day that has already executed (Part 20/22: a manager cannot retroactively edit -- and therefore cannot cause a re-execution of -- a day whose load was already applied). */
function mapDay(week: TrainingWeek, date: string, fn: (day: TrainingDay) => TrainingDay): TrainingWeek {
  return { ...week, days: week.days.map((d) => (d.date === date && !d.executed ? fn(d) : d)) };
}

/** Changing a day's type clears its sessions whenever the new type structurally cannot carry any (REST/MATCH/TRAVEL) -- Part 4. */
export function setTrainingDayType(week: TrainingWeek, date: string, dayType: TrainingDayType): TrainingWeek {
  return mapDay(week, date, (day) => ({ ...day, dayType, sessions: dayType === "REST" || dayType === "MATCH" || dayType === "TRAVEL" ? [] : day.sessions }));
}

export function addTrainingSession(week: TrainingWeek, date: string, seed: SessionSeed): TrainingWeek {
  return mapDay(week, date, (day) => {
    if (day.dayType === "REST" || day.dayType === "MATCH" || day.dayType === "TRAVEL") return day;
    if (day.sessions.length >= MAX_SESSIONS_PER_DAY) return day;
    return { ...day, sessions: [...day.sessions, toSession(date, day.sessions.length, seed)] };
  });
}

export function removeTrainingSession(week: TrainingWeek, date: string, sessionId: string): TrainingWeek {
  return mapDay(week, date, (day) => ({ ...day, sessions: day.sessions.filter((s) => s.id !== sessionId) }));
}

export function updateTrainingSession(week: TrainingWeek, date: string, sessionId: string, patch: Partial<Pick<TrainingSession, "type" | "intensity" | "duration" | "target" | "selectedPlayerIds" | "tacticalFocus">>): TrainingWeek {
  return mapDay(week, date, (day) => ({ ...day, sessions: day.sessions.map((s) => (s.id === sessionId ? { ...s, ...patch } : s)) }));
}

/** Part 12: sets one player's persistent individual load setting. */
export function setPlayerTrainingLoad(state: CareerState, playerId: string, loadSetting: PlayerTrainingLoadSetting): CareerState {
  const existing = state.playerTrainingAssignments[playerId];
  return {
    ...state,
    playerTrainingAssignments: {
      ...state.playerTrainingAssignments,
      [playerId]: { playerId, loadSetting, individualFocus: existing?.individualFocus ?? null },
    },
  };
}

/** HM-TRAINING-1.1 Part 8/29: sets one player's persistent individual development focus (a string here to avoid a load-bearing lib/training -> lib/development dependency -- see PlayerTrainingAssignment's own doc comment; callers pass a real IndividualDevelopmentFocus value). */
export function setPlayerIndividualFocus(state: CareerState, playerId: string, individualFocus: string | null): CareerState {
  const existing = state.playerTrainingAssignments[playerId];
  return {
    ...state,
    playerTrainingAssignments: {
      ...state.playerTrainingAssignments,
      [playerId]: { playerId, loadSetting: existing?.loadSetting ?? "FULL", individualFocus },
    },
  };
}
