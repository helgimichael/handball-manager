// HM-ALPHA3-M10: bounded save growth. Once a season, at rollover, working
// records that only matter while they are recent are trimmed. Nothing that
// is career history is touched: season archives, tables, ties, awards,
// completed transfers, club and player histories, finances, the board and
// manager records all stay. Kept:
// - inbox messages and career events from the last RECENT_DAYS, plus anything
//   still waiting for an action;
// - transfer bids from the last RECENT_DAYS, plus every completed or open deal;
// - news stories from the last RECENT_DAYS, plus the biggest (importance 5);
// - training-week plans from the last TRAINING_WEEK_DAYS;
// - the newest DEVELOPMENT_HISTORY_KEEP attribute changes per player;
// - workload entries only for players still being tracked (the ledger
//   already drops entries older than its own window for active players);
// - HM-M6.0: delegation proposals still pending, plus decided ones from the
//   last PROPOSAL_KEEP_DAYS (beyond the 28-day re-proposal cooldown and the
//   current/next training week); the activity log keeps the decisions;
// - HM-M6.0: scout reports and discoveries from the last RECENT_DAYS, plus
//   the newest of each per player, and every scouting assignment that is
//   active, recent, referenced by a kept report or the newest one on its
//   player -- so player knowledge and the Recruitment Centre's candidate
//   list are exactly what they were.
import type { CareerState } from "./types";
import { addDays } from "./dateUtils";
import { WORKLOAD_RETENTION_DAYS } from "../training/workloadLedger";

export const RECENT_DAYS = 400;
const TRAINING_WEEK_DAYS = 56;
/** HM-M6.0: decided delegation proposals kept this long (> the 28-day cooldown; covers the current and next training week). */
export const PROPOSAL_KEEP_DAYS = 56;
const DEVELOPMENT_HISTORY_KEEP = 24;
const LIVE_OFFER: ReadonlySet<string> = new Set(["COMPLETED", "AGREED_AWAITING_WINDOW", "BLOCKED_PENDING_TRANSFER"]);

export function compactCareerHistory(state: CareerState, today: string): CareerState {
  const cutoff = addDays(today, -RECENT_DAYS);
  const inbox = state.inbox.filter((m) => m.date >= cutoff || (m.actionRequired && !m.resolved));
  const careerEvents = state.careerEvents.filter((e) => e.date >= cutoff || (e.requiresAction && !e.resolved));
  const transferOffers = Object.fromEntries(Object.entries(state.transferOffers ?? {}).filter(([, o]) => LIVE_OFFER.has(o.status) || (o.resolvedDate ?? o.offeredDate) >= cutoff));
  const weekCutoff = addDays(today, -TRAINING_WEEK_DAYS);
  const trainingWeeks = Object.fromEntries(Object.entries(state.trainingWeeks).filter(([weekStart]) => weekStart >= weekCutoff));
  const playerDevelopmentState = Object.fromEntries(Object.entries(state.playerDevelopmentState).map(([id, d]) => [id, d.developmentHistory.length > DEVELOPMENT_HISTORY_KEEP ? { ...d, developmentHistory: d.developmentHistory.slice(0, DEVELOPMENT_HISTORY_KEEP) } : d]));
  const media = state.media && { ...state.media, stories: Object.fromEntries(Object.entries(state.media.stories).filter(([, s]) => s.date >= cutoff || s.importance >= 5)) };
  const workCutoff = addDays(today, -WORKLOAD_RETENTION_DAYS);
  const workloadLedger = state.workloadLedger && { ...state.workloadLedger, entries: Object.fromEntries(Object.entries(state.workloadLedger.entries).filter(([, list]) => (list.at(-1)?.date ?? "") >= workCutoff)) };
  const delegation = state.delegation && compactProposals(state.delegation, addDays(today, -PROPOSAL_KEEP_DAYS));
  const scouting = compactScouting(state, cutoff);
  return {
    ...state,
    ...(delegation ? { delegation } : {}),
    ...scouting,
    inbox,
    careerEvents,
    transferOffers,
    trainingWeeks,
    playerDevelopmentState,
    ...(media ? { media } : {}),
    ...(workloadLedger ? { workloadLedger } : {}),
  };
}

function compactProposals(d: NonNullable<CareerState["delegation"]>, keepFrom: string): NonNullable<CareerState["delegation"]> {
  const entries = Object.entries(d.proposals);
  const kept = entries.filter(([, p]) => p.status === "PENDING" || (p.decidedOn ?? p.expiresOn) >= keepFrom);
  return kept.length === entries.length ? d : { ...d, proposals: Object.fromEntries(kept) };
}

/** Newest-first winner per key; ties broken by id so the result never depends on map order. */
function newestPer<T>(items: readonly T[], key: (t: T) => string, date: (t: T) => string, id: (t: T) => string): Set<string> {
  const best = new Map<string, T>();
  for (const t of items) {
    const cur = best.get(key(t));
    if (!cur || date(t) > date(cur) || (date(t) === date(cur) && id(t) > id(cur))) best.set(key(t), t);
  }
  return new Set([...best.values()].map(id));
}

function compactScouting(state: CareerState, cutoff: string): Pick<CareerState, "scoutReports" | "scoutDiscoveries" | "scoutingAssignments"> | Record<string, never> {
  const reports = Object.values(state.scoutReports ?? {});
  const discoveries = Object.values(state.scoutDiscoveries ?? {});
  const assignments = Object.values(state.scoutingAssignments ?? {});
  const newestReport = newestPer(reports, (r) => r.targetPlayerId, (r) => r.createdDate, (r) => r.id);
  const keptReports = reports.filter((r) => r.createdDate >= cutoff || newestReport.has(r.id));
  const newestDiscovery = newestPer(discoveries, (d) => d.playerId, (d) => d.discoveredDate, (d) => d.id);
  const keptDiscoveries = discoveries.filter((d) => d.discoveredDate >= cutoff || newestDiscovery.has(d.id));
  const referenced = new Set([...keptReports.map((r) => r.assignmentId), ...keptDiscoveries.map((d) => d.assignmentId)]);
  const players = assignments.filter((a) => a.assignmentType === "PLAYER");
  const newestOnPlayer = newestPer(players, (a) => a.targetPlayerId, (a) => a.endDate, (a) => a.id);
  const keptAssignments = assignments.filter((a) => a.status === "IN_PROGRESS" || a.endDate >= cutoff || referenced.has(a.id) || newestOnPlayer.has(a.id));
  if (keptReports.length === reports.length && keptDiscoveries.length === discoveries.length && keptAssignments.length === assignments.length) return {};
  return {
    scoutReports: Object.fromEntries(keptReports.map((r) => [r.id, r])),
    scoutDiscoveries: Object.fromEntries(keptDiscoveries.map((d) => [d.id, d])),
    scoutingAssignments: Object.fromEntries(keptAssignments.map((a) => [a.id, a])),
  };
}
