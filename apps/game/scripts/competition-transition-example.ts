// Developer example only: synthetic scores/eligibility on real canonical IDs, never a real season result.
import { computeStandings } from "@handball-manager/game-simulation";
import { CLUBS } from "../lib/game-data/clubs";
import { canonicalCompetitionClubs } from "../lib/competition/transition/careerSnapshot";
import { planCompetitionTransition, SWEDISH_2026_RULES as rules } from "../lib/competition/transition";
import type { PlannerInput } from "../lib/competition/transition";

const standings: PlannerInput["standings"] = rules.leagues.map((league) => {
  const ids = CLUBS.filter((club) => club.competitionId === league.id).map((club) => club.id).sort();
  const results = ids.flatMap((homeClubId,h) => ids.flatMap((awayClubId,a) => h === a ? [] : [{ homeClubId,awayClubId,homeGoals:h < a ? 30 : 20,awayGoals:h < a ? 20 : 30 }]));
  return { competitionId:league.id,seasonId:rules.seasonId,completed:true,rows:computeStandings(ids,results,rules.points),mutualResults:results };
});
const input: PlannerInput = {
  seasonId:rules.seasonId,rules,clubs:canonicalCompetitionClubs(),standings,
  eligibility:standings.flatMap((table) => {
    const source = rules.families.find((f) => f.id === rules.leagues.find((l) => l.id === table.competitionId)!.familyId)!;
    return table.rows.flatMap((row) => rules.families.filter((f) => f.tier === source.tier-1 || f.id === source.id).map((f) => ({ clubId:row.clubId,targetFamilyId:f.id,seasonId:rules.seasonId,status:"ELIGIBLE" as const,evidence:"Synthetic example attestation only; not actual licence or cooperation research." })));
  }),
};
const proposal = planCompetitionTransition(input);
console.log(JSON.stringify(process.argv.includes("--full") ? { example:"SYNTHETIC, not real-world outcomes",proposal } : {
  example:"SYNTHETIC, not real-world outcomes",ruleId:proposal.ruleId,status:proposal.status,
  modeledClubCount:proposal.clubs.length,
  directPromotions:proposal.directPromotions.map((c) => ({ clubId:c.clubId,to:c.toFamilyId,via:c.via })),
  directRelegationCount:proposal.directRelegations.length,
  remainingCount:proposal.remaining.length,
  qualificationStageCount:proposal.qualification.length,
  firstQualification:proposal.qualification[0],
  unresolvedExternalSlots:proposal.dependencies.filter((d) => d.code === "MISSING_EXTERNAL_ENTRANT").map((d) => d.ref),
  dependencyCodes:[...new Set(proposal.dependencies.map((d) => d.code))],
},null,2));
