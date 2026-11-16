// Arena Nights -- CMP-01 A "League Centre" view models (pure, read-only).
// Overview cards for every competition, round progress, home/away/form table views, the own club's gap to
// the nearest verified zone lines (zones only from standingsZones.ts -> rules.ts), round-grouped fixtures
// and results (CMP-01b/c), crest tiles + club Peek (CMP-01e), roll of honour (CMP-01f).
// Nothing here changes a table, a tie-breaker or a transition: official order is always competitionTable().
import type { FastMatchResult, StandingRow } from "@handball-manager/game-simulation";
import type { CareerFixture, CareerState, ClubFormEntry } from "../career/types";
import { COMPETITIONS, getClub } from "../game-data";
import { careerClubsInCompetition, clubCompetitionId } from "../career/competitionMembership";
import { competitionTable, hasLeagueCalendar } from "./tables";
import { zoneFor, type AnnotatedRow, type Zone } from "./standingsZones";
import { SVENSKA_CUPEN, LEAGUE_RULES } from "./rules";
import { STAGE_LABEL } from "./season";
import { managementPlayers } from "../career/management";

const short = (id: string) => getClub(id)?.shortName ?? id;
const leagueFixtures = (state: CareerState, id: string) => state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === id);

// ---------------------------------------------------------------- round progress
export interface RoundProgress { completed: number; total: number; nextRound: number | null; nextRoundDate: string | null }
export function roundProgress(state: CareerState, competitionId: string): RoundProgress {
  const fx = leagueFixtures(state, competitionId);
  const rounds = new Map<number, CareerFixture[]>();
  for (const f of fx) rounds.set(f.round ?? 0, [...(rounds.get(f.round ?? 0) ?? []), f]);
  const done = [...rounds.values()].filter((r) => r.every((f) => state.results[f.id])).length;
  const next = fx.filter((f) => !state.results[f.id]).sort((a, b) => a.date.localeCompare(b.date) || (a.round ?? 0) - (b.round ?? 0))[0];
  return { completed: done, total: rounds.size, nextRound: next?.round ?? null, nextRoundDate: next?.date ?? null };
}

// ---------------------------------------------------------------- table views
export type TableView = "TOTAL" | "HOME" | "AWAY" | "FORM";
export const TABLE_VIEWS: readonly { id: TableView; label: string }[] = [
  { id: "TOTAL", label: "Total" }, { id: "HOME", label: "Hemma" }, { id: "AWAY", label: "Borta" }, { id: "FORM", label: "Form · senaste 5" },
];
export interface ViewRow { clubId: string; played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number; goalDifference: number; points: number; form: ClubFormEntry[] }

/**
 * Home, away and form tables are *views* for reading the season -- the official order (TOTAL) is the
 * competitionTable() with the verified tie-breakers. Views sort by points, goal difference, goals scored.
 */
export function tableView(state: CareerState, competitionId: string, view: Exclude<TableView, "TOTAL">): ViewRow[] {
  const clubs = competitionTable(state, competitionId).map((r) => r.clubId);
  const played = leagueFixtures(state, competitionId).filter((f) => state.results[f.id]).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const { win, draw, loss } = LEAGUE_RULES.points;
  return clubs.map((clubId): ViewRow => {
    let games = played.filter((f) => (view === "HOME" ? f.homeClubId === clubId : view === "AWAY" ? f.awayClubId === clubId : f.homeClubId === clubId || f.awayClubId === clubId));
    if (view === "FORM") games = games.slice(-5);
    const row: ViewRow = { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0, form: [] };
    for (const f of games) {
      const r = state.results[f.id]!, home = f.homeClubId === clubId;
      const gf = home ? r.homeGoals : r.awayGoals, ga = home ? r.awayGoals : r.homeGoals;
      row.played++; row.goalsFor += gf; row.goalsAgainst += ga;
      if (gf > ga) { row.won++; row.points += win; row.form.push("W"); } else if (gf < ga) { row.lost++; row.points += loss; row.form.push("L"); } else { row.drawn++; row.points += draw; row.form.push("D"); }
    }
    row.goalDifference = row.goalsFor - row.goalsAgainst;
    return row;
  }).sort((a, b) => b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor || short(a.clubId).localeCompare(short(b.clubId), "sv"));
}

