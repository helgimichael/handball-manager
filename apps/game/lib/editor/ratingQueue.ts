// Arena Nights SYS-02c/02d -- pure helpers for the rating review queue (dev editor only).
// Buckets the workbench's own review statuses into the three queue filters and summarises
// progress for a club roster that has actually been loaded. Never invents a status.

export type ReviewBucket = "UNREVIEWED" | "REVIEWED" | "LOCKED";

export const REVIEW_BUCKET_LABEL: Record<ReviewBucket, string> = {
  UNREVIEWED: "Ej granskad",
  REVIEWED: "Granskad",
  LOCKED: "Låst",
};

export const REVIEW_BUCKETS: readonly ReviewBucket[] = ["UNREVIEWED", "REVIEWED", "LOCKED"];

export interface QueueRowLike {
  status: string;
  locked?: unknown;
}

/** LOCKED wins (a lock record or LOCKED status), then REVIEWED; UNASSESSED/PROPOSED (and anything unknown) stay unreviewed. */
export function reviewBucket(row: QueueRowLike): ReviewBucket {
  if (row.status === "LOCKED" || (row.locked !== null && row.locked !== undefined)) return "LOCKED";
  if (row.status === "REVIEWED") return "REVIEWED";
  return "UNREVIEWED";
}

export interface QueueProgress {
  total: number;
  unreviewed: number;
  reviewed: number;
  locked: number;
  /** Share of the roster that is reviewed or locked, 0..1 (0 for an empty roster). */
  done: number;
}

export function queueProgress(rows: readonly QueueRowLike[]): QueueProgress {
  let unreviewed = 0;
  let reviewed = 0;
  let locked = 0;
  for (const row of rows) {
    const bucket = reviewBucket(row);
    if (bucket === "LOCKED") locked++;
    else if (bucket === "REVIEWED") reviewed++;
    else unreviewed++;
  }
  const total = rows.length;
  return { total, unreviewed, reviewed, locked, done: total === 0 ? 0 : (reviewed + locked) / total };
}

/** Filter by bucket (null = all) and name/id search; unreviewed rows first, original order otherwise. */
export function filterQueue<T extends QueueRowLike>(rows: readonly T[], bucket: ReviewBucket | null, matchesSearch: (row: T) => boolean = () => true): T[] {
  const order: Record<ReviewBucket, number> = { UNREVIEWED: 0, REVIEWED: 1, LOCKED: 2 };
  return rows
    .map((row, index) => ({ row, index, b: reviewBucket(row) }))
    .filter(({ row, b }) => (bucket === null || b === bucket) && matchesSearch(row))
    .sort((a, z) => order[a.b] - order[z.b] || a.index - z.index)
    .map(({ row }) => row);
}

export interface OverrideDiffRow {
  key: string;
  /** The value the override replaced, when the workbench still exposes it; null when the API only returns the overridden value. */
  base: number | null;
  baseLabel: string;
  override: number;
}

/**
 * Rows for the "overrides vs generated" comparison. CA/PA compare against the model estimate when one
 * exists; attributes against the evidence-backed source value when the profile has one. The workbench
 * applies overrides before returning the preview, so a purely generated base value is not available --
 * that case is labelled, never guessed.
 */
export function overrideDiffRows(input: {
  override: { ca?: number; pa?: number; attributeOverrides?: Record<string, number> } | null;
  caEstimate: number | null;
  knownAttributes: Record<string, number> | undefined;
}): OverrideDiffRow[] {
  const { override, caEstimate, knownAttributes } = input;
  if (!override) return [];
  const rows: OverrideDiffRow[] = [];
  if (override.ca !== undefined) rows.push({ key: "CA", base: caEstimate, baseLabel: caEstimate === null ? "ingen modellskattning" : "modellskattning", override: override.ca });
  if (override.pa !== undefined) rows.push({ key: "PA", base: null, baseLabel: "ej exponerat av API", override: override.pa });
  for (const [key, value] of Object.entries(override.attributeOverrides ?? {})) {
    const known = knownAttributes?.[key];
    rows.push({ key, base: known ?? null, baseLabel: known === undefined ? "genererat (dolt av överstyrning)" : "källvärde", override: value });
  }
  return rows;
}
