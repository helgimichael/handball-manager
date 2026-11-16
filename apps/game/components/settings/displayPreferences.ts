"use client";
// Arena 231 -- ENT-05/SYS-01 'Visning': device-level display preferences, kept apart from lib/settings/preferences
// (currency/match speed) so that store's persisted shape is unchanged. Three settings, each applied as a root
// data attribute that motion.css (loaded on every route) turns into real CSS:
// - motion: 'SYSTEM' follows the OS reduced-motion setting; 'REDUCED' sets <html data-motion="reduced">.
// - density: 'COMPACT' sets <html data-density="compact"> (tighter table rows, rail links, header and page gutters).
// - textSize: 112/125 sets <html data-text-size> + --hm-text-zoom; the career content area and the settings page
//   are zoomed (the app is px-based, so root font-size would do nothing). Phones keep their own OS text size.
import { useSyncExternalStore } from "react";

export type MotionPreference = "SYSTEM" | "REDUCED";
export type DensityPreference = "COMFORTABLE" | "COMPACT";
export const TEXT_SIZES = [100, 112, 125] as const;
export type TextSizePreference = (typeof TEXT_SIZES)[number];
export interface DisplayPreferences { motion: MotionPreference; density: DensityPreference; textSize: TextSizePreference }
export const DEFAULT_DISPLAY: DisplayPreferences = Object.freeze({ motion: "SYSTEM", density: "COMFORTABLE", textSize: 100 });
const KEY = "hm-display-preferences:v1";

let current: DisplayPreferences = DEFAULT_DISPLAY;
let hydrated = false;
const listeners = new Set<() => void>();

export function parseDisplayPreferences(raw: string | null): DisplayPreferences {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<DisplayPreferences>) : null;
    const textSize = TEXT_SIZES.find((t) => t === v?.textSize) ?? 100;
    return { motion: v?.motion === "REDUCED" ? "REDUCED" : "SYSTEM", density: v?.density === "COMPACT" ? "COMPACT" : "COMFORTABLE", textSize };
  } catch {
    return DEFAULT_DISPLAY;
  }
}

/** Root attributes for a preference set (pure; `null` = attribute removed). */
export function displayRootAttributes(p: DisplayPreferences): { motion: string | null; density: string | null; textSize: string | null; zoom: string | null } {
  return {
    motion: p.motion === "REDUCED" ? "reduced" : null,
    density: p.density === "COMPACT" ? "compact" : null,
    textSize: p.textSize === 100 ? null : String(p.textSize),
    zoom: p.textSize === 100 ? null : (p.textSize / 100).toFixed(2),
  };
}

function apply(p: DisplayPreferences) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const a = displayRootAttributes(p);
  const set = (key: "motion" | "density" | "textSize", value: string | null) => { if (value) root.dataset[key] = value; else delete root.dataset[key]; };
  set("motion", a.motion);
  set("density", a.density);
  set("textSize", a.textSize);
  if (a.zoom) root.style.setProperty("--hm-text-zoom", a.zoom); else root.style.removeProperty("--hm-text-zoom");
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  let raw: string | null = null;
  try { raw = window.localStorage.getItem(KEY); } catch { raw = null; }
  current = parseDisplayPreferences(raw);
  apply(current);
}

/** Mounted once at the root: applies the stored preference to <html> after hydration. */
export function applyStoredDisplayPreferences(): void {
  hydrate();
  listeners.forEach((l) => l());
}

export function updateDisplayPreferences(patch: Partial<DisplayPreferences>): boolean {
  current = { ...current, ...patch };
  hydrated = true;
  apply(current);
  listeners.forEach((l) => l());
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
    return true;
  } catch {
    return false;
  }
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const snapshot = () => current;
const serverSnapshot = () => DEFAULT_DISPLAY;

export function useDisplayPreferences(): DisplayPreferences {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
