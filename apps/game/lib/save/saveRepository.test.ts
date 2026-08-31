// HM-SAVE-STORAGE-1.0 (Phase 0): career persistence moved from a single
// localStorage key holding EVERY career as one JSON string, to IndexedDB
// with one record per save.
//
// These tests pin the four things that milestone is actually responsible
// for: (1) a payload larger than the old ~5 MiB localStorage ceiling can
// now be persisted at all, (2) a save/reload round-trip returns the
// CareerState byte-identically (Phase 0 changes no data model), (3)
// careers are independent records, not one shared blob, and (4) the
// legacy localStorage store migrates safely -- verified, idempotent,
// non-destructive, and never silently discarded when corrupt.
//
// The repository is exercised through its real public API against an
// injected backend (`__setSaveBackendForTests`), which is the same seam
// a future desktop/SQLite backend would use.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  __setSaveBackendForTests,
  createSave,
  deleteSave,
  ensureLegacySavesMigrated,
  getSave,
  listSaves,
  saveCareerState,
  touchSave,
  LEGACY_STORAGE_KEY,
  SavePersistenceError,
  type CareerSave,
} from "./saveRepository";
import { createMemoryBackend, type SaveStorageBackend } from "./saveStorage";
import type { CareerState } from "../career/types";

// --- browser stubs -------------------------------------------------------

/** The pre-Phase-0 failure mode, reproduced faithfully: ~5 MiB per origin, counted over UTF-16 code units. */
const LOCALSTORAGE_QUOTA_BYTES = 5 * 1024 * 1024;

function installLocalStorage(initial: Record<string, string> = {}, enforceQuota = false) {
  const data = new Map<string, string>(Object.entries(initial));
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (enforceQuota) {
        let used = 0;
        for (const [k, v] of data) if (k !== key) used += (k.length + v.length) * 2;
        if (used + (key.length + value.length) * 2 > LOCALSTORAGE_QUOTA_BYTES) {
          const error = new Error(`Setting the value of '${key}' exceeded the quota.`);
          error.name = "QuotaExceededError";
          throw error;
        }
      }
      data.set(key, value);
    },
    removeItem: (key: string) => { data.delete(key); },
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  return { data, storage };
}

function clearBrowser() {
  delete (globalThis as { window?: unknown }).window;
}

function setup(legacy?: Record<string, string>, enforceQuota = false): { backend: SaveStorageBackend; data: Map<string, string> } {
  const { data } = installLocalStorage(legacy ?? {}, enforceQuota);
  const backend = createMemoryBackend("test");
  __setSaveBackendForTests(backend);
  return { backend, data };
}

function teardown() {
  __setSaveBackendForTests(null);
  clearBrowser();
}

// --- fixtures ------------------------------------------------------------

const NEW_SAVE_INPUT = {
  selectedNations: ["SWE"] as readonly string[],
  selectedCompetitionIds: ["se_handbollsligan_herr"] as readonly string[],
  clubId: "se_club_hammarby_if_hf",
  manager: { name: "Test Manager", nationality: "SWE", dateOfBirth: "1988-01-01" },
  gameDate: "2026-08-30",
};

/** A CareerState-shaped object whose serialized size exceeds `targetBytes` -- stands in for the real ~5.2 MB fresh career. */
function oversizedCareerState(targetBytes: number): CareerState {
  const club = (clubIndex: number) =>
    Array.from({ length: 25 }, (_, i) => ({
      id: `player-${clubIndex}-${i}`,
      clubId: `club-${clubIndex}`,
      firstName: "Fixture",
      lastName: `Player ${i}`,
      position: "V6",
      attributes: { technical: { skott: 10, passning: 10, spelforstaelse: 10, genombrott: 10, mottagning: 10, fint: 10, spelUtanBoll: 10 } },
    }));
  // Size one club once, then allocate the needed count -- re-stringifying
  // the whole growing object each iteration is quadratic and made this
  // test take ~14s on its own.
  const bytesPerClub = Buffer.byteLength(JSON.stringify(club(0)), "utf8");
  const worldSquads: Record<string, unknown[]> = {};
  for (let i = 0; i <= Math.ceil(targetBytes / bytesPerClub); i++) worldSquads[`club-${i}`] = club(i);
  return { gameDate: "2026-08-30", worldSquads } as unknown as CareerState;
}

