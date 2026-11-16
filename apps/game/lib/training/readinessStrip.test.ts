import '../../scripts/register-asset-loader.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { snapshotAllClubsStaff } from '../gameWorld/staffIdentitySnapshot';
import { getCareerSquad } from '../career/careerWorld';
import type { CareerState } from '../career/types';
import { resolveTrainingWeek } from './trainingSchedule';
import { projectWeekReadiness } from './readinessProjection';
import { buildReadinessRows, planBulkLoad } from './readinessStrip';

const club = 'swe2-tumba', date = '2026-08-24';
const initial = createNewCareerState('trn-strip', club, snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'), snapshotAllClubsStaff('swe-2'));
function career(): CareerState { return { ...structuredClone(initial), gameDate: date, processedThroughDate: '2026-08-23', trainingWeeks: {} }; }

test('rows cover the squad, rank medical limits and low readiness first, and expose load constraints', () => {
  const base = career();
  const [a, b, c] = getCareerSquad(base);
  const s: CareerState = {
    ...base,
    playerStatuses: { ...base.playerStatuses, [a.id]: { playerId: a.id, availability: 'LIMITED' } },
    playerPhysicalState: { ...base.playerPhysicalState, [b.id]: { playerId: b.id, currentEnergy: 40, lastUpdatedDate: date, recentLoad: 0 } },
  };
  const rows = buildReadinessRows(s, projectWeekReadiness(s, resolveTrainingWeek(s, date)));
  assert.equal(rows.length, getCareerSquad(s).length);
  assert.equal(rows[0].player.id, a.id);
  assert.equal(rows[0].availability, 'LIMITED');
  assert.ok(!rows[0].allowedSettings.includes('FULL'));
  assert.ok(rows[0].constraint);
  assert.equal(rows[1].player.id, b.id);
  assert.equal(rows[1].readinessTone, 'neg');
  assert.ok(rows.every(r => r.projected !== null));
  const bulk = planBulkLoad(rows, [a.id, b.id, c.id], 'FULL');
  assert.deepEqual(bulk.apply.sort(), [b.id, c.id].sort());
  assert.equal(bulk.skipped[0].playerId, a.id);
  assert.deepEqual(planBulkLoad(rows, [a.id], 'REDUCED').apply, [a.id]);
});
