import type { CompetitionRules, LeagueTableInput, RankGroup, Standing } from "./types";

const compare = (a: Standing, b: Standing) => b.points-a.points || b.goalDifference-a.goalDifference || b.goalsFor-a.goalsFor;
const alphabetic = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort(alphabetic).every((id,i) => id === [...b].sort(alphabetic)[i]);

/** Re-ranks raw totals. Neither incoming row order, club ID nor a hash can award a sporting place. */
export function rankCompletedTable(table: LeagueTableInput, rules: CompetitionRules): RankGroup[] {
  const rows = [...table.rows].sort((a,b) => compare(a,b) || alphabetic(a.clubId,b.clubId));
  const groups: RankGroup[] = [];
  for (let start = 0; start < rows.length;) {
    let end = start+1;
    while (end < rows.length && compare(rows[start]!,rows[end]!) === 0) end++;
    const tied = rows.slice(start,end).map((r) => r.clubId);
    const ranks = tied.map((_,i) => start+i+1);
    if (tied.length === 1) groups.push({ ranks, clubIds: tied });
    else {
      let order: readonly string[] | undefined;
      let reason: RankGroup["reason"] = tied.length > 2 ? "MULTIWAY_RULING_REQUIRED" : "MISSING_MUTUAL_RESULTS";
      if (tied.length === 2) {
        const mutual = (table.mutualResults ?? []).filter((r) => tied.includes(r.homeClubId) && tied.includes(r.awayClubId));
        const league = rules.leagues.find((l) => l.id === table.competitionId)!;
        if (mutual.length === league.legs && new Set(mutual.map((r) => r.homeClubId)).size === 2) {
          let points = 0, difference = 0;
          for (const r of mutual) {
            const delta = (r.homeGoals-r.awayGoals) * (r.homeClubId === tied[0] ? 1 : -1);
            difference += delta;
            points += delta > 0 ? rules.points.win-rules.points.loss : delta < 0 ? rules.points.loss-rules.points.win : 0;
          }
          const delta = points || difference;
          if (delta) order = delta > 0 ? tied : [...tied].reverse();
          else reason = "NEUTRAL_MATCH_REQUIRED";
        }
      }
      const decision = table.rankingDecisions?.find((d) => sameIds(d.orderedClubIds,tied));
      // A neutral match cannot invent a full three-way ranking. Only an explicit organizer ruling can.
      if (!order && decision?.evidence.trim() && (decision.kind === "ORGANIZER_RULING" || reason === "NEUTRAL_MATCH_REQUIRED")) order = decision.orderedClubIds;
      if (order) order.forEach((id,i) => groups.push({ ranks: [start+i+1], clubIds: [id] }));
      else groups.push({ ranks, clubIds: [...tied].sort(alphabetic), reason });
    }
    start = end;
  }
  return groups;
}
