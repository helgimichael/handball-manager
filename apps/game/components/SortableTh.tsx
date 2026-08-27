"use client";

// HM-DATA-ALLSVENSKAN-1.1B Part 9: the ONE reusable sortable-table-header
// primitive -- every career table with a meaningful sort column should
// use this, not a bespoke per-page <th onClick> implementation. Clicking
// the active column's header flips direction; clicking a different
// column switches to it at `defaultDirection` (numeric/rating-style
// columns usually want "best first" = desc; text columns usually want
// A-Z = asc). The current column always shows an explicit ▲/▼ arrow --
// never just a highlight -- so the active sort and its direction are
// both unambiguous at a glance.
export type SortDirection = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

interface SortableThProps<K extends string> {
  label: string;
  sortKey: K;
  /** `null` means "no explicit sort active yet" (e.g. a table that defaults to some other natural/domain order) -- every column then renders inactive. */
  sort: SortState<K> | null;
  onSort: (next: SortState<K>) => void;
  /** Direction a FIRST click on this (currently-inactive) column selects. Defaults to "asc". */
  defaultDirection?: SortDirection;
  numeric?: boolean;
}

export function SortableTh<K extends string>({ label, sortKey, sort, onSort, defaultDirection = "asc", numeric }: SortableThProps<K>) {
  const active = sort !== null && sort.key === sortKey;
  const handleClick = () => {
    if (active && sort) {
      onSort({ key: sortKey, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onSort({ key: sortKey, direction: defaultDirection });
    }
  };
  const activeDirection = active && sort ? sort.direction : null;
  return (
    <th
      onClick={handleClick}
      className={numeric ? "hm-table-num" : undefined}
      style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      aria-sort={activeDirection ? (activeDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      <span style={{ marginLeft: 4, display: "inline-block", width: 10, color: activeDirection ? "var(--hm-text-strong, currentColor)" : "var(--hm-border-strong)" }}>
        {activeDirection ? (activeDirection === "asc" ? "▲" : "▼") : "▲"}
      </span>
    </th>
  );
}

/** Generic comparator helper: applies `sort.direction` to a plain ascending-sense comparator. */
export function applySortDirection(direction: SortDirection, cmp: number): number {
  return direction === "asc" ? cmp : -cmp;
}
