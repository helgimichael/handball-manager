// Editor enable guard (HM-DATA-EDITOR-0.1, Spec S0/S9/S10).
//
// The editor is development-only infrastructure, never a player-facing
// game feature. This is the ONE function every editor entry point (every
// API route AND the /editor route layout) calls first. It is not merely
// a UI convenience -- read/write API routes refuse to touch the
// filesystem at all unless this returns true, so hiding a nav link can
// never be the only thing standing between a browser and a file write.

export function isEditorEnabled(): boolean {
  return process.env.HM_EDITOR_ENABLED === "true" && process.env.NODE_ENV !== "production";
}
