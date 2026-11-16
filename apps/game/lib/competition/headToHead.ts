// Arena Nights -- CMP-02 A "Head-to-head card": a tale of the tape for one fixture, derived only from stored
// tables and results (this season and archived seasons). Read-only.
import type { CareerFixture, CareerState, ClubFormEntry } from "../career/types";
import { COMPETITIONS, getClub } from "../game-data";
import { clubCompetitionId } from "../career/competitionMembership";
import { competitionTable, hasLeagueCalendar } from "./tables";

export interface TapeSide { clubId: string; name: string; competition: string | null; position: number | null; teams: number; played: number; points: number | null; goalsForPer: number | null; goalsAgainstPer: number | null; form: ClubFormEntry[] }
export interface TapeMetric { label: string; home: string; away: string; better: "home" | "away" | null }
export interface Meeting { fixtureId: string; seasonId: string; date: string; homeClubId: string; awayClubId: string; score: string; winnerClubId: string | null; current: boolean }
export interface HeadToHead { home: TapeSide; away: TapeSide; metrics: TapeMetric[]; meetings: Meeting[]; record: { homeWins: number; awayWins: number; draws: number } }

function side(state: CareerState, clubId: string): TapeSide {
  const comp = clubCompetitionId(state, clubId) ?? null;
  const table = comp && hasLeagueCalendar(state, comp) ? competitionTable(state, comp) : [];
  const i = table.findIndex((r) => r.clubId === clubId), row = i >= 0 ? table[i]! : undefined;
  const started = !!row && row.played > 0;
  return {
    clubId, name: getClub(clubId)?.name ?? clubId, competition: COMPETITIONS.find((c) => c.id === comp)?.name ?? null,
    position: started ? i + 1 : null, teams: table.length, played: row?.played ?? 0, points: started ? row!.points : null,
    goalsForPer: started ? Math.round((row!.goalsFor / row!.played) * 10) / 10 : null, goalsAgainstPer: started ? Math.round((row!.goalsAgainst / row!.played) * 10) / 10 : null,
    form: (state.clubForm[clubId] ?? []).slice(-5),
  };
}
const formPoints = (f: ClubFormEntry[]) => f.reduce((s, r) => s + (r === "W" ? 2 : r === "D" ? 1 : 0), 0);
function better(a: number | null, b: number | null, lowerIsBetter = false): "home" | "away" | null {
  if (a === null || b === null || a === b) return null;
  return (lowerIsBetter ? a < b : a > b) ? "home" : "away";
}

export function headToHead(state: CareerState, fixture: Pick<CareerFixture, "id" | "homeClubId" | "awayClubId">): HeadToHead {
  const home = side(state, fixture.homeClubId), away = side(state, fixture.awayClubId);
  const n = (v: number | null, suffix = "") => (v === null ? "—" : `${v}${suffix}`);
  const metrics: TapeMetric[] = [
    { label: "Tabellplacering", home: home.position ? `${home.position}/${home.teams}` : "—", away: away.position ? `${away.position}/${away.teams}` : "—", better: home.competition === away.competition ? better(home.position, away.position, true) : null },
    { label: "Poäng", home: n(home.points), away: n(away.points), better: home.competition === away.competition ? better(home.points, away.points) : null },
    { label: "Gjorda mål / match", home: n(home.goalsForPer), away: n(away.goalsForPer), better: better(home.goalsForPer, away.goalsForPer) },
    { label: "Insläppta mål / match", home: n(home.goalsAgainstPer), away: n(away.goalsAgainstPer), better: better(home.goalsAgainstPer, away.goalsAgainstPer, true) },
    { label: "Form · poäng senaste 5", home: home.form.length ? String(formPoints(home.form)) : "—", away: away.form.length ? String(formPoints(away.form)) : "—", better: home.form.length && away.form.length ? better(formPoints(home.form), formPoints(away.form)) : null },
  ];
  const pair = (f: { homeClubId: string; awayClubId: string }) => (f.homeClubId === fixture.homeClubId && f.awayClubId === fixture.awayClubId) || (f.homeClubId === fixture.awayClubId && f.awayClubId === fixture.homeClubId);
  const meetings: Meeting[] = [];
  const add = (f: CareerFixture, r: { homeGoals: number; awayGoals: number; decider?: { winnerClubId: string } }, seasonId: string, current: boolean) => {
    if (f.id === fixture.id || !pair(f)) return;
    meetings.push({ fixtureId: f.id, seasonId, date: f.date, homeClubId: f.homeClubId, awayClubId: f.awayClubId, score: `${r.homeGoals}–${r.awayGoals}`, winnerClubId: r.decider?.winnerClubId ?? (r.homeGoals > r.awayGoals ? f.homeClubId : r.awayGoals > r.homeGoals ? f.awayClubId : null), current });
  };
  for (const f of state.fixtures) { const r = state.results[f.id]; if (r) add(f, r, state.seasonId, true); }
  for (const h of state.seasonHistory ?? []) for (const f of h.fixtures ?? []) { const r = h.results?.[f.id]; if (r) add(f, r, h.seasonId, false); }
  meetings.sort((a, b) => b.date.localeCompare(a.date));
  const record = { homeWins: meetings.filter((m) => m.winnerClubId === fixture.homeClubId).length, awayWins: meetings.filter((m) => m.winnerClubId === fixture.awayClubId).length, draws: meetings.filter((m) => !m.winnerClubId).length };
  return { home, away, metrics, meetings, record };
}
