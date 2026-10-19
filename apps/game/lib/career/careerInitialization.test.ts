import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { getClubsByCompetition } from '../game-data';
import { snapshotWorldSquads } from '../gameWorld/serverSnapshot';
import { createNewCareerSave } from './careerInitialization';
import { fetchWorldSquads, SQUAD_SNAPSHOT_ERROR } from './squadSnapshot';
import { __setSaveBackendForTests, getSave } from '../save/saveRepository';
import { createMemoryBackend, type SaveStorageBackend } from '../save/saveStorage';

const originalFetch = globalThis.fetch;
let backend: SaveStorageBackend;
const input = { selectedNations: ['SWE'], selectedCompetitionIds: ['swe-2'], clubId: 'swe2-tumba', manager: { name: 'Guard test', nationality: 'SWE', dateOfBirth: '1980-01-01' }, gameDate: '2026-08-19' };
beforeEach(() => { backend = createMemoryBackend('career-init'); __setSaveBackendForTests(backend); });
afterEach(() => { globalThis.fetch = originalFetch; __setSaveBackendForTests(null); });

function installFetch(leagueOverride?: unknown, failureStatus?: number) {
  globalThis.fetch = async request => {
    const url = new URL(String(request), 'https://game.test');
    if (url.pathname.endsWith('/squad-snapshot')) {
      const competition = url.searchParams.get('competitionId')!;
      if (competition === 'swe-2' && failureStatus) return new Response('{}', { status: failureStatus });
      return Response.json(competition === 'swe-2' && leagueOverride !== undefined ? leagueOverride : { worldSquads: snapshotWorldSquads(competition) });
    }
    return Response.json({});
  };
}

test('a network error rejects career creation with actionable feedback and no partial record', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(createNewCareerSave(input), { message: SQUAD_SNAPSHOT_ERROR });
  assert.equal(await backend.saveRecordCount(), 0);
});

test('HTTP failures and incomplete required league snapshots stop creation before any career write', async () => {
  installFetch(undefined, 503);
  await assert.rejects(createNewCareerSave(input), { message: SQUAD_SNAPSHOT_ERROR });
  assert.equal(await backend.saveRecordCount(), 0);
  const full = snapshotWorldSquads('swe-2');
  const clubId = Object.keys(full)[0];
  for (const response of [{}, { worldSquads: {} }, { worldSquads: { ...full, [clubId]: [] } }, { worldSquads: { ...full, [clubId]: full[clubId].filter(p => p.position !== 'MV') } }]) {
    installFetch(response);
    await assert.rejects(createNewCareerSave(input), { message: SQUAD_SNAPSHOT_ERROR });
    assert.equal(await backend.saveRecordCount(), 0);
  }
});

test('invalid JSON in the squad endpoint surfaces the squad loading error', async () => {
  globalThis.fetch = async () => new Response('{invalid');
  await assert.rejects(fetchWorldSquads('swe-2'), { message: SQUAD_SNAPSHOT_ERROR });
});

test('a complete initialization publishes one complete save using its own deterministic seed', async () => {
  installFetch();
  let writes = 0;
  const put = backend.putSave;
  backend.putSave = async save => {
    assert.ok(save.careerState, 'there is no preliminary envelope-only write');
    for (const club of getClubsByCompetition('swe-2')) assert.ok(save.careerState.worldSquads[club.id]?.length);
    writes++;
    await put(save);
  };
  const save = await createNewCareerSave(input);
  assert.equal(writes, 1);
  assert.equal(save.careerState?.saveSeed, save.saveId);
  assert.equal(await backend.saveRecordCount(), 1);
  assert.deepEqual((await getSave(save.saveId))?.careerState, save.careerState);
});
