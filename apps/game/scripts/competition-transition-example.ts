// Developer example only: synthetic scores/eligibility on real canonical IDs, never a real season result.
import { computeStandings } from "@handball-manager/game-simulation";
import { CLUBS } from "../lib/game-data/clubs";
import { canonicalCompetitionClubs } from "../lib/competition/transition/careerSnapshot";
import { previewSeasonTransition, SWEDISH_2026_RULES as rules } from "../lib/competition/transition";
import type { PlannerInput, QualificationFixture } from "../lib/competition/transition";

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
const winners = new Map<string,string>();
const qualificationFixtures: QualificationFixture[] = [];
for (const stage of rules.stages.filter((s) => s.id.startsWith("hbl-") || s.id.startsWith("ha-"))) {
  const ids = stage.entrants.map((entrant) => {
    if (entrant.kind === "WINNER") {
      const id = winners.get(entrant.stageId);
      if (!id) throw new Error("Synthetic example is missing a prior qualification winner");
      return id;
    }
    const entry = rules.entries.find((e) => e.id === entrant.entryId)!;
    if (entry.selector.kind !== "RANK") throw new Error("Synthetic top-tier example cannot invent district entrants");
    return standings.find((t) => entry.selector.kind === "RANK" && t.competitionId === entry.selector.competitionId)!.rows[entry.selector.rank-1]!.clubId;
  });
  const winner = ids[["hbl-11","ha-final-11"].includes(stage.id) ? 1 : 0]!;
  winners.set(stage.id,winner);
  const games = stage.format === "BEST_OF_5" ? 3 : 2;
  for (let i=0;i<games;i++) {
    const homeClubId = ids[stage.homeOrder![i]!]!,awayClubId = ids[1-stage.homeOrder![i]!]!;
    qualificationFixtures.push({ id:`synthetic:${stage.id}:${i+1}`,stageId:stage.id,seasonId:rules.seasonId,game:i+1,homeClubId,awayClubId,
      result:{ homeGoals:homeClubId === winner ? 30 : 20,awayGoals:awayClubId === winner ? 30 : 20,origin:"CAREER_SIMULATED",evidence:"Synthetic example completed qualification score, not a real-world result" } });
  }
}
const preview = previewSeasonTransition({ ...input,qualificationFixtures:process.argv.includes("--unresolved") ? [] : qualificationFixtures });
const proposal = preview.proposal;
console.log(JSON.stringify(process.argv.includes("--full") ? { example:"SYNTHETIC, not real-world outcomes",...preview } : {
  example:"SYNTHETIC, not real-world outcomes",ruleId:proposal.ruleId,status:proposal.status,
  modeledClubCount:proposal.clubs.length,
  directPromotions:proposal.directPromotions.map((c) => ({ clubId:c.clubId,to:c.toFamilyId,via:c.via })),
  directRelegationCount:proposal.directRelegations.length,
  remainingCount:proposal.remaining.length,
  qualificationStageCount:proposal.qualification.length,
  resolvedQualificationStages:proposal.qualification.filter((q) => q.status === "CONFIRMED").length,
  qualificationMovements:proposal.qualificationMovements.map((c) => ({ clubId:c.clubId,to:c.toFamilyId,kind:c.kind })),
  modeledMembershipReady:preview.modeledMembershipReady,canGenerateNextSeason:preview.canGenerateNextSeason,
  leaguePreview:preview.leagues.map((l) => ({ competitionId:l.competitionId,current:l.currentClubIds.length,incoming:l.confirmedIncoming.map((c) => c.clubId),outgoing:l.confirmedOutgoing.map((c) => c.clubId),awaitingQualification:l.awaitingQualificationClubIds,awaitingAllocation:l.familyClubIdsAwaitingAllocation.length,membershipReady:l.membershipReady })),
  unresolvedPaths:preview.unresolvedPaths,
  firstQualification:proposal.qualification[0],
  unresolvedExternalSlots:proposal.dependencies.filter((d) => d.code === "MISSING_EXTERNAL_ENTRANT").map((d) => d.ref),
  dependencyCodes:[...new Set(proposal.dependencies.map((d) => d.code))],
},null,2));
