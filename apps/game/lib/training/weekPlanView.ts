// Arena Nights TRN-01/01a/01b/01e: pure view model for the training week
// block planner. Reads the training model's own load formula
// (trainingLoad.ts) -- never changes it -- to size blocks and load bars,
// diffs a live week against an assistant proposal, and summarises an
// executed day's stored results. No CareerState, no React.
import { computeSessionEnergyDelta } from "./trainingLoad";
import type { TrainingDay, TrainingDayType, TrainingSession, TrainingSessionType, TrainingWeek } from "./types";

export type SessionTone = "tactical" | "physical" | "technical" | "recovery";

export function sessionCategory(type: TrainingSessionType): { label: string; tone: SessionTone } {
  switch (type) {
    case "TEAM_TACTICAL":
    case "ATTACK":
    case "DEFENCE":
    case "TRANSITION":
    case "SPECIAL_PLAY":
    case "MATCH_PREPARATION":
      return { label: "Taktik & lagspel", tone: "tactical" };
    case "PHYSICAL":
    case "STRENGTH":
    case "CONDITIONING":
      return { label: "Fysik & kondition", tone: "physical" };
    case "RECOVERY":
      return { label: "Återhämtning", tone: "recovery" };
    default:
      return { label: "Teknik & individuell", tone: "technical" };
  }
}

/** rating/types.ts's 1-20 midpoint -- the same neutral stamina the execution step falls back to. */
export const NEUTRAL_STAMINA = 10.5;

/** One full-load player's energy delta for a session at neutral stamina (negative = cost). */
export function sessionTeamLoad(session: Pick<TrainingSession, "type" | "intensity" | "duration">): number {
  return computeSessionEnergyDelta(session.type, session.intensity, session.duration, NEUTRAL_STAMINA);
}

export type LoadBand = "none" | "light" | "moderate" | "heavy";

export interface DayLoad {
  /** Energy cost of the day's sessions (positive number). */
  cost: number;
  /** Energy returned by RECOVERY-type sessions (positive number). */
  gain: number;
  band: LoadBand;
  /** 0-100 width for the per-day load bar. */
  percent: number;
}

/** Day cost at which the load bar is full: two long, very hard conditioning sessions are ~56. */
export const DAY_LOAD_FULL_SCALE = 40;

export function loadBand(cost: number): LoadBand {
  if (cost <= 0.05) return "none";
  if (cost < 8) return "light";
  if (cost < 16) return "moderate";
  return "heavy";
}

export function dayLoad(day: Pick<TrainingDay, "dayType" | "sessions">): DayLoad {
  if (day.dayType !== "TRAINING" && day.dayType !== "RECOVERY") return { cost: 0, gain: 0, band: "none", percent: 0 };
  let cost = 0;
  let gain = 0;
  for (const s of day.sessions) {
    const delta = sessionTeamLoad(s);
    if (delta < 0) cost += -delta;
    else gain += delta;
  }
  const round = (n: number) => Math.round(n * 10) / 10;
  return { cost: round(cost), gain: round(gain), band: loadBand(cost), percent: Math.min(100, Math.round((cost / DAY_LOAD_FULL_SCALE) * 100)) };
}

export function weekLoad(week: Pick<TrainingWeek, "days">): number {
  return Math.round(week.days.reduce((n, d) => n + dayLoad(d).cost, 0) * 10) / 10;
}

/** A day the planner can still change: not executed and not yet processed by the calendar. */
export function isTrainingDayLocked(day: Pick<TrainingDay, "date" | "executed">, processedThroughDate: string | undefined, gameDate: string): boolean {
  return day.executed || day.date <= (processedThroughDate ?? "") || day.date < gameDate;
}

// ---------------------------------------------------------------- diff (TRN-01a)

export type SlotDiffKind = "same" | "added" | "removed" | "changed";

export interface SlotDiff {
  index: number;
  kind: SlotDiffKind;
  before?: TrainingSession;
  after?: TrainingSession;
  /** Swedish field names that differ ("Passtyp", "Intensitet" ...). */
  changes: string[];
}

export interface DayDiff {
  date: string;
  locked: boolean;
  dayTypeBefore: TrainingDayType;
  dayTypeAfter: TrainingDayType;
  slots: SlotDiff[];
  changed: boolean;
}

const sameIds = (a?: readonly string[], b?: readonly string[]) => JSON.stringify([...(a ?? [])].sort()) === JSON.stringify([...(b ?? [])].sort());

/**
 * `coachOf` resolves the coach that will actually lead a session (manual
 * assignment or the automatic fallback), so "auto" vs an explicit id for
 * the same person is not reported as a change.
 */
export function diffSessions(before: TrainingSession, after: TrainingSession, coachOf: (s: TrainingSession) => string | null = (s) => s.coachId): string[] {
  const changes: string[] = [];
  if (before.type !== after.type) changes.push("Passtyp");
  if (before.intensity !== after.intensity) changes.push("Intensitet");
  if (before.duration !== after.duration) changes.push("Längd");
  if (before.target !== after.target || (after.target === "SELECTED_PLAYERS" && !sameIds(before.selectedPlayerIds, after.selectedPlayerIds))) changes.push("Målgrupp");
  if (coachOf(before) !== coachOf(after)) changes.push("Tränare");
  return changes;
}

