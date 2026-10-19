// Local career persistence. Kept behind this one module's public
// functions (not scattered localStorage.getItem calls throughout
// components) so a real save-file backend can replace the
// implementation later without touching every screen that reads/writes
// career state.
//
// Schema versioning (HM-GAME-0.2A): CareerSave now carries an explicit
// `schemaVersion`. HM-GAME-0.1 saves were written before this field
// existed and therefore have no `careerState` (the mutable season
// domain object from lib/career/types.ts) -- `schemaVersion` is
// inferred as 1 for any save missing the field, never assumed to be
// current. Loading a v1 save does not crash: lib/career's
// CareerProvider lazily creates a fresh CareerState for it on first
// load (see getOrCreateCareerState in CareerContext.tsx) and persists
// the upgrade, rather than silently discarding the save or throwing.
//
// HM-SAVE-STORAGE-1.0 (Phase 0): the BACKING STORE moved from
// localStorage to IndexedDB. A fresh career serializes to ~5.2 MB --
// larger than localStorage's ~5 MiB per-origin quota on its own, which
// made `QuotaExceededError` unavoidable at career creation. Three
// things changed and nothing else:
//
//   1. Saves live in IndexedDB, ONE RECORD PER SAVE (lib/save/
//      saveStorage.ts), instead of every career sharing one giant
//      JSON string under a single localStorage key. Writing one career
//      no longer re-serializes the others, and one career's growth can
//      no longer evict another.
//   2. Every record-touching function is now ASYNC. IndexedDB has no
//      synchronous API, so this is unavoidable; the function names,
//      arguments and semantics are otherwise unchanged.
//   3. Read failures are no longer swallowed. The old readStore()
//      caught everything and returned {}, which made a corrupt or
//      unreadable store look exactly like "this browser has no saves".
//      Persistence failures now surface as SavePersistenceError.
//
// DELIBERATELY UNCHANGED in Phase 0: CareerState's shape. Whatever the
// domain hands over is stored verbatim -- no normalization, no
// baseline+delta, no rating-attribute flattening. Those are later
// phases with real domain risk; this milestone is storage only.
//
// The active-save POINTER (a single short save id) stays in
// localStorage: it is a few dozen bytes, has never been near the quota,
// and keeping it synchronous avoids an await in every route guard.

import type { CareerState } from "../career/types";
import { deleteMatchArchives, findMatchArchive, readMatchArchive, storeMatchArchive } from './matchArchiveStorage';
import type { PlayedMatchArchive } from '../career/productionMatch';
import { careerArchiveSummaries, withoutReplayPayloads } from '../career/matchArchiveSummary';
import type { PreseasonStartOption } from "../career/preseason";
import { createIndexedDbBackend, createMemoryBackend, SavePersistenceError, type SaveStorageBackend } from "./saveStorage";
import { backupArchives, validatePortableCareerBackup, type PortableCareerBackup } from './portableCareerBackup';

export { SavePersistenceError };
export type { SaveStorageBackend };
export type { PortableCareerBackup } from './portableCareerBackup';

export type ManagerProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
};

// v3 (HM-GAME-0.3): CareerState gained Career Rhythm fields
// (processedThroughDate, careerEvents, playerStatuses, tasks).
// v4 (HM-DATA-0.2): CareerState gained `worldSquads` (the real-world
// player-identity snapshot).
// v5 (HM-GAME-0.4): InboxMessage gained `archived`/`resolved` and its
// `category` moved from Swedish string literals to a typed English
// model. See career/saveMigration.ts for the CareerState-level backfill;
// this constant only marks the save envelope as up to date once that
// migration has run and been persisted.
// v6 (HM-TACTICS-0.6A): CareerState gained `tacticalProfile` (the
// minimal TeamTacticalProfile prerequisite for future Fast Match
// integration -- not consumed by Fast Match yet).
// v7 (HM-PRESEASON-1.0): CareerSave gained `preseasonStart` (the New
// Game "Starta" step's own preseason-length choice).
//
// NOTE: HM-SAVE-STORAGE-1.0 does NOT bump this. The save ENVELOPE and
// CareerState are byte-identical to v7; only where they are stored
// changed. Bumping would falsely imply a data-model migration.
// v8: persistent V2 live sessions and references to immutable match archives.
// Older careers keep their booked results; the retired reveal session is closed.
export const CURRENT_SAVE_SCHEMA_VERSION = 8;

