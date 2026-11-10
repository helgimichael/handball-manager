import { getClub } from "../game-data";
﻿import { addDays, daysBetween } from '../career/dateUtils';
import type { CareerFixture, CareerState } from '../career/types';
import { nationalBreaks } from '../nationalTeam/nationalTeam';
import { SVENSKA_CUPEN } from './rules';
import type { TieStage } from './types';

/** Date-level gameplay rule: >=2 days between kickoffs, not an official rest regulation. */
export const CUP_SCHEDULING_RULES = { minimumRestDays: 2, leagueMoveRadiusDays: 7 } as const;
export interface CupDateWindow { start: string; end: string }
export interface CupDateProfile {
  seasonId: string;
  provenance: 'PUBLISHED_2026_27' | 'PROVISIONAL_FUTURE' | 'LEGACY_SAVE';
  rounds: Partial<Record<TieStage, readonly CupDateWindow[]>>;
}
export const CUP_DATE_SOURCES = [
  'https://handbollsligan.se/herrligan/har-ar-herrarnas-cupschema/',
  'https://www.svenskhandboll.se/nyheter/svenska-cupen/2026-11-04-klart-har-spelas-finalerna-i-svenska-cupen',
] as const;

/** Future dates are explicit game slots, not claims about future official schedules. */
export function cupDateProfile(seasonId: string, legacy = false): CupDateProfile {
  const y = Number(seasonId.slice(0, 4));
  const w = (start: string, end = start, nextYear = false): CupDateWindow => ({ start: `${y + Number(nextYear)}-${start}`, end: `${y + Number(nextYear)}-${end}` });
  if (legacy) return { seasonId, provenance: 'LEGACY_SAVE', rounds: {
    CUP_GROUP: [w('08-26', '09-02'), w('09-02', '09-09'), w('09-09', '09-16')],
    CUP_R16: [w('10-21', '10-24'), w('10-28', '10-31')],
    CUP_QF: [w('12-02', '12-05'), w('12-09', '12-12')],
    CUP_SF: [w('03-06', '03-08', true)], CUP_F: [w('03-12', '03-15', true)], CUP_3RD: [w('03-12', '03-15', true)],
  } };
  return { seasonId, provenance: seasonId === '2026/27' ? 'PUBLISHED_2026_27' : 'PROVISIONAL_FUTURE', rounds: {
    // Game leg allocations inside the published 20–30 August period (published returns include 26 August). These are not the historical draw.
    CUP_R32: [w('08-20', '08-26'), w('08-26', '08-30')],
    CUP_R16: [w('09-05', '09-06'), w('09-12', '09-13')],
    CUP_QF: [w('09-16')], CUP_SF: [w('09-20')], CUP_F: [w('02-27', '02-27', true)],
  } };
}

export class CalendarSchedulingError extends Error {
  constructor(readonly fixtureId: string, readonly window: CupDateWindow, readonly conflicts: readonly string[]) {
    super(`Kalenderkonflikt: matchen kan inte spelas ${window.start}–${window.end} med minst ${CUP_SCHEDULING_RULES.minimumRestDays} dagar mellan matcher. ${conflicts.join(', ')}`);
    this.name = 'CalendarSchedulingError';
  }
}
const sharesClub = (a: CareerFixture, b: CareerFixture) => a.homeClubId === b.homeClubId || a.homeClubId === b.awayClubId || a.awayClubId === b.homeClubId || a.awayClubId === b.awayClubId;
const restConflict = (a: CareerFixture, b: CareerFixture, rest: number) => a.id !== b.id && sharesClub(a, b) && Math.abs(daysBetween(a.date, b.date)) < rest;
const inBreak = (date: string) => nationalBreaks().some(b => date >= b.start && date <= b.end);
export const earliestUnprocessedFixtureDate = (s: Pick<CareerState, 'gameDate' | 'processedThroughDate'>) => s.processedThroughDate < s.gameDate ? s.gameDate : addDays(s.gameDate, 2);

function windowFor(state: CareerState, f: CareerFixture): CupDateWindow {
  const tie = f.stage && state.competitionTies?.[f.stage.tieId];
  const legacy = Object.values(state.competitionTies ?? {}).some(t => t.competitionId === SVENSKA_CUPEN && t.stage === 'CUP_GROUP');
  const windows = tie && cupDateProfile(state.seasonId, legacy).rounds[tie.stage];
  const window = windows?.[(f.stage?.game ?? 1) - 1];
  if (!window) throw new CalendarSchedulingError(f.id, { start: f.date, end: f.date }, ['Datumprofil saknas för omgången.']);
  return window;
}

