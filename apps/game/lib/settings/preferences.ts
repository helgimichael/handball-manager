// HM-ALPHA3-M01: device-level player preferences.
//
// Preferences describe how THIS device presents the game -- never what
// the career is. They live in their own localStorage key, are never
// written into a career save, and no rule, formula or persisted value
// may read them (the display currency is presentation only, see
// lib/economy/currency.ts). Switching a preference therefore can never
// touch a save.
//
// The store starts at the defaults on every page load and only adopts
// the stored values when `hydratePreferences()` runs after mount
// (PreferencesHydrator). Server render and the first client render
// therefore always agree, so a stored "SEK" can never cause a hydration
// mismatch -- the UI switches one frame later instead.
//
// Mirrors lib/editor/editorToggle.ts: one storage key, an isBrowser()
// guard, typed accessors only -- no component touches localStorage.

export type DisplayCurrency = "EUR" | "SEK";

export const DISPLAY_CURRENCIES: readonly DisplayCurrency[] = ["EUR", "SEK"];

export interface Preferences {
  displayCurrency: DisplayCurrency;
}

export const DEFAULT_PREFERENCES: Preferences = Object.freeze({ displayCurrency: "EUR" });

export const PREFERENCES_STORAGE_KEY = "hm-preferences:v1";

let current: Preferences = DEFAULT_PREFERENCES;
let hydrated = false;
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    // Blocked site data / privacy mode can throw on mere access.
    return null;
  }
}

/** Accepts only known values; anything else falls back to the default, so a corrupt or future key can never break rendering. */
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;
  try {
    const value = JSON.parse(raw) as Partial<Preferences> | null;
    const displayCurrency = DISPLAY_CURRENCIES.includes(value?.displayCurrency as DisplayCurrency)
      ? (value!.displayCurrency as DisplayCurrency)
      : DEFAULT_PREFERENCES.displayCurrency;
    return { displayCurrency };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getPreferences(): Preferences {
  return current;
}

/** Server snapshot for useSyncExternalStore: always the defaults. */
export function getServerPreferences(): Preferences {
  return DEFAULT_PREFERENCES;
}

export function subscribePreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Adopt the stored preferences once on the client. Idempotent. */
export function hydratePreferences(): void {
  if (hydrated) return;
  hydrated = true;
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(PREFERENCES_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  const next = parsePreferences(raw);
  if (next.displayCurrency !== current.displayCurrency) {
    current = next;
    emit();
  }
}

/** Updates the in-memory preference immediately (the UI re-renders even if storage is blocked) and persists it best-effort. Returns whether it was persisted. */
export function updatePreferences(patch: Partial<Preferences>): boolean {
  current = { ...current, ...patch };
  hydrated = true;
  emit();
  try {
    const store = storage();
    if (!store) return false;
    store.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
}

/** Test seam: back to a fresh page load. */
export function resetPreferencesForTests(): void {
  current = DEFAULT_PREFERENCES;
  hydrated = false;
  emit();
}