export type CareerSave = {
  saveId: string;
  schemaVersion: number;
  selectedNations: readonly string[];
  selectedCompetitionIds: readonly string[];
  clubId: string;
  manager: ManagerProfile;
  gameDate: string;
  /** HM-PRESEASON-1.0: the manager's own preseason-length choice at New Game's "Starta" step. Absent on every pre-this-milestone save (schemaVersion < 7) -- `getOrCreateCareerState` treats that identically to `undefined` passed into `createNewCareerState`, i.e. legacy behavior. */
  preseasonStart?: PreseasonStartOption;
  createdAt: string;
  lastPlayedAt: string;
  /** Absent on HM-GAME-0.1 (schemaVersion 1) saves -- see module doc comment. */
  careerState?: CareerState;
};

/** The pre-Phase-0 localStorage key. Read for migration, never written, never deleted. */
export const LEGACY_STORAGE_KEY = "hm-game:saves:v1";
const ACTIVE_SAVE_KEY = "hm-game:active-save:v1";
const MIGRATION_META_KEY = "legacy-localstorage-migration:v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// ---------------------------------------------------------------------------
// Backend resolution
// ---------------------------------------------------------------------------

let backend: SaveStorageBackend | null = null;

function resolveBackend(): SaveStorageBackend {
  if (backend) return backend;
  // Outside a browser (SSR, unit tests) nothing is persisted anywhere --
  // exactly as before Phase 0, where every function short-circuited on
  // `isBrowser()`. This is a legitimate empty context, NOT a swallowed
  // error: inside a browser, a missing/failing IndexedDB throws instead.
  backend = isBrowser() ? createIndexedDbBackend() : createMemoryBackend("ssr");
  return backend;
}

/** Test seam: swaps the backend and resets the once-per-process migration guard. Never called by app code. */
export function __setSaveBackendForTests(next: SaveStorageBackend | null): void {
  backend = next;
  migrationPromise = null;
}

// ---------------------------------------------------------------------------
// Legacy localStorage migration
// ---------------------------------------------------------------------------

export type LegacyMigrationOutcome = {
  /** True once the legacy store has been fully accounted for (including "there was nothing to migrate"). */
  completed: boolean;
  /** Saves copied into IndexedDB by THIS invocation. 0 on every run after the first. */
  migrated: number;
  /** Legacy saves skipped because IndexedDB already held that saveId -- never overwritten, the IndexedDB copy may be newer. */
  skippedExisting: number;
  reason: "NOTHING_TO_MIGRATE" | "ALREADY_MIGRATED" | "MIGRATED";
};

function readLegacyStore(): Record<string, CareerSave> | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (raw === null || raw.trim() === "") return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    // Explicitly NOT `return {}`. A corrupt legacy store is a recoverable
    // persistence fault the user must be told about -- pretending it is
    // an empty store is how saves get silently abandoned. The source is
    // left byte-for-byte intact so it stays recoverable by hand.
    throw new SavePersistenceError(
      "LEGACY_STORE_CORRUPT",
      `The existing localStorage save data under "${LEGACY_STORAGE_KEY}" could not be parsed. It has been left untouched so it can be recovered; no saves were migrated or overwritten.`,
      { cause: error },
    );
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new SavePersistenceError(
      "LEGACY_STORE_CORRUPT",
      `The existing localStorage save data under "${LEGACY_STORAGE_KEY}" is not a save store (expected an object keyed by saveId). It has been left untouched.`,
    );
  }

  const store: Record<string, CareerSave> = {};
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new SavePersistenceError("LEGACY_STORE_CORRUPT", `Legacy save "${key}" is not an object. The localStorage source has been left untouched.`);
    }
    const save = value as CareerSave;
    if (typeof save.saveId !== "string" || save.saveId === "") {
      throw new SavePersistenceError("LEGACY_STORE_CORRUPT", `Legacy save "${key}" has no saveId. The localStorage source has been left untouched.`);
    }
    // Normalize exactly as the pre-Phase-0 readStore() did: a save
    // missing schemaVersion is a v1 save, tagged explicitly rather than
    // left undefined.
    store[save.saveId] = typeof save.schemaVersion === "number" ? save : { ...save, schemaVersion: 1 };
  }
  return store;
}

