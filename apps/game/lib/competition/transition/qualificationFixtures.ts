import type { Dependency, PlannerInput, QualificationStage } from "./types";

export type FixtureResolution = {
  readonly winnerClubId?: string;
  readonly evidence?: string;
  readonly completedFixtureIds: readonly string[];
  readonly decidedGames: readonly number[];
  readonly seriesWins?: Readonly<Record<string, number>>;
  readonly dependencies: readonly Dependency[];
};

/** Resolve supplied scores only. Structural validation is shared with the existing planner. */
export function resolveQualificationFixtures(
  input: PlannerInput,
  stage: QualificationStage,
  participants: readonly string[],
  homeOrder: readonly (0 | 1)[] | null,
): FixtureResolution {
  const fixtures = (input.qualificationFixtures ?? []).filter((f) => f.stageId === stage.id).sort((a,b) => a.game-b.game);
  const completed = fixtures.filter((f) => f.result);
  const dependencies: Dependency[] = [];
  const decidedGames: number[] = [];
  const completedFixtureIds = completed.map((f) => f.id);
  const issue = (code: string, message: string, status: Dependency["status"] = "BLOCKED") => dependencies.push({ code,ref:stage.id,message,status });
  const empty = () => ({ dependencies,completedFixtureIds,decidedGames });
  for (const f of fixtures) {
    if (!participants.includes(f.homeClubId) || !participants.includes(f.awayClubId)) issue("FIXTURE_PARTICIPANTS_MISMATCH",`Fixture ${f.id} does not match selected stage entrants.`);
    if (homeOrder && (f.homeClubId !== participants[homeOrder[f.game-1]!] || f.awayClubId !== participants[1-homeOrder[f.game-1]!])) issue("QUALIFICATION_HOME_MISMATCH",`Fixture ${f.id} violates the verified reference-entrant home pattern. An organizer exception is not modeled.`);
  }
  if (!homeOrder) issue("HOME_PRIORITY_UNVERIFIED","Fixture-based validation cannot certify this stage's home priority; retain the explicit rule blocker.");
  if (dependencies.length) return empty();
  const evidence = completed.map((f) => `${f.id}: ${f.result!.evidence}${f.result!.decider ? `; decider: ${f.result!.decider!.evidence}` : ""}`).join(" | ");
  if (stage.format === "TWO_LEG") {
    if (completed.some((f,i) => f.game !== i+1)) {
      issue("QUALIFICATION_FIXTURE_GAP","Completed legs must start with leg 1; omitted scores are not inferred.","UNRESOLVED");
      return empty();
    }
    if (completed[0]?.result?.decider) issue("INVALID_FIXTURE_DECIDER","A first leg cannot decide an aggregate tie by a terminal decider.");
    if (completed[0] && !dependencies.length) decidedGames.push(1);
    if (dependencies.length || completed.length !== 2) return empty();
    const totals = participants.map((clubId) => completed.reduce((sum,f) => {
      const own = f.homeClubId === clubId ? f.result!.homeGoals : f.result!.awayGoals;
      const other = f.homeClubId === clubId ? f.result!.awayGoals : f.result!.homeGoals;
      return { points:sum.points+(own > other ? input.rules.points.win : own === other ? input.rules.points.draw : input.rules.points.loss),difference:sum.difference+own-other };
    },{ points:0,difference:0 }));
    const delta = totals[0]!.points-totals[1]!.points || totals[0]!.difference-totals[1]!.difference;
    const decider = completed[1]!.result!.decider;
    if (delta && decider) { issue("CONFLICTING_FIXTURE_DECIDER","A terminal decision contradicts the non-level two-leg result."); return empty(); }
    if (!delta && !decider) { issue("AGGREGATE_DECIDER_REQUIRED","Two-leg points and goal difference are tied; an evidenced terminal decision is required. Away goals do not select a winner.","UNRESOLVED"); return empty(); }
    decidedGames.push(2);
    return { ...empty(),winnerClubId:delta ? participants[delta > 0 ? 0 : 1] : decider!.winnerClubId,evidence };
  }
  const wins: Record<string,number> = Object.fromEntries(participants.map((id) => [id,0]));
  const needed = stage.format === "BEST_OF_5" ? 3 : 2;
  let winnerClubId: string | undefined;
  for (const f of completed) {
    if (winnerClubId) { issue("RESULT_AFTER_SERIES_CLINCH",`Completed fixture ${f.id} occurs after an unassailable series lead.`); return empty(); }
    if (f.game !== decidedGames.length+1) { issue("QUALIFICATION_FIXTURE_GAP","Completed fixtures must form a consecutive prefix starting at game 1; omitted scores are not inferred.","UNRESOLVED"); return { ...empty(),seriesWins:{ ...wins } }; }
    const result = f.result!;
    const delta = result.homeGoals-result.awayGoals;
    if (delta && result.decider) { issue("CONFLICTING_FIXTURE_DECIDER",`Fixture ${f.id} has a terminal decision despite a non-level final score.`); return empty(); }
    if (!delta && !result.decider) { issue("MATCH_DECIDER_REQUIRED",`Fixture ${f.id} is drawn. Best-of-three/five matches require an evidenced winner.` ,"UNRESOLVED"); return { ...empty(),seriesWins:{ ...wins } }; }
    const winner = delta ? delta > 0 ? f.homeClubId : f.awayClubId : result.decider!.winnerClubId;
    wins[winner] = wins[winner]!+1;
    decidedGames.push(f.game);
    if (wins[winner] === needed) winnerClubId = winner;
  }
  return { ...empty(),winnerClubId,evidence:winnerClubId ? evidence : undefined,seriesWins:{ ...wins } };
}
