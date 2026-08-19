// Shared ISO-date ("YYYY-MM-DD") math for Career Rhythm (HM-GAME-0.3).
// No prior shared date-util module existed in apps/game -- calendar.ts's
// fixture dates, GameShell's display formatting, and game-simulation's
// fixtures.ts each had their own private date handling. This module is
// the one place Career Rhythm's day-by-day tick does date arithmetic.

/** Adds (or subtracts, for negative `days`) whole days to an ISO date string. */
export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** -1 if a < b, 0 if equal, 1 if a > b. Relies on ISO dates sorting lexicographically. */
export function compareDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function isBefore(a: string, b: string): boolean {
  return compareDates(a, b) < 0;
}

export function isSameOrBefore(a: string, b: string): boolean {
  return compareDates(a, b) <= 0;
}

export function isAfter(a: string, b: string): boolean {
  return compareDates(a, b) > 0;
}

/** Whole-day difference (b - a). Positive when b is later than a. */
export function daysBetween(a: string, b: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const dateA = new Date(`${a}T00:00:00Z`).getTime();
  const dateB = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((dateB - dateA) / msPerDay);
}

const WEEKDAYS_SV = ["Sön", "Mån", "Tis", "Ons", "Tors", "Fre", "Lör"];
const MONTHS_SV = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** Swedish "Mån 24 aug 2026" style formatting -- shared by GameShell/Home/Inbox. */
export function formatGameDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS_SV[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS_SV[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
