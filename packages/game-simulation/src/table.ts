export type CompletedResult = {
  homeClubId: string;
  awayClubId: string;
  homeGoals: number;
  awayGoals: number;
};

export type PointsRule = {
  win: number;
  draw: number;
  loss: number;
};

/** The mock Swedish Allsvenskan model per the HM-GAME-0.2A brief: win=2, draw=1, loss=0. */
export const ALLSVENSKAN_POINTS_RULE: PointsRule = { win: 2, draw: 1, loss: 0 };

export type StandingRow = {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};

function emptyRow(clubId: string): StandingRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 };
}

/**
 * Computes the full standings table from scratch given every completed
 * result for the competition -- never mutates/accumulates onto a
 * previous table, so it is safe to call repeatedly (including twice for
 * the same set of results) without double-counting, per the
 * HM-GAME-0.2A brief's "no duplicate simulation" regression requirement.
 */
export function computeStandings(
  clubIds: readonly string[],
  results: readonly CompletedResult[],
  pointsRule: PointsRule = ALLSVENSKAN_POINTS_RULE,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  for (const id of clubIds) {
    rows.set(id, emptyRow(id));
  }

  for (const result of results) {
    const home = rows.get(result.homeClubId) ?? emptyRow(result.homeClubId);
    const away = rows.get(result.awayClubId) ?? emptyRow(result.awayClubId);

    home.played += 1;
    away.played += 1;
    home.goalsFor += result.homeGoals;
    home.goalsAgainst += result.awayGoals;
    away.goalsFor += result.awayGoals;
    away.goalsAgainst += result.homeGoals;

    if (result.homeGoals > result.awayGoals) {
      home.won += 1;
      home.points += pointsRule.win;
      away.lost += 1;
      away.points += pointsRule.loss;
    } else if (result.homeGoals < result.awayGoals) {
      away.won += 1;
      away.points += pointsRule.win;
      home.lost += 1;
      home.points += pointsRule.loss;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += pointsRule.draw;
      away.points += pointsRule.draw;
    }

    home.goalDifference = home.goalsFor - home.goalsAgainst;
    away.goalDifference = away.goalsFor - away.goalsAgainst;

    rows.set(result.homeClubId, home);
    rows.set(result.awayClubId, away);
  }

  // Deterministic tiebreak: points -> goal difference -> goals scored
  // -> clubId (final alphabetical tiebreak purely to make ordering
  // fully deterministic when every prior criterion is tied, e.g. two
  // clubs with identical records before either has played -- avoids
  // relying on JS's stable-sort-of-insertion-order as an implicit,
  // undocumented tiebreak).
  return [...rows.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return a.clubId.localeCompare(b.clubId);
  });
}
