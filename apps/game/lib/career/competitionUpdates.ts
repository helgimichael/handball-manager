// HM-PLAYTEST-01 1.3: which competitions actually produced results today,
// so the inbox can say the right thing about the right competition.
//
// Before this, every day with ANY other-club result (a Svenska Cupen group
// game, the other tier's league round) produced "Tabellen är uppdaterad"
// pointing at the manager's own league -- even when that table had not moved.
import { getCompetition } from "../game-data";
import { SM_SLUTSPEL, SVENSKA_CUPEN } from "../competition/rules";
import { STAGE_LABEL } from "../competition/season";
import type { CompetitionUpdateKind } from "./careerEvents";
import type { CareerState } from "./types";

export type CompetitionUpdate = {
  readonly competitionId: string;
  readonly kind: CompetitionUpdateKind;
  readonly name: string;
  readonly matches: number;
  readonly stage?: string;
  readonly ownLeague: boolean;
};

export function competitionDisplayName(competitionId: string): string {
  if (competitionId === SVENSKA_CUPEN) return "Svenska Cupen";
  if (competitionId === SM_SLUTSPEL) return "SM-slutspelet";
  if (competitionId.startsWith("se-kval")) return "Kvalspelet";
  return getCompetition(competitionId)?.name ?? competitionId;
}

/**
 * The manager's own league always reports; another league only reports
 * when the manager is following it is not modelled, so other tiers stay
 * quiet. Cup and knockout days report under their own name. Friendlies
 * never report.
 */
export function competitionUpdatesFor(state: CareerState, fixtureIds: readonly string[]): CompetitionUpdate[] {
  const byId = new Map(state.fixtures.map((f) => [f.id, f]));
  const groups = new Map<string, { matches: number; stages: Set<string>; type: string }>();
  for (const id of fixtureIds) {
    const fixture = byId.get(id);
    if (!fixture || fixture.type === "FRIENDLY") continue;
    if (fixture.type === "LEAGUE" && fixture.competitionId !== state.competitionId) continue;
    const group = groups.get(fixture.competitionId) ?? { matches: 0, stages: new Set<string>(), type: fixture.type };
    group.matches += 1;
    const tie = fixture.stage ? state.competitionTies?.[fixture.stage.tieId] : undefined;
    if (tie) group.stages.add(STAGE_LABEL[tie.stage]);
    groups.set(fixture.competitionId, group);
  }
  return [...groups].map(([competitionId, g]) => ({
    competitionId,
    kind: g.type === "LEAGUE" ? "LEAGUE" : g.type === "CUP" ? "CUP" : "KNOCKOUT",
    name: competitionDisplayName(competitionId),
    matches: g.matches,
    ...(g.stages.size ? { stage: [...g.stages].join(", ") } : {}),
    ownLeague: competitionId === state.competitionId,
  }));
}