// ---------------------------------------------------------------- own club: gap to the zone lines
export interface ZoneLine { /** Last position above the line. */ after: number; label: string; tone: Zone["tone"] | "neutral"; gap: number; clubIds: [string, string] }
export interface OwnClubCentre {
  position: number; points: number; zone: Zone | null;
  above: ZoneLine | null; below: ZoneLine | null;
  next: { fixtureId: string; opponentId: string; home: boolean; date: string; opponentPosition: number | null }[];
}
/** Every boundary between two different verified zones in the table (positions b | b+1). */
export function zoneLines(competitionId: string, rows: readonly Pick<AnnotatedRow, "position">[]): number[] {
  const out: number[] = [];
  for (let b = 1; b < rows.length; b++) if ((zoneFor(competitionId, b)?.id ?? null) !== (zoneFor(competitionId, b + 1)?.id ?? null)) out.push(b);
  return out;
}
export function ownClubCentre(state: CareerState, competitionId: string, annotated: readonly AnnotatedRow[], clubId = state.playerClubId): OwnClubCentre | null {
  const me = annotated.find((a) => a.row.clubId === clubId);
  if (!me) return null;
  const p = me.position, pts = (pos: number) => annotated[pos - 1]!.row.points;
  const lines = zoneLines(competitionId, annotated);
  const up = [...lines].reverse().find((b) => b < p);
  const down = lines.find((b) => b >= p);
  const label = (zone: Zone | null, fallback: string) => zone?.label ?? fallback;
  const above: ZoneLine | null = up === undefined ? null : (() => { const z = zoneFor(competitionId, up); return { after: up, label: label(z, `Ur ${me.zone?.label.toLowerCase() ?? "zonen"}`), tone: z?.tone ?? "neutral", gap: pts(up) - me.row.points, clubIds: [annotated[up - 1]!.row.clubId, annotated[up]!.row.clubId] }; })();
  const below: ZoneLine | null = down === undefined ? null : (() => { const z = zoneFor(competitionId, down + 1); return { after: down, label: label(z, `Ur ${me.zone?.label.toLowerCase() ?? "zonen"}`), tone: z?.tone ?? "neutral", gap: me.row.points - pts(down + 1), clubIds: [annotated[down - 1]!.row.clubId, annotated[down]!.row.clubId] }; })();
  const position = new Map(annotated.map((a) => [a.row.clubId, a.position]));
  const played = annotated.some((a) => a.row.played > 0);
  const next = state.fixtures.filter((f) => (f.homeClubId === clubId || f.awayClubId === clubId) && !state.results[f.id] && f.date >= state.gameDate && f.type !== "FRIENDLY")
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(0, 3)
    .map((f) => { const home = f.homeClubId === clubId, opponentId = home ? f.awayClubId : f.homeClubId; return { fixtureId: f.id, opponentId, home, date: f.date, opponentPosition: played ? position.get(opponentId) ?? null : null }; });
  return { position: p, points: me.row.points, zone: me.zone, above, below, next };
}

