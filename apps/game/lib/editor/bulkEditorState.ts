// HM-PLAYER-DATA-EDITOR-1.0C: the bulk calibration workspace's pure state
// rules, extracted from app/editor/players/page.tsx so the save lifecycle is
// testable without a DOM.
//
// This module exists because of a real reported failure: the user edited
// Division 1 positions in the workspace, pressed Save, and NO write reached
// disk. The backend was never at fault -- savePlayerEdit and
// atomicWriteJsonFile both behaved correctly under automation. Every defect
// was in the client's edit->save lifecycle:
//
//   1. `matchesFilters` used to compare the POSITION / TRUPPSTATUS filters
//      against the row's in-progress DRAFT. Filtering by POSITION=MV and then
//      correcting a goalkeeper to H9 made the row fail its own filter and
//      disappear from the table mid-edit -- taking its per-row Spara button
//      with it. The edit survived in state but became invisible and
//      unreachable, which reads exactly like "the edit did not take".
//      The filters now describe what is ON DISK: a row leaves the view only
//      once its edit has actually been saved.
//   2. Drafts live only in component state, so any remount (in-app
//      navigation, reload, dev-server refresh) silently discarded them and
//      reset the page to "Spara alla (0)" -- indistinguishable from never
//      having edited. The page now guards both exits; `countDirty` is what
//      those guards key off.
//
// The invariant every helper here upholds: a row is cleared ONLY by a
// confirmed successful server response. A failure -- or a save that never
// dispatched at all -- leaves the draft dirty.

/** The subset of the workspace row this module reasons about. */
export interface DirtyComparable {
  primaryPosition: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  defaultSquadStatus: string | null;
  specialTags: string[];
  ca: number | null;
  pa: number | null;
}

/** SOURCE fields write to players-*.json / roster-*.json. */
export function isSourceDirty(row: DirtyComparable, original: DirtyComparable): boolean {
  return (
    row.primaryPosition !== original.primaryPosition ||
    row.dateOfBirth !== original.dateOfBirth ||
    row.birthYear !== original.birthYear ||
    row.defaultSquadStatus !== original.defaultSquadStatus ||
    JSON.stringify(row.specialTags) !== JSON.stringify(original.specialTags)
  );
}

/** RATING fields write to the locked rating database. */
export function isRatingDirty(row: DirtyComparable, original: DirtyComparable): boolean {
  return row.ca !== original.ca || row.pa !== original.pa;
}

export function isDirty(row: DirtyComparable, original: DirtyComparable): boolean {
  return isSourceDirty(row, original) || isRatingDirty(row, original);
}

export interface FilterableRow {
  playerId: string;
  competitionSlug: string;
  clubId: string;
  fullName: string;
  primaryPosition: string;
  defaultSquadStatus: string | null;
}

export interface WorkspaceFilters {
  league: string;
  club: string;
  position: string;
  status: string;
  search: string;
}

/**
 * Whether a row belongs in the visible table.
 *
 * `saved` is the row as it exists ON DISK (the `originals` entry); `row` is
 * the live draft. POSITION and TRUPPSTATUS deliberately match against
 * `saved`, so editing a row can never remove that row from view -- see this
 * module's header. When a row has no saved counterpart yet, the draft is the
 * best available truth.
 */
export function matchesFilters(row: FilterableRow, saved: FilterableRow | undefined, filters: WorkspaceFilters): boolean {
  const onDisk = saved ?? row;
  const term = filters.search.trim().toLowerCase();
  if (filters.league && row.competitionSlug !== filters.league) return false;
  if (filters.club && row.clubId !== filters.club) return false;
  if (filters.position && onDisk.primaryPosition !== filters.position) return false;
  if (filters.status && onDisk.defaultSquadStatus !== filters.status) return false;
  if (term && !row.fullName.toLowerCase().includes(term)) return false;
  return true;
}

/** The exact set of rows with unsaved edits -- what "Spara alla (n)" reports and the unsaved-work guards key off. */
export function dirtyPlayerIds<T extends DirtyComparable & { playerId: string }>(rows: T[], originals: Record<string, T>): string[] {
  return rows.filter((r) => originals[r.playerId] && isDirty(r, originals[r.playerId])).map((r) => r.playerId);
}

export interface SaveAllOutcome {
  attempted: string[];
  saved: string[];
  failed: string[];
}

/**
 * Dispatches one save per dirty row and reports the exact outcome.
 *
 * Every id is attempted even when an earlier one fails, and the returned
 * `failed` list is what the UI must keep showing as dirty. `saveOne` resolves
 * true ONLY when the server confirmed the write.
 */
export async function runSaveAll(ids: string[], saveOne: (playerId: string) => Promise<boolean>): Promise<SaveAllOutcome> {
  const saved: string[] = [];
  const failed: string[] = [];
  for (const id of ids) {
    if (await saveOne(id)) saved.push(id);
    else failed.push(id);
  }
  return { attempted: [...ids], saved, failed };
}

/**
 * The post-save baseline. A confirmed save promotes the draft to the new
 * on-disk truth; anything else leaves the previous baseline untouched, so the
 * row stays dirty and the user's edit is never silently dropped.
 */
export function applySaveOutcome<T>(originals: Record<string, T>, playerId: string, draft: T, ok: boolean): Record<string, T> {
  if (!ok) return originals;
  return { ...originals, [playerId]: draft };
}
