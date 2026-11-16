/**
 * SQUAD-ROLE-MINUTES: the manager's planned minutes as weighted inputs to the
 * assistant's rotation. Optional and additive -- a side without
 * `plan.minutes` (CPU sides, every existing test and saved match) rotates
 * exactly as before.
 *
 * Nothing here executes a plan at an exact minute. A minutes-driven exchange
 * needs the outgoing player clearly AHEAD of his pro-rata plan (beyond a
 * per-player tolerance) and a same-role bench player who still NEEDS minutes,
 * and the weighted sum of both -- with fatigue, the player's recent
 * performance and the match situation -- must clear a threshold. A tight
 * finish damps the plan (the strongest players stay on); a decided game
 * shares the minutes more readily. Goalkeepers only ever swap with
 * goalkeepers and field players only with a field player of the same role,
 * so no exchange can put anybody in a position he was not planned for. The
 * exchange itself is the ordinary physical exchange (requestExchange), with
 * every existing rule and guard.
 *
 * Manager control: when the manager makes a substitution himself the two
 * players are locked from the assistant for a while, so the assistant never
 * reverses a manual decision; with rotation off the assistant does nothing.
 *
 * No randomness is consumed, so planned minutes never shift the RNG stream.
 */
import { exchangeActive, requestExchange } from './population';
import { courtPlayers, otherTeam, type CorePlayer, type CoreState, type TeamId } from './state';

/** Per player: planned court minutes (0-60) and how strongly his role asks the assistant to honour them (0-1). */
export type PlannedMinutes = Readonly<Record<string, { readonly planned: number; readonly weight: number }>>;

/** How long (official match time) a manual substitution keeps both players out of the assistant's hands. */
export const MANUAL_LOCK_MS = 10 * 60000;
/** A minutes-driven exchange needs this weighted score. */
const DECISION_THRESHOLD = 1;

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** A stable 3-6 minute tolerance per player: plans are honoured around, never exactly at, a minute. */
export const minutesTolerance = (id: string): number => 3 + (hash(id) % 4);

export function manualLocked(s: CoreState, team: TeamId, id: string): boolean {
  const until = s.coaching[team]?.manualLocks?.[id];
  return until !== undefined && s.officialClock.timeMs < until;
}

/** Records a manager's own exchange so the assistant leaves both players alone for MANUAL_LOCK_MS. */
export function lockManualExchange(s: CoreState, team: TeamId, ids: readonly string[]): void {
  const tactics = s.coaching[team];
  const until = s.officialClock.timeMs + MANUAL_LOCK_MS;
  tactics.manualLocks = { ...(tactics.manualLocks ?? {}), ...Object.fromEntries(ids.map(id => [id, until])) };
}

const PERFORMANCE_WINDOW_MS = 10 * 60000;
const PERFORMANCE_POINTS: Readonly<Record<string, number>> = { GOAL: 1, SHOT_RELEASED: -.35, SAVE_CAUGHT: .6, SAVE_PARRY: .6, INTERCEPTION: .5, TECHNICAL_VIOLATION: -.5, OFFENSIVE_FOUL: -.5, PASSIVE_PLAY: -.3, RECEPTION_FAILED: -.3, TWO_MINUTE_SUSPENSION: -.6 };
/** Recent form in this match (last ten minutes): a player in form is kept on a little longer. */
export function recentPerformance(s: CoreState, id: string): number {
  const from = s.officialClock.timeMs - PERFORMANCE_WINDOW_MS;
  let score = 0;
  for (let i = s.events.length - 1; i >= 0; i--) {
    const e = s.events[i]!;
    if (e.officialMs < from) break;
    if (e.actorId === id) score += PERFORMANCE_POINTS[e.type] ?? 0;
  }
  return Math.max(-2, Math.min(2, score));
}

/** The tactical situation's weight on the plan: <1 the plan yields, >1 the plan leads. */
export function minutesSituationWeight(s: CoreState, team: TeamId): number {
  const total = (s.match?.periodLengthMs ?? 1800000) * 2;
  const margin = s.score[team] - s.score[otherTeam(team)];
  const late = s.officialClock.timeMs > total * .83;
  if (late && Math.abs(margin) <= 3) return .25;
  if (Math.abs(margin) >= 8) return 1.4;
  return 1;
}