/** Remaining league fixtures that decide a gap: every unplayed game of the clubs on either side of it. */
export function decidingFixtures(state: CareerState, competitionId: string, clubIds: readonly string[]): CareerFixture[] {
  const set = new Set(clubIds);
  return leagueFixtures(state, competitionId).filter((f) => !state.results[f.id] && (set.has(f.homeClubId) || set.has(f.awayClubId))).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------- CMP-01b/c: fixtures and results by round
export interface RoundRow { fixture: CareerFixture; own: boolean; homePosition: number | null; awayPosition: number | null; result: FastMatchResult | null; halfTime: string | null }
export interface RoundGroup { key: string; label: string; dates: string; rows: RoundRow[]; own: boolean }
/** Half-time score from the stored goal timeline, when the result carries one; never estimated. */
export function halfTimeScore(result: Pick<FastMatchResult, "events"> | null | undefined): string | null {
  const goals = (result?.events ?? []).filter((e) => e.type === "GOAL" && e.homeScoreAfter !== undefined && e.awayScoreAfter !== undefined);
  if (!goals.length) return null;
  const firstHalf = goals.filter((e) => e.minute <= 30);
  const last = firstHalf.at(-1);
  return last ? `${last.homeScoreAfter}–${last.awayScoreAfter}` : "0–0";
}
export function fixturesByRound(state: CareerState, competitionId: string, mode: "upcoming" | "played"): RoundGroup[] {
  const table = competitionTable(state, competitionId);
  const live = table.some((r) => r.played > 0);
  const position = new Map(table.map((r, i) => [r.clubId, i + 1]));
  const club = state.playerClubId;
  const fx = state.fixtures.filter((f) => f.competitionId === competitionId && (mode === "played" ? !!state.results[f.id] : !state.results[f.id]));
  const groups = new Map<string, RoundGroup>();
  for (const f of fx) {
    const tie = f.stage ? state.competitionTies?.[f.stage.tieId] : undefined;
    const key = f.type === "LEAGUE" ? `R${String(f.round ?? 0).padStart(3, "0")}` : tie ? `S${tie.stage}:${tie.stage === "CUP_GROUP" ? f.date : ""}` : `D${f.date}`;
    const label = f.type === "LEAGUE" ? `Omgång ${f.round}` : tie ? STAGE_LABEL[tie.stage] : f.type === "CUP" ? "Cupmatcher" : f.type === "PLAYOFF" ? "Slutspel" : f.type === "QUALIFIER" ? "Kval" : "Träningsmatcher";
    const g = groups.get(key) ?? { key, label, dates: "", rows: [], own: false };
    const result = state.results[f.id] ?? null;
    const own = f.homeClubId === club || f.awayClubId === club;
    g.rows.push({ fixture: f, own, homePosition: live ? position.get(f.homeClubId) ?? null : null, awayPosition: live ? position.get(f.awayClubId) ?? null : null, result, halfTime: halfTimeScore(result) });
    g.own ||= own;
    groups.set(key, g);
  }
  const out = [...groups.values()].map((g) => {
    g.rows.sort((a, b) => Number(b.own) - Number(a.own) || a.fixture.date.localeCompare(b.fixture.date) || (a.fixture.kickoffTime ?? "").localeCompare(b.fixture.kickoffTime ?? "") || a.fixture.id.localeCompare(b.fixture.id));
    const dates = [...new Set(g.rows.map((r) => r.fixture.date))].sort();
    g.dates = dates.length > 1 ? `${dates[0]} – ${dates.at(-1)}` : dates[0] ?? "";
    return g;
  });
  const first = (g: RoundGroup) => g.rows.map((r) => r.fixture.date).sort()[0] ?? "";
  // Upcoming: next round first. Results: latest round first.
  return out.sort((a, b) => (mode === "upcoming" ? first(a).localeCompare(first(b)) : first(b).localeCompare(first(a))) || a.key.localeCompare(b.key));
}

// ---------------------------------------------------------------- CMP-01 overview of all competitions
export interface CompetitionCard {
  id: string; name: string; nation: string; kind: "LEAGUE" | "CUP"; simulated: boolean; own: boolean; clubs: number;
  progress: RoundProgress | null; leader: { clubId: string; points: number } | null;
  ownStatus: string | null; ownPosition: number | null;
}
export interface CompetitionOverview { mine: CompetitionCard[]; sweden: CompetitionCard[]; world: CompetitionCard[] }
export function competitionOverview(state: CareerState): CompetitionOverview {
  const club = state.playerClubId;
  const ownLeague = clubCompetitionId(state, club) ?? state.competitionId;
  const cards = COMPETITIONS.map((c): CompetitionCard => {
    const simulated = hasLeagueCalendar(state, c.id);
    const table = simulated ? competitionTable(state, c.id) : [];
    const started = table.some((r) => r.played > 0);
    const i = table.findIndex((r) => r.clubId === club);
    const own = c.id === ownLeague;
    return {
      id: c.id, name: c.name, nation: c.nation, kind: "LEAGUE", simulated, own, clubs: careerClubsInCompetition(state, c.id).length,
      progress: simulated ? roundProgress(state, c.id) : null, leader: started && table[0] ? { clubId: table[0].clubId, points: table[0].points } : null,
      ownPosition: own && i >= 0 && started ? i + 1 : null,
      ownStatus: own ? (i >= 0 && started ? `${i + 1}:a av ${table.length} · ${table[i]!.points} p` : "Före seriestart") : null,
    };
  });
  const cup = cupCard(state);
  const mine = [...cards.filter((c) => c.own), ...(cup.own ? [cup] : [])];
  const sweden = [...(cup.own ? [] : [cup]), ...cards.filter((c) => !c.own && c.nation === "SWE")].sort((a, b) => Number(b.simulated) - Number(a.simulated));
  const world = cards.filter((c) => !c.own && c.nation !== "SWE");
  return { mine, sweden, world };
}
function cupCard(state: CareerState): CompetitionCard {
  const me = state.playerClubId;
  const ties = Object.values(state.competitionTies ?? {}).filter((t) => t.competitionId === SVENSKA_CUPEN && t.seasonId === state.seasonId);
  const mine = ties.filter((t) => t.clubIds?.includes(me) || t.highClubId === me || t.lowClubId === me);
  const out = mine.find((t) => t.loserClubId === me && t.stage !== "CUP_GROUP");
  const latest = mine.at(-1);
  const status = !ties.length ? "Inte lottad ännu" : !mine.length ? "Din klubb deltar inte" : out ? `Utslagen i ${STAGE_LABEL[out.stage].toLowerCase()}` : latest ? `Med i ${STAGE_LABEL[latest.stage].toLowerCase()}` : null;
  const fixtures = state.fixtures.filter((f) => f.competitionId === SVENSKA_CUPEN);
  return {
    id: SVENSKA_CUPEN, name: "Svenska Cupen", nation: "SWE", kind: "CUP", simulated: fixtures.length > 0 || ties.length > 0, own: mine.length > 0, clubs: new Set(ties.flatMap((t) => [...(t.clubIds ?? []), t.highClubId, t.lowClubId].filter(Boolean))).size,
    progress: null, leader: null, ownPosition: null, ownStatus: status,
  };
}

// ---------------------------------------------------------------- CMP-01e crest tiles + club Peek
export interface ClubTile { clubId: string; name: string; shortName: string; city: string | null; position: number | null; points: number | null; squad: number | null; own: boolean }
export function clubTiles(state: CareerState, competitionId: string): ClubTile[] {
  const table = hasLeagueCalendar(state, competitionId) ? competitionTable(state, competitionId) : [];
  const started = table.some((r) => r.played > 0);
  const pos = new Map(table.map((r, i) => [r.clubId, { position: i + 1, points: r.points }]));
  return careerClubsInCompetition(state, competitionId).map((c) => ({
    clubId: c.id, name: c.name, shortName: c.shortName, city: c.city ?? null, own: c.id === state.playerClubId,
    position: started ? pos.get(c.id)?.position ?? null : null, points: started ? pos.get(c.id)?.points ?? null : null,
    squad: state.worldSquads[c.id]?.length ?? null,
  })).sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.name.localeCompare(b.name, "sv"));
}

