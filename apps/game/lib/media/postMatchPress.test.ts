import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import type { CareerFixture, CareerState } from '../career/types';
import type { FastMatchResult } from '@handball-manager/game-simulation';
import { ensurePostMatchPress, ensureNewsTriggeredPress, skipPress } from './postMatchPress';
import { answerPress, delegatePress } from './press';
import { SVENSKA_CUPEN } from '../competition/rules';

function createMockState(): CareerState {
  const state = createNewCareerState('press-test', 'swe2-tumba');
  return {
    ...state,
    gameDate: '2026-10-15',
    staffRoster: {
      ...state.staffRoster,
      [state.playerClubId]: [
        {
          id: 'asst_1',
          clubId: state.playerClubId,
          firstName: 'Mikael',
          lastName: 'Franzén',
          displayName: 'Mikael Franzén',
          roles: ['ASSISTANT_COACH'],
          wageEurPerMonth: 2500,
          contractEndSeasonYear: 2028,
        } as any,
      ],
    },
  };
}

function createMockResult(homeGoals: number, awayGoals: number, homeSusp = 1, awaySusp = 1): FastMatchResult {
  return {
    fixtureId: 'fx_user_match_1',
    engine: 'V2',
    seed: 12345,
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    homeGoals,
    awayGoals,
    homeStats: {
      goals: homeGoals,
      shots: 45,
      shootingPct: 60,
      saves: 14,
      shotsFaced: 38,
      turnovers: 8,
      twoMinuteSuspensions: homeSusp,
      sevenMetreAttempts: 3,
      sevenMetreGoals: 3,
    },
    awayStats: {
      goals: awayGoals,
      shots: 38,
      shootingPct: 55,
      saves: 12,
      shotsFaced: 45,
      turnovers: 10,
      twoMinuteSuspensions: awaySusp,
      sevenMetreAttempts: 2,
      sevenMetreGoals: 2,
    },
    events: [],
    homePlayerContributions: [],
    awayPlayerContributions: [],
  };
}

test('ensurePostMatchPress: opens a post-match press conference for a played win', () => {
  const state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_user_match_1',
    competitionId: 'swe-allsvenskan',
    round: 5,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  const result = createMockResult(32, 27);

  const updated = ensurePostMatchPress(state, fixture, result);
  const press = updated.media!.press['press:post:fx_user_match_1'];

  assert.ok(press, 'press conference exists');
  assert.equal(press.status, 'OPEN');
  assert.equal(press.kind, 'POST_MATCH');
  assert.ok(press.questions.length >= 1 && press.questions.length <= 3, '1 to 3 contextual questions generated');
  assert.equal(press.questions[0].topic, 'AFTER_WIN');
  assert.ok(press.questions[0].answers.length >= 3, 'each question has multiple response tones');
});

test('ensurePostMatchPress: includes referee question when there is a significant suspension gap', () => {
  const state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_user_match_2',
    competitionId: 'swe-allsvenskan',
    round: 6,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  // Tumba lost 24-27 with 5 suspensions vs 1
  const result = createMockResult(24, 27, 5, 1);

  const updated = ensurePostMatchPress(state, fixture, result);
  const press = updated.media!.press['press:post:fx_user_match_2'];

  assert.ok(press);
  assert.ok(press.questions.some(q => q.topic === 'REFEREE'), 'includes REFEREE question for controversy');
});

test('ensurePostMatchPress: handles Svenska Cupen context and label', () => {
  const state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_user_match_cup',
    competitionId: SVENSKA_CUPEN,
    round: 1,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'CUP',
  };
  const result = createMockResult(30, 29);

  const updated = ensurePostMatchPress(state, fixture, result);
  const press = updated.media!.press['press:post:fx_user_match_cup'];

  assert.ok(press);
  assert.match(press.context, /Svenska Cupen/);
});

