// HM-EDITOR-0.2: client-side Editor Mode visibility toggle.
//
// This is a UX convenience ONLY -- it controls whether the in-game
// nav widget/link is shown, and whether /editor's own pages render
// their content instead of an "Editor Mode is off" placeholder. It has
// NO authority over whether the editor is actually reachable: every
// /editor page (server layout) and every /api/editor/* route
// independently re-checks lib/editor/env.ts's isEditorEnabled()
// (env var + NODE_ENV, unchanged by this milestone) regardless of this
// toggle's state. Flipping this toggle can never expose the editor in
// a build where isEditorEnabled() is false -- see lib/editor/env.ts's
// own doc: "hiding a nav link can never be the only thing standing
// between a browser and a file write." This module owns exactly the
// opposite, weaker guarantee: showing a nav link is never itself a
// bypass either.
//
// Mirrors lib/save/saveRepository.ts's own localStorage convention:
// one storage key, an isBrowser() guard, typed get/set functions only
// (no component scatters raw localStorage calls).
const STORAGE_KEY = "hm-editor:enabled:v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

/** Whether the user has switched Editor Mode on in THIS browser. Always `false` outside a browser (SSR) or when localStorage is unavailable. */
export function readEditorToggle(): boolean {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function writeEditorToggle(enabled: boolean): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}
