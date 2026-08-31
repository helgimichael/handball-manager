// HM-SAVE-STORAGE-1.0 Phase 0: the persistence BACKEND boundary.
//
// saveRepository.ts owns save *semantics* (schema version, active save,
// legacy migration); this module owns nothing but "where do the bytes
// live". Domain code never imports it -- that is the whole point: a
// future desktop build can add a SQLite/file backend here and neither
// CareerContext nor any screen changes.
//
// Two implementations ship today:
//   * createIndexedDbBackend() -- the real browser backend. One record
//     PER SAVE in the `saves` store (keyPath "saveId"), never one giant
//     JSON blob keyed by a single string, so one career's growth can
//     never evict another's and a write only serializes that one save.
//   * createMemoryBackend()    -- non-browser contexts (SSR, tests).
//
// Phase 0 deliberately does NOT change CareerState's shape: whatever the
// repository hands over is stored verbatim.

import type { CareerSave } from "./saveRepository";

export type SavePersistenceErrorCode =
  /** Running in a browser, but IndexedDB is missing or refused to open. */
  | "BACKEND_UNAVAILABLE"
  | "READ_FAILED"
  | "WRITE_FAILED"
  /** `hm-game:saves:v1` exists but is not parseable / not shaped like a save store. */
  | "LEGACY_STORE_CORRUPT"
  /** Legacy saves were written but did not read back identically -- migration is NOT marked done. */
  | "MIGRATION_VERIFICATION_FAILED";

/**
 * A persistence failure that callers are expected to surface, never
 * swallow. The pre-Phase-0 repository caught every read error and
 * returned `{}`, which made an unreadable store indistinguishable from
 * "this browser has no saves" -- i.e. silent data loss. Nothing in this
 * module or saveRepository.ts may reintroduce that.
 */
export class SavePersistenceError extends Error {
  readonly code: SavePersistenceErrorCode;
  constructor(code: SavePersistenceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SavePersistenceError";
    this.code = code;
  }
}

export interface SaveStorageBackend {
  /** Diagnostic label -- surfaced in errors and asserted by tests, never branched on by domain code. */
  readonly name: string;
  listSaves(): Promise<CareerSave[]>;
  getSave(saveId: string): Promise<CareerSave | null>;
  putSave(save: CareerSave): Promise<void>;
  deleteSave(saveId: string): Promise<void>;
  /** Small bookkeeping values (migration markers). Deliberately separate from the save records. */
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
  /** Number of distinct records backing the saves -- lets tests assert "one record per save", not one shared blob. */
  saveRecordCount(): Promise<number>;
}

// ---------------------------------------------------------------------------
// In-memory backend (SSR + tests)
// ---------------------------------------------------------------------------

/**
 * Structured-clone-equivalent deep copy. Stored values must not alias
 * the caller's objects, otherwise a later in-place domain mutation would
 * "already be saved" and a save/reload round-trip test would pass for
 * the wrong reason. JSON round-tripping also matches what IndexedDB's
 * own structured clone does to a plain CareerState.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createMemoryBackend(name = "memory"): SaveStorageBackend {
  const saves = new Map<string, CareerSave>();
  const meta = new Map<string, string>();
  return {
    name,
    async listSaves() {
      return [...saves.values()].map(clone);
    },
    async getSave(saveId) {
      const found = saves.get(saveId);
      return found ? clone(found) : null;
    },
    async putSave(save) {
      saves.set(save.saveId, clone(save));
    },
    async deleteSave(saveId) {
      saves.delete(saveId);
    },
    async getMeta(key) {
      return meta.get(key) ?? null;
    },
    async setMeta(key, value) {
      meta.set(key, value);
    },
    async saveRecordCount() {
      return saves.size;
    },
  };
}

// ---------------------------------------------------------------------------
// IndexedDB backend
// ---------------------------------------------------------------------------

const DB_NAME = "hm-game";
const DB_VERSION = 1;
const SAVES_STORE = "saves";
const META_STORE = "meta";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    throw new SavePersistenceError("BACKEND_UNAVAILABLE", "IndexedDB is not available in this browser context");
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SAVES_STORE)) {
        db.createObjectStore(SAVES_STORE, { keyPath: "saveId" });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new SavePersistenceError("BACKEND_UNAVAILABLE", "Could not open the IndexedDB save database", { cause: request.error }));
    request.onblocked = () => reject(new SavePersistenceError("BACKEND_UNAVAILABLE", "Opening the IndexedDB save database was blocked by another tab"));
  });
}

export function createIndexedDbBackend(): SaveStorageBackend {
  let dbPromise: Promise<IDBDatabase> | null = null;
  function db(): Promise<IDBDatabase> {
    // Cached, but never cached as a REJECTED promise -- a transient open
    // failure (e.g. another tab blocking an upgrade) must be retryable.
    if (!dbPromise) {
      dbPromise = openDatabase().catch((error) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  }

  /** Runs `body` in one transaction and resolves only once that transaction actually COMMITS -- a resolved request is not yet a durable write. */
  async function tx<T>(store: string, mode: IDBTransactionMode, code: SavePersistenceErrorCode, what: string, body: (s: IDBObjectStore) => IDBRequest<T> | null): Promise<T | null> {
    const database = await db();
    return new Promise<T | null>((resolve, reject) => {
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction(store, mode);
      } catch (error) {
        reject(new SavePersistenceError(code, `Could not open an IndexedDB transaction for ${what}`, { cause: error }));
        return;
      }
      let result: T | null = null;
      const request = body(transaction.objectStore(store));
      if (request) {
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(new SavePersistenceError(code, `IndexedDB ${what} failed`, { cause: request.error }));
      }
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(new SavePersistenceError(code, `IndexedDB ${what} was aborted`, { cause: transaction.error }));
      transaction.onerror = () => reject(new SavePersistenceError(code, `IndexedDB ${what} errored`, { cause: transaction.error }));
    });
  }

  return {
    name: "indexeddb",
    async listSaves() {
      return (await tx<CareerSave[]>(SAVES_STORE, "readonly", "READ_FAILED", "listSaves", (s) => s.getAll() as IDBRequest<CareerSave[]>)) ?? [];
    },
    async getSave(saveId) {
      return (await tx<CareerSave | undefined>(SAVES_STORE, "readonly", "READ_FAILED", "getSave", (s) => s.get(saveId) as IDBRequest<CareerSave | undefined>)) ?? null;
    },
    async putSave(save) {
      await tx(SAVES_STORE, "readwrite", "WRITE_FAILED", "putSave", (s) => s.put(save) as IDBRequest<IDBValidKey>);
    },
    async deleteSave(saveId) {
      await tx(SAVES_STORE, "readwrite", "WRITE_FAILED", "deleteSave", (s) => s.delete(saveId) as IDBRequest<undefined>);
    },
    async getMeta(key) {
      return (await tx<string | undefined>(META_STORE, "readonly", "READ_FAILED", "getMeta", (s) => s.get(key) as IDBRequest<string | undefined>)) ?? null;
    },
    async setMeta(key, value) {
      await tx(META_STORE, "readwrite", "WRITE_FAILED", "setMeta", (s) => s.put(value, key) as IDBRequest<IDBValidKey>);
    },
    async saveRecordCount() {
      return (await tx<number>(SAVES_STORE, "readonly", "READ_FAILED", "count", (s) => s.count() as IDBRequest<number>)) ?? 0;
    },
  };
}
