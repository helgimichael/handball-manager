import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { advanceProductionMatch, createProductionSession, type PlayedMatchArchive } from '../career/productionMatch';
import { encodeFrames } from '../career/matchFrames';
import { snapshotWorldSquads } from '../gameWorld/serverSnapshot';
import { withoutReplayPayloads } from '../career/matchArchiveSummary';
import { createMemoryBackend, type SaveStorageBackend } from './saveStorage';
import {
  __setSaveBackendForTests, createSave, exportSaveAsJson, getActiveSaveId,
  getSave, importSaveFromJson, saveCareerState, setActiveSaveId,
  type PortableCareerBackup,
} from './saveRepository';
import { readMatchArchive } from './matchArchiveStorage';

const input = {
  selectedNations: ['SWE'], selectedCompetitionIds: ['swe-2'], clubId: 'swe2-tumba',
  manager: { name: 'Backup Manager', nationality: 'SWE', dateOfBirth: '1980-01-01' }, gameDate: '2026-08-22',
};
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalIndexedDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const originalCreateUrl = URL.createObjectURL;
const originalRevokeUrl = URL.revokeObjectURL;
let backend: SaveStorageBackend;
let downloaded: Blob | undefined;
let filename: string;
let clicked: boolean;

beforeEach(() => {
  backend = createMemoryBackend('portable-backup-test');
  __setSaveBackendForTests(backend);
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) },
  } });
  downloaded = undefined; filename = ''; clicked = false;
  URL.createObjectURL = blob => { assert.ok(blob instanceof Blob); downloaded = blob; return 'blob:backup-test'; };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ href: '', set download(value: string) { filename = value; }, click() { clicked = true; } }),
  } });
});

afterEach(() => {
  __setSaveBackendForTests(null);
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
  if (originalIndexedDb) Object.defineProperty(globalThis, 'indexedDB', originalIndexedDb);
  else Reflect.deleteProperty(globalThis, 'indexedDB');
  URL.createObjectURL = originalCreateUrl;
  URL.revokeObjectURL = originalRevokeUrl;
});

async function source() {
  const save = await createSave(input);
  const state = createNewCareerState(save.saveId, input.clubId);
  const fixture = state.fixtures.find(f => f.homeClubId === input.clubId || f.awayClubId === input.clubId)!;
  const archive: PlayedMatchArchive = {
    format: 2, fixture, version: 'test-core', seed: 123,
    people: [], events: [], frameData: encodeFrames([[0, 0, 1, 0, 0, 1000, 2000]]), load: {},
    result: { fixtureId: fixture.id } as PlayedMatchArchive['result'],
  };
  const otherFixture = state.fixtures.find(f => f.id !== fixture.id)!;
  const otherArchive: PlayedMatchArchive = { ...archive, format: 1, fixture: otherFixture, frameData: undefined,
    frames: [[0, 0, 1, 0, 0, 1000, 2000]], result: { ...archive.result, fixtureId: otherFixture.id } };
  const career = { ...state, matchArchives: { [fixture.id]: archive, [otherFixture.id]: otherArchive } };
  // Deliberately don't await: export must drain the queued write.
  const pending = saveCareerState(save.saveId, career);
  await exportSaveAsJson(save.saveId);
  await pending;
  assert.ok(downloaded);
  const backup = JSON.parse(await downloaded.text()) as PortableCareerBackup;
  return { save, career, archive, backup };
}

function file(backup: unknown): File {
  return new File([JSON.stringify(backup)], 'career.json', { type: 'application/json' });
}

test('save -> download JSON -> import -> load preserves state and all replay payloads under a new ID', async () => {
  const { save, career, archive, backup } = await source();
  assert.ok(clicked);
  assert.ok(filename.startsWith(`${input.clubId}_${career.gameDate}_`));
  assert.ok(filename.endsWith('.json'));
  assert.equal(backup.backupVersion, 1);
  assert.deepEqual(backup.archives[archive.fixture.id], archive);
  assert.equal(Object.keys(backup.archives).length, 2);
  assert.equal(backup.save.careerState?.matchArchives, undefined, 'archives are not duplicated in the career record');
  const sourceRecord = await backend.getSave(save.saveId);
  setActiveSaveId(save.saveId);
  const put = backend.putSave;
  backend.putSave = async restored => {
    assert.equal(getActiveSaveId(), save.saveId, 'pointer changes after the career write');
    for (const [id, payload] of Object.entries(backup.archives)) {
      assert.deepEqual(await readMatchArchive(restored.saveId, id), payload, 'every archive commits before career record');
    }
    await put(restored);
  };
  const id = await importSaveFromJson(file(backup));
  assert.notEqual(id, save.saveId);
  assert.equal(getActiveSaveId(), id);
  const loaded = await getSave(id);
  assert.deepEqual(JSON.parse(JSON.stringify(loaded?.careerState)), JSON.parse(JSON.stringify(withoutReplayPayloads(career))));
  assert.deepEqual(loaded?.manager, save.manager);
  assert.equal(loaded?.careerState?.saveSeed, save.saveId, 'new storage identity never reseeds the simulation');
  assert.deepEqual(await backend.getSave(save.saveId), sourceRecord, 'original career is untouched');
  assert.equal(await backend.saveRecordCount(), 2);
});

