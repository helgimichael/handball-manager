import '../../scripts/register-asset-loader.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { snapshotAllClubsStaff } from '../gameWorld/staffIdentitySnapshot';
import { getCareerSquad } from '../career/careerWorld';
import type { CareerState } from '../career/types';
import type { PlayerDevelopmentState } from '../development/types';
import { developmentLeaderboard } from './developmentBoard';

const club = 'swe2-tumba', date = '2026-08-24';
const initial = createNewCareerState('trn-dev', club, snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'), snapshotAllClubsStaff('swe-2'));
const dev = (playerId: string, history: PlayerDevelopmentState['developmentHistory']): PlayerDevelopmentState => ({ playerId, attributeStimulus: {}, attributeQualityWeightedSum: {}, attributeProgress: {}, lastDevelopmentDate: history[0]?.date ?? null, developmentHistory: history });

test('ranks by recent net gains with Swedish labels; old changes only show as latest', () => {
  const base: CareerState = { ...structuredClone(initial), gameDate: date };
  const [a, b, c] = getCareerSquad(base);
  const s: CareerState = { ...base, playerDevelopmentState: { ...base.playerDevelopmentState,
    [a.id]: dev(a.id, [{ date: '2026-08-17', attribute: 'FINISHING', previousValue: 12, newValue: 13, sourceSummary: '' }]),
    [b.id]: dev(b.id, [
      { date: '2026-08-17', attribute: 'FINISHING', previousValue: 11, newValue: 12, sourceSummary: '' },
      { date: '2026-08-10', attribute: 'FINISHING', previousValue: 10, newValue: 11, sourceSummary: '' },
      { date: '2026-08-10', attribute: 'ACCELERATION', previousValue: 9, newValue: 10, sourceSummary: '' },
    ]),
    [c.id]: dev(c.id, [{ date: '2026-05-01', attribute: 'FINISHING', previousValue: 8, newValue: 9, sourceSummary: '' }]),
  } };
  const rows = developmentLeaderboard(s);
  assert.equal(rows[0].player.id, b.id);
  assert.equal(rows[0].totalGain, 3);
  assert.deepEqual(rows[0].gains.map(g => [g.from, g.to]), [[10, 12], [9, 10]]);
  assert.notEqual(rows[0].gains[0].label, 'FINISHING');
  assert.equal(rows[1].player.id, a.id);
  const cRow = rows.find(r => r.player.id === c.id)!;
  assert.equal(cRow.totalGain, 0);
  assert.equal(cRow.latest?.to, 9);
  assert.equal(cRow.status, 'IMPROVING');
  assert.equal(rows.length, getCareerSquad(s).length);
});
