// Club Identity C4 -- owner rule "THE A-TEAM ALWAYS HAS PRIORITY. THE B-TEAM MUST ADAPT."
//
// A B-team (a club bound to a parent by an agreement that establishes a
// competitive restriction) can never play in the same division as, or above,
// its A-team in the coming season. This module resolves that rule AFTER the
// existing planner has produced the sporting outcome and BEFORE the season
// transition commits league membership:
//
//  - the planner, its eligibility evidence and the qualification series stay
//    untouched (they are scheduled mid-season and must not change afterwards);
//  - a conflicting B-team moves down one tier at a time (back to the league it
//    came from, else its geographic league below; below Division 2 it goes to
//    the non-simulated Division 3);
//  - the place it leaves in a fixed-size league goes to the next eligible club
//    of the destination league's own sporting order (upper half, untied ranks,
//    existing eligibility evidence, the unchanged cooperation rule, regional
//    anchors), so every league keeps its size and region;
//  - conflicts are resolved top tier first, worst-ranked first, repeatedly,
//    until none remains -- or the transition is BLOCKED atomically with the
//    exact conflict. It never creates an invalid league structure.
//
// It is pure and deterministic (no ids, hashes or randomness decide a place).
import { getClub } from "../../game-data";
import type { CareerState } from "../../career/types";
import type { ClubPartnership } from "../../career/clubPartnerships";
import { cooperationEligibility } from "./cooperationEligibility";
import type { CompetitionRules, Dependency, EligibilityDecision, RankGroup } from "./types";

/** Non-simulated boundary below Division 2 (Club Identity C4). Clubs placed here leave the simulated pyramid. */
export const DIVISION_3_ID = "se_division3";

export interface ParentPriorityMove {
  clubId: string;
  parentClubIds: string[];
  from: string;
  to: string;
  replacement?: { clubId: string; from: string; to: string; rank: number };
  reason: string;
}

export interface ParentPriorityInput {
  state: Pick<CareerState, "seasonId" | "clubPartnerships" | "competitionMembership" | "worldSquads" | "gameDate" | "swedishContinuity">;
  rules: CompetitionRules;
  /** Final next-season membership from the planner; resolved on a copy. */
  membership: Readonly<Record<string, string>>;
  /** Current-season membership (where every club plays now). */
  current: (clubId: string) => string | undefined;
  rankings: readonly { competitionId: string; groups: readonly RankGroup[] }[];
  eligibility?: readonly EligibilityDecision[];
  /** Geographic league for a club in a tier with several leagues (Division 1 groups, Division 2 districts). */
  regionalLeague?: (clubId: string, candidates: readonly string[]) => string | undefined;
  /** Whether `clubId` may be placed in `competitionId` regionally (hard north/south anchors). */
  regionAllows?: (clubId: string, competitionId: string) => boolean;
  date: string;
}

export interface ParentPriorityResult {
  membership: Record<string, string>;
  moves: ParentPriorityMove[];
  blockers: Dependency[];
}

/** Agreements that establish an actual competitive restriction for the coming season (never historical, terminated or informal links). */
export function restrictingParents(partnerships: Readonly<Record<string, ClubPartnership>> | undefined, clubId: string, nextSeasonStart: string): string[] {
  return Object.values(partnerships ?? {})
    .filter((p) => p.clubBId === clubId && (p.type === "AFFILIATED_B_TEAM" || !!p.competitionRestriction?.applyParentDivisionRule))
    .filter((p) => p.startDate <= nextSeasonStart && p.status === "ACTIVE" && (!p.endDate || p.endDate >= nextSeasonStart))
    .map((p) => p.clubAId)
    .sort();
}

