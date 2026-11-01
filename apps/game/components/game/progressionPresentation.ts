import type { CareerEvent } from '@/lib/career/careerEvents';
import type { ContinueStopReason } from '@/lib/career/continueController';
import { destinationLabel, resolveDestinationHref } from '@/lib/career/destinations';

export type ProgressionNotice = {
  title: string; detail: string; kind: 'matchday' | 'decision' | 'news' | 'season' | 'calendar';
  navigateHref: string; actionHref: string; actionLabel: string; event?: CareerEvent;
};

/** Presentation of an already committed Continue result. Never advances the world. */
export function progressionNotice(events: readonly CareerEvent[], reason: ContinueStopReason, pending?: CareerEvent): ProgressionNotice {
  if (reason === 'SEASON_COMPLETE') return {
    title: 'Säsongen är i mål.', detail: 'Se sluttabellen och laget inför nästa säsong.', kind: 'season',
    navigateHref: '/career', actionHref: '/career/history', actionLabel: 'Säsongens historik →',
  };
  const event = reason === 'ACTION_REQUIRED_PENDING' ? pending :
    events.find(e => e.requiresAction && !e.resolved) ?? [...events].reverse().find(e => e.priority === 'IMPORTANT' || e.priority === 'ACTION_REQUIRED');
  if (!event) return {
    title: 'Kalendern är uppdaterad.', detail: 'Nästa del av säsongen väntar.', kind: 'calendar',
    navigateHref: '/career', actionHref: '/career/calendar', actionLabel: 'Se kalendern →',
  };
  const destination = event.destinations.find(d => resolveDestinationHref(d));
  const actionHref = destination ? resolveDestinationHref(destination)! : '/career/inbox';
  const matchday = event.type === 'MATCHDAY_READY';
  return {
    title: event.subject, detail: event.summary, event,
    kind: matchday ? 'matchday' : event.requiresAction && !event.resolved ? 'decision' : 'news',
    navigateHref: matchday ? '/career/match-preview' : `/career/inbox?message=${encodeURIComponent(`msg:${event.id}`)}`,
    actionHref, actionLabel: destination ? `${destinationLabel(destination)} →` : 'Öppna inkorg →',
  };
}

export const CAREER_EVENT_LABEL: Record<CareerEvent['type'], string> = {
  TRAINING_COMPLETED: 'Träning', TRAINING_REPORT: 'Träningsrapport', PLAYER_STATUS_CHANGED: 'Tillgänglighet',
  PLAYER_INJURED: 'Medicinskt', SCOUT_REPORT_READY: 'Scoutingrapport', SCOUT_DISCOVERY_READY: 'Nya spelare',
  OPPONENT_REPORT_READY: 'Motståndaren', MATCH_PREPARATION_READY: 'Matchförberedelse', MATCHDAY_READY: 'Matchdag',
  MATCH_COMPLETED: 'Matchresultat', COMPETITION_UPDATE: 'Tävling', STAFF_REPORT: 'Tränarstaben', CLUB_NEWS: 'Klubben',
  PLAYER_PLACEMENT_EXPIRED: 'Spelaravtal', PLAYER_CONTRACT_EXPIRED: 'Kontrakt', YOUTH_INTAKE_COMPLETE: 'Ungdomslaget',
  PLAYER_RETIRED: 'Spelarkarriär', PLAYER_CAREER_EXIT: 'Spelarkarriär', TRANSFER_NEGOTIATION: 'Förhandling', CLUB_FINANCE: 'Ekonomi', SEASON_MILESTONE: 'Säsongen', STAFF_UPDATE: 'Personal',
};
