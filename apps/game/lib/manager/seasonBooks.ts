// Arena Nights MGR-02 C "Season Books" and MGR-02a A "Season Timeline": every
// finished season as a book cover -- final position, honours, top scorer, the
// best and worst match, the board verdict and the reputation change -- built
// only from the archived seasonHistory entry and the manager's stint records.
// Read-only: archives are never changed.
import type { StandingRow } from "@handball-manager/game-simulation";
import type { ManagerCareerState, ManagerStintSeason } from "../board/types";
import type { CareerFixture, CareerState } from "../career/types";
import type { SeasonAward } from "../competition/types";

export type SeasonHistoryEntry = NonNullable<CareerState["seasonHistory"]>[number];

export interface BookMatch {
  fixtureId: string;
  opponentId: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  date: string;
  type: CareerFixture["type"];
}

export interface SeasonBook {
  seasonId: string;
  competitionId: string;
  /** The club the manager led that season (may differ from today's club). */
  clubId: string;
  position: number | null;
  points: number | null;
  played: number | null;
  record: { won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number } | null;
  /** Titles and movements, in Swedish. */
  honours: string[];
  /** True for a title or promotion: gets the honour star. */
  star: boolean;
  topScorer: { playerId: string; goals: number } | null;
  /** League awards won by the manager's club that season. */
  clubAwards: SeasonAward[];
  bestMatch: BookMatch | null;
  worstMatch: BookMatch | null;
  /** Share of the board's objectives met (0-1), when recorded. */
  boardScore: number | null;
  reputationDelta: number | null;
  partial: boolean;
}

function seasonWindow(seasonId: string): [string, string] {
  const y = Number(seasonId.slice(0, 4));
  return [`${y}-07-01`, `${y + 1}-06-30`];
}

/** The club the manager led in a season: the stint that recorded it, else the stint running at season end. */
export function ledClubFor(mc: ManagerCareerState | undefined, seasonId: string, fallback: string): { clubId: string; record?: ManagerStintSeason } {
  const stint = mc?.stints.find((s) => s.seasons.some((x) => x.seasonId === seasonId));
  if (stint) return { clubId: stint.clubId, record: stint.seasons.find((x) => x.seasonId === seasonId) };
  const end = seasonWindow(seasonId)[1];
  return { clubId: mc?.stints.filter((s) => s.from <= end).at(-1)?.clubId ?? fallback };
}

function matchesOf(entry: SeasonHistoryEntry, clubId: string): BookMatch[] {
  const fixtures = entry.fixtures ?? [];
  const results = entry.results ?? {};
  return fixtures.filter((f) => (f.homeClubId === clubId || f.awayClubId === clubId) && results[f.id] && f.type !== "FRIENDLY").map((f) => {
    const r = results[f.id]!;
    const home = r.homeClubId === clubId;
    return { fixtureId: f.id, opponentId: home ? r.awayClubId : r.homeClubId, home, goalsFor: home ? r.homeGoals : r.awayGoals, goalsAgainst: home ? r.awayGoals : r.homeGoals, date: f.date, type: f.type };
  });
}

/** Biggest winning margin (ties broken by goals scored, then the later date); the worst is the heaviest defeat. */
export function bestAndWorst(matches: readonly BookMatch[]): { best: BookMatch | null; worst: BookMatch | null } {
  const margin = (m: BookMatch) => m.goalsFor - m.goalsAgainst;
  const wins = matches.filter((m) => margin(m) > 0).sort((a, b) => margin(b) - margin(a) || b.goalsFor - a.goalsFor || b.date.localeCompare(a.date));
  const losses = matches.filter((m) => margin(m) < 0).sort((a, b) => margin(a) - margin(b) || a.goalsFor - b.goalsFor || b.date.localeCompare(a.date));
  return { best: wins[0] ?? null, worst: losses[0] ?? null };
}

function rowOf(table: readonly StandingRow[], clubId: string) {
  const i = table.findIndex((r) => r.clubId === clubId);
  return i >= 0 ? { row: table[i]!, position: i + 1 } : null;
}

export function buildSeasonBook(entry: SeasonHistoryEntry, mc: ManagerCareerState | undefined, fallbackClubId: string): SeasonBook {
  const { clubId, record } = ledClubFor(mc, entry.seasonId, fallbackClubId);
  const competitionId = record?.competitionId ?? Object.entries(entry.tables ?? {}).find(([, t]) => t.some((r) => r.clubId === clubId))?.[0] ?? entry.competitionId;
  const table = entry.tables?.[competitionId] ?? entry.table;
  const found = rowOf(table, clubId);
  const o = entry.outcome;
  const honours = [...(record?.honours ?? [])];
  const add = (h: string) => { if (!honours.includes(h)) honours.push(h); };
  if (o?.champion === clubId) add("Svenska mästare");
  if (o?.cupWinner === clubId) add("Svenska cupen");
  if (o?.regularSeasonWinners && Object.values(o.regularSeasonWinners).includes(clubId)) add("Seriesegrare");
  if (o?.promoted.includes(clubId)) add("Uppflyttning");
  if (o?.relegated.includes(clubId)) add("Nedflyttning");
  const star = !!(o && (o.champion === clubId || o.cupWinner === clubId || o.promoted.includes(clubId))) || (record?.honours.length ?? 0) > 0;

  const scorers = Object.values(entry.stats ?? {}).filter((s) => s.goals > 0).sort((a, b) => b.goals - a.goals);
  const leagueTop = o?.awards.find((a) => a.id === "TOP_SCORER" && a.competitionId === competitionId);
  const top = leagueTop ? { playerId: leagueTop.playerId, goals: entry.stats?.[leagueTop.playerId]?.goals ?? (Number.parseInt(leagueTop.value, 10) || 0) } : scorers[0] ? { playerId: scorers[0].playerId, goals: scorers[0].goals } : null;

  const { best, worst } = bestAndWorst(matchesOf(entry, clubId));
  const [from, to] = seasonWindow(entry.seasonId);
  const changes = (mc?.reputationLog ?? []).filter((r) => r.date >= from && r.date <= to);

  return {
    seasonId: entry.seasonId,
    competitionId,
    clubId,
    position: found?.position ?? record?.position ?? null,
    points: found?.row.points ?? null,
    played: found?.row.played ?? null,
    record: found ? { won: found.row.won, drawn: found.row.drawn, lost: found.row.lost, goalsFor: found.row.goalsFor, goalsAgainst: found.row.goalsAgainst } : null,
    honours,
    star,
    topScorer: top,
    clubAwards: (o?.awards ?? []).filter((a) => a.clubId === clubId && a.id !== "ALL_STAR"),
    bestMatch: best,
    worstMatch: worst,
    boardScore: record?.objectivesScore ?? null,
    reputationDelta: changes.length ? changes.reduce((n, r) => n + r.delta, 0) : null,
    partial: !!record?.partial,
  };
}

/** Oldest first -- the order of the shelf and the timeline. */
export function buildSeasonBooks(career: Pick<CareerState, "seasonHistory" | "managerCareer" | "playerClubId">): SeasonBook[] {
  return (career.seasonHistory ?? []).map((e) => buildSeasonBook(e, career.managerCareer, career.playerClubId));
}
