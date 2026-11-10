import { planCompetitionTransition } from "./planner";
import type { Dependency, MovementClaim, PlannerInput, TransitionProposal } from "./types";

export type LeagueTransitionPreview = {
  readonly competitionId: string;
  readonly familyId: string;
  readonly currentClubIds: readonly string[];
  readonly confirmedIncoming: readonly MovementClaim[];
  readonly confirmedOutgoing: readonly MovementClaim[];
  readonly retainedInDivisionClubIds: readonly string[];
  readonly retainedLeagueClubIds: readonly string[];
  readonly confirmedNextClubIds: readonly string[];
  readonly awaitingQualificationClubIds: readonly string[];
  readonly unresolvedClubIds: readonly string[];
  /** Shared family pool; it must not be mistaken for confirmed entrants into either geographic group. */
  readonly familyClubIdsAwaitingAllocation: readonly string[];
  readonly missingExternalEntryIds: readonly string[];
  readonly membershipReady: boolean;
};
export type SeasonTransitionPreview = {
  readonly proposal: TransitionProposal;
  readonly leagues: readonly LeagueTransitionPreview[];
  readonly unresolvedPaths: readonly { readonly stageId: string; readonly status: "UNRESOLVED" | "BLOCKED" }[];
  readonly modeledMembershipReady: boolean;
  readonly canGenerateNextSeason: boolean;
  readonly blockers: readonly Dependency[];
};
const sort = (ids: readonly string[]) => [...ids].sort();

/** Read-only membership/readiness view of the existing proposal, with no independent movement logic. */
export function previewSeasonTransition(input: PlannerInput): SeasonTransitionPreview {
  const proposal = planCompetitionTransition(input);
  const claims = [...proposal.directPromotions,...proposal.directRelegations,...proposal.qualificationMovements,...proposal.remaining];
  const waiting = new Set(proposal.qualification.filter((q) => q.status !== "CONFIRMED").flatMap((q) => q.participants.filter((id): id is string => id !== null)));
  for (const selection of proposal.entries) if (selection.status === "UNRESOLVED" && input.rules.entries.find((e) => e.id === selection.entryId)?.purpose === "QUALIFY") selection.clubIds.forEach((id) => waiting.add(id));
  const missing = new Set(proposal.dependencies.filter((d) => d.code === "MISSING_EXTERNAL_ENTRANT").map((d) => d.ref));
  const leagues = input.rules.leagues.map((league): LeagueTransitionPreview => {
    const table = input.standings.find((t) => t.competitionId === league.id);
    const currentClubIds = sort(table?.rows.map((r) => r.clubId) ?? []);
    const targetClaims = claims.filter((c) => c.toCompetitionId === league.id);
    const familyClaimants = claims.filter((c) => c.toFamilyId === league.familyId && !c.toCompetitionId);
    const unresolvedClubIds = currentClubIds.filter((id) => proposal.clubs.find((c) => c.clubId === id)?.status !== "CONFIRMED");
    const size = proposal.sizes.find((s) => s.scopeId === league.id) ?? proposal.sizes.find((s) => s.scopeId === league.familyId);
    const missingExternalEntryIds = input.rules.entries.filter((e) => e.targetFamilyId === league.familyId && e.selector.kind === "EXTERNAL" && missing.has(e.id)).map((e) => e.id).sort();
    const localRefs = new Set([league.id,league.familyId,...currentClubIds,...targetClaims.map((c) => c.clubId)]);
    const locallyBlocked = proposal.dependencies.some((d) => d.status === "BLOCKED" && localRefs.has(d.ref));
    return {
      competitionId:league.id,familyId:league.familyId,currentClubIds,
      confirmedIncoming:targetClaims.filter((c) => c.fromCompetitionId !== league.id).sort((a,b) => a.clubId < b.clubId ? -1 : 1),
      confirmedOutgoing:claims.filter((c) => c.fromCompetitionId === league.id && (c.toFamilyId !== league.familyId || Boolean(c.toCompetitionId && c.toCompetitionId !== league.id))).sort((a,b) => a.clubId < b.clubId ? -1 : 1),
      retainedInDivisionClubIds:sort(claims.filter((c) => c.fromCompetitionId === league.id && c.toFamilyId === league.familyId).map((c) => c.clubId)),
      retainedLeagueClubIds:currentClubIds.filter((id) => targetClaims.some((c) => c.clubId === id)),
      confirmedNextClubIds:sort(targetClaims.map((c) => c.clubId)),
      awaitingQualificationClubIds:currentClubIds.filter((id) => waiting.has(id)),unresolvedClubIds,
      familyClubIdsAwaitingAllocation:sort(familyClaimants.map((c) => c.clubId)),missingExternalEntryIds,
      membershipReady:!locallyBlocked && Boolean(table?.completed) && size?.status === "VALID" && !unresolvedClubIds.length && !familyClaimants.length && !missingExternalEntryIds.length,
    };
  });
  const unresolvedPaths = proposal.qualification.filter((q) => q.status !== "CONFIRMED").map((q) => ({ stageId:q.stageId,status:q.status as "UNRESOLVED" | "BLOCKED" }));
  const modeledMembershipReady = leagues.length > 0 && leagues.every((l) => l.membershipReady) && proposal.entries.every((e) => e.status !== "UNRESOLVED") && proposal.clubs.every((c) => c.status === "CONFIRMED") && !unresolvedPaths.length;
  return { proposal,leagues,unresolvedPaths,modeledMembershipReady,canGenerateNextSeason:modeledMembershipReady && proposal.status === "READY",blockers:proposal.dependencies.map((d) => ({ ...d })) };
}
