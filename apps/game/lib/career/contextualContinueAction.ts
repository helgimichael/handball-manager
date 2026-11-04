import type { CareerState } from './types';
import { isSelectableForMatch } from './playerStatus';
import { getClub } from '../game-data';
import { openPressConferences } from '../media/press';

export type ContinueActionKind =
  | 'ADVANCE_DAY'         // "Fortsätt »"
  | 'PREPARE_MATCH'       // "Förbered match" -> /career/tactics
  | 'START_MATCH'         // "Starta match" -> /career/match-day/${fixtureId}
  | 'RESUME_MATCH'        // "Återgå till match" -> /career/match-day/${fixtureId}
  | 'PRESS_CONFERENCE'    // "Presskonferens" -> /career/media?tab=press
  | 'DECISION_BLOCKED'    // "Beslut krävs" -> /career/inbox or decision URL
  | 'SEASON_COMPLETE';    // "Säsong klar" -> disabled

export interface ContextualContinueAction {
  kind: ContinueActionKind;
  label: string;
  sublabel: string;
  ariaLabel: string;
  tooltip?: string;
  disabled: boolean;
  targetHref: string | null;
  blockReason?: string;
}

/**
 * Checks whether the starting lineup for the given fixture has 7 available players
 * (1 GK and 6 outfielders) who are all selectable.
 */
export function isMatchLineupReady(career: CareerState, fixtureId: string): boolean {
  const plan = career.matchPlans[fixtureId];
  if (!plan) return false;
  const slots = plan.attackStartingUnit?.slots ?? [];
  if (slots.length < 7) return false;
  const gk = slots.find(s => s.position === 'GK');
  if (!gk || !gk.playerId) return false;
  const outfield = slots.filter(s => s.position !== 'GK');
  if (outfield.length < 6 || outfield.some(s => !s.playerId)) return false;

  // Check if every starter is currently selectable (not injured, suspended, etc.)
  return slots.every(s => isSelectableForMatch(career.playerStatuses, s.playerId));
}

/**
 * Authoritative Contextual Continue Action Selector.
 * Resolves the top-right button label, action, and target route based on exact career state.
 */
export function resolveContextualContinueAction(
  career: CareerState,
  activeSession?: { fixtureId: string; clock: { phase: string } } | null,
  pathname?: string
): ContextualContinueAction {
  // 1. In-progress or active match
  const isLiveMatchActive = Boolean(career.productionMatch) || (activeSession !== null && activeSession !== undefined && activeSession.clock.phase !== 'PRE_MATCH' && activeSession.clock.phase !== 'FULL_TIME');
  if (isLiveMatchActive) {
    const fixtureId = career.productionMatch?.fixture?.id ?? activeSession?.fixtureId;
    const targetHref = fixtureId ? `/career/match-day/${fixtureId}` : '/career';
    const isOnRoute = Boolean(pathname && targetHref && pathname === targetHref);
    return {
      kind: 'RESUME_MATCH',
      label: isOnRoute ? 'Match pågår' : 'Återgå till match',
      sublabel: 'MATCHCENTRUM',
      ariaLabel: isOnRoute ? 'Match pågår i matchcentrum' : 'Återgå till aktiv match',
      tooltip: 'En match pågår. Klicka för att återgå till matchledningen.',
      disabled: isOnRoute,
      targetHref: isOnRoute ? null : targetHref,
    };
  }

  // 2. Season complete
  if (career.seasonComplete) {
    return {
      kind: 'SEASON_COMPLETE',
      label: 'Säsong klar',
      sublabel: 'SÄSONGSAVSLUT',
      ariaLabel: 'Säsongen är avslutad',
      tooltip: 'Säsongens sista match är spelad. Starta nästa säsong från hemvyn.',
      disabled: true,
      targetHref: null,
    };
  }

  // 3. Open / Pending press conference
  const openPress = openPressConferences(career);
  if (openPress.length > 0) {
    const latestPress = openPress[0];
    const targetHref = `/career/media/press/${encodeURIComponent(latestPress.id)}`;
    const isOnRoute = Boolean(pathname && pathname.startsWith('/career/media/press'));
    return {
      kind: 'PRESS_CONFERENCE',
      label: 'Presskonferens',
      sublabel: 'MEDIA & INTERVJU',
      ariaLabel: `Presskonferens väntar: ${latestPress.title}`,
      tooltip: `${latestPress.title}. Journalisterna väntar på dina svar.`,
      disabled: isOnRoute,
      targetHref: isOnRoute ? null : targetHref,
    };
  }

  // 4. Matchday today
  const todayFixture = career.fixtures.find(
    f => f.date === career.gameDate &&
    (f.homeClubId === career.playerClubId || f.awayClubId === career.playerClubId) &&
    !career.results[f.id]
  );

  if (todayFixture) {
    const oppId = todayFixture.homeClubId === career.playerClubId ? todayFixture.awayClubId : todayFixture.homeClubId;
    const opp = getClub(oppId);
    const lineupReady = isMatchLineupReady(career, todayFixture.id);

    if (!lineupReady) {
      const isOnTactics = Boolean(pathname && pathname === '/career/tactics');
      return {
        kind: 'PREPARE_MATCH',
        label: 'Förbered match',
        sublabel: 'LAGUTTAGNING KRÄVS',
        ariaLabel: `Förbered match mot ${opp?.name ?? 'motståndaren'}`,
        tooltip: `Matchdag mot ${opp?.name ?? 'motståndaren'}! Startsjuan behöver ses över innan avkast.`,
        disabled: isOnTactics,
        targetHref: isOnTactics ? null : '/career/tactics',
      };
    }

    // Lineup is ready: directly open matchday!
    const targetHref = `/career/match-day/${todayFixture.id}`;
    const isOnRoute = Boolean(pathname && pathname === targetHref);
    return {
      kind: 'START_MATCH',
      label: 'Starta match',
      sublabel: `MOT ${opp?.shortName?.toUpperCase() ?? 'MOTSTÅNDAREN'}`,
      ariaLabel: `Starta match mot ${opp?.name ?? 'motståndaren'}`,
      tooltip: `Matchdag mot ${opp?.name ?? 'motståndaren'}. Klicka för att starta matchen!`,
      disabled: isOnRoute,
      targetHref: isOnRoute ? null : targetHref,
    };
  }

  // 5. Mandatory blocking decision (e.g. transfer offer, contract expiry)
  const pendingAction = career.careerEvents.find(e => e.requiresAction && !e.resolved && e.type !== 'MATCHDAY_READY');
  if (pendingAction) {
    return {
      kind: 'DECISION_BLOCKED',
      label: 'Beslut krävs',
      sublabel: 'ÅTGÄRD KRÄVS',
      ariaLabel: `Beslut krävs: ${pendingAction.subject}`,
      tooltip: pendingAction.summary,
      blockReason: pendingAction.summary,
      disabled: false,
      targetHref: `/career/inbox?message=${encodeURIComponent(`msg:${pendingAction.id}`)}`,
    };
  }

  // 6. Ordinary day -> advance calendar
  return {
    kind: 'ADVANCE_DAY',
    label: 'Fortsätt »',
    sublabel: 'TILL NÄSTA HÄNDELSE',
    ariaLabel: 'Fortsätt till nästa händelse i kalendern',
    disabled: false,
    targetHref: null,
  };
}