async function runMigration(): Promise<LegacyMigrationOutcome> {
  const store = resolveBackend();
  if ((await store.getMeta(MIGRATION_META_KEY)) !== null) {
    return { completed: true, migrated: 0, skippedExisting: 0, reason: "ALREADY_MIGRATED" };
  }

  const legacy = readLegacyStore(); // throws SavePersistenceError on corrupt input -- marker is NOT set, so it stays retryable
  if (legacy === null || Object.keys(legacy).length === 0) {
    await store.setMeta(MIGRATION_META_KEY, new Date().toISOString());
    return { completed: true, migrated: 0, skippedExisting: 0, reason: "NOTHING_TO_MIGRATE" };
  }

  const written: CareerSave[] = [];
  let skippedExisting = 0;
  for (const save of Object.values(legacy)) {
    // Idempotency AND safety: an existing IndexedDB record is authoritative.
    // Re-running migration must never replay a stale legacy snapshot over a
    // career that has been played since the first migration.
    if ((await store.getSave(save.saveId)) !== null) {
      skippedExisting++;
      continue;
    }
    await store.putSave(save);
    written.push(save);
  }

  // Verify before declaring success -- the marker is what stops the
  // legacy source from ever being re-read, so it may only be set once
  // every record has been confirmed to read back identically.
  for (const save of written) {
    const readBack = await store.getSave(save.saveId);
    if (readBack === null || JSON.stringify(readBack) !== JSON.stringify(save)) {
      throw new SavePersistenceError(
        "MIGRATION_VERIFICATION_FAILED",
        `Migrated save "${save.saveId}" did not read back identically from IndexedDB. Migration has NOT been marked complete and the localStorage source is untouched.`,
      );
    }
  }

  await store.setMeta(MIGRATION_META_KEY, new Date().toISOString());
  return { completed: true, migrated: written.length, skippedExisting, reason: "MIGRATED" };
}

let migrationPromise: Promise<LegacyMigrationOutcome> | null = null;

/**
 * Runs the one-time legacy migration, at most once per process. A
 * FAILED attempt is not cached: a corrupt legacy store that the user
 * repairs, or a transient IndexedDB fault, must be retryable without a
 * page reload.
 */
