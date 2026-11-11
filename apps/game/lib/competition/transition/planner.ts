import { rankCompletedTable } from "./ranking";
import { validatePlannerInput } from "./validation";
import { resolveQualificationFixtures } from "./qualificationFixtures";
import type { Dependency, EntryRule, EntrySelection, MovementClaim, PlannerInput, RankGroup, StageProposal, TransitionProposal } from "./types";

const alphabetical = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

/**
 * Pure sporting proposal. No live progression imports, persistence, RNG, clock, or strength inputs.
 * CONFIRMED means an evidenced sporting destination, not permission to apply a season rollover.
 */
export function planCompetitionTransition(input: PlannerInput): TransitionProposal {
  const r = input.rules;
  const dependencies = validatePlannerInput(input);
  const knownClubIds = [...new Set([...input.standings.flatMap((t) => t.rows.map((row) => row.clubId)), ...(input.externalEntrants ?? []).map((e) => e.clubId)])].sort(alphabetical);
  const empty = { ruleId: r.id, seasonId: input.seasonId, nextSeasonId: r.nextSeasonId, rankings: [], entries: [], directPromotions: [], directRelegations: [], qualificationMovements: [], remaining: [], qualification: [], sizes: [] };
  if (dependencies.length) return { ...empty, status: "BLOCKED", dependencies, clubs: knownClubIds.map((clubId) => ({ clubId, status: "BLOCKED", via: [] })) };

  const families = new Map(r.families.map((f) => [f.id,f]));
  const leagues = new Map(r.leagues.map((l) => [l.id,l]));
  const entryRules = new Map(r.entries.map((e) => [e.id,e]));
  const locations = new Map<string, { familyId: string; competitionId?: string }>();
  const rankings: { competitionId: string; groups: RankGroup[] }[] = [];
  const selections = new Map<string,EntrySelection>();
  const claims = new Map<string,MovementClaim>();
  const invalidClaims = new Set<string>();
  const reserved = new Set<string>();
  const pendingFamilies = new Set<string>();
  const qualification: StageProposal[] = [];
  const issue = (code: string, ref: string, message: string, status: Dependency["status"] = "UNRESOLVED") => {
    if (!dependencies.some((d) => d.code === code && d.ref === ref)) dependencies.push({ code, ref, message, status });
  };
  const sourceFamily = (e: EntryRule) => e.selector.kind === "RANK" ? leagues.get(e.selector.competitionId)!.familyId : e.selector.familyId;
  const pendingEntry = (e: EntryRule) => { pendingFamilies.add(sourceFamily(e)); pendingFamilies.add(e.targetFamilyId); };
  const groupFor = (competitionId: string, rank: number) => rankings.find((t) => t.competitionId === competitionId)?.groups.find((g) => g.ranks.includes(rank));
  const eligibility = (clubId: string, targetFamilyId: string) => input.eligibility?.find((e) => e.clubId === clubId && e.targetFamilyId === targetFamilyId);
  for (const l of r.leagues) {
    const table = input.standings.find((t) => t.competitionId === l.id);
    for (const row of table?.rows ?? []) locations.set(row.clubId, { familyId: l.familyId, competitionId: l.id });
    if (!table || !table.completed) {
      pendingFamilies.add(l.familyId);
      issue(table ? "INCOMPLETE_STANDINGS" : "MISSING_STANDINGS", l.id, "A completed source league is required; no strength-selected replacement is permitted.");
    } else rankings.push({ competitionId: l.id, groups: rankCompletedTable(table,r) });
  }
  for (const e of input.externalEntrants ?? []) {
    const rule = r.entries.find((x) => x.selector.kind === "EXTERNAL" && x.selector.slotId === e.slotId)!;
    locations.set(e.clubId, { familyId: sourceFamily(rule) });
  }

  function select(e: EntryRule, ids: readonly string[], confirmed: boolean, skipped: readonly string[] = []) {
    const selection: EntrySelection = { entryId: e.id, clubIds: [...ids], skippedClubIds: [...skipped], status: confirmed ? "CONFIRMED" : "UNRESOLVED" };
    selections.set(e.id,selection);
    if (!confirmed) pendingEntry(e);
    if (e.purpose === "QUALIFY") ids.forEach((id) => reserved.add(id));
  }
  function checkEligibility(e: EntryRule, clubId: string): boolean {
    if (!e.eligibility) return true;
    const decision = eligibility(clubId,e.targetFamilyId);
    if (decision?.status === "ELIGIBLE") return true;
    issue(decision?.status === "INELIGIBLE" ? "ADMINISTRATIVE_REPLACEMENT_REQUIRED" : "UNKNOWN_ELIGIBILITY", e.id,
      decision?.status === "INELIGIBLE" ? `Entry refused/ineligible: ${clubId}. This exact defensive/external slot needs an organizer decision.` : `Acceptance, licence and cooperation eligibility for ${clubId} → ${e.targetFamilyId} is unconfirmed.`, decision?.status === "INELIGIBLE" ? "BLOCKED" : "UNRESOLVED");
    return false;
  }

  // Upward replacements share a cursor: a selected club cannot fill both direct and kval slots.
  for (const l of r.leagues) {
    const upward = r.entries.filter((e) => e.selector.kind === "RANK" && e.selector.competitionId === l.id && e.replacement === "UPPER_HALF")
      .sort((a,b) => (a.selector.kind === "RANK" ? a.selector.rank : 0)-(b.selector.kind === "RANK" ? b.selector.rank : 0));
    let cursor = 1, priorUnresolved = false;
    for (const e of upward) {
      const skipped: string[] = [];
      if (priorUnresolved) {
        select(e,[],false);
        issue("PRIOR_ENTRY_UNRESOLVED", e.id, "Earlier upward allocation must resolve before later entries can be selected.");
        continue;
      }
      cursor = Math.max(cursor,e.selector.kind === "RANK" ? e.selector.rank : 1);
      let selected = false;
      for (; cursor <= Math.ceil(l.size/2); cursor++) {
        const g = groupFor(l.id,cursor);
        if (!g) { select(e,[],false,skipped); break; }
        if (g.clubIds.length !== 1) {
          select(e,g.clubIds,false,skipped);
          issue(g.reason ?? "UNRESOLVED_RANK", `${l.id}:${g.ranks.join(",")}`, `Ranks ${g.ranks.join(",")} cannot allocate an advancement slot without sporting tie resolution.`);
          break;
        }
        const clubId = g.clubIds[0]!;
        const decision = eligibility(clubId,e.targetFamilyId);
        if (decision?.status === "INELIGIBLE") { skipped.push(clubId); continue; }
        const ok = checkEligibility(e,clubId);
        select(e,[clubId],ok,skipped);
        selected = ok;
        cursor++;
        break;
      }
      if (!selections.has(e.id)) {
        select(e,[],false,skipped);
        issue("VACANCY_OR_CANCELLATION_REQUIRED", e.id, "No eligible upper-half entrant remains. The organizer must apply the vacancy/cancellation rules.", "BLOCKED");
      }
      priorUnresolved = !selected;
      if (priorUnresolved) {
        // A pending replacement can consume otherwise retained upper-half ranks, too.
        // Do not confirm retention for any still-eligible candidate while that allocation is unknown.
        const fromRank = selections.get(e.id)!.clubIds.flatMap((id) => rankings.find((t) => t.competitionId === l.id)?.groups.filter((g) => g.clubIds.includes(id)).flatMap((g) => g.ranks) ?? []);
        const firstPossibleRank = fromRank.length ? Math.min(...fromRank) : cursor;
        for (let rank = firstPossibleRank; rank <= Math.ceil(l.size/2); rank++) {
          for (const id of groupFor(l.id,rank)?.clubIds ?? []) if (eligibility(id,e.targetFamilyId)?.status !== "INELIGIBLE") reserved.add(id);
        }
      }
    }
  }

  for (const e of r.entries.filter((e) => e.replacement === "NONE")) {
    if (e.selector.kind === "EXTERNAL") {
      const external = input.externalEntrants?.find((x) => x.slotId === (e.selector.kind === "EXTERNAL" ? e.selector.slotId : ""));
      if (!external) {
        select(e,[],false);
        issue("MISSING_EXTERNAL_ENTRANT", e.id, "District entry is unresolved; no missing club or qualification result will be fabricated.");
      } else select(e,[external.clubId],checkEligibility(e,external.clubId));
    } else {
      const g = groupFor(e.selector.competitionId,e.selector.rank);
      if (!g) { select(e,[],false); continue; }
      // Tied ranks with identical ordinary retention/destination do not affect sporting movement.
      const equivalent = g.ranks.every((rank) => r.entries.some((other) => other.selector.kind === "RANK" && other.selector.competitionId === (e.selector.kind === "RANK" ? e.selector.competitionId : "") && other.selector.rank === rank && other.purpose === e.purpose && other.targetFamilyId === e.targetFamilyId && other.replacement === "NONE" && !other.eligibility && e.purpose !== "QUALIFY"));
      if (g.clubIds.length > 1 && !equivalent) {
        select(e,g.clubIds,false);
        issue(g.reason ?? "UNRESOLVED_RANK", `${e.selector.competitionId}:${g.ranks.join(",")}`, "Relevant rank remains tied. Display order cannot determine sporting rights.");
      } else select(e,g.clubIds,g.clubIds.every((id) => checkEligibility(e,id)));
    }
  }

  function addClaim(clubId: string, target: string, via: string, source: MovementClaim["source"]) {
    if (invalidClaims.has(clubId)) return;
    const from = locations.get(clubId)!;
    const a = families.get(from.familyId)!, b = families.get(target)!;
    if (a.nation !== b.nation || a.category !== b.category || Math.abs(a.tier-b.tier) > 1) {
      invalidClaims.add(clubId); claims.delete(clubId);
      issue("INVALID_DIVISION_BOUNDARY", clubId, "Outcome crosses an unsupported country/category/tier boundary.", "BLOCKED");
      return;
    }
    const old = claims.get(clubId);
    if (old) {
      if (old.toFamilyId === target && old.via === via) return;
      // Two tied direct-relegation ranks can establish the same destination without choosing an order.
      if (old.toFamilyId === target && entryRules.get(via)?.purpose === "DIRECT" && old.via.split("|").every((id) => entryRules.get(id)?.purpose === "DIRECT")) {
        claims.set(clubId,{ ...old,via:[...new Set([...old.via.split("|"),via])].sort(alphabetical).join("|") });
        return;
      }
      invalidClaims.add(clubId); claims.delete(clubId);
      issue("CONFLICTING_MEMBERSHIP_CLAIMS", clubId, "A club received multiple terminal destination claims.", "BLOCKED");
      return;
    }
    const targetLeagues = [...r.leagues, ...(r.boundaryLeagues ?? [])].filter((l) => l.familyId === target);
    const allocation = input.groupAllocations?.find((x) => x.clubId === clubId);
    let toCompetitionId = targetLeagues.length === 1 ? targetLeagues[0]!.id : undefined;
    if (allocation) {
      if (!targetLeagues.some((l) => l.id === allocation.competitionId)) issue("ALLOCATION_DESTINATION_MISMATCH", clubId, "Allocation disagrees with sporting destination.", "BLOCKED");
      else toCompetitionId = allocation.competitionId;
    }
    claims.set(clubId,{ clubId, fromCompetitionId: from.competitionId, fromFamilyId: from.familyId, toFamilyId: target, toCompetitionId, kind: a.tier === b.tier ? "REMAIN" : a.tier > b.tier ? "PROMOTION" : "RELEGATION", via, source: { ...source } });
  }
  for (const e of r.entries.filter((e) => e.purpose === "DIRECT")) {
    const selection = selections.get(e.id)!;
    if (selection.status === "CONFIRMED") selection.clubIds.forEach((id) => addClaim(id,e.targetFamilyId,e.id,e.source));
  }

  function stageFamilyIds(id: string): Set<string> {
    const s = r.stages.find((x) => x.id === id)!;
    const ids = new Set<string>();
    for (const e of s.entrants) {
      if (e.kind === "ENTRY") ids.add(sourceFamily(entryRules.get(e.entryId)!));
      else stageFamilyIds(e.stageId).forEach((f) => ids.add(f));
    }
    if (s.winnerFamilyId) ids.add(s.winnerFamilyId);
    if (s.loserFamilyId) ids.add(s.loserFamilyId);
    return ids;
  }
  for (const s of r.stages) {
    const participants = s.entrants.map((e) => {
      if (e.kind === "ENTRY") {
        const selection = selections.get(e.entryId)!;
        return { clubId: selection.clubIds.length === 1 ? selection.clubIds[0]! : null, ready: selection.status === "CONFIRMED" };
      }
      const prior = qualification.find((q) => q.stageId === e.stageId)!;
      return { clubId: prior.winnerClubId ?? null, ready: prior.status === "CONFIRMED" };
    });
    const ids = participants.map((p) => p.clubId);
    let homeOrder = s.homeOrder;
    if (s.homeReference === "BETTER_SOURCE_RANK") {
      const ranks = ids.map((id) => rankings.flatMap((t) => t.groups).find((g) => g.clubIds.length === 1 && g.clubIds[0] === id)?.ranks[0]);
      if (ranks[0] === undefined || ranks[1] === undefined) homeOrder = null;
      else if (ranks[0] === ranks[1]) homeOrder = r.provenance === "GAME_CONTINUITY" ? s.equalRankHomeOrder ?? null : null;
      else if (ranks[1] < ranks[0]) homeOrder = homeOrder?.map((i) => i === 0 ? 1 : 0) ?? null;
    }
    const recorded = input.qualificationResults?.find((q) => q.stageId === s.id);
    const hasFixtures = input.qualificationFixtures?.some((f) => f.stageId === s.id) ?? false;
    const entrantsReady = participants.every((p) => p.ready);
    const fixtureResolution = hasFixtures && entrantsReady ? resolveQualificationFixtures(input,s,ids as string[],homeOrder) : undefined;
    for (const d of fixtureResolution?.dependencies ?? []) issue(d.code,d.ref,d.message,d.status);
    if (hasFixtures && !entrantsReady) issue("FIXTURES_AWAIT_ENTRANTS",s.id,"Fixture scores cannot establish missing entrants or bypass unresolved qualification feeds/eligibility.");
    for (const feed of s.entrants) if (feed.kind === "WINNER" && qualification.find((q) => q.stageId === feed.stageId)?.status === "BLOCKED") issue("UPSTREAM_QUALIFICATION_BLOCKED",s.id,`Required winner feed ${feed.stageId} is blocked.`,"BLOCKED");
    let result: { winnerClubId: string; evidence: string } | undefined;
    if (recorded && participants.every((p) => p.ready)) {
      if (ids[0] === ids[1] || !recorded.participants.every((id) => ids.includes(id))) issue("RESULT_PARTICIPANTS_MISMATCH", s.id, "Recorded result does not match the entrants selected by this season's graph.", "BLOCKED");
      else if (!hasFixtures) result = recorded;
      else if (fixtureResolution?.winnerClubId && fixtureResolution.winnerClubId !== recorded.winnerClubId) issue("QUALIFICATION_RESULT_CONFLICT",s.id,"Recorded series winner contradicts supplied completed fixture results.","BLOCKED");
      else if (!fixtureResolution?.winnerClubId) issue("RECORDED_RESULT_AWAITS_FIXTURES",s.id,"Supplied fixture evidence must resolve completely; a winner-only record cannot hide missing or undecided fixtures.");
    } else if (recorded) issue("RESULT_AWAITS_ENTRANTS", s.id, "A recorded winner cannot bypass a missing source table, qualification feed or eligibility decision.");
    if (fixtureResolution?.winnerClubId) result = { winnerClubId:fixtureResolution.winnerClubId,evidence:fixtureResolution.evidence! };
    if (dependencies.some((d) => d.ref === s.id && d.status === "BLOCKED")) result = undefined;
    const fixtureDetails = hasFixtures ? { completedFixtureIds:fixtureResolution?.completedFixtureIds ?? [],seriesWins:fixtureResolution?.seriesWins } : {};
    if (result) {
      const loserClubId = ids.find((id) => id !== result.winnerClubId)!;
      qualification.push({ stageId: s.id, status: "CONFIRMED", participants: ids, winnerClubId: result.winnerClubId, loserClubId, resultEvidence: result.evidence, resolutionMethod:hasFixtures ? "FIXTURES" : "RECORDED_RESULT",...fixtureDetails,format: s.format, source: { ...s.source }, unresolvedFixtures: [] });
      if (s.winnerFamilyId) addClaim(result.winnerClubId,s.winnerFamilyId,s.id,s.source);
      if (s.loserFamilyId) addClaim(loserClubId,s.loserFamilyId,s.id,s.source);
    } else {
      issue("QUALIFICATION_RESULT_UNKNOWN", s.id, "No usable concluded qualification result; winner and loser remain unresolved.");
      if (!homeOrder) issue("HOME_PRIORITY_UNVERIFIED", s.id, "Home reference is unverified or the actual source ranks do not establish a better finisher. Home fixtures cannot be assigned.", "BLOCKED");
      stageFamilyIds(s.id).forEach((id) => pendingFamilies.add(id));
      const games = s.format === "BEST_OF_5" ? 5 : s.format === "BEST_OF_3" ? 3 : 2;
      qualification.push({ stageId: s.id, status: dependencies.some((d) => d.ref === s.id && d.status === "BLOCKED") ? "BLOCKED" : "UNRESOLVED", participants: ids,...fixtureDetails,format: s.format, source: { ...s.source }, unresolvedFixtures: Array.from({ length: games }, (_,i) => ({ game: i+1, homeClubId: homeOrder ? ids[homeOrder[i]!]! : null, awayClubId: homeOrder ? ids[1-homeOrder[i]!]! : null, conditional: s.format !== "TWO_LEG" && i >= Math.ceil(games/2) })).filter((f) => !fixtureResolution?.decidedGames.includes(f.game)) });
    }
  }

  // Replacements can consume a normally retained rank. Only the resolved sporting path owns that club.
  for (const e of r.entries.filter((e) => e.purpose === "RETAIN")) {
    const selection = selections.get(e.id)!;
    if (selection.status !== "CONFIRMED") continue;
    const consumed = selection.clubIds.filter((id) => reserved.has(id) || claims.has(id));
    if (consumed.length) {
      const owners = [...new Set(consumed.flatMap((id) => claims.get(id)?.via ?? [...selections.values()].filter((s) => s.status === "CONFIRMED" && s.clubIds.includes(id) && entryRules.get(s.entryId)?.purpose !== "RETAIN").map((s) => s.entryId)))].sort(alphabetical);
      const confirmedOwner = consumed.every((id) => claims.has(id) || [...selections.values()].some((s) => s.status === "CONFIRMED" && s.clubIds.includes(id) && entryRules.get(s.entryId)?.purpose === "QUALIFY"));
      selections.set(e.id,{ ...selection,status:confirmedOwner ? "SUPERSEDED" : "UNRESOLVED",supersededBy:owners });
      if (!confirmedOwner) { pendingEntry(e); issue("REPLACEMENT_SLOT_UNRESOLVED",e.id,"A pending upward replacement may consume this normally retained position."); }
    }
    for (const id of selection.clubIds) if (!reserved.has(id) && !claims.has(id) && !invalidClaims.has(id)) addClaim(id,e.targetFamilyId,e.id,e.source);
  }
  // Ineligible/declining upward entrants not selected elsewhere retain their current sporting tier.
  for (const e of r.entries.filter((e) => e.replacement === "UPPER_HALF" && e.selector.kind === "RANK")) {
    if (e.selector.kind !== "RANK") continue;
    const g = groupFor(e.selector.competitionId,e.selector.rank);
    for (const id of g?.clubIds ?? []) if (eligibility(id,e.targetFamilyId)?.status === "INELIGIBLE" && !reserved.has(id) && !claims.has(id) && !invalidClaims.has(id)) addClaim(id,sourceFamily(e),`declined:${e.id}`,e.source);
  }

  for (const f of r.families) {
    const assigned = [...claims.values()].filter((c) => c.toFamilyId === f.id);
    if (f.boundary && assigned.some((c) => c.kind === "RELEGATION" && !c.toCompetitionId)) issue("EXTERNAL_DESTINATION_UNRESOLVED", f.id, "Relegated identities are preserved at the boundary; district group assignments are not known.");
    if (r.leagues.filter((l) => l.familyId === f.id).length > 1 && assigned.some((c) => !c.toCompetitionId)) issue("GROUP_ALLOCATION_REQUIRED", f.id, "Tier destinations are known for some clubs; geographic next-season group allocation is still required.");
  }
  const sizes: TransitionProposal["sizes"][number][] = [];
  for (const f of r.families.filter((f) => !f.boundary)) {
    const expected = r.leagues.filter((l) => l.familyId === f.id).reduce((n,l) => n+l.size,0);
    const confirmed = [...claims.values()].filter((c) => c.toFamilyId === f.id).length;
    const wrong = confirmed > expected || (!pendingFamilies.has(f.id) && confirmed !== expected);
    sizes.push({ scopeId: f.id, expected, confirmed, status: wrong ? "BLOCKED" : pendingFamilies.has(f.id) ? "UNRESOLVED" : "VALID" });
    if (wrong) issue("TARGET_SIZE_MISMATCH", f.id, `Expected ${expected} ordinary members, got ${confirmed} confirmed. Capacity exceptions require organizer review.`, "BLOCKED");
  }
  for (const l of r.leagues.filter((l) => r.leagues.filter((other) => other.familyId === l.familyId).length > 1)) {
    const familyClaims = [...claims.values()].filter((c) => c.toFamilyId === l.familyId);
    const confirmed = familyClaims.filter((c) => c.toCompetitionId === l.id).length;
    const allAllocated = !pendingFamilies.has(l.familyId) && familyClaims.every((c) => c.toCompetitionId);
    const wrong = confirmed > l.size || (allAllocated && confirmed !== l.size);
    sizes.push({ scopeId: l.id, expected: l.size, confirmed, status: wrong ? "BLOCKED" : allAllocated ? "VALID" : "UNRESOLVED" });
    if (wrong) issue("GROUP_SIZE_MISMATCH", l.id, "Next-season group size does not match the ordinary definition. No automatic balancing is permitted.", "BLOCKED");
  }
  for (const allocation of input.groupAllocations ?? []) if (!claims.has(allocation.clubId)) issue("ALLOCATION_AWAITS_OUTCOME", allocation.clubId, "An allocation cannot establish an unresolved sporting destination.");
  for (const limitation of r.limitations) issue(limitation.code,r.id,limitation.message);
  const orderedClaims = [...claims.values()].sort((a,b) => alphabetical(a.clubId,b.clubId));
  const isDirect = (c: MovementClaim) => c.via.split("|").every((id) => entryRules.get(id)?.purpose === "DIRECT");
  const clubs = knownClubIds.map((clubId) => {
    const claim = claims.get(clubId);
    const via = claim ? [claim.via] : [...selections.values()].filter((e) => e.status !== "SUPERSEDED" && e.clubIds.includes(clubId)).map((e) => e.entryId).sort(alphabetical);
    if (!claim && !invalidClaims.has(clubId)) issue("CLUB_DESTINATION_UNRESOLVED", clubId, "No confirmed terminal destination; relevant source entry/qualification must resolve.");
    return { clubId, status: invalidClaims.has(clubId) ? "BLOCKED" as const : claim ? "CONFIRMED" as const : "UNRESOLVED" as const, via };
  });
  dependencies.sort((a,b) => alphabetical(`${a.code}:${a.ref}`,`${b.code}:${b.ref}`));
  return {
    ruleId: r.id, seasonId: r.seasonId, nextSeasonId: r.nextSeasonId,
    status: dependencies.some((d) => d.status === "BLOCKED") ? "BLOCKED" : dependencies.length ? "UNRESOLVED" : "READY",
    rankings, entries: r.entries.map((e) => selections.get(e.id)!),
    directPromotions: orderedClaims.filter((c) => isDirect(c) && c.kind === "PROMOTION"),
    directRelegations: orderedClaims.filter((c) => isDirect(c) && c.kind === "RELEGATION"),
    qualificationMovements: orderedClaims.filter((c) => !isDirect(c) && c.kind !== "REMAIN"),
    remaining: orderedClaims.filter((c) => c.kind === "REMAIN"),
    clubs, qualification, sizes, dependencies,
  };
}