export function diffTrainingWeeks(
  live: Pick<TrainingWeek, "days">,
  proposed: Pick<TrainingWeek, "days">,
  isLocked: (day: TrainingDay) => boolean,
  coachOf?: (s: TrainingSession) => string | null,
): DayDiff[] {
  return live.days.map((liveDay) => {
    const next = proposed.days.find((d) => d.date === liveDay.date) ?? liveDay;
    const locked = isLocked(liveDay);
    const slots: SlotDiff[] = [];
    const count = Math.max(liveDay.sessions.length, next.sessions.length);
    for (let index = 0; index < count; index++) {
      const before = liveDay.sessions[index];
      const after = next.sessions[index];
      if (locked) {
        if (before) slots.push({ index, kind: "same", before, after: before, changes: [] });
        continue;
      }
      if (before && after) {
        const changes = diffSessions(before, after, coachOf);
        slots.push({ index, kind: changes.length ? "changed" : "same", before, after, changes });
      } else if (after) slots.push({ index, kind: "added", after, changes: [] });
      else if (before) slots.push({ index, kind: "removed", before, changes: [] });
    }
    const dayTypeAfter = locked ? liveDay.dayType : next.dayType;
    return {
      date: liveDay.date,
      locked,
      dayTypeBefore: liveDay.dayType,
      dayTypeAfter,
      slots,
      changed: !locked && (dayTypeAfter !== liveDay.dayType || slots.some((s) => s.kind !== "same")),
    };
  });
}

function renumber(date: string, sessions: readonly TrainingSession[]): TrainingSession[] {
  return sessions.map((s, i) => ({ ...s, id: `${date}:s${i}` }));
}

/** Proposal week with one day replaced by the live day ("behåll mitt schema" for that day). */
export function revertProposalDay<W extends Pick<TrainingWeek, "days">>(proposed: W, live: Pick<TrainingWeek, "days">, date: string): W {
  const liveDay = live.days.find((d) => d.date === date);
  if (!liveDay) return proposed;
  return { ...proposed, days: proposed.days.map((d) => (d.date === date ? { ...d, dayType: liveDay.dayType, sessions: renumber(date, liveDay.sessions) } : d)) };
}

/** Proposal week with one day replaced by another draft's day (restores the assistant's original day). */
export function restoreProposalDay<W extends Pick<TrainingWeek, "days">>(proposed: W, source: Pick<TrainingWeek, "days">, date: string): W {
  const src = source.days.find((d) => d.date === date);
  if (!src) return proposed;
  return { ...proposed, days: proposed.days.map((d) => (d.date === date ? { ...d, dayType: src.dayType, sessions: renumber(date, src.sessions) } : d)) };
}

/** Proposal week with one session slot put back to what the live day has in that slot (or removed if the live day has none). */
export function revertProposalSlot<W extends Pick<TrainingWeek, "days">>(proposed: W, live: Pick<TrainingWeek, "days">, date: string, index: number): W {
  const liveDay = live.days.find((d) => d.date === date);
  if (!liveDay) return proposed;
  return {
    ...proposed,
    days: proposed.days.map((d) => {
      if (d.date !== date) return d;
      const sessions = [...d.sessions];
      const liveSession = liveDay.sessions[index];
      if (liveSession) {
        if (index < sessions.length) sessions[index] = liveSession;
        else sessions.push(liveSession);
      } else if (index < sessions.length) sessions.splice(index, 1);
      return { ...d, sessions: renumber(date, sessions.slice(0, 2)) };
    }),
  };
}

export function daysEqual(a: Pick<TrainingDay, "dayType" | "sessions"> | undefined, b: Pick<TrainingDay, "dayType" | "sessions"> | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.dayType !== b.dayType || a.sessions.length !== b.sessions.length) return false;
  return a.sessions.every((s, i) => diffSessions(s, b.sessions[i]).length === 0);
}

// ---------------------------------------------------------------- executed day outcome (TRN-01e)

export interface DayOutcomeRow {
  playerId: string;
  passes: number;
  before: number;
  after: number;
  delta: number;
}

export interface DayOutcome {
  sessions: number;
  attendance: number;
  /** Mean energy change across participants from the day's sessions; null when nobody trained. */
  averageDelta: number | null;
  rows: DayOutcomeRow[];
}

/** Same reading as the former "Senaste träningsutfall": first pre-session energy to last post-session energy per player. */
export function trainingDayOutcome(day: Pick<TrainingDay, "executed" | "results">): DayOutcome | null {
  if (!day.executed) return null;
  const players = new Map<string, { before: number; after: number; passes: number }>();
  for (const result of day.results ?? []) {
    for (const id of result.participants) {
      const previous = players.get(id);
      players.set(id, { before: previous?.before ?? result.preEnergyByPlayer[id], after: result.postEnergyByPlayer[id], passes: (previous?.passes ?? 0) + 1 });
    }
  }
  const rows = [...players].map(([playerId, v]) => ({ playerId, passes: v.passes, before: v.before, after: v.after, delta: Math.round((v.after - v.before) * 10) / 10 }));
  rows.sort((a, b) => a.delta - b.delta || a.playerId.localeCompare(b.playerId));
  const averageDelta = rows.length ? Math.round((rows.reduce((n, r) => n + r.delta, 0) / rows.length) * 10) / 10 : null;
  return { sessions: day.results?.length ?? 0, attendance: rows.length, averageDelta, rows };
}