export function ensureLegacySavesMigrated(): Promise<LegacyMigrationOutcome> {
  if (!migrationPromise) {
    migrationPromise = runMigration().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  return migrationPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listSaves(): Promise<readonly CareerSave[]> {
  await ensureLegacySavesMigrated();
  const saves = await resolveBackend().listSaves();
  return saves.sort((a, b) => (a.lastPlayedAt < b.lastPlayedAt ? 1 : -1));
}

export async function getMostRecentSave(): Promise<CareerSave | null> {
  const saves = await listSaves();
  return saves[0] ?? null;
}

export async function getSave(saveId: string): Promise<CareerSave | null> {
  await flushCareerSave(saveId);
  await ensureLegacySavesMigrated();
  let save = await resolveBackend().getSave(saveId);
  // One-time normalization for old saves with inline replays. Modern reads do
  // not touch the archive database, even if some referenced archives are missing.
  if (save?.careerState && Object.keys(save.careerState.matchArchives ?? {}).length) {
    await saveCareerState(saveId, save.careerState);
    save = await resolveBackend().getSave(saveId);
  }
  return save;
}

export type MatchArchive = PlayedMatchArchive;
/** Fixture IDs repeat between careers. The one-argument API uses the active
 * save; callers with a mounted career pass its ID to avoid navigation races. */
export async function getMatchArchiveById(archiveId: string, saveId = getActiveSaveId()): Promise<MatchArchive | null> {
  if (!saveId) return null;
  const save = await getSave(saveId);
  if (!save?.careerState?.matchArchiveIds?.includes(archiveId)) return null;
  return findMatchArchive(saveId, archiveId);
}

export async function createSave(
  input: Omit<CareerSave, "saveId" | "schemaVersion" | "createdAt" | "lastPlayedAt" | "careerState">,
  initialize?: (draft: CareerSave) => Promise<CareerState>,
): Promise<CareerSave> {
  await ensureLegacySavesMigrated();
  const now = new Date().toISOString();
  const save: CareerSave = {
    ...input,
    saveId: `save-${crypto.randomUUID()}`,
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: now,
    lastPlayedAt: now,
  };
  const careerState = initialize ? await initialize(save) : undefined;
  const complete = careerState ? { ...save, careerState, gameDate: careerState.gameDate } : save;
  await resolveBackend().putSave(complete);
  return complete;
}

export async function touchSave(saveId: string): Promise<void> {
  await flushCareerSave(saveId);
  await ensureLegacySavesMigrated();
  const store = resolveBackend();
  const save = await store.getSave(saveId);
  if (!save) {
    return;
  }
  await store.putSave({ ...save, lastPlayedAt: new Date().toISOString() });
}

export async function deleteSave(saveId: string): Promise<void> {
  await flushCareerSave(saveId);
  await ensureLegacySavesMigrated();
  const save = await resolveBackend().getSave(saveId);
  const state = save?.careerState;
  await deleteMatchArchives(saveId, [...(state?.matchArchiveIds ?? []), ...Object.keys(state?.matchArchives ?? {})]);
  await resolveBackend().deleteSave(saveId);
  careerWrites.delete(saveId);
  if (getActiveSaveId() === saveId) window.localStorage.removeItem(ACTIVE_SAVE_KEY);
}

/** Persists domain state only (never React component state) -- called after every calendar advance. */
type SaveWaiter = { resolve: () => void; reject: (cause: unknown) => void };
type CareerWriteQueue = { running: boolean; next?: { state: CareerState; waiters: SaveWaiter[] }; last?: Promise<void> };
const careerWrites = new Map<string, CareerWriteQueue>();
export function saveCareerState(saveId: string, careerState: CareerState): Promise<void> {
  const queue = careerWrites.get(saveId) ?? { running: false };
  careerWrites.set(saveId, queue);
  const promise = new Promise<void>((resolve, reject) => {
    // Keep the latest pending snapshot and all its callers. A live match can
    // advance faster than IndexedDB; retaining every intermediate snapshot
    // would turn autosave into an unbounded memory queue.
    queue.next = { state: careerState, waiters: [...(queue.next?.waiters ?? []), { resolve, reject }] };
  });
  queue.last = promise;
  if (!queue.running) {
    queue.running = true;
    void (async () => {
      while (queue.next) {
        const pending = queue.next;
        queue.next = undefined;
        try { await saveCareerStateNow(saveId, pending.state); pending.waiters.forEach(w => w.resolve()); }
        catch (cause) { pending.waiters.forEach(w => w.reject(cause)); }
      }
      queue.running = false;
    })();
  }
  return promise;
}
export async function flushCareerSave(saveId: string): Promise<void> {
  await careerWrites.get(saveId)?.last;
}
async function saveCareerStateNow(saveId: string, careerState: CareerState): Promise<void> {
  await ensureLegacySavesMigrated();
  const store = resolveBackend();
  const save = await store.getSave(saveId);
  if (!save) {
    return;
  }
  const archives = Object.values(careerState.matchArchives ?? {});
  for (const archive of archives) await storeMatchArchive(saveId, archive);
  const previous = save.careerState;
  const ids = [...new Set([...(previous?.matchArchiveIds ?? []), ...(careerState.matchArchiveIds ?? []), ...archives.map(a => a.fixture.id)])];
  const storedCareer = ids.length ? { ...withoutReplayPayloads(careerState), matchArchives: undefined, matchArchiveIds: ids,
    matchArchiveSummaries: { ...previous?.matchArchiveSummaries, ...careerArchiveSummaries(careerState) },
  } : careerState;
  await store.putSave({
    ...save,
    careerState: storedCareer,
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    gameDate: careerState.gameDate,
    lastPlayedAt: new Date().toISOString(),
  });
}

// --- Active-save pointer (stays in localStorage: a single short id) ---

export function setActiveSaveId(saveId: string): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(ACTIVE_SAVE_KEY, saveId);
}

export function getActiveSaveId(): string | null {
  if (!isBrowser()) {
    return null;
  }
  return window.localStorage.getItem(ACTIVE_SAVE_KEY);
}

export async function getActiveSave(): Promise<CareerSave | null> {
  const id = getActiveSaveId();
  if (!id) {
    return null;
  }
  return getSave(id);
}

/** Export the committed record, with strict archive reads: an incomplete backup
 * must fail visibly instead of silently losing a historical replay. */
export async function exportSaveAsJson(saveId: string): Promise<void> {
  const save = await getSave(saveId); // flushes pending career writes
  if (!save) throw new Error('Karriären finns inte längre. Öppna en sparad karriär och försök igen.');
  const inline = save.careerState?.matchArchives ?? {};
  const ids = [...new Set([...(save.careerState?.matchArchiveIds ?? []), ...Object.keys(inline)])];
  const archiveEntries: [string, unknown][] = Object.entries(inline);
  for (const id of save.careerState?.matchArchiveIds ?? []) {
    try { archiveEntries.push([id, await readMatchArchive(saveId, id)]); }
    catch { throw new Error(`Matcharkivet "${id}" kunde inte läsas. Ingen ofullständig sparafil har exporterats. Försök igen eller återställ en tidigare backup.`); }
  }
  const archives: Record<string, unknown> = Object.fromEntries(archiveEntries);
  const exportedAt = new Date().toISOString();
  const portableSave = save.careerState ? { ...save, careerState: { ...save.careerState, matchArchives: undefined, matchArchiveIds: ids } } : save;
  const backup: PortableCareerBackup = { backupVersion: 1, exportedAt, save: portableSave, archives };
  validatePortableCareerBackup(backup, CURRENT_SAVE_SCHEMA_VERSION);
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    const safeName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');
    link.download = `${safeName(save.clubId)}_${safeName(save.gameDate)}_${exportedAt.replace(/[:.]/g, '-')}.json`;
    link.click();
  } finally {
    // Let the browser consume the object URL before releasing its backing data.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Restore as a separate career. Publishing the record and changing the active
 * pointer happen only after all of its immutable archives have committed. */
export async function importSaveFromJson(file: File): Promise<string> {
  let contents: string;
  try { contents = await file.text(); }
  catch { throw new Error('Sparafilen kunde inte läsas. Välj filen igen från din dator.'); }
  let parsed: unknown;
  try { parsed = JSON.parse(contents.replace(/^\uFEFF/, '')); }
  catch { throw new Error('Sparafilen innehåller ogiltig JSON. Välj en exporterad .json-fil från Handball Manager.'); }
  const backup = validatePortableCareerBackup(parsed, CURRENT_SAVE_SCHEMA_VERSION);
  await ensureLegacySavesMigrated();
  const store = resolveBackend();
  let saveId: string;
  do { saveId = `save-${crypto.randomUUID()}`; } while (await store.getSave(saveId));
  const restored: CareerSave = { ...backup.save, saveId, lastPlayedAt: new Date().toISOString() };
  for (const archive of backupArchives(backup)) await storeMatchArchive(saveId, archive);
  await store.putSave(restored);
  setActiveSaveId(saveId);
  return saveId;
}
