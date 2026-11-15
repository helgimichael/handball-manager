// Stabilization (tactical autosave): the career write queue reports SAVING -> SAVED, keeps the newest snapshot
// (an older edit never overwrites a newer one), and on a failed write reports FAILED so the UI can retry with the
// in-memory career; a retry that commits returns to SAVED with every edit stored.
import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { createNewCareerState } from '../career/newCareer';
import { setMatchPlan } from '../career/matchPlanActions';
import { createMemoryBackend, type SaveStorageBackend } from './saveStorage';
import { __setSaveBackendForTests, createSave, flushCareerSave, flushCareerWritesOnExit, getCareerWriteStatus, getSave, saveCareerState, subscribeCareerWriteStatus, touchSave, type CareerWriteStatus } from './saveRepository';
import type { MatchPlan } from '../matchPlan/types';

const input = { selectedNations: ['SWE'], selectedCompetitionIds: ['swe-2'], clubId: 'swe2-tumba', manager: { name: 'Autosave test', nationality: 'SWE', dateOfBirth: '1980-01-01' }, gameDate: '2026-08-19' };
let backend: SaveStorageBackend;
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
beforeEach(() => {
  backend = createMemoryBackend('write-status');
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
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});
const planWith = (fixtureId: string, gk: string) => ({ fixtureId, squad: { players: [{ playerId: gk, position: 'GK' }] }, attackStartingUnit: { formation: 'NORMAL', slots: [{ position: 'GK', playerId: gk }] } }) as unknown as MatchPlan;

test('rapid edits: SAVING until the newest snapshot commits, then SAVED; the stored plan is the newest', async () => {
  const save = await createSave(input);
  const career = createNewCareerState(save.saveId, save.clubId);
  const fixtureId = career.fixtures[0]!.id;
  const seen: CareerWriteStatus['phase'][] = [];
  const stop = subscribeCareerWriteStatus((id, s) => { if (id === save.saveId) seen.push(s.phase); });
  const edits = ['gk-a', 'gk-b', 'gk-c'].map((gk) => setMatchPlan(career, fixtureId, planWith(fixtureId, gk)));
  const writes = edits.map((state) => saveCareerState(save.saveId, state));
  assert.equal(getCareerWriteStatus(save.saveId)?.phase, 'SAVING');
  await Promise.all(writes);
  await flushCareerSave(save.saveId);
  stop();
  assert.equal(getCareerWriteStatus(save.saveId)?.phase, 'SAVED');
  assert.equal(seen.at(-1), 'SAVED');
  assert.ok(!seen.slice(0, -1).includes('SAVED') || seen.indexOf('SAVED') > 0, 'never SAVED before a write started');
  const stored = await getSave(save.saveId);
  assert.equal(stored?.careerState?.matchPlans[fixtureId]?.attackStartingUnit.slots[0]?.playerId, 'gk-c', 'the newest edit wins');
});

test('a failed write reports FAILED and keeps nothing older; a retry with the in-memory career commits it', async () => {
  const save = await createSave(input);
  const career = createNewCareerState(save.saveId, save.clubId);
  const fixtureId = career.fixtures[0]!.id;
  const edited = setMatchPlan(career, fixtureId, planWith(fixtureId, 'gk-retry'));
  const putSave = backend.putSave.bind(backend);
  backend.putSave = async () => { throw new Error('QuotaExceededError (test)'); };
  await assert.rejects(saveCareerState(save.saveId, edited));
  assert.equal(getCareerWriteStatus(save.saveId)?.phase, 'FAILED');
  assert.match(getCareerWriteStatus(save.saveId)?.error ?? '', /QuotaExceeded/);
  assert.equal((await getSave(save.saveId))?.careerState?.matchPlans?.[fixtureId], undefined, 'nothing half-written; reads still return the last committed state');
  backend.putSave = putSave;
  await saveCareerState(save.saveId, edited); // what retrySave does: re-persist the current in-memory career
  assert.equal(getCareerWriteStatus(save.saveId)?.phase, 'SAVED');
  assert.equal((await getSave(save.saveId))?.careerState?.matchPlans[fixtureId]?.attackStartingUnit.slots[0]?.playerId, 'gk-retry');
});

test('leaving the page writes the queued snapshot at once; the newest edit is what is stored', async () => {
  const save = await createSave(input);
  const career = createNewCareerState(save.saveId, save.clubId);
  const fixtureId = career.fixtures[0]!.id;
  await saveCareerState(save.saveId, setMatchPlan(career, fixtureId, planWith(fixtureId, 'gk-first')));
  // A slow write is running while a newer edit waits behind it -- then the page is hidden.
  const putSave = backend.putSave.bind(backend);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  let calls = 0;
  // Like IndexedDB: a put is registered (ordered) when called; only its completion is slow.
  backend.putSave = async (record) => { const done = putSave(record); if (++calls === 1) await gate; return done; };
  const running = saveCareerState(save.saveId, setMatchPlan(career, fixtureId, planWith(fixtureId, 'gk-running')));
  await new Promise((r) => setTimeout(r, 0));
  const queued = saveCareerState(save.saveId, setMatchPlan(career, fixtureId, planWith(fixtureId, 'gk-newest')));
  flushCareerWritesOnExit();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(calls, 2, 'the queued snapshot issued its put without waiting for the running write');
  release();
  await Promise.all([running, queued]);
  await flushCareerSave(save.saveId);
  backend.putSave = putSave;
  assert.equal((await getSave(save.saveId))?.careerState?.matchPlans[fixtureId]?.attackStartingUnit.slots[0]?.playerId, 'gk-newest');
  // Another writer (touchSave) invalidates the cached envelope; the next career write still stores everything.
  await touchSave(save.saveId);
  await saveCareerState(save.saveId, setMatchPlan(career, fixtureId, planWith(fixtureId, 'gk-after-touch')));
  assert.equal((await getSave(save.saveId))?.careerState?.matchPlans[fixtureId]?.attackStartingUnit.slots[0]?.playerId, 'gk-after-touch');
});