export interface ClubPeekModel {
  clubId: string; name: string; shortName: string; city: string | null; competitionId: string | null; competition: string | null;
  position: number | null; teams: number; row: StandingRow | null; form: ClubFormEntry[];
  /** Players by natural position -- counts only; no ratings for clubs the manager does not run. */
  squad: { total: number; byPosition: { position: string; count: number }[] } | null;
  next: { fixtureId: string; opponentId: string; home: boolean; date: string } | null;
  last: { fixtureId: string; opponentId: string; home: boolean; date: string; score: string } | null;
  own: boolean;
}
export function clubPeek(state: CareerState, clubId: string): ClubPeekModel | null {
  const club = getClub(clubId);
  if (!club) return null;
  const competitionId = clubCompetitionId(state, clubId) ?? null;
  const table = competitionId && hasLeagueCalendar(state, competitionId) ? competitionTable(state, competitionId) : [];
  const i = table.findIndex((r) => r.clubId === clubId);
  const started = table.some((r) => r.played > 0);
  const squad = state.worldSquads[clubId];
  const order = ["MV", "V6", "V9", "M9", "M6", "H9", "H6"];
  const mine = (f: CareerFixture) => f.homeClubId === clubId || f.awayClubId === clubId;
  const nextF = state.fixtures.filter((f) => mine(f) && !state.results[f.id] && f.date >= state.gameDate).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))[0];
  const lastF = state.fixtures.filter((f) => mine(f) && state.results[f.id]).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
  const side = (f: CareerFixture) => { const home = f.homeClubId === clubId; return { fixtureId: f.id, opponentId: home ? f.awayClubId : f.homeClubId, home, date: f.date }; };
  return {
    clubId, name: club.name, shortName: club.shortName, city: club.city ?? null, competitionId, competition: COMPETITIONS.find((c) => c.id === competitionId)?.name ?? null,
    position: started && i >= 0 ? i + 1 : null, teams: table.length, row: started && i >= 0 ? table[i]! : null, form: (state.clubForm[clubId] ?? []).slice(-5),
    squad: squad ? { total: squad.length, byPosition: order.map((position) => ({ position, count: squad.filter((p) => p.position === position).length })) } : null,
    next: nextF ? side(nextF) : null,
    last: lastF ? (() => { const r = state.results[lastF.id]!; const s = side(lastF); return { ...s, score: s.home ? `${r.homeGoals}–${r.awayGoals}` : `${r.awayGoals}–${r.homeGoals}` }; })() : null,
    own: clubId === state.playerClubId,
  };
}

