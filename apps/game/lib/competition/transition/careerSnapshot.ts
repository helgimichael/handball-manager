import { computeStandings } from "@handball-manager/game-simulation";
import { CLUBS } from "../../game-data/clubs";
import { COMPETITIONS } from "../../game-data/competitions";
import type { CareerState } from "../../career/types";
import { SWEDISH_2026_RULES } from "./sweden2026";
import type { CompetitionRules, PlannerInput } from "./types";
import { careerQualificationEvidence } from "./careerQualificationEvidence";

/** Catalog identities only: sporting tier is supplied by the rule package, never catalog tier 2's Division 1 alias. */
export function canonicalCompetitionClubs(): PlannerInput["clubs"] {
  return CLUBS.map((club) => ({ id: club.id, nation: COMPETITIONS.find((c) => c.id === club.competitionId)?.nation ?? "UNKNOWN", category: "MEN" }));
}

/**
 * Optional read-only adapter. Rebuild raw league totals; do not reuse the live table's hash tiebreak,
 * legacy strength-selected SeasonOutcome, or its Division 1 qualification winners.
 * Eligibility, external entrants and concluded graph results must be provided explicitly by the caller.
 */
export function snapshotCompetitionTransitionInput(
  state: Pick<CareerState, "seasonId" | "competitionMembership" | "fixtures" | "results" | "competitionTies">,
  evidence: Pick<PlannerInput, "eligibility" | "qualificationResults" | "qualificationFixtures" | "externalEntrants" | "groupAllocations"> = {},
  rules: CompetitionRules = SWEDISH_2026_RULES,
): PlannerInput {
  return {
    seasonId: state.seasonId, rules, clubs: canonicalCompetitionClubs(),
    ...evidence,
    qualificationFixtures: [...(evidence.qualificationFixtures ?? []), ...careerQualificationEvidence(state,rules).fixtures],
    standings: rules.leagues.flatMap((league) => {
      const fixtures = state.fixtures.filter((f) => f.type === "LEAGUE" && f.competitionId === league.id);
      if (!fixtures.length) return [];
      const clubIds = CLUBS.filter((c) => (state.competitionMembership?.[c.id] ?? c.competitionId) === league.id).map((c) => c.id);
      const results = fixtures.flatMap((f) => {
        const result = state.results[f.id];
        return result && result.homeClubId === f.homeClubId && result.awayClubId === f.awayClubId ? [{ homeClubId: result.homeClubId, awayClubId: result.awayClubId, homeGoals: result.homeGoals, awayGoals: result.awayGoals }] : [];
      });
      const pairs = new Set(fixtures.map((f) => JSON.stringify([f.homeClubId,f.awayClubId])));
      const fullCoverage = clubIds.every((home) => clubIds.every((away) => home === away || pairs.has(JSON.stringify([home,away]))));
      return [{ competitionId: league.id, seasonId: state.seasonId,
        completed: fixtures.length === league.size*(league.size-1) && pairs.size === fixtures.length && new Set(fixtures.map((f) => f.id)).size === fixtures.length && fullCoverage && results.length === fixtures.length,
        rows: computeStandings(clubIds,results,rules.points), mutualResults: results,
      }];
    }),
  };
}