/** Atomic bounded planning. Played fixtures and their results are never moved. */
export function scheduleCupFixtures(state: CareerState, additions: readonly CareerFixture[], minimumRestDays: number = CUP_SCHEDULING_RULES.minimumRestDays): CareerState {
  const ids = new Set(additions.filter(f => !state.results[f.id]).map(f => f.id));
  let fixtures = state.fixtures.filter(f => !ids.has(f.id));
  const earliest = earliestUnprocessedFixtureDate(state);
  for (const fixture of additions) {
    if (state.results[fixture.id]) continue;
    const window = windowFor(state, fixture);
    const candidates: string[] = [];
    for (let date = window.start; date <= window.end; date = addDays(date, 1)) if (date >= earliest && !inBreak(date)) candidates.push(date);
    // Keep an existing unplayed fixture in place if it already has a valid slot.
    if (candidates.includes(fixture.date)) candidates.splice(0, 0, ...candidates.splice(candidates.indexOf(fixture.date), 1));
    let planned: CareerFixture[] | undefined;
    let conflicts: string[] = [];
    for (const date of candidates) {
      const cup = { ...fixture, date };
      let trial = [...fixtures];
      let possible = true;
      const busy = trial.filter(f => restConflict(cup, f, minimumRestDays));
      conflicts = busy.map(f => `${getClub(f.homeClubId)?.shortName ?? "Hemmalaget"} – ${getClub(f.awayClubId)?.shortName ?? "Bortalaget"} (${f.date})`);
      for (const other of busy) {
        if (other.type !== 'LEAGUE' || state.results[other.id] || other.date < earliest) { possible = false; break; }
        const anchor = other.originalDate ?? other.date;
        const dates: string[] = [anchor];
        for (let n = 1; n <= CUP_SCHEDULING_RULES.leagueMoveRadiusDays; n++) dates.push(addDays(anchor, n), addDays(anchor, -n));
        const moved = dates.find(d => d >= earliest && !inBreak(d) && !restConflict({ ...other, date: d }, cup, minimumRestDays) && trial.every(f => !restConflict({ ...other, date: d }, f, minimumRestDays)));
        if (!moved) { possible = false; break; }
        trial = trial.map(f => f.id === other.id ? { ...f, date: moved, originalDate: anchor, scheduleNote: 'Flyttad i spelet för cupens fasta speldag och matchvila.' } : f);
      }
      if (possible) { planned = [...trial, cup]; break; }
    }
    if (!planned) throw new CalendarSchedulingError(fixture.id, window, conflicts.length ? conflicts : ['Inget återstående tillåtet datum.']);
    fixtures = planned;
  }
  const next = { ...state, fixtures };
  validateCupCalendar(next, minimumRestDays);
  return next;
}

/** Only future/unplayed state is constrained; historical real or simulated results stay intact. */
export function validateCupCalendar(state: CareerState, minimumRestDays: number = CUP_SCHEDULING_RULES.minimumRestDays): void {
  const seen = new Set<string>();
  for (const f of state.fixtures) {
    if (seen.has(f.id)) throw new CalendarSchedulingError(f.id, { start: f.date, end: f.date }, ['Dubbelt match-id.']);
    seen.add(f.id);
    if (f.competitionId !== SVENSKA_CUPEN) continue;
    if (!state.results[f.id]) {
      if (f.date < state.gameDate) throw new CalendarSchedulingError(f.id, { start: f.date, end: f.date }, ['Ospelad match ligger före aktuell karriärdag.']);
      const window = windowFor(state, f);
      if (f.date < window.start || f.date > window.end) throw new CalendarSchedulingError(f.id, window, ['Matchen ligger utanför omgångens datum.']);
    }
    for (const other of state.fixtures) if ((!state.results[f.id] || !state.results[other.id]) && restConflict(f, other, minimumRestDays)) {
      throw new CalendarSchedulingError(f.id, { start: f.date, end: f.date }, [`${other.id} (${other.date})`]);
    }
  }
}

/** Repair only unplayed cup dates in an old save, keeping its existing format, legs and home/away. */
export function ensureCupCalendar(state: CareerState): CareerState {
  try { validateCupCalendar(state); return state; }
  catch (error) {
    if (!(error instanceof CalendarSchedulingError)) throw error;
    const pending = state.fixtures.filter(f => f.competitionId === SVENSKA_CUPEN && !state.results[f.id]).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    return scheduleCupFixtures(state, pending);
  }
}
