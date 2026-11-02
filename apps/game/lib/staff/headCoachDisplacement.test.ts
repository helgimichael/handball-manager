import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { snapshotWorldSquads, snapshotGameplayRatings } from '../gameWorld/serverSnapshot';
import { loadClubStaffIdentity } from '../gameWorld/staffIdentityLoader';
import { getClubsByCompetition } from '../game-data';
import { migrateCareerState } from '../career/saveMigration';
import { displaceIncumbentHeadCoach } from './headCoachDisplacement';

function career() {
  const staff = Object.fromEntries(getClubsByCompetition('swe-2').map(c => [c.id, loadClubStaffIdentity(c.id, 'allsvenskan')]));
  return createNewCareerState('hc-2026', 'swe2-tumba', snapshotWorldSquads('swe-2'), undefined, snapshotGameplayRatings('swe-2'), staff as never, '4_WEEKS' as never);
}

test('taking over a club moves its head coach to the unemployed staff market, identity intact', () => {
  const s = career();
  const roster = s.staffRoster[s.playerClubId];
  assert.ok(!roster.some(m => m.roles.includes('HEAD_COACH')), 'no second head coach beside the manager');
  const released = Object.values(s.staffMarket?.freeAgents ?? {}).find(m => m.displayName === 'Mats Kardell');
  assert.ok(released, 'the former head coach is a free agent');
  assert.ok(released.roles.includes('HEAD_COACH') && Object.keys(released.profile.attributes).length > 0, 'role and attributes preserved');
  assert.equal(released.clubId, '');
  assert.ok(Object.values(s.staffMarket!.freeAgents).length > 5, 'the generated market still exists alongside him');
});

test('idempotent, and old saves with a lingering head coach are resolved on load', () => {
  const s = career();
  assert.deepEqual(displaceIncumbentHeadCoach(s), s);
  const coach = Object.values(s.staffMarket!.freeAgents).find(m => m.displayName === 'Mats Kardell')!;
  const legacy = { ...s, staffRoster: { ...s.staffRoster, [s.playerClubId]: [...s.staffRoster[s.playerClubId], { ...coach, clubId: s.playerClubId }] } };
  const migrated = migrateCareerState(legacy);
  assert.ok(!migrated.staffRoster[migrated.playerClubId].some(m => m.roles.includes('HEAD_COACH')));
});
