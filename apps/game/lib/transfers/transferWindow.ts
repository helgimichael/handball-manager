// HM-TRANSFERS-1.0: registration/transfer-window foundation. Confirmed
// by audit: no registration-window concept, real Swedish transfer-window
// dates, or federation rule exists anywhere in this project's sources
// (lib/career/preseason.ts's own REAL_LEAGUE_KICKOFF_DATES covers only
// league kickoff, not registration deadlines). Per explicit instruction
// ("bygg en tydlig versionerad regelmodell... undvik påhittad
// precision"), this is an HONEST, clearly-versioned FIRST-PASS
// placeholder -- generic summer/winter windows, not researched Swedish
// SHF dates -- calibrate against real federation rules if/when sourced.
export const TRANSFER_WINDOW_RULE_SET_VERSION = "GENERIC_FOUNDATION_v0.1";

export type TransferWindowId = "SUMMER" | "WINTER";

export interface TransferWindow {
  id: TransferWindowId;
  startDate: string;
  endDate: string;
}

/** One season's pair of windows, anchored to the calendar year the SUMMER window falls in. */
function windowsForYear(year: number): TransferWindow[] {
  return [
    { id: "SUMMER", startDate: `${year}-06-01`, endDate: `${year}-09-30` },
    { id: "WINTER", startDate: `${year + 1}-01-01`, endDate: `${year + 1}-01-31` },
  ];
}

/** Only PERMANENT deals are gated by this (loans complete immediately in v1 -- see transferIntegration.ts's own doc). */
export function isTransferWindowOpen(date: string): boolean {
  const year = Number(date.slice(0, 4));
  const candidateWindows = [...windowsForYear(year - 1), ...windowsForYear(year)];
  return candidateWindows.some((w) => date >= w.startDate && date <= w.endDate);
}

/** The next date a currently-closed window opens, strictly after `date`. Used to schedule a AGREED_AWAITING_WINDOW offer's `scheduledCompletionDate`. */
export function nextTransferWindowOpenDate(date: string): string {
  const year = Number(date.slice(0, 4));
  // HM-ALPHA3-M05 fix: include this year's windows -- from November the next window is January, not next June.
  const candidateWindows = [...windowsForYear(year - 1), ...windowsForYear(year), ...windowsForYear(year + 1)];
  const upcoming = candidateWindows.filter((w) => w.startDate > date).sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
  return upcoming[0].startDate;
}
