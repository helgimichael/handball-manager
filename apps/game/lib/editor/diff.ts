// OLD -> NEW field diff (HM-DATA-EDITOR-0.1, Spec S18).
//
// Only changed fields are reported. Comparison is by JSON value equality
// (order-sensitive for arrays, which is correct here -- e.g.
// secondaryPositions order is part of the value the editor round-trips).

export interface FieldDiffEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Shallow diff over the given field set -- both objects are expected to already share this key set. */
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>, fields: readonly string[]): FieldDiffEntry[] {
  const entries: FieldDiffEntry[] = [];
  for (const field of fields) {
    if (!valuesEqual(before[field], after[field])) {
      entries.push({ field, oldValue: before[field], newValue: after[field] });
    }
  }
  return entries;
}
