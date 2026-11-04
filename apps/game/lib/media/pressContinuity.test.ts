import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import type { CareerFixture, CareerState } from '../career/types';
import type { FastMatchResult } from '@handball-manager/game-simulation';
import { ensurePostMatchPress, skipPress } from './postMatchPress';
import { answerPress, delegatePress, openPress } from './press';
import { publish } from './newsEngine';
import type { CareerEvent } from '../career/careerEvents';

function createMockState(): CareerState {
  const state = createNewCareerState('press-continuity-test', 'swe2-tumba');
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

function createMatchResult(homeGoals: number, awayGoals: number, topScorerGoals = 0, topScorerId = 'ply_scorer_1'): FastMatchResult {
  return {
    fixtureId: 'fx_test_continuity',
    engine: 'V2',
    seed: 42,
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    homeGoals,
    awayGoals,
    homeStats: {
      goals: homeGoals,
      shots: 42,
      shootingPct: 62,
      saves: 13,
      shotsFaced: 36,
      turnovers: 7,
      twoMinuteSuspensions: 2,
      sevenMetreAttempts: 3,
      sevenMetreGoals: 3,
    },
    awayStats: {
      goals: awayGoals,
      shots: 36,
      shootingPct: 56,
      saves: 11,
      shotsFaced: 42,
      turnovers: 9,
      twoMinuteSuspensions: 2,
      sevenMetreAttempts: 2,
      sevenMetreGoals: 2,
    },
    events: [],
    homePlayerContributions: topScorerGoals > 0 ? [
      {
        playerId: topScorerId,
        goals: topScorerGoals,
        shots: topScorerGoals + 2,
        rating: 8.5,
        started: true,
      },
    ] : [],
    awayPlayerContributions: [],
  };
}

test('press continuity: post-match question grounds in real match score and opponent short name', () => {
  const state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_test_continuity',
    competitionId: 'swe-allsvenskan',
    round: 4,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  const result = createMatchResult(31, 25);

  const updated = ensurePostMatchPress(state, fixture, result);
  const press = updated.media!.press['press:post:fx_test_continuity'];

  assert.ok(press);
  const q1 = press.questions[0];
  assert.equal(q1.topic, 'AFTER_WIN');
  assert.match(q1.text, /31–25/);
  assert.match(q1.text, /Varberg/);
});

test('press continuity: post-match highlights top scorer when player scores 5+ goals', () => {
  const state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_test_scorer',
    competitionId: 'swe-allsvenskan',
    round: 5,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  const result = createMatchResult(29, 26, 8, 'ply_scorer_1');

  const updated = ensurePostMatchPress(state, fixture, result);
  const press = updated.media!.press['press:post:fx_test_scorer'];

  assert.ok(press);
  const scorerQuestion = press.questions.find((q) => q.playerId === 'ply_scorer_1');
  assert.ok(scorerQuestion, 'question for top scorer exists');
  assert.match(scorerQuestion.text, /8 mål/);
  assert.ok(scorerQuestion.answers.some((a) => a.text.includes('beröm')), 'player-grounded answers available');
});

test('press continuity: post-match does not fabricate phantom rival statements', () => {
  const state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_no_phantom',
    competitionId: 'swe-allsvenskan',
    round: 6,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  const result = createMatchResult(28, 27);

  const updated = ensurePostMatchPress(state, fixture, result);
  const press = updated.media!.press['press:post:fx_no_phantom'];

  assert.ok(press);
  // Must NOT contain RIVAL_RESPONSE when no rival comment was actually made
  const rivalQ = press.questions.find((q) => q.topic === 'RIVAL_RESPONSE');
  assert.equal(rivalQ, undefined, 'no phantom rival question without a published rival comment');
  assert.ok(!press.questions.some((q) => q.text.includes('uttalat sig om er inför matchen')));
});

test('press continuity: post-match quotes genuine rival comment if actually published', () => {
  let state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_real_rival',
    competitionId: 'swe-allsvenskan',
    round: 7,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };

  // Publish an actual rival comment for this fixture
  state = publish(state, {
    key: `rival-after:${fixture.id}`,
    kind: 'RIVAL_COMMENT',
    date: '2026-10-15',
    importance: 3,
    clubIds: ['swe2-varberg', 'swe2-tumba'],
    personIds: ['varberg_coach_1'],
    fixtureId: fixture.id,
    facts: { coach: 'Anders Hallberg', club: 'swe2-varberg', target: 'swe2-tumba', after: true },
    quote: { who: 'Anders Hallberg, Varberg', text: 'Vi förlorade mot visslan, inte mot dem.' },
    destinations: [{ route: 'MEDIA' }],
  });

  const result = createMatchResult(28, 27);
  const updated = ensurePostMatchPress(state, fixture, result);
  const press = updated.media!.press['press:post:fx_real_rival'];

  assert.ok(press);
  const rivalQ = press.questions.find((q) => q.topic === 'RIVAL_RESPONSE');
  assert.ok(rivalQ, 'genuine rival comment triggers RIVAL_RESPONSE');
  assert.match(rivalQ.text, /Vi förlorade mot visslan, inte mot dem/);
});

test('press continuity: answering generates an inbox event and published article', () => {
  let state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_answer_flow',
    competitionId: 'swe-allsvenskan',
    round: 8,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  const result = createMatchResult(30, 26);
  state = ensurePostMatchPress(state, fixture, result);

  const pressId = 'press:post:fx_answer_flow';
  const press = state.media!.press[pressId];

  const answers = Object.fromEntries(press.questions.map((q) => [q.id, q.answers[0].tone]));
  const emittedEvents: CareerEvent[] = [];

  const answered = answerPress(state, pressId, answers, (e) => emittedEvents.push(e));

  // 1. Article published in state.media.stories
  const story = Object.values(answered.media!.stories).find((s) => s.eventKey === `interview:${pressId}`);
  assert.ok(story, 'media story was published');
  assert.match(story.headline, /IFK Tumba/);

  // 2. Inbox event emitted
  assert.ok(emittedEvents.length >= 1, 'inbox event was emitted');
  const mediaEvent = emittedEvents.find((e) => e.type === 'MEDIA' && e.id.includes('media-article'));
  assert.ok(mediaEvent, 'MEDIA inbox event emitted');
  assert.match(mediaEvent.subject, /IFK Tumba/);
  assert.match(mediaEvent.summary, /pressrummet|Efter IFK Tumba/i);
});

test('press continuity: skipping emits inbox notification of absence', () => {
  let state = createMockState();
  const fixture: CareerFixture = {
    id: 'fx_skip_flow',
    competitionId: 'swe-allsvenskan',
    round: 9,
    date: '2026-10-15',
    homeClubId: 'swe2-tumba',
    awayClubId: 'swe2-varberg',
    type: 'LEAGUE',
  };
  const result = createMatchResult(22, 28);
  state = ensurePostMatchPress(state, fixture, result);

  const pressId = 'press:post:fx_skip_flow';
  const emittedEvents: CareerEvent[] = [];

  const skipped = skipPress(state, pressId, (e) => emittedEvents.push(e));
  assert.equal(skipped.media!.press[pressId].status, 'DECLINED');

  const skipEvent = emittedEvents.find((e) => e.type === 'MEDIA' && e.id.includes('media-skipped'));
  assert.ok(skipEvent, 'skip event emitted to inbox');
  assert.match(skipEvent.subject, /uteblev/i);
});