// ---------------------------------------------------------------- CMP-01f roll of honour
export interface HonourRow { seasonId: string; championId: string | null; championLabel: string; ownPosition: number | null; teams: number; topScorer: { playerId: string; goals: number } | null; titleWinnerId: string | null }
/** Per finished season of this competition: the table winner (and the SM-guld winner where the archive holds it), your finish, the top scorer of the archived stats. */
export function rollOfHonour(state: CareerState, competitionId: string): HonourRow[] {
  const clubOf = new Map(managementPlayers(state).filter((p) => p.clubId).map((p) => [p.id, p.clubId!]));
  return (state.seasonHistory ?? []).flatMap((h): HonourRow[] => {
    const table = h.tables?.[competitionId] ?? (h.competitionId === competitionId ? h.table : undefined);
    if (!table?.length) return [];
    const winner = h.outcome?.regularSeasonWinners?.[competitionId] ?? table[0]?.clubId ?? null;
    const own = table.findIndex((r) => r.clubId === state.playerClubId);
    const members = new Set(table.map((r) => r.clubId));
    // Archived stats carry no club: a scorer counts for this competition when his club today is one of its clubs that season
    // (players who have since left the world count only for the archive's own competition).
    const inComp = Object.values(h.stats ?? {}).filter((s) => { if (s.goals <= 0) return false; const club = clubOf.get(s.playerId); return club ? members.has(club) : h.competitionId === competitionId; });
    const top = inComp.sort((a, b) => b.goals - a.goals || a.appearances - b.appearances)[0];
    return [{
      seasonId: h.seasonId, championId: winner, championLabel: "Seriesegrare", ownPosition: own >= 0 ? own + 1 : null, teams: table.length,
      topScorer: top ? { playerId: top.playerId, goals: top.goals } : null,
      titleWinnerId: h.outcome?.champion && members.has(h.outcome.champion) ? h.outcome.champion : null,
    }];
  }).reverse();
}
