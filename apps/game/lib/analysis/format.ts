// Display-only formatting helpers for the Analysis Hub UI. No domain
// logic lives here -- only how an already-computed value is rendered.
import type { MissingDataState } from "./types";

export function fmtPct(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${Math.round(value * 1000) / 10}%`;
}

export function fmtNum(value: number | null | undefined, decimals = 1): string {
  return value === null || value === undefined ? "—" : value.toFixed(decimals);
}

export function fmtMissing(state: MissingDataState): string {
  switch (state) {
    case "NO_MATCHES_YET":
      return "No matches yet";
    case "INSUFFICIENT_DATA":
      return "Insufficient data";
    case "NOT_AVAILABLE_YET":
      return "Not available yet";
  }
}

export function formLabel(entry: "W" | "D" | "L"): { text: string; tone: "positive" | "neutral" | "negative" } {
  if (entry === "W") return { text: "W", tone: "positive" };
  if (entry === "L") return { text: "L", tone: "negative" };
  return { text: "D", tone: "neutral" };
}
