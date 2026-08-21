// The one allowed data root (HM-DATA-EDITOR-0.1, Spec S7/S40).
//
// This is the ONLY hardcoded filesystem path in the editor. Every other
// file the editor ever reads or writes is discovered by walking this
// directory (see catalog.ts) -- never constructed by concatenating
// client-supplied strings. Client requests only ever carry opaque ids
// (clubId, playerId) that must exactly match something the server
// itself already discovered; an id that matches nothing simply resolves
// to nothing, so there is no path a `../` payload could take to escape
// this root.
import path from "node:path";

/** apps/game's cwd at runtime is apps/game itself -- the repo root's data/real-world is two levels up. */
export const DEFAULT_DATA_ROOT = path.resolve(process.cwd(), "..", "..", "data", "real-world");
