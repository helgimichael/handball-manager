// HM-PLAYTEST-02: Interactive press conferences for post-match and news-triggered events.
import type { CareerFixture, CareerState } from '../career/types';
import type { FastMatchResult } from '@handball-manager/game-simulation';
import { openPress, skipPress as baseSkipPress } from './press';
import { mediaOf } from './people';
import { addDays } from '../career/dateUtils';
import { clubShort } from './newsEngine';
import type { CareerEvent } from '../career/careerEvents';
import type { PressContext, PressTopic } from './types';
import { SVENSKA_CUPEN } from '../competition/rules';

export { baseSkipPress as skipPress };

export type NewsPressTrigger =
  | { kind: 'MAJOR_SIGNING'; playerId: string; feeEur: number }
  | { kind: 'KEY_INJURY'; playerId: string; estimatedDays: number }
  | { kind: 'WIN_STREAK'; streakCount: number }
  | { kind: 'PROMOTION_RACE'; position: number };

/**
 * Ensures a post-match press conference is opened for any match played by the human manager's club.
 * Generates 2-3 contextual questions based on match outcome (win, draw, defeat, derby, referee controversy, cup stakes).
 */
export function ensurePostMatchPress(
  state: CareerState,
  fixture: CareerFixture,
  result: FastMatchResult,
  emit?: (e: CareerEvent) => void
): CareerState {
  const me = state.playerClubId;
  const isHome = fixture.homeClubId === me;
  const isAway = fixture.awayClubId === me;
  if (!isHome && !isAway) return state;

  const pressId = `press:post:${fixture.id}`;
  if (mediaOf(state).press[pressId]) return state;

  const opponentId = isHome ? fixture.awayClubId : fixture.homeClubId;
  const ownGoals = isHome ? result.homeGoals : result.awayGoals;
  const oppGoals = isHome ? result.awayGoals : result.homeGoals;
  const won = ownGoals > oppGoals;
  const lost = ownGoals < oppGoals;
  const isCup = fixture.type === 'CUP' || fixture.competitionId === SVENSKA_CUPEN || fixture.competitionId.toLowerCase().includes('cup');

  const ownSusp = (isHome ? result.homeStats : result.awayStats).twoMinuteSuspensions;
  const oppSusp = (isHome ? result.awayStats : result.homeStats).twoMinuteSuspensions;
  const controversy = lost && ownSusp - oppSusp >= 3;

  const topics: PressContext[] = [];

  // 1. Primary question on outcome (win vs defeat)
  topics.push({
    topic: (won ? 'AFTER_WIN' : 'AFTER_DEFEAT') as PressTopic,
    opponentId,
  });

  // 2. Referee controversy if significant suspension gap
  if (controversy) {
    topics.push({
      topic: 'REFEREE',
      opponentId,
      detail: `${ownSusp} utvisningar mot ${oppSusp}.`,
    });
  }

  // 3. Distinct secondary topic: cup stakes, rivalry, or form trend (guaranteeing no duplicate topics)
  if (isCup) {
    topics.push({
      topic: 'RIVAL_RESPONSE',
      opponentId,
      detail: `Cupmötet i Svenska Cupen slutade ${ownGoals}–${oppGoals}.`,
    });
  } else if (lost) {
    topics.push({
      topic: 'POOR_FORM',
      opponentId,
      detail: `Förlust med ${ownGoals}–${oppGoals}.`,
    });
  } else if (!controversy) {
    topics.push({
      topic: 'RIVAL_RESPONSE',
      opponentId,
      detail: `Seger med ${ownGoals}–${oppGoals}.`,
    });
  }

  // Deduplicate topics strictly so there are never repeated questions from the same match
  const seenTopics = new Set<PressTopic>();
  const uniqueTopics: PressContext[] = [];
  for (const t of topics) {
    if (!seenTopics.has(t.topic)) {
      seenTopics.add(t.topic);
      uniqueTopics.push(t);
    }
  }

  const contextLabel = `${ownGoals}–${oppGoals}${isCup ? ' · Svenska Cupen' : ''}`;
  const dummyEmit = emit ?? (() => {});

  return openPress(
    state,
    state.gameDate,
    {
      key: `post:${fixture.id}`,
      kind: 'POST_MATCH',
      title: `Efter ${clubShort(fixture.homeClubId)}–${clubShort(fixture.awayClubId)}`,
      context: `Slutresultat ${contextLabel}. Journalisterna samlas i pressrummet.`,
      fixtureId: fixture.id,
      expiresOn: addDays(state.gameDate, 2),
      topics: uniqueTopics.slice(0, 3),
    },
    dummyEmit
  );
}

/**
 * Triggers news-related press conferences for major career moments:
 * - High-profile player signings
 * - Significant player injuries
 * - Multi-match winning streaks
 * - Late-season promotion/title races
 */
export function ensureNewsTriggeredPress(
  state: CareerState,
  trigger: NewsPressTrigger,
  emit?: (e: CareerEvent) => void
): CareerState {
  const dummyEmit = emit ?? (() => {});
  const date = state.gameDate;

  switch (trigger.kind) {
    case 'MAJOR_SIGNING': {
      const key = `signing:${trigger.playerId}:${date}`;
      if (mediaOf(state).press[`press:${key}`]) return state;
      return openPress(
        state,
        date,
        {
          key,
          kind: 'INTERVIEW',
          title: 'Presentation av nyförvärvet',
          context: 'Media och supportrar samlas för att höra huvudtränarens tankar om värvningen.',
          expiresOn: addDays(date, 4),
          topics: [{ topic: 'TRANSFER', playerId: trigger.playerId }],
        },
        dummyEmit
      );
    }
    case 'KEY_INJURY': {
      const key = `injury:${trigger.playerId}:${date}`;
      if (mediaOf(state).press[`press:${key}`]) return state;
      return openPress(
        state,
        date,
        {
          key,
          kind: 'INTERVIEW',
          title: 'Skadebakslag för nyckelspelare',
          context: `Spelaren beräknas missa ca ${Math.round(trigger.estimatedDays / 7)} veckor. Pressen vill veta hur laget formeras nu.`,
          expiresOn: addDays(date, 3),
          topics: [{ topic: 'POOR_FORM', playerId: trigger.playerId }],
        },
        dummyEmit
      );
    }
    case 'WIN_STREAK': {
      const key = `win-streak:${trigger.streakCount}:${date}`;
      if (mediaOf(state).press[`press:${key}`]) return state;
      return openPress(
        state,
        date,
        {
          key,
          kind: 'INTERVIEW',
          title: `${trigger.streakCount} raka segrar – Toppform`,
          context: 'Laget går som tåget. Journalisterna vill veta hemligheten bakom framgången.',
          expiresOn: addDays(date, 4),
          topics: [{ topic: 'AFTER_WIN' }],
        },
        dummyEmit
      );
    }
    case 'PROMOTION_RACE': {
      const key = `promotion-race:${date}`;
      if (mediaOf(state).press[`press:${key}`]) return state;
      return openPress(
        state,
        date,
        {
          key,
          kind: 'INTERVIEW',
          title: 'Toppstrid och slutspurt',
          context: `Placering ${trigger.position} i tabellen. Media ställer frågor om serieledning och avancemangstryck.`,
          expiresOn: addDays(date, 4),
          topics: [{ topic: 'BOARD_PRESSURE' }],
        },
        dummyEmit
      );
    }
  }
}
