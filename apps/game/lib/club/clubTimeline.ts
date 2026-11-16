// Arena Nights -- club story timeline (CLB-02a B) and head-to-head (CLB-04 C, CLB-01c C).
// Pure read-only views over fixtures/results (live season and the archived seasons), completed transfers
// and season history. Shared by the own club journal and every other club's portrait.
import type { CareerFixture, CareerState } from "../career/types";
import { managementPlayers } from "../career/management";
import { getClub } from "../game-data";

export type StoryKind = "match" | "transfer" | "season";
export const STORY_FILTERS: readonly { id: "all" | StoryKind; label: string }[] = [
  { id: "all", label: "Allt" },
  { id: "match", label: "Matcher" },
  { id: "transfer", label: "Övergångar" },
  { id: "season", label: "Säsonger" },
];

export interface StoryMatch { kind: "match"; id: string; date: string; fixtureId: string; opponentId: string; home: boolean; goalsFor: number; goalsAgainst: number; outcome: "W" | "D" | "L"; competitionId: string; seasonId: string; live: boolean }
export interface StoryTransfer { kind: "transfer"; id: string; date: string; playerId: string; playerName: string; direction: "in" | "out"; otherClubId: string | null; feeEur: number; loan: boolean }
export interface StorySeason { kind: "season"; id: string; date: string; seasonId: string; position: number | null; teams: number; honours: string[] }
export type StoryItem = StoryMatch | StoryTransfer | StorySeason;
export interface StoryMonth { key: string; label: string; items: StoryItem[] }

const MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
export const monthLabel = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1] ?? key} ${key.slice(0, 4)}`;

function matchesOf(fixtures: readonly CareerFixture[], results: Readonly<Record<string, { homeGoals: number; awayGoals: number }>>, clubId: string, seasonId: string, live: boolean): StoryMatch[] {
  return fixtures.filter((f) => (f.homeClubId === clubId || f.awayClubId === clubId) && results[f.id]).map((f) => {
    const r = results[f.id]!;
    const home = f.homeClubId === clubId;
    const gf = home ? r.homeGoals : r.awayGoals, ga = home ? r.awayGoals : r.homeGoals;
    return { kind: "match", id: `m:${f.id}`, date: f.date, fixtureId: f.id, opponentId: home ? f.awayClubId : f.homeClubId, home, goalsFor: gf, goalsAgainst: ga, outcome: gf > ga ? "W" : gf < ga ? "L" : "D", competitionId: f.competitionId, seasonId, live };
  });
}

/** Every played match of the club: archived seasons first, then the live one (oldest first). */
export function clubMatches(state: CareerState, clubId: string): StoryMatch[] {
  const archived = (state.seasonHistory ?? []).flatMap((h) => (h.fixtures && h.results ? matchesOf(h.fixtures, h.results, clubId, h.seasonId, false) : []));
  const seen = new Set(archived.map((m) => m.fixtureId));
  const live = matchesOf(state.fixtures, state.results, clubId, state.seasonId, true).filter((m) => !seen.has(m.fixtureId));
  return [...archived, ...live].sort((a, b) => a.date.localeCompare(b.date) || a.fixtureId.localeCompare(b.fixtureId));
}

export function honoursOf(outcome: { champion?: string; cupWinner?: string; promoted: string[]; relegated: string[] } | undefined, clubId: string): string[] {
  if (!outcome) return [];
  const out: string[] = [];
  if (outcome.champion === clubId) out.push("Svenska mästare");
  if (outcome.cupWinner === clubId) out.push("Svenska cupen");
  if (outcome.promoted.includes(clubId)) out.push("Uppflyttning");
  if (outcome.relegated.includes(clubId)) out.push("Nedflyttning");
  return out;
}

/** CLB-02a B: matches, transfers and season ends in one chronology, newest month first. */
export function clubStory(state: CareerState, clubId: string, filter: "all" | StoryKind = "all"): StoryMonth[] {
  const items: StoryItem[] = [];
  if (filter === "all" || filter === "match") items.push(...clubMatches(state, clubId));
  if (filter === "all" || filter === "transfer") {
    const names = new Map(managementPlayers(state).map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    for (const o of Object.values(state.transferOffers)) {
      if (o.status !== "COMPLETED" || (o.fromClubId !== clubId && o.toClubId !== clubId)) continue;
      const incoming = o.toClubId === clubId;
      items.push({ kind: "transfer", id: `t:${o.id}`, date: o.resolvedDate ?? o.scheduledCompletionDate ?? o.offeredDate, playerId: o.playerId, playerName: names.get(o.playerId) ?? "Okänd spelare", direction: incoming ? "in" : "out", otherClubId: (incoming ? o.fromClubId : o.toClubId) || null, feeEur: o.transferFeeEur, loan: !!o.loanTerms });
    }
  }
  if (filter === "all" || filter === "season") {
    for (const h of state.seasonHistory ?? []) {
      const table = Object.values(h.tables ?? {}).find((t) => t.some((r) => r.clubId === clubId)) ?? (h.table.some((r) => r.clubId === clubId) ? h.table : undefined);
      if (!table) continue;
      const i = table.findIndex((r) => r.clubId === clubId);
      items.push({ kind: "season", id: `s:${h.seasonId}`, date: `${Number(h.seasonId.slice(0, 4)) + 1}-05-31`, seasonId: h.seasonId, position: i + 1, teams: table.length, honours: honoursOf(h.outcome, clubId) });
    }
  }
  items.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const months: StoryMonth[] = [];
  for (const item of items) {
    const key = item.date.slice(0, 7);
    const last = months.at(-1);
    if (last?.key === key) last.items.push(item);
    else months.push({ key, label: monthLabel(key), items: [item] });
  }
  return months;
}

export interface HeadToHead {
  played: number; won: number; drawn: number; lost: number; goalsFor: number; goalsAgainst: number;
  /** Newest first, at most five. */
  recent: StoryMatch[];
  next: { fixtureId: string; date: string; home: boolean } | null;
}

/** Your club against another club: every played meeting the save remembers, and the next booked one. */
export function headToHead(state: CareerState, clubId: string, ownClubId: string = state.playerClubId): HeadToHead {
  const games = clubMatches(state, ownClubId).filter((m) => m.opponentId === clubId);
  const next = state.fixtures.filter((f) => !state.results[f.id] && f.date >= state.gameDate && ((f.homeClubId === ownClubId && f.awayClubId === clubId) || (f.awayClubId === ownClubId && f.homeClubId === clubId))).sort((a, b) => a.date.localeCompare(b.date))[0];
  return {
    played: games.length,
    won: games.filter((g) => g.outcome === "W").length,
    drawn: games.filter((g) => g.outcome === "D").length,
    lost: games.filter((g) => g.outcome === "L").length,
    goalsFor: games.reduce((n, g) => n + g.goalsFor, 0),
    goalsAgainst: games.reduce((n, g) => n + g.goalsAgainst, 0),
    recent: games.slice(-5).reverse(),
    next: next ? { fixtureId: next.id, date: next.date, home: next.homeClubId === ownClubId } : null,
  };
}

export const clubShort = (id: string | null | undefined) => (id ? getClub(id)?.shortName ?? id : "Fri agent");
