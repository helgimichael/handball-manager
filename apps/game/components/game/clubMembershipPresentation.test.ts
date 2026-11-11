import '../../scripts/register-asset-loader.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClubHero } from './Identity';
import { createNewCareerState } from '../../lib/career/newCareer';
import { getClub } from '../../lib/game-data';

const fresh = () => createNewCareerState('club-membership-presentation', 'swe2-tumba');

test('a promoted Division 2 club displays and links to its career Division 1 league', () => {
  const clubId = 'se_div2_team_1578815';
  const club = getClub(clubId)!;
  const canonicalCompetition = club.competitionId;
  const career = { ...fresh(), competitionMembership: { [clubId]: 'se_division1_sodra' } };
  const html = renderToStaticMarkup(createElement(ClubHero, { clubId, career }));
  assert.ok(html.includes('Division 1 S\u00f6dra'), 'show the promoted club current league');
  assert.ok(html.includes('href="/career/competitions/se_division1_sodra"'), 'link to the current league');
  assert.ok(!html.includes('href="/career/competitions/se_division2_v"'), 'do not link to its original pool');
  assert.equal(getClub(clubId)!.competitionId, canonicalCompetition, 'canonical registration remains unchanged');
});

test('a relegated club displays its current lower division', () => {
  const clubId = 'swe2-huddinge';
  const career = { ...fresh(), competitionMembership: { [clubId]: 'se_division1_norra' } };
  const html = renderToStaticMarkup(createElement(ClubHero, { clubId, career }));
  assert.ok(html.includes('Division 1 Norra'));
  assert.ok(html.includes('href="/career/competitions/se_division1_norra"'));
});

test('a stock club without a membership override retains its canonical league', () => {
  const html = renderToStaticMarkup(createElement(ClubHero, { clubId: 'swe2-tumba', career: fresh() }));
  assert.ok(html.includes('Allsvenskan'));
  assert.ok(html.includes('href="/career/competitions/swe-2"'));
});