function legacySave(saveId: string, overrides: Partial<CareerSave> = {}): CareerSave {
  return {
    saveId,
    schemaVersion: 7,
    selectedNations: ["SWE"],
    selectedCompetitionIds: ["se_handbollsligan_herr"],
    clubId: "se_club_hammarby_if_hf",
    manager: { name: `Manager ${saveId}`, nationality: "SWE", dateOfBirth: "1988-01-01" },
    gameDate: "2026-08-30",
    createdAt: "2026-08-30T10:00:00.000Z",
    lastPlayedAt: "2026-08-30T10:00:00.000Z",
    careerState: { gameDate: "2026-08-30", seasonId: "2026/27" } as unknown as CareerState,
    ...overrides,
  };
}

// --- capacity ------------------------------------------------------------

test("a career larger than the old localStorage ceiling can be persisted (the original QuotaExceededError repro)", async () => {
  const { data } = setup({}, true);
  try {
    const state = oversizedCareerState(6 * 1024 * 1024);
    const serializedBytes = Buffer.byteLength(JSON.stringify(state), "utf8");
    assert.ok(serializedBytes > LOCALSTORAGE_QUOTA_BYTES, `fixture must exceed the old ceiling, was ${serializedBytes}`);

    // The OLD backend genuinely cannot do this -- the exact reported failure.
    assert.throws(
      () => (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify({ a: state })),
      (error: Error) => error.name === "QuotaExceededError",
    );
    assert.equal(data.has(LEGACY_STORAGE_KEY), false, "the failed legacy write must not have stored anything");

    // The new backend can.
    const save = await createSave(NEW_SAVE_INPUT);
    await saveCareerState(save.saveId, state);
    const reloaded = await getSave(save.saveId);
    assert.equal(JSON.stringify(reloaded?.careerState), JSON.stringify(state));
  } finally {
    teardown();
  }
});

test("save -> reload preserves CareerState exactly, and updates gameDate/schemaVersion", async () => {
  setup();
  try {
    const save = await createSave(NEW_SAVE_INPUT);
    const state = { gameDate: "2026-09-14", seasonId: "2026/27", worldSquads: { a: [{ id: "p1" }] }, results: {} } as unknown as CareerState;
    await saveCareerState(save.saveId, state);

    const reloaded = await getSave(save.saveId);
    assert.ok(reloaded);
    assert.deepEqual(reloaded!.careerState, state, "CareerState must round-trip unchanged -- Phase 0 optimizes no data model");
    assert.equal(reloaded!.gameDate, "2026-09-14", "the envelope's gameDate tracks the career");
    assert.equal(reloaded!.schemaVersion, 7);
    assert.equal(reloaded!.saveId, save.saveId);
    assert.deepEqual(reloaded!.manager, NEW_SAVE_INPUT.manager);
  } finally {
    teardown();
  }
});

test("multiple careers are independent records -- writing one does not rewrite one shared blob", async () => {
  const { backend } = setup();
  try {
    const a = await createSave(NEW_SAVE_INPUT);
    const b = await createSave({ ...NEW_SAVE_INPUT, manager: { ...NEW_SAVE_INPUT.manager, name: "Second" } });
    assert.notEqual(a.saveId, b.saveId);
    assert.equal(await backend.saveRecordCount(), 2, "one record per save, never a single shared object");

    await saveCareerState(a.saveId, { gameDate: "2027-01-01", marker: "A" } as unknown as CareerState);
    const reloadedB = await getSave(b.saveId);
    assert.equal(reloadedB?.careerState, undefined, "writing career A must not touch career B's record");
    assert.equal(await backend.saveRecordCount(), 2);

    await deleteSave(a.saveId);
    assert.equal(await backend.saveRecordCount(), 1);
    assert.equal(await getSave(a.saveId), null);
    assert.ok(await getSave(b.saveId), "deleting one career must not remove the other");
  } finally {
    teardown();
  }
});

