// Arena Nights 231 -- WLD-06 C Calendar List View, WLD-06b B Calendar Chips,
// WLD-06a A Preseason Board. Pure, read-only view models over the club's
// own fixtures, results and booked pre-season events.
import { getNextPlayerFixture } from "../career/calendar";
import { preseasonEvents, type PreseasonEvent } from "../career/preseasonPlanning";
import type { CareerFixture, CareerFixtureType, CareerState } from "../career/types";

export type When = "ALL" | "UPCOMING" | "RESULTS";
export const WHEN_CHIPS: { id: When; label: string }[] = [{ id: "ALL", label: "Hela säsongen" }, { id: "UPCOMING", label: "Kommande" }, { id: "RESULTS", label: "Resultat" }];
export const TYPE_CHIPS: { id: CareerFixtureType; label: string }[] = [{ id: "LEAGUE", label: "Liga" }, { id: "CUP", label: "Cup" }, { id: "PLAYOFF", label: "SM-slutspel" }, { id: "QUALIFIER", label: "Kval" }, { id: "FRIENDLY", label: "Träningsmatch" }];

export function parseWhen(v: string | null | undefined): When {
  return v === "UPCOMING" || v === "RESULTS" ? v : "ALL";
}
export function parseTypes(v: string | null | undefined): CareerFixtureType[] {
  const ids = new Set((v ?? "").split(",").map((x) => x.trim().toUpperCase()));
  return TYPE_CHIPS.filter((c) => ids.has(c.id)).map((c) => c.id);
}

export interface FixtureRow {
  fixture: CareerFixture;
  home: boolean;
  opponentId: string;
  played: boolean;
  isNext: boolean;
  /** Only the real next fixture (match preview has no per-fixture route) and played ones open on click. */
  clickable: boolean;
  goalsFor?: number;
  goalsAgainst?: number;
  outcome?: "W" | "D" | "L";
}

export function fixtureRows(state: CareerState): FixtureRow[] {
  const me = state.playerClubId;
  const next = getNextPlayerFixture(state);
  return state.fixtures.filter((f) => f.homeClubId === me || f.awayClubId === me).sort((a, b) => a.date.localeCompare(b.date) || (a.kickoffTime ?? "").localeCompare(b.kickoffTime ?? "")).map((f) => {
    const home = f.homeClubId === me;
    const r = state.results[f.id];
    const gf = r ? (home ? r.homeGoals : r.awayGoals) : undefined;
    const ga = r ? (home ? r.awayGoals : r.homeGoals) : undefined;
    const isNext = !r && f.id === next?.id;
    return { fixture: f, home, opponentId: home ? f.awayClubId : f.homeClubId, played: !!r, isNext, clickable: !!r || isNext, goalsFor: gf, goalsAgainst: ga, outcome: r ? (gf! > ga! ? "W" : gf! < ga! ? "L" : "D") : undefined };
  });
}

const matchesWhen = (r: FixtureRow, when: When) => when === "ALL" || (when === "RESULTS" ? r.played : !r.played);

/** Time chip (single) AND competition chips (any of them; none = all). */
export function filterRows(rows: readonly FixtureRow[], when: When, types: readonly CareerFixtureType[]): FixtureRow[] {
  return rows.filter((r) => matchesWhen(r, when) && (!types.length || types.includes(r.fixture.type)));
}

/** How many fixtures each competition chip would show under the current time chip. */
export function typeCounts(rows: readonly FixtureRow[], when: When): Record<CareerFixtureType, number> {
  const out = Object.fromEntries(TYPE_CHIPS.map((c) => [c.id, 0])) as Record<CareerFixtureType, number>;
  for (const r of rows) if (matchesWhen(r, when)) out[r.fixture.type] = (out[r.fixture.type] ?? 0) + 1;
  return out;
}

/** Agenda sections by month (yyyy-mm), in date order. */
export function groupByMonth(rows: readonly FixtureRow[]): { month: string; rows: FixtureRow[] }[] {
  const out: { month: string; rows: FixtureRow[] }[] = [];
  for (const r of rows) {
    const m = r.fixture.date.slice(0, 7);
    const last = out[out.length - 1];
    if (last && last.month === m) last.rows.push(r); else out.push({ month: m, rows: [r] });
  }
  return out;
}

// ---------------------------------------------------------------------------
// WLD-06a: the pre-season board -- days until league kickoff, as slots
// ---------------------------------------------------------------------------

export interface PreseasonDay {
  date: string;
  fixtures: CareerFixture[];
  events: PreseasonEvent[];
  /** Nothing booked and no match: a friendly, camp or tournament can start here. */
  free: boolean;
}
export interface PreseasonWeek { weekStart: string; days: PreseasonDay[] }

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function mondayOf(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return addDays(iso, -((d.getUTCDay() + 6) % 7));
}

/** Empty when the league has kicked off (the board only exists in pre-season). Weeks are Monday-first; days before today or from kickoff on are left out. */
export function preseasonBoard(state: CareerState, maxWeeks = 12): PreseasonWeek[] {
  const start = state.gameDate;
  const end = state.leagueKickoffDate;
  if (!end || start >= end) return [];
  const me = state.playerClubId;
  const events = preseasonEvents(state);
  const weeks: PreseasonWeek[] = [];
  for (let w = mondayOf(start); w < end && weeks.length < maxWeeks; w = addDays(w, 7)) {
    const days: PreseasonDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(w, i);
      if (date < start || date >= end) continue;
      const fixtures = state.fixtures.filter((f) => f.date === date && (f.homeClubId === me || f.awayClubId === me));
      const ev = events.filter((e) => e.startDate <= date && date <= e.endDate);
      days.push({ date, fixtures, events: ev, free: !fixtures.length && !ev.length });
    }
    if (days.length) weeks.push({ weekStart: w, days });
  }
  return weeks;
}
