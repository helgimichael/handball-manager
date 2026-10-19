import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { withoutReplayPayloads } from '../career/matchArchiveSummary';
import type { PlayedMatchArchive } from '../career/productionMatch';
import { createMemoryBackend, type SaveStorageBackend } from './saveStorage';
import { __setSaveBackendForTests, createSave, deleteSave, getActiveSaveId, getMatchArchiveById, getSave, saveCareerState, setActiveSaveId } from './saveRepository';
import { findMatchArchive, storeMatchArchive } from './matchArchiveStorage';

const input = { selectedNations: ['SWE'], selectedCompetitionIds: ['swe-2'], clubId: 'swe2-tumba', manager: { name: 'Archive test', nationality: 'SWE', dateOfBirth: '1980-01-01' }, gameDate: '2026-08-19' };
let backend: SaveStorageBackend;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
beforeEach(() => {
  backend = createMemoryBackend('archive-lifecycle');
  __setSaveBackendForTests(backend);
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } } });
});
afterEach(() => {
  __setSaveBackendForTests(null);
  for (const [key, descriptor] of [['window', originalWindow], ['indexedDB', originalIndexedDb]] as const) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
async function savedCareer() {
  const save = await createSave(input);
  const career = createNewCareerState(save.saveId, save.clubId);
  const archive: PlayedMatchArchive = { format: 1, fixture: career.fixtures[0], seed: 42, version: 'test', frames: [[0, 0, 1, 0, 0, 0, 0]], events: [], people: [], load: {}, result: { fixtureId: career.fixtures[0].id, homeGoals: 29, awayGoals: 28 } as PlayedMatchArchive['result'] };
  await saveCareerState(save.saveId, { ...career, matchArchives: { [archive.fixture.id]: archive } });
  return { save, career, archive };
}

test('normal career loading never opens archive storage or hydrates payloads', async () => {
  const { save, archive } = await savedCareer();
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open() { throw new Error('Unexpected eager archive read'); } } });
  const loaded = await getSave(save.saveId);
  assert.equal(loaded?.careerState?.matchArchives, undefined);
  assert.deepEqual(loaded?.careerState?.matchArchiveIds, [archive.fixture.id]);
  const summary = loaded!.careerState!.matchArchiveSummaries![archive.fixture.id];
  assert.equal(summary.result.homeGoals, 29);
  assert.ok(!('frames' in summary) && !('events' in summary) && !('frameData' in summary));
});

test('on-demand archive reads are scoped to the requested or active career and return null for missing records', async () => {
  const { save, career, archive } = await savedCareer();
  const other = await createSave(input);
  const otherArchive = { ...archive, seed: 99 };
  await saveCareerState(other.saveId, { ...career, matchArchives: { [archive.fixture.id]: otherArchive } });
  setActiveSaveId(save.saveId);
  assert.deepEqual(await getMatchArchiveById(archive.fixture.id), archive);
  assert.deepEqual(await getMatchArchiveById(archive.fixture.id, other.saveId), otherArchive);
  assert.equal(await getMatchArchiveById('not-referenced'), null);
  await backend.putSave({ ...save, careerState: { ...career, matchArchiveIds: ['referenced-but-missing'] } });
  assert.equal(await getMatchArchiveById('referenced-but-missing'), null);
});

test('saving unloaded or partially available archives preserves every existing reference', async () => {
  const { save, career, archive } = await savedCareer();
  const loaded = (await getSave(save.saveId))!;
  await saveCareerState(save.saveId, { ...loaded.careerState!, matchArchiveIds: [...loaded.careerState!.matchArchiveIds!, 'missing-old-replay'] });
  const nextArchive = { ...archive, fixture: career.fixtures[1], result: { ...archive.result, fixtureId: career.fixtures[1].id } };
  await saveCareerState(save.saveId, { ...career, matchArchives: { [nextArchive.fixture.id]: nextArchive } });
  const stored = (await getSave(save.saveId))!.careerState!;
  assert.deepEqual(stored.matchArchiveIds, [archive.fixture.id, 'missing-old-replay', nextArchive.fixture.id]);
  assert.equal(stored.matchArchives, undefined);
  assert.deepEqual(await getMatchArchiveById(archive.fixture.id, save.saveId), archive);
  assert.ok(stored.matchArchiveSummaries?.[archive.fixture.id]);
});

test('deleting a career flushes pending writes, removes its archives and leaves another career intact', async () => {
  const { save, career, archive } = await savedCareer();
  const other = await createSave(input);
  await saveCareerState(other.saveId, { ...career, matchArchives: { [archive.fixture.id]: archive } });
  const nextArchive = { ...archive, fixture: career.fixtures[1], result: { ...archive.result, fixtureId: career.fixtures[1].id } };
  const pending = saveCareerState(save.saveId, { ...career, matchArchives: { [nextArchive.fixture.id]: nextArchive } });
  setActiveSaveId(save.saveId);
  await deleteSave(save.saveId);
  await pending;
  assert.equal(await getSave(save.saveId), null);
  assert.equal(await findMatchArchive(save.saveId, archive.fixture.id), null);
  assert.equal(await findMatchArchive(save.saveId, nextArchive.fixture.id), null);
  assert.equal(getActiveSaveId(), null);
  assert.deepEqual(await getMatchArchiveById(archive.fixture.id, other.saveId), archive);
  // Cleanup also invalidates the immutable-write cache for deleted keys.
  await storeMatchArchive(save.saveId, archive);
  assert.deepEqual(await findMatchArchive(save.saveId, archive.fixture.id), archive);
});

test('legacy inline archives migrate once and can be released from the runtime state after commit', async () => {
  const { save, career, archive } = await savedCareer();
  const inline = { ...career, matchArchives: { [archive.fixture.id]: archive } };
  await backend.putSave({ ...save, careerState: inline });
  const loaded = await getSave(save.saveId);
  assert.equal(loaded?.careerState?.matchArchives, undefined);
  assert.deepEqual(await getMatchArchiveById(archive.fixture.id, save.saveId), archive);
  const released = withoutReplayPayloads(inline);
  assert.equal(released.matchArchives, undefined);
  assert.ok(released.matchArchiveSummaries?.[archive.fixture.id]);
  assert.deepEqual(released.results, inline.results);
  assert.ok(inline.matchArchives[archive.fixture.id], 'caller state is not mutated');
});

test('archive storage failures remain visible and prevent deletion of the career record', async () => {
  const { save, archive } = await savedCareer();
  setActiveSaveId(save.saveId);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open() {
    const request = { onerror: null as (() => void) | null };
    queueMicrotask(() => request.onerror?.());
    return request;
  } } });
  await assert.rejects(getMatchArchiveById(archive.fixture.id), /Matcharkiven kunde inte öppnas/);
  await assert.rejects(deleteSave(save.saveId), /Matcharkiven kunde inte öppnas/);
  assert.ok(await backend.getSave(save.saveId));
  assert.equal(getActiveSaveId(), save.saveId);
});