test('skipPress: declines the conference without penalizing team morale', () => {
  let state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_user_match_skip',
    competitionId: 'swe-allsvenskan',
    round: 7,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  const result = createMockResult(25, 26);
  state = ensurePostMatchPress(state, fixture, result);

  const pressId = 'press:post:fx_user_match_skip';
  const skipped = skipPress(state, pressId, () => {});
  const press = skipped.media!.press[pressId];

  assert.equal(press.status, 'DECLINED');
  assert.ok(press.consequences && press.consequences.length > 0);
  assert.ok(press.consequences.some(c => c.area === 'MEDIA'), 'press penalty recorded');
  assert.ok(!press.consequences.some(c => c.area === 'TEAM'), 'no squad morale penalty for declining');
});

test('delegatePress: assistant coach answers calmly with tempered consequences', () => {
  let state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_user_match_del',
    competitionId: 'swe-allsvenskan',
    round: 8,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  const result = createMockResult(31, 24);
  state = ensurePostMatchPress(state, fixture, result);

  const pressId = 'press:post:fx_user_match_del';
  const delegated = delegatePress(state, pressId, () => {});
  const press = delegated.media!.press[pressId];

  assert.equal(press.status, 'DELEGATED');
  assert.ok(typeof press.answeredBy === 'object' && press.answeredBy !== null);
  assert.equal(press.answeredBy.name, 'Mikael Franzén');
});

test('ensureNewsTriggeredPress: opens interview for major signing and win streak', () => {
  let state = createMockState();

  state = ensureNewsTriggeredPress(state, {
    kind: 'MAJOR_SIGNING',
    playerId: 'ply_star_1',
    feeEur: 75000,
  });
  const signingPress = state.media!.press[`press:signing:ply_star_1:${state.gameDate}`];
  assert.ok(signingPress, 'signing interview opened');
  assert.equal(signingPress.kind, 'INTERVIEW');

  // Different date for subsequent interview (as press conferences enforce one sitting per day)
  const laterDate = '2026-11-05';
  state = { ...state, gameDate: laterDate };
  state = ensureNewsTriggeredPress(state, {
    kind: 'WIN_STREAK',
    streakCount: 5,
  });
  const streakPress = state.media!.press[`press:win-streak:5:${laterDate}`];
  assert.ok(streakPress, 'winning streak interview opened');
  assert.equal(streakPress.kind, 'INTERVIEW');
});

test('persistence: press conferences survive JSON round-trip without data loss', () => {
  let state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_user_match_persist',
    competitionId: 'swe-allsvenskan',
    round: 9,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  state = ensurePostMatchPress(state, fixture, createMockResult(28, 28));

  const serialized = JSON.stringify(state);
  const deserialized: CareerState = JSON.parse(serialized);

  const press = deserialized.media!.press['press:post:fx_user_match_persist'];
  assert.ok(press);
  assert.equal(press.status, 'OPEN');
  assert.equal(press.questions.length, state.media!.press['press:post:fx_user_match_persist'].questions.length);
});

test('deduplication: press conference questions have distinct topics with no duplicates', () => {
  const state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_user_match_dedup',
    competitionId: SVENSKA_CUPEN,
    round: 2,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'CUP',
  };
  // Cup match with referee controversy
  const result = createMockResult(25, 29, 6, 2);
  const updated = ensurePostMatchPress(state, fixture, result);
  const press = updated.media!.press['press:post:fx_user_match_dedup'];

  assert.ok(press);
  const topics = press.questions.map(q => q.topic);
  const uniqueTopics = new Set(topics);
  assert.equal(topics.length, uniqueTopics.size, 'all questions in the same press conference must have unique topics');

  // Answer personally using valid offered tones
  const answers: Record<string, any> = {};
  for (const q of press.questions) {
    answers[q.id] = q.answers[0].tone;
  }
  const answered = answerPress(updated, press.id, answers, () => {});
  const answeredPress = answered.media!.press[press.id];
  assert.equal(answeredPress.status, 'ANSWERED');
  assert.equal(answeredPress.answeredBy, 'MANAGER');
  assert.ok(answeredPress.consequences && answeredPress.consequences.length > 0);
});
