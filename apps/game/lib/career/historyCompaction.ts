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
//   already drops entries older than its own window for active players).
import type { CareerState } from "./types";
import { addDays } from "./dateUtils";
import { WORKLOAD_RETENTION_DAYS } from "../training/workloadLedger";

export const RECENT_DAYS = 400;
const TRAINING_WEEK_DAYS = 56;
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
  return {
    ...state,
    inbox,
    careerEvents,
    transferOffers,
    trainingWeeks,
    playerDevelopmentState,
    ...(media ? { media } : {}),
    ...(workloadLedger ? { workloadLedger } : {}),
  };
}
