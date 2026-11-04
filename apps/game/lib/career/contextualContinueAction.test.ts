import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { CareerState, CareerFixture } from './types';
import { resolveContextualContinueAction, isMatchLineupReady } from './contextualContinueAction';

function createMockState(overrides: Partial<CareerState> = {}): CareerState {
  return {
    gameDate: '2026-10-15',
    processedThroughDate: '2026-10-14',
    playerClubId: 'swe_club_ifk_tumba',
    seasonId: '2026/2027',
    seasonComplete: false,
    fixtures: [],
    results: {},
    playerStatuses: {},
    matchPlans: {},
    careerEvents: [],
    media: {
      press: {},
      journalists: {},
      stories: [],
      rivalries: {},
      outletRelations: {},
      boardMood: 0,
      supporters: 0,
      pressure: {},
    },
    ...overrides,
  } as unknown as CareerState;
}

describe('Contextual Continue Action Resolution', () => {
  it('resolves ADVANCE_DAY on an ordinary calendar day with no blockers', () => {
    const state = createMockState();
    const action = resolveContextualContinueAction(state);

    assert.equal(action.kind, 'ADVANCE_DAY');
    assert.equal(action.label, 'Fortsätt »');
    assert.equal(action.sublabel, 'TILL NÄSTA HÄNDELSE');
    assert.equal(action.disabled, false);
    assert.equal(action.targetHref, null);
  });

  it('resolves PREPARE_MATCH when a match is today but lineup is missing or invalid', () => {
    const fixture: CareerFixture = {
      id: 'fix-1',
      date: '2026-10-15',
      homeClubId: 'swe_club_ifk_tumba',
      awayClubId: 'swe_club_skanela_if',
      type: 'LEAGUE',
      round: 1,
      competitionId: 'swe_allsvenskan',
    };
    const state = createMockState({ fixtures: [fixture] });
    const action = resolveContextualContinueAction(state);

    assert.equal(action.kind, 'PREPARE_MATCH');
    assert.equal(action.label, 'Förbered match');
    assert.equal(action.sublabel, 'LAGUTTAGNING KRÄVS');
    assert.equal(action.targetHref, '/career/tactics');
    assert.equal(action.disabled, false);
  });

  it('resolves START_MATCH when a match is today and lineup is confirmed', () => {
    const fixture: CareerFixture = {
      id: 'fix-1',
      date: '2026-10-15',
      homeClubId: 'swe_club_ifk_tumba',
      awayClubId: 'swe_club_skanela_if',
      type: 'LEAGUE',
      round: 1,
      competitionId: 'swe_allsvenskan',
    };
    const state = createMockState({
      fixtures: [fixture],
      matchPlans: {
        'fix-1': {
          fixtureId: 'fix-1',
          clubId: 'swe_club_ifk_tumba',
          attackStartingUnit: {
            slots: [
              { playerId: 'gk1', position: 'GK' },
              { playerId: 'v6', position: 'V6' },
              { playerId: 'v9', position: 'V9' },
              { playerId: 'm9', position: 'M9' },
              { playerId: 'h9', position: 'H9' },
              { playerId: 'h6', position: 'H6' },
              { playerId: 'm6', position: 'M6' },
            ],
          },
        } as any,
      },
    });

    const action = resolveContextualContinueAction(state);
    assert.equal(action.kind, 'START_MATCH');
    assert.equal(action.label, 'Starta match');
    assert.equal(action.targetHref, '/career/match-day/fix-1');
    assert.equal(action.disabled, false);
  });

  it('resolves RESUME_MATCH when a live match is currently active', () => {
    const state = createMockState({
      productionMatch: {
        fixture: { id: 'fix-live' } as any,
        core: { officialClock: { timeMs: 120000 }, score: { HOME: 5, AWAY: 4 } } as any,
      } as any,
    });

    // When manager is on another screen
    const actionOffRoute = resolveContextualContinueAction(state, null, '/career');
    assert.equal(actionOffRoute.kind, 'RESUME_MATCH');
    assert.equal(actionOffRoute.label, 'Återgå till match');
    assert.equal(actionOffRoute.targetHref, '/career/match-day/fix-live');
    assert.equal(actionOffRoute.disabled, false);

    // When manager is already on the match-day route
    const actionOnRoute = resolveContextualContinueAction(state, null, '/career/match-day/fix-live');
    assert.equal(actionOnRoute.label, 'Match pågår');
    assert.equal(actionOnRoute.disabled, true);
    assert.equal(actionOnRoute.targetHref, null);
  });

  it('resolves PRESS_CONFERENCE when an open post-match press conference is pending', () => {
    const state = createMockState({
      media: {
        press: {
          'press:post:fix-1': {
            id: 'press:post:fix-1',
            status: 'OPEN',
            date: '2026-10-15',
            expiresOn: '2026-10-17',
            title: 'Efter matchen mot Skånela',
            questions: [],
          } as any,
        },
      } as any,
    });

    const action = resolveContextualContinueAction(state, null, '/career');
    assert.equal(action.kind, 'PRESS_CONFERENCE');
    assert.equal(action.label, 'Presskonferens');
    assert.equal(action.sublabel, 'MEDIA & INTERVJU');
    assert.equal(action.targetHref, '/career/media/press/press%3Apost%3Afix-1');
  });

  it('resolves DECISION_BLOCKED when a mandatory decision requires action', () => {
    const state = createMockState({
      careerEvents: [
        {
          id: 'offer-1',
          date: '2026-10-15',
          type: 'TRANSFER_OFFER',
          priority: 'ACTION_REQUIRED',
          requiresAction: true,
          resolved: false,
          subject: 'Bud på spelare',
          summary: 'Ett bud har inkommit som kräver ditt ställningstagande.',
        } as any,
      ],
    });

    const action = resolveContextualContinueAction(state);
    assert.equal(action.kind, 'DECISION_BLOCKED');
    assert.equal(action.label, 'Beslut krävs');
    assert.equal(action.sublabel, 'ÅTGÄRD KRÄVS');
    assert.equal(action.blockReason, 'Ett bud har inkommit som kräver ditt ställningstagande.');
    assert.equal(action.targetHref, '/career/inbox?message=msg%3Aoffer-1');
  });

  it('resolves SEASON_COMPLETE and disables button when the season is finished', () => {
    const state = createMockState({ seasonComplete: true });
    const action = resolveContextualContinueAction(state);

    assert.equal(action.kind, 'SEASON_COMPLETE');
    assert.equal(action.label, 'Säsong klar');
    assert.equal(action.disabled, true);
    assert.equal(action.targetHref, null);
  });
});
