import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from './newCareer';
import { competitionUpdatesFor } from './competitionUpdates';
import { buildCompetitionUpdateEvent } from './careerEvents';
import { resolveDestinationHref, destinationLabel } from './destinations';
import { SVENSKA_CUPEN, HANDBOLLSLIGAN } from '../competition/rules';
import type { CareerFixture } from './types';

function career() {
  const state = createNewCareerState('cup-notice', 'swe2-tumba');
  const fx = (id: string, competitionId: string, type: CareerFixture['type']): CareerFixture => ({ id, competitionId, round: 1, date: '2026-09-01', homeClubId: 'a', awayClubId: 'b', type });
  return { ...state, fixtures: [...state.fixtures, fx('own', state.competitionId, 'LEAGUE'), fx('other', HANDBOLLSLIGAN, 'LEAGUE'), fx('cup1', SVENSKA_CUPEN, 'CUP'), fx('cup2', SVENSKA_CUPEN, 'CUP'), fx('friendly', state.competitionId, 'FRIENDLY')] };
}

test('a cup-only day never claims the league table changed, and links to Svenska Cupen', () => {
  const state = career();
  const updates = competitionUpdatesFor(state, ['cup1', 'cup2']);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].competitionId, SVENSKA_CUPEN);
  assert.equal(updates[0].kind, 'CUP');
  const event = buildCompetitionUpdateEvent('2026-09-01', updates[0].competitionId, updates[0]);
  assert.doesNotMatch(event.subject, /Tabellen/);
  assert.match(event.subject, /Svenska Cupen/);
  assert.deepEqual(event.destinations, [{ route: 'COMPETITION', competitionId: SVENSKA_CUPEN }]);
  assert.equal(resolveDestinationHref(event.destinations[0]), `/career/competitions/${SVENSKA_CUPEN}`);
  assert.equal(destinationLabel(event.destinations[0]), 'Öppna Svenska Cupen');
});

test('only the manager\'s own league produces a table update; other tiers and friendlies stay quiet', () => {
  const state = career();
  assert.deepEqual(competitionUpdatesFor(state, ['other', 'friendly']), []);
  const [own] = competitionUpdatesFor(state, ['own', 'other']);
  assert.equal(own.kind, 'LEAGUE');
  assert.equal(own.ownLeague, true);
  const event = buildCompetitionUpdateEvent('2026-09-01', own.competitionId, own);
  assert.equal(event.id, 'COMPETITION_UPDATE:2026-09-01', 'the own-league id is unchanged for old saves');
  assert.match(event.subject, /^Tabellen är uppdaterad/);
});