type Context = { readonly free: (p: CorePlayer) => boolean; readonly ready: (p: CorePlayer) => boolean; readonly protectedIds: ReadonlySet<string>; readonly tiredBelow: number };

export type MinutesReading = { readonly elapsed: number; readonly remainingMin: number; readonly situation: number };
export function minutesReading(s: CoreState, team: TeamId): MinutesReading {
  const total = (s.match?.periodLengthMs ?? 1800000) * 2;
  const now = s.officialClock.timeMs;
  return { elapsed: Math.max(0, Math.min(1, now / total)), remainingMin: Math.max(0, (total - now) / 60000), situation: minutesSituationWeight(s, team) };
}
const courtMinutes = (p: CorePlayer) => p.condition.courtMs / 60000;
/** Minutes ahead of the pro-rata plan, beyond the player's tolerance (0 when on or behind schedule, or unplanned). */
export function minutesAhead(minutes: PlannedMinutes, p: CorePlayer, r: MinutesReading): number {
  const m = minutes[p.id];
  return m ? Math.max(0, courtMinutes(p) - m.planned * r.elapsed - minutesTolerance(p.id)) : 0;
}
/** How much a bench player still needs minutes: the share of the remaining match his plan asks for, weighted by role. */
export function minutesNeed(minutes: PlannedMinutes, p: CorePlayer, r: MinutesReading): number {
  const m = minutes[p.id];
  if (!m) return 0;
  const remaining = m.planned - courtMinutes(p);
  if (remaining <= minutesTolerance(p.id)) return 0;
  return Math.min(1.5, remaining / Math.max(4, r.remainingMin)) * m.weight;
}

/** Same position only: goalkeeper for goalkeeper, a field player for a field player of the same role. */
export const samePosition = (outgoing: CorePlayer, incoming: CorePlayer): boolean =>
  outgoing.kind === incoming.kind && (outgoing.kind === 'GOALKEEPER' || incoming.role === outgoing.role);

/**
 * At most one minutes-driven exchange per call. Returns true when one was requested.
 * Called by coachingBefore only while the assistant rotates, after its fatigue pass found nothing.
 */
export function minutesRotationBefore(s: CoreState, team: TeamId, ctx: Context): boolean {
  const minutes = s.coaching[team]?.plan?.minutes;
  if (!minutes || s.exchanges.some(e => e.team === team && e.phase !== 'COMPLETED' && e.phase !== 'CANCELLED')) return false;
  const r = minutesReading(s, team);
  // Let the match settle first, and no churn in the closing seconds.
  if (r.elapsed < .12 || r.elapsed > .97) return false;
  const fatigue = (p: CorePlayer) => p.kind === 'GOALKEEPER' ? 0 : Math.max(0, (ctx.tiredBelow + .15 - p.condition.energy) / .3);
  const outgoing = courtPlayers(s, team)
    .filter(p => (p.kind === 'GOALKEEPER' ? p.id !== s.ball.controllerId && !p.airborne && !exchangeActive(s, p.id) : ctx.free(p)) && !ctx.protectedIds.has(p.id) && !manualLocked(s, team, p.id) && minutesAhead(minutes, p, r) > 0)
    .map(p => ({ p, score: r.situation * minutesAhead(minutes, p, r) / 6 + fatigue(p) * .6 - .25 * recentPerformance(s, p.id) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id));
  for (const { p: out, score } of outgoing) {
    const incoming = s.players
      .filter(b => ctx.ready(b) && samePosition(out, b) && !ctx.protectedIds.has(b.id) && !manualLocked(s, team, b.id) && (b.kind === 'GOALKEEPER' || b.condition.energy >= Math.max(.6, out.condition.energy - .05)))
      .map(b => ({ b, need: minutesNeed(minutes, b, r) }))
      .filter(x => x.need > 0)
      .sort((a, b) => b.need - a.need || b.b.condition.energy - a.b.condition.energy || a.b.id.localeCompare(b.b.id))[0];
    if (!incoming || score + r.situation * incoming.need < DECISION_THRESHOLD) continue;
    if (requestExchange(s, team, out.id, incoming.b.id, out.kind === 'GOALKEEPER' ? undefined : out.role)) return true;
  }
  return false;
}