test("listSaves returns most-recently-played first, and touchSave updates only that save", async () => {
  const { backend } = setup();
  try {
    const a = await createSave(NEW_SAVE_INPUT);
    const b = await createSave(NEW_SAVE_INPUT);
    // createSave stamps `lastPlayedAt` from the wall clock, so two saves
    // made in the same millisecond tie. Give them explicit, distinct
    // timestamps -- this test is about ordering and write isolation, not
    // about clock resolution.
    await backend.putSave({ ...a, lastPlayedAt: "2026-08-01T00:00:00.000Z" });
    await backend.putSave({ ...b, lastPlayedAt: "2026-08-02T00:00:00.000Z" });
    assert.equal((await listSaves())[0].saveId, b.saveId, "the more recently played save sorts first");

    await touchSave(a.saveId);
    const saves = await listSaves();
    assert.equal(saves.length, 2);
    assert.equal(saves[0].saveId, a.saveId, "the touched save now sorts first");
    assert.equal((await getSave(b.saveId))!.lastPlayedAt, "2026-08-02T00:00:00.000Z", "the other save is untouched");
  } finally {
    teardown();
  }
});

// --- legacy migration ----------------------------------------------------

test("a valid legacy localStorage store migrates into IndexedDB", async () => {
  const legacy = { "save-1": legacySave("save-1"), "save-2": legacySave("save-2") };
  const { backend, data } = setup({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacy) });
  try {
    const outcome = await ensureLegacySavesMigrated();
    assert.equal(outcome.reason, "MIGRATED");
    assert.equal(outcome.migrated, 2);
    assert.equal(outcome.completed, true);
    assert.equal(await backend.saveRecordCount(), 2, "migrated as separate records");

    const migrated = await getSave("save-1");
    assert.deepEqual(migrated, legacy["save-1"], "the migrated save must be identical to its legacy form");
    assert.ok(data.has(LEGACY_STORAGE_KEY), "the localStorage source is retained, never auto-deleted");
    assert.equal(data.get(LEGACY_STORAGE_KEY), JSON.stringify(legacy), "the localStorage source is left byte-identical");
  } finally {
    teardown();
  }
});

test("a legacy save missing schemaVersion is migrated as v1, not assumed current", async () => {
  const raw = legacySave("save-old") as Partial<CareerSave>;
  delete raw.schemaVersion;
  delete raw.careerState;
  setup({ [LEGACY_STORAGE_KEY]: JSON.stringify({ "save-old": raw }) });
  try {
    await ensureLegacySavesMigrated();
    assert.equal((await getSave("save-old"))!.schemaVersion, 1);
  } finally {
    teardown();
  }
});

test("migration is idempotent, and never replays a stale legacy snapshot over a played career", async () => {
  const legacy = { "save-1": legacySave("save-1") };
  const { backend } = setup({ [LEGACY_STORAGE_KEY]: JSON.stringify(legacy) });
  try {
    const first = await ensureLegacySavesMigrated();
    assert.equal(first.migrated, 1);

    // Play on: the IndexedDB copy is now ahead of the legacy snapshot.
    await saveCareerState("save-1", { gameDate: "2027-03-01", seasonId: "2026/27" } as unknown as CareerState);

    // Re-run migration from scratch (simulates a new process/tab).
    __setSaveBackendForTests(backend);
    const second = await ensureLegacySavesMigrated();
    assert.equal(second.reason, "ALREADY_MIGRATED");
    assert.equal(second.migrated, 0);
    assert.equal(await backend.saveRecordCount(), 1, "no duplicate records");
    assert.equal((await getSave("save-1"))!.gameDate, "2027-03-01", "progress must survive a repeat migration");

    // Even with the completion marker cleared, an existing record wins.
    await backend.setMeta("legacy-localstorage-migration:v1", "");
    const store = createMemoryBackend("test2");
    await store.putSave({ ...legacySave("save-1"), gameDate: "2027-03-01" });
    __setSaveBackendForTests(store);
    const third = await ensureLegacySavesMigrated();
    assert.equal(third.skippedExisting, 1, "an existing IndexedDB record is never overwritten by the legacy copy");
    assert.equal((await getSave("save-1"))!.gameDate, "2027-03-01");
  } finally {
    teardown();
  }
});

test("no migration occurs when there is nothing to migrate", async () => {
  const { backend, data } = setup();
  try {
    const outcome = await ensureLegacySavesMigrated();
    assert.equal(outcome.reason, "NOTHING_TO_MIGRATE");
    assert.equal(outcome.migrated, 0);
    assert.equal(outcome.completed, true);
    assert.equal(await backend.saveRecordCount(), 0);
    assert.equal(data.has(LEGACY_STORAGE_KEY), false, "migration must not create the legacy key");
    assert.deepEqual(await listSaves(), []);
  } finally {
    teardown();
  }
});

