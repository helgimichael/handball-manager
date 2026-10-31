import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { dataFileExists, readDataFile, readDataDirectory } from './dataFiles';
import { DEFAULT_DATA_ROOT } from '../editor/paths';
import { clearDefaultCatalogCache } from '../editor/catalog';
import { snapshotWorldSquads, snapshotGameplayRatings, snapshotAiTacticalPreferences } from './serverSnapshot';
import { snapshotAllClubsStaff } from './staffIdentitySnapshot';
import { snapshotClubIdentity } from './clubIdentitySnapshot';
import { CLUBS } from '../game-data';

function withSource<T>(source: 'bundled' | undefined, read: () => T): T {
  const previous = process.env.HM_REAL_WORLD_DATA;
  if (source) process.env.HM_REAL_WORLD_DATA = source;
  else delete process.env.HM_REAL_WORLD_DATA;
  clearDefaultCatalogCache();
  try { return read(); }
  finally {
    if (previous === undefined) delete process.env.HM_REAL_WORLD_DATA;
    else process.env.HM_REAL_WORLD_DATA = previous;
    clearDefaultCatalogCache();
  }
}

test('bundled Handbollsligan squads, ratings, staff and dated identity snapshots equal native Node data', () => {
  const read = () => ({
    squads: snapshotWorldSquads('se_handbollsligan_herr'),
    ratings: snapshotGameplayRatings('se_handbollsligan_herr'),
    staff: snapshotAllClubsStaff('se_handbollsligan_herr'),
    preferences: snapshotAiTacticalPreferences('se_handbollsligan_herr', '2026/27', '2026-07-01'),
    earlyIdentity: snapshotClubIdentity('se_club_alingsas_hk', '2026-07-01'),
    laterIdentity: snapshotClubIdentity('se_club_alingsas_hk', '2027-04-01'),
  });
  const native = withSource(undefined, read);
  const bundled = withSource('bundled', read);
  assert.deepEqual(bundled, native);
  assert.equal(Object.keys(bundled.squads).length, 14);
  // 268 HBL players, less the 2 (HM-DATA-1.3) + 1 (HM-DATA-1.5 loan) moved to their 2026/27 Herrallsvenskan clubs.
  assert.equal(Object.values(bundled.squads).flat().length, 265);
  assert.equal(Object.values(bundled.ratings).flat().length, 265);
  for (const [clubId, players] of Object.entries(bundled.squads)) {
    assert.deepEqual(new Set(bundled.ratings[clubId].map(player => player.playerId)), new Set(players.map(player => player.id)));
    assert.ok(bundled.ratings[clubId].every(player => Number.isFinite(player.ca) && Number.isFinite(player.pa)));
  }
});

test('bundled squads preserve every real-world competition, including the unconditional recruitment pools', () => {
  const ids = [...new Set(CLUBS.filter(club => club.dataSource === 'REAL_WORLD').map(club => club.competitionId))];
  const read = () => Object.fromEntries(ids.map(id => [id, snapshotWorldSquads(id)]));
  assert.deepEqual(withSource('bundled', read), withSource(undefined, read));
});

test('bundled reads keep the canonical directory structure and reject missing or escaping paths', () => {
  withSource('bundled', () => {
    assert.ok(dataFileExists(DEFAULT_DATA_ROOT));
    assert.ok(readDataDirectory(DEFAULT_DATA_ROOT).some(entry => entry.name === 'sweden' && entry.isDirectory()));
    const outside = path.resolve(DEFAULT_DATA_ROOT, '..', 'outside.json');
    assert.equal(dataFileExists(outside), false);
    assert.throws(() => readDataFile(outside), /paketerade datakällan/);
    assert.throws(() => readDataFile(path.join(DEFAULT_DATA_ROOT, 'missing.json')), /paketerade datakällan/);
    assert.throws(() => readDataDirectory(path.join(DEFAULT_DATA_ROOT, 'missing')), /paketerade datakatalogen/);
  });
});
