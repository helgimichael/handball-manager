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
// load (see getOrCreateCareerState in this file) and persists the
// upgrade, rather than silently discarding the save or throwing.

import type { CareerState } from "../career/types";

export type ManagerProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
};

export const CURRENT_SAVE_SCHEMA_VERSION = 2;

export type CareerSave = {
  saveId: string;
  schemaVersion: number;
  selectedNations: readonly string[];
  selectedCompetitionIds: readonly string[];
  clubId: string;
  manager: ManagerProfile;
  gameDate: string;
  createdAt: string;
  lastPlayedAt: string;
  /** Absent on HM-GAME-0.1 (schemaVersion 1) saves -- see module doc comment. */
  careerState?: CareerState;
};

const STORAGE_KEY = "hm-game:saves:v1";

type SaveStore = Record<string, CareerSave>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStore(): SaveStore {
  if (!isBrowser()) {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as SaveStore;
    // Normalize: any save missing schemaVersion is a pre-HM-GAME-0.2A
    // (v1) save -- tag it explicitly rather than leaving it undefined,
    // so every other function in this module can rely on the field
    // always being present.
    for (const save of Object.values(parsed)) {
      if (typeof save.schemaVersion !== "number") {
        save.schemaVersion = 1;
      }
    }
    return parsed;
  } catch {
    return {};
  }
}

function writeStore(store: SaveStore): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function listSaves(): readonly CareerSave[] {
  const store = readStore();
  return Object.values(store).sort((a, b) => (a.lastPlayedAt < b.lastPlayedAt ? 1 : -1));
}

export function getMostRecentSave(): CareerSave | null {
  const saves = listSaves();
  return saves[0] ?? null;
}

export function getSave(saveId: string): CareerSave | null {
  const store = readStore();
  return store[saveId] ?? null;
}

export function createSave(input: Omit<CareerSave, "saveId" | "schemaVersion" | "createdAt" | "lastPlayedAt" | "careerState">): CareerSave {
  const now = new Date().toISOString();
  const save: CareerSave = {
    ...input,
    saveId: `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
    createdAt: now,
    lastPlayedAt: now,
  };
  const store = readStore();
  store[save.saveId] = save;
  writeStore(store);
  return save;
}

export function touchSave(saveId: string): void {
  const store = readStore();
  const save = store[saveId];
  if (!save) {
    return;
  }
  save.lastPlayedAt = new Date().toISOString();
  writeStore(store);
}

export function deleteSave(saveId: string): void {
  const store = readStore();
  delete store[saveId];
  writeStore(store);
}

/** Persists domain state only (never React component state) -- called after every calendar advance. */
export function saveCareerState(saveId: string, careerState: CareerState): void {
  const store = readStore();
  const save = store[saveId];
  if (!save) {
    return;
  }
  save.careerState = careerState;
  save.schemaVersion = CURRENT_SAVE_SCHEMA_VERSION;
  save.gameDate = careerState.gameDate;
  save.lastPlayedAt = new Date().toISOString();
  writeStore(store);
}

const ACTIVE_SAVE_KEY = "hm-game:active-save:v1";

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

export function getActiveSave(): CareerSave | null {
  const id = getActiveSaveId();
  if (!id) {
    return null;
  }
  return getSave(id);
}
