// HM-ALPHA3-M03: league tables per competition with the verified Swedish
// tiebreakers (TB §2:7): points, goal difference, goals scored, then
// head-to-head. Only LEAGUE fixtures of that competition count.
import { computeStandings, type StandingRow } from "@handball-manager/game-simulation";
import type { CareerState } from "../career/types";
import { CLUBS } from "../game-data";
import { LEAGUE_RULES } from "./rules";

function hashRank(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The clubs playing in `competitionId` this season: membership overrides first, then the static league for clubs without one. */
export function competitionClubIds(state: Pick<CareerState, "competitionMembership">, competitionId: string): string[] {
  const overrides = state.competitionMembership ?? {};
  return CLUBS.filter((c) => (overrides[c.id] ?? c.competitionId) === competitionId).map((c) => c.id);
}

export function competitionTable(state: CareerState, competitionId: string): StandingRow[] {
  const fixtures = state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === competitionId);
  const clubIds = [...new Set([...competitionClubIds(state, competitionId), ...fixtures.flatMap((f) => [f.homeClubId, f.awayClubId])])].filter((id) => fixtures.length === 0 || fixtures.some((f) => f.homeClubId === id || f.awayClubId === id));
  const results = fixtures.map((f) => state.results[f.id]).filter((r) => r !== undefined).map((r) => ({ homeClubId: r.homeClubId, awayClubId: r.awayClubId, homeGoals: r.homeGoals, awayGoals: r.awayGoals }));
  const rows = computeStandings(clubIds, results, LEAGUE_RULES.points);
  return applyHeadToHead(rows, results, `${state.saveSeed}:${state.seasonId}:${competitionId}`);
}

/** Re-orders clubs level on points, goal difference and goals scored by their mutual results (mini-table), then a seeded lot. */
function applyHeadToHead(rows: StandingRow[], results: { homeClubId: string; awayClubId: string; homeGoals: number; awayGoals: number }[], seed: string): StandingRow[] {
  const out: StandingRow[] = [];
  for (let i = 0; i < rows.length; ) {
    let j = i + 1;
    while (j < rows.length && rows[j]!.points === rows[i]!.points && rows[j]!.goalDifference === rows[i]!.goalDifference && rows[j]!.goalsFor === rows[i]!.goalsFor) j++;
    const group = rows.slice(i, j);
    if (group.length > 1) {
      const ids = new Set(group.map((r) => r.clubId));
      const mini = computeStandings([...ids], results.filter((r) => ids.has(r.homeClubId) && ids.has(r.awayClubId)), LEAGUE_RULES.points);
      const order = new Map(mini.map((m, k) => [m.clubId, { m, k }]));
      group.sort((a, b) => {
        const ma = order.get(a.clubId)!.m, mb = order.get(b.clubId)!.m;
        if (mb.points !== ma.points) return mb.points - ma.points;
        if (mb.goalDifference !== ma.goalDifference) return mb.goalDifference - ma.goalDifference;
        if (mb.goalsFor !== ma.goalsFor) return mb.goalsFor - ma.goalsFor;
        return hashRank(`${seed}:${a.clubId}`) - hashRank(`${seed}:${b.clubId}`);
      });
    }
    out.push(...group);
    i = j;
  }
  return out;
}

/** Unplayed league fixtures left in a competition. */
export function remainingLeagueFixtures(state: CareerState, competitionId: string): number {
  return state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === competitionId && !state.results[f.id]).length;
}

export function hasLeagueCalendar(state: CareerState, competitionId: string): boolean {
  return state.fixtures.some((f) => f.type === "LEAGUE" && f.competitionId === competitionId);
}
