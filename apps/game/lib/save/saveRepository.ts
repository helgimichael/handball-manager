// Smallest useful local career persistence for HM-GAME-0.1. Deliberately
// kept behind this one module's public functions (not scattered
// localStorage.getItem calls throughout components) so a real save-file
// backend can replace the implementation later without touching every
// screen that reads/writes career state.

export type ManagerProfile = {
  name: string;
  nationality: string;
  dateOfBirth: string;
};

export type CareerSave = {
  saveId: string;
  selectedNations: readonly string[];
  selectedCompetitionIds: readonly string[];
  clubId: string;
  manager: ManagerProfile;
  gameDate: string;
  createdAt: string;
  lastPlayedAt: string;
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
    return JSON.parse(raw) as SaveStore;
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

export function createSave(input: Omit<CareerSave, "saveId" | "createdAt" | "lastPlayedAt">): CareerSave {
  const now = new Date().toISOString();
  const save: CareerSave = {
    ...input,
    saveId: `save-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