test('invalid JSON, envelopes, future schemas and incomplete archives fail before writing or switching careers', async () => {
  const { save, backup } = await source();
  setActiveSaveId(save.saveId);
  await assert.rejects(importSaveFromJson(new File(['{broken'], 'broken.json')), /ogiltig JSON/);
  const cases = [null, {}, { ...backup, backupVersion: 2 }, { ...backup, save: { ...backup.save, schemaVersion: 9 } },
    { ...backup, save: { ...backup.save, schemaVersion: 0 } }, { ...backup, save: { ...backup.save, manager: null } },
    { ...backup, save: { ...backup.save, careerState: [] } }, { ...backup, archives: {} },
    { ...backup, archives: { extra: {} } }];
  for (const value of cases) await assert.rejects(importSaveFromJson(file(value)), /ogiltig/);
  const mismatched = structuredClone(backup);
  const id = Object.keys(mismatched.archives)[0];
  (mismatched.archives[id] as PlayedMatchArchive).fixture.id = 'wrong-id';
  await assert.rejects(importSaveFromJson(file(mismatched)), /matcharkivet/);
  assert.equal(await backend.saveRecordCount(), 1);
  assert.equal(getActiveSaveId(), save.saveId);
});

test('missing persisted archives abort export instead of downloading an incomplete backup', async () => {
  const save = await createSave(input);
  await backend.putSave({ ...save, careerState: { ...createNewCareerState(save.saveId, input.clubId), matchArchiveIds: ['missing'] } });
  await assert.rejects(exportSaveAsJson(save.saveId), /Matcharkivet.*kunde inte läsas/);
  assert.equal(downloaded, undefined);
  assert.equal(clicked, false);
});

test('failed career writes leave the active pointer and original record unchanged', async () => {
  const { save, backup } = await source();
  setActiveSaveId(save.saveId);
  backend.putSave = async () => { throw new Error('Disk full'); };
  await assert.rejects(importSaveFromJson(file(backup)), /Disk full/);
  assert.equal(getActiveSaveId(), save.saveId);
  assert.equal(await backend.saveRecordCount(), 1);
});

test('failed archive writes never publish the imported career or change the active pointer', async () => {
  const { save, backup } = await source();
  setActiveSaveId(save.saveId);
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: { open() {
    const request = { onerror: null as (() => void) | null };
    queueMicrotask(() => request.onerror?.());
    return request;
  } } });
  await assert.rejects(importSaveFromJson(file(backup)), /Matcharkiven/);
  assert.equal(getActiveSaveId(), save.saveId);
  assert.equal(await backend.saveRecordCount(), 1);
});

test('an active V2 match retains its exact RNG, events and observed frames after portable restore', async () => {
  const save = await createSave(input);
  let state = createNewCareerState(save.saveId, input.clubId, snapshotWorldSquads('swe-2'));
  const fixture = state.fixtures.find(f => f.homeClubId === input.clubId || f.awayClubId === input.clubId)!;
  state = advanceProductionMatch({ ...state, productionMatch: createProductionSession(state, fixture) }, 100);
  await saveCareerState(save.saveId, state);
  await exportSaveAsJson(save.saveId);
  assert.ok(downloaded);
  const id = await importSaveFromJson(new File([await downloaded.text()], 'live.json'));
  const restored = await getSave(id);
  assert.deepEqual(restored?.careerState?.productionMatch, JSON.parse(JSON.stringify(state.productionMatch)));
});

test('supported older envelopes retain their schema for the existing loader migration', async () => {
  const { backup } = await source();
  backup.save.schemaVersion = 7;
  const id = await importSaveFromJson(file(backup));
  assert.equal((await getSave(id))?.schemaVersion, 7);
});