export function resolveParentPriority(input: ParentPriorityInput): ParentPriorityResult {
  const { rules, state, date } = input;
  const membership: Record<string, string> = { ...input.membership };
  const moves: ParentPriorityMove[] = [];
  const blockers: Dependency[] = [];
  const year = Number(state.seasonId.slice(0, 4));
  const nextSeasonStart = `${year + 1}-07-01`;
  const familyTier = new Map(rules.families.map((f) => [f.id, f.tier]));
  const maxTier = Math.max(...rules.families.map((f) => f.tier));
  const leagueTier = new Map<string, number>([
    ...rules.leagues.map((l) => [l.id, familyTier.get(l.familyId)!] as const),
    ...(rules.boundaryLeagues ?? []).map((l) => [l.id, familyTier.get(l.familyId)!] as const),
    [DIVISION_3_ID, maxTier + 1],
  ]);
  const fixedSize = new Map(rules.leagues.map((l) => [l.id, l.size]));
  const tierOf = (competitionId: string | undefined) => (competitionId ? leagueTier.get(competitionId) : undefined);
  const leaguesInTier = (tier: number) => [...leagueTier].filter(([, t]) => t === tier).map(([id]) => id).sort();
  const familyOf = (competitionId: string) => rules.leagues.find((l) => l.id === competitionId)?.familyId ?? rules.boundaryLeagues?.find((l) => l.id === competitionId)?.familyId;
  const finalOf = (clubId: string) => membership[clubId] ?? input.current(clubId);
  const pool = state.swedishContinuity?.pools?.[state.seasonId];

  /** Sporting order of a league: planner ranking groups, or the seeded Division 2 pool order. */
  const order = (competitionId: string): { clubId: string; rank: number; tied: boolean }[] => {
    const ranking = input.rankings.find((r) => r.competitionId === competitionId);
    if (ranking) return ranking.groups.flatMap((g) => g.clubIds.map((clubId) => ({ clubId, rank: Math.min(...g.ranks), tied: g.clubIds.length > 1 })));
    const district = competitionId.startsWith("se_division2_") ? pool?.districts?.[competitionId.slice("se_division2_".length)] : undefined;
    return (district?.order ?? []).map((clubId, i) => ({ clubId, rank: i + 1, tied: false }));
  };
  const rankIn = (clubId: string, competitionId: string) => order(competitionId).find((x) => x.clubId === clubId)?.rank ?? Number.MAX_SAFE_INTEGER;

  const requiredTier = (clubId: string): number | undefined => {
    const parents = restrictingParents(state.clubPartnerships, clubId, nextSeasonStart);
    const tiers = parents.map((p) => tierOf(finalOf(p))).filter((t): t is number => t !== undefined);
    return tiers.length ? Math.max(...tiers) + 1 : undefined;
  };
  const conflictOf = (clubId: string) => {
    const tier = tierOf(finalOf(clubId)), need = requiredTier(clubId);
    return tier !== undefined && need !== undefined && tier < need;
  };

  const destination = (clubId: string, from: string): string | undefined => {
    const tier = tierOf(from)! + 1;
    if (tier > maxTier) return DIVISION_3_ID;
    const now = input.current(clubId);
    if (now && tierOf(now) === tier) return now; // a refused promotion: back where it came from
    const options = leaguesInTier(tier);
    if (options.length === 1) return options[0];
    return input.regionalLeague?.(clubId, options);
  };

  const replacementFor = (vacated: string, source: string): { clubId: string; rank: number } | undefined | "TIED" => {
    const tier = tierOf(vacated)!;
    const family = familyOf(vacated);
    const ranked = order(source);
    const upperHalf = Math.ceil(ranked.length / 2);
    for (const c of ranked) {
      if (c.rank > upperHalf) break;
      if (finalOf(c.clubId) !== source) continue; // already moving: not available
      if (c.tied) return "TIED";
      const club = getClub(c.clubId);
      if (!club) continue;
      if (family && input.eligibility?.some((e) => e.clubId === c.clubId && e.targetFamilyId === family && e.status === "INELIGIBLE")) continue;
      if (!cooperationEligibility(state as CareerState, c.clubId, tier, date).eligible) continue;
      const need = requiredTier(c.clubId);
      if (need !== undefined && tier < need) continue; // the owner rule applies to the candidate too
      if (club.dataSource === "IDENTITY_ONLY" && !(state.worldSquads[c.clubId]?.length) && !source.startsWith("se_division2_")) continue;
      if (input.regionAllows && !input.regionAllows(c.clubId, vacated)) continue;
      return c;
    }
    return undefined;
  };

  const restrictedClubs = [...new Set(Object.values(state.clubPartnerships ?? {}).map((p) => p.clubBId))].sort();
  for (let guard = 0; guard < 500; guard++) {
    const conflicts = restrictedClubs.filter(conflictOf);
    if (!conflicts.length) return { membership, moves, blockers };
    // Top tier first; inside a league the worst-ranked B-team adapts first (sporting order, never id order).
    conflicts.sort((a, b) => tierOf(finalOf(a))! - tierOf(finalOf(b))! || rankIn(b, finalOf(b)!) - rankIn(a, finalOf(a)!) || (a < b ? -1 : 1));
    const clubId = conflicts[0]!;
    const from = finalOf(clubId)!;
    const parents = restrictingParents(state.clubPartnerships, clubId, nextSeasonStart);
    const nextSeason = `${year + 1}/${String(year + 2).slice(-2)}`;
    const reason = `A-team priority ${nextSeason}: ${parents.map((p) => `${p} plays ${finalOf(p)}`).join(", ")}; ${clubId} must play at least one tier below.`;
    const to = destination(clubId, from);
    if (!to) { blockers.push({ code: "PARENT_PRIORITY_NO_DESTINATION", ref: clubId, message: `${reason} No league one tier below ${from} accepts it.`, status: "BLOCKED" }); return { membership, moves, blockers }; }
    let replacement: ParentPriorityMove["replacement"];
    if (fixedSize.has(from) && to !== DIVISION_3_ID) {
      const pick = replacementFor(from, to);
      if (pick === "TIED") { blockers.push({ code: "PARENT_PRIORITY_UNRESOLVED_RANK", ref: `${to}:${clubId}`, message: `${reason} The next place in ${to}'s promotion order is tied; a sporting decision is required.`, status: "BLOCKED" }); return { membership, moves, blockers }; }
      if (!pick) { blockers.push({ code: "PARENT_PRIORITY_NO_ELIGIBLE_REPLACEMENT", ref: `${from}:${clubId}`, message: `${reason} No eligible upper-half club in ${to} can take its place in ${from}; league sizes would break.`, status: "BLOCKED" }); return { membership, moves, blockers }; }
      membership[pick.clubId] = from;
      replacement = { clubId: pick.clubId, from: to, to: from, rank: pick.rank };
    } else if (fixedSize.has(from)) {
      blockers.push({ code: "PARENT_PRIORITY_NO_DESTINATION", ref: clubId, message: `${reason} A fixed-size league cannot release a club to Division 3.`, status: "BLOCKED" });
      return { membership, moves, blockers };
    }
    membership[clubId] = to;
    moves.push({ clubId, parentClubIds: parents, from, to, ...(replacement ? { replacement } : {}), reason });
  }
  blockers.push({ code: "PARENT_PRIORITY_DID_NOT_TERMINATE", ref: state.seasonId, message: "Parent-priority allocation exceeded its safety bound.", status: "BLOCKED" });
  return { membership, moves, blockers };
}
