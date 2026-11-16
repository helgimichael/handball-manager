// Arena Nights SYS-02a/02b: pure helpers for the player calibration editors' dev affordances --
// per-cell dirty tracking, an undo stack, and the saved-vs-draft diff for the detail page.
// UI-only bookkeeping: nothing here reads or writes data, and the canonical save paths
// (lib/editor/bulkEditorState.ts, playerRepository, ratingCalibration) are unchanged.

/** The fields the bulk table edits inline (same set bulkEditorState's isDirty compares). */
export const BULK_EDITABLE_FIELDS = ["primaryPosition", "dateOfBirth", "birthYear", "defaultSquadStatus", "specialTags", "ca", "pa"] as const;
export type BulkEditableField = (typeof BULK_EDITABLE_FIELDS)[number];
export type BulkEditable = { [K in BulkEditableField]: unknown };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Which inline-edited cells of `row` differ from its saved baseline. */
export function dirtyFields(row: BulkEditable, original: BulkEditable | undefined): Set<BulkEditableField> {
  const out = new Set<BulkEditableField>();
  if (!original) return out;
  for (const key of BULK_EDITABLE_FIELDS) if (!same(row[key], original[key])) out.add(key);
  return out;
}

/** Total number of dirty cells across rows (the save bar's second figure). */
export function countDirtyCells<T extends BulkEditable & { playerId: string }>(rows: readonly T[], originals: Record<string, T>): number {
  return rows.reduce((sum, row) => sum + dirtyFields(row, originals[row.playerId]).size, 0);
}

/** The editable fields of `original`, to patch a draft row back to its saved values. */
export function revertPatch<T extends BulkEditable>(original: T): Pick<T, BulkEditableField> {
  const patch = {} as Pick<T, BulkEditableField>;
  for (const key of BULK_EDITABLE_FIELDS) patch[key] = original[key];
  return patch;
}

export interface EditStep<T> {
  readonly playerId: string;
  /** The row's values for the patched keys BEFORE the edit -- applying it undoes the edit. */
  readonly before: Partial<T>;
}

export const UNDO_LIMIT = 200;

/**
 * Push an edit onto the undo stack. Consecutive edits of the same cell(s) of the same row
 * (e.g. typing "1", "12", "125" into CA) collapse into one step that restores the value
 * from before the first keystroke.
 */
export function pushEditStep<T>(stack: readonly EditStep<T>[], step: EditStep<T>, limit = UNDO_LIMIT): EditStep<T>[] {
  const top = stack[stack.length - 1];
  if (top && top.playerId === step.playerId && sameKeys(top.before, step.before)) return [...stack];
  const next = [...stack, step];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

function sameKeys(a: object, b: object): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  return ka.length === kb.length && ka.every((k, i) => k === kb[i]);
}

export function popEditStep<T>(stack: readonly EditStep<T>[]): { step: EditStep<T> | undefined; rest: EditStep<T>[] } {
  if (stack.length === 0) return { step: undefined, rest: [] };
  return { step: stack[stack.length - 1], rest: stack.slice(0, -1) };
}

/** Pick `keys` of `row` -- the `before` half of an EditStep for a patch touching those keys. */
export function pickBefore<T extends object>(row: T, keys: readonly (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const key of keys) out[key] = row[key];
  return out;
}

export interface FieldDiff {
  readonly section: "player" | "roster";
  readonly field: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

/** Saved record vs draft, field by field, in the record's own key order (SYS-02b diff summary). */
export function recordDiff(saved: { player: object; roster: object }, draft: { player: object; roster: object }): FieldDiff[] {
  const out: FieldDiff[] = [];
  for (const section of ["player", "roster"] as const) {
    const a = saved[section] as Record<string, unknown>;
    const b = draft[section] as Record<string, unknown>;
    for (const field of Object.keys(a)) {
      if (!same(a[field], b[field])) out.push({ section, field, oldValue: a[field], newValue: b[field] });
    }
  }
  return out;
}