test("an empty legacy store is treated as nothing to migrate, not as corruption", async () => {
  setup({ [LEGACY_STORAGE_KEY]: "{}" });
  try {
    assert.equal((await ensureLegacySavesMigrated()).reason, "NOTHING_TO_MIGRATE");
  } finally {
    teardown();
  }
});

test("corrupt legacy data is surfaced as a recoverable error, never silently discarded", async () => {
  const corrupt = '{"save-1": {"saveId": "save-1", ';
  const { backend, data } = setup({ [LEGACY_STORAGE_KEY]: corrupt });
  try {
    await assert.rejects(
      () => ensureLegacySavesMigrated(),
      (error: unknown) => error instanceof SavePersistenceError && error.code === "LEGACY_STORE_CORRUPT",
      "unparseable legacy data must throw, not resolve to an empty store",
    );
    // The pre-Phase-0 bug: this used to return {} and look like "no saves".
    await assert.rejects(() => listSaves(), (error: unknown) => error instanceof SavePersistenceError);

    assert.equal(data.get(LEGACY_STORAGE_KEY), corrupt, "the corrupt source must be left byte-identical for recovery");
    assert.equal(await backend.saveRecordCount(), 0, "nothing partial may be written");
    assert.equal(await backend.getMeta("legacy-localstorage-migration:v1"), null, "migration must NOT be marked complete, so it stays retryable");
  } finally {
    teardown();
  }
});

test("legacy data of the wrong shape is rejected rather than migrated", async () => {
  for (const bad of ['["save-1"]', '{"save-1": 42}', '{"save-1": {"noSaveId": true}}']) {
    const { data } = setup({ [LEGACY_STORAGE_KEY]: bad });
    try {
      await assert.rejects(
        () => ensureLegacySavesMigrated(),
        (error: unknown) => error instanceof SavePersistenceError && error.code === "LEGACY_STORE_CORRUPT",
        `expected ${bad} to be rejected`,
      );
      assert.equal(data.get(LEGACY_STORAGE_KEY), bad, "source untouched");
    } finally {
      teardown();
    }
  }
});

test("a failed migration is retryable once the underlying problem is fixed", async () => {
  const { data } = setup({ [LEGACY_STORAGE_KEY]: "not json" });
  try {
    await assert.rejects(() => ensureLegacySavesMigrated(), (e: unknown) => e instanceof SavePersistenceError);
    // The user repairs the store; no reload should be required.
    data.set(LEGACY_STORAGE_KEY, JSON.stringify({ "save-1": legacySave("save-1") }));
    const outcome = await ensureLegacySavesMigrated();
    assert.equal(outcome.reason, "MIGRATED");
    assert.equal(outcome.migrated, 1);
  } finally {
    teardown();
  }
});

test("a backend read failure surfaces, and never masquerades as 'no saves'", async () => {
  installLocalStorage();
  const failing: SaveStorageBackend = {
    ...createMemoryBackend("failing"),
    async listSaves() { throw new SavePersistenceError("READ_FAILED", "IndexedDB listSaves failed"); },
  };
  __setSaveBackendForTests(failing);
  try {
    await assert.rejects(
      () => listSaves(),
      (error: unknown) => error instanceof SavePersistenceError && error.code === "READ_FAILED",
    );
  } finally {
    teardown();
  }
});

test("migration writes are verified before migration is marked complete", async () => {
  installLocalStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify({ "save-1": legacySave("save-1") }) });
  const base = createMemoryBackend("lossy");
  // A backend that silently drops the careerState on write -- exactly the
  // class of fault the read-back verification exists to catch.
  const lossy: SaveStorageBackend = {
    ...base,
    async putSave(save) { await base.putSave({ ...save, careerState: undefined }); },
  };
  __setSaveBackendForTests(lossy);
  try {
    await assert.rejects(
      () => ensureLegacySavesMigrated(),
      (error: unknown) => error instanceof SavePersistenceError && error.code === "MIGRATION_VERIFICATION_FAILED",
    );
    assert.equal(await lossy.getMeta("legacy-localstorage-migration:v1"), null, "an unverified migration is never marked complete");
  } finally {
    teardown();
  }
});
